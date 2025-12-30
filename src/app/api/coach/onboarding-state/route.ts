import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { ClerkPublicMetadataWithOrg } from '@/lib/clerk-organizations';
import type { CoachOnboardingState } from '@/types';

/**
 * GET /api/coach/onboarding-state
 * 
 * Returns the current onboarding state for a coach.
 * Used to determine which onboarding step to show.
 * 
 * States:
 * - needs_profile: Coach needs to complete their profile
 * - needs_plan: Coach needs to select a subscription plan
 * - active: Coach has completed onboarding
 */
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.publicMetadata as ClerkPublicMetadataWithOrg;
    
    // Check if user has an organization
    if (!metadata?.organizationId) {
      // Not a coach yet
      return NextResponse.json({ 
        state: null,
        isCoach: false,
      });
    }
    
    const organizationId = metadata.organizationId;
    
    // Get onboarding state from Firestore
    const onboardingDoc = await adminDb.collection('coach_onboarding').doc(organizationId).get();
    
    if (!onboardingDoc.exists) {
      // No onboarding document means this is an existing coach who was set up
      // before the self-signup flow was implemented. Grandfather them as "active".
      // The coach_onboarding document is only created for NEW coaches who go
      // through the self-signup flow via /api/coach/create-organization.
      return NextResponse.json({
        state: 'active' as CoachOnboardingState,
        isCoach: true,
        organizationId,
      });
    }
    
    const data = onboardingDoc.data();
    
    return NextResponse.json({
      state: data?.status as CoachOnboardingState,
      isCoach: true,
      organizationId,
      profileCompletedAt: data?.profileCompletedAt || null,
      planSelectedAt: data?.planSelectedAt || null,
    });
    
  } catch (error) {
    console.error('[API_ONBOARDING_STATE_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/coach/onboarding-state
 * 
 * Updates the onboarding state for a coach.
 * Used when completing onboarding steps.
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { status, force } = body;
    
    if (!status || !['needs_profile', 'needs_plan', 'active'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }
    
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.publicMetadata as ClerkPublicMetadataWithOrg;
    
    if (!metadata?.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }
    
    const organizationId = metadata.organizationId;
    const now = new Date().toISOString();
    
    // Check if doc exists (for force-create scenario)
    const existingDoc = await adminDb.collection('coach_onboarding').doc(organizationId).get();
    const isNewDoc = !existingDoc.exists;
    
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now,
    };
    
    // Add createdAt for new documents
    if (isNewDoc || force) {
      updateData.createdAt = now;
    }
    
    // Add completion timestamps based on status transitions
    if (status === 'needs_plan') {
      updateData.profileCompletedAt = now;
    } else if (status === 'active') {
      updateData.planSelectedAt = now;
    }
    
    // Update or create the onboarding document
    await adminDb.collection('coach_onboarding').doc(organizationId).set(
      updateData,
      { merge: true }
    );
    
    console.log(`[API_ONBOARDING_STATE_PATCH] Updated ${organizationId} to status: ${status}`);
    
    return NextResponse.json({
      success: true,
      state: status,
    });
    
  } catch (error) {
    console.error('[API_ONBOARDING_STATE_PATCH_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

