/**
 * Squad Membership API
 * 
 * GET /api/squad/[squadId]/membership
 * Returns the current user's membership status for a specific squad,
 * including subscription information for paid squads.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Squad, SquadMember } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { squadId } = await params;

    if (!squadId) {
      return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
    }

    // Get squad to verify it exists
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;

    // Check if user is in the squad's memberIds
    const isMember = squad.memberIds?.includes(userId) || false;

    if (!isMember) {
      return NextResponse.json({
        isMember: false,
        subscriptionStatus: 'none',
        subscriptionId: null,
        currentPeriodEnd: null,
        accessEndsAt: null,
        cancelAtPeriodEnd: false,
      });
    }

    // Get squadMember document for subscription details
    const memberQuery = await adminDb
      .collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (memberQuery.empty) {
      // User is in memberIds but no squadMember doc - legacy member or free squad
      return NextResponse.json({
        isMember: true,
        subscriptionStatus: squad.subscriptionEnabled ? 'none' : 'active',
        subscriptionId: null,
        currentPeriodEnd: null,
        accessEndsAt: null,
        cancelAtPeriodEnd: false,
      });
    }

    const memberDoc = memberQuery.docs[0];
    const memberData = memberDoc.data() as SquadMember;

    // Return membership with subscription info
    return NextResponse.json({
      isMember: true,
      subscriptionStatus: memberData.subscriptionStatus || 'none',
      subscriptionId: memberData.subscriptionId || null,
      currentPeriodEnd: memberData.currentPeriodEnd || null,
      accessEndsAt: memberData.accessEndsAt || null,
      cancelAtPeriodEnd: memberData.cancelAtPeriodEnd || false,
      roleInSquad: memberData.roleInSquad || 'member',
    });
  } catch (error) {
    console.error('[SQUAD_MEMBERSHIP_GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


