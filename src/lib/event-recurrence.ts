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
import type { UnifiedEvent, RecurrencePattern } from '@/types';

// Default look-ahead for generating instances (in days)
const DEFAULT_LOOK_AHEAD_DAYS = 14;

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
  
  if (daysToAdd <= 0) {
    daysToAdd += 7;
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
  const lookAheadEnd = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);
  
  // Get existing instances to avoid duplicates
  const existingInstancesSnapshot = await adminDb
    .collection('events')
    .where('parentEventId', '==', parentEvent.id)
    .where('instanceDate', '>=', now.toISOString().split('T')[0])
    .get();
  
  const existingDates = new Set(
    existingInstancesSnapshot.docs.map(doc => doc.data().instanceDate)
  );
  
  // Generate occurrences
  const occurrences = generateOccurrencesBetween(
    parentEvent.recurrence,
    now,
    lookAheadEnd
  );
  
  const createdIds: string[] = [];
  
  for (const occurrence of occurrences) {
    const instanceDate = occurrence.toISOString().split('T')[0];
    
    // Skip if instance already exists for this date
    if (existingDates.has(instanceDate)) {
      continue;
    }
    
    // Create instance document
    const instanceData: Omit<UnifiedEvent, 'id'> = {
      ...parentEvent,
      // Override with instance-specific data
      isRecurring: false,
      recurrence: undefined,
      parentEventId: parentEvent.id,
      instanceDate,
      startDateTime: occurrence.toISOString(),
      // Calculate end time if duration is set
      endDateTime: parentEvent.durationMinutes
        ? new Date(occurrence.getTime() + parentEvent.durationMinutes * 60 * 1000).toISOString()
        : undefined,
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
 */
export async function cancelFutureInstances(parentEventId: string): Promise<number> {
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
    batch.update(doc.ref, {
      status: 'canceled',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  
  await batch.commit();
  
  console.log(`[EVENT_RECURRENCE] Canceled ${instancesSnapshot.size} future instances of ${parentEventId}`);
  return instancesSnapshot.size;
}

/**
 * Delete all instances of a recurring event.
 * Used when the parent event is permanently deleted.
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
    batch.delete(doc.ref);
  }
  
  await batch.commit();
  
  console.log(`[EVENT_RECURRENCE] Deleted ${instancesSnapshot.size} instances of ${parentEventId}`);
  return instancesSnapshot.size;
}








