/**
 * Event Recurrence System
 * 
 * This module handles generating event instances from recurring events.
 * 
 * How it works:
 * 1. Coach creates a recurring event (parent) with a recurrence pattern
 * 2. A cron job runs daily to generate instances for the next N days
 * 3. Each instance is a real event document linked to the parent
 * 4. Instances get their own notification jobs scheduled
 * 
 * The recurrence pattern supports:
 * - Daily
 * - Weekly (specific day of week)
 * - Biweekly (every 2 weeks)
 * - Monthly (specific day of month)
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { scheduleEventJobs } from './event-notifications';
import { createZoomMeeting, deleteZoomMeeting } from './integrations/zoom';
import { createGoogleMeetMeeting, deleteGoogleMeetEvent } from './integrations/google-meet';
import type { UnifiedEvent, RecurrencePattern, ProgramEnrollment, ProgramWeek } from '@/types';

// Default look-ahead for generating instances (in days)
const DEFAULT_LOOK_AHEAD_DAYS = 14;

// ============================================================================
// External Meeting Helper Functions
// ============================================================================

interface MeetingCreationResult {
  success: boolean;
  meetingUrl?: string;
  meetingId?: string;
  error?: string;
}

/**
 * Create a Zoom or Google Meet meeting for a specific event instance.
 * Falls back gracefully if integration is disconnected.
 */
async function createMeetingForInstance(
  orgId: string,
  provider: 'zoom' | 'google_meet' | 'stream' | 'manual',
  details: {
    title: string;
    startDateTime: string;
    durationMinutes: number;
    timezone: string;
    clientName?: string;
    description?: string;
  }
): Promise<MeetingCreationResult> {
  // Only create meetings for Zoom and Google Meet
  if (provider !== 'zoom' && provider !== 'google_meet') {
    return { success: true };
  }

  const topic = details.clientName
    ? `${details.title} with ${details.clientName}`
    : details.title;

  try {
    if (provider === 'zoom') {
      const result = await createZoomMeeting(orgId, {
        topic,
        startTime: details.startDateTime,
        duration: details.durationMinutes,
        timezone: details.timezone,
        agenda: details.description,
      });

      if (!result.success) {
        console.warn(`[EVENT_RECURRENCE] Zoom meeting creation failed: ${result.error}`);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        meetingUrl: result.meetingUrl,
        meetingId: result.meetingId,
      };
    }

    if (provider === 'google_meet') {
      const endTime = new Date(
        new Date(details.startDateTime).getTime() + details.durationMinutes * 60 * 1000
      ).toISOString();

      const result = await createGoogleMeetMeeting(orgId, {
        summary: topic,
        startTime: details.startDateTime,
        endTime,
        timezone: details.timezone,
        description: details.description,
      });

      if (!result.success) {
        console.warn(`[EVENT_RECURRENCE] Google Meet creation failed: ${result.error}`);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        meetingUrl: result.meetingUrl,
        meetingId: result.eventId, // Google uses eventId
      };
    }

    return { success: true };
  } catch (error) {
    console.error(`[EVENT_RECURRENCE] Meeting creation failed for ${provider}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Meeting creation failed',
    };
  }
}

/**
 * Delete an external meeting (Zoom or Google Meet).
 * Best-effort: logs errors but doesn't throw.
 */
async function deleteExternalMeeting(
  orgId: string,
  provider: string | undefined,
  externalId: string
): Promise<void> {
  if (!provider || !externalId) return;

  try {
    if (provider === 'zoom') {
      const result = await deleteZoomMeeting(orgId, externalId);
      if (!result.success) {
        console.warn(`[EVENT_RECURRENCE] Failed to delete Zoom meeting ${externalId}: ${result.error}`);
      } else {
        console.log(`[EVENT_RECURRENCE] Deleted Zoom meeting ${externalId}`);
      }
    } else if (provider === 'google_meet') {
      const result = await deleteGoogleMeetEvent(orgId, externalId);
      if (!result.success) {
        console.warn(`[EVENT_RECURRENCE] Failed to delete Google Meet event ${externalId}: ${result.error}`);
      } else {
        console.log(`[EVENT_RECURRENCE] Deleted Google Meet event ${externalId}`);
      }
    }
  } catch (error) {
    // Best-effort: log but don't throw
    console.error(`[EVENT_RECURRENCE] Error deleting ${provider} meeting ${externalId}:`, error);
  }
}

// ============================================================================
// Week Linking Helper Functions
// ============================================================================

/**
 * Find the program week that contains a specific date for an enrollment.
 * Used to auto-link recurring call instances to their corresponding program weeks.
 *
 * @param programId - The program ID
 * @param enrollmentStartDate - The enrollment start date
 * @param targetDate - The date to find the week for
 * @returns The week ID if found, null otherwise
 */
async function findWeekForDate(
  programId: string,
  enrollmentStartDate: Date,
  targetDate: Date
): Promise<string | null> {
  // Calculate days since enrollment start
  const daysSinceStart = Math.floor(
    (targetDate.getTime() - enrollmentStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const dayIndex = Math.max(0, daysSinceStart);

  // Find the week containing this day index
  const weeksSnapshot = await adminDb
    .collection('program_weeks')
    .where('programId', '==', programId)
    .where('startDayIndex', '<=', dayIndex)
    .orderBy('startDayIndex', 'desc')
    .limit(1)
    .get();

  if (weeksSnapshot.empty) {
    return null;
  }

  const weekDoc = weeksSnapshot.docs[0];
  const weekData = weekDoc.data();

  // Verify day is within this week's range
  if (dayIndex > weekData.endDayIndex) {
    return null;
  }

  return weekDoc.id;
}

// ============================================================================
// Recurrence Calculation Functions
// ============================================================================

/**
 * Calculate the next occurrence date based on a recurrence pattern.
 * 
 * @param recurrence - The recurrence pattern
 * @param afterDate - Calculate next occurrence after this date
 * @returns ISO date string of the next occurrence, or null if no more occurrences
 */
export function getNextOccurrence(
  recurrence: RecurrencePattern,
  afterDate: Date
): Date | null {
  const { frequency, dayOfWeek, dayOfMonth, time, timezone, startDate, endDate, count } = recurrence;
  
  // Parse the start date
  const start = new Date(startDate);
  
  // If afterDate is before start, use start
  const baseDate = afterDate < start ? start : afterDate;
  
  // Parse the time
  const [hours, minutes] = time.split(':').map(Number);
  
  let nextDate: Date;
  
  switch (frequency) {
    case 'daily':
      nextDate = getNextDailyOccurrence(baseDate, hours, minutes, timezone);
      break;
    
    case 'weekly':
      if (dayOfWeek === undefined) return null;
      nextDate = getNextWeeklyOccurrence(baseDate, dayOfWeek, hours, minutes, timezone);
      break;
    
    case 'biweekly':
      if (dayOfWeek === undefined) return null;
      nextDate = getNextBiweeklyOccurrence(baseDate, dayOfWeek, hours, minutes, timezone, start);
      break;
    
    case 'monthly':
      if (dayOfMonth === undefined) return null;
      nextDate = getNextMonthlyOccurrence(baseDate, dayOfMonth, hours, minutes, timezone);
      break;
    
    default:
      return null;
  }
  
  // Check if we've exceeded endDate
  if (endDate) {
    const end = new Date(endDate);
    if (nextDate > end) {
      return null;
    }
  }
  
  // Note: count-based limiting would need tracking of how many instances have been created
  // This is handled at the generation level
  
  return nextDate;
}

/**
 * Get next daily occurrence
 */
function getNextDailyOccurrence(
  afterDate: Date,
  hours: number,
  minutes: number,
  timezone: string
): Date {
  // Start with the day after afterDate
  const next = new Date(afterDate);
  next.setDate(next.getDate() + 1);
  
  // Set the time in the target timezone
  return setTimeInTimezone(next, hours, minutes, timezone);
}

/**
 * Get next weekly occurrence on a specific day
 */
function getNextWeeklyOccurrence(
  afterDate: Date,
  dayOfWeek: number,
  hours: number,
  minutes: number,
  timezone: string
): Date {
  const next = new Date(afterDate);

  // Find the next occurrence of the target day
  const currentDay = next.getDay();
  let daysToAdd = dayOfWeek - currentDay;

  if (daysToAdd < 0) {
    // Target day already passed this week
    daysToAdd += 7;
  } else if (daysToAdd === 0) {
    // Same day of week - check if event time has already passed
    const eventTimeToday = setTimeInTimezone(new Date(afterDate), hours, minutes, timezone);
    if (afterDate >= eventTimeToday) {
      // Event time has passed today, move to next week
      daysToAdd = 7;
    }
  }

  next.setDate(next.getDate() + daysToAdd);

  return setTimeInTimezone(next, hours, minutes, timezone);
}

/**
 * Get next biweekly occurrence
 */
function getNextBiweeklyOccurrence(
  afterDate: Date,
  dayOfWeek: number,
  hours: number,
  minutes: number,
  timezone: string,
  startDate: Date
): Date {
  // Calculate weeks since start
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((afterDate.getTime() - startDate.getTime()) / msPerWeek);
  
  // Find if this is an "on" week or "off" week
  const isEvenWeek = weeksSinceStart % 2 === 0;
  
  // Get the next weekly occurrence
  let next = getNextWeeklyOccurrence(afterDate, dayOfWeek, hours, minutes, timezone);
  
  // If we're in an "off" week, add another week
  const nextWeeksSinceStart = Math.floor((next.getTime() - startDate.getTime()) / msPerWeek);
  if (nextWeeksSinceStart % 2 !== 0) {
    next.setDate(next.getDate() + 7);
  }
  
  return next;
}

/**
 * Get next monthly occurrence on a specific day
 */
function getNextMonthlyOccurrence(
  afterDate: Date,
  dayOfMonth: number,
  hours: number,
  minutes: number,
  timezone: string
): Date {
  const next = new Date(afterDate);
  
  // Move to the next month if we've passed the target day
  if (next.getDate() >= dayOfMonth) {
    next.setMonth(next.getMonth() + 1);
  }
  
  // Set the day of month (handling months with fewer days)
  const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(dayOfMonth, lastDayOfMonth));
  
  return setTimeInTimezone(next, hours, minutes, timezone);
}

/**
 * Set time in a specific timezone and return UTC date
 */
function setTimeInTimezone(date: Date, hours: number, minutes: number, timezone: string): Date {
  // Create a date string in the target timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  
  // Parse in the target timezone and convert to UTC
  try {
    // Create a date in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    // We need to work backwards - create the date in local time and adjust
    // This is a simplified approach; a proper implementation would use a library like date-fns-tz
    const localDate = new Date(dateStr);
    return localDate;
  } catch {
    // Fallback: just set the time directly
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }
}

/**
 * Generate all occurrences between two dates
 */
export function generateOccurrencesBetween(
  recurrence: RecurrencePattern,
  fromDate: Date,
  toDate: Date
): Date[] {
  const occurrences: Date[] = [];
  let current = fromDate;
  
  // Safety limit to prevent infinite loops
  const maxOccurrences = 100;
  
  while (occurrences.length < maxOccurrences) {
    const next = getNextOccurrence(recurrence, current);
    if (!next || next > toDate) {
      break;
    }
    
    occurrences.push(next);
    current = next;
  }
  
  return occurrences;
}

// ============================================================================
// Instance Generation Functions
// ============================================================================

/**
 * Generate event instances for a recurring event.
 * Creates instance documents in the events collection.
 * 
 * @param parentEvent - The recurring parent event
 * @param lookAheadDays - How many days ahead to generate instances
 * @returns Array of created instance IDs
 */
export async function generateRecurringInstances(
  parentEvent: UnifiedEvent,
  lookAheadDays: number = DEFAULT_LOOK_AHEAD_DAYS
): Promise<string[]> {
  if (!parentEvent.isRecurring || !parentEvent.recurrence) {
    return [];
  }

  const now = new Date();

  // If there's a count limit, extend lookAhead to ensure we can generate all instances
  // For weekly events with count=4, we need at least 4 weeks (28 days)
  // Use a generous multiplier based on frequency to ensure we have enough range
  let effectiveLookAheadDays = lookAheadDays;
  if (parentEvent.recurrence.count) {
    const frequency = parentEvent.recurrence.frequency;
    const daysPerOccurrence = frequency === 'daily' ? 1
      : frequency === 'weekly' ? 7
      : frequency === 'biweekly' ? 14
      : 30; // monthly
    // Add buffer to ensure we can generate all count instances
    const minDaysNeeded = parentEvent.recurrence.count * daysPerOccurrence + 7;
    effectiveLookAheadDays = Math.max(lookAheadDays, minDaysNeeded);
  }

  const lookAheadEnd = new Date(now.getTime() + effectiveLookAheadDays * 24 * 60 * 60 * 1000);

  // Get ALL existing instances to track count limit (not just future ones)
  const allInstancesSnapshot = await adminDb
    .collection('events')
    .where('parentEventId', '==', parentEvent.id)
    .get();

  const existingCount = allInstancesSnapshot.size;
  const existingDates = new Set(
    allInstancesSnapshot.docs.map(doc => doc.data().instanceDate)
  );

  // Calculate how many more instances we can create based on count limit
  const countLimit = parentEvent.recurrence.count;
  const maxToCreate = countLimit
    ? Math.max(0, countLimit - existingCount)
    : Infinity;

  if (maxToCreate === 0) {
    console.log(`[EVENT_RECURRENCE] Count limit reached for ${parentEvent.id} (${existingCount}/${countLimit})`);
    return [];
  }

  // Generate occurrences
  const occurrences = generateOccurrencesBetween(
    parentEvent.recurrence,
    now,
    lookAheadEnd
  );

  const createdIds: string[] = [];

  for (const occurrence of occurrences) {
    // Check if we've hit the count limit
    if (countLimit && (existingCount + createdIds.length) >= countLimit) {
      console.log(`[EVENT_RECURRENCE] Count limit reached during generation for ${parentEvent.id}`);
      break;
    }

    const instanceDate = occurrence.toISOString().split('T')[0];

    // Skip if instance already exists for this date (including ones created in this run)
    if (existingDates.has(instanceDate)) {
      console.log(`[EVENT_RECURRENCE] Skipping duplicate instance for ${instanceDate}`);
      continue;
    }

    // Mark this date as used to prevent duplicates within the same run
    existingDates.add(instanceDate);
    
    // Try to find the program week for this instance if it's a program-related call
    let programWeekId: string | undefined;

    if (parentEvent.programId && parentEvent.clientUserId) {
      try {
        // Find active enrollment for this client in this program
        const enrollmentSnapshot = await adminDb
          .collection('program_enrollments')
          .where('programId', '==', parentEvent.programId)
          .where('userId', '==', parentEvent.clientUserId)
          .where('status', '==', 'active')
          .limit(1)
          .get();

        if (!enrollmentSnapshot.empty) {
          const enrollment = enrollmentSnapshot.docs[0].data() as ProgramEnrollment;
          const enrollmentStart = new Date(enrollment.startedAt);

          const weekId = await findWeekForDate(
            parentEvent.programId,
            enrollmentStart,
            occurrence
          );

          if (weekId) {
            programWeekId = weekId;
            console.log(`[EVENT_RECURRENCE] Auto-linking instance to week ${weekId}`);
          }
        }
      } catch (error) {
        console.error('[EVENT_RECURRENCE] Error finding week for instance:', error);
      }
    }

    // Create unique meeting for this instance if using Zoom or Google Meet
    let instanceMeetingLink: string | undefined;
    let instanceExternalMeetingId: string | undefined;

    if (
      parentEvent.meetingProvider &&
      ['zoom', 'google_meet'].includes(parentEvent.meetingProvider) &&
      parentEvent.organizationId
    ) {
      const meetingResult = await createMeetingForInstance(
        parentEvent.organizationId,
        parentEvent.meetingProvider as 'zoom' | 'google_meet',
        {
          title: parentEvent.title,
          startDateTime: occurrence.toISOString(),
          durationMinutes: parentEvent.durationMinutes || 60,
          timezone: parentEvent.timezone || 'UTC',
          clientName: parentEvent.clientName,
          description: parentEvent.description,
        }
      );

      if (meetingResult.success && meetingResult.meetingUrl) {
        instanceMeetingLink = meetingResult.meetingUrl;
        instanceExternalMeetingId = meetingResult.meetingId;
        console.log(`[EVENT_RECURRENCE] Created ${parentEvent.meetingProvider} meeting for instance ${instanceDate}`);
      } else {
        // Meeting creation failed - instance will still be created but without unique link
        console.warn(`[EVENT_RECURRENCE] Could not create meeting for instance ${instanceDate}, using parent's link`);
      }
    }

    // Create instance document
    const instanceData: Omit<UnifiedEvent, 'id'> = {
      ...parentEvent,
      // Override with instance-specific data
      isRecurring: false,
      recurrence: undefined,
      parentEventId: parentEvent.id,
      instanceDate,
      programWeekId, // Link to program week if found
      startDateTime: occurrence.toISOString(),
      // Calculate end time if duration is set
      endDateTime: parentEvent.durationMinutes
        ? new Date(occurrence.getTime() + parentEvent.durationMinutes * 60 * 1000).toISOString()
        : undefined,
      // Use instance-specific meeting link if created, otherwise fall back to parent's
      meetingLink: instanceMeetingLink ?? parentEvent.meetingLink,
      externalMeetingId: instanceExternalMeetingId ?? parentEvent.externalMeetingId,
      status: 'confirmed',
      // Reset voting for instances (they inherit confirmation from parent)
      votingConfig: undefined,
      confirmedAt: new Date().toISOString(),
      // Clear attendees for new instance
      attendeeIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Remove the id field from parent before spreading
    delete (instanceData as Record<string, unknown>).id;

    const docRef = await adminDb.collection('events').add(instanceData);
    createdIds.push(docRef.id);

    // Also update the week's linkedCallEventIds if we found a week
    if (programWeekId) {
      try {
        await adminDb
          .collection('program_weeks')
          .doc(programWeekId)
          .update({
            linkedCallEventIds: FieldValue.arrayUnion(docRef.id),
            updatedAt: FieldValue.serverTimestamp(),
          });
        console.log(`[EVENT_RECURRENCE] Updated week ${programWeekId} with call ${docRef.id}`);
      } catch (error) {
        console.error('[EVENT_RECURRENCE] Error updating week with call:', error);
      }
    }

    // Schedule notification jobs for the instance
    await scheduleEventJobs({ id: docRef.id, ...instanceData } as UnifiedEvent);

    console.log(`[EVENT_RECURRENCE] Created instance ${docRef.id} for ${instanceDate}`);
  }
  
  return createdIds;
}

/**
 * Process all recurring events and generate upcoming instances.
 * Called by the daily cron job.
 */
export async function processRecurringEvents(
  lookAheadDays: number = DEFAULT_LOOK_AHEAD_DAYS
): Promise<{
  processed: number;
  instancesCreated: number;
  errors: number;
}> {
  const stats = {
    processed: 0,
    instancesCreated: 0,
    errors: 0,
  };
  
  try {
    // Query for active recurring events
    const recurringEventsSnapshot = await adminDb
      .collection('events')
      .where('isRecurring', '==', true)
      .where('status', 'in', ['confirmed', 'draft'])
      .get();
    
    if (recurringEventsSnapshot.empty) {
      console.log('[EVENT_RECURRENCE] No recurring events found');
      return stats;
    }
    
    for (const doc of recurringEventsSnapshot.docs) {
      stats.processed++;
      const event = { id: doc.id, ...doc.data() } as UnifiedEvent;
      
      try {
        const createdIds = await generateRecurringInstances(event, lookAheadDays);
        stats.instancesCreated += createdIds.length;
      } catch (error) {
        console.error(`[EVENT_RECURRENCE] Error processing event ${event.id}:`, error);
        stats.errors++;
      }
    }
    
    console.log('[EVENT_RECURRENCE] Process completed:', stats);
  } catch (error) {
    console.error('[EVENT_RECURRENCE] Error processing recurring events:', error);
    stats.errors++;
  }
  
  return stats;
}

/**
 * Update all future instances of a recurring event.
 * Used when the parent event is modified.
 * 
 * @param parentEventId - The parent event ID
 * @param updates - Fields to update in instances
 */
export async function updateFutureInstances(
  parentEventId: string,
  updates: Partial<UnifiedEvent>
): Promise<number> {
  const now = new Date().toISOString();
  
  // Get future instances
  const instancesSnapshot = await adminDb
    .collection('events')
    .where('parentEventId', '==', parentEventId)
    .where('startDateTime', '>=', now)
    .get();
  
  if (instancesSnapshot.empty) {
    return 0;
  }
  
  const batch = adminDb.batch();
  
  for (const doc of instancesSnapshot.docs) {
    // Don't update instance-specific fields
    const safeUpdates = { ...updates };
    delete safeUpdates.id;
    delete safeUpdates.startDateTime;
    delete safeUpdates.endDateTime;
    delete safeUpdates.instanceDate;
    delete safeUpdates.parentEventId;
    delete safeUpdates.isRecurring;
    delete safeUpdates.recurrence;
    delete safeUpdates.createdAt;
    
    batch.update(doc.ref, {
      ...safeUpdates,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  
  await batch.commit();
  
  console.log(`[EVENT_RECURRENCE] Updated ${instancesSnapshot.size} future instances of ${parentEventId}`);
  return instancesSnapshot.size;
}

/**
 * Cancel all future instances of a recurring event.
 * Used when the parent event is canceled or deleted.
 * Also cleans up external meetings (Zoom, Google Meet).
 */
export async function cancelFutureInstances(parentEventId: string): Promise<{ count: number; cancelledIds: string[] }> {
  const now = new Date().toISOString();

  // Get future instances
  const instancesSnapshot = await adminDb
    .collection('events')
    .where('parentEventId', '==', parentEventId)
    .where('startDateTime', '>=', now)
    .get();

  if (instancesSnapshot.empty) {
    return { count: 0, cancelledIds: [] };
  }

  const batch = adminDb.batch();
  const cancelledIds: string[] = [];

  for (const doc of instancesSnapshot.docs) {
    const eventData = doc.data() as UnifiedEvent;
    cancelledIds.push(doc.id);

    // Delete external meeting if exists (best-effort, don't block on failure)
    if (eventData.externalMeetingId && eventData.organizationId) {
      deleteExternalMeeting(
        eventData.organizationId,
        eventData.meetingProvider,
        eventData.externalMeetingId
      ).catch(err => {
        console.error(`[EVENT_RECURRENCE] Error cleaning up meeting for ${doc.id}:`, err);
      });
    }

    batch.update(doc.ref, {
      status: 'canceled',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  console.log(`[EVENT_RECURRENCE] Canceled ${instancesSnapshot.size} future instances of ${parentEventId}`);
  return { count: instancesSnapshot.size, cancelledIds };
}

/**
 * Delete all instances of a recurring event.
 * Used when the parent event is permanently deleted.
 * Also cleans up external meetings (Zoom, Google Meet).
 */
export async function deleteAllInstances(parentEventId: string): Promise<number> {
  const instancesSnapshot = await adminDb
    .collection('events')
    .where('parentEventId', '==', parentEventId)
    .get();

  if (instancesSnapshot.empty) {
    return 0;
  }

  const batch = adminDb.batch();

  for (const doc of instancesSnapshot.docs) {
    const eventData = doc.data() as UnifiedEvent;

    // Delete external meeting if exists (best-effort, don't block on failure)
    if (eventData.externalMeetingId && eventData.organizationId) {
      deleteExternalMeeting(
        eventData.organizationId,
        eventData.meetingProvider,
        eventData.externalMeetingId
      ).catch(err => {
        console.error(`[EVENT_RECURRENCE] Error cleaning up meeting for ${doc.id}:`, err);
      });
    }

    batch.delete(doc.ref);
  }

  await batch.commit();

  console.log(`[EVENT_RECURRENCE] Deleted ${instancesSnapshot.size} instances of ${parentEventId}`);
  return instancesSnapshot.size;
}










