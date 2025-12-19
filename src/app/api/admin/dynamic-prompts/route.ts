/**
 * Admin API: Dynamic Prompts Management
 * 
 * GET /api/admin/dynamic-prompts - List all dynamic prompts (with optional filters)
 * POST /api/admin/dynamic-prompts - Create new dynamic prompt
 * 
 * Editor and Super Admin can access these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { DynamicPrompt, DynamicPromptType, DynamicPromptSlot } from '@/types';

// Valid types and slots
const VALID_TYPES: DynamicPromptType[] = ['morning', 'evening', 'weekly'];
const VALID_SLOTS: DynamicPromptSlot[] = ['goal', 'prompt', 'quote'];

export async function GET(request: NextRequest) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');
    const type = searchParams.get('type') as DynamicPromptType | null;
    const slot = searchParams.get('slot') as DynamicPromptSlot | null;

    // Build query
    let query: FirebaseFirestore.Query = adminDb.collection('dynamic_prompts');

    if (trackId) {
      if (trackId === 'null' || trackId === 'generic') {
        query = query.where('trackId', '==', null);
      } else {
        query = query.where('trackId', '==', trackId);
      }
    }

    if (type && VALID_TYPES.includes(type)) {
      query = query.where('type', '==', type);
    }

    if (slot && VALID_SLOTS.includes(slot)) {
      query = query.where('slot', '==', slot);
    }

    const promptsSnapshot = await query
      .orderBy('priority', 'asc')
      .get();

    const prompts = promptsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as DynamicPrompt[];

    // Also fetch track names for display
    const tracksSnapshot = await adminDb.collection('tracks').get();
    const tracks = Object.fromEntries(
      tracksSnapshot.docs.map(doc => [doc.id, doc.data().name])
    );

    return NextResponse.json({ prompts, tracks });
  } catch (error) {
    console.error('[ADMIN_DYNAMIC_PROMPTS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dynamic prompts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

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

    // Validate trackId if provided (must exist in tracks collection)
    if (body.trackId && body.trackId !== 'null') {
      const trackDoc = await adminDb.collection('tracks').doc(body.trackId).get();
      if (!trackDoc.exists) {
        return NextResponse.json(
          { error: 'Track not found' },
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
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('dynamic_prompts').add(promptData);

    console.log(`[ADMIN_DYNAMIC_PROMPTS_POST] Created prompt: ${docRef.id} (${body.type}/${body.slot})`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      prompt: { 
        id: docRef.id, 
        ...promptData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: 'Dynamic prompt created successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_DYNAMIC_PROMPTS_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create dynamic prompt' },
      { status: 500 }
    );
  }
}



