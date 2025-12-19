/**
 * Starter Program Configuration
 * 
 * Central configuration for track-specific starter programs including:
 * - Default habits per track
 * - UI labels for habits section
 * - UI labels for program badges
 */

import type { UserTrack } from '@/types';

// ============================================================================
// DEFAULT HABITS PER TRACK
// ============================================================================

export interface DefaultHabitTemplate {
  id: string;           // Stable key for the habit
  title: string;        // What shows in UI
  description?: string; // Optional description
  suggestedFrequency?: 'daily' | 'weekday' | 'custom';
}

export interface TrackHabitsConfig {
  trackId: UserTrack;
  defaultHabits: DefaultHabitTemplate[];
}

/**
 * Default habits for each track
 * These are pre-loaded when a user selects or switches to a track
 */
export const TRACK_DEFAULT_HABITS: Record<UserTrack, DefaultHabitTemplate[]> = {
  // Creator track
  content_creator: [
    {
      id: 'creator_publish',
      title: 'Publish at least 1 piece of content',
      description: 'Post or draft something for one platform every day.',
      suggestedFrequency: 'daily',
    },
    {
      id: 'creator_engage',
      title: 'Engage with your audience for 15 minutes',
      description: 'Reply to comments, DMs, or interact with your niche.',
      suggestedFrequency: 'daily',
    },
  ],
  
  // SaaS Founder track
  saas: [
    {
      id: 'saas_ship',
      title: 'Ship 1 micro-improvement daily',
      description: 'Fix a bug, tweak UX, or improve any small feature.',
      suggestedFrequency: 'daily',
    },
    {
      id: 'saas_user_convo',
      title: 'Talk to 1 user',
      description: 'Short call, DM, or email to understand user needs.',
      suggestedFrequency: 'daily',
    },
  ],
  
  // Coach / Consultant track
  coach_consultant: [
    {
      id: 'coach_visibility',
      title: 'Share one insight publicly',
      description: 'Post a tip, story, or result on one platform.',
      suggestedFrequency: 'daily',
    },
    {
      id: 'coach_outreach',
      title: 'Connect with 1 potential client',
      description: 'DM, email, or message someone who fits your ideal client.',
      suggestedFrequency: 'daily',
    },
  ],
  
  // E-commerce Owner track
  ecom: [
    {
      id: 'ecom_metrics',
      title: 'Review ad/account metrics',
      description: 'Check performance of your key campaigns daily.',
      suggestedFrequency: 'daily',
    },
    {
      id: 'ecom_optimization',
      title: 'Optimize 1 product listing/page',
      description: 'Tweak creatives, copy, or offer on one SKU or funnel.',
      suggestedFrequency: 'daily',
    },
  ],
  
  // Agency Owner track
  agency: [
    {
      id: 'agency_outbound',
      title: 'Daily lead gen (5 outreaches)',
      description: 'DMs, emails, or loom videos to high-fit prospects.',
      suggestedFrequency: 'daily',
    },
    {
      id: 'agency_systems',
      title: 'Improve 1 internal system',
      description: 'Document, delegate, or automate one workflow.',
      suggestedFrequency: 'daily',
    },
  ],
  
  // Community Builder track
  community_builder: [
    {
      id: 'community_conversation',
      title: 'Start 1 conversation in your community',
      description: 'Post a discussion prompt or question.',
      suggestedFrequency: 'daily',
    },
    {
      id: 'community_value',
      title: 'Create 1 value post/message',
      description: 'Share helpful resources, insights, or celebrate members.',
      suggestedFrequency: 'daily',
    },
  ],
  
  // General / default track (legacy fallback)
  general: [
    {
      id: 'general_deep_work',
      title: 'Do 1 deep-work block',
      description: 'Focus on your most important task without distraction.',
      suggestedFrequency: 'daily',
    },
    {
      id: 'general_reflect',
      title: 'Reflect on your day for 5 minutes',
      description: 'Review what worked, what didn\'t, and what to improve.',
      suggestedFrequency: 'daily',
    },
  ],
};

// ============================================================================
// UI LABEL MAPPINGS
// ============================================================================

/**
 * Track-specific labels for the Habits section header on Home page
 */
export const TRACK_HABIT_LABELS: Record<UserTrack, string> = {
  content_creator: 'Creator habits',
  saas: 'SaaS habits',
  coach_consultant: 'Coach habits',
  ecom: 'E-commerce habits',
  agency: 'Agency habits',
  community_builder: 'Community habits',
  general: 'Growth habits',
};

/**
 * Fallback label when user has no track selected
 */
export const DEFAULT_HABIT_LABEL = 'Habits';

/**
 * Track-specific labels for the starter program badge near Daily Focus
 */
export const TRACK_PROGRAM_BADGES: Record<UserTrack, string> = {
  content_creator: 'Creator starter program',
  saas: 'SaaS starter program',
  coach_consultant: 'Coach starter program',
  ecom: 'E-commerce starter program',
  agency: 'Agency starter program',
  community_builder: 'Community starter program',
  general: 'Growth starter program',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get default habits for a specific track
 */
export function getDefaultHabitsForTrack(trackId: UserTrack): DefaultHabitTemplate[] {
  return TRACK_DEFAULT_HABITS[trackId] || [];
}

/**
 * Get the habit section label for a track
 */
export function getHabitLabelForTrack(trackId: UserTrack | null | undefined): string {
  if (!trackId) return DEFAULT_HABIT_LABEL;
  return TRACK_HABIT_LABELS[trackId] || DEFAULT_HABIT_LABEL;
}

/**
 * Get the starter program badge label for a track
 */
export function getProgramBadgeForTrack(trackId: UserTrack | null | undefined): string | null {
  if (!trackId) return null;
  return TRACK_PROGRAM_BADGES[trackId] || null;
}

