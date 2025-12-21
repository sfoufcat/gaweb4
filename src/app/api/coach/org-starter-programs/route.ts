/**
 * Coach API: Organization-scoped Starter Programs Management
 * 
 * GET /api/coach/org-starter-programs - List starter programs in coach's organization
 * POST /api/coach/org-starter-programs - Create new starter program in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { StarterProgram, UserTrack, ProgramHabitTemplate } from '@/types';

// Valid track slugs
const VALID_TRACK_SLUGS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'community_builder',
  'general',
];

export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_STARTER_PROGRAMS] Fetching programs for organization: ${organizationId}`);

    // Fetch both org-specific programs AND global/platform programs (no organizationId)
    // This allows coaches to see platform content plus their own customizations
    const [orgProgramsSnapshot, globalProgramsSnapshot] = await Promise.all([
      adminDb
        .collection('starter_programs')
        .where('organizationId', '==', organizationId)
        .orderBy('track', 'asc')
        .get(),
      adminDb
        .collection('starter_programs')
        .where('organizationId', '==', null)
        .orderBy('track', 'asc')
        .get()
        .catch(() => ({ docs: [] })), // Handle case where field doesn't exist
    ]);

    // Also try fetching programs without the organizationId field (legacy data)
    let legacyProgramsSnapshot: FirebaseFirestore.QuerySnapshot | null = null;
    try {
      // Get all programs and filter out ones that have organizationId
      const allProgramsSnapshot = await adminDb
        .collection('starter_programs')
        .orderBy('track', 'asc')
        .get();
      
      // Filter to only programs without organizationId field
      const legacyDocs = allProgramsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.organizationId === undefined || data.organizationId === null;
      });
      
      legacyProgramsSnapshot = { docs: legacyDocs } as unknown as FirebaseFirestore.QuerySnapshot;
    } catch {
      // Ignore errors
    }

    // Combine results, preferring org-specific over global, and dedupe by id
    const programMap = new Map<string, StarterProgram>();
    
    // Add legacy/global programs first (lower priority)
    if (legacyProgramsSnapshot) {
      legacyProgramsSnapshot.docs.forEach(doc => {
        programMap.set(doc.id, {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
        } as StarterProgram);
      });
    }
    
    globalProgramsSnapshot.docs.forEach(doc => {
      programMap.set(doc.id, {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      } as StarterProgram);
    });
    
    // Add org-specific programs (higher priority, overwrites global if same slug)
    orgProgramsSnapshot.docs.forEach(doc => {
      programMap.set(doc.id, {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      } as StarterProgram);
    });

    const programs = Array.from(programMap.values());

    return NextResponse.json({ 
      programs,
      totalCount: programs.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_STARTER_PROGRAMS_GET] Error:', error);
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
    
    return NextResponse.json({ error: 'Failed to fetch starter programs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['track', 'slug', 'name', 'description', 'lengthDays'];
    for (const field of requiredFields) {
      if (!body[field] && body[field] !== 0) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate track is valid
    if (!VALID_TRACK_SLUGS.includes(body.track)) {
      return NextResponse.json(
        { error: `Invalid track. Must be one of: ${VALID_TRACK_SLUGS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate lengthDays
    if (typeof body.lengthDays !== 'number' || body.lengthDays < 1 || body.lengthDays > 365) {
      return NextResponse.json(
        { error: 'lengthDays must be a number between 1 and 365' },
        { status: 400 }
      );
    }

    // Check if slug already exists in this organization
    const existingProgram = await adminDb
      .collection('starter_programs')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', body.slug)
      .limit(1)
      .get();

    if (!existingProgram.empty) {
      return NextResponse.json(
        { error: `Program with slug "${body.slug}" already exists in your organization` },
        { status: 400 }
      );
    }

    // If isDefaultForTrack is true, ensure no other program is default for this track in this org
    if (body.isDefaultForTrack) {
      const existingDefault = await adminDb
        .collection('starter_programs')
        .where('organizationId', '==', organizationId)
        .where('track', '==', body.track)
        .where('isDefaultForTrack', '==', true)
        .limit(1)
        .get();

      if (!existingDefault.empty) {
        // Unset the previous default
        await adminDb
          .collection('starter_programs')
          .doc(existingDefault.docs[0].id)
          .update({ 
            isDefaultForTrack: false,
            updatedAt: FieldValue.serverTimestamp(),
          });
        console.log(`[COACH_ORG_STARTER_PROGRAMS_POST] Unset previous default for track ${body.track} in org ${organizationId}`);
      }
    }

    // Validate default habits if provided
    const defaultHabits: ProgramHabitTemplate[] = [];
    if (body.defaultHabits && Array.isArray(body.defaultHabits)) {
      for (const habit of body.defaultHabits) {
        if (!habit.title) continue;
        defaultHabits.push({
          title: habit.title,
          description: habit.description || '',
          frequency: habit.frequency || 'daily',
        });
      }
    }

    const programData = {
      track: body.track,
      slug: body.slug,
      name: body.name,
      description: body.description,
      lengthDays: body.lengthDays,
      programOrder: typeof body.programOrder === 'number' ? body.programOrder : 1,
      isDefaultForTrack: body.isDefaultForTrack === true,
      isActive: body.isActive !== false,
      defaultHabits,
      organizationId, // Scope to coach's organization
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('starter_programs').add(programData);

    console.log(`[COACH_ORG_STARTER_PROGRAMS_POST] Created program: ${body.slug} (${docRef.id}) for track ${body.track} in org ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      program: { 
        id: docRef.id, 
        ...programData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: 'Starter program created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_ORG_STARTER_PROGRAMS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create starter program' }, { status: 500 });
  }
}

