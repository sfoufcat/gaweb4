/**
 * Admin API: Single Starter Program Management
 * 
 * GET /api/admin/starter-programs/[programId] - Get program details with days
 * PUT /api/admin/starter-programs/[programId] - Update program
 * DELETE /api/admin/starter-programs/[programId] - Delete program
 * 
 * Editor and Super Admin can access these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { StarterProgram, StarterProgramDay, UserTrack, ProgramHabitTemplate, ClerkPublicMetadata } from '@/types';

// Valid track slugs
const VALID_TRACK_SLUGS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'general',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { programId } = await params;
    const programDoc = await adminDb.collection('starter_programs').doc(programId).get();

    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Starter program not found' }, { status: 404 });
    }

    const program = {
      id: programDoc.id,
      ...programDoc.data(),
      createdAt: programDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || programDoc.data()?.createdAt,
      updatedAt: programDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || programDoc.data()?.updatedAt,
    } as StarterProgram;

    // Also fetch all program days
    const daysSnapshot = await adminDb
      .collection('starter_program_days')
      .where('programId', '==', programId)
      .orderBy('dayIndex', 'asc')
      .get();

    const days = daysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as StarterProgramDay[];

    return NextResponse.json({ program, days });
  } catch (error) {
    console.error('[ADMIN_PROGRAM_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch starter program' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { programId } = await params;
    const body = await request.json();

    const programDoc = await adminDb.collection('starter_programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Starter program not found' }, { status: 404 });
    }

    const currentData = programDoc.data();

    // Validate track if being changed
    if (body.track && !VALID_TRACK_SLUGS.includes(body.track)) {
      return NextResponse.json(
        { error: `Invalid track. Must be one of: ${VALID_TRACK_SLUGS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate lengthDays if being changed
    if (body.lengthDays !== undefined) {
      if (typeof body.lengthDays !== 'number' || body.lengthDays < 1 || body.lengthDays > 365) {
        return NextResponse.json(
          { error: 'lengthDays must be a number between 1 and 365' },
          { status: 400 }
        );
      }
    }

    // If slug is being changed, check it doesn't conflict
    if (body.slug && body.slug !== currentData?.slug) {
      const existingProgram = await adminDb
        .collection('starter_programs')
        .where('slug', '==', body.slug)
        .limit(1)
        .get();

      if (!existingProgram.empty && existingProgram.docs[0].id !== programId) {
        return NextResponse.json(
          { error: `Program with slug "${body.slug}" already exists` },
          { status: 400 }
        );
      }
    }

    // If setting isDefaultForTrack to true, unset other defaults for this track
    const newTrack = body.track || currentData?.track;
    if (body.isDefaultForTrack === true && !currentData?.isDefaultForTrack) {
      const existingDefault = await adminDb
        .collection('starter_programs')
        .where('track', '==', newTrack)
        .where('isDefaultForTrack', '==', true)
        .get();

      for (const doc of existingDefault.docs) {
        if (doc.id !== programId) {
          await adminDb
            .collection('starter_programs')
            .doc(doc.id)
            .update({ 
              isDefaultForTrack: false,
              updatedAt: FieldValue.serverTimestamp(),
            });
        }
      }
    }

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.track !== undefined) updateData.track = body.track;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.lengthDays !== undefined) updateData.lengthDays = body.lengthDays;
    if (body.programOrder !== undefined) updateData.programOrder = body.programOrder;
    if (body.isDefaultForTrack !== undefined) updateData.isDefaultForTrack = body.isDefaultForTrack;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Handle default habits
    if (body.defaultHabits !== undefined) {
      const defaultHabits: ProgramHabitTemplate[] = [];
      if (Array.isArray(body.defaultHabits)) {
        for (const habit of body.defaultHabits) {
          if (!habit.title) continue;
          defaultHabits.push({
            title: habit.title,
            description: habit.description || '',
            frequency: habit.frequency || 'daily',
          });
        }
      }
      updateData.defaultHabits = defaultHabits;
    }

    await adminDb.collection('starter_programs').doc(programId).update(updateData);

    console.log(`[ADMIN_PROGRAM_PUT] Updated program: ${programId}`);

    // Fetch updated program
    const updatedDoc = await adminDb.collection('starter_programs').doc(programId).get();
    const updatedProgram = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.createdAt,
      updatedAt: updatedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.updatedAt,
    } as StarterProgram;

    return NextResponse.json({ 
      success: true, 
      program: updatedProgram,
      message: 'Starter program updated successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_PROGRAM_PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update starter program' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { programId } = await params;
    const programDoc = await adminDb.collection('starter_programs').doc(programId).get();

    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Starter program not found' }, { status: 404 });
    }

    const programSlug = programDoc.data()?.slug;

    // Safety check: Don't allow deleting programs that have active enrollments
    const activeEnrollments = await adminDb
      .collection('starter_program_enrollments')
      .where('programId', '==', programId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!activeEnrollments.empty) {
      return NextResponse.json(
        { error: `Cannot delete program "${programSlug}" - it has active enrollments. Deactivate it instead.` },
        { status: 400 }
      );
    }

    // Delete all program days first
    const daysSnapshot = await adminDb
      .collection('starter_program_days')
      .where('programId', '==', programId)
      .get();

    if (!daysSnapshot.empty) {
      const batch = adminDb.batch();
      daysSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`[ADMIN_PROGRAM_DELETE] Deleted ${daysSnapshot.size} program days`);
    }

    // Delete the program
    await adminDb.collection('starter_programs').doc(programId).delete();

    console.log(`[ADMIN_PROGRAM_DELETE] Deleted program: ${programId} (${programSlug})`);

    return NextResponse.json({ 
      success: true, 
      message: 'Starter program deleted successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_PROGRAM_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete starter program' },
      { status: 500 }
    );
  }
}

