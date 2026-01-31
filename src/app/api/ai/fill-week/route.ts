/**
 * AI Fill Week API
 *
 * POST /api/ai/fill-week - Generate week content from call summary, prompt, or PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { buildWeekFillPrompt } from '@/lib/ai/prompts';
import { validateWeekFillResult, type WeekFillResult } from '@/lib/ai/schemas';
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();

interface FillWeekRequest {
  programId: string;
  weekId: string;
  source: {
    type: 'call_summary' | 'prompt' | 'pdf';
    summaryId?: string;
    prompt?: string;
    pdfText?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();
    const body: FillWeekRequest = await request.json();

    const { programId, weekId, source } = body;

    // Validate required fields
    if (!programId || !weekId || !source?.type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data()!;

    // Find week in embedded weeks array (new architecture)
    // Weeks are stored in programs.weeks[] not in a separate collection
    const weeks = programData.weeks || [];
    let weekData = weeks.find((w: { id: string }) => w.id === weekId);

    // Fallback: try to find by weekNumber if weekId looks numeric
    if (!weekData && /^\d+$/.test(weekId)) {
      const weekNum = parseInt(weekId, 10);
      weekData = weeks.find((w: { weekNumber: number }) => w.weekNumber === weekNum);
    }

    if (!weekData) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // Get the source content
    let sourceContent: string;

    if (source.type === 'call_summary' && source.summaryId) {
      // Fetch call summary from org subcollection
      const summaryDoc = await adminDb
        .collection('organizations')
        .doc(organizationId)
        .collection('call_summaries')
        .doc(source.summaryId)
        .get();
      if (!summaryDoc.exists) {
        return NextResponse.json({ error: 'Call summary not found' }, { status: 404 });
      }

      const summaryData = summaryDoc.data()!;

      // Build content from summary
      const parts: string[] = [];
      if (summaryData.summary?.executive) {
        parts.push(`EXECUTIVE SUMMARY:\n${summaryData.summary.executive}`);
      }
      if (summaryData.summary?.keyDiscussionPoints?.length > 0) {
        parts.push(`KEY DISCUSSION POINTS:\n${summaryData.summary.keyDiscussionPoints.join('\n- ')}`);
      }
      if (summaryData.summary?.challenges?.length > 0) {
        parts.push(`CHALLENGES IDENTIFIED:\n${summaryData.summary.challenges.join('\n- ')}`);
      }
      if (summaryData.summary?.breakthroughs?.length > 0) {
        parts.push(`BREAKTHROUGHS:\n${summaryData.summary.breakthroughs.join('\n- ')}`);
      }
      if (summaryData.actionItems?.length > 0) {
        const actionItemsText = summaryData.actionItems
          .map((item: { description: string; assignedTo: string; priority: string }) =>
            `- [${item.priority}] ${item.description} (${item.assignedTo})`
          )
          .join('\n');
        parts.push(`ACTION ITEMS:\n${actionItemsText}`);
      }

      sourceContent = parts.join('\n\n');
    } else if (source.type === 'pdf' && source.pdfText) {
      sourceContent = source.pdfText;
    } else if (source.type === 'prompt' && source.prompt) {
      sourceContent = source.prompt;
    } else {
      return NextResponse.json({ error: 'Invalid source content' }, { status: 400 });
    }

    if (!sourceContent || sourceContent.trim().length < 50) {
      return NextResponse.json(
        { error: 'Source content is too short. Please provide more context.' },
        { status: 400 }
      );
    }

    // Build the prompt
    const { system, user } = buildWeekFillPrompt(
      { type: source.type, content: sourceContent },
      {
        programName: programData.name,
        programDescription: programData.description,
        weekNumber: weekData.weekNumber,
      }
    );

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: user }],
    });

    // Extract text content
    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
    }

    // Parse JSON response
    let parsedResponse: unknown;
    try {
      // Clean up the response - remove markdown code blocks if present
      let jsonStr = textBlock.text.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      parsedResponse = JSON.parse(jsonStr.trim());
    } catch {
      console.error('[AI_FILL_WEEK] Failed to parse JSON:', textBlock.text);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    // Apply fallback defaults for optional/missing fields before validation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = parsedResponse as any;
    if (!response.currentFocus || !Array.isArray(response.currentFocus) || response.currentFocus.length === 0) {
      response.currentFocus = ['Review and complete assigned tasks'];
    }
    if (!response.tasks || !Array.isArray(response.tasks)) {
      response.tasks = [];
    }
    // Ensure each task has required fields with defaults
    response.tasks = response.tasks.map((t: Record<string, unknown>) => ({
      label: t.label || t.title || 'Untitled task',
      type: t.type || 'task',
      isPrimary: t.isPrimary ?? false,
      estimatedMinutes: t.estimatedMinutes,
      notes: t.notes,
      tag: t.tag,
    }));

    // Validate the response
    const validationResult = validateWeekFillResult(response);
    if (!validationResult.success) {
      console.error('[AI_FILL_WEEK] Validation failed:', validationResult.errors);
      return NextResponse.json(
        { error: 'Generated content failed validation', details: validationResult.errors },
        { status: 500 }
      );
    }

    const result: WeekFillResult = validationResult.data!;

    // Track usage (optional - for future billing)
    const usageDoc = {
      organizationId,
      userId,
      programId,
      weekId,
      sourceType: source.type,
      sourceSummaryId: source.summaryId || null,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      createdAt: new Date().toISOString(),
    };

    await adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('ai_usages')
      .add(usageDoc);

    console.log(
      `[AI_FILL_WEEK] Generated content for week ${weekData.weekNumber} of program ${programId}: ${result.tasks.length} tasks`
    );

    return NextResponse.json({
      success: true,
      result,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error('[AI_FILL_WEEK] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to generate week content' }, { status: 500 });
  }
}
