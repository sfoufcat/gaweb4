/**
 * Core Event Creation Logic
 *
 * Shared module for creating events, used by:
 * - /api/events (unified events API)
 * - /api/coach/org-discover/events (coach dashboard Discover events)
 *
 * Handles:
 * - Building event data with defaults
 * - Writing to Firestore
 * - Scheduling notification jobs
 * - Generating recurring instances
 * - Creating voting records
 * - Linking to program instances
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { scheduleEventJobs } from './event-notifications';
import { generateRecurringInstances } from './event-recurrence';
import type {
  UnifiedEvent,
  EventType,
  EventScope,
  EventStatus,
  EventVisibility,
  RecurrencePattern,
  ProgramInstance,
  OrderBumpConfig,
  UserTrack,
  ContentFeature,
  ContentTestimonial,
  ContentFaq,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface CreateEventCoreParams {
  // Auth context
  userId: string;
  organizationId?: string;

  // Core event fields (required)
  title: string;
  startDateTime: string;
  timezone: string;
  eventType: EventType;
  scope: EventScope;

  // Optional timing
  endDateTime?: string;
  durationMinutes?: number;

  // Optional location
  locationType?: 'online' | 'in_person' | 'chat';
  locationLabel?: string;
  meetingLink?: string;

  // Participation
  participantModel?: 'rsvp' | 'invite_only' | 'squad_members' | 'program_enrollees';
  approvalType?: 'none' | 'voting';
  visibility?: EventVisibility;
  attendeeIds?: string[];
  maxAttendees?: number;

  // Voting config (when approvalType === 'voting')
  requiredVotes?: number;
  totalEligibleVoters?: number;

  // Scope references
  programId?: string;
  programIds?: string[];
  squadId?: string;
  cohortId?: string;

  // Program call tracking
  isProgramCall?: boolean;
  enrollmentId?: string;
  isExtraCall?: boolean;
  paymentIntentId?: string;

  // Program instance linking
  instanceId?: string;
  weekIndex?: number;
  dayIndex?: number;

  // Recurrence
  isRecurring?: boolean;
  recurrence?: RecurrencePattern;

  // Host info
  hostUserId?: string;
  hostName?: string;
  hostAvatarUrl?: string;
  isCoachLed?: boolean;

  // Client info (for 1:1 calls)
  clientUserId?: string;
  clientName?: string;
  clientAvatarUrl?: string;

  // Content
  description?: string;
  shortDescription?: string;
  longDescription?: string;
  coverImageUrl?: string;
  bulletPoints?: string[];
  additionalInfo?: Record<string, unknown>;
  category?: string;
  track?: string;
  featured?: boolean;

  // Chat integration
  chatChannelId?: string;
  sendChatReminders?: boolean;

  // Legacy date fields (auto-derived if not provided)
  date?: string;
  startTime?: string;
  endTime?: string;

  // Marketing/Discover fields
  priceInCents?: number;
  currency?: string;
  purchaseType?: 'popup' | 'landing_page';
  isPublic?: boolean;
  keyOutcomes?: string[];
  features?: ContentFeature[];
  testimonials?: ContentTestimonial[];
  faqs?: ContentFaq[];
  orderBumps?: OrderBumpConfig;

  // Meeting provider tracking
  meetingProvider?: string;
  externalMeetingId?: string;
  recordingUrl?: string;

  // AI Summary & Auto-fill
  autoGenerateSummary?: boolean;
  autoFillWeek?: boolean;
  autoFillTarget?: 'current' | 'next' | 'until_call';
}

export interface CreateEventCoreResult {
  eventId: string;
  event: UnifiedEvent;
}

// ============================================================================
// Core Function
// ============================================================================

/**
 * Create an event with all standard post-creation logic:
 * - Firestore write
 * - Notification scheduling
 * - Recurrence generation
 * - Voting setup
 * - Program instance linking
 */
export async function createEventCore(params: CreateEventCoreParams): Promise<CreateEventCoreResult> {
  const now = new Date().toISOString();

  // Auto-populate programIds from programId
  let programIds: string[] = params.programIds || [];
  if (params.programId && (!programIds.length || !programIds.includes(params.programId))) {
    programIds = [params.programId, ...programIds];
  }

  // Auto-derive legacy date fields from startDateTime for backward compatibility
  let legacyDate = params.date;
  let legacyStartTime = params.startTime;
  let legacyEndTime = params.endTime;

  if (!legacyDate && params.startDateTime) {
    const startDt = new Date(params.startDateTime);
    legacyDate = startDt.toISOString().split('T')[0]; // YYYY-MM-DD
    legacyStartTime = legacyStartTime || startDt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    if (params.endDateTime) {
      const endDt = new Date(params.endDateTime);
      legacyEndTime = legacyEndTime || endDt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } else if (params.durationMinutes) {
      const endDt = new Date(startDt.getTime() + (params.durationMinutes || 60) * 60 * 1000);
      legacyEndTime = legacyEndTime || endDt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
  }

  // Determine status
  const status: EventStatus = params.approvalType === 'voting' ? 'pending_approval' : 'confirmed';

  // Build event data - using Record for flexibility, cast to UnifiedEvent at end
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventData: Record<string, any> = {
    // Core fields
    title: params.title,
    description: params.description || '',
    startDateTime: params.startDateTime,
    endDateTime: params.endDateTime || undefined,
    timezone: params.timezone,
    durationMinutes: params.durationMinutes || 60,

    // Location
    locationType: params.locationType || 'online',
    locationLabel: params.locationLabel || 'Online',
    meetingLink: params.meetingLink || undefined,

    // Type & scope
    eventType: params.eventType,
    scope: params.scope,
    participantModel: params.participantModel || 'rsvp',
    approvalType: params.approvalType || 'none',
    status,

    visibility: params.visibility || 'squad_only',

    // Organization & program
    organizationId: params.organizationId || undefined,
    programId: params.programId || undefined,
    programIds,
    squadId: params.squadId || undefined,
    cohortId: params.cohortId || undefined,

    // Program instance linking
    instanceId: params.instanceId || undefined,
    weekIndex: params.weekIndex,
    dayIndex: params.dayIndex,

    // Program call tracking
    isProgramCall: params.isProgramCall || false,
    enrollmentId: params.enrollmentId || undefined,
    isExtraCall: params.isExtraCall || false,
    callUsageDeducted: false,
    paymentIntentId: params.paymentIntentId || undefined,

    // Recurrence
    isRecurring: params.isRecurring || false,
    recurrence: params.recurrence || undefined,
    parentEventId: undefined,
    instanceDate: undefined,

    // Host
    createdByUserId: params.userId,
    hostUserId: params.hostUserId || params.userId,
    hostName: params.hostName || undefined,
    hostAvatarUrl: params.hostAvatarUrl || undefined,
    isCoachLed: params.isCoachLed ?? false,

    // Client (for 1:1 calls)
    clientUserId: params.clientUserId || undefined,
    clientName: params.clientName || undefined,
    clientAvatarUrl: params.clientAvatarUrl || undefined,

    // Attendance
    attendeeIds: params.attendeeIds || [],
    maxAttendees: params.maxAttendees || undefined,

    // Voting
    votingConfig: params.approvalType === 'voting' ? {
      yesCount: 1,
      noCount: 0,
      requiredVotes: params.requiredVotes || 1,
      totalEligibleVoters: params.totalEligibleVoters || 1,
    } : undefined,
    confirmedAt: params.approvalType === 'voting' ? undefined : now,

    // Content
    coverImageUrl: params.coverImageUrl || undefined,
    bulletPoints: params.bulletPoints || [],
    additionalInfo: params.additionalInfo || undefined,

    recordingUrl: params.recordingUrl || undefined,

    // Chat
    chatChannelId: params.chatChannelId || undefined,
    sendChatReminders: params.sendChatReminders ?? true,

    // Legacy fields
    date: legacyDate,
    startTime: legacyStartTime,
    endTime: legacyEndTime,
    shortDescription: params.shortDescription || undefined,
    longDescription: params.longDescription || undefined,
    category: params.category || undefined,
    track: params.track || undefined,
    featured: params.featured || false,

    // Marketing/Discover fields (passed through to Firestore)
    priceInCents: params.priceInCents ?? 0,
    currency: params.currency || 'usd',
    purchaseType: params.purchaseType || 'popup',
    isPublic: params.isPublic ?? true,
    keyOutcomes: params.keyOutcomes || [],
    features: params.features || [],
    testimonials: params.testimonials || [],
    faqs: params.faqs || [],
    orderBumps: params.orderBumps || undefined,

    // Meeting provider
    meetingProvider: params.meetingProvider || undefined,
    externalMeetingId: params.externalMeetingId || undefined,

    // AI Summary & Auto-fill
    autoGenerateSummary: params.autoGenerateSummary || undefined,
    autoFillWeek: params.autoFillWeek || undefined,
    autoFillTarget: params.autoFillTarget || undefined,

    // Timestamps
    createdAt: now,
    updatedAt: now,
  };

  // Create the event document
  const docRef = await adminDb.collection('events').add(eventData);
  const eventId = docRef.id;

  const createdEvent = { id: eventId, ...eventData } as UnifiedEvent;

  // If voting is required and creator voted yes, create their vote
  if (params.approvalType === 'voting') {
    await adminDb.collection('eventVotes').doc(`${eventId}_${params.userId}`).set({
      id: `${eventId}_${params.userId}`,
      eventId,
      userId: params.userId,
      vote: 'yes',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Schedule notification jobs (only for confirmed events)
  if (status === 'confirmed') {
    await scheduleEventJobs(createdEvent);
  }

  // If recurring, generate initial instances
  if (params.isRecurring && params.recurrence) {
    await generateRecurringInstances(createdEvent);
  }

  // Link event to program instance week (and optionally day) if applicable
  // Note: weekIndex here is actually weekNumber (0=Onboarding, 1=Week 1, -1=Closing, etc.)
  console.log(`[EVENT_CORE] Checking instance linking: instanceId=${params.instanceId}, weekIndex=${params.weekIndex}`);
  if (params.instanceId && params.weekIndex !== undefined) {
    try {
      const instanceRef = adminDb.collection('program_instances').doc(params.instanceId);
      const instanceDoc = await instanceRef.get();
      console.log(`[EVENT_CORE] Instance doc exists: ${instanceDoc.exists}`);

      if (instanceDoc.exists) {
        const currentData = instanceDoc.data() as ProgramInstance;
        const weeks = [...(currentData.weeks || [])];
        console.log(`[EVENT_CORE] Instance has ${weeks.length} weeks, looking for weekNumber=${params.weekIndex}`);

        // Find week by weekNumber (not array index) since weeks might not be ordered
        const weekArrayIndex = weeks.findIndex(w => w.weekNumber === params.weekIndex);

        if (weekArrayIndex !== -1) {
          // Add to week's linkedCallEventIds
          const weekLinkedCallEventIds = weeks[weekArrayIndex].linkedCallEventIds || [];
          if (!weekLinkedCallEventIds.includes(eventId)) {
            weeks[weekArrayIndex].linkedCallEventIds = [...weekLinkedCallEventIds, eventId];
          }

          // If dayIndex is provided, also link to the specific day
          if (params.dayIndex !== undefined) {
            const days = weeks[weekArrayIndex].days || [];
            const weekStartDayIndex = weeks[weekArrayIndex].startDayIndex || 1;
            const dayIndexInWeek = params.dayIndex - weekStartDayIndex;

            if (days[dayIndexInWeek]) {
              const dayLinkedEventIds = days[dayIndexInWeek].linkedEventIds || [];
              if (!dayLinkedEventIds.includes(eventId)) {
                days[dayIndexInWeek].linkedEventIds = [...dayLinkedEventIds, eventId];
              }
              weeks[weekArrayIndex].days = days;
            }
          }

          await instanceRef.update({
            weeks,
            updatedAt: FieldValue.serverTimestamp(),
          });

          console.log(`[EVENT_CORE] Linked event ${eventId} to instance ${params.instanceId} weekNumber ${params.weekIndex}${params.dayIndex !== undefined ? ` day ${params.dayIndex}` : ''}`);
        } else {
          console.log(`[EVENT_CORE] Week with weekNumber ${params.weekIndex} not found in instance ${params.instanceId} (available weekNumbers: ${weeks.map(w => w.weekNumber).join(', ')})`);
        }
      }
    } catch (err) {
      console.error('[EVENT_CORE] Error linking event to instance:', err);
      // Don't fail the request, the event was created successfully
    }
  }

  console.log(`[EVENT_CORE] Created event ${eventId} (${params.eventType})`);

  return { eventId, event: createdEvent };
}
