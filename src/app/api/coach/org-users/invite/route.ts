import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { addUserToOrganization } from '@/lib/clerk-organizations';

/**
 * POST /api/coach/org-users/invite
 * 
 * Add a user to the coach's organization.
 * This makes them an actual Clerk Organization member.
 * 
 * Body:
 * - userId: string (required) - The Clerk user ID to add
 * - email: string (optional) - Alternative: invite by email (creates invitation)
 * - role: 'org:member' | 'org:admin' (optional, default: 'org:member')
 */
export async function POST(req: Request) {
  try {
    // Check authorization and get organizationId
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { userId, email, role = 'org:member' } = body as {
      userId?: string;
      email?: string;
      role?: 'org:member' | 'org:admin';
    };

    // Validate role
    if (role !== 'org:member' && role !== 'org:admin') {
      return NextResponse.json(
        { error: 'Invalid role. Must be org:member or org:admin' },
        { status: 400 }
      );
    }

    const client = await clerkClient();

    // Method 1: Add existing user by userId
    if (userId) {
      // Verify user exists
      try {
        await client.users.getUser(userId);
      } catch {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Add to organization
      await addUserToOrganization(userId, organizationId, role);

      return NextResponse.json({
        success: true,
        message: `User ${userId} added to organization`,
        userId,
        organizationId,
        role,
      });
    }

    // Method 2: Invite by email (creates pending invitation)
    if (email) {
      // Check if user with this email already exists
      const existingUsers = await client.users.getUserList({
        emailAddress: [email],
      });

      if (existingUsers.data.length > 0) {
        // User exists - add them directly
        const existingUser = existingUsers.data[0];
        await addUserToOrganization(existingUser.id, organizationId, role);

        return NextResponse.json({
          success: true,
          message: `Existing user ${email} added to organization`,
          userId: existingUser.id,
          organizationId,
          role,
        });
      }

      // User doesn't exist - create an invitation
      // Note: This requires the user to sign up to accept
      const invitation = await client.organizations.createOrganizationInvitation({
        organizationId,
        emailAddress: email,
        role,
        inviterUserId: (await requireCoachWithOrg()).userId,
      });

      return NextResponse.json({
        success: true,
        message: `Invitation sent to ${email}`,
        invitationId: invitation.id,
        email,
        organizationId,
        role,
        status: 'pending',
      });
    }

    // Neither userId nor email provided
    return NextResponse.json(
      { error: 'Either userId or email is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[COACH_ORG_USERS_INVITE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json(
        { error: 'Forbidden: Coach access required' },
        { status: 403 }
      );
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/org-users/invite
 * 
 * Remove a user from the coach's organization.
 * 
 * Query params:
 * - userId: string (required) - The Clerk user ID to remove
 */
export async function DELETE(req: Request) {
  try {
    // Check authorization and get organizationId
    const { organizationId, userId: coachUserId } = await requireCoachWithOrg();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    // Cannot remove yourself
    if (userId === coachUserId) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from the organization' },
        { status: 400 }
      );
    }

    const client = await clerkClient();

    // Check if user is a member
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
    });
    const membership = memberships.data.find(
      (m) => m.publicUserData?.userId === userId
    );

    if (!membership) {
      return NextResponse.json(
        { error: 'User is not a member of this organization' },
        { status: 404 }
      );
    }

    // Remove from organization
    await client.organizations.deleteOrganizationMembership({
      organizationId,
      userId,
    });

    // Clear organizationId from user's publicMetadata
    const user = await client.users.getUser(userId);
    const metadata = user.publicMetadata as { organizationId?: string };
    if (metadata?.organizationId === organizationId) {
      const { organizationId: _, ...restMetadata } = metadata;
      await client.users.updateUserMetadata(userId, {
        publicMetadata: restMetadata,
      });
    }

    return NextResponse.json({
      success: true,
      message: `User ${userId} removed from organization`,
      userId,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_USERS_REMOVE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json(
        { error: 'Forbidden: Coach access required' },
        { status: 403 }
      );
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}



