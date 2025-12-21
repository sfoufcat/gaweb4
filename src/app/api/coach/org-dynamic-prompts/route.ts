/**
 * Coach API: Organization-scoped Dynamic Prompts Management
 * 
 * GET /api/coach/org-dynamic-prompts - List dynamic prompts in coach's organization
 * POST /api/coach/org-dynamic-prompts - Create new dynamic prompt in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { DynamicPrompt, DynamicPromptType, DynamicPromptSlot } from '@/types';

// Valid types and slots
const VALID_TYPES: DynamicPromptType[] = ['morning', 'evening', 'weekly'];
const VALID_SLOTS: DynamicPromptSlot[] = ['goal', 'prompt', 'quote'];

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_DYNAMIC_PROMPTS] Fetching prompts for organization: ${organizationId}`);

    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');
    const type = searchParams.get('type') as DynamicPromptType | null;
    const slot = searchParams.get('slot') as DynamicPromptSlot | null;

    // Fetch both org-specific prompts AND global/platform prompts
    // This allows coaches to see platform content plus their own customizations
    
    // Get all prompts and filter based on criteria
    const allPromptsSnapshot = await adminDb
      .collection('dynamic_prompts')
      .orderBy('priority', 'asc')
      .get();

    // Filter prompts - include org-specific OR global (no organizationId)
    let prompts = allPromptsSnapshot.docs
      .filter(doc => {
        const data = doc.data();
        // Include if org matches OR if no organizationId (global/platform content)
        return data.organizationId === organizationId || 
               data.organizationId === undefined || 
               data.organizationId === null;
      })
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      })) as DynamicPrompt[];

    // Apply additional filters
    if (trackId) {
      if (trackId === 'null' || trackId === 'generic') {
        prompts = prompts.filter(p => p.trackId === null || p.trackId === undefined);
      } else {
        prompts = prompts.filter(p => p.trackId === trackId);
      }
    }

    if (type && VALID_TYPES.includes(type)) {
      prompts = prompts.filter(p => p.type === type);
    }

    if (slot && VALID_SLOTS.includes(slot)) {
      prompts = prompts.filter(p => p.slot === slot);
    }

    // Fetch track names for display - include both org tracks and global tracks
    const allTracksSnapshot = await adminDb.collection('tracks').get();
    const tracks = Object.fromEntries(
      allTracksSnapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data.organizationId === organizationId || 
                 data.organizationId === undefined || 
                 data.organizationId === null;
        })
        .map(doc => [doc.id, doc.data().name])
    );

    return NextResponse.json({ 
      prompts, 
      tracks,
      totalCount: prompts.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_DYNAMIC_PROMPTS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch dynamic prompts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['type', 'slot', 'body'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate type
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate slot
    if (!VALID_SLOTS.includes(body.slot)) {
      return NextResponse.json(
        { error: `Invalid slot. Must be one of: ${VALID_SLOTS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate trackId if provided (must exist in org's tracks collection)
    if (body.trackId && body.trackId !== 'null') {
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

    // Validate priority
    const priority = typeof body.priority === 'number' ? body.priority : 100;

    const promptData = {
      trackId: body.trackId === 'null' || !body.trackId ? null : body.trackId,
      type: body.type,
      slot: body.slot,
      title: body.title || '',
      body: body.body,
      priority,
      isActive: body.isActive !== false, // Default to true
      organizationId, // Scope to coach's organization
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('dynamic_prompts').add(promptData);

    console.log(`[COACH_ORG_DYNAMIC_PROMPTS_POST] Created prompt: ${docRef.id} (${body.type}/${body.slot}) in org ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      prompt: { 
        id: docRef.id, 
        ...promptData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: 'Dynamic prompt created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_ORG_DYNAMIC_PROMPTS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create dynamic prompt' }, { status: 500 });
  }
}

