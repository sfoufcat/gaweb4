/**
 * Track System Constants
 * 
 * Shared constants and helpers for the track system.
 * This file is safe to import in both Client and Server components.
 * 
 * For server-side track operations (read/write user track from Clerk/Firebase),
 * see track.ts instead.
 */

import type { UserTrack } from '@/types';

// Track definitions with display information
export interface TrackInfo {
  id: UserTrack;
  label: string;
  description: string;
  icon: string; // Emoji icon
}

export const TRACKS: TrackInfo[] = [
  {
    id: 'content_creator',
    label: 'Content Creator',
    description: 'Build a consistent content engine across platforms and grow your audience.',
    icon: '🎬',
  },
  {
    id: 'saas',
    label: 'SaaS Founder',
    description: 'Prioritize shipping features, talking to users, and validating your product.',
    icon: '💻',
  },
  {
    id: 'coach_consultant',
    label: 'Coach / Consultant',
    description: 'Create value, book calls, and deliver great results to clients.',
    icon: '🎯',
  },
  {
    id: 'ecom',
    label: 'E-commerce Founder',
    description: 'Optimize your store, traffic, and offers to drive more sales.',
    icon: '🛒',
  },
  {
    id: 'agency',
    label: 'Agency Owner',
    description: 'Fill your pipeline, serve clients well, and build systems.',
    icon: '🏢',
  },
  {
    id: 'community_builder',
    label: 'Community Builder',
    description: 'Grow, engage, and retain a healthy community.',
    icon: '👥',
  },
  {
    id: 'general',
    label: 'General Entrepreneur',
    description: 'For founders building hybrid or unclear business models.',
    icon: '🚀',
  },
];

/**
 * Get track info by ID
 */
export function getTrackInfo(trackId: UserTrack): TrackInfo | undefined {
  return TRACKS.find(t => t.id === trackId);
}

/**
 * Validate if a string is a valid track ID
 */
export function isValidTrack(track: string): track is UserTrack {
  return TRACKS.some(t => t.id === track);
}

