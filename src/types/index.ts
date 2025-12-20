// User Role Types
export type UserRole = 'user' | 'editor' | 'coach' | 'admin' | 'super_admin';

// Organization Role Types (for multi-tenant role hierarchy within an organization)
// super_coach: Organization leader (owns the org, can manage all members)
// coach: Can coach squads within the organization
// member: Regular organization member (client)
export type OrgRole = 'super_coach' | 'coach' | 'member';

// Track Types - Business type the user is building
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

// Billing Status Type
export type BillingStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

// Clerk Public Metadata Type (for type assertions with sessionClaims)
// This is the SINGLE SOURCE OF TRUTH for user access control
export interface ClerkPublicMetadata {
  role?: UserRole;
  track?: UserTrack;
  tier?: UserTier;            // Subscription tier (free, standard, premium)
  orgRole?: OrgRole;          // Organization-level role (for multi-tenant hierarchy)
  organizationId?: string;    // Clerk Organization ID this user belongs to
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
  track?: UserTrack | null; // Business track (content_creator, saas, coach_consultant, ecom, agency, general)
  
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
export type HabitSource = 'track_default' | 'user';

export interface Habit {
  id: string;
  userId: string;
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
// ============================================================================

/**
 * Task template within a program day
 * These are templates that get instantiated as real Task records
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
 */
export type ProgramEnrollmentStatus = 'active' | 'completed' | 'stopped';

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
// TRACK CMS TYPES (Admin-managed)
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
  // Track association - optional, null means visible to all users regardless of track
  trackId?: UserTrack | null;
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
  id: string; // Format: `${userId}_${YYYY-MM-DD}`
  userId: string;
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
  userId: string;
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
  id: string; // Same as userId
  userId: string;
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
// ORGANIZATION BRANDING TYPES
// =============================================================================

/**
 * Branding colors for an organization
 * Supports both light and dark mode variants
 */
export interface OrgBrandingColors {
  menuLight: string;           // Menu/sidebar background in light mode (default: "#ffffff")
  menuDark: string;            // Menu/sidebar background in dark mode (default: "#101520")
  bgLight: string;             // Page background in light mode (default: "#faf8f6")
  bgDark: string;              // Page background in dark mode (default: "#05070b")
  accentLight: string;         // Accent/primary color in light mode (default: "#a07855")
  accentDark: string;          // Accent/primary color in dark mode (default: "#b8896a")
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
  logoUrl: string | null;        // Custom logo URL (null = use default)
  appTitle: string;              // App title shown in sidebar (default: "Growth Addicts")
  colors: OrgBrandingColors;
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

/**
 * Default branding values (matches current hardcoded theme)
 */
export const DEFAULT_BRANDING_COLORS: OrgBrandingColors = {
  menuLight: '#ffffff',
  menuDark: '#101520',
  bgLight: '#faf8f6',
  bgDark: '#05070b',
  accentLight: '#a07855',
  accentDark: '#b8896a',
};

export const DEFAULT_APP_TITLE = 'GrowthAddicts';
export const DEFAULT_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af';

