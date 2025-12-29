import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createOrganizationForCoach, ClerkPublicMetadataWithOrg } from '@/lib/clerk-organizations';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/coach/create-organization
 * 
 * Creates a new Clerk Organization for a user becoming a coach.
 * This is called during the coach self-signup flow.
 * 
 * Steps:
 * 1. Verify user is authenticated
 * 2. Check if user already has an organization
 * 3. Create new organization with defaults
 * 4. Set user's role to 'coach' and orgRole to 'super_coach'
 * 5. Initialize onboarding state to 'needs_profile'
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
    
    // Check if user already has an organization
    if (metadata?.organizationId) {
      return NextResponse.json(
        { 
          error: 'Organization already exists',
          organizationId: metadata.organizationId,
        },
        { status: 409 }
      );
    }
    
    // Get name for organization
    const coachName = user.firstName 
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'Coach';
    
    // Create the organization (this also sets up subdomain, default channels, etc.)
    const organizationId = await createOrganizationForCoach(userId, coachName);
    
    // Update user's role to 'coach' if not already
    if (metadata?.role !== 'coach') {
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...metadata,
          role: 'coach',
          organizationId,
          orgRole: 'super_coach',
        },
      });
    }
    
    // Initialize onboarding state
    const now = new Date().toISOString();
    await adminDb.collection('coach_onboarding').doc(organizationId).set({
      organizationId,
      userId,
      status: 'needs_profile', // First step after org creation
      createdAt: now,
      updatedAt: now,
    });
    
    console.log(`[API_CREATE_ORG] Created organization ${organizationId} for user ${userId}`);
    
    return NextResponse.json({
      success: true,
      organizationId,
      onboardingStatus: 'needs_profile',
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

