/**
 * Coach API: Individual Client Week Management
 *
 * GET /api/coach/org-programs/[programId]/client-weeks/[clientWeekId] - Get a client week
 * PATCH /api/coach/org-programs/[programId]/client-weeks/[clientWeekId] - Update a client week
 * DELETE /api/coach/org-programs/[programId]/client-weeks/[clientWeekId] - Delete a client week
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ClientProgramWeek } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; clientWeekId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, clientWeekId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const clientWeekDoc = await adminDb.collection('client_program_weeks').doc(clientWeekId).get();
    if (!clientWeekDoc.exists || clientWeekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Client week not found' }, { status: 404 });
    }

    const clientWeek = {
      id: clientWeekDoc.id,
      ...clientWeekDoc.data(),
      createdAt: clientWeekDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || clientWeekDoc.data()?.createdAt,
      updatedAt: clientWeekDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || clientWeekDoc.data()?.updatedAt,
      lastSyncedAt: clientWeekDoc.data()?.lastSyncedAt?.toDate?.()?.toISOString?.() || clientWeekDoc.data()?.lastSyncedAt,
    } as ClientProgramWeek;

    return NextResponse.json({ clientWeek });
  } catch (error) {
    console.error('[COACH_CLIENT_WEEK_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch client week' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; clientWeekId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, clientWeekId } = await params;
    const body = await request.json();

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const clientWeekDoc = await adminDb.collection('client_program_weeks').doc(clientWeekId).get();
    if (!clientWeekDoc.exists || clientWeekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Client week not found' }, { status: 404 });
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      hasLocalChanges: true, // Mark as having local changes
    };

    // Content fields
    if (body.name !== undefined) updateData.name = body.name?.trim() || null;
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.theme !== undefined) updateData.theme = body.theme?.trim() || null;
    if (body.weeklyPrompt !== undefined) updateData.weeklyPrompt = body.weeklyPrompt?.trim() || null;
    if (body.weeklyTasks !== undefined) updateData.weeklyTasks = body.weeklyTasks || null;
    if (body.weeklyHabits !== undefined) updateData.weeklyHabits = body.weeklyHabits || null;
    if (body.currentFocus !== undefined) updateData.currentFocus = body.currentFocus || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.distribution !== undefined) updateData.distribution = body.distribution || 'repeat-daily';

    // Client-specific fields
    if (body.linkedSummaryIds !== undefined) updateData.linkedSummaryIds = body.linkedSummaryIds || [];
    if (body.linkedCallEventIds !== undefined) updateData.linkedCallEventIds = body.linkedCallEventIds || [];
    if (body.manualNotes !== undefined) updateData.manualNotes = body.manualNotes?.trim() || null;
    if (body.coachRecordingUrl !== undefined) updateData.coachRecordingUrl = body.coachRecordingUrl?.trim() || null;
    if (body.coachRecordingNotes !== undefined) updateData.coachRecordingNotes = body.coachRecordingNotes?.trim() || null;
    if (body.fillSource !== undefined) updateData.fillSource = body.fillSource || null;

    // Note: We don't allow updating positional fields (weekNumber, moduleId, order, etc.)
    // Those come from the template and are only updated via sync

    await adminDb.collection('client_program_weeks').doc(clientWeekId).update(updateData);
    console.log(`[COACH_CLIENT_WEEK_PATCH] Updated client week ${clientWeekId}`);

    // Fetch the updated week
    const savedDoc = await adminDb.collection('client_program_weeks').doc(clientWeekId).get();
    const savedWeek = {
      id: savedDoc.id,
      ...savedDoc.data(),
      createdAt: savedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.createdAt,
      updatedAt: savedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.updatedAt,
      lastSyncedAt: savedDoc.data()?.lastSyncedAt?.toDate?.()?.toISOString?.() || savedDoc.data()?.lastSyncedAt,
    } as ClientProgramWeek;

    return NextResponse.json({
      success: true,
      clientWeek: savedWeek,
      message: 'Client week updated successfully',
    });
  } catch (error) {
    console.error('[COACH_CLIENT_WEEK_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update client week' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; clientWeekId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, clientWeekId } = await params;

    // Verify program exists and belongs to this org
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists || programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const clientWeekDoc = await adminDb.collection('client_program_weeks').doc(clientWeekId).get();
    if (!clientWeekDoc.exists || clientWeekDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Client week not found' }, { status: 404 });
    }

    // Delete the client week
    await adminDb.collection('client_program_weeks').doc(clientWeekId).delete();
    console.log(`[COACH_CLIENT_WEEK_DELETE] Deleted client week ${clientWeekId}`);

    return NextResponse.json({
      success: true,
      message: 'Client week deleted successfully',
    });
  } catch (error) {
    console.error('[COACH_CLIENT_WEEK_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to delete client week' }, { status: 500 });
  }
}
