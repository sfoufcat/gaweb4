/**
 * Coach API: Single Dynamic Prompt Management (org-scoped)
 * 
 * GET /api/coach/org-dynamic-prompts/[promptId] - Get prompt details
 * PUT /api/coach/org-dynamic-prompts/[promptId] - Update prompt
 * DELETE /api/coach/org-dynamic-prompts/[promptId] - Delete prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { DynamicPrompt, DynamicPromptType, DynamicPromptSlot } from '@/types';

// Valid types and slots
const VALID_TYPES: DynamicPromptType[] = ['morning', 'evening', 'weekly'];
const VALID_SLOTS: DynamicPromptSlot[] = ['goal', 'prompt', 'quote'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ promptId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { promptId } = await params;
    
    const promptDoc = await adminDb.collection('dynamic_prompts').doc(promptId).get();

    if (!promptDoc.exists) {
      return NextResponse.json({ error: 'Dynamic prompt not found' }, { status: 404 });
    }

    // Verify prompt belongs to this organization
    if (promptDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Prompt not found in your organization' }, { status: 404 });
    }

    const prompt = {
      id: promptDoc.id,
      ...promptDoc.data(),
      createdAt: promptDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || promptDoc.data()?.createdAt,
      updatedAt: promptDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || promptDoc.data()?.updatedAt,
    } as DynamicPrompt;

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('[COACH_ORG_DYNAMIC_PROMPT_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch dynamic prompt' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ promptId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { promptId } = await params;
    const body = await request.json();

    const promptDoc = await adminDb.collection('dynamic_prompts').doc(promptId).get();
    if (!promptDoc.exists) {
      return NextResponse.json({ error: 'Dynamic prompt not found' }, { status: 404 });
    }

    // Verify prompt belongs to this organization
    if (promptDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Prompt not found in your organization' }, { status: 404 });
    }

    // Validate type if being changed
    if (body.type && !VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate slot if being changed
    if (body.slot && !VALID_SLOTS.includes(body.slot)) {
      return NextResponse.json(
        { error: `Invalid slot. Must be one of: ${VALID_SLOTS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate trackId if provided (must exist in org's tracks)
    if (body.trackId !== undefined && body.trackId !== null && body.trackId !== 'null' && body.trackId !== '') {
      const trackDoc = await adminDb.collection('tracks').doc(body.trackId).get();
      if (!trackDoc.exists) {
        return NextResponse.json(
          { error: 'Track not found' },
          { status: 400 }
        );
      }
      // Verify track belongs to this organization
      if (trackDoc.data()?.organizationId !== organizationId) {
        return NextResponse.json(
          { error: 'Track not found in your organization' },
          { status: 400 }
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.trackId !== undefined) {
      updateData.trackId = (body.trackId === 'null' || body.trackId === '' || body.trackId === null) 
        ? null 
        : body.trackId;
    }
    if (body.type !== undefined) updateData.type = body.type;
    if (body.slot !== undefined) updateData.slot = body.slot;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.body !== undefined) updateData.body = body.body;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    await adminDb.collection('dynamic_prompts').doc(promptId).update(updateData);

    console.log(`[COACH_ORG_DYNAMIC_PROMPT_PUT] Updated prompt: ${promptId} in org ${organizationId}`);

    // Fetch updated prompt
    const updatedDoc = await adminDb.collection('dynamic_prompts').doc(promptId).get();
    const updatedPrompt = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.createdAt,
      updatedAt: updatedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.updatedAt,
    } as DynamicPrompt;

    return NextResponse.json({ 
      success: true, 
      prompt: updatedPrompt,
      message: 'Dynamic prompt updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_DYNAMIC_PROMPT_PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update dynamic prompt' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ promptId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { promptId } = await params;
    
    const promptDoc = await adminDb.collection('dynamic_prompts').doc(promptId).get();

    if (!promptDoc.exists) {
      return NextResponse.json({ error: 'Dynamic prompt not found' }, { status: 404 });
    }

    // Verify prompt belongs to this organization
    if (promptDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Prompt not found in your organization' }, { status: 404 });
    }

    await adminDb.collection('dynamic_prompts').doc(promptId).delete();

    console.log(`[COACH_ORG_DYNAMIC_PROMPT_DELETE] Deleted prompt: ${promptId} in org ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Dynamic prompt deleted successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_DYNAMIC_PROMPT_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete dynamic prompt' }, { status: 500 });
  }
}

