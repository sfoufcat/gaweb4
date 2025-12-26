/**
 * Coach API: Referrals List and Stats
 * 
 * GET /api/coach/referrals - List all referrals with stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { clerkClient } from '@clerk/nextjs/server';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import type { Referral, ReferralWithDetails, Program, Squad } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const status = searchParams.get('status') as 'pending' | 'completed' | 'rewarded' | null;
    const programId = searchParams.get('programId');
    const squadId = searchParams.get('squadId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    console.log(`[COACH_REFERRALS] Fetching referrals for organization: ${organizationId}`);

    // Build query
    let query = adminDb
      .collection('referrals')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }
    if (programId) {
      query = query.where('programId', '==', programId);
    }
    if (squadId) {
      query = query.where('squadId', '==', squadId);
    }

    // Get total count for pagination
    const countQuery = adminDb
      .collection('referrals')
      .where('organizationId', '==', organizationId);
    const totalCount = (await countQuery.count().get()).data().count;

    // Get paginated results
    const referralsSnapshot = await query
      .offset(offset)
      .limit(limit)
      .get();

    // Collect user IDs for batch lookup
    const userIds = new Set<string>();
    const programIds = new Set<string>();
    const squadIds = new Set<string>();

    referralsSnapshot.docs.forEach(doc => {
      const data = doc.data() as Referral;
      userIds.add(data.referrerId);
      userIds.add(data.referredUserId);
      if (data.programId) programIds.add(data.programId);
      if (data.squadId) squadIds.add(data.squadId);
    });

    // Fetch user details from Clerk
    const client = await clerkClient();
    const userList = await client.users.getUserList({
      userId: Array.from(userIds),
      limit: userIds.size,
    });
    const userMap = new Map(userList.data.map(u => [u.id, u]));

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
      const referrer = userMap.get(data.referrerId);
      const referredUser = userMap.get(data.referredUserId);

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        referrerName: referrer ? `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim() || referrer.emailAddresses[0]?.emailAddress : undefined,
        referrerEmail: referrer?.emailAddresses[0]?.emailAddress,
        referrerImageUrl: referrer?.imageUrl,
        referredUserName: referredUser ? `${referredUser.firstName || ''} ${referredUser.lastName || ''}`.trim() || referredUser.emailAddresses[0]?.emailAddress : undefined,
        referredUserEmail: referredUser?.emailAddresses[0]?.emailAddress,
        referredUserImageUrl: referredUser?.imageUrl,
        programName: data.programId ? programMap.get(data.programId) : undefined,
        squadName: data.squadId ? squadMap.get(data.squadId) : undefined,
      };
    });

    // Calculate stats
    const statsQuery = adminDb
      .collection('referrals')
      .where('organizationId', '==', organizationId);
    
    const [pendingCount, completedCount, rewardedCount] = await Promise.all([
      statsQuery.where('status', '==', 'pending').count().get(),
      statsQuery.where('status', '==', 'completed').count().get(),
      statsQuery.where('status', '==', 'rewarded').count().get(),
    ]);

    const stats = {
      total: totalCount,
      pending: pendingCount.data().count,
      completed: completedCount.data().count,
      rewarded: rewardedCount.data().count,
      conversionRate: totalCount > 0 
        ? Math.round(((completedCount.data().count + rewardedCount.data().count) / totalCount) * 100) 
        : 0,
    };

    return NextResponse.json({
      referrals,
      stats,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + referrals.length < totalCount,
      },
    });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    
    console.error('[COACH_REFERRALS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

