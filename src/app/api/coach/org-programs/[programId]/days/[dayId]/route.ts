/**
 * Coach API: Single Program Day Management
 * 
 * GET /api/coach/org-programs/[programId]/days/[dayId] - Get day details
 * DELETE /api/coach/org-programs/[programId]/days/[dayId] - Delete a program day
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { ProgramDay } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; dayId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, dayId } = await params;

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Get the day
    const dayDoc = await adminDb.collection('program_days').doc(dayId).get();
    if (!dayDoc.exists) {
      return NextResponse.json({ error: 'Program day not found' }, { status: 404 });
    }
    if (dayDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Day does not belong to this program' }, { status: 404 });
    }

    const dayData = dayDoc.data();
    const day: ProgramDay = {
      id: dayDoc.id,
      ...dayData,
      createdAt: dayData?.createdAt?.toDate?.()?.toISOString?.() || dayData?.createdAt,
      updatedAt: dayData?.updatedAt?.toDate?.()?.toISOString?.() || dayData?.updatedAt,
    } as ProgramDay;

    return NextResponse.json({ day });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_DAY_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch program day' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; dayId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId, dayId } = await params;

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    if (programDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Get the day
    const dayDoc = await adminDb.collection('program_days').doc(dayId).get();
    if (!dayDoc.exists) {
      return NextResponse.json({ error: 'Program day not found' }, { status: 404 });
    }
    if (dayDoc.data()?.programId !== programId) {
      return NextResponse.json({ error: 'Day does not belong to this program' }, { status: 404 });
    }

    const dayIndex = dayDoc.data()?.dayIndex;

    // Delete the day
    await adminDb.collection('program_days').doc(dayId).delete();

    console.log(`[COACH_ORG_PROGRAM_DAY_DELETE] Deleted day ${dayIndex} (${dayId}) from program ${programId}`);

    return NextResponse.json({ 
      success: true, 
      message: `Day ${dayIndex} deleted successfully`,
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_DAY_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete program day' }, { status: 500 });
  }
}



