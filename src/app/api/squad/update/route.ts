import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { ClerkPublicMetadata } from '@/types';

/**
 * PATCH /api/squad/update
 * Update squad name and/or avatar.
 * 
 * Authorization:
 * - Squad members can update their own squad
 * - Coaches can update squads in their organization OR where they are the assigned coach
 * - Admins/Super Admins can update any squad
 * 
 * Body:
 * - squadId?: string (optional - if not provided, uses user's current squad)
 * - name?: string
 * - avatarUrl?: string
 */
export async function PATCH(req: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { squadId: requestedSquadId, name, avatarUrl } = body as {
      squadId?: string;
      name?: string;
      avatarUrl?: string;
    };

    // Get role, orgRole, and organizationId from session claims
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;
    const userOrgId = publicMetadata?.organizationId;

    // Determine squad ID - use requested or fall back to user's current squad
    let squadId = requestedSquadId;
    
    if (!squadId) {
      // Fall back to user's current squad from their user document
      const userDoc = await adminDb.collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      squadId = userData?.squadId;
    }

    if (!squadId) {
      return NextResponse.json({ error: 'No squad specified' }, { status: 400 });
    }

    // Get squad
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();

    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squadData = squadDoc.data();
    const squadOrgId = squadData?.organizationId || null;
    const squadCoachId = squadData?.coachId || null;

    // Authorization check
    let isAuthorized = false;

    // Check if user is a member of this squad
    const membershipSnapshot = await adminDb.collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!membershipSnapshot.empty) {
      // User is a squad member - authorized
      isAuthorized = true;
    }

    // Check coach/admin access if not already authorized
    if (!isAuthorized && canAccessCoachDashboard(role, orgRole)) {
      // Admin/Super Admin can access any squad
      if (role === 'admin' || role === 'super_admin') {
        isAuthorized = true;
      }
      // Coach can access if:
      // - Squad is in their organization (multi-tenancy)
      // - They are the assigned coach of this squad
      else if (role === 'coach' || orgRole === 'super_coach' || orgRole === 'coach') {
        const isInOrg = userOrgId && squadOrgId && userOrgId === squadOrgId;
        const isCoach = squadCoachId === userId;
        if (isInOrg || isCoach) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'You do not have permission to update this squad' }, { status: 403 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined && name.trim()) {
      updateData.name = name.trim();
    }

    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl;
    }

    // Update squad
    await squadRef.update(updateData);

    // Sync changes with Stream Chat channel
    if (squadData?.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        const channel = streamClient.channel('messaging', squadData.chatChannelId);
        const channelUpdate: Record<string, unknown> = {};
        if (name !== undefined && name.trim()) {
          channelUpdate.name = name.trim();
        }
        if (avatarUrl !== undefined) {
          channelUpdate.image = avatarUrl || undefined;
        }
        if (Object.keys(channelUpdate).length > 0) {
          await channel.update(channelUpdate);
        }
      } catch (streamError) {
        console.error('[STREAM_UPDATE_CHANNEL_ERROR]', streamError);
        // Don't fail the update if Stream fails
      }
    }

    return NextResponse.json({ 
      success: true,
      squad: {
        id: squadId,
        name: updateData.name || squadData?.name,
        avatarUrl: updateData.avatarUrl ?? squadData?.avatarUrl,
      },
    });
  } catch (error) {
    console.error('[SQUAD_UPDATE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}







