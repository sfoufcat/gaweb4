/**
 * Guest Session Management
 * 
 * Handles guest session IDs for users going through the /start/* flow
 * before creating an account. Data is stored locally and synced to Firebase.
 */

const GUEST_SESSION_KEY = 'ga_guest_session_id';
const GUEST_DATA_KEY = 'ga_guest_data';
const GUEST_STEP_KEY = 'ga_guest_step';

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get or create a guest session ID
 * Stored in both localStorage and cookie for redundancy
 */
export function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  // Try to get existing session ID
  let sessionId = localStorage.getItem(GUEST_SESSION_KEY);
  
  // Also check cookie as backup
  if (!sessionId) {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === GUEST_SESSION_KEY) {
        sessionId = value;
        break;
      }
    }
  }

  // Create new session if none exists
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(GUEST_SESSION_KEY, sessionId);
    // Set cookie for 30 days
    document.cookie = `${GUEST_SESSION_KEY}=${sessionId}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
  } else {
    // Ensure both storage methods have the session ID
    localStorage.setItem(GUEST_SESSION_KEY, sessionId);
    document.cookie = `${GUEST_SESSION_KEY}=${sessionId}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
  }

  return sessionId;
}

/**
 * Get the current guest session ID (without creating one)
 */
export function getGuestSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  let sessionId = localStorage.getItem(GUEST_SESSION_KEY);
  
  if (!sessionId) {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === GUEST_SESSION_KEY) {
        sessionId = value;
        break;
      }
    }
  }

  return sessionId;
}

/**
 * Clear the guest session (after account is created)
 */
export function clearGuestSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(GUEST_SESSION_KEY);
  localStorage.removeItem(GUEST_DATA_KEY);
  document.cookie = `${GUEST_SESSION_KEY}=; path=/; max-age=0`;
  document.cookie = `${GUEST_STEP_KEY}=; path=/; max-age=0`;
}

/**
 * Guest onboarding data structure
 */
export interface GuestOnboardingData {
  // Quiz answers (original flow)
  workdayStyle?: 'chaotic' | 'busy' | 'productive' | 'disciplined';
  peerAccountability?: string;
  businessStage?: string;
  goalImpact?: string[];
  supportNeeds?: string[];
  
  // Commitment answers
  accountability?: boolean;
  readyToInvest?: boolean;
  
  // Mission & Goal
  mission?: string;
  goal?: string;
  goalTargetDate?: string;
  
  // User info (collected before payment)
  firstName?: string;
  lastName?: string;
  email?: string;
  
  // Plan selection
  selectedPlan?: 'trial' | 'standard' | 'premium';
  
  // Payment status (set after Stripe checkout)
  paymentStatus?: 'pending' | 'completed';
  
  // Current step tracking
  currentStep?: string;
  
  // Abandoned email tracking
  abandonedEmailSent?: boolean;
  abandonedEmailSentAt?: string;
  
  // Geo tracking (detected via Vercel headers)
  country?: string; // 2-letter ISO country code
  
  // Prefetched chart summaries (generated during analyzing step)
  goalSummary?: string;
  accountabilitySummary?: string;
  
  // Starting point for transformation graph
  startingPoint?: string;
  startingPointSummary?: string;
  
  // Track preselection (from funnel URL ?track=xxx)
  preselectedTrack?: 'content_creator' | 'saas' | 'coach_consultant' | 'ecom' | 'agency' | 'community_builder' | 'general';
  
  // ==========================================================================
  // CONTENT CREATOR QUIZ ANSWERS
  // ==========================================================================
  
  // Creator type & stage
  creatorType?: string;
  creatorStage?: string;
  mainPlatform?: string;
  primary90DayGoal?: string;
  dreamOutcome?: string; // Legacy - replaced by lastMeaningfulGrowth
  
  // Growth tracking
  lastMeaningfulGrowth?: string;
  followerGrowthFrequency?: string;
  currentHabits?: string[]; // Multi-select array
  
  // Content creation & publishing
  contentStruggles?: string[]; // Multi-select array
  contentCreationMethod?: string;
  weeklyPublishingVolume?: string;
  contentTypes?: string[];
  
  // Content habits
  postingFrequency?: string;
  consistencyPattern?: string;
  timeAvailable?: string;
  biggestBottleneck?: string;
  cameraComfort?: string;
  
  // Audience & growth
  currentAudienceSize?: string;
  audienceGoal90Days?: string;
  hasOffer?: string;
  
  // Style & preferences
  contentStyle?: string; // Legacy - replaced by contentStyleRatings
  contentStyleRatings?: string; // JSON string of swipe card ratings: Record<string, 'dislike' | 'neutral' | 'like'>
  energyBurnout?: string;
  networkConnection?: string;
  organizationLevel?: string;
  
  // Mindset statements (agree/disagree/neutral)
  overthinkStatement?: string;
  comparisonStatement?: string;
  clientWorkStatement?: string;
  
  // Schedule & commitment
  bestTimeToCreate?: string;
  commitmentLevel?: string;
  finalCommitment?: string;
  
  // Quiz completion tracking
  contentCreatorQuizCompleted?: boolean;
  contentCreatorQuizStep?: number;
  
  // Goal setting flow
  goalReturnStepIndex?: string; // Step to return to after custom goal setting (stored as string)
  customGoal?: string; // User's custom goal text
}

/**
 * Save guest data locally
 * This provides immediate persistence while the API call syncs to Firebase
 * Also updates the step cookie for middleware to read
 */
export function saveGuestDataLocally(data: Partial<GuestOnboardingData>): GuestOnboardingData {
  if (typeof window === 'undefined') {
    return data as GuestOnboardingData;
  }

  const existing = getGuestDataLocally();
  const updated = { ...existing, ...data };
  localStorage.setItem(GUEST_DATA_KEY, JSON.stringify(updated));
  
  // Update step cookie for middleware access (server-side redirect support)
  if (data.currentStep) {
    document.cookie = `${GUEST_STEP_KEY}=${data.currentStep}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
  }
  
  return updated;
}

/**
 * Get guest data from local storage
 */
export function getGuestDataLocally(): GuestOnboardingData {
  if (typeof window === 'undefined') {
    return {};
  }

  const data = localStorage.getItem(GUEST_DATA_KEY);
  return data ? JSON.parse(data) : {};
}

/**
 * Save guest data to Firebase via API
 */
export async function saveGuestDataToFirebase(
  sessionId: string,
  data: Partial<GuestOnboardingData>
): Promise<boolean> {
  try {
    const response = await fetch('/api/guest/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...data }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to save guest data to Firebase:', error);
    return false;
  }
}

/**
 * Get guest data from Firebase via API
 */
export async function getGuestDataFromFirebase(
  sessionId: string
): Promise<GuestOnboardingData | null> {
  try {
    const response = await fetch(`/api/guest/session?sessionId=${sessionId}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.session || null;
  } catch (error) {
    console.error('Failed to get guest data from Firebase:', error);
    return null;
  }
}

