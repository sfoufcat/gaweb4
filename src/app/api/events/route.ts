/**
 * API Route: Unified Events
 * 
 * GET /api/events - List events with filters
 * POST /api/events - Create a new event
 * 
 * Supports filtering by:
 * - scope (global, organization, program, squad, private)
 * - eventType (community_event, squad_call, coaching_1on1)
 * - squadId
 * - programId
 * - status
 * - upcoming (boolean - only future events)
 * 
 * Multi-tenancy: Automatically scopes to user's organization if applicable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { calculateProgramDayForDate } from '@/lib/calendar-weeks';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateDemoEvents } from '@/lib/demo-data';
import { createEventCore } from '@/lib/event-core';
import type { EventType, EventScope, EventStatus, ProgramInstance, UnifiedEvent } from '@/types';
import Stripe from 'stripe';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the start of the current week (Monday 00:00:00 UTC)
 */
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ============================================================================
// GET - List Events
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Demo mode: return demo events
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const events = generateDemoEvents();
      return demoResponse({ events });
    }
    
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse query params
    const scope = searchParams.get('scope') as EventScope | null;
    const eventType = searchParams.get('eventType') as EventType | null;
    const squadId = searchParams.get('squadId');
    const programId = searchParams.get('programId');
    const status = searchParams.get('status') as EventStatus | null;
    const upcoming = searchParams.get('upcoming') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const includeInstances = searchParams.get('includeInstances') !== 'false';

    // Get organization context
    const organizationId = await getEffectiveOrgId();

    // Build query - use simple queries to avoid composite index requirements
    // Filter primarily by squadId or programId if provided (most common use case)
    let query: FirebaseFirestore.Query = adminDb.collection('events');

    // For squad-specific queries (like NextSquadCallCard), use squadId as primary filter
    // This avoids needing complex composite indexes
    if (squadId) {
      query = query.where('squadId', '==', squadId);
    } else if (programId) {
      query = query.where('programId', '==', programId);
    } else if (organizationId) {
      // Only filter by org if no squad/program specified
      query = query.where('organizationId', '==', organizationId);
    }

    // Execute query (keep it simple - filter the rest in memory)
    const eventsSnapshot = await query.get();

    let events = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as UnifiedEvent[];

    // Apply remaining filters in memory to avoid composite index requirements
    
    // Filter by organization (if squadId/programId was used as primary filter)
    if (organizationId && (squadId || programId)) {
      events = events.filter(e => e.organizationId === organizationId);
    }
    
    // Filter by scope
    if (scope) {
      events = events.filter(e => e.scope === scope);
    }

    // Filter by eventType
    if (eventType) {
      events = events.filter(e => e.eventType === eventType);
    }

    // Filter by status
    if (status) {
      events = events.filter(e => e.status === status);
    } else {
      // Default: exclude canceled and draft events
      events = events.filter(e => ['confirmed', 'live', 'completed'].includes(e.status || ''));
    }

    // Filter for upcoming events
    if (upcoming) {
      const now = new Date().toISOString();
      events = events.filter(e => e.startDateTime && e.startDateTime >= now);
    }

    // Filter out recurring parents if we want to show instances instead
    if (includeInstances) {
      events = events.filter(e => !e.isRecurring);
    }

    // Sort by start time
    events.sort((a, b) => (a.startDateTime || '').localeCompare(b.startDateTime || ''));

    // Apply limit
    events = events.slice(0, limit);

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[EVENTS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', events: [] },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create Event
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['title', 'startDateTime', 'timezone', 'eventType', 'scope'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Get organization context
    const organizationId = await getEffectiveOrgId();

    // Get user info for host
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const hostName = userData 
      ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown'
      : 'Unknown';
    const hostAvatarUrl = userData?.profileImageUrl || userData?.imageUrl || undefined;

    // For 1:1 coaching calls, fetch client info from attendeeIds
    let clientUserId: string | undefined;
    let clientName: string | undefined;
    let clientAvatarUrl: string | undefined;

    const firstAttendeeId = body.attendeeIds?.[0];
    if (body.eventType === 'coaching_1on1' && firstAttendeeId) {
      // The client is the attendee (not the host/coach)
      clientUserId = firstAttendeeId;
      const clientDoc = await adminDb.collection('users').doc(firstAttendeeId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Client';
        clientAvatarUrl = clientData?.profileImageUrl || clientData?.imageUrl || undefined;
      }
    }

    // For cohort_call events, auto-populate attendeeIds from cohort enrollments
    let attendeeIds: string[] = body.attendeeIds || [];
    if (body.eventType === 'cohort_call' && body.cohortId && attendeeIds.length === 0) {
      try {
        // Find all active enrollments for this cohort
        const enrollmentsSnapshot = await adminDb
          .collection('enrollments')
          .where('cohortId', '==', body.cohortId)
          .where('status', 'in', ['active', 'in_progress'])
          .get();

        attendeeIds = enrollmentsSnapshot.docs
          .map(doc => doc.data().userId)
          .filter((id): id is string => !!id);

        console.log(`[EVENTS_POST] Auto-populated ${attendeeIds.length} attendees for cohort ${body.cohortId}`);
      } catch (err) {
        console.error('[EVENTS_POST] Error fetching cohort enrollments:', err);
        // Continue without attendees - they can still be notified via other means
      }
    }

    // Determine if user is a coach
    const role = (sessionClaims?.publicMetadata as { role?: string })?.role;
    const isCoachLed = role === 'coach' || role === 'super_admin' || role === 'admin';

    const now = new Date().toISOString();

    // ═══════════════════════════════════════════════════════════════════════════
    // PROGRAM CALL ALLOWANCE CHECK
    // For program calls, verify client hasn't exceeded their allowance
    // ═══════════════════════════════════════════════════════════════════════════
    if (body.isProgramCall && body.enrollmentId) {
      try {
        const enrollmentDoc = await adminDb
          .collection('program_enrollments')
          .doc(body.enrollmentId)
          .get();

        if (!enrollmentDoc.exists) {
          return NextResponse.json(
            { error: 'Enrollment not found', code: 'ENROLLMENT_NOT_FOUND' },
            { status: 404 }
          );
        }

        const enrollment = enrollmentDoc.data();
        const programDoc = await adminDb.collection('programs').doc(enrollment?.programId).get();

        if (programDoc.exists) {
          const program = programDoc.data();
          const monthlyAllowance = program?.callCreditsPerMonth || 0;
          const weeklyLimit = program?.maxCallsPerWeek;

          // Only enforce limits if program has allowance configured
          if (monthlyAllowance > 0) {
            const callUsage = enrollment?.callUsage || {};
            const nowDate = new Date();

            // Calculate rolling 30-day window usage
            let callsInWindow = callUsage.callsInWindow || 0;
            if (callUsage.windowStart) {
              const windowEnd = new Date(new Date(callUsage.windowStart).getTime() + 30 * 24 * 60 * 60 * 1000);
              if (nowDate > windowEnd) {
                // Window expired, reset
                callsInWindow = 0;
              }
            }

            const callsRemaining = monthlyAllowance - callsInWindow;

            // Check monthly limit
            if (callsRemaining <= 0 && !body.isExtraCall) {
              return NextResponse.json(
                {
                  error: 'Monthly call limit reached. Purchase an extra call to continue.',
                  code: 'MONTHLY_LIMIT_REACHED',
                  callsRemaining: 0,
                  monthlyAllowance,
                },
                { status: 400 }
              );
            }

            // Check weekly limit if configured
            if (weeklyLimit) {
              let callsThisWeek = callUsage.callsThisWeek || 0;
              if (callUsage.weekStart) {
                // Calculate current week start (Monday UTC)
                const currentWeekStart = getWeekStart(nowDate);
                if (new Date(callUsage.weekStart) < currentWeekStart) {
                  // New week, reset
                  callsThisWeek = 0;
                }
              }

              const weeklyRemaining = weeklyLimit - callsThisWeek;
              if (weeklyRemaining <= 0) {
                return NextResponse.json(
                  {
                    error: 'Weekly call limit reached. Try again next week.',
                    code: 'WEEKLY_LIMIT_REACHED',
                    weeklyRemaining: 0,
                    weeklyLimit,
                  },
                  { status: 400 }
                );
              }
            }
          }
        }
      } catch (limitError) {
        console.error('[EVENTS_POST] Error checking call limits:', limitError);
        // Don't fail the request on limit check error - log and continue
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXTRA CALL PAYMENT VERIFICATION (Client-Side Only)
    // If client selects extra call with a price, verify payment before creating
    // ═══════════════════════════════════════════════════════════════════════════
    if (body.isExtraCall && !isCoachLed && body.enrollmentId) {
      try {
        // Get program to check price
        const enrollmentDoc = await adminDb.collection('program_enrollments').doc(body.enrollmentId).get();
        if (enrollmentDoc.exists) {
          const enrollment = enrollmentDoc.data();
          const programDoc = await adminDb.collection('programs').doc(enrollment?.programId).get();

          if (programDoc.exists) {
            const program = programDoc.data();
            const pricePerExtraCallCents = program?.pricePerExtraCallCents || 0;

            // If extra calls have a price, require payment
            if (pricePerExtraCallCents > 0) {
              if (!body.paymentIntentId) {
                return NextResponse.json(
                  {
                    error: 'Payment required for extra call',
                    code: 'PAYMENT_REQUIRED',
                    pricePerExtraCallCents,
                  },
                  { status: 402 }
                );
              }

              // Verify payment with Stripe
              const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
              const paymentIntent = await stripe.paymentIntents.retrieve(body.paymentIntentId);

              if (paymentIntent.status !== 'succeeded') {
                return NextResponse.json(
                  {
                    error: 'Payment not completed',
                    code: 'PAYMENT_INCOMPLETE',
                    paymentStatus: paymentIntent.status,
                  },
                  { status: 402 }
                );
              }

              console.log(`[EVENTS_POST] Extra call payment verified: ${body.paymentIntentId}`);
            }
          }
        }
      } catch (paymentError) {
        console.error('[EVENTS_POST] Error verifying extra call payment:', paymentError);
        return NextResponse.json(
          { error: 'Failed to verify payment', code: 'PAYMENT_VERIFICATION_FAILED' },
          { status: 500 }
        );
      }
    }

    // Program instance linking - calculate week/day if instanceId is provided
    let instanceId: string | undefined = body.instanceId;
    let weekIndex: number | undefined;
    let dayIndex: number | undefined;
    let instanceData: ProgramInstance | null = null;

    if (instanceId && body.startDateTime) {
      try {
        // Fetch the program instance to get start date and program info
        const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();
        if (instanceDoc.exists) {
          instanceData = instanceDoc.data() as ProgramInstance;

          // We need program info to get totalDays and includeWeekends
          if (instanceData.programId) {
            const programDoc = await adminDb.collection('programs').doc(instanceData.programId).get();
            if (programDoc.exists) {
              const programData = programDoc.data();
              const totalDays = programData?.lengthDays || 30;
              const includeWeekends = programData?.includeWeekends !== false;
              const instanceStartDate = instanceData.startDate;

              if (instanceStartDate) {
                // Extract date part from startDateTime (it's in ISO format)
                const eventDate = body.startDateTime.split('T')[0];

                const dayInfo = calculateProgramDayForDate(
                  instanceStartDate,
                  eventDate,
                  totalDays,
                  includeWeekends
                );

                if (dayInfo) {
                  weekIndex = dayInfo.weekIndex;
                  dayIndex = dayInfo.globalDayIndex; // Use global day index (1-based across program)
                  console.log(`[EVENTS_POST] Calculated program position: week ${weekIndex}, day ${dayIndex}`);
                } else {
                  console.log(`[EVENTS_POST] Event date ${eventDate} is outside program range`);
                }
              }
            }
          }
        } else {
          console.log(`[EVENTS_POST] Instance ${instanceId} not found, skipping program linking`);
          instanceId = undefined;
        }
      } catch (err) {
        console.error('[EVENTS_POST] Error calculating program day:', err);
        // Don't fail the request, just skip program linking
        instanceId = undefined;
      }
    }

    // Use shared core function for event creation
    const { eventId, event: createdEvent } = await createEventCore({
      userId,
      organizationId: organizationId || body.organizationId,

      // Core fields
      title: body.title,
      startDateTime: body.startDateTime,
      endDateTime: body.endDateTime,
      timezone: body.timezone,
      durationMinutes: body.durationMinutes,
      eventType: body.eventType,
      scope: body.scope,

      // Location
      locationType: body.locationType,
      locationLabel: body.locationLabel,
      meetingLink: body.meetingLink,

      // Participation
      participantModel: body.participantModel,
      approvalType: body.approvalType,
      visibility: body.visibility,
      attendeeIds,
      maxAttendees: body.maxAttendees,

      // Voting
      requiredVotes: body.requiredVotes,
      totalEligibleVoters: body.totalEligibleVoters,

      // Scope references
      programId: body.programId || instanceData?.programId,
      programIds: body.programIds,
      squadId: body.squadId,
      cohortId: body.cohortId,

      // Program call tracking
      isProgramCall: body.isProgramCall,
      enrollmentId: body.enrollmentId,
      isExtraCall: body.isExtraCall,
      paymentIntentId: body.paymentIntentId,

      // Program instance linking
      instanceId,
      weekIndex,
      dayIndex,

      // Recurrence
      isRecurring: body.isRecurring,
      recurrence: body.recurrence,

      // Host info
      hostUserId: body.hostUserId,
      hostName: body.hostName || hostName,
      hostAvatarUrl: body.hostAvatarUrl || hostAvatarUrl,
      isCoachLed: body.isCoachLed ?? isCoachLed,

      // Client info
      clientUserId: body.clientUserId || clientUserId,
      clientName: body.clientName || clientName,
      clientAvatarUrl: body.clientAvatarUrl || clientAvatarUrl,

      // Content
      description: body.description,
      shortDescription: body.shortDescription,
      longDescription: body.longDescription,
      coverImageUrl: body.coverImageUrl,
      bulletPoints: body.bulletPoints,
      additionalInfo: body.additionalInfo,
      category: body.category,
      track: body.track,
      featured: body.featured,

      // Chat
      chatChannelId: body.chatChannelId,
      sendChatReminders: body.sendChatReminders,

      // Legacy date fields
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
    });

    console.log(`[EVENTS_POST] Created event ${eventId} (${body.eventType})`);

    return NextResponse.json({
      success: true,
      id: eventId,
      event: createdEvent,
    }, { status: 201 });
  } catch (error) {
    console.error('[EVENTS_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

