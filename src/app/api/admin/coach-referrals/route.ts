/**
 * Admin Coach Referrals API
 * 
 * GET: List all coach referrals with stats
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isSuperAdmin } from '@/lib/admin-utils-shared';
import { adminDb } from '@/lib/firebase-admin';
import type { CoachReferral, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/admin/coach-referrals
 * List all coach referrals with stats
 */
export async function GET(request: Request) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!isSuperAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending', 'signed_up', 'subscribed', 'rewarded', or null for all
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = adminDb.collection('coach_referrals').orderBy('createdAt', 'desc');
    
    // Apply status filter
    if (status) {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.get();
    
    let referrals: CoachReferral[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as CoachReferral));
    
    // Get total before pagination
    const total = referrals.length;
    
    // Apply pagination
    referrals = referrals.slice(offset, offset + limit);
    
    // Calculate stats from all referrals (not just filtered)
    const allReferralsSnapshot = await adminDb.collection('coach_referrals').get();
    const allReferrals = allReferralsSnapshot.docs.map(doc => doc.data());
    
    const stats = {
      total: allReferrals.length,
      pending: allReferrals.filter(r => r.status === 'pending').length,
      signedUp: allReferrals.filter(r => r.status === 'signed_up').length,
      subscribed: allReferrals.filter(r => r.status === 'subscribed').length,
      rewarded: allReferrals.filter(r => r.status === 'rewarded').length,
      totalRewardsGiven: allReferrals.filter(r => r.referrerRewarded || r.refereeRewarded).length,
    };
    
    return NextResponse.json({
      referrals,
      stats,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + referrals.length < total,
      },
    });
    
  } catch (error) {
    console.error('[ADMIN_COACH_REFERRALS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coach referrals' },
      { status: 500 }
    );
  }
}

