// User Role Types
export type UserRole = 'user' | 'editor' | 'coach' | 'admin' | 'super_admin';

// Organization Role Types (for multi-tenant role hierarchy within an organization)
// super_coach: Organization leader (owns the org, can manage all members)
// coach: Can coach squads within the organization
// member: Regular organization member (client)
export type OrgRole = 'super_coach' | 'coach' | 'member';

/**
 * Track Types - Business type the user is building
 * @deprecated FULLY DEPRECATED - Tracks have been replaced by coach-defined Programs.
 * This type is kept ONLY for backward compatibility with legacy code.
 * Do NOT use in new code - use Program entities instead.
 */
export type UserTrack = 
  | 'content_creator' 
  | 'saas' 
  | 'coach_consultant' 
  | 'ecom' 
  | 'agency' 
  | 'community_builder'
  | 'general'; // Legacy fallback

// User Tier Types (for subscription/access level - does NOT include coaching)
// Coaching is a separate product, not a membership tier
export type UserTier = 'free' | 'standard' | 'premium';

// Coaching Status Types (separate from membership tier)
export type CoachingStatus = 'none' | 'active' | 'canceled' | 'past_due';
export type CoachingPlan = 'monthly' | 'quarterly' | null;

// Clerk Public Metadata Type (for type assertions with sessionClaims)
// This is the SINGLE SOURCE OF TRUTH for user access control
// NOTE: Multi-org architecture - tier/track/orgRole are now per-org in Firestore org_memberships
export interface ClerkPublicMetadata {
  role?: UserRole;                    // Platform role (for super_admins only)
  primaryOrganizationId?: string;     // Last active / default organization
  // Legacy fields - kept for backward compatibility during migration
  // track field REMOVED - tracks fully deprecated
  tier?: UserTier;                    // @deprecated - now per-org in org_memberships
  orgRole?: OrgRole;                  // @deprecated - now per-org in org_memberships
  organizationId?: string;            // @deprecated - use primaryOrganizationId
  // Coaching fields (separate from membership tier)
  coaching?: boolean;         // Legacy flag - true if has active coaching
  coachingStatus?: CoachingStatus;  // Detailed coaching status
  coachingPlan?: CoachingPlan;      // Coaching plan type
  coachingPeriodEnd?: string;       // ISO date when coaching access ends
  coachId?: string;           // Assigned coach's userId (for 1:1 coaching)
  // Billing
  billingStatus?: BillingStatus;
  billingPeriodEnd?: string;  // ISO date for grace period checks
}

// Clerk User Types
export interface ClerkUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  publicMetadata?: ClerkPublicMetadata;
}

// Onboarding Status Types
export type OnboardingStatus = 
  | 'welcome' 
  | 'workday'
  | 'obstacles'
  | 'business_stage'
  | 'goal_impact'
  | 'support_needs'
  | 'create_profile_intro' 
  | 'edit_profile' 
  | 'mission' 
  | 'goal' 
  | 'transformation'
  | 'plan'
  | 'completed';

// Onboarding Quiz Types
export type WorkdayStyle = 'chaotic' | 'busy' | 'productive' | 'disciplined';
export type BusinessStage = 'just_starting' | 'building_momentum' | 'growing_steadily' | 'leveling_up' | 'reinventing';
export type GoalImpactLevel = 'transformational' | 'a_lot' | 'somewhat' | 'a_little';

export type PeerAccountability = 
  | 'alone'
  | 'no_daily_system'
  | 'inconsistent'
  | 'strong_accountability';

export type OnboardingSupportNeed = 
  | 'daily_checkins'
  | 'accountability'
  | 'clear_system'
  | 'expert_guidance'
  | 'inspiration';

// Onboarding Quiz Data
export interface OnboardingQuizData {
  workdayStyle?: WorkdayStyle;
  peerAccountability?: PeerAccountability;
  businessStage?: BusinessStage;
  goalImpact?: GoalImpactLevel;
  supportNeeds?: OnboardingSupportNeed[];
}

// Billing Types
export type BillingPlan = 'standard' | 'premium' | null;
export type BillingStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | null;

export interface BillingInfo {
  plan: BillingPlan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: BillingStatus;
  currentPeriodEnd?: string; // ISO date when current billing period ends
  cancelAtPeriodEnd?: boolean; // True if subscription will cancel at period end
  startedWithTrial?: boolean; // True if user started with the $9.99/week trial before converting to monthly
}

// Coaching subscription info (separate from main membership billing)
export interface CoachingInfo {
  status: CoachingStatus;
  plan: CoachingPlan;
  stripeSubscriptionId?: string;
  startedAt?: string; // ISO date when coaching started
  endsAt?: string; // ISO date when coaching access ends (for canceled)
  coachPreference?: string; // Selected coach preference during intake
}

// Firebase User Types
export interface FirebaseUser extends ClerkUser {
  // Add any additional fields specific to your Firebase users
  bio?: string;
  preferences?: UserPreferences;
  
  // Organization - synced from Clerk webhook
  primaryOrganizationId?: string; // User's primary organization ID
  identity?: string;
  identitySetAt?: string;
  identityHistory?: IdentityHistoryEntry[];
  goal?: string;
  goalTargetDate?: string;
  goalSetAt?: string;
  goalProgress?: number; // User-entered progress percentage (0-100)
  goalIsAISuggested?: boolean;
  goalHistory?: GoalHistoryEntry[];
  // NOTE: role is NOW stored in Clerk publicMetadata, not Firebase
  // Access via: user.publicMetadata?.role
  
  // Squad membership - Dual squad support for premium users
  // Premium users can be in both a standard and premium squad simultaneously
  squadId?: string | null; // @deprecated - Legacy field, use standardSquadId/premiumSquadId instead
  standardSquadId?: string | null; // Standard (non-premium) squad membership
  premiumSquadId?: string | null; // Premium squad membership (requires premium tier)
  
  tier?: UserTier; // User subscription tier (defaults to 'standard')
  // track field removed - tracks deprecated in favor of Programs
  
  // Referral tracking (set when user joins via invite link)
  invitedBy?: string; // User ID of who invited them
  inviteCode?: string; // The invite code they used
  invitedAt?: string; // ISO timestamp when they joined via invite
  
  // Onboarding
  onboardingStatus?: OnboardingStatus; // Track onboarding progress
  hasCompletedOnboarding?: boolean; // Quick check for completed onboarding
  onboarding?: OnboardingQuizData; // Quiz answers from onboarding flow
  
  // Billing
  billing?: BillingInfo; // Stripe billing information
  
  // Coaching (separate from membership billing)
  coaching?: CoachingInfo; // Coaching subscription info
  coachId?: string | null; // Assigned coach's user ID
  
  // Email tracking for onboarding flows
  quizStarted?: boolean; // True when user starts the quiz
  quizStartedAt?: string; // ISO timestamp when quiz was started
  convertedToMember?: boolean; // True when user successfully pays
  abandonedEmailSent?: boolean; // True when abandoned cart email was sent
  welcomeEmailSent?: boolean; // True when welcome email was sent
  
  // Home Tutorial
  hasCompletedHomeTutorial?: boolean; // True when user completes the home page tutorial

  // Profile fields
  name?: string; // Display name (can differ from firstName + lastName)
  avatarUrl?: string; // Profile picture URL (overrides Clerk imageUrl if set)
  location?: string; // e.g., "Berlin, DE"
  profession?: string; // Job title, e.g., "Software Engineer"
  company?: string; // Company name, e.g., "Acme Corporation"
  interests?: string; // Comma-separated or free text
  instagramHandle?: string;
  linkedinHandle?: string;
  twitterHandle?: string; // X/Twitter
  websiteUrl?: string;
  phoneNumber?: string;
  
  // Weekly Reflection fields
  publicFocus?: string; // Public focus for next week (from weekly reflection)
  publicFocusSummary?: string; // AI-generated 2-5 word summary of publicFocus
  publicFocusUpdatedAt?: string; // When publicFocus was last updated
  goalCompleted?: boolean; // Whether the goal has been completed
  goalCompletedAt?: string; // When the goal was completed
  
  // Program Completion Check-in fields
  pendingProgramCheckIn?: boolean; // True when user just completed a program and needs check-in
  programCheckInDismissedAt?: string; // ISO timestamp when user dismissed check-in (show prompt for 24h)
  lastCompletedProgramId?: string; // ID of the most recently completed program
  lastCompletedProgramName?: string; // Name of the most recently completed program
  
  // Notification preferences
  notificationPreferences?: NotificationPreferences;
  emailPreferences?: EmailPreferences; // User's email notification preferences
  timezone?: string; // IANA timezone e.g. "Europe/Amsterdam" for notification scheduling
}

export interface IdentityHistoryEntry {
  statement: string;
  setAt: string;
}

export interface GoalHistoryEntry {
  goal: string;
  targetDate: string;
  setAt: string;
  progress: number; // Final progress when archived/completed
  completedAt: string | null; // Set when goal was completed (100%)
  archivedAt: string | null; // Set when goal was archived (not completed)
}

// Habit Types
export type FrequencyType = 
  | 'daily'
  | 'weekly_specific_days'
  | 'weekly_number'
  | 'monthly_specific_days'
  | 'monthly_number';

export interface HabitReminder {
  time: string; // HH:MM format
}

export interface HabitProgress {
  currentCount: number;
  lastCompletedDate: string | null;
  completionDates: string[]; // ISO dates of all completions
  skipDates?: string[]; // ISO dates of all skips
}

export type HabitStatus = 'active' | 'completed' | 'archived';

// Source of the habit - used to track how the habit was created
export type HabitSource = 'track_default' | 'program_default' | 'user';

export interface Habit {
  id: string;
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  text: string;
  linkedRoutine?: string;
  frequencyType: FrequencyType;
  frequencyValue: number[] | number; // array for specific days, number for count
  reminder: HabitReminder | null;
  targetRepetitions?: number | null; // null means "No limit"
  progress: HabitProgress;
  archived: boolean; // Legacy field, keep for backward compatibility
  status?: HabitStatus; // New field: 'active', 'completed', or 'archived'
  source?: HabitSource; // 'track_default' = pre-loaded from track, 'user' = manually created
  trackDefaultId?: string; // Original template ID if source is 'track_default' (e.g., 'creator_publish')
  createdAt: string;
  updatedAt: string;
}

export type HabitFormData = {
  text: string;
  linkedRoutine: string;
  frequencyType: FrequencyType;
  frequencyValue: number[] | number;
  reminder: HabitReminder | null;
  targetRepetitions: number | null;
}

export type CreateHabitRequest = HabitFormData

export interface UserPreferences {
  theme?: 'light' | 'dark';
  notifications?: boolean;
  emailUpdates?: boolean;
}

// Stream Chat Types
export interface StreamUser {
  id: string;
  name: string;
  image?: string;
}

export interface StreamTokenResponse {
  token: string;
  userId: string;
}

// API Response Types
export interface ApiError {
  error: string;
  message?: string;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// Identity Validation Types
export interface ValidationResult {
  isValid: boolean;
  reasoning?: string;
  suggestion?: string;
}

export interface IdentitySaveResponse {
  success: boolean;
  identity: string;
  setAt: string;
}

// Goal Validation Types
export interface GoalValidationResult {
  status: 'good' | 'needs_improvement';
  feedback?: string;
  suggestedGoal?: string;
  goalSummary?: string; // 1-2 word summary like "Revenue Growth", "Weight Loss"
}

export interface GoalSaveResponse {
  success: boolean;
  goal: string;
  targetDate: string;
  setAt: string;
}

// Task Types
export type TaskStatus = 'pending' | 'completed';
export type TaskListType = 'focus' | 'backlog';
export type TaskSourceType = 'user' | 'program';

export interface Task {
  id: string;
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  title: string;
  status: TaskStatus;
  listType: TaskListType;
  order: number;
  date: string; // ISO date (YYYY-MM-DD)
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  // Program-related fields
  sourceType?: TaskSourceType; // 'user' | 'program' - defaults to 'user'
  programEnrollmentId?: string | null; // FK to starter_program_enrollments
  programDayIndex?: number | null; // Which program day this task came from
}

export interface TaskFormData {
  title: string;
  isPrivate: boolean;
  listType?: TaskListType;
}

export interface CreateTaskRequest extends TaskFormData {
  date: string;
  // Program-related fields (optional, used by program engine)
  sourceType?: TaskSourceType;
  programEnrollmentId?: string;
  programDayIndex?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  status?: TaskStatus;
  listType?: TaskListType;
  order?: number;
  isPrivate?: boolean;
}

// ============================================================================
// STARTER PROGRAM SYSTEM TYPES
// @deprecated - Use the new Program system types below instead
// These types are kept for backward compatibility during migration
// ============================================================================

/**
 * Task template within a program day
 * These are templates that get instantiated as real Task records
 * @deprecated Use ProgramDay.tasks with the new Program system
 */
export interface ProgramTaskTemplate {
  label: string; // Task title that shows in the app
  type?: 'task' | 'habit' | 'learning' | 'admin'; // Optional categorization
  isPrimary: boolean; // If true, pushed to Daily Focus (if room); otherwise Backlog
  estimatedMinutes?: number; // Optional time estimate
  notes?: string; // Optional guidance/context
  tag?: string; // Optional tag (e.g., "content", "mindset", "systems")
}

/**
 * A single day within a starter program
 * Contains the task templates for that day
 * @deprecated Use ProgramDay with the new Program system
 */
export interface StarterProgramDay {
  id: string;
  programId: string;
  dayIndex: number; // 1-based: 1..length_days
  title?: string; // Optional title/theme for the day (e.g., "Clarify your niche")
  summary?: string; // 1-2 lines internal description
  dailyPrompt?: string; // Optional track-specific encouragement/explanation
  tasks: ProgramTaskTemplate[];
  habits?: ProgramHabitTemplate[]; // Optional habits (typically Day 1 defines program defaults)
  createdAt: string;
  updatedAt: string;
}

/**
 * A starter program template
 * Defines a multi-day program for a specific track
 * @deprecated Use Program with the new Program system
 */
export interface StarterProgram {
  id: string;
  track: UserTrack; // Which track this program is for
  slug: string; // e.g., "content-creator-30-day-start"
  name: string; // e.g., "Content Creator – 30 Day Jumpstart"
  description: string; // Short copy describing the program
  lengthDays: number; // e.g., 30
  programOrder: number; // Order in sequence (1 = first program, 2 = second, etc.)
  isDefaultForTrack: boolean; // Whether to auto-enroll new users of that track (deprecated - use programOrder: 1)
  defaultHabits?: ProgramHabitTemplate[]; // Default habits for users enrolled in this program
  isActive?: boolean; // Whether program is active/visible (default true)
  organizationId?: string; // Clerk Organization ID for multi-tenancy
  createdAt: string;
  updatedAt: string;
}

/**
 * User's enrollment in a starter program
 * @deprecated Use ProgramEnrollment with the new Program system
 */
export type ProgramEnrollmentStatus = 'active' | 'completed' | 'stopped';

/**
 * @deprecated Use ProgramEnrollment with the new Program system
 */
export interface StarterProgramEnrollment {
  id: string;
  userId: string;
  programId: string;
  startedAt: string; // ISO date when enrollment started
  status: ProgramEnrollmentStatus;
  lastAssignedDayIndex: number; // Last program day that was used to generate tasks
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PROGRAM SYSTEM TYPES (New - replaces Track/StarterProgram)
// ============================================================================

/**
 * Program type - group (with cohorts/squads) or individual (1:1 coaching)
 */
export type ProgramType = 'group' | 'individual';

/**
 * Program enrollment status
 * - upcoming: Paid but cohort/program hasn't started yet
 * - active: Currently in progress
 * - completed: Program finished
 * - stopped: User left early or was removed
 */
export type NewProgramEnrollmentStatus = 'upcoming' | 'active' | 'completed' | 'stopped';

/**
 * Program - Coach-defined content template
 * Replaces the Track + StarterProgram concepts
 * Stored in Firestore 'programs' collection
 */
export interface Program {
  id: string;
  organizationId: string; // Clerk Organization ID (multi-tenant)
  
  // Basic info
  name: string;
  slug: string; // URL-friendly identifier
  description: string;
  coverImageUrl?: string; // Hero/cover image
  
  // Type and settings
  type: ProgramType; // 'group' | 'individual'
  lengthDays: number; // Duration in days
  
  // Pricing
  priceInCents: number; // 0 = free
  currency: string; // 'usd', 'eur', etc.
  stripePriceId?: string; // Stripe Price ID for checkout
  
  // Group program settings (only applicable when type = 'group')
  squadCapacity?: number; // Max members per squad (e.g., 10)
  coachInSquads?: boolean; // Whether coach joins each squad
  
  // Content
  defaultHabits?: ProgramHabitTemplate[]; // Default habits for enrolled users
  
  // Status
  isActive: boolean; // Whether program can accept enrollments
  isPublished: boolean; // Whether visible in Discover
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Program day content - tasks and habits for a specific day
 * Stored in Firestore 'program_days' collection
 */
export interface ProgramDay {
  id: string;
  programId: string;
  dayIndex: number; // 1-based: 1..lengthDays
  title?: string; // Optional title/theme (e.g., "Clarify your niche")
  summary?: string; // 1-2 lines description
  dailyPrompt?: string; // Encouragement/explanation for the day
  tasks: ProgramTaskTemplate[];
  habits?: ProgramHabitTemplate[]; // Optional habits (typically Day 1)
  createdAt: string;
  updatedAt: string;
}

/**
 * Program cohort - Time-based instance of a group program
 * Only used for group programs (type = 'group')
 * Stored in Firestore 'program_cohorts' collection
 */
export interface ProgramCohort {
  id: string;
  programId: string;
  organizationId: string; // Denormalized for queries
  
  // Cohort info
  name: string; // e.g., "March 2025", "Spring Cohort"
  startDate: string; // ISO date when cohort starts
  endDate: string; // ISO date when cohort ends
  
  // Enrollment settings
  enrollmentOpen: boolean; // Whether new users can join
  maxEnrollment?: number; // Optional cap on total cohort size
  currentEnrollment: number; // Current number of enrollees
  
  // Lifecycle
  status: 'upcoming' | 'active' | 'completed' | 'archived';
  gracePeriodEndDate?: string; // When squad closes (7 days after endDate)
  closingNotificationSent?: boolean; // Whether closing notification was sent
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Program enrollment - User's enrollment in a program
 * Stored in Firestore 'program_enrollments' collection
 */
export interface ProgramEnrollment {
  id: string;
  userId: string;
  programId: string;
  organizationId: string; // Denormalized for queries
  
  // For group programs
  cohortId?: string | null; // FK to program_cohorts
  squadId?: string | null; // FK to squads (auto-assigned)
  
  // Payment
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  paidAt?: string; // ISO timestamp when payment completed
  amountPaid: number; // Amount in cents
  
  // Progress
  status: NewProgramEnrollmentStatus;
  startedAt: string; // ISO date when enrollment becomes active
  completedAt?: string; // ISO timestamp when completed
  stoppedAt?: string; // ISO timestamp if stopped early
  lastAssignedDayIndex: number; // Last program day with generated tasks
  currentDayIndex?: number; // Current day user is on (calculated)
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Program with enrollment counts for admin views
 */
export interface ProgramWithStats extends Program {
  totalEnrollments: number;
  activeEnrollments: number;
  cohortCount?: number; // For group programs
}

/**
 * Cohort with squad info for admin views
 */
export interface CohortWithSquads extends ProgramCohort {
  squads: Array<{
    id: string;
    name: string;
    memberCount: number;
    capacity: number;
  }>;
}

// ============================================================================
// TRACK CMS TYPES (Admin-managed) - DEPRECATED: Use Program types above
// ============================================================================

/**
 * Track definition - stored in Firestore 'tracks' collection
 * Replaces hard-coded track labels and configurations
 */
/**
 * Weekly focus defaults per week number
 * Maps week number (1-4+) to suggested focus string
 */
export interface WeeklyFocusDefaults {
  [week: number]: string;
}

export interface Track {
  id: string;
  slug: UserTrack; // e.g., "content_creator", "saas"
  name: string; // e.g., "Content Creator", "SaaS Founder"
  description: string; // Admin description
  habitLabel: string; // e.g., "Creator habits" - shown in Habits section header
  programBadgeLabel: string; // e.g., "Creator starter program" - shown near Daily Focus
  defaultHabits?: Array<{ title: string; description?: string }>; // Default habits for the track
  weeklyFocusDefaults?: WeeklyFocusDefaults; // Week-based default focus strings
  isActive: boolean;
  organizationId?: string; // Clerk Organization ID for multi-tenancy
  createdAt: string;
  updatedAt: string;
}

/**
 * Default habit template for a track
 * Stored as array in Track or separate collection
 */
export interface TrackDefaultHabit {
  id: string;
  trackId: string; // FK to tracks
  title: string;
  description?: string;
  frequency: 'daily' | 'weekday' | 'custom';
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dynamic prompt types for Daily Dynamics section
 */
export type DynamicPromptType = 'morning' | 'evening' | 'weekly';
export type DynamicPromptSlot = 'goal' | 'prompt' | 'quote';

/**
 * Dynamic prompt - stored in Firestore 'dynamic_prompts' collection
 * Used in Daily Dynamics section with track-specific and fallback prompts
 */
export interface DynamicPrompt {
  id: string;
  trackId: string | null; // FK to tracks, null for generic/fallback prompts
  type: DynamicPromptType; // 'morning' | 'evening' | 'weekly'
  slot: DynamicPromptSlot; // 'goal' | 'prompt' | 'quote'
  title?: string; // Optional title
  body: string; // Main content (text/markdown)
  priority: number; // Lower = higher priority for ordering/fallback
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extended StarterProgramDay with habits support
 * Habits are stored in the program day (typically Day 1 defines default habits)
 */
export interface ProgramHabitTemplate {
  title: string;
  description?: string;
  frequency: 'daily' | 'weekday' | 'custom';
}

// Squad Types
export type SquadRoleInSquad = 'member' | 'coach';
export type MoodState = 'energized' | 'confident' | 'neutral' | 'uncertain' | 'stuck';
export type SquadVisibility = 'public' | 'private';
export type SquadType = 'premium' | 'standard'; // For dual squad membership

export interface Squad {
  id: string;
  name: string;
  avatarUrl: string;
  description?: string; // Optional squad description
  visibility?: SquadVisibility; // "public" or "private" - defaults to "public" if not set
  timezone?: string; // IANA timezone e.g. "Europe/Amsterdam" - defaults to "UTC"
  memberIds?: string[]; // Array of member user IDs (excludes coach)
  inviteCode?: string; // e.g. "GA-XY29Q8" - required for private squads
  isPremium: boolean;
  coachId: string | null; // Required if premium
  organizationId?: string; // Clerk Organization ID for multi-tenancy (coach's organization)
  createdAt: string;
  updatedAt: string;
  streak?: number | null; // Squad streak (consecutive days with >=50% members fully aligned)
  avgAlignment?: number | null; // Average alignment score of members today
  chatChannelId?: string | null; // Stream Chat channel ID for squad group chat
  // Cached stats for performance - with 5-minute TTL + invalidation on alignment change
  cachedAvgAlignment?: number;
  cachedAlignmentChange?: number;
  cachedMemberAlignments?: Record<string, { alignmentScore: number; currentStreak: number }>;
  cachedAt?: string; // Date string (YYYY-MM-DD) when cache was last updated
  cachedAtTimestamp?: string; // ISO timestamp for TTL checking (5-minute freshness)
  // Premium squad call fields
  nextCallDateTime?: string | null; // ISO 8601 timestamp (stored in UTC)
  nextCallTimezone?: string | null; // IANA timezone e.g. "America/New_York"
  nextCallLocation?: string | null; // e.g. "Squad chat", "Zoom", a URL
  nextCallTitle?: string | null; // Optional custom title, defaults to "Squad coaching call"
  // Track association - @deprecated, use programId/cohortId instead
  trackId?: UserTrack | null;
  // Program/Cohort association (new system)
  programId?: string | null; // FK to programs collection
  cohortId?: string | null; // FK to program_cohorts collection
  capacity?: number; // Max members (overrides program's squadCapacity if set)
  // Auto-created squad info
  isAutoCreated?: boolean; // True if created automatically by enrollment system
  squadNumber?: number; // Sequential number within cohort (e.g., 1, 2, 3)
  // Lifecycle management
  gracePeriodMessageSent?: boolean; // True if grace period notification was sent
  gracePeriodStartDate?: string; // Date when grace period started (YYYY-MM-DD)
  isClosed?: boolean; // True if squad is archived/closed
  closedAt?: string; // ISO timestamp when squad was closed
}

export interface SquadMember {
  id: string;
  squadId: string;
  userId: string;
  roleInSquad: SquadRoleInSquad;
  // User details (denormalized for display)
  firstName: string;
  lastName: string;
  imageUrl: string;
  // TODO: Real calculations will be implemented later
  alignmentScore?: number | null; // Placeholder
  streak?: number | null; // Placeholder
  moodState?: MoodState | null; // Placeholder
  createdAt: string;
  updatedAt: string;
}

export interface ContributionDay {
  date: string; // ISO date YYYY-MM-DD
  completionRate: number; // 0-100 percentage of squad members who completed tasks
}

export interface SquadStats {
  avgAlignment: number; // 0-100
  alignmentChange: number; // e.g., +2.3 or -1.5
  topPercentile: number; // e.g., 1 for "top 1%"
  contributionHistory: ContributionDay[]; // Last 30-60 days
}

// Morning Check-In Types
export type EmotionalState = 
  | 'low_stuck' 
  | 'uneasy' 
  | 'uncertain' 
  | 'neutral' 
  | 'steady' 
  | 'confident' 
  | 'energized';

export interface MorningCheckIn {
  id: string;
  date: string; // YYYY-MM-DD
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  emotionalState: EmotionalState;
  userThought?: string; // What user typed/spoke in reframe step
  aiReframe?: string; // AI's reframed thought
  manifestIdentityCompleted: boolean;
  manifestGoalCompleted: boolean;
  tasksPlanned: boolean;
  completedAt?: string; // ISO timestamp when flow was completed
  createdAt: string;
  updatedAt: string;
}

export interface CheckInProgress {
  currentStep: CheckInStep;
  emotionalState?: EmotionalState;
  userThought?: string;
  aiReframe?: string;
  breathingCompleted?: boolean;
  manifestIdentityCompleted?: boolean;
  manifestGoalCompleted?: boolean;
}

export type CheckInStep = 
  | 'start'
  | 'accept'
  | 'breath'
  | 'reframe'
  | 'neutralize'
  | 'manifest-identity'
  | 'manifest-goal'
  | 'plan-day'
  | 'completed';

// Reflection Types
export type ReflectionType = 'daily' | 'weekly';

// Combined emotional state type for reflections (supports both morning and evening)
export type ReflectionEmotionalState = EmotionalState | EveningEmotionalState;

export interface DailyReflection {
  id: string;
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  goalId: string;
  type: 'daily';
  date: string; // ISO date YYYY-MM-DD
  emotionalState: ReflectionEmotionalState;
  tasksCompleted: number;
  tasksTotal: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReflection {
  id: string;
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  goalId: string;
  type: 'weekly';
  date: string; // ISO date YYYY-MM-DD (start of week)
  weekEndDate: string; // ISO date YYYY-MM-DD (end of week)
  progressChange: number; // e.g., +12 or -5
  onTrackStatus: 'on_track' | 'not_sure' | 'off_track';
  whatWentWell: string;
  biggestObstacles: string;
  nextWeekPlan: string;
  publicFocus?: string; // Public focus for next week
  createdAt: string;
  updatedAt: string;
}

// Weekly Reflection Check-in Types (for the flow)
export type OnTrackStatus = 'on_track' | 'not_sure' | 'off_track';

export interface WeeklyReflectionCheckIn {
  id: string;
  date: string; // YYYY-MM-DD (week identifier)
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  onTrackStatus: OnTrackStatus;
  progress: number; // 0-100 progress percentage
  previousProgress: number; // Previous progress for calculating change
  whatWentWell?: string;
  biggestObstacles?: string;
  nextWeekPlan?: string;
  publicFocus?: string; // Public focus shared on profile
  goalCompleted?: boolean; // True if progress = 100
  completedAt?: string; // ISO timestamp when flow was completed
  createdAt: string;
  updatedAt: string;
}

export type Reflection = DailyReflection | WeeklyReflection;

// Goal with progress (extended from user data)
export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetDate: string;
  progress: number; // 0-100
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

// Evening Check-In Types
export type EveningEmotionalState = 
  | 'tough_day' 
  | 'mixed' 
  | 'steady' 
  | 'good_day' 
  | 'great_day';

export interface EveningCheckIn {
  id: string;
  date: string; // YYYY-MM-DD
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  emotionalState: EveningEmotionalState;
  reflectionText?: string; // Optional reflection note
  tasksCompleted: number;
  tasksTotal: number;
  completedAt?: string; // ISO timestamp when flow was completed
  createdAt: string;
  updatedAt: string;
}

// Daily Alignment & Streak Types
export interface UserAlignment {
  id: string; // Format: `${organizationId}_${userId}_${YYYY-MM-DD}`
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  date: string; // "YYYY-MM-DD" — normalized date
  didMorningCheckin: boolean;
  didSetTasks: boolean;
  didInteractWithSquad: boolean;
  hasActiveGoal: boolean;
  alignmentScore: number; // 0, 25, 50, 75, 100
  fullyAligned: boolean; // alignmentScore === 100
  streakOnThisDay: number; // integer >= 0, streak snapshot for that day
  createdAt: string;
  updatedAt: string;
}

export interface UserAlignmentSummary {
  id: string; // Format: `${organizationId}_${userId}`
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  currentStreak: number; // consecutive days with fullyAligned true
  lastAlignedDate?: string; // last date with fullyAligned true (YYYY-MM-DD)
  updatedAt: string;
}

export interface AlignmentUpdatePayload {
  didMorningCheckin?: boolean;
  didSetTasks?: boolean;
  didInteractWithSquad?: boolean;
  hasActiveGoal?: boolean;
}

export interface AlignmentState {
  alignment: UserAlignment | null;
  summary: UserAlignmentSummary | null;
  isLoading: boolean;
  error: string | null;
}

// Squad Alignment Types
export interface SquadAlignmentDay {
  squadId: string;
  date: string; // "YYYY-MM-DD"
  fractionFullyAligned: number; // 0.0 to 1.0
  numFullyAligned: number;
  totalMembers: number;
  kept: boolean; // fractionFullyAligned >= 0.5
  createdAt: string;
  updatedAt: string;
}

export interface SquadAlignmentSummary {
  squadId: string;
  currentStreak: number; // consecutive kept days
  lastKeptDate?: string; // last date where >=50% fullyAligned
  updatedAt: string;
}

// Notification Types
export type NotificationType =
  | 'morning_checkin'
  | 'evening_checkin_complete_tasks'
  | 'evening_checkin_incomplete_tasks'
  | 'weekly_reflection'
  | 'squad_call_24h'
  | 'squad_call_1h'
  | 'squad_call_live';

export interface Notification {
  id: string;
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string; // ISO timestamp
  read: boolean;
  actionRoute?: string; // e.g. "/checkin/morning/start"
}

export interface EmailNotificationPreferences {
  morning_checkin?: boolean;
  evening_checkin_complete_tasks?: boolean;
  evening_checkin_incomplete_tasks?: boolean;
  weekly_reflection?: boolean;
}

// Email Preferences for Settings Panel (simplified user-facing toggles)
export interface EmailPreferences {
  morningCheckIn: boolean;
  eveningCheckIn: boolean;
  weeklyReview: boolean;
  squadCall24h: boolean;
  squadCall1h: boolean;
}

// Organization-level email notification defaults (coaches can configure these)
// Uses same structure as EmailPreferences - these become defaults for new users in the tenant
export type OrgEmailDefaults = EmailPreferences;

// Default email preferences (all enabled by default) - used as global fallback
export const DEFAULT_EMAIL_DEFAULTS: EmailPreferences = {
  morningCheckIn: true,
  eveningCheckIn: true,
  weeklyReview: true,
  squadCall24h: true,
  squadCall1h: true,
};

export interface NotificationPreferences {
  email?: EmailNotificationPreferences;
}

// Premium Upgrade Form Types
export type PremiumPlanType = 'monthly' | 'sixMonth';

export interface PremiumUpgradeForm {
  id: string;
  userId: string;
  email: string;
  name: string;
  phone: string;
  priceId: string;
  planLabel: PremiumPlanType;
  benefitsSelected: string[];
  upgradeWithFriends: boolean;
  friendsNames: string | null;
  commitment: 'commit' | 'not_ready';
  stripeUpgradeSuccessful: boolean;
  organizationId?: string; // Clerk Organization ID for multi-tenancy (user's organization)
  createdAt: string;
}

// Coaching Intake Form Types
export type CoachingPlanType = 'monthly' | 'quarterly';

export interface CoachingIntakeForm {
  id: string;
  userId: string;
  email: string;
  name: string;
  phone: string;
  priceId: string;
  planLabel: CoachingPlanType;
  goalsSelected: string[]; // What they want from coaching
  coachPreference: string; // Selected coach or "no_preference"
  commitment: 'commit' | 'not_ready';
  stripeSubscriptionSuccessful: boolean;
  organizationId?: string; // Clerk Organization ID for multi-tenancy (user's organization)
  createdAt: string;
}

// ============================================================================
// 1:1 COACHING SYSTEM TYPES
// ============================================================================

// Coach profile information
export interface Coach {
  id: string; // Clerk user ID
  email: string;
  firstName: string;
  lastName: string;
  name: string; // Display name
  imageUrl: string;
  title?: string; // e.g., "Performance Coach", "Mindset Coach"
  bio?: string;
  linkedinUrl?: string;
  instagramHandle?: string;
  isActive: boolean; // Only active coaches can be assigned
  createdAt: string;
  updatedAt: string;
}

// Action item assigned by coach to client
export interface CoachingActionItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

// Session history entry (visible to client)
export interface CoachingSessionHistory {
  id: string;
  date: string; // ISO date
  title: string;
  summary: string;
  takeaways: string[];
  createdAt: string;
  updatedAt: string;
}

// Resource shared by coach
export interface CoachingResource {
  id: string;
  title: string;
  url: string;
  description?: string;
  createdAt: string;
}

// Coach's private notes (not visible to client)
export interface CoachPrivateNotes {
  sessionId: string;
  notes: string;
  plannedTopics?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// Next coaching call data
export interface CoachingCallData {
  datetime: string | null; // ISO timestamp
  timezone: string;
  location: string; // "chat", Zoom URL, etc.
  title?: string;
}

// Main client coaching data model
export interface ClientCoachingData {
  id: string; // Format: `${organizationId}_${userId}`
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  coachId: string;
  coachingPlan: CoachingPlanType;
  startDate: string; // When coaching started
  focusAreas: string[]; // Current focus points (editable by coach)
  actionItems: CoachingActionItem[];
  nextCall: CoachingCallData;
  sessionHistory: CoachingSessionHistory[];
  resources: CoachingResource[];
  privateNotes: CoachPrivateNotes[]; // Coach-only
  chatChannelId?: string; // Stream Chat channel ID for 1:1 chat
  createdAt: string;
  updatedAt: string;
}

// Coaching call scheduled job (for notifications/emails)
export type CoachingCallJobType = 'notification_24h' | 'notification_1h' | 'notification_live' | 'email_24h' | 'email_1h';

export interface CoachingCallScheduledJob {
  id: string; // Format: `coaching_${userId}_${jobType}`
  userId: string;
  coachId: string;
  clientName: string;
  coachName: string;
  jobType: CoachingCallJobType;
  scheduledTime: string; // ISO timestamp when job should execute
  callDateTime: string; // ISO timestamp of the call
  callTimezone: string;
  callLocation: string;
  callTitle?: string;
  chatChannelId?: string;
  executed: boolean;
  executedAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// Extended notification types for coaching
export type CoachingNotificationType =
  | 'coaching_call_24h'
  | 'coaching_call_1h'
  | 'coaching_call_live';

// Standard Squad Call Types (for non-premium squads)
export type StandardSquadCallStatus = 'pending' | 'confirmed' | 'canceled';
export type StandardSquadCallProposalType = 'new' | 'edit' | 'delete';

export interface StandardSquadCall {
  id: string;
  squadId: string;
  createdByUserId: string;
  status: StandardSquadCallStatus;
  proposalType: StandardSquadCallProposalType;
  startDateTimeUtc: string; // ISO 8601 timestamp
  timezone: string; // IANA timezone e.g. "America/New_York"
  location: string; // e.g. "Squad chat", "Zoom", a URL
  title: string; // e.g. "Squad accountability call"
  // For edit proposals, reference to the original call being edited
  originalCallId?: string;
  // Voting stats (denormalized for quick access)
  yesCount: number;
  noCount: number;
  requiredVotes: number; // floor(totalMembers / 2) + 1
  totalMembers: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string; // When call reached required votes
}

export interface SquadCallVote {
  id: string; // Format: `${callId}_${userId}`
  callId: string;
  squadId: string;
  userId: string;
  vote: 'yes' | 'no';
  createdAt: string;
  updatedAt: string;
}

// Squad Call Scheduled Job Types (for notifications and emails)
export type SquadCallJobType = 'notification_24h' | 'notification_1h' | 'notification_live' | 'email_24h' | 'email_1h';

export interface SquadCallScheduledJob {
  id: string; // Format: `${squadId}_${callId}_${jobType}` or `${squadId}_premium_${jobType}`
  squadId: string;
  squadName: string;
  isPremiumSquad: boolean;
  callId?: string; // For standard squads
  jobType: SquadCallJobType;
  scheduledTime: string; // ISO timestamp when job should execute
  callDateTime: string; // ISO timestamp of the call
  callTimezone: string;
  callLocation: string;
  callTitle: string;
  chatChannelId?: string;
  executed: boolean;
  executedAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// Poll Types (re-export from poll.ts)
export * from './poll';

// =============================================================================
// QUIZ CMS TYPES
// =============================================================================

/**
 * Quiz step type - determines the layout and interaction model
 */
export type QuizStepType =
  | 'single_choice_list'       // Radio list (stacked options)
  | 'single_choice_list_image' // Radio list with images on the right
  | 'single_choice_cards'      // Big card boxes with images
  | 'single_choice_grid'       // Grid of image cards (2x2 or similar)
  | 'multi_select_list'        // Checkboxes stacked
  | 'multi_select_list_image'  // Checkboxes list with images on the right
  | 'multi_select_grid'        // Grid with checkboxes and images
  | 'likert_3'                 // Disagree / Neutral / Agree
  | 'like_dislike_neutral'     // Like / Neutral / Dislike (swipe cards)
  | 'swipe_cards'              // Swipe-style cards with like/dislike/neutral
  | 'statement_cards'          // Statement with agree/neutral/disagree
  | 'info_prompt';             // Non-question informational card

/**
 * Quiz - represents a complete quiz for a track
 */
export interface Quiz {
  id: string;
  slug: string;                 // e.g., "content-creator", "saas-founder"
  title: string;                // e.g., "Content Creator Growth Quiz"
  trackId: UserTrack | null;    // Associated track (null = general/unassigned)
  isActive: boolean;            // Whether quiz is live
  stepCount?: number;           // Cached count of steps
  organizationId?: string;      // Clerk Organization ID for multi-tenancy
  createdAt: string;
  updatedAt: string;
}

/**
 * QuizStep - a single screen in the quiz (question or info prompt)
 */
export interface QuizStep {
  id: string;
  quizId: string;
  order: number;                // For sorting (1-indexed)
  type: QuizStepType;
  
  // Content fields
  title: string;                // Main question or heading
  subtitle?: string;            // Optional helper text below title
  description?: string;         // Additional body text (for info_prompt)
  imageUrl?: string;            // Optional image at top of step
  
  // For statement_cards layout
  statement?: string;           // The statement to agree/disagree with
  statementImageUrl?: string;   // Image for statement_cards layout
  
  // Behavior fields
  dataKey?: string;             // Key to store answer in session (for questions)
  isRequired?: boolean;         // Whether answer is required
  isSkippable?: boolean;        // Whether step can be skipped
  ctaLabel?: string;            // Custom CTA button text (for info_prompt)
  
  // UI hints
  illustrationKey?: string;     // Key for built-in illustrations (legacy support)
  
  // Chart legend labels (for chart illustrations)
  chartLabel1?: string;         // First legend label (e.g., "Content Quality")
  chartLabel2?: string;         // Second legend label (e.g., "Burnout Risk")
  chartEmoji1?: string;         // First legend emoji (e.g., "💪")
  chartEmoji2?: string;         // Second legend emoji (e.g., "📉")
  
  // Goal question and confirmation card fields
  isGoalQuestion?: boolean;     // Marks this as the goal question (special handling)
  isStartingPointQuestion?: boolean; // Marks this as the starting point question (for transformation graph)
  showConfirmation?: boolean;   // Whether to show confirmation popup after selection
  confirmationTitle?: string;   // e.g., "98% of users who picked this achieved their goal"
  confirmationSubtitle?: string; // Optional secondary text for confirmation
  
  createdAt: string;
  updatedAt: string;
}

/**
 * QuizOption - one answer choice for a quiz step
 */
export interface QuizOption {
  id: string;
  quizStepId: string;
  order: number;                // For sorting
  
  // Content fields
  label: string;                // e.g., "TikTok-style short videos"
  emoji?: string;               // e.g., "🎥⚡️"
  value: string;                // e.g., "tiktok_short" - stored value
  helperText?: string;          // Optional description below label
  imageUrl?: string;            // Optional image for option
  
  // Goal question confirmation card (per-option text)
  confirmationTitle?: string;   // e.g., "98% of users who picked this achieved their goal"
  confirmationSubtitle?: string; // Optional secondary text for confirmation
  
  // Behavior
  isDefault?: boolean;          // Preselected by default
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Full quiz data with steps and options (for API responses)
 */
export interface QuizWithSteps extends Quiz {
  steps: QuizStepWithOptions[];
}

/**
 * Quiz step with its options (for API responses)
 */
export interface QuizStepWithOptions extends QuizStep {
  options: QuizOption[];
}

/**
 * Create/update quiz request
 */
export interface QuizCreateRequest {
  slug: string;
  title: string;
  trackId?: UserTrack | null;
  isActive?: boolean;
}

/**
 * Create/update quiz step request
 */
export interface QuizStepCreateRequest {
  order?: number;
  type: QuizStepType;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  statement?: string;
  statementImageUrl?: string;
  dataKey?: string;
  isRequired?: boolean;
  isSkippable?: boolean;
  ctaLabel?: string;
  illustrationKey?: string;
  chartLabel1?: string;
  chartLabel2?: string;
  chartEmoji1?: string;
  chartEmoji2?: string;
  isGoalQuestion?: boolean;
  isStartingPointQuestion?: boolean;
  showConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationSubtitle?: string;
  options?: QuizOptionCreateRequest[];
}

/**
 * Create/update quiz option request
 */
export interface QuizOptionCreateRequest {
  order?: number;
  label: string;
  emoji?: string;
  value: string;
  helperText?: string;
  imageUrl?: string;
  isDefault?: boolean;
  confirmationTitle?: string;
  confirmationSubtitle?: string;
}

// =============================================================================
// AI SUPPORT TYPES
// =============================================================================

export type AIAction = 'suggest_tasks_for_today' | 'help_complete_task' | 'track_specific_help';

export interface AIRequestPayload {
  action: AIAction;
  track: UserTrack;
  dailyTasks: { id: string; title: string }[];
  backlogTasks: { id: string; title: string }[];
  starterProgramContext: {
    id: string | null;
    name: string | null;
    dayNumber: number | null;
  };
  selectedTaskId?: string | null;
}

export interface SuggestTasksResponse {
  suggestedTasks: { title: string }[];
  notes: string;
}

export interface HelpCompleteTaskResponse {
  breakdown: string[];
  suggestedTaskTitle?: string;
}

export interface TrackSpecificHelpResponse {
  suggestedTask: { title: string };
  reason: string;
}

export type AIResponse = SuggestTasksResponse | HelpCompleteTaskResponse | TrackSpecificHelpResponse;

// =============================================================================
// MULTI-TENANT ORGANIZATION TYPES
// =============================================================================

/**
 * Access source for organization membership
 * - platform_billing: User pays GrowthAddicts directly
 * - coach_billing: Coach handles billing (Stripe Connect)
 * - manual: Coach manually grants access (external billing)
 * - invite_code: User redeemed an invite code
 */
export type OrgAccessSource = 'platform_billing' | 'coach_billing' | 'manual' | 'invite_code';

/**
 * Organization billing mode
 * - platform: Users pay GrowthAddicts directly
 * - coach: Coach handles all billing via Stripe Connect
 * - external: Coach bills users outside the app
 * - mixed: Combination of methods allowed
 */
export type OrgBillingMode = 'platform' | 'coach' | 'external' | 'mixed';

/**
 * Organization membership record
 * Stored in Firestore: org_memberships/{id}
 * 
 * This represents a user's membership in a specific organization.
 * Users can have multiple memberships (one per org they belong to).
 * Each membership has its own tier, track, squad, and access settings.
 */
export interface OrgMembership {
  id: string;                          // Auto-generated document ID
  userId: string;                      // Clerk user ID
  organizationId: string;              // Clerk Organization ID
  orgRole: OrgRole;                    // Role within this org (super_coach, coach, member)
  tier: UserTier;                      // Access tier within THIS org
  track: UserTrack | null;             // Business track within this org
  squadId: string | null;              // Squad within this org
  premiumSquadId?: string | null;      // Premium squad within this org (for premium tier users)
  accessSource: OrgAccessSource;       // How access was granted
  accessExpiresAt: string | null;      // For manual/external billing - ISO date when access expires
  inviteCodeUsed: string | null;       // Invite code that granted access (if applicable)
  isActive: boolean;                   // Whether membership is active
  joinedAt: string;                    // ISO timestamp when user joined this org
  createdAt: string;                   // ISO timestamp
  updatedAt: string;                   // ISO timestamp
  
  // ============================================
  // PROFILE FIELDS (per-organization)
  // These fields allow users to have different profiles per org
  // ============================================
  
  // Basic profile (can differ per org)
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  bio?: string;
  
  // Goal fields (per-org goals)
  goal?: string;
  goalTargetDate?: string;
  goalSummary?: string;
  goalCompleted?: boolean;
  goalProgress?: number;               // 0-100 percentage
  
  // Mission/Identity (per-org)
  identity?: string;
  
  // Onboarding data (per-org)
  workdayStyle?: string;
  businessStage?: string;
  obstacles?: string[];
  goalImpact?: string;
  supportNeeds?: string[];
  onboardingStatus?: OnboardingStatus;
  hasCompletedOnboarding?: boolean;
  
  // Preferences (per-org)
  timezone?: string;
  weeklyFocus?: string;
  
  // Coaching (per-org - coach assignment within this org)
  coachId?: string | null;
  coachingStatus?: CoachingStatus;
  coachingPlan?: CoachingPlan;
}

/**
 * Organization invite code
 * Stored in Firestore: org_invite_codes/{code}
 * 
 * Coaches can create invite codes that pre-configure:
 * - Tier (access level)
 * - Track (business type)
 * - Squad (team assignment)
 */
export interface OrgInviteCode {
  id: string;                          // The code itself (e.g., "GA-XY29Q8")
  organizationId: string;              // Clerk Organization ID
  createdByUserId: string;             // Coach who created the code
  name?: string;                       // Optional friendly name (e.g., "Q1 2024 Cohort")
  tier: UserTier;                      // Tier to grant (standard, premium)
  track: UserTrack | null;             // Track to assign (null = user chooses)
  squadId: string | null;              // Squad to join (null = no squad)
  accessDurationDays: number | null;   // Days of access (null = indefinite/until next billing)
  maxUses: number | null;              // Max redemptions (null = unlimited)
  usedCount: number;                   // Current redemption count
  expiresAt: string | null;            // Code expiration date (null = never expires)
  isActive: boolean;                   // Whether code can be used
  createdAt: string;                   // ISO timestamp
  updatedAt: string;                   // ISO timestamp
}

/**
 * Invite code redemption record
 * Stored in Firestore: org_invite_code_redemptions/{id}
 * 
 * Tracks who used which invite codes and when.
 */
export interface OrgInviteCodeRedemption {
  id: string;                          // Auto-generated document ID
  codeId: string;                      // The invite code used
  userId: string;                      // User who redeemed the code
  organizationId: string;              // Organization the code was for
  membershipId: string;                // Created org_membership ID
  redeemedAt: string;                  // ISO timestamp
}

/**
 * Organization settings
 * Stored in Firestore: org_settings/{organizationId}
 * 
 * Controls how the organization operates, including billing mode,
 * default settings for new members, and integration settings.
 */
// Stripe Connect status for coach billing
export type StripeConnectStatus = 'not_connected' | 'pending' | 'connected';

export interface OrgSettings {
  id: string;                          // Same as organizationId
  organizationId: string;              // Clerk Organization ID
  billingMode: OrgBillingMode;         // How users are billed
  allowExternalBilling: boolean;       // Whether coaches can manually grant access
  defaultTier: UserTier;               // Default tier for new members (usually 'standard')
  defaultTrack: UserTrack | null;      // Default track for new members (null = user chooses)
  stripeConnectAccountId: string | null; // For coach billing mode
  stripeConnectStatus: StripeConnectStatus; // Status of Stripe Connect account
  platformFeePercent: number;          // Platform fee percentage (0-100, default 10)
  requireApproval: boolean;            // Whether new signups need coach approval
  autoJoinSquadId: string | null;      // Auto-assign new members to this squad
  welcomeMessage: string | null;       // Custom welcome message for new members
  createdAt: string;                   // ISO timestamp
  updatedAt: string;                   // ISO timestamp
}

/**
 * Default organization settings
 */
export const DEFAULT_ORG_SETTINGS: Omit<OrgSettings, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> = {
  billingMode: 'platform',
  allowExternalBilling: true,
  defaultTier: 'standard',
  defaultTrack: null,
  stripeConnectAccountId: null,
  stripeConnectStatus: 'not_connected',
  platformFeePercent: 10, // Default 10% platform fee
  requireApproval: false,
  autoJoinSquadId: null,
  welcomeMessage: null,
};

/**
 * Platform organization ID constant
 * This is the "GrowthAddicts Platform" org for existing platform users
 */
export const PLATFORM_ORGANIZATION_SLUG = 'growthaddicts-platform';

// =============================================================================
// ORGANIZATION BRANDING TYPES
// =============================================================================

/**
 * Branding colors for an organization
 * Only accent colors are customizable (menu and page backgrounds use theme defaults)
 */
export interface OrgBrandingColors {
  accentLight: string;         // Accent/primary color in light mode (default: "#a07855")
  accentDark: string;          // Accent/primary color in dark mode (default: "#b8896a")
}

/**
 * Customizable menu titles for an organization
 * Allows coaches to rebrand navigation items (e.g., "Squad" to "Cohort")
 */
export interface OrgMenuTitles {
  home: string;                // Default: "Home"
  squad: string;               // Default: "Squad" - can be "Cohort", "Team", "Group", etc.
  program: string;             // Default: "Program" - can be "Journey", "Path", etc.
  learn: string;               // Default: "Learn" - can be "Discover", "Content", etc.
  chat: string;                // Default: "Chat" - can be "Messages", "Community", etc.
  coach: string;               // Default: "Coach" - can be "Mentor", "Guide", etc.
}

/**
 * Email domain verification status for whitelabel email sending
 */
export type EmailDomainStatus = 'not_started' | 'pending' | 'verified' | 'failed';

/**
 * DNS record returned by Resend when adding a domain
 */
export interface EmailDnsRecord {
  type: 'MX' | 'TXT';
  name: string;
  value: string;
  priority?: number;
  ttl?: string;
}

/**
 * Email settings for whitelabel email sending
 * Allows coaches to send emails from their own domain via Resend
 */
export interface OrgEmailSettings {
  // Resend domain configuration
  domain: string | null;           // e.g., "notifications.coachbrand.com"
  resendDomainId: string | null;   // Resend domain ID: "d_123..."
  status: EmailDomainStatus;
  dnsRecords: EmailDnsRecord[];
  verifiedAt: string | null;
  
  // Sender configuration
  fromName: string;                // e.g., "Coach Brand" (default: org appTitle)
  replyTo: string | null;          // e.g., "support@coachbrand.com"
}

/**
 * Organization branding settings
 * Stored in Firestore: org_branding/{organizationId}
 * 
 * This is keyed by Clerk Organization ID to support future multi-tenant
 * subdomain/custom domain scenarios where each coach has their own instance.
 */
export interface OrgBranding {
  id: string;                    // Same as organizationId
  organizationId: string;        // Clerk Organization ID
  logoUrl: string | null;        // Custom square logo URL (null = use default)
  horizontalLogoUrl: string | null; // Custom horizontal/wide logo URL (replaces square logo + title if set)
  appTitle: string;              // App title shown in sidebar (default: "Growth Addicts")
  colors: OrgBrandingColors;
  menuTitles?: OrgMenuTitles;    // Customizable menu titles (optional, uses defaults if not set)
  emailSettings?: OrgEmailSettings; // Whitelabel email settings (optional)
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

/**
 * Default branding values (matches current hardcoded theme)
 */
export const DEFAULT_BRANDING_COLORS: OrgBrandingColors = {
  accentLight: '#a07855',
  accentDark: '#b8896a',
};

export const DEFAULT_APP_TITLE = 'GrowthAddicts';
export const DEFAULT_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af';

export const DEFAULT_MENU_TITLES: OrgMenuTitles = {
  home: 'Home',
  squad: 'Squad',
  program: 'Program',
  learn: 'Discover', // Renamed from "Learn" to "Discover"
  chat: 'Chat',
  coach: 'Coach',
};

export const DEFAULT_EMAIL_SETTINGS: OrgEmailSettings = {
  domain: null,
  resendDomainId: null,
  status: 'not_started',
  dnsRecords: [],
  verifiedAt: null,
  fromName: 'Growth Addicts',
  replyTo: null,
};

// =============================================================================
// TENANT DOMAIN TYPES
// =============================================================================

/**
 * Reserved subdomains that cannot be used by tenants
 */
export const RESERVED_SUBDOMAINS = [
  'www', 'app', 'admin', 'api', 'static', 'cdn', 'support', 'billing', 
  'help', 'mail', 'email', 'ftp', 'sftp', 'ssh', 'vpn', 'dev', 'staging',
  'test', 'demo', 'beta', 'alpha', 'docs', 'blog', 'status', 'health',
  'metrics', 'analytics', 'dashboard', 'console', 'portal', 'login',
  'signup', 'register', 'auth', 'oauth', 'sso', 'saml', 'webhook',
  'webhooks', 'callback', 'redirect', 'assets', 'images', 'img', 'media',
  'files', 'uploads', 'download', 'downloads', 'store', 'shop', 'pay',
  'payment', 'payments', 'checkout', 'cart', 'order', 'orders', 'invoice',
  'invoices', 'subscription', 'subscriptions', 'pro', 'enterprise', 'team',
  'teams', 'org', 'orgs', 'organization', 'organizations', 'workspace',
  'workspaces', 'project', 'projects', 'account', 'accounts', 'user',
  'users', 'member', 'members', 'coach', 'coaches', 'client', 'clients',
  'partner', 'partners', 'affiliate', 'affiliates', 'reseller', 'resellers',
] as const;

/**
 * Custom domain verification status
 */
export type CustomDomainStatus = 'pending' | 'verified' | 'failed';

/**
 * Organization domain mapping
 * Stored in Firestore: org_domains/{id}
 * 
 * Maps subdomains to organizations for multi-tenant routing.
 * Each organization can have one subdomain and multiple custom domains.
 */
export interface OrgDomain {
  id: string;                    // Auto-generated document ID
  organizationId: string;        // Clerk Organization ID (unique)
  subdomain: string;             // e.g., "acme" for acme.growthaddicts.app (unique, lowercase)
  primaryDomain?: string;        // Display domain (subdomain or verified custom domain)
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

/**
 * Custom domain for an organization
 * Stored in Firestore: org_custom_domains/{id}
 * 
 * Allows organizations to use their own domains (e.g., coach.example.com)
 */
export interface OrgCustomDomain {
  id: string;                    // Auto-generated document ID
  organizationId: string;        // Clerk Organization ID
  domain: string;                // e.g., "coaching.example.com" (unique, lowercase)
  status: CustomDomainStatus;    // Verification status
  verificationToken: string;     // Token for DNS TXT record verification
  clerkDomainId?: string;        // Clerk satellite domain ID for auth
  verifiedAt?: string;           // ISO timestamp when verified
  lastCheckedAt?: string;        // ISO timestamp of last verification attempt
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

/**
 * Resolved tenant context from hostname
 */
export interface TenantContext {
  organizationId: string;        // Clerk Organization ID
  subdomain: string;             // The subdomain (even for custom domains, we track this)
  isCustomDomain: boolean;       // True if accessed via custom domain
  hostname: string;              // The original hostname
}

/**
 * Tenant resolution result
 */
export type TenantResolutionResult = 
  | { type: 'platform'; hostname: string }           // Main platform domain (no tenant)
  | { type: 'tenant'; tenant: TenantContext }        // Resolved tenant
  | { type: 'not_found'; hostname: string };         // Unknown subdomain/domain

/**
 * Subdomain validation result
 */
export interface SubdomainValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a subdomain string
 */
export function validateSubdomain(subdomain: string): SubdomainValidationResult {
  // Lowercase and trim
  const normalized = subdomain.toLowerCase().trim();
  
  // Length check: 3-30 characters
  if (normalized.length < 3) {
    return { valid: false, error: 'Subdomain must be at least 3 characters' };
  }
  if (normalized.length > 30) {
    return { valid: false, error: 'Subdomain must be 30 characters or less' };
  }
  
  // Character check: letters, numbers, hyphens only
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return { valid: false, error: 'Subdomain can only contain letters, numbers, and hyphens' };
  }
  
  // Cannot start or end with hyphen
  if (normalized.startsWith('-') || normalized.endsWith('-')) {
    return { valid: false, error: 'Subdomain cannot start or end with a hyphen' };
  }
  
  // Cannot have consecutive hyphens
  if (normalized.includes('--')) {
    return { valid: false, error: 'Subdomain cannot contain consecutive hyphens' };
  }
  
  // Reserved check
  if (RESERVED_SUBDOMAINS.includes(normalized as typeof RESERVED_SUBDOMAINS[number])) {
    return { valid: false, error: 'This subdomain is reserved and cannot be used' };
  }
  
  return { valid: true };
}

// ============================================================================
// FUNNEL SYSTEM TYPES
// Unified funnel system for user acquisition - replaces separate /start and /begin flows
// ============================================================================

/**
 * Funnel step types
 */
export type FunnelStepType = 
  | 'question'       // Quiz/intake question (single/multi choice, text, scale)
  | 'signup'         // Account creation step
  | 'payment'        // Payment collection step
  | 'goal_setting'   // Goal setting with customizable examples
  | 'identity'       // Identity/mission statement
  | 'analyzing'      // Loading/analyzing animation
  | 'plan_reveal'    // Show personalized plan
  | 'transformation' // Transformation graph visualization
  | 'info'           // Information/welcome card
  | 'success';       // Completion step

/**
 * Question types for question steps
 */
export type FunnelQuestionType = 
  | 'single_choice'  // Radio buttons
  | 'multi_choice'   // Checkboxes
  | 'text'           // Free text input
  | 'scale'          // 1-5 or 1-10 scale
  | 'workday'        // Preset: workday style question
  | 'obstacles'      // Preset: obstacles question
  | 'business_stage' // Preset: business stage question
  | 'goal_impact'    // Preset: goal impact question
  | 'support_needs'; // Preset: support needs question

/**
 * Funnel access type
 */
export type FunnelAccessType = 'public' | 'invite_only';

/**
 * Payment status for invites
 */
export type InvitePaymentStatus = 'required' | 'pre_paid' | 'free';

/**
 * Funnel - Coach-created user acquisition flow
 * Stored in Firestore 'funnels' collection
 */
export interface Funnel {
  id: string;
  organizationId: string;        // Clerk Organization ID (multi-tenant)
  programId: string;             // Which program this enrolls users in
  
  // Identification
  slug: string;                  // URL-friendly identifier
  name: string;                  // Display name (e.g., "Discovery Quiz", "Direct Join")
  description?: string;          // Optional description
  
  // Settings
  isDefault: boolean;            // Default funnel for the program
  isActive: boolean;             // Whether funnel is accepting users
  accessType: FunnelAccessType;  // Public or invite-only
  defaultPaymentStatus: InvitePaymentStatus; // Default for invites
  
  // Customization
  branding?: {
    logoUrl?: string;            // Override org logo
    primaryColor?: string;       // Override org color
  };
  
  // Metadata
  stepCount: number;             // Denormalized for quick display
  createdAt: string;
  updatedAt: string;
}

/**
 * Question option for choice-type questions
 */
export interface FunnelQuestionOption {
  id: string;
  label: string;
  value: string;
  emoji?: string;
  imageUrl?: string;            // Optional image for visual choice cards
  description?: string;
  order: number;
}

/**
 * Step configuration - varies by step type
 */
export interface FunnelStepConfigQuestion {
  questionType: FunnelQuestionType;
  question?: string;             // Custom question text (for non-preset types)
  description?: string;          // Helper text
  options?: FunnelQuestionOption[]; // For choice types
  required?: boolean;
  minLength?: number;            // For text type
  maxLength?: number;            // For text type
  scaleMin?: number;             // For scale type
  scaleMax?: number;             // For scale type
  scaleLabels?: { min: string; max: string }; // For scale type
  fieldName: string;             // Key to store answer in flow session data
}

export interface FunnelStepConfigSignup {
  heading?: string;              // Custom heading
  subheading?: string;           // Custom subheading
  showSocialLogin?: boolean;     // Show Google/Apple buttons
  collectPhone?: boolean;        // Collect phone number
}

export interface FunnelStepConfigPayment {
  useProgramPricing: boolean;    // Use program's default pricing
  priceInCents?: number;         // Override price
  stripePriceId?: string;        // Override Stripe price ID
  heading?: string;              // Custom heading
  features?: string[];           // Features to display
}

export interface FunnelStepConfigGoal {
  examples: string[];            // Placeholder goal examples
  timelineDays: number;          // Default timeline (e.g., 90)
  heading?: string;              // Custom heading
  promptText?: string;           // Custom prompt
}

export interface FunnelStepConfigIdentity {
  examples: string[];            // Placeholder identity examples
  heading?: string;              // Custom heading
  promptText?: string;           // Custom prompt (e.g., "I am becoming...")
}

export interface FunnelTestimonial {
  name: string;
  text: string;
  imageUrl?: string;
}

export interface FunnelStepConfigAnalyzing {
  durationMs: number;            // How long to show (e.g., 3000)
  messages?: string[];           // Messages to cycle through
  testimonials?: FunnelTestimonial[]; // Optional testimonials to show during analyzing
}

export interface FunnelStepConfigPlanReveal {
  heading?: string;              // e.g., "Your {X}-month plan is ready!"
  body?: string;                 // Custom encouragement text
  ctaText?: string;              // Button text
  showGraph?: boolean;           // Show transformation graph
}

export interface FunnelStepConfigInfo {
  heading: string;
  body: string;
  imageUrl?: string;
  ctaText?: string;
}

export interface FunnelStepConfigSuccess {
  heading?: string;
  body?: string;
  showConfetti?: boolean;
  redirectDelay?: number;        // ms before redirect to dashboard
}

export type FunnelStepConfig = 
  | { type: 'question'; config: FunnelStepConfigQuestion }
  | { type: 'signup'; config: FunnelStepConfigSignup }
  | { type: 'payment'; config: FunnelStepConfigPayment }
  | { type: 'goal_setting'; config: FunnelStepConfigGoal }
  | { type: 'identity'; config: FunnelStepConfigIdentity }
  | { type: 'analyzing'; config: FunnelStepConfigAnalyzing }
  | { type: 'plan_reveal'; config: FunnelStepConfigPlanReveal }
  | { type: 'transformation'; config: FunnelStepConfigPlanReveal }
  | { type: 'info'; config: FunnelStepConfigInfo }
  | { type: 'success'; config: FunnelStepConfigSuccess };

/**
 * Funnel step - A single step in a funnel
 * Stored in Firestore 'funnels/{funnelId}/steps' subcollection
 */
export interface FunnelStep {
  id: string;
  funnelId: string;
  order: number;                 // 0-indexed order
  type: FunnelStepType;
  name?: string;                 // Custom name for coach differentiation
  config: FunnelStepConfig;
  
  // Conditional display
  showIf?: {
    field: string;               // Field in flow session data
    operator: 'eq' | 'neq' | 'in' | 'nin';
    value: unknown;
  };
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Flow session - Temporary state for a user going through a funnel
 * Stored in Firestore 'flow_sessions' collection
 */
export interface FlowSession {
  id: string;
  funnelId: string;
  programId: string;
  organizationId: string;
  
  // User linking
  userId: string | null;         // null until signup step completes
  linkedAt: string | null;       // When userId was linked
  
  // Invite tracking
  inviteId: string | null;       // If user came via invite code
  
  // Progress
  currentStepIndex: number;
  completedStepIndexes: number[]; // Steps that have been completed
  
  // Collected data
  data: Record<string, unknown>; // All answers and data from steps
  
  // For custom domain auth
  originDomain: string;          // Where flow started
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  expiresAt: string;             // Auto-cleanup after expiration
  completedAt?: string;          // When funnel was completed
}

/**
 * Program invite - Invite code for joining a program via funnel
 * Stored in Firestore 'program_invites' collection
 */
export interface ProgramInvite {
  id: string;                    // Short code (e.g., "ABC123")
  funnelId: string;
  programId: string;
  organizationId: string;
  
  // Creator
  createdBy: string;             // Coach userId who created it
  
  // Target (optional)
  email?: string;                // For email invites
  name?: string;                 // Invitee name (for personalization)
  
  // Payment handling
  paymentStatus: InvitePaymentStatus;
  prePaidNote?: string;          // e.g., "Paid via invoice #123"
  
  // Squad assignment (optional)
  targetSquadId?: string;        // Specific squad to join
  targetCohortId?: string;       // Specific cohort to join
  
  // Usage tracking
  usedBy?: string;               // userId who claimed it
  usedAt?: string;               // When it was claimed
  
  // Limits
  maxUses?: number;              // null = unlimited
  useCount: number;              // Current usage count
  
  // Expiration
  expiresAt?: string;            // null = never expires
  
  createdAt: string;
}

/**
 * Funnel with step count for list views
 */
export interface FunnelWithStats extends Funnel {
  totalSessions: number;
  completedSessions: number;
  conversionRate: number;
}

/**
 * Flow session status
 */
export type FlowSessionStatus = 'active' | 'completed' | 'expired' | 'abandoned';

/**
 * Get flow session status helper
 */
export function getFlowSessionStatus(session: FlowSession): FlowSessionStatus {
  if (session.completedAt) return 'completed';
  if (new Date(session.expiresAt) < new Date()) return 'expired';
  // Consider abandoned if not updated in 24 hours and not completed
  const lastUpdate = new Date(session.updatedAt);
  const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
  if (hoursSinceUpdate > 24) return 'abandoned';
  return 'active';
}

