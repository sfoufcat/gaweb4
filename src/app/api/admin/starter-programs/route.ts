/**
 * Admin API: Starter Programs Management
 * 
 * GET /api/admin/starter-programs - List all starter programs
 * POST /api/admin/starter-programs - Create new starter program
 * 
 * Editor and Super Admin can access these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { StarterProgram, UserTrack, ProgramHabitTemplate } from '@/types';

// Valid track slugs
const VALID_TRACK_SLUGS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'general',
];

export async function GET() {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const programsSnapshot = await adminDb
      .collection('starter_programs')
      .orderBy('track', 'asc')
      .get();

    const programs = programsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as StarterProgram[];

    return NextResponse.json({ programs });
  } catch (error) {
    console.error('[ADMIN_PROGRAMS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch starter programs' },
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

    // Check if slug already exists
    const existingProgram = await adminDb
      .collection('starter_programs')
      .where('slug', '==', body.slug)
      .limit(1)
      .get();

    if (!existingProgram.empty) {
      return NextResponse.json(
        { error: `Program with slug "${body.slug}" already exists` },
        { status: 400 }
      );
    }

    // If isDefaultForTrack is true, ensure no other program is default for this track
    if (body.isDefaultForTrack) {
      const existingDefault = await adminDb
        .collection('starter_programs')
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
        console.log(`[ADMIN_PROGRAMS_POST] Unset previous default for track ${body.track}`);
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
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('starter_programs').add(programData);

    console.log(`[ADMIN_PROGRAMS_POST] Created program: ${body.slug} (${docRef.id}) for track ${body.track}`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      program: { 
        id: docRef.id, 
        ...programData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: 'Starter program created successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_PROGRAMS_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create starter program' },
      { status: 500 }
    );
  }
}

