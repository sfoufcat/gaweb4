/**
 * Coach Org Users Bulk Update API
 * 
 * PATCH /api/coach/org-users/bulk - Bulk update multiple members' tier/track/squad
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { UserTier, UserTrack } from '@/types';

/**
 * PATCH /api/coach/org-users/bulk
 * Bulk update multiple members' tier, track, or squad
 * 
 * Body:
 * - userIds: string[] (required) - Array of user IDs to update
 * - tier?: 'free' | 'standard' | 'premium' (optional)
 * - track?: UserTrack | null (optional)
 * - squadId?: string | null (optional)
 * - premiumSquadId?: string | null (optional)
 */
export async function PATCH(request: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    
    const body = await request.json();
    const { userIds, tier, track, squadId, premiumSquadId } = body;
    
    // Validate userIds
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds array is required' }, { status: 400 });
    }
    
    if (userIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 users can be updated at once' }, { status: 400 });
    }
    
    // Validate tier if provided
    if (tier !== undefined) {
      const validTiers: UserTier[] = ['free', 'standard', 'premium'];
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
      }
    }
    
    // Build update object for org_memberships
    const now = new Date().toISOString();
    const membershipUpdates: Record<string, unknown> = {
      updatedAt: now,
    };
    
    if (tier !== undefined) membershipUpdates.tier = tier;
    if (track !== undefined) membershipUpdates.track = track as UserTrack | null;
    if (squadId !== undefined) membershipUpdates.squadId = squadId;
    if (premiumSquadId !== undefined) membershipUpdates.premiumSquadId = premiumSquadId;
    
    // Build update object for Firebase users
    const userUpdates: Record<string, unknown> = { updatedAt: now };
    if (tier !== undefined) userUpdates.tier = tier;
    if (track !== undefined) userUpdates.track = track;
    if (squadId !== undefined) userUpdates.standardSquadId = squadId;
    if (premiumSquadId !== undefined) userUpdates.premiumSquadId = premiumSquadId;
    
    // Track results
    const results = {
      success: [] as string[],
      failed: [] as { userId: string; error: string }[],
    };
    
    // Process in batches of 10 (Firestore 'in' query limit)
    for (let i = 0; i < userIds.length; i += 10) {
      const chunk = userIds.slice(i, i + 10);
      
      // Find memberships for this chunk
      const membershipQuery = await adminDb
        .collection('org_memberships')
        .where('userId', 'in', chunk)
        .where('organizationId', '==', organizationId)
        .get();
      
      // Create a map of userId -> membership doc
      const membershipMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
      membershipQuery.forEach((doc) => {
        const data = doc.data();
        membershipMap.set(data.userId, doc);
      });
      
      // Update each user
      for (const userId of chunk) {
        try {
          const membershipDoc = membershipMap.get(userId);
          
          if (!membershipDoc) {
            results.failed.push({ userId, error: 'Not a member of this organization' });
            continue;
          }
          
          // Update org_membership
          await membershipDoc.ref.update(membershipUpdates);
          
          // Update Firebase user document
          if (Object.keys(userUpdates).length > 1) {
            try {
              await adminDb.collection('users').doc(userId).update(userUpdates);
            } catch (err) {
              // User doc might not exist - that's okay
              console.warn(`[BULK_UPDATE] Could not update user doc for ${userId}:`, err);
            }
          }
          
          results.success.push(userId);
        } catch (err) {
          console.error(`[BULK_UPDATE] Error updating user ${userId}:`, err);
          results.failed.push({
            userId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }
    
    console.log(`[COACH_ORG_USERS_BULK] Updated ${results.success.length}/${userIds.length} users in org ${organizationId}`);
    
    return NextResponse.json({
      success: true,
      updated: results.success.length,
      failed: results.failed.length,
      results,
    });
  } catch (error) {
    console.error('[COACH_ORG_USERS_BULK_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}


