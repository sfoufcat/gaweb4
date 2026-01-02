/**
 * Decoy Marketplace Listings
 * 
 * These are fake program listings shown on the marketplace for social proof.
 * When clicked, they lead to a "Program Full" landing page.
 * 
 * Enable/disable via platform settings in admin panel.
 */

import type { DecoyListing } from '@/types';

/**
 * High-quality Unsplash images for decoy programs
 * Using direct Unsplash URLs (free for commercial use)
 */
const DECOY_IMAGES = {
  piano: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&q=80',
  coding: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
  mindset: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80',
  finance: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80',
  fitness: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
  leadership: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
};

/**
 * Avatar images for fake coaches
 */
const COACH_AVATARS = {
  maria: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
  alex: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
  sarah: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
  marcus: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80',
  jennifer: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
  david: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
};

/**
 * 6 Decoy Listings for social proof
 * 
 * These appear realistic but link to the "Program Full" page
 */
export const DECOY_LISTINGS: DecoyListing[] = [
  {
    id: 'decoy-jazz-piano',
    slug: 'jazz-piano-fundamentals',
    title: 'Jazz Piano Fundamentals',
    description: 'Master the art of jazz improvisation with structured lessons from chord voicings to complex progressions. Transform your playing in 12 weeks.',
    coverImageUrl: DECOY_IMAGES.piano,
    coachName: 'Maria Chen',
    coachAvatarUrl: COACH_AVATARS.maria,
    categories: ['creativity'],
    isDecoy: true,
  },
  {
    id: 'decoy-fullstack-bootcamp',
    slug: 'fullstack-developer-bootcamp',
    title: 'Full-Stack Developer Bootcamp',
    description: 'Go from zero to job-ready in 16 weeks. Learn React, Node.js, databases, and deploy real projects with mentorship and code reviews.',
    coverImageUrl: DECOY_IMAGES.coding,
    coachName: 'Alex Rivera',
    coachAvatarUrl: COACH_AVATARS.alex,
    categories: ['tech'],
    isDecoy: true,
  },
  {
    id: 'decoy-high-performance',
    slug: 'high-performance-mindset',
    title: 'High-Performance Mindset',
    description: 'Unlock peak mental performance with evidence-based techniques used by elite athletes and executives. Build unshakeable focus and resilience.',
    coverImageUrl: DECOY_IMAGES.mindset,
    coachName: 'Dr. Sarah Mitchell',
    coachAvatarUrl: COACH_AVATARS.sarah,
    categories: ['mindset'],
    isDecoy: true,
  },
  {
    id: 'decoy-wealth-building',
    slug: 'wealth-building-masterclass',
    title: 'Wealth Building Masterclass',
    description: 'Learn proven strategies to build lasting wealth through smart investing, passive income streams, and financial planning fundamentals.',
    coverImageUrl: DECOY_IMAGES.finance,
    coachName: 'Marcus Johnson',
    coachAvatarUrl: COACH_AVATARS.marcus,
    categories: ['money'],
    isDecoy: true,
  },
  {
    id: 'decoy-body-transformation',
    slug: '90-day-body-transformation',
    title: '90-Day Body Transformation',
    description: 'A complete fitness program combining strength training, nutrition coaching, and accountability to help you achieve your ideal physique.',
    coverImageUrl: DECOY_IMAGES.fitness,
    coachName: 'Jennifer Blake',
    coachAvatarUrl: COACH_AVATARS.jennifer,
    categories: ['health'],
    isDecoy: true,
  },
  {
    id: 'decoy-authentic-leadership',
    slug: 'authentic-leadership-program',
    title: 'Authentic Leadership Program',
    description: 'Develop your unique leadership style with executive coaching, team dynamics training, and real-world leadership challenges.',
    coverImageUrl: DECOY_IMAGES.leadership,
    coachName: 'David Park',
    coachAvatarUrl: COACH_AVATARS.david,
    categories: ['business'],
    isDecoy: true,
  },
];

/**
 * Get a decoy listing by its slug
 */
export function getDecoyBySlug(slug: string): DecoyListing | undefined {
  return DECOY_LISTINGS.find(d => d.slug === slug);
}

/**
 * Get all decoy listings
 */
export function getAllDecoys(): DecoyListing[] {
  return DECOY_LISTINGS;
}



