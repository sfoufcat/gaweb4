/**
 * POST /api/coach/squads/[squadId]/convert-to-community
 * 
 * Converts a program squad into a standalone community squad.
 * This preserves the members, chat, and coach but removes the program/cohort link.
 * 
 * Authorization:
 * - Must be the coach of this squad OR admin/super_admin
 * - Squad must have a programId (be a program squad)
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { ClerkPublicMetadata } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { squadId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get role info from session claims
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;
    const userOrgId = publicMetadata?.organizationId;

    // Check if user can access coach dashboard
    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json(
        { error: 'Forbidden - Coach, Admin, or Super Admin access required' },
        { status: 403 }
      );
    }

    // Fetch the squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squadData = squadDoc.data();
    const coachId = squadData?.coachId || null;
    const squadOrgId = squadData?.organizationId || null;
    const programId = squadData?.programId || null;

    // Authorization check for coaches:
    // - Allow if squad is in coach's organization (multi-tenancy)
    // - Allow if coach is the assigned coach of this squad
    // - Allow if admin/super_admin
    if (role === 'coach') {
      const isInOrg = userOrgId && squadOrgId && userOrgId === squadOrgId;
      const isCoach = coachId === userId;
      
      if (!isInOrg && !isCoach) {
        return NextResponse.json(
          { error: 'Forbidden - You do not have access to this squad' },
          { status: 403 }
        );
      }
    }

    // Verify this is a program squad
    if (!programId) {
      return NextResponse.json(
        { error: 'This squad is not linked to a program. It may already be a standalone community.' },
        { status: 400 }
      );
    }

    // Get optional new name from body
    let body: { name?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    // Update squad to remove program/cohort link and clear grace period flags
    const updateData: Record<string, unknown> = {
      programId: null,
      cohortId: null,
      gracePeriodStartDate: null,
      gracePeriodMessageSent: false,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Allow coach to optionally rename the squad (e.g., "Jazz Mastery - Jan 2026" → "Jazz Alumni")
    if (body.name?.trim()) {
      updateData.name = body.name.trim();
    }

    await adminDb.collection('squads').doc(squadId).update(updateData);

    // Log the conversion
    console.log(
      `[CONVERT_TO_COMMUNITY] Squad ${squadId} converted from program ${programId} to standalone community by ${userId}`
    );

    // Fetch updated squad data
    const updatedDoc = await adminDb.collection('squads').doc(squadId).get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      message: 'Squad converted to standalone community',
      squad: {
        id: squadId,
        name: updatedData?.name,
        programId: null,
        cohortId: null,
        coachId: updatedData?.coachId,
        memberCount: updatedData?.memberIds?.length || 0,
      },
    });
  } catch (error) {
    console.error('[CONVERT_TO_COMMUNITY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to convert squad to community' },
      { status: 500 }
    );
  }
}

