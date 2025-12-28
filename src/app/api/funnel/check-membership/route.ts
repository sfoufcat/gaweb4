import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

/**
 * GET /api/funnel/check-membership
 * Check if the authenticated user is a member of the target organization
 * 
 * Query params:
 * - orgId: string (required) - The organization ID to check membership for
 * 
 * Returns:
 * - isMember: boolean - User is already a member of this organization
 * - inDifferentOrg: boolean - User is signed in but belongs to a different organization
 * - userInfo: { firstName, lastName, email, imageUrl } - User's info for display
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    // Not signed in = new user
    if (!userId) {
      return NextResponse.json({
        isMember: false,
        inDifferentOrg: false,
        userInfo: null,
      });
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Get user's organization memberships from Clerk
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    
    // Get user's organization memberships
    const memberships = await client.users.getOrganizationMembershipList({
      userId,
    });

    // Check if user is a member of the target organization
    const isMember = memberships.data.some(
      (membership) => membership.organization.id === orgId
    );

    // Check if user is in a different organization (signed in but not in this org)
    const inDifferentOrg = !isMember && memberships.data.length > 0;

    // Get user info for display
    const userInfo = {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.emailAddresses[0]?.emailAddress || '',
      imageUrl: user.imageUrl || '',
    };

    return NextResponse.json({
      isMember,
      inDifferentOrg,
      userInfo,
    });
  } catch (error) {
    console.error('[CHECK_MEMBERSHIP]', error);
    return NextResponse.json(
      { error: 'Failed to check membership' },
      { status: 500 }
    );
  }
}







