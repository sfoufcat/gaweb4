/**
 * Track-Specific Prompts Library
 * 
 * Provides track-specific prompts for the Dynamic Section.
 * Prompts are motivating, actionable, and specific to each track.
 * 
 * Format: title + short description (max 2 lines)
 */

import type { UserTrack, Task } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface TrackPrompt {
  title: string;
  description: string;
}

export interface StarterProgramContext {
  id: string | null;
  name: string | null;
  dayNumber: number | null;
}

// ============================================================================
// TRACK-SPECIFIC PROMPT POOLS
// Each track has a pool of prompts that rotate daily
// ============================================================================

const TRACK_PROMPTS: Record<UserTrack, TrackPrompt[]> = {
  content_creator: [
    { title: "Post + Iterate", description: "Try publishing 1 imperfect piece today." },
    { title: "Velocity Over Perfection", description: "Ship something — refine it tomorrow." },
    { title: "Engage 15 Minutes", description: "Reply to comments and DMs — build connection." },
    { title: "Repurpose Content", description: "Turn 1 piece into 3 formats today." },
    { title: "Document, Don't Create", description: "Share what you're already doing." },
    { title: "Hook First", description: "Spend 5 min making your opener irresistible." },
    { title: "Batch Content", description: "Create 3 posts in one focused session." },
  ],
  
  saas: [
    { title: "Ship Something Small", description: "20 minutes is enough for a micro-feature." },
    { title: "Talk to 1 User", description: "Short call or DM to understand their needs." },
    { title: "Fix 1 Friction Point", description: "Improve onboarding or a key flow." },
    { title: "Retention > Acquisition", description: "What makes users stay? Double down on that." },
    { title: "Dog-food Your Product", description: "Use it like a customer for 15 min." },
    { title: "Kill 1 Feature Idea", description: "Say no to something to stay focused." },
    { title: "Write a Changelog", description: "Document what you shipped this week." },
  ],
  
  coach_consultant: [
    { title: "Client Magnet", description: "Add 1 helpful story that educates your ideal client." },
    { title: "Post 1 Value Bomb", description: "Help before selling — share a quick win." },
    { title: "Reach Out to 1 Prospect", description: "DM or email someone who fits your ideal client." },
    { title: "Share a Client Win", description: "Social proof converts — celebrate results." },
    { title: "Clarify Your Offer", description: "Can you explain it in one sentence?" },
    { title: "Create a Quick Win", description: "What can you teach in 5 minutes?" },
    { title: "Ask for a Testimonial", description: "Past clients are your best marketing." },
  ],
  
  ecom: [
    { title: "Offer Awareness", description: "Share 1 small benefit about your best-selling product." },
    { title: "Touch 1 Pain Point", description: "Small effort, big signal — address customer friction." },
    { title: "Optimize 1 Ad/Page", description: "Tweak creative, copy, or offer on one SKU." },
    { title: "Customer Care", description: "Respond to reviews or messages — protect reputation." },
    { title: "Test a New Angle", description: "Try a different hook on your top product." },
    { title: "Bundle or Upsell", description: "Increase AOV with a simple add-on offer." },
    { title: "Check Your Numbers", description: "Review CAC, ROAS, or margins for 10 min." },
  ],
  
  agency: [
    { title: "Follow Up with 2 Leads", description: "Fast follow = revenue. Don't let them cool off." },
    { title: "Proactive Client Touch", description: "Send extra ideas or a quick loom to a client." },
    { title: "15 Min Outbound", description: "DMs, emails, or looms to high-fit prospects." },
    { title: "Document a Process", description: "Save future you time — write an SOP." },
    { title: "Ask for a Referral", description: "Happy clients know other potential clients." },
    { title: "Review Delivery Quality", description: "Is your best work going out the door?" },
    { title: "Delegate 1 Task", description: "What can someone else do 80% as well?" },
  ],
  
  community_builder: [
    { title: "Start a Thread", description: "Post a discussion prompt or question for your community." },
    { title: "Member Spotlight", description: "Highlight or thank an active member publicly." },
    { title: "Welcome New Members", description: "Personally greet newcomers to set the tone." },
    { title: "Listen & Respond", description: "Reply thoughtfully to 5 community posts." },
    { title: "Create a Ritual", description: "Start a weekly thread or recurring event." },
    { title: "Ask for Feedback", description: "What do members want more of?" },
    { title: "Check on a Quiet Member", description: "Reach out to someone who hasn't engaged lately." },
  ],
  
  general: [
    { title: "Deep Work Block", description: "Focus on your most important task without distraction." },
    { title: "Eliminate 1 Distraction", description: "What's pulling your attention? Remove it." },
    { title: "One Big Thing", description: "If you only do one thing today, make it this." },
    { title: "Review Your Week", description: "5 min reflection — what worked, what didn't?" },
    { title: "Move the Needle", description: "What small action creates the most momentum?" },
    { title: "Protect Your Energy", description: "Say no to something that drains you." },
    { title: "Learn Something New", description: "15 min of focused learning in your field." },
  ],
};

// ============================================================================
// PROMPT SELECTION LOGIC
// ============================================================================

/**
 * Get a deterministic daily index based on date
 * Returns a number that changes each day (consistent across the day)
 */
function getDailyIndex(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return dayOfYear;
}

/**
 * Get a track-specific prompt for today
 * 
 * The prompt selection is deterministic per day but varies by:
 * - Track (different prompt pools)
 * - Day of year (rotates through prompts)
 * 
 * @param track - User's business track
 * @param tasks - Optional: user's tasks to influence prompt selection (future enhancement)
 * @param starterProgram - Optional: starter program context (future enhancement)
 * @returns TrackPrompt with title and description
 */
export function getTrackPrompt(
  track: UserTrack | null,
  tasks?: Task[],
  starterProgram?: StarterProgramContext | null
): TrackPrompt {
  // Default to general track if no track is set
  const effectiveTrack: UserTrack = track || 'general';
  
  // Get prompts pool for this track
  const prompts = TRACK_PROMPTS[effectiveTrack];
  
  // Get today's index for deterministic daily rotation
  const dayIndex = getDailyIndex();
  
  // Select prompt based on day of year (rotates through all prompts)
  const promptIndex = dayIndex % prompts.length;
  
  return prompts[promptIndex];
}

/**
 * Get all prompts for a track (useful for previews/testing)
 */
export function getAllPromptsForTrack(track: UserTrack): TrackPrompt[] {
  return TRACK_PROMPTS[track] || TRACK_PROMPTS.general;
}

/**
 * Get a random prompt for a track (useful for refresh functionality)
 */
export function getRandomTrackPrompt(track: UserTrack | null): TrackPrompt {
  const effectiveTrack: UserTrack = track || 'general';
  const prompts = TRACK_PROMPTS[effectiveTrack];
  const randomIndex = Math.floor(Math.random() * prompts.length);
  return prompts[randomIndex];
}

/**
 * Get track display name for UI
 */
export function getTrackDisplayName(track: UserTrack | null): string {
  const names: Record<UserTrack, string> = {
    content_creator: 'Creator',
    saas: 'SaaS',
    coach_consultant: 'Coach',
    ecom: 'E-com',
    agency: 'Agency',
    community_builder: 'Community',
    general: 'Growth',
  };
  return track ? names[track] : 'Growth';
}

