/**
 * Admin API: Single Dynamic Prompt Management
 * 
 * GET /api/admin/dynamic-prompts/[promptId] - Get prompt details
 * PUT /api/admin/dynamic-prompts/[promptId] - Update prompt
 * DELETE /api/admin/dynamic-prompts/[promptId] - Delete prompt
 * 
 * Editor and Super Admin can access these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { DynamicPrompt, DynamicPromptType, DynamicPromptSlot, ClerkPublicMetadata } from '@/types';

// Valid types and slots
const VALID_TYPES: DynamicPromptType[] = ['morning', 'evening', 'weekly'];
const VALID_SLOTS: DynamicPromptSlot[] = ['goal', 'prompt', 'quote'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ promptId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { promptId } = await params;
    const promptDoc = await adminDb.collection('dynamic_prompts').doc(promptId).get();

    if (!promptDoc.exists) {
      return NextResponse.json({ error: 'Dynamic prompt not found' }, { status: 404 });
    }

    const prompt = {
      id: promptDoc.id,
      ...promptDoc.data(),
      createdAt: promptDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || promptDoc.data()?.createdAt,
      updatedAt: promptDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || promptDoc.data()?.updatedAt,
    } as DynamicPrompt;

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('[ADMIN_DYNAMIC_PROMPT_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dynamic prompt' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ promptId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { promptId } = await params;
    const body = await request.json();

    const promptDoc = await adminDb.collection('dynamic_prompts').doc(promptId).get();
    if (!promptDoc.exists) {
      return NextResponse.json({ error: 'Dynamic prompt not found' }, { status: 404 });
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

    // Validate trackId if provided
    if (body.trackId !== undefined && body.trackId !== null && body.trackId !== 'null' && body.trackId !== '') {
      const trackDoc = await adminDb.collection('tracks').doc(body.trackId).get();
      if (!trackDoc.exists) {
        return NextResponse.json(
          { error: 'Track not found' },
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

    console.log(`[ADMIN_DYNAMIC_PROMPT_PUT] Updated prompt: ${promptId}`);

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
    console.error('[ADMIN_DYNAMIC_PROMPT_PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update dynamic prompt' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ promptId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { promptId } = await params;
    const promptDoc = await adminDb.collection('dynamic_prompts').doc(promptId).get();

    if (!promptDoc.exists) {
      return NextResponse.json({ error: 'Dynamic prompt not found' }, { status: 404 });
    }

    await adminDb.collection('dynamic_prompts').doc(promptId).delete();

    console.log(`[ADMIN_DYNAMIC_PROMPT_DELETE] Deleted prompt: ${promptId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Dynamic prompt deleted successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_DYNAMIC_PROMPT_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete dynamic prompt' },
      { status: 500 }
    );
  }
}



