/**
 * API Route: Feature Vote
 * 
 * POST /api/features/[featureId]/vote - Toggle vote on a feature
 * 
 * Each coach gets one vote per feature. Calling again removes the vote.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { ClerkPublicMetadata, OrgRole, FeatureRequest, FeatureVote } from '@/types';

// =============================================================================
// POST - Toggle vote on feature
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check coach access
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole as OrgRole | undefined;
    
    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { featureId } = await params;

    if (!featureId) {
      return NextResponse.json({ error: 'Feature ID required' }, { status: 400 });
    }

    // Check feature exists
    const featureRef = adminDb.collection('feature_requests').doc(featureId);
    const featureDoc = await featureRef.get();

    if (!featureDoc.exists) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    const feature = { id: featureDoc.id, ...featureDoc.data() } as FeatureRequest;

    // Only allow voting on suggested features
    if (feature.status !== 'suggested') {
      return NextResponse.json(
        { error: 'Can only vote on suggested features' },
        { status: 400 }
      );
    }

    // Check for existing vote
    const voteId = `${featureId}_${userId}`;
    const voteRef = adminDb.collection('feature_votes').doc(voteId);
    const existingVoteDoc = await voteRef.get();

    const now = new Date().toISOString();
    let voted: boolean;
    let newVoteCount: number;

    if (existingVoteDoc.exists) {
      // Remove vote
      await voteRef.delete();
      await featureRef.update({
        voteCount: FieldValue.increment(-1),
        updatedAt: now,
      });
      voted = false;
      newVoteCount = Math.max(0, feature.voteCount - 1);
      console.log(`[FEATURE_VOTE] User ${userId} removed vote from feature ${featureId}`);
    } else {
      // Add vote
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const userName = user.firstName 
        ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
        : user.username || 'Unknown';

      const voteData: FeatureVote = {
        id: voteId,
        featureId,
        userId,
        userName,
        createdAt: now,
      };

      await voteRef.set(voteData);
      await featureRef.update({
        voteCount: FieldValue.increment(1),
        updatedAt: now,
      });
      voted = true;
      newVoteCount = feature.voteCount + 1;
      console.log(`[FEATURE_VOTE] User ${userId} voted for feature ${featureId}`);
    }

    return NextResponse.json({
      success: true,
      voted,
      voteCount: newVoteCount,
    });

  } catch (error) {
    console.error('[FEATURE_VOTE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update vote' },
      { status: 500 }
    );
  }
}








