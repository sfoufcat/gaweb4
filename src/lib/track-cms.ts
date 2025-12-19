/**
 * Track CMS Library
 * 
 * Provides functions to fetch track configuration, dynamic prompts, and 
 * program habits from the database with fallback to hard-coded defaults.
 * 
 * This layer allows the Admin CMS to override defaults without breaking
 * the existing runtime logic.
 */

import { adminDb } from './firebase-admin';
import type { Track, DynamicPrompt, UserTrack, DynamicPromptType, DynamicPromptSlot, ProgramHabitTemplate } from '@/types';
import { TRACK_HABIT_LABELS, TRACK_PROGRAM_BADGES, TRACK_DEFAULT_HABITS } from './starter-program-config';
import type { TrackPrompt } from './track-prompts';

// ============================================================================
// TRACK CONFIGURATION
// ============================================================================

/**
 * Get track configuration from database, falling back to hard-coded defaults
 */
export async function getTrackConfig(trackSlug: UserTrack): Promise<{
  habitLabel: string;
  programBadgeLabel: string;
  name: string;
}> {
  try {
    // Try to fetch from database
    const snapshot = await adminDb
      .collection('tracks')
      .where('slug', '==', trackSlug)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const track = snapshot.docs[0].data() as Track;
      return {
        habitLabel: track.habitLabel,
        programBadgeLabel: track.programBadgeLabel,
        name: track.name,
      };
    }
  } catch (error) {
    console.warn('[TRACK_CMS] Error fetching track config, using fallback:', error);
  }

  // Fallback to hard-coded defaults
  const trackNames: Record<UserTrack, string> = {
    content_creator: 'Content Creator',
    saas: 'SaaS Founder',
    coach_consultant: 'Coach & Consultant',
    ecom: 'E-Commerce',
    agency: 'Agency',
    community_builder: 'Community Builder',
    general: 'General',
  };

  return {
    habitLabel: TRACK_HABIT_LABELS[trackSlug] || 'Habits',
    programBadgeLabel: TRACK_PROGRAM_BADGES[trackSlug] || 'Starter program',
    name: trackNames[trackSlug] || 'General',
  };
}

/**
 * Get all active tracks from database
 */
export async function getAllActiveTracks(): Promise<Track[]> {
  try {
    const snapshot = await adminDb
      .collection('tracks')
      .where('isActive', '==', true)
      .orderBy('slug', 'asc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as Track[];
  } catch (error) {
    console.warn('[TRACK_CMS] Error fetching tracks:', error);
    return [];
  }
}

// ============================================================================
// DYNAMIC PROMPTS
// ============================================================================

/**
 * Get all dynamic prompts from database for a given track/type/slot
 * 
 * Priority logic:
 * 1. Track-specific prompts (if trackId matches)
 * 2. Generic prompts (trackId is null) as fallback
 * 
 * Returns prompts ordered by priority (ascending)
 */
export async function getAllDynamicPrompts(
  trackSlug: UserTrack | null,
  type: DynamicPromptType,
  slot: DynamicPromptSlot
): Promise<DynamicPrompt[]> {
  try {
    // First, try to find track's ID from slug
    let trackId: string | null = null;
    if (trackSlug) {
      const trackSnapshot = await adminDb
        .collection('tracks')
        .where('slug', '==', trackSlug)
        .limit(1)
        .get();
      
      if (!trackSnapshot.empty) {
        trackId = trackSnapshot.docs[0].id;
      }
    }

    // Try track-specific prompts first
    if (trackId) {
      const trackPromptSnapshot = await adminDb
        .collection('dynamic_prompts')
        .where('trackId', '==', trackId)
        .where('type', '==', type)
        .where('slot', '==', slot)
        .where('isActive', '==', true)
        .orderBy('priority', 'asc')
        .get();

      if (!trackPromptSnapshot.empty) {
        return trackPromptSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
          } as DynamicPrompt;
        });
      }
    }

    // Fallback to generic prompts (trackId is null)
    const genericPromptSnapshot = await adminDb
      .collection('dynamic_prompts')
      .where('trackId', '==', null)
      .where('type', '==', type)
      .where('slot', '==', slot)
      .where('isActive', '==', true)
      .orderBy('priority', 'asc')
      .get();

    if (!genericPromptSnapshot.empty) {
      return genericPromptSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
        } as DynamicPrompt;
      });
    }

    return [];
  } catch (error) {
    console.warn('[TRACK_CMS] Error fetching dynamic prompts:', error);
    return [];
  }
}

/**
 * Get a dynamic prompt from database for the Daily Dynamics section
 * 
 * @param index - Optional index for cycling through prompts (uses modulo)
 * 
 * Priority logic:
 * 1. Track-specific prompt (if trackId matches)
 * 2. Generic prompt (trackId is null) as fallback
 */
export async function getDynamicPrompt(
  trackSlug: UserTrack | null,
  type: DynamicPromptType,
  slot: DynamicPromptSlot,
  index: number = 0
): Promise<DynamicPrompt | null> {
  const prompts = await getAllDynamicPrompts(trackSlug, type, slot);
  
  if (prompts.length === 0) {
    return null;
  }
  
  // Use modulo to cycle through available prompts
  const selectedIndex = index % prompts.length;
  return prompts[selectedIndex];
}

/**
 * Get track-specific prompt for the Dynamic Section from the CMS
 * 
 * @param track - User's track (e.g., 'content_creator', 'saas')
 * @param type - Prompt type ('morning', 'evening', 'weekly')
 * @param index - Cycle index for rotating through prompts (uses modulo)
 * 
 * Priority:
 * 1. Track-specific prompt (if trackId matches)
 * 2. Generic prompt (trackId is null) as fallback
 * 3. Returns null if no prompt found in CMS
 */
export async function getTrackPromptFromDB(
  track: UserTrack | null,
  type: DynamicPromptType = 'morning',
  index: number = 0
): Promise<TrackPrompt | null> {
  // Get prompt from CMS (tries track-specific first, then generic)
  const dbPrompt = await getDynamicPrompt(track, type, 'prompt', index);
  
  if (dbPrompt) {
    return {
      title: dbPrompt.title || '',
      description: dbPrompt.body,
    };
  }

  // No prompt found in CMS
  return null;
}

/**
 * Get a quote from the CMS for the quote card
 * 
 * @param track - User's track (e.g., 'content_creator', 'saas')
 * @param index - Cycle index for rotating through quotes (uses modulo)
 * 
 * Returns track-specific quotes first, then generic quotes as fallback
 */
export async function getQuoteFromDB(
  track: UserTrack | null,
  index: number = 0
): Promise<{ text: string; author: string } | null> {
  // Get quote from CMS (morning type is used for general quotes)
  const dbQuote = await getDynamicPrompt(track, 'morning', 'quote', index);
  
  if (dbQuote) {
    // Quote body format: "Quote text" or "Quote text — Author"
    const body = dbQuote.body;
    
    // Try to extract author if present (format: "text — author" or "text - author")
    const authorMatch = body.match(/\s*[—–-]\s*([^—–-]+)$/);
    if (authorMatch) {
      return {
        text: body.replace(authorMatch[0], '').trim(),
        author: authorMatch[1].trim(),
      };
    }
    
    // Use title as author if no author in body
    return {
      text: body,
      author: dbQuote.title || 'Unknown',
    };
  }

  // No quote found in CMS
  return null;
}

// ============================================================================
// PROGRAM DEFAULT HABITS
// ============================================================================

/**
 * Get default habits for a track from database, with fallback to hard-coded defaults
 * 
 * Checks:
 * 1. StarterProgram.defaultHabits (if program exists for track)
 * 2. Hard-coded TRACK_DEFAULT_HABITS as fallback
 */
export async function getDefaultHabitsForTrackFromDB(trackSlug: UserTrack): Promise<Array<{
  id: string;
  title: string;
  description?: string;
  suggestedFrequency?: 'daily' | 'weekday' | 'custom';
}>> {
  try {
    // Try to get from the default program for this track
    const programSnapshot = await adminDb
      .collection('starter_programs')
      .where('track', '==', trackSlug)
      .where('isDefaultForTrack', '==', true)
      .limit(1)
      .get();

    if (!programSnapshot.empty) {
      const program = programSnapshot.docs[0].data();
      
      // If program has defaultHabits defined, use those
      if (program.defaultHabits && Array.isArray(program.defaultHabits) && program.defaultHabits.length > 0) {
        return program.defaultHabits.map((habit: ProgramHabitTemplate, index: number) => ({
          id: `${trackSlug}_program_habit_${index}`,
          title: habit.title,
          description: habit.description || '',
          suggestedFrequency: habit.frequency || 'daily',
        }));
      }

      // Check Day 1 for habits
      const day1Snapshot = await adminDb
        .collection('starter_program_days')
        .where('programId', '==', programSnapshot.docs[0].id)
        .where('dayIndex', '==', 1)
        .limit(1)
        .get();

      if (!day1Snapshot.empty) {
        const day1 = day1Snapshot.docs[0].data();
        if (day1.habits && Array.isArray(day1.habits) && day1.habits.length > 0) {
          return day1.habits.map((habit: ProgramHabitTemplate, index: number) => ({
            id: `${trackSlug}_day1_habit_${index}`,
            title: habit.title,
            description: habit.description || '',
            suggestedFrequency: habit.frequency || 'daily',
          }));
        }
      }
    }
  } catch (error) {
    console.warn('[TRACK_CMS] Error fetching default habits, using fallback:', error);
  }

  // Fallback to hard-coded defaults
  return TRACK_DEFAULT_HABITS[trackSlug] || [];
}

// ============================================================================
// CLIENT-SIDE API ENDPOINTS
// ============================================================================

/**
 * API endpoint data fetcher for track configuration (client-side)
 * Use this in API routes that serve client components
 */
export async function getTrackConfigForClient(trackSlug: UserTrack | null): Promise<{
  habitLabel: string;
  programBadgeLabel: string;
  trackName: string;
}> {
  if (!trackSlug) {
    return {
      habitLabel: 'Habits',
      programBadgeLabel: '',
      trackName: 'General',
    };
  }

  const config = await getTrackConfig(trackSlug);
  return {
    habitLabel: config.habitLabel,
    programBadgeLabel: config.programBadgeLabel,
    trackName: config.name,
  };
}

