import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createOrganizationForCoach, ClerkPublicMetadataWithOrg } from '@/lib/clerk-organizations';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/coach/create-organization
 * 
 * Creates a new Clerk Organization for a coach.
 * Supports multi-org: coaches can create multiple organizations.
 * 
 * Steps:
 * 1. Verify user is authenticated
 * 2. Create new organization with defaults (supports multiple orgs per coach)
 * 3. Set user's role to 'coach' and orgRole to 'super_coach'
 * 4. Initialize onboarding state to 'needs_profile'
 */
export async function POST(req: Request) {
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
    
    // Check if this is their first organization (for logging)
    const isFirstOrg = !metadata?.organizationId;
    console.log(`[API_CREATE_ORG] Creating ${isFirstOrg ? 'first' : 'additional'} organization for user ${userId}`);
    
    // Get name for organization
    const coachName = user.firstName 
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'Coach';
    
    // Create the organization (this also sets up subdomain, default channels, etc.)
    // createOrganizationForCoach handles multi-org: sets primaryOrganizationId to new org
    const organizationId = await createOrganizationForCoach(userId, coachName);
    
    // Update user's role to 'coach' if not already (for first-time coaches)
    // Note: createOrganizationForCoach already updates primaryOrganizationId and orgRole
    if (metadata?.role !== 'coach') {
      // Refetch user to get updated metadata from createOrganizationForCoach
      const updatedUser = await client.users.getUser(userId);
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...updatedUser.publicMetadata,
          role: 'coach',
        },
      });
    }
    
    // Initialize onboarding state for the new organization
    const now = new Date().toISOString();
    await adminDb.collection('coach_onboarding').doc(organizationId).set({
      organizationId,
      userId,
      status: 'needs_profile', // First step after org creation
      createdAt: now,
      updatedAt: now,
    });
    
    console.log(`[API_CREATE_ORG] Created organization ${organizationId} for user ${userId} (isFirstOrg: ${isFirstOrg})`);
    
    return NextResponse.json({
      success: true,
      organizationId,
      onboardingStatus: 'needs_profile',
      isFirstOrg,
    });
    
  } catch (error: any) {
    console.error('[API_CREATE_ORG_ERROR]', error);
    
    // Handle specific Clerk errors
    if (error.errors) {
      const clerkError = error.errors[0];
      return NextResponse.json(
        { 
          error: clerkError.message || 'Failed to create organization',
          code: clerkError.code,
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

