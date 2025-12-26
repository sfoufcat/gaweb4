/**
 * Referral API: My Referrals
 * 
 * GET /api/referral/my-referrals - Get current user's referral history and stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Referral, ReferralWithDetails, Program, Squad } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    console.log(`[MY_REFERRALS] Fetching referrals for user: ${userId}`);

    // Build query for referrals made by this user
    let query = adminDb
      .collection('referrals')
      .where('referrerId', '==', userId)
      .orderBy('createdAt', 'desc');

    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    }

    const referralsSnapshot = await query.limit(100).get();

    // Collect referred user IDs for batch lookup
    const referredUserIds = new Set<string>();
    const programIds = new Set<string>();
    const squadIds = new Set<string>();

    referralsSnapshot.docs.forEach(doc => {
      const data = doc.data() as Referral;
      referredUserIds.add(data.referredUserId);
      if (data.programId) programIds.add(data.programId);
      if (data.squadId) squadIds.add(data.squadId);
    });

    // Fetch referred user details from Clerk
    const client = await clerkClient();
    let userMap = new Map<string, { firstName?: string; lastName?: string; email?: string; imageUrl?: string }>();
    
    if (referredUserIds.size > 0) {
      const userList = await client.users.getUserList({
        userId: Array.from(referredUserIds),
        limit: referredUserIds.size,
      });
      userMap = new Map(userList.data.map(u => [u.id, {
        firstName: u.firstName || undefined,
        lastName: u.lastName || undefined,
        email: u.emailAddresses[0]?.emailAddress,
        imageUrl: u.imageUrl,
      }]));
    }

    // Fetch program and squad names
    const programDocs = programIds.size > 0
      ? await Promise.all(
          Array.from(programIds).map(id => adminDb.collection('programs').doc(id).get())
        )
      : [];
    const programMap = new Map<string, string>();
    programDocs.forEach(doc => {
      if (doc.exists) {
        programMap.set(doc.id, (doc.data() as Program).name);
      }
    });

    const squadDocs = squadIds.size > 0
      ? await Promise.all(
          Array.from(squadIds).map(id => adminDb.collection('squads').doc(id).get())
        )
      : [];
    const squadMap = new Map<string, string>();
    squadDocs.forEach(doc => {
      if (doc.exists) {
        squadMap.set(doc.id, (doc.data() as Squad).name);
      }
    });

    // Build enriched referral list
    const referrals: ReferralWithDetails[] = referralsSnapshot.docs.map(doc => {
      const data = doc.data() as Referral;
      const referredUser = userMap.get(data.referredUserId);

      return {
        id: doc.id,
        ...data,
        referredUserName: referredUser 
          ? `${referredUser.firstName || ''} ${referredUser.lastName || ''}`.trim() || referredUser.email 
          : undefined,
        referredUserEmail: referredUser?.email,
        referredUserImageUrl: referredUser?.imageUrl,
        programName: data.programId ? programMap.get(data.programId) : undefined,
        squadName: data.squadId ? squadMap.get(data.squadId) : undefined,
      };
    });

    // Calculate stats
    const stats = {
      total: referrals.length,
      pending: referrals.filter(r => r.status === 'pending').length,
      completed: referrals.filter(r => r.status === 'completed').length,
      rewarded: referrals.filter(r => r.status === 'rewarded').length,
    };

    return NextResponse.json({
      referrals,
      stats,
    });
  } catch (error) {
    console.error('[MY_REFERRALS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

