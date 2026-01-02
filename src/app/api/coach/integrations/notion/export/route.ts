/**
 * Notion Export API
 * 
 * POST /api/coach/integrations/notion/export
 * GET /api/coach/integrations/notion/export
 * 
 * Export data to Notion or list exports.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  exportClientToNotion,
  exportSessionNotesToNotion,
  exportCheckinToNotion,
  exportGoalToNotion,
  listNotionExports,
} from '@/lib/integrations';

/**
 * GET /api/coach/integrations/notion/export
 * 
 * List Notion exports
 */
export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const exports = await listNotionExports(organizationId, limit);

    return NextResponse.json({
      exports,
      count: exports.length,
    });
  } catch (error) {
    console.error('[NOTION_EXPORT_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

interface ExportRequest {
  type: 'client' | 'session' | 'checkin' | 'goal';
  data: Record<string, unknown>;
}

/**
 * POST /api/coach/integrations/notion/export
 * 
 * Export data to Notion
 */
export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body: ExportRequest = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: type, data' },
        { status: 400 }
      );
    }

    let result: { success: boolean; pageId?: string; error?: string };

    switch (type) {
      case 'client':
        if (!data.userId || !data.name) {
          return NextResponse.json(
            { error: 'Client data must include userId and name' },
            { status: 400 }
          );
        }
        result = await exportClientToNotion(organizationId, {
          userId: data.userId as string,
          name: data.name as string,
          email: data.email as string | undefined,
          joinedAt: data.joinedAt as string | undefined,
          currentGoal: data.currentGoal as string | undefined,
          streakDays: data.streakDays as number | undefined,
          programEnrollments: data.programEnrollments as string[] | undefined,
          squadMemberships: data.squadMemberships as string[] | undefined,
        });
        break;

      case 'session':
        if (!data.sessionId || !data.clientName || !data.sessionDate || !data.notes) {
          return NextResponse.json(
            { error: 'Session data must include sessionId, clientName, sessionDate, and notes' },
            { status: 400 }
          );
        }
        result = await exportSessionNotesToNotion(organizationId, {
          sessionId: data.sessionId as string,
          clientName: data.clientName as string,
          sessionDate: data.sessionDate as string,
          durationMinutes: data.durationMinutes as number | undefined,
          notes: data.notes as string,
          keyPoints: data.keyPoints as string[] | undefined,
          actionItems: data.actionItems as string[] | undefined,
          nextSteps: data.nextSteps as string | undefined,
        });
        break;

      case 'checkin':
        if (!data.clientUserId || !data.clientName || !data.date || !data.type) {
          return NextResponse.json(
            { error: 'Checkin data must include clientUserId, clientName, date, and type' },
            { status: 400 }
          );
        }
        result = await exportCheckinToNotion(organizationId, {
          clientUserId: data.clientUserId as string,
          clientName: data.clientName as string,
          date: data.date as string,
          type: data.type as 'morning' | 'evening',
          mood: data.mood as number | undefined,
          energy: data.energy as number | undefined,
          gratitude: data.gratitude as string[] | undefined,
          intentions: data.intentions as string[] | undefined,
          wins: data.wins as string[] | undefined,
          challenges: data.challenges as string[] | undefined,
          notes: data.notes as string | undefined,
        });
        break;

      case 'goal':
        if (!data.goalId || !data.clientUserId || !data.clientName || !data.title || !data.status) {
          return NextResponse.json(
            { error: 'Goal data must include goalId, clientUserId, clientName, title, and status' },
            { status: 400 }
          );
        }
        result = await exportGoalToNotion(organizationId, {
          goalId: data.goalId as string,
          clientUserId: data.clientUserId as string,
          clientName: data.clientName as string,
          title: data.title as string,
          description: data.description as string | undefined,
          status: data.status as 'active' | 'achieved' | 'abandoned',
          createdAt: data.createdAt as string,
          targetDate: data.targetDate as string | undefined,
          achievedAt: data.achievedAt as string | undefined,
          milestones: data.milestones as string[] | undefined,
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid export type. Must be: client, session, checkin, or goal' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Export failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      pageId: result.pageId,
    });
  } catch (error) {
    console.error('[NOTION_EXPORT_POST_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



