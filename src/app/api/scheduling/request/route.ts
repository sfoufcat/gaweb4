import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getTenantOrgId } from '@/lib/tenant/context';
import { notifyCallRequested } from '@/lib/scheduling-notifications';
import type { UnifiedEvent, ProposedTime, CoachCallSettings } from '@/types';

/**
 * POST /api/scheduling/request
 * Client requests a call with their coach
 * 
 * Body:
 * - proposedTimes: Array<{ startDateTime: string, endDateTime: string }> - Proposed time slots
 * - title?: string - Optional call title
 * - description?: string - What the client wants to discuss
 * - duration?: number - Preferred call duration in minutes
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const orgId = await getTenantOrgId();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      proposedTimes,
      title,
      description,
      duration = 60,
    } = body;

    // Validate proposed times
    if (!proposedTimes || !Array.isArray(proposedTimes) || proposedTimes.length === 0) {
      return NextResponse.json(
        { error: 'At least one proposed time is required' },
        { status: 400 }
      );
    }

    // Validate proposed times format
    for (const time of proposedTimes) {
      if (!time.startDateTime || !time.endDateTime) {
        return NextResponse.json(
          { error: 'Each proposed time must have startDateTime and endDateTime' },
          { status: 400 }
        );
      }
      const start = new Date(time.startDateTime);
      const end = new Date(time.endDateTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format for proposed times' },
          { status: 400 }
        );
      }
      if (start >= end) {
        return NextResponse.json(
          { error: 'Start time must be before end time' },
          { status: 400 }
        );
      }
    }

    // Check if client requests are allowed for this organization
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    const orgData = orgDoc.data();
    const callSettings = orgData?.callSettings as CoachCallSettings | undefined;

    if (callSettings && !callSettings.allowClientRequests) {
      return NextResponse.json(
        { error: 'Call requests are not enabled for this organization' },
        { status: 403 }
      );
    }

    // Get client info
    const clientDoc = await adminDb.collection('users').doc(userId).get();
    const clientData = clientDoc.data();
    const clientName = clientData?.firstName && clientData?.lastName
      ? `${clientData.firstName} ${clientData.lastName}`
      : clientData?.name || 'Client';
    const clientAvatarUrl = clientData?.imageUrl || clientData?.avatarUrl;

    let coachId: string | null = null;
    let coachName = 'Coach';
    let coachAvatarUrl: string | undefined;

    // Check Firestore org_memberships first (most reliable source for orgRole)
    const membershipSnapshot = await adminDb
      .collection('org_memberships')
      .where('organizationId', '==', orgId)
      .where('orgRole', 'in', ['super_coach', 'coach'])
      .limit(1)
      .get();

    if (!membershipSnapshot.empty) {
      coachId = membershipSnapshot.docs[0].data().userId;
    }

    // Fallback: Check Clerk org:admin role
    if (!coachId) {
      const client = await clerkClient();
      const memberships = await client.organizations.getOrganizationMembershipList({
        organizationId: orgId,
      });
      const adminMembership = memberships.data.find(m => m.role === 'org:admin');
      if (adminMembership?.publicUserData?.userId) {
        coachId = adminMembership.publicUserData.userId;
      }
    }

    // Final fallback: Check user publicMetadata for orgRole
    if (!coachId) {
      const client = await clerkClient();
      const memberships = await client.organizations.getOrganizationMembershipList({
        organizationId: orgId,
      });

      for (const membership of memberships.data) {
        if (membership.publicUserData?.userId) {
          const user = await client.users.getUser(membership.publicUserData.userId);
          const userMeta = user.publicMetadata as { orgRole?: string } | undefined;
          if (userMeta?.orgRole === 'super_coach' || userMeta?.orgRole === 'coach') {
            coachId = membership.publicUserData.userId;
            break;
          }
        }
      }
    }

    if (!coachId) {
      console.error('[SCHEDULING_REQUEST] No coach found for org:', orgId);
      return NextResponse.json(
        { error: 'No coach found for this organization' },
        { status: 404 }
      );
    }

    // Get coach info from users collection
    const coachDoc = await adminDb.collection('users').doc(coachId).get();
    if (coachDoc.exists) {
      const coachData = coachDoc.data();
      coachName = coachData?.firstName && coachData?.lastName
        ? `${coachData.firstName} ${coachData.lastName}`
        : coachData?.name || 'Coach';
      coachAvatarUrl = coachData?.imageUrl || coachData?.avatarUrl;
    }

    // Get coach availability for timezone
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(orgId)
      .get();
    const timezone = availabilityDoc.exists 
      ? (availabilityDoc.data()?.timezone || 'America/New_York')
      : 'America/New_York';

    const now = new Date().toISOString();

    // Create proposed time objects
    const formattedProposedTimes: ProposedTime[] = proposedTimes.map((time: { startDateTime: string; endDateTime: string }, index: number) => ({
      id: `proposed_${Date.now()}_${index}`,
      startDateTime: new Date(time.startDateTime).toISOString(),
      endDateTime: new Date(time.endDateTime).toISOString(),
      proposedBy: userId,
      proposedAt: now,
      status: 'pending' as const,
    }));

    // Use the first proposed time as the initial event time
    const firstProposed = formattedProposedTimes[0];

    // Check pricing
    const isPaid = callSettings?.pricingModel === 'per_call' || callSettings?.pricingModel === 'both';
    const priceInCents = isPaid ? callSettings?.pricePerCallCents : undefined;

    // Create the event
    const eventRef = adminDb.collection('events').doc();
    const eventData: UnifiedEvent = {
      id: eventRef.id,
      title: title || `Call request from ${clientName}`,
      description: description || `Call request from ${clientName}`,
      startDateTime: firstProposed.startDateTime,
      endDateTime: firstProposed.endDateTime,
      timezone,
      durationMinutes: duration,
      locationType: 'online',
      locationLabel: 'Video Call',
      eventType: 'coaching_1on1',
      scope: 'private',
      participantModel: 'invite_only',
      approvalType: 'none',
      status: 'pending_approval', // Needs coach acceptance
      organizationId: orgId,
      isRecurring: false,
      createdByUserId: userId,
      hostUserId: coachId,
      hostName: coachName,
      hostAvatarUrl: coachAvatarUrl,
      isCoachLed: false, // Client-initiated
      attendeeIds: [coachId, userId],
      sendChatReminders: true,
      // Scheduling-specific fields
      schedulingStatus: 'proposed',
      proposedBy: userId,
      proposedTimes: formattedProposedTimes,
      schedulingNotes: description,
      // Pricing fields
      isPaid,
      priceInCents,
      createdAt: now,
      updatedAt: now,
    };

    await eventRef.set(eventData);

    // Send notification to coach about call request
    try {
      await notifyCallRequested(eventData, coachId);
    } catch (notifyErr) {
      console.error('[SCHEDULING_REQUEST] Failed to send notification:', notifyErr);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      event: eventData,
      success: true,
      message: 'Call request sent to coach',
      isPaid,
      priceInCents,
    });
  } catch (error) {
    console.error('[SCHEDULING_REQUEST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

