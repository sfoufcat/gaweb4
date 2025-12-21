/**
 * Habit Engine
 * 
 * Manages track-default habits:
 * - Create default habits when user selects/switches track
 * - Delete track-default habits when user changes track (keeps user-created habits)
 * 
 * Now supports CMS-backed habits from database with fallback to hard-coded defaults.
 */

import { adminDb } from './firebase-admin';
import { getDefaultHabitsForTrack } from './starter-program-config';
import type { UserTrack, Habit, HabitSource } from '@/types';

// ============================================================================
// HELPER: COUNT ACTIVE HABITS
// ============================================================================

/**
 * Count active (non-archived) habits for a user
 */
async function countActiveHabits(userId: string): Promise<number> {
  const snapshot = await adminDb
    .collection('habits')
    .where('userId', '==', userId)
    .where('archived', '==', false)
    .get();
  
  return snapshot.size;
}

// ============================================================================
// CREATE DEFAULT HABITS
// ============================================================================

/**
 * Create default habits for a user based on their selected track
 * 
 * Rules (matches Starter Program requirements):
 * - Only adds habits if user has fewer than 3 total active habits
 * - Only adds as many habits as needed to reach 3 total
 * - Never overrides user-created habits
 * - These are Day 1 habits from the Starter Program
 * 
 * @param userId - The user's ID
 * @param trackId - The track to create habits for
 * @returns Object with number of habits created
 */
export async function createDefaultHabitsForTrack(
  userId: string,
  trackId: UserTrack
): Promise<{ habitsCreated: number; habitIds: string[] }> {
  // Get default habits from hard-coded config
  // Track CMS deprecated - habits now come from program enrollment
  const templates = getDefaultHabitsForTrack(trackId);
  
  if (templates.length === 0) {
    console.log(`[HABIT_ENGINE] No default habits defined for track: ${trackId}`);
    return { habitsCreated: 0, habitIds: [] };
  }
  
  // Check how many active habits user already has
  const existingHabitCount = await countActiveHabits(userId);
  const maxHabits = 3;
  
  // If user already has 3+ habits, don't add any
  if (existingHabitCount >= maxHabits) {
    console.log(`[HABIT_ENGINE] User ${userId} already has ${existingHabitCount} habits (max ${maxHabits}), skipping default habit creation`);
    return { habitsCreated: 0, habitIds: [] };
  }
  
  // Calculate how many habits we can add
  const availableSlots = maxHabits - existingHabitCount;
  console.log(`[HABIT_ENGINE] User ${userId} has ${existingHabitCount} habits, ${availableSlots} slots available`);
  
  const now = new Date().toISOString();
  const habitIds: string[] = [];
  let habitsCreated = 0;
  
  for (const template of templates) {
    // Stop if we've filled all available slots
    if (habitsCreated >= availableSlots) {
      console.log(`[HABIT_ENGINE] Filled all ${availableSlots} available habit slots`);
      break;
    }
    
    // Check if this habit already exists (prevent duplicates on re-selection)
    const existingSnapshot = await adminDb
      .collection('habits')
      .where('userId', '==', userId)
      .where('source', '==', 'track_default')
      .where('trackDefaultId', '==', template.id)
      .limit(1)
      .get();
    
    if (!existingSnapshot.empty) {
      console.log(`[HABIT_ENGINE] Habit "${template.title}" already exists for user ${userId}, skipping`);
      continue;
    }
    
    // Determine frequency based on template suggestion
    let frequencyType: string;
    let frequencyValue: number[] | number;
    
    switch (template.suggestedFrequency) {
      case 'weekday':
        frequencyType = 'weekly_specific_days';
        frequencyValue = [0, 1, 2, 3, 4]; // Monday through Friday (0=Mon, 4=Fri)
        break;
      case 'custom':
        frequencyType = 'daily';
        frequencyValue = 1;
        break;
      case 'daily':
      default:
        frequencyType = 'daily';
        frequencyValue = 1;
        break;
    }
    
    // Create the habit
    const habitData: Omit<Habit, 'id'> = {
      userId,
      text: template.title,
      linkedRoutine: template.description || '',
      frequencyType: frequencyType as Habit['frequencyType'],
      frequencyValue,
      reminder: null,
      targetRepetitions: null,
      progress: {
        currentCount: 0,
        lastCompletedDate: null,
        completionDates: [],
        skipDates: [],
      },
      archived: false,
      status: 'active',
      source: 'track_default' as HabitSource,
      trackDefaultId: template.id,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await adminDb.collection('habits').add(habitData);
    habitIds.push(docRef.id);
    habitsCreated++;
    console.log(`[HABIT_ENGINE] Created track-default habit: "${template.title}" (${docRef.id})`);
  }
  
  console.log(`[HABIT_ENGINE] Created ${habitIds.length} default habits for track ${trackId} (${availableSlots} slots were available)`);
  return { habitsCreated: habitIds.length, habitIds };
}

// ============================================================================
// DELETE TRACK-DEFAULT HABITS
// ============================================================================

/**
 * Delete only track-default habits for a user
 * User-created habits (source === 'user' or no source) are preserved
 * 
 * @param userId - The user's ID
 * @returns Number of habits deleted
 */
export async function deleteTrackDefaultHabits(userId: string): Promise<number> {
  const snapshot = await adminDb
    .collection('habits')
    .where('userId', '==', userId)
    .where('source', '==', 'track_default')
    .get();
  
  if (snapshot.empty) {
    console.log(`[HABIT_ENGINE] No track-default habits to delete for user ${userId}`);
    return 0;
  }
  
  // Use batch delete for efficiency
  const batch = adminDb.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  console.log(`[HABIT_ENGINE] Deleted ${snapshot.size} track-default habits for user ${userId}`);
  return snapshot.size;
}

// ============================================================================
// HABIT EXISTENCE CHECK
// ============================================================================

/**
 * Check if a user has track-default habits
 * 
 * @param userId - The user's ID
 * @returns True if user has at least one track-default habit
 */
export async function hasTrackDefaultHabits(userId: string): Promise<boolean> {
  const snapshot = await adminDb
    .collection('habits')
    .where('userId', '==', userId)
    .where('source', '==', 'track_default')
    .limit(1)
    .get();
  
  return !snapshot.empty;
}

// ============================================================================
// MIGRATE HABITS ON TRACK CHANGE
// ============================================================================

/**
 * Handle habit migration when a user changes track
 * 
 * This function:
 * 1. Deletes existing track-default habits
 * 2. Creates new track-default habits for the new track
 * 
 * User-created habits are ALWAYS preserved.
 * 
 * @param userId - The user's ID
 * @param newTrackId - The new track ID
 * @returns Object with stats about the migration
 */
export async function migrateHabitsForTrackChange(
  userId: string,
  newTrackId: UserTrack
): Promise<{
  deleted: number;
  created: number;
  habitIds: string[];
}> {
  // Step 1: Delete existing track-default habits
  const deleted = await deleteTrackDefaultHabits(userId);
  
  // Step 2: Create new track-default habits
  const { habitsCreated, habitIds } = await createDefaultHabitsForTrack(userId, newTrackId);
  
  console.log(`[HABIT_ENGINE] Track change migration complete: deleted ${deleted}, created ${habitsCreated}`);
  
  return {
    deleted,
    created: habitsCreated,
    habitIds,
  };
}

