/**
 * API Route: Feature Requests
 * 
 * GET /api/features - Get all feature requests (for voting board)
 * POST /api/features - Submit a new feature suggestion
 * 
 * This is a global feature board - all coaches can see and vote.
 * Only coaches/admins can access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { ClerkPublicMetadata, OrgRole, FeatureRequest, FeatureVote } from '@/types';

// =============================================================================
// GET - List all feature requests
// =============================================================================

export async function GET() {
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

    // Fetch all feature requests
    const featuresSnapshot = await adminDb
      .collection('feature_requests')
      .orderBy('createdAt', 'desc')
      .get();

    const features: FeatureRequest[] = [];
    featuresSnapshot.forEach((doc) => {
      features.push({ id: doc.id, ...doc.data() } as FeatureRequest);
    });

    // Fetch user's votes to show which they've voted on
    const userVotesSnapshot = await adminDb
      .collection('feature_votes')
      .where('userId', '==', userId)
      .get();

    const userVotedFeatureIds: string[] = [];
    userVotesSnapshot.forEach((doc) => {
      const vote = doc.data() as FeatureVote;
      userVotedFeatureIds.push(vote.featureId);
    });

    // Separate by status and sort appropriately
    const inProgress = features
      .filter(f => f.status === 'in_progress')
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));
    
    const suggested = features
      .filter(f => f.status === 'suggested')
      .sort((a, b) => b.voteCount - a.voteCount); // Sort by votes descending
    
    const completed = features
      .filter(f => f.status === 'completed')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({
      inProgress,
      suggested,
      completed,
      userVotedFeatureIds,
      totalCount: features.length,
    });

  } catch (error) {
    console.error('[FEATURES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch features' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Submit new feature suggestion
// =============================================================================

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { title, description } = body;

    // Validate input
    if (!title || title.trim().length < 5) {
      return NextResponse.json(
        { error: 'Title must be at least 5 characters' },
        { status: 400 }
      );
    }

    if (!description || description.trim().length < 20) {
      return NextResponse.json(
        { error: 'Description must be at least 20 characters' },
        { status: 400 }
      );
    }

    if (title.trim().length > 100) {
      return NextResponse.json(
        { error: 'Title must be less than 100 characters' },
        { status: 400 }
      );
    }

    if (description.trim().length > 1000) {
      return NextResponse.json(
        { error: 'Description must be less than 1000 characters' },
        { status: 400 }
      );
    }

    // Get user info
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const userName = user.firstName 
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : user.username || 'Unknown';
    const userEmail = user.primaryEmailAddress?.emailAddress;

    const now = new Date().toISOString();

    // Create feature request
    const featureData: Omit<FeatureRequest, 'id'> = {
      title: title.trim(),
      description: description.trim(),
      status: 'suggested',
      voteCount: 1, // Auto-vote for own suggestion
      suggestedBy: userId,
      suggestedByName: userName,
      suggestedByEmail: userEmail,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('feature_requests').add(featureData);
    const featureId = docRef.id;

    // Auto-vote for own suggestion
    const voteId = `${featureId}_${userId}`;
    const voteData: FeatureVote = {
      id: voteId,
      featureId,
      userId,
      userName,
      createdAt: now,
    };
    await adminDb.collection('feature_votes').doc(voteId).set(voteData);

    console.log(`[FEATURES_POST] User ${userId} created feature request ${featureId}: "${title}"`);

    return NextResponse.json({
      success: true,
      feature: { id: featureId, ...featureData },
      message: 'Feature suggestion submitted successfully!',
    });

  } catch (error) {
    console.error('[FEATURES_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feature suggestion' },
      { status: 500 }
    );
  }
}








