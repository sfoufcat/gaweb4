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

/**
 * @deprecated UserTier is deprecated. Access is now controlled by:
 * - Program enrollment (priceInCents gates access)
 * - Squad membership (priceInCents gates access)
 * - Coach manual assignment
 * This type is kept only for backward compatibility during migration.
 */
export type UserTier = 'free' | 'standard' | 'premium';

// Coaching Status Types (separate from membership tier)
export type CoachingStatus = 'none' | 'active' | 'canceled' | 'past_due';
export type CoachingPlan = 'monthly' | 'quarterly' | null;

// =============================================================================
// COACH SUBSCRIPTION TIERS
// =============================================================================

/**
 * Coach tier levels for platform subscription
 * - starter: $49/mo - 15 clients, 2 programs, 3 squads
 * - pro: $129/mo - 150 clients, 10 programs, 25 squads, custom domain, Stripe Connect
 * - scale: $299/mo - 500 clients, 50 programs, 100 squads, all features
 */
export type CoachTier = 'starter' | 'pro' | 'scale';

/**
 * Coach subscription status
 */
export type CoachSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

/**
 * Coach subscription record
 * Stored in Firestore: coach_subscriptions/{id}
 * 
 * Tracks a coach's platform subscription for their organization.
 */
export interface CoachSubscription {
  id: string;
  organizationId: string;           // Clerk Organization ID
  userId?: string;                  // Clerk User ID of subscription owner
  tier: CoachTier;
  status: CoachSubscriptionStatus;
  
  // Stripe subscription info
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripePriceId?: string | null;    // Stripe Price ID
  currentPeriodStart: string | null;  // ISO timestamp
  currentPeriodEnd: string | null;    // ISO timestamp
  trialEnd?: string | null;           // Trial end date (ISO timestamp)
  cancelAtPeriodEnd: boolean;
  
  // Manual billing support (for enterprise/special deals)
  manualBilling?: boolean;
  manualExpiresAt?: string | null;    // ISO date when manual access expires
  
  // Grace period for payment failures (3 days to update payment)
  graceEndsAt?: string | null;        // ISO date when grace period ends
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Default coach subscription values
 */
export const DEFAULT_COACH_SUBSCRIPTION: Omit<CoachSubscription, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> = {
  tier: 'starter',
  status: 'none',
  stripeSubscriptionId: null,
  stripeCustomerId: null,
  stripePriceId: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  trialEnd: null,
  cancelAtPeriodEnd: false,
  manualBilling: false,
  manualExpiresAt: null,
};

/**
 * User access reason - why a user has access to an org
 */
export type UserAccessReason = 'program' | 'squad' | 'coach_assigned' | 'staff' | 'none';

// Clerk Public Metadata Type (for type assertions with sessionClaims)
// This is the SINGLE SOURCE OF TRUTH for user access control
// NOTE: Multi-org architecture - track/orgRole are now per-org in Firestore org_memberships
export interface ClerkPublicMetadata {
  role?: UserRole;                    // Platform role (for super_admins only)
  primaryOrganizationId?: string;     // Last active / default organization
  // Legacy fields - kept for backward compatibility during migration
  // track field REMOVED - tracks fully deprecated
  /** @deprecated UserTier is deprecated - access controlled by program/squad membership */
  tier?: UserTier;
  /** @deprecated Use org_memberships collection instead */
  orgRole?: OrgRole;
  /** @deprecated Use primaryOrganizationId instead */
  organizationId?: string;
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
  /** @deprecated Use primaryOrganizationId instead - kept for backward compatibility with funnel enrollments */
  organizationId?: string;
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
  
  // Squad membership - users can be in multiple squads (program squad + standalone)
  squadIds?: string[]; // Array of squad IDs user belongs to
  /** @deprecated Use squadIds instead */
  squadId?: string | null;
  /** @deprecated Use squadIds instead */
  standardSquadId?: string | null;
  /** @deprecated Use squadIds instead */
  premiumSquadId?: string | null;
  
  /** @deprecated UserTier is deprecated - access controlled by program/squad pricing */
  tier?: UserTier;
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
  coachingStatus?: CoachingStatus; // Detailed coaching status (synced from org_membership)
  
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
  
  // Alumni tracking (for alumni discount eligibility)
  isAlumni?: boolean; // True if user has completed at least one program
  alumniOf?: string[]; // Array of programIds the user has completed
  
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
export type TaskStatus = 'pending' | 'completed' | 'deleted' | 'archived';
export type TaskListType = 'focus' | 'backlog';
// Extended source types for 2-way coach-client sync
export type TaskSourceType = 
  | 'user'           // Client-created task
  | 'program'        // Legacy: generic program task (kept for backward compatibility)
  | 'program_day'    // Task from program day template
  | 'program_week'   // Task from program week template
  | 'coach_manual'   // Manually assigned by coach
  | 'call_suggestion'; // From AI call summary
export type TaskVisibility = 'public' | 'private';

export interface Task {
  id: string;
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  title: string;
  status: TaskStatus;
  listType: TaskListType;
  order: number;
  date: string; // ISO date (YYYY-MM-DD)
  isPrivate: boolean;                  // Legacy field - use visibility instead
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  // Archive lifecycle fields
  movedToBacklogAt?: string | null;    // ISO timestamp - when task FIRST entered backlog
  archivedAt?: string | null;          // ISO timestamp - when archived
  scheduledDeleteAt?: string | null;   // ISO timestamp - 30 days after archivedAt
  // Program-related fields
  sourceType?: TaskSourceType;         // Source of the task - defaults to 'user'
  programEnrollmentId?: string | null; // FK to program_enrollments
  programDayIndex?: number | null;     // Which program day this task came from
  programTaskId?: string;              // Unique ID linking to template task for robust matching
  originalTitle?: string;              // Original title from template - used for fallback matching if programTaskId unavailable
  cycleNumber?: number;                // Which cycle this task belongs to (evergreen programs only)
  // Call summary fields (when sourceType === 'call_suggestion')
  callSummaryId?: string;              // FK to call_summaries
  suggestedTaskId?: string;            // FK to suggested_tasks
  // 2-way sync fields
  visibility?: TaskVisibility;         // 'public' = coach can see, 'private' = client only
  clientLocked?: boolean;              // true if client edited/deleted - sync cannot override
  sourceProgramId?: string | null;     // FK to programs (for tracking)
  sourceProgramDayId?: string | null;  // FK to program_days (for day-level tasks)
  sourceWeekId?: string | null;        // FK to program_weeks (for week-level tasks)
  assignedByCoachId?: string | null;   // Coach user ID who assigned the task
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
  // 2-way sync fields (optional)
  visibility?: TaskVisibility;
  clientLocked?: boolean;
  sourceProgramId?: string;
  sourceProgramDayId?: string;
  sourceWeekId?: string;
  assignedByCoachId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  status?: TaskStatus;
  listType?: TaskListType;
  order?: number;
  isPrivate?: boolean;
  visibility?: TaskVisibility;  // 'public' | 'private' - new field for 2-way sync
}

// ============================================================================
// STARTER PROGRAM SYSTEM TYPES
// @deprecated - Use the new Program system types below instead
// These types are kept for backward compatibility during migration
// ============================================================================

/**
 * Where a task template originated from
 * - 'week': Distributed from weekly tasks
 * - 'day': Added directly to a specific day
 * - 'manual': Manually added by coach
 * - 'sync': Created during sync process
 */
export type TaskSource = 'week' | 'day' | 'manual' | 'sync';

/**
 * Task template within a program day
 * These are templates that get instantiated as real Task records
 * @deprecated Use ProgramDay.tasks with the new Program system
 */
export interface ProgramTaskTemplate {
  id?: string; // Unique ID for this template task (persists through edits)
  label: string; // Task title that shows in the app
  type?: 'task' | 'habit' | 'learning' | 'admin'; // Optional categorization
  isPrimary: boolean; // If true, pushed to Daily Focus (if room); otherwise Backlog
  estimatedMinutes?: number; // Optional time estimate
  notes?: string; // Optional guidance/context
  tag?: string; // Optional tag (e.g., "content", "mindset", "systems")
  source?: TaskSource; // Where this task originated from (for smart merging)
  // Optional completion status (populated when viewing client-specific days)
  completed?: boolean; // Whether the client has completed this task
  completedAt?: string; // ISO timestamp of when the client completed it
  taskId?: string; // Reference to the actual task document in the tasks collection
  deletedByClient?: boolean; // Whether the client has soft-deleted this task
  editedByClient?: boolean; // Whether the client has edited this task's title
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
 * Program completion popup configuration
 * Shown when a user finishes the program
 */
export interface ProgramCompletionConfig {
  upsellProgramId?: string;      // Program to upsell (optional)
  upsellHeadline?: string;       // Custom headline (default: "Keep the momentum going!")
  upsellDescription?: string;    // Custom description
  showConfetti?: boolean;        // Default: true
}

/**
 * Program feature for landing page
 */
export interface ProgramFeature {
  icon?: string; // Lucide icon name (e.g., 'video', 'users', 'message-circle')
  title: string;
  description?: string;
}

/**
 * Program testimonial for landing page
 */
export interface ProgramTestimonial {
  text: string;
  author: string;
  role?: string; // e.g., "Program graduate 2024"
  imageUrl?: string;
  rating?: number; // 1-5 stars
}

/**
 * Program FAQ for landing page
 */
export interface ProgramFAQ {
  question: string;
  answer: string;
}

// ============================================================================
// PROGRAM TEMPLATES - Pre-built programs coaches can clone
// ============================================================================

/**
 * Template category for filtering in gallery
 */
export type TemplateCategory = 'business' | 'habits' | 'mindset' | 'health' | 'productivity' | 'relationships';

/**
 * Template status for admin review workflow
 */
export type TemplateStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

/**
 * Program Template - Pre-built program that coaches can clone
 * Stored in Firestore 'program_templates' collection
 */
export interface ProgramTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  previewDescription: string; // Marketing copy for template gallery
  coverImageUrl?: string;
  
  // Classification
  category: TemplateCategory;
  tags: string[];
  lengthDays: number;
  type: ProgramType; // 'group' | 'individual'
  
  // Defaults
  suggestedPriceInCents: number;
  defaultHabits: ProgramHabitTemplate[];
  
  // Landing Page Content (copied to program on clone)
  keyOutcomes?: string[];              // "What you'll achieve" bullet points
  features?: ProgramFeature[];         // "What's included" cards with icons
  testimonials?: ProgramTestimonial[]; // Sample testimonials (coach replaces)
  faqs?: ProgramFAQ[];                 // Common FAQs for this program type
  showEnrollmentCount?: boolean;       // Default LP setting
  showCurriculum?: boolean;            // Default LP setting
  
  // Engagement metrics
  usageCount: number;
  featured: boolean;
  
  // Source tracking
  createdBy: 'platform' | string; // 'platform' or coach userId
  creatorName?: string;
  sourceOrganizationId?: string;
  
  // Status
  status: TemplateStatus;
  isPublished: boolean;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Template Day - Day content for a program template
 * Stored in Firestore 'template_days' collection
 */
export interface TemplateDay {
  id: string;
  templateId: string;
  dayIndex: number; // 1-based: 1..lengthDays
  title?: string; // Optional title/theme (e.g., "Define Your Niche")
  summary?: string; // 1-2 lines description
  dailyPrompt?: string; // Encouragement/explanation for the day
  tasks: ProgramTaskTemplate[];
  habits?: ProgramHabitTemplate[]; // Optional habits (typically Day 1)
}

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
  lengthDays: number; // Duration in days (calculated from lengthWeeks * 7 if weekly mode)
  lengthWeeks?: number; // Duration in weeks (primary unit for weekly mode)

  // Duration type (default: 'fixed' for backward compatibility)
  durationType?: 'fixed' | 'evergreen'; // 'fixed' = ends after lengthDays, 'evergreen' = cycles repeat forever
  
  // Pricing
  priceInCents: number; // 0 = free
  currency: string; // 'usd', 'eur', etc.
  stripePriceId?: string; // Stripe Price ID for checkout
  
  // Subscription settings (for recurring pricing)
  subscriptionEnabled?: boolean; // If true, enrollment requires recurring subscription
  billingInterval?: 'monthly' | 'quarterly' | 'yearly'; // Subscription billing interval
  stripeProductId?: string; // Stripe Product ID for subscription
  
  // Group program settings (only applicable when type = 'group')
  squadCapacity?: number; // Max members per squad (e.g., 10)
  coachInSquads?: boolean; // Whether coach joins each squad
  assignedCoachIds?: string[]; // Coach IDs for round-robin assignment (used when coachInSquads is false)
  cohortCompletionThreshold?: number; // 0-100, default 50 - % of cohort members that must complete a task for it to show as "completed" to coach
  
  // Individual program settings (only applicable when type = 'individual')
  clientCommunityEnabled?: boolean; // Coach toggle to enable client community squad
  clientCommunitySquadId?: string | null; // Auto-created squad ID for client community
  defaultStartDate?: string; // ISO date string - coach-set default start date (e.g., "2025-02-01")
  allowCustomStartDate?: boolean; // If true, users can pick their own start date during enrollment
  callCreditsPerMonth?: number; // Number of coaching call credits included per month (0 = unlimited/pay-per-call)
  
  // Content
  defaultHabits?: ProgramHabitTemplate[]; // Default habits for enrolled users
  
  // Daily Focus settings
  dailyFocusSlots?: number;            // 1-4, default 2 - how many focus tasks this program contributes per day
  
  // Weekend settings
  includeWeekends?: boolean; // Default true. If false, tasks only feed on weekdays (Mon-Fri)

  // Program content mode settings
  /** @deprecated Use taskDistribution instead */
  orientation?: ProgramOrientation;
  taskDistribution?: TaskDistribution; // How tasks are distributed: 'repeat-daily' | 'spread' (default: 'spread')
  /** @deprecated Use taskDistribution instead */
  weeklyTaskDistribution?: WeeklyTaskDistribution;
  scheduleMode?: ProgramScheduleMode; // What content types are in the schedule
  primaryCourseIds?: string[]; // Main courses that form the schedule backbone
  hasModules?: boolean; // True if using program_modules collection for hierarchy

  // Status
  isActive: boolean; // Whether program can accept enrollments
  isPublished: boolean; // Whether visible in Discover
  
  // Landing Page Content (all optional - coaches can toggle these on/off)
  // Hero section
  heroHeadline?: string; // Custom hero title (overrides program name on landing page)
  heroSubheadline?: string; // Custom hero subtitle (overrides description on landing page)
  heroCtaText?: string; // Custom CTA button text
  landingPageCoverImageUrl?: string; // Hero cover image for landing page (overrides coverImageUrl)
  // Coach section
  coachBio?: string; // About the coach section
  coachHeadline?: string; // Custom headline for coach section (defaults to "About Your Coach")
  coachBullets?: string[]; // Key points/credentials about the coach
  // Other landing page content
  keyOutcomes?: string[]; // "What you'll learn" bullet points
  features?: ProgramFeature[]; // "What's included" feature cards
  testimonials?: ProgramTestimonial[]; // Social proof
  faqs?: ProgramFAQ[]; // Frequently asked questions
  showEnrollmentCount?: boolean; // Show "X students enrolled" badge
  showCurriculum?: boolean; // Show program day titles as curriculum preview
  
  // Referral program settings
  referralConfig?: ReferralConfig;
  
  // Order bumps - additional products offered during checkout
  orderBumps?: OrderBumpConfig;
  
  // Completion popup settings - shown when user finishes the program
  completionConfig?: ProgramCompletionConfig;
  
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

  // Hierarchy references (for module/week structure)
  moduleId?: string; // FK to program_modules
  weekId?: string; // FK to program_weeks

  // Schedule integration
  scheduledItems?: ScheduledItem[]; // Calls, courses, assignments for this day
  courseAssignments?: DayCourseAssignment[]; // Course content assigned to this day

  // AI fill tracking
  fillSource?: WeekFillSource; // How this day's content was generated

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
  
  // Community Mode settings
  convertSquadsToCommunity?: boolean; // If true, squads become standalone when cohort ends
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}


/**
 * Cohort-specific week content - stores recordings and summaries per cohort
 * This allows group programs to have different call recordings/summaries
 * for each cohort running the same program template.
 * 
 * Stored in Firestore 'cohort_week_content' collection
 */
export interface CohortWeekContent {
  id: string;
  cohortId: string;           // FK to program_cohorts
  programWeekId: string;      // FK to program_weeks (template week)
  programId: string;          // Denormalized for queries
  organizationId: string;     // Denormalized for queries
  
  // Cohort-specific recordings
  coachRecordingUrl?: string;
  coachRecordingNotes?: string;
  
  // Cohort-specific linked content
  linkedSummaryIds?: string[];      // CallSummary IDs for this cohort's week
  linkedCallEventIds?: string[];    // UnifiedEvent IDs for this cohort's calls
  
  // Cohort-specific notes
  manualNotes?: string;             // Coach notes specific to this cohort
  
  // Cohort-specific weekly tasks and distribution
  weeklyTasks?: ProgramTaskTemplate[];
  weeklyHabits?: ProgramHabitTemplate[];
  weeklyPrompt?: string;
  distribution?: TaskDistribution;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}


/**
 * CohortTaskState - Tracks aggregated task completion for cohort programs
 * One document per task per date per cohort
 * Firestore collection: cohort_task_states
 */
export interface CohortTaskStateMemberState {
  status: 'pending' | 'completed';
  completedAt?: string;        // ISO timestamp when completed
  taskId?: string;             // FK to user's actual task document
  removed?: boolean;           // True if member was removed from cohort
}

export interface CohortTaskState {
  id: string;
  cohortId: string;            // FK to program_cohorts
  programId: string;           // FK to programs
  organizationId: string;      // Denormalized for queries
  programDayIndex: number;     // Which day in the program (1-based)
  taskTemplateId: string;      // FK to program_day_tasks or program_week_tasks (deprecated, use programTaskId)
  programTaskId?: string;      // Unique ID linking to template task for robust matching
  taskTitle: string;           // Denormalized for display
  date: string;                // ISO date YYYY-MM-DD
  
  // Aggregated metrics (updated on each member completion)
  totalMembers: number;        // Total active members in cohort (excludes removed)
  completedCount: number;      // How many members completed
  completionRate: number;      // 0-100 percentage
  isThresholdMet: boolean;     // completionRate >= cohortCompletionThreshold
  
  // Member breakdown
  memberStates: Record<string, CohortTaskStateMemberState>;
  
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
  
  // Payment (one-time)
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  paidAt?: string; // ISO timestamp when payment completed
  amountPaid: number; // Amount in cents
  
  // Subscription info (for recurring programs)
  subscriptionId?: string; // Stripe subscription ID
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'expired';
  currentPeriodEnd?: string; // ISO timestamp - when subscription renews/ends
  cancelAtPeriodEnd?: boolean; // If true, subscription will end at currentPeriodEnd
  accessEndsAt?: string; // ISO timestamp - when user loses access (for grace periods)
  
  // Progress
  status: NewProgramEnrollmentStatus;
  startedAt: string; // ISO date when enrollment becomes active
  completedAt?: string; // ISO timestamp when completed
  stoppedAt?: string; // ISO timestamp if stopped early
  lastAssignedDayIndex: number; // Last program day with generated tasks
  currentDayIndex?: number; // Current day user is on (calculated)

  // Cycle tracking (for evergreen programs)
  currentCycleNumber?: number; // Current cycle (default 1), increments when evergreen program repeats
  cycleStartedAt?: string; // ISO timestamp when current cycle started
  cycleCompletedAt?: string; // ISO timestamp when current cycle completed (for analytics)

  // Weekly tracking (for programs with orientation = 'weekly')
  lastAssignedWeekIndex?: number; // Last week with synced tasks
  currentWeekIndex?: number; // Current week user is on
  lastWeeklySyncAt?: string; // ISO timestamp when weekly tasks were last synced
  weeklyTasksSynced?: boolean; // Whether current week's tasks are synced

  // Community membership (for individual programs with client community)
  joinedCommunity?: boolean; // Whether user opted into client community squad

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

// =============================================================================
// PROGRAM HIERARCHY TYPES (Modules > Weeks > Days)
// =============================================================================

/**
 * @deprecated Use TaskDistribution instead. Kept for backward compatibility.
 */
export type ProgramOrientation = 'daily' | 'weekly';

/**
 * How tasks are distributed to days within a week
 * - repeat-daily: All week tasks appear every day
 * - spread: Tasks distributed across the week (1-2 per day)
 */
export type TaskDistribution = 'repeat-daily' | 'spread';

/**
 * @deprecated Use TaskDistribution instead
 */
export type WeeklyTaskDistribution = TaskDistribution;

/**
 * Program schedule mode - what content types are in the schedule
 */
export type ProgramScheduleMode = 'calls_only' | 'courses_only' | 'hybrid';

/**
 * Program Module - Top-level container for organizing program content
 * Stored in Firestore 'program_modules' collection
 *
 * Hierarchy: Program > ProgramModule > ProgramWeek > ProgramDay
 * Client sees module/week previews but NOT individual day details until unlocked
 */
export interface ProgramModule {
  id: string;
  programId: string;
  organizationId: string; // Denormalized for queries

  // Position & Identification
  order: number; // 1-based ordering within program
  name: string; // e.g., "Foundation Phase", "Deep Work", "Integration"
  description?: string; // Rich text description for coach admin view

  // Client-facing preview (visible before unlocking)
  previewTitle?: string; // What client sees before module unlocks
  previewDescription?: string;

  // Timing - which days this module spans
  startDayIndex: number; // Day index where this module begins (1-based)
  endDayIndex: number; // Day index where this module ends (inclusive)

  // Course integration
  linkedCourseIds?: string[]; // DiscoverCourse IDs included in this module

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Program Week - Sub-container within a module
 * Stored in Firestore 'program_weeks' collection
 */
export interface ProgramWeek {
  id: string;
  programId: string;
  moduleId: string; // FK to program_modules
  organizationId: string; // Denormalized for queries

  // Position
  order: number; // 1-based within module (not global week number)
  weekNumber: number; // Global week number in program (1, 2, 3...)

  // Content
  name?: string; // Optional name, e.g., "Week 1: Getting Started"
  description?: string;
  theme?: string; // Optional theme/focus for the week

  // Day range
  startDayIndex: number;
  endDayIndex: number;

  // Weekly mode content fields
  weeklyTasks?: ProgramTaskTemplate[]; // Tasks for the entire week
  weeklyHabits?: ProgramHabitTemplate[]; // Habits for the week
  weeklyPrompt?: string; // Prompt/theme for the week
  distribution?: TaskDistribution; // How tasks are distributed to days ('repeat-daily' | 'spread')

  // Client-facing summary fields
  currentFocus?: string[]; // Max 3 key priorities for the week
  notes?: string[]; // Max 3 reminder/context items

  // Schedule references
  scheduledCallEventId?: string; // UnifiedEvent ID for weekly call (legacy single call)
  linkedCallEventIds?: string[]; // UnifiedEvent IDs linked to this week
  linkedCourseModuleIds?: string[]; // Course module IDs to complete this week

  // Call summaries and notes
  linkedSummaryIds?: string[]; // CallSummary IDs linked to this week
  manualNotes?: string; // Coach's manual notes for this week

  // Coach recordings (uploaded by coach)
  coachRecordingUrl?: string; // URL to uploaded recording file
  coachRecordingNotes?: string; // Notes/transcript from the recording

  // AI fill tracking
  fillSource?: WeekFillSource;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Track how a week's content was generated
 */
export interface WeekFillSource {
  type: 'manual' | 'ai_prompt' | 'call_summary' | 'pdf';
  sourceId?: string; // CallSummary ID or upload ID
  sourceName?: string; // "Call with John - Dec 15" or "client_goals.pdf"
  generatedAt: string;
  creditsUsed?: number; // Minutes used for transcription/summary
}


// ============================================================================
// Client-Specific Program Content (for 1:1/Individual Programs)
// ============================================================================

/**
 * Client-specific program week content.
 * For 1:1 programs where each client gets personalized content.
 * Mirrors ProgramWeek structure but scoped to a specific enrollment.
 */
export interface ClientProgramWeek {
  id: string;
  enrollmentId: string;         // FK to program_enrollments (required)
  programWeekId: string;        // FK to program_weeks (template reference)
  programId: string;            // Denormalized for queries
  organizationId: string;       // Denormalized for queries
  userId: string;               // Denormalized for queries

  // Positional info (copied from template)
  weekNumber: number;           // Global week number in program
  moduleId?: string;            // FK to program_modules
  order?: number;               // Order within module
  startDayIndex?: number;
  endDayIndex?: number;

  // Editable content (same structure as ProgramWeek)
  name?: string;
  theme?: string;
  description?: string;
  weeklyPrompt?: string;
  weeklyTasks?: ProgramTaskTemplate[];
  weeklyHabits?: ProgramHabitTemplate[];
  currentFocus?: string[];      // Max 3 key priorities
  notes?: string[];             // Max 3 reminder items
  distribution?: TaskDistribution;
  coachRecordingUrl?: string;
  coachRecordingNotes?: string;
  manualNotes?: string;

  // Client-specific references
  linkedSummaryIds?: string[];  // CallSummary IDs linked to this client's week
  linkedCallEventIds?: string[];
  fillSource?: WeekFillSource;

  // Sync tracking
  lastSyncedAt?: string;        // When last synced from template
  hasLocalChanges?: boolean;    // True if edited after sync

  createdAt: string;
  updatedAt: string;
}

/**
 * Client-specific program day content.
 * For 1:1 programs with daily orientation.
 */
export interface ClientProgramDay {
  id: string;
  enrollmentId: string;         // FK to program_enrollments
  programDayId: string;         // FK to program_days (template)
  programId: string;            // Denormalized for queries
  organizationId: string;       // Denormalized for queries
  userId: string;               // Denormalized for queries
  dayIndex: number;
  weekId?: string;              // FK to client_program_weeks

  // Content (same as ProgramDay)
  title?: string;
  summary?: string;
  dailyPrompt?: string;
  tasks: ProgramTaskTemplate[];
  habits?: ProgramHabitTemplate[];
  courseAssignments?: DayCourseAssignment[];
  fillSource?: WeekFillSource;

  // Sync tracking
  lastSyncedAt?: string;
  hasLocalChanges?: boolean;

  createdAt: string;
  updatedAt: string;
}


/**
 * Cohort-specific program day - overrides template day for a specific cohort
 * Mirrors ClientProgramDay but uses cohortId instead of enrollmentId
 * Stored in 'cohort_program_days' Firestore collection
 */
export interface CohortProgramDay {
  id: string;
  cohortId: string;             // FK to program_cohorts
  programDayId?: string;        // FK to program_days (template) if overriding
  programId: string;            // Denormalized for queries
  organizationId: string;       // Denormalized for queries
  dayIndex: number;
  weekId?: string;              // FK to program_weeks

  // Content (same as ProgramDay)
  title?: string;
  summary?: string;
  dailyPrompt?: string;
  tasks: ProgramTaskTemplate[];
  habits?: ProgramHabitTemplate[];
  courseAssignments?: DayCourseAssignment[];

  createdAt: string;
  updatedAt: string;
}

/**
 * Context for viewing/editing program content.
 * Either template mode (shared) or client-specific mode.
 */
export type ClientViewContext =
  | { mode: 'template' }
  | { mode: 'client'; enrollmentId: string; userId: string; userName: string; enrollmentStartedAt?: string };


/**
 * Context for viewing cohort-specific content in group programs
 * Similar to ClientViewContext but for group program cohorts
 */
export type CohortViewContext =
  | { mode: 'template' }
  | { mode: 'cohort'; cohortId: string; cohortName: string; cohortStartDate: string };

/**
 * Options for syncing template content to client(s).
 */
export interface TemplateSyncOptions {
  syncName?: boolean;           // Sync week name
  syncTheme?: boolean;          // Sync week theme
  syncTasks?: boolean;          // Sync weeklyTasks
  syncFocus?: boolean;          // Sync currentFocus
  syncNotes?: boolean;          // Sync notes array
  syncHabits?: boolean;         // Sync weeklyHabits
  syncPrompt?: boolean;         // Sync weeklyPrompt
  preserveClientLinks?: boolean;  // Keep client's linkedSummaryIds/linkedCallEventIds
  preserveManualNotes?: boolean;  // Keep client's manualNotes
  preserveRecordings?: boolean;   // Keep client's coachRecordingUrl/Notes
}

/**
 * Result of a template sync operation.
 */
export interface TemplateSyncResult {
  success: boolean;
  clientsUpdated: number;
  weeksUpdated: number;
  errors?: Array<{ enrollmentId: string; userId: string; error: string }>;
}

/**
 * A scheduled item for a program day/week timeline
 * Represents calls, course content, or assignments
 */
export interface ScheduledItem {
  id: string;
  type: 'call' | 'course_lesson' | 'course_module' | 'assignment';

  // Reference ID based on type
  eventId?: string; // UnifiedEvent ID for calls
  courseId?: string; // DiscoverCourse ID
  lessonId?: string; // CourseLesson ID
  moduleId?: string; // CourseModule ID
  assignmentId?: string; // Assignment ID

  // Display
  title: string;
  description?: string;

  // Timing (for timeline display)
  scheduledTime?: string; // ISO time for calls
  dueDate?: string; // For assignments
  estimatedMinutes?: number;

  // Status
  isRequired?: boolean; // Must complete to progress
  order: number; // Order within day/week
}

/**
 * Course assignment for a specific program day
 * Links course content to program days
 */
export interface DayCourseAssignment {
  courseId: string;
  moduleIds?: string[]; // Specific modules from the course
  lessonIds?: string[]; // Specific lessons (if not whole modules)
}

// =============================================================================
// CONTENT PURCHASES
// =============================================================================

/** Content type for purchases */
export type ContentPurchaseType = 'event' | 'article' | 'course' | 'download' | 'link';

/**
 * User content purchase record
 * Stored in Firestore 'user_content_purchases' collection
 * 
 * Tracks individual content purchases (courses, articles, events, downloads, links).
 * This is separate from program_enrollments which tracks program purchases.
 */
export interface ContentPurchase {
  id: string;
  userId: string;
  contentType: ContentPurchaseType;
  contentId: string;
  organizationId: string;
  
  // Payment
  amountPaid: number; // Amount in cents (0 if free or included in program)
  currency: string; // 'usd', 'eur', etc.
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  
  // For content included in programs (no separate payment)
  includedInProgramId?: string;
  includedInProgramName?: string;
  
  // Timestamps
  purchasedAt: string; // ISO timestamp
  createdAt: string;
  updatedAt?: string;
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
// ORDER BUMPS - Pre-purchase add-ons for landing pages
// ============================================================================

/** Product type for order bumps */
export type OrderBumpProductType = 'program' | 'squad' | 'content';

/** Content subtype for order bump content products */
export type OrderBumpContentType = 'event' | 'article' | 'course' | 'download' | 'link';

/**
 * Order Bump - A product offered as an add-on during checkout
 */
export interface OrderBump {
  id: string;
  productType: OrderBumpProductType;
  productId: string;
  contentType?: OrderBumpContentType; // Required when productType = 'content'
  // Cached display data (denormalized for performance)
  productName: string;
  productImageUrl?: string;
  priceInCents: number;
  currency: string;
  // Optional override copy
  headline?: string;        // e.g., "Add this to your order"
  description?: string;     // Short value proposition
  discountPercent?: number; // Optional discount (e.g., 20 = 20% off)
}

/**
 * Order Bump Configuration for a product
 * Stored on Program, Squad, and Content documents
 */
export interface OrderBumpConfig {
  enabled: boolean;
  bumps: OrderBump[];  // Max based on tier: Starter=1, Pro+=2
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
/** @deprecated SquadType is deprecated - check !!coachId instead */
export type SquadType = 'premium' | 'standard';

export interface Squad {
  id: string;
  name: string;
  slug?: string; // URL-friendly identifier for funnel join links
  avatarUrl: string;
  coverImageUrl?: string; // Cover/hero image for squad card display
  description?: string; // Optional squad description
  visibility?: SquadVisibility; // "public" or "private" - defaults to "public" if not set
  timezone?: string; // IANA timezone e.g. "Europe/Amsterdam" - defaults to "UTC"
  memberIds?: string[]; // Array of member user IDs (excludes coach)
  inviteCode?: string; // e.g. "GA-XY29Q8" - required for private squads
  /** @deprecated Check !!coachId instead - this field may be removed in future */
  hasCoach?: boolean; // Whether squad has a coach (determines call scheduling mode)
  /** @deprecated Check !!coachId instead */
  isPremium?: boolean;
  coachId: string | null; // The authoritative field for coach status
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
  // Coach-scheduled call fields (only used when hasCoach: true)
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
  // Pricing (for standalone squads with payment)
  priceInCents?: number; // Squad join price (0 = free, one-time legacy)
  currency?: string; // Currency code (default 'usd')
  // Subscription settings (standalone squads only)
  subscriptionEnabled?: boolean; // If true, joining requires recurring subscription
  stripePriceId?: string; // Stripe Price ID for recurring subscription
  stripeProductId?: string; // Stripe Product ID for the subscription
  billingInterval?: 'monthly' | 'quarterly' | 'yearly';
  // Auto-created squad info
  isAutoCreated?: boolean; // True if created automatically by enrollment system
  squadNumber?: number; // Sequential number within cohort (e.g., 1, 2, 3)
  // Lifecycle management
  gracePeriodMessageSent?: boolean; // True if grace period notification was sent
  gracePeriodStartDate?: string; // Date when grace period started (YYYY-MM-DD)
  isClosed?: boolean; // True if squad is archived/closed
  closedAt?: string; // ISO timestamp when squad was closed
  // Referral program settings (for standalone squads)
  referralConfig?: ReferralConfig;
  
  // Landing page fields (for public squad discovery)
  // Hero section
  heroHeadline?: string; // Custom hero title (overrides squad name on landing page)
  heroSubheadline?: string; // Custom hero subtitle (overrides description on landing page)
  heroCtaText?: string; // Custom CTA button text
  // Coach section
  coachBio?: string; // Coach's bio/introduction for landing page
  coachHeadline?: string; // Custom headline for coach section
  coachBullets?: string[]; // Key points/credentials about the coach
  // Other landing page content
  keyOutcomes?: string[]; // Key outcomes/benefits for joining
  features?: SquadFeature[]; // Features list for landing page
  testimonials?: SquadTestimonial[]; // Member testimonials
  faqs?: SquadFaq[]; // Frequently asked questions
  showMemberCount?: boolean; // Whether to show member count on landing page
  landingPageCoverImageUrl?: string; // Hero cover image for landing page
  
  // Order bumps - additional products offered during checkout
  orderBumps?: OrderBumpConfig;
}

// Landing page sub-types for Squad
export interface SquadFeature {
  id: string;
  icon?: string; // Emoji or icon name
  title: string;
  description: string;
}

export interface SquadTestimonial {
  id: string;
  name: string;
  title?: string; // e.g. "Squad Member" or role
  quote: string;
  imageUrl?: string;
}

export interface SquadFaq {
  id: string;
  question: string;
  answer: string;
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
  // Subscription info (for paid squads with recurring billing)
  subscriptionId?: string | null; // Stripe subscription ID
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'expired' | 'none';
  currentPeriodEnd?: string | null; // ISO timestamp - when subscription renews/ends
  cancelAtPeriodEnd?: boolean; // If true, subscription will end at currentPeriodEnd
  accessEndsAt?: string | null; // ISO timestamp - when user loses access (for grace periods)
  // Legacy fields (kept for backward compatibility)
  stripeSubscriptionId?: string; // User's subscription to this squad
  subscriptionCurrentPeriodEnd?: string; // ISO timestamp
  // Stats (real calculations will be implemented later)
  alignmentScore?: number | null;
  streak?: number | null;
  moodState?: MoodState | null;
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

export type MorningCheckInFlowStep = 
  | 'start'
  | 'accept'
  | 'breath'
  | 'reframe'
  | 'neutralize'
  | 'manifest-identity'
  | 'manifest-goal'
  | 'plan-day'
  | 'completed';

export interface CheckInProgress {
  currentStep: MorningCheckInFlowStep;
  emotionalState?: EmotionalState;
  userThought?: string;
  aiReframe?: string;
  breathingCompleted?: boolean;
  manifestIdentityCompleted?: boolean;
  manifestGoalCompleted?: boolean;
}

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
  // Original alignment activities
  didMorningCheckin: boolean;
  didSetTasks: boolean;
  didInteractWithSquad: boolean;
  hasActiveGoal: boolean;
  // New alignment activities (optional for backward compatibility)
  didEveningCheckin?: boolean;
  didCompleteTasks?: boolean;
  didCompleteHabits?: boolean;
  // Score tracking
  alignmentScore: number; // Dynamically calculated based on org config
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
  // New alignment activities
  didEveningCheckin?: boolean;
  didCompleteTasks?: boolean;
  didCompleteHabits?: boolean;
}

export interface AlignmentState {
  alignment: UserAlignment | null;
  summary: UserAlignmentSummary | null;
  isLoading: boolean;
  error: string | null;
}

// Alignment Activity Configuration Types (for coach customization)
export type AlignmentActivityKey = 
  | 'morning_checkin'
  | 'evening_checkin'
  | 'set_tasks'
  | 'complete_tasks'
  | 'chat_with_squad'
  | 'active_goal'
  | 'complete_habits';

// Threshold options for task/habit completion activities
export type CompletionThreshold = 'at_least_one' | 'half' | 'all';

// Alignment settings stored per-org
export interface AlignmentActivityConfig {
  enabledActivities: AlignmentActivityKey[];
  taskCompletionThreshold?: CompletionThreshold;  // default: 'at_least_one'
  habitCompletionThreshold?: CompletionThreshold; // default: 'at_least_one'
  weekendStreakEnabled?: boolean; // default: false - when true, weekends count toward streak
}

// Default alignment activities (for backward compatibility)
export const DEFAULT_ALIGNMENT_ACTIVITIES: AlignmentActivityKey[] = [
  'morning_checkin',
  'set_tasks',
  'chat_with_squad',
  'active_goal',
];

// Default alignment config
export const DEFAULT_ALIGNMENT_CONFIG: AlignmentActivityConfig = {
  enabledActivities: DEFAULT_ALIGNMENT_ACTIVITIES,
  taskCompletionThreshold: 'at_least_one',
  habitCompletionThreshold: 'at_least_one',
  weekendStreakEnabled: false,
};

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
  | 'squad_call_live'
  // Coaching call notifications
  | 'coaching_call_24h'
  | 'coaching_call_1h'
  | 'coaching_call_live'
  // Event notifications
  | 'event_reminder_24h'
  | 'event_reminder_1h'
  | 'event_live'
  // Feed notifications
  | 'feed_like'
  | 'feed_comment'
  | 'feed_repost'
  | 'feed_mention'
  | 'story_reaction'
  // Coach AI fill prompts
  | 'call_summary_fill_week';

export interface Notification {
  id: string;
  userId: string;
  organizationId: string;              // Multi-tenancy: Clerk Organization ID
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string; // ISO timestamp
  read: boolean;
  actionRoute?: string; // e.g. "/checkin/flow/morning"
  // Optional metadata for specific notification types
  metadata?: {
    summaryId?: string;      // For call_summary_fill_week
    programId?: string;      // For call_summary_fill_week
    weekId?: string;         // For call_summary_fill_week
    clientName?: string;     // For call_summary_fill_week
  };
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
  squadCall24h: boolean;       // Community calls (squads)
  squadCall1h: boolean;        // Community calls (squads)
  coachingCall24h: boolean;    // 1:1 coaching calls
  coachingCall1h: boolean;     // 1:1 coaching calls
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
  coachingCall24h: true,
  coachingCall1h: true,
};

// Organization-level system notification settings (controls whether in-app notifications are sent at all)
// If a system notification is disabled, the email for that type is also disabled (hard override)
export type OrgSystemNotifications = EmailPreferences;

// Default system notifications (all enabled by default)
export const DEFAULT_SYSTEM_NOTIFICATIONS: OrgSystemNotifications = {
  morningCheckIn: true,
  eveningCheckIn: true,
  weeklyReview: true,
  squadCall24h: true,
  squadCall1h: true,
  coachingCall24h: true,
  coachingCall1h: true,
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
  isRecurring?: boolean;
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

  // Denormalized user data (synced from users/org_memberships for fast list queries)
  // These eliminate the need to fetch from users collection for each client
  cachedUserFirstName?: string;
  cachedUserLastName?: string;
  cachedUserEmail?: string;
  cachedUserImageUrl?: string;
  cachedUserTimezone?: string;

  // Denormalized activity data (synced from org_memberships by cron)
  // These eliminate the need to compute activity for each client
  cachedActivityStatus?: 'thriving' | 'active' | 'inactive';
  cachedActivityAtRisk?: boolean;
  cachedActivityLastAt?: string;
  cachedActivityDaysActive?: number;
  cachedDataUpdatedAt?: string; // When denormalized data was last synced
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

// Standard Squad Call Types (for squads without coach - member-proposed calls)
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
  id: string; // Format: `${squadId}_${callId}_${jobType}` or `${squadId}_coach_${jobType}`
  squadId: string;
  squadName: string;
  hasCoach: boolean; // Whether squad has a coach (determines call scheduling mode)
  /** @deprecated Use hasCoach instead */
  isPremiumSquad?: boolean;
  callId?: string; // For squads without coach (member-proposed calls)
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

// Questionnaire Types (re-export from questionnaire.ts)
export * from './questionnaire';

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
 * - platform_billing: User pays Coachful directly
 * - coach_billing: Coach handles billing (Stripe Connect)
 * - manual: Coach manually grants access (external billing)
 * - invite_code: User redeemed an invite code
 * - funnel: User gained access through a funnel link
 */
export type OrgAccessSource = 'platform_billing' | 'coach_billing' | 'manual' | 'invite_code' | 'funnel';

/**
 * Organization billing mode
 * - platform: Users pay Coachful directly
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
  /** @deprecated UserTier is deprecated - access controlled by program/squad membership */
  tier?: UserTier;
  track: UserTrack | null;             // Business track within this org
  squadIds?: string[];                 // Squads within this org (supports multiple)
  /** @deprecated Use squadIds instead */
  squadId?: string | null;
  /** @deprecated Use squadIds instead */
  premiumSquadId?: string | null;
  accessSource: OrgAccessSource;       // How access was granted
  accessExpiresAt: string | null;      // For manual/external billing - ISO date when access expires
  inviteCodeUsed: string | null;       // Invite code that granted access (if applicable)
  isActive: boolean;                   // Whether membership is active
  joinedAt: string;                    // ISO timestamp when user joined this org
  createdAt: string;                   // ISO timestamp
  updatedAt: string;                   // ISO timestamp
  
  // Access control fields (optional - computed/synced fields)
  // SECURITY: These are cached values synced by syncAccessStatus(). When checking access:
  //   SAFE:   if (hasActiveAccess === true)  // undefined = denied
  //   UNSAFE: if (hasActiveAccess !== false) // undefined would allow access!
  hasActiveAccess?: boolean;           // Whether user can access org (derived from program/squad membership)
  accessReason?: UserAccessReason;     // Why user has access (program, squad, coach_assigned, staff, none)
  
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
  /** @deprecated UserTier is deprecated - access controlled by program/squad membership */
  tier?: UserTier;
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

/**
 * Empty state behavior for menu items
 * - 'hide': Hide the menu item entirely when user has no content
 * - 'discover': Show the menu item with a discover/find page
 */
export type EmptyStateBehavior = 'hide' | 'discover';

export interface OrgSettings {
  id: string;                          // Same as organizationId
  organizationId: string;              // Clerk Organization ID
  billingMode: OrgBillingMode;         // How users are billed
  allowExternalBilling: boolean;       // Whether coaches can manually grant access
  /** @deprecated UserTier is deprecated - access controlled by program/squad membership */
  defaultTier?: UserTier;
  defaultTrack: UserTrack | null;      // Default track for new members (null = user chooses)
  stripeConnectAccountId: string | null; // For coach billing mode
  stripeConnectStatus: StripeConnectStatus; // Status of Stripe Connect account
  platformFeePercent: number;          // Platform fee percentage (0-100, default 10)
  requireApproval: boolean;            // Whether new signups need coach approval
  autoJoinSquadId: string | null;      // Auto-assign new members to this squad
  welcomeMessage: string | null;       // Custom welcome message for new members
  
  // Coach platform subscription (optional - not all orgs have coach subscriptions)
  coachTier?: CoachTier;               // Coach's platform tier (starter, pro, scale)
  coachSubscriptionId?: string | null; // FK to coach_subscriptions collection
  
  // Default funnel for non-members (optional)
  defaultFunnelId?: string | null;     // Funnel to redirect users without access
  
  // Social Feed feature (optional - coach can enable/disable)
  feedEnabled?: boolean;               // Whether social feed is enabled for this org (default: false)
  
  // Alumni & Community settings
  defaultConvertToCommunity?: boolean; // If true, all new cohorts default to convert to community after ending
  
  // Alumni discount settings
  alumniDiscountEnabled?: boolean;     // If true, alumni get automatic discount
  alumniDiscountType?: 'percentage' | 'fixed'; // Type of discount
  alumniDiscountValue?: number;        // 20 for 20% or 2000 for $20
  
  // Menu empty state behavior (what to show when user has no program/squad)
  programEmptyStateBehavior?: EmptyStateBehavior; // default: 'discover'
  squadEmptyStateBehavior?: EmptyStateBehavior;   // default: 'discover'
  
  // Content categories (coach-defined)
  articleCategories?: string[];        // Coach-defined article categories for the org
  
  // Daily Focus settings
  defaultDailyFocusSlots?: number;     // 1-6, default 3 - hard cap for all users in this org
  
  // Alignment score customization (which activities count toward alignment)
  alignmentConfig?: AlignmentActivityConfig;
  
  // Public signup settings
  publicSignupEnabled?: boolean;       // default: true - whether public signup is allowed (if false, shows "contact coach" page)
  
  // Global tracking pixels (applied to all funnels in this org)
  globalTracking?: FunnelTrackingConfig; // Organization-wide tracking pixels
  
  // Email notification preferences (which email types are enabled)
  emailPreferences?: CoachEmailPreferences;
  
  createdAt: string;                   // ISO timestamp
  updatedAt: string;                   // ISO timestamp
}

/**
 * Coach/Organization-level email type preferences
 * Controls which types of emails are sent from the coach's organization
 */
export interface CoachEmailPreferences {
  // Verification emails - always enabled, cannot be disabled
  verificationEnabled: boolean;
  
  // Welcome email after successful payment
  welcomeEnabled: boolean;
  
  // Abandoned cart email (15min after quiz start without payment)
  abandonedCartEnabled: boolean;
  
  // Morning check-in reminder
  morningReminderEnabled: boolean;
  
  // Evening reflection reminder
  eveningReminderEnabled: boolean;
  
  // Weekly reflection reminder
  weeklyReminderEnabled: boolean;
  
  // Payment failed notification (for coaches) - always enabled
  paymentFailedEnabled: boolean;

  // Call Scheduling Email Preferences
  // Notification when someone requests or proposes a call
  callRequestReceivedEnabled: boolean;

  // Confirmation when a call is scheduled/confirmed
  callConfirmedEnabled: boolean;

  // Notification when a call proposal is declined
  callDeclinedEnabled: boolean;

  // Notification when new times are suggested (counter-proposal)
  callCounterProposedEnabled: boolean;

  // Notification when someone requests to reschedule
  callRescheduledEnabled: boolean;

  // Notification when a call is cancelled
  callCancelledEnabled: boolean;
}

/**
 * Default coach email preferences
 */
export const DEFAULT_COACH_EMAIL_PREFERENCES: CoachEmailPreferences = {
  verificationEnabled: true,
  welcomeEnabled: true,
  abandonedCartEnabled: true,
  morningReminderEnabled: true,
  eveningReminderEnabled: true,
  weeklyReminderEnabled: true,
  paymentFailedEnabled: true,
  // Call Scheduling (all enabled by default)
  callRequestReceivedEnabled: true,
  callConfirmedEnabled: true,
  callDeclinedEnabled: true,
  callCounterProposedEnabled: true,
  callRescheduledEnabled: true,
  callCancelledEnabled: true,
};

/**
 * Default organization settings
 */
export const DEFAULT_ORG_SETTINGS: Omit<OrgSettings, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> = {
  billingMode: 'platform',
  allowExternalBilling: true,
  defaultTrack: null,
  stripeConnectAccountId: null,
  stripeConnectStatus: 'not_connected',
  platformFeePercent: 1, // Platform fee: 1% of all coach payments
  requireApproval: false,
  autoJoinSquadId: null,
  welcomeMessage: null,
  coachTier: 'starter',
  coachSubscriptionId: null,
  defaultFunnelId: null,
  feedEnabled: false, // Social feed disabled by default - coach must enable
  defaultConvertToCommunity: false, // Don't auto-convert by default
  alumniDiscountEnabled: false,
  alumniDiscountType: 'percentage',
  alumniDiscountValue: 0,
  programEmptyStateBehavior: 'discover', // Show find program page by default
  squadEmptyStateBehavior: 'discover',   // Show find squad page by default
  defaultDailyFocusSlots: 3,             // Default: 3 daily focus tasks (matches current behavior)
  alignmentConfig: DEFAULT_ALIGNMENT_CONFIG, // Default alignment activities
  publicSignupEnabled: true,             // Public signup enabled by default
  emailPreferences: DEFAULT_COACH_EMAIL_PREFERENCES, // Email notifications enabled by default
};

/**
 * Platform organization ID constant
 * This is the "Coachful Platform" org for existing platform users
 */
export const PLATFORM_ORGANIZATION_SLUG = 'coachful-platform';

// =============================================================================
// ORGANIZATION BRANDING TYPES
// =============================================================================

/**
 * Theme preference for an organization
 */
export type OrgDefaultTheme = 'light' | 'dark' | 'system';

/**
 * Branding colors for an organization
 * Only accent colors are customizable (menu and page backgrounds use theme defaults)
 */
export interface OrgBrandingColors {
  accentLight: string;         // Accent/primary color in light mode (default: "#a07855")
  accentDark: string;          // Accent/primary color in dark mode (default: "#b8896a")
  // Text colors for accent backgrounds (computed based on accent luminance)
  accentLightForeground?: string;  // Text color on accentLight bg (default: "#ffffff" if dark accent, "#1a1a1a" if light)
  accentDarkForeground?: string;   // Text color on accentDark bg (default: "#ffffff" if dark accent, "#1a1a1a" if light)
}

/**
 * Menu item keys for ordering
 * These are the reorderable navigation items in the sidebar
 */
export type MenuItemKey = 'home' | 'program' | 'squad' | 'feed' | 'learn' | 'chat' | 'coach';

/**
 * Customizable menu titles for an organization
 * Allows coaches to rebrand navigation items (e.g., "Squad" to "Cohort")
 */
export interface OrgMenuTitles {
  home: string;                // Default: "Home"
  squad: string;               // Default: "Squad" - can be "Cohort", "Team", "Group", etc.
  program: string;             // Default: "Program" - can be "Journey", "Path", etc.
  feed: string;                // Default: "Feed" - can be "Community", "Wall", etc.
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
 * Custom email template
 * Supports variables: {{firstName}}, {{appTitle}}, {{teamName}}, {{logoUrl}}, {{ctaUrl}}, {{year}}
 */
export interface EmailTemplate {
  subject: string;
  html: string;
  updatedAt: string;
}

/**
 * Email template types that can be customized by coaches
 */
export type EmailTemplateType = 
  | 'welcome'
  | 'abandonedCart'
  | 'morningReminder'
  | 'eveningReminder'
  | 'weeklyReminder'
  | 'paymentFailed';

/**
 * Organization email templates (custom email content)
 * Only available when emailSettings.status === 'verified'
 */
export interface OrgEmailTemplates {
  welcome?: EmailTemplate;
  abandonedCart?: EmailTemplate;
  morningReminder?: EmailTemplate;
  eveningReminder?: EmailTemplate;
  weeklyReminder?: EmailTemplate;
  paymentFailed?: EmailTemplate;
}

/**
 * Organization branding settings
 * Stored in Firestore: org_branding/{organizationId}
 * 
 * This is keyed by Clerk Organization ID to support future multi-tenant
 * subdomain/custom domain scenarios where each coach has their own instance.
 */
/**
 * Logo source type - tracks whether logo is generated or custom
 */
export type LogoSource = 'generated' | 'custom';

/**
 * Enrollment rules for an organization
 * Controls which program combinations users can enroll in simultaneously
 */
export interface OrgEnrollmentRules {
  allowCohortWithCohort: boolean;      // Can user be in multiple cohort-based programs? (default: false)
  allowCohortWithEvergreen: boolean;   // Can user join evergreen while in cohort? (default: true)
  allowEvergreenWithEvergreen: boolean; // Can user be in multiple evergreen programs? (default: true)
  allowIndividualWithCohort: boolean;  // Can user have 1:1 + group cohort? (default: true)
  allowIndividualWithEvergreen: boolean; // Can user have 1:1 + evergreen? (default: true)
  allowIndividualWithIndividual: boolean; // Can user have multiple 1:1 programs? (default: false)
}

/**
 * Default enrollment rules - permissive for evergreen, restrictive for time-bound
 */
export const DEFAULT_ENROLLMENT_RULES: OrgEnrollmentRules = {
  allowCohortWithCohort: false,
  allowCohortWithEvergreen: true,
  allowEvergreenWithEvergreen: true,
  allowIndividualWithCohort: true,
  allowIndividualWithEvergreen: true,
  allowIndividualWithIndividual: false,
};

export interface OrgBranding {
  id: string;                    // Same as organizationId
  organizationId: string;        // Clerk Organization ID
  logoUrl: string | null;        // Custom square logo URL (null = use default)
  logoUrlDark: string | null;    // Custom square logo URL for dark mode (null = use logoUrl)
  horizontalLogoUrl: string | null; // Custom horizontal/wide logo URL (replaces square logo + title if set)
  horizontalLogoUrlDark: string | null; // Custom horizontal logo URL for dark mode (null = use horizontalLogoUrl)
  logoSource?: LogoSource;       // 'generated' = auto-created from initials, 'custom' = coach-uploaded
  appTitle: string;              // App title shown in sidebar (default: "Coachful")
  colors: OrgBrandingColors;
  menuTitles?: OrgMenuTitles;    // Customizable menu titles (optional, uses defaults if not set)
  menuIcons?: OrgMenuIcons;      // Customizable menu icons/emojis (optional, uses defaults if not set)
  menuOrder?: MenuItemKey[];     // Custom menu order (optional, uses DEFAULT_MENU_ORDER if not set)
  emailSettings?: OrgEmailSettings; // Whitelabel email settings (optional)
  emailTemplates?: OrgEmailTemplates; // Custom email templates (optional, requires verified email domain)
  defaultTheme?: OrgDefaultTheme; // Default theme for the organization (default: 'light')
  enrollmentRules?: OrgEnrollmentRules; // Enrollment rules (optional, uses DEFAULT_ENROLLMENT_RULES if not set)
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

/**
 * Default theme for organizations
 */
export const DEFAULT_THEME: OrgDefaultTheme = 'system';

/**
 * Default branding values (matches current hardcoded theme)
 */
export const DEFAULT_BRANDING_COLORS: OrgBrandingColors = {
  accentLight: '#a07855',
  accentDark: '#b8896a',
  accentLightForeground: '#ffffff',  // White text on brown
  accentDarkForeground: '#ffffff',   // White text on brown
};

export const DEFAULT_APP_TITLE = 'Coachful';
export const DEFAULT_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=78f383ba-0074-4375-985c-f623e8c90d70';

export const DEFAULT_MENU_TITLES: OrgMenuTitles = {
  home: 'Home',
  squad: 'Squad',
  program: 'Program',
  feed: 'Feed',      // Social feed
  learn: 'Discover', // Renamed from "Learn" to "Discover"
  chat: 'Chat',
  coach: 'Coach',
};

/**
 * Customizable menu icons for an organization
 * Allows coaches to select icons or emojis for navigation items
 * Icon values can be:
 * - A predefined icon name (e.g., 'home', 'rocket', 'search')
 * - An emoji string (e.g., '🏠', '🚀', '🔍')
 */
export interface OrgMenuIcons {
  home: string;
  squad: string;
  program: string;
  feed: string;      // Social feed
  learn: string;     // Discover
  chat: string;
  coach: string;
}

export const DEFAULT_MENU_ICONS: OrgMenuIcons = {
  home: 'home',
  squad: 'users',
  program: 'rocket',
  feed: 'sparkles',  // Sparkles icon for Feed
  learn: 'search',   // Magnifying glass for Discover
  chat: 'message',
  coach: 'user',
};

/**
 * Default menu order for navigation items
 * Coaches can reorder these items via drag-and-drop in the branding settings
 */
export const DEFAULT_MENU_ORDER: MenuItemKey[] = ['home', 'program', 'squad', 'feed', 'learn', 'chat', 'coach'];

export const DEFAULT_EMAIL_SETTINGS: OrgEmailSettings = {
  domain: null,
  resendDomainId: null,
  status: 'not_started',
  dnsRecords: [],
  verifiedAt: null,
  fromName: 'Coachful',
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
  subdomain: string;             // e.g., "acme" for acme.coachful.co (unique, lowercase)
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
  | 'explainer'      // Rich media explainer (image, video, embed)
  | 'landing_page'   // Full drag-and-drop landing page builder
  | 'upsell'         // One-click upsell offer after payment
  | 'downsell'       // Shown if user declines preceding upsell
  | 'info'           // [DEPRECATED] Use 'explainer' - kept for backward compatibility
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
 * Funnel target type - what the funnel enrolls users into
 */
export type FunnelTargetType = 'program' | 'squad' | 'content';

/**
 * Content type for content funnels
 */
export type FunnelContentType = 'article' | 'course' | 'event' | 'download' | 'link';

/**
 * Funnel - Coach-created user acquisition flow
 * Stored in Firestore 'funnels' collection
 */
export interface Funnel {
  id: string;
  organizationId: string;        // Clerk Organization ID (multi-tenant)
  
  // Target - funnel can target a program, squad, or content item
  targetType: FunnelTargetType;  // What this funnel enrolls users into
  programId: string | null;      // Program ID (when targetType = 'program')
  squadId: string | null;        // Squad ID (when targetType = 'squad')
  contentType?: FunnelContentType; // Content type (when targetType = 'content')
  contentId?: string;            // Content item ID (when targetType = 'content')
  
  // Identification
  slug: string;                  // URL-friendly identifier
  name: string;                  // Display name (e.g., "Discovery Quiz", "Direct Join")
  description?: string;          // Optional description
  
  // Settings
  isDefault: boolean;            // Default funnel for the target (program or squad)
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
  
  // Tracking
  tracking?: FunnelTrackingConfig;  // Pixel IDs and custom scripts
}

// ============================================================================
// FUNNEL TRACKING TYPES
// ============================================================================

/**
 * Standard Meta Pixel events that can be fired
 */
export type MetaPixelEvent = 
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'Lead'
  | 'CompleteRegistration'
  | 'Subscribe'
  | 'Contact'
  | 'CustomizeProduct'
  | 'FindLocation'
  | 'Schedule'
  | 'Search'
  | 'StartTrial'
  | 'SubmitApplication';

/**
 * Funnel-level tracking configuration (pixel IDs, loaded once per funnel)
 */
export interface FunnelTrackingConfig {
  metaPixelId?: string;           // Meta/Facebook Pixel ID (e.g., "1234567890")
  googleAnalyticsId?: string;     // Google Analytics 4 ID (e.g., "G-XXXXXXX")
  googleAdsId?: string;           // Google Ads ID (e.g., "AW-XXXXXXX")
  customHeadHtml?: string;        // Custom scripts to inject in <head>
  customBodyHtml?: string;        // Custom scripts to inject in <body>
}

/**
 * Step-level tracking configuration (events to fire when step is reached)
 */
export interface FunnelStepTrackingConfig {
  metaEvent?: MetaPixelEvent;                    // Meta Pixel event to fire
  metaEventParams?: Record<string, unknown>;     // Additional Meta event parameters
  googleEvent?: string;                          // Google Analytics event name
  googleEventParams?: Record<string, unknown>;   // GA event parameters
  googleAdsConversionLabel?: string;             // Google Ads conversion label (e.g., "AbC123")
  customHtml?: string;                           // Step-specific script to execute
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
  imageDisplayMode?: 'inline' | 'card'; // How to display option images (inline: small thumbnail next to text, card: larger grid)
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

/**
 * Explainer media types
 */
export type ExplainerMediaType = 
  | 'image'          // Uploaded or URL image
  | 'video_upload'   // Uploaded video file
  | 'youtube'        // YouTube embed
  | 'vimeo'          // Vimeo embed
  | 'loom'           // Loom embed
  | 'iframe';        // Generic iframe/embed code

/**
 * Explainer layout options
 */
export type ExplainerLayout = 
  | 'media_top'      // Media above text (default)
  | 'media_bottom'   // Text above media
  | 'fullscreen'     // Media only, no text (just CTA)
  | 'side_by_side';  // Media + text side-by-side (desktop)

/**
 * Explainer step configuration - rich media with layouts
 */
export interface FunnelStepConfigExplainer {
  heading?: string;
  body?: string;
  ctaText?: string;
  // Media configuration
  mediaType?: ExplainerMediaType;
  imageUrl?: string;           // For 'image' type
  videoUrl?: string;           // For 'video_upload' type
  youtubeUrl?: string;         // For 'youtube' type (full URL)
  vimeoUrl?: string;           // For 'vimeo' type
  loomUrl?: string;            // For 'loom' type
  iframeCode?: string;         // For 'iframe' type (raw embed code or URL)
  // Layout
  layout?: ExplainerLayout;
  // Video options
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
}

export interface FunnelStepConfigSuccess {
  heading?: string;
  body?: string;
  showConfetti?: boolean;
  celebrationSound?: string;     // Music file ID from Firebase Storage (empty = no sound)
  redirectDelay?: number;        // ms before redirect to dashboard
  skipSuccessPage?: boolean;     // Skip success page and redirect immediately
  skipSuccessRedirect?: string;  // Custom redirect URL (default: homepage)
}

// ============================================================================
// LANDING PAGE TYPES
// ============================================================================

/**
 * Landing page template name type
 */
export type LandingPageTemplateName = 'classic' | 'modern' | 'minimal';

/**
 * Landing page template definition with Puck data
 */
export interface LandingPageTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: string;
  puckData: {
    content: Array<{
      type: string;
      props: Record<string, unknown>;
    }>;
    root: Record<string, unknown>;
  };
}

/**
 * Landing page step configuration - unified for both Programs and Funnels
 */
export interface FunnelStepConfigLandingPage {
  template: LandingPageTemplateName;
  headline?: string;
  subheadline?: string;
  coachBio?: string;
  keyOutcomes?: string[];
  features?: ProgramFeature[];
  testimonials?: ProgramTestimonial[];
  faqs?: ProgramFAQ[];
  ctaText?: string;
  ctaSubtext?: string;
  showTestimonials?: boolean;
  showFAQ?: boolean;
  showPrice?: boolean; // Default true - only used in funnel LPs to optionally hide price
  // Program display props
  programName?: string;
  programDescription?: string;
  programImageUrl?: string;
  priceInCents?: number;
  subscriptionEnabled?: boolean;
  billingInterval?: 'monthly' | 'quarterly' | 'yearly';
  durationDays?: number;
  enrolledCount?: number;
  programType?: 'individual' | 'group';
  coachName?: string;
  coachImageUrl?: string;
}

// ============================================================================
// UPSELL/DOWNSELL TYPES
// ============================================================================

/**
 * Product types available for upsell/downsell (extensible for future products)
 * - 'article' maps to content_access collection for generic content
 * - 'course' maps to course_enrollments collection with progress tracking
 */
export type UpsellProductType = 'program' | 'squad' | 'course' | 'article' | 'content';

/**
 * Cohort selection mode for upsell/downsell program offers
 * - 'next_available': Auto-select the next cohort with a future start date
 * - 'specific': Use a specific cohort selected by the coach
 */
export type CohortSelectionMode = 'next_available' | 'specific';

/**
 * Upsell step configuration - one-click offer shown after payment
 */
export interface FunnelStepConfigUpsell {
  productType: UpsellProductType;
  productId: string;                    // ID of program/squad/etc
  productName: string;                  // Cached for display
  productImageUrl?: string;
  headline: string;                     // "Wait! Special One-Time Offer"
  description: string;                  // Benefits/pitch text
  originalPriceInCents: number;         // Show original price (for strikethrough)
  discountType: 'none' | 'percent' | 'fixed';
  discountValue?: number;               // Percent (0-100) or cents
  finalPriceInCents: number;            // Calculated final price after discount
  isRecurring: boolean;                 // One-time vs subscription
  recurringInterval?: 'month' | 'year'; // If recurring
  stripePriceId?: string;               // Stripe price ID (existing or created)
  stripeCouponId?: string;              // Stripe coupon ID if discounted
  ctaText: string;                      // "Add to Order"
  declineText: string;                  // "No thanks, skip this"
  linkedDownsellStepId?: string;        // Which downsell shows if declined
  // Cohort selection for group programs
  cohortSelectionMode?: CohortSelectionMode; // Default: 'next_available'
  cohortId?: string;                    // Specific cohort ID (when mode is 'specific')
}

/**
 * Downsell step configuration - shown if user declines preceding upsell
 */
export interface FunnelStepConfigDownsell {
  productType: UpsellProductType;
  productId: string;
  productName: string;
  productImageUrl?: string;
  headline: string;
  description: string;
  originalPriceInCents: number;
  discountType: 'none' | 'percent' | 'fixed';
  discountValue?: number;
  finalPriceInCents: number;
  isRecurring: boolean;
  recurringInterval?: 'month' | 'year';
  stripePriceId?: string;
  stripeCouponId?: string;
  ctaText: string;
  declineText: string;
  // Cohort selection for group programs
  cohortSelectionMode?: CohortSelectionMode; // Default: 'next_available'
  cohortId?: string;                    // Specific cohort ID (when mode is 'specific')
}

// ============================================================================
// INFLUENCE PROMPT TYPES
// ============================================================================

/**
 * Influence prompt types for persuasion psychology
 */
export type InfluencePromptType = 
  | 'social_proof'   // Testimonials, user counts, success stories
  | 'authority'      // Expert endorsements, credentials, "As seen in"
  | 'urgency'        // Time-limited offers, countdown timers
  | 'scarcity'       // Limited spots, limited availability
  | 'reciprocity'    // Free bonuses, gifts included
  | 'commitment';    // Progress indicators, "You're X% there"

/**
 * Social proof testimonial configuration
 */
export interface InfluenceTestimonial {
  quote: string;
  name: string;
  role?: string;              // e.g., "Entrepreneur" or "Lost 30 lbs"
  avatarUrl?: string;
  result?: string;            // e.g., "Achieved goal in 60 days"
}

/**
 * Authority endorsement configuration
 */
export interface InfluenceAuthority {
  name?: string;              // Expert/brand name
  title?: string;             // e.g., "PhD, Harvard"
  credentialText?: string;    // e.g., "Featured in Forbes, Inc., Entrepreneur"
  logoUrl?: string;           // Brand/publication logo
  endorsement?: string;       // Quote or endorsement text
}

/**
 * Urgency timer configuration
 */
export interface InfluenceUrgency {
  deadlineText?: string;      // e.g., "Special pricing ends in"
  countdownMinutes?: number;  // Minutes from session start (stored per-user)
  showPulse?: boolean;        // Pulsing animation effect
}

/**
 * Scarcity indicator configuration
 */
export interface InfluenceScarcity {
  totalSpots?: number;        // e.g., 50
  remainingSpots?: number;    // e.g., 7
  showProgressBar?: boolean;  // Show visual fill indicator
  customText?: string;        // e.g., "Only {remaining} spots left!"
  memberAvatars?: string[];   // Real user avatar URLs to display (if available)
}

/**
 * Reciprocity bonus configuration
 */
export interface InfluenceReciprocity {
  bonusName?: string;         // e.g., "Free Goal-Setting Workbook"
  bonusValue?: string;        // e.g., "$197 value"
  bonusDescription?: string;  // Short description
  bonusImageUrl?: string;     // Bonus product image
}

/**
 * Commitment progress configuration
 */
export interface InfluenceCommitment {
  progressPercent?: number;   // 0-100, or calculated automatically
  milestoneText?: string;     // e.g., "Just 2 more steps to your personalized plan!"
  showCheckmarks?: boolean;   // Show completed step checkmarks
}

/**
 * Influence prompt configuration - one per funnel step
 */
export interface InfluencePromptConfig {
  type: InfluencePromptType;
  enabled: boolean;
  
  // Shared fields (optional overrides)
  headline?: string;          // Custom headline text
  subtext?: string;           // Additional context text
  icon?: string;              // Lucide icon name (e.g., "star", "shield", "clock")
  accentColor?: string;       // Override org primary color
  
  // Type-specific configurations
  testimonial?: InfluenceTestimonial;
  authority?: InfluenceAuthority;
  urgency?: InfluenceUrgency;
  scarcity?: InfluenceScarcity;
  reciprocity?: InfluenceReciprocity;
  commitment?: InfluenceCommitment;
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
  | { type: 'explainer'; config: FunnelStepConfigExplainer }
  | { type: 'landing_page'; config: FunnelStepConfigLandingPage }
  | { type: 'upsell'; config: FunnelStepConfigUpsell }
  | { type: 'downsell'; config: FunnelStepConfigDownsell }
  | { type: 'info'; config: FunnelStepConfigInfo }  // [DEPRECATED] Use 'explainer'
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
  
  // Influence prompt (persuasion card shown at bottom of step)
  influencePrompt?: InfluencePromptConfig;
  
  // Tracking events (fired when this step is reached)
  tracking?: FunnelStepTrackingConfig;
  
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
  programId?: string | null;      // Optional for squad-type funnels
  organizationId: string;
  
  // User linking
  userId: string | null;         // null until signup step completes
  linkedAt: string | null;       // When userId was linked
  
  // Invite tracking
  inviteId: string | null;       // If user came via invite code
  
  // Referral tracking
  referrerId?: string;           // User ID of the person who referred this user
  referralId?: string;           // Referral record ID (in 'referrals' collection)
  
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
  programId?: string | null;     // Optional for squad-type funnels
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

// =============================================================================
// CHECK-IN FLOW SYSTEM TYPES
// Unified check-in flows (morning, evening, weekly) with step-based builder
// =============================================================================

/**
 * Check-in flow type - the category of check-in
 */
export type CheckInFlowType = 'morning' | 'evening' | 'weekly' | 'custom';

/**
 * Flow show condition types - for conditional display of custom flows on homepage
 */
export type FlowShowConditionType = 
  | 'time_window'         // Between specific hours
  | 'day_of_week'         // On specific days
  | 'habit_completed'     // After completing a habit
  | 'tasks_completed'     // After completing N tasks
  | 'flow_completed'      // After completing morning/evening/weekly
  | 'not_completed_today'; // Only show if not already done today

/**
 * Individual condition for when to show a flow
 */
export type FlowShowCondition =
  | { type: 'time_window'; startHour: number; endHour: number; }
  | { type: 'day_of_week'; days: number[]; }  // 0=Sun, 1=Mon, ..., 6=Sat
  | { type: 'habit_completed'; habitId?: string; anyHabit?: boolean; }
  | { type: 'tasks_completed'; minCount: number; }
  | { type: 'flow_completed'; flowType: 'morning' | 'evening' | 'weekly'; }
  | { type: 'not_completed_today'; };

/**
 * Show conditions configuration for a flow
 */
export interface FlowShowConditions {
  logic: 'and' | 'or';
  conditions: FlowShowCondition[];
}

/**
 * Display configuration for flow prompt card on homepage
 */
export interface FlowDisplayConfig {
  icon?: string;           // Lucide icon name (e.g., 'coffee', 'sun') or emoji
  gradient?: string;       // CSS gradient or Tailwind class (e.g., 'from-blue-500 to-purple-600')
  title: string;           // Card title (e.g., "Midday Reset")
  subtitle?: string;       // Card subtitle (e.g., "Take a mindful break")
}

/**
 * Check-in step types - specific to check-in flows
 * Extends funnel step types where applicable
 */
export type CheckInStepType =
  | 'explainer'           // Text + optional media (reused from funnels)
  | 'mood_scale'          // Emotional state/mood selector (confidence, on-track, etc.)
  | 'single_select'       // Single choice question
  | 'multi_select'        // Multiple choice question
  | 'open_text'           // Free-form text input (journal/reflection)
  | 'task_planner'        // Plan your day - tasks management
  | 'task_review'         // Review task completion (evening)
  | 'breathing'           // Guided breathing exercise
  | 'accept'              // Acceptance step (from morning check-in)
  | 'reframe'             // Alias for reframe_input (legacy)
  | 'reframe_input'       // User thought input for AI reframe
  | 'ai_reframe'          // AI reframe response display
  | 'ai_reframe_input'    // Alias for ai_reframe (legacy)
  | 'ai_reframe_output'   // Alias for ai_reframe (legacy)
  | 'begin_manifest'      // Transition screen before manifestation
  | 'visualization'       // Manifestation: goal + identity + optional music
  | 'progress_scale'      // Weekly progress slider (0-100%)
  | 'completion'          // End screen with celebration
  | 'goal_achieved'       // Conditional end screen when goal is 100%
  // Evening check-in specific steps
  | 'evening_task_review' // Evening task review with completion status
  | 'evening_mood'        // 5-state evening mood slider (tough_day → great_day)
  | 'evening_reflection'  // Text with voice input for evening reflection
  // Weekly check-in specific steps
  | 'on_track_scale'      // 3-state weekly on-track slider
  | 'momentum_progress'   // Weekly progress with momentum physics + audio
  | 'voice_text'          // Enhanced text input with voice-to-text
  | 'weekly_focus';       // Public focus with AI suggestion

/**
 * Check-in step configuration types
 */
export interface CheckInStepConfigMoodScale {
  question: string;                     // e.g., "How are you feeling today?"
  scaleType: 'emotional_state' | 'on_track' | 'custom';
  options: {
    value: string;
    label: string;
    color?: string;                     // Background gradient color
  }[];
  skipCondition?: {                     // Skip next steps based on value
    values: string[];
    skipToStepId?: string;
  };
}

export interface CheckInStepConfigSingleSelect {
  question: string;
  description?: string;
  options: {
    id: string;
    label: string;
    value: string;
    icon?: string;
  }[];
  fieldName: string;                    // Key to store response
}

export interface CheckInStepConfigMultiSelect {
  question: string;
  description?: string;
  options: {
    id: string;
    label: string;
    value: string;
    icon?: string;
  }[];
  fieldName: string;
  minSelections?: number;
  maxSelections?: number;
}

export interface CheckInStepConfigOpenText {
  question: string;
  description?: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  fieldName: string;
  isRequired?: boolean;
}

export interface CheckInStepConfigTaskPlanner {
  heading?: string;
  description?: string;
  showProgramTasks?: boolean;           // Show tasks from enrolled program
  allowAddTasks?: boolean;
  showBacklog?: boolean;
}

export interface CheckInStepConfigTaskReview {
  heading?: string;
  completedMessage?: string;
  partialMessage?: string;
  noTasksMessage?: string;
}

export interface CheckInStepConfigBreathing {
  heading?: string;
  description?: string;
  pattern: {
    inhale: number;                     // seconds
    hold?: number;
    exhale: number;
  };
  cycles: number;
  backgroundGradient?: string;
}

export interface CheckInStepConfigAccept {
  heading?: string;
  message?: string;
}

export interface CheckInStepConfigReframeInput {
  heading?: string;
  placeholder?: string;
  promptTemplate?: string;              // System prompt for AI
}

export interface CheckInStepConfigAiReframe {
  heading?: string;
  loadingMessage?: string;
}

export interface CheckInStepConfigBeginManifest {
  heading?: string;
}

export interface CheckInStepConfigVisualization {
  heading?: string;
  showGoal?: boolean;
  showIdentity?: boolean;
  backgroundMusicUrl?: string;
  durationSeconds?: number;
}

export interface CheckInStepConfigProgressScale {
  question: string;
  description?: string;
  showGoal?: boolean;                   // Display user's current goal
  goalAchievedThreshold?: number;       // Trigger goal achieved flow (default: 100)
}

export interface CheckInStepConfigCompletion {
  heading: string;
  subheading?: string;
  emoji?: string;
  showConfetti?: boolean;
  buttonText?: string;
  variant?: 'day_closed' | 'week_closed' | 'great_job' | 'custom';
  flowType?: 'morning' | 'evening' | 'weekly';
  confettiCount?: number;
}

export interface CheckInStepConfigGoalAchieved {
  heading: string;
  description?: string;
  emoji?: string;
  showCreateNewGoal?: boolean;
  showSkipOption?: boolean;
  flowType?: 'weekly';
  isGoalAchieved?: boolean;
}

export interface CheckInStepConfigExplainer {
  heading?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  ctaText?: string;
}

// Evening check-in specific config types
export interface CheckInStepConfigEveningTaskReview {
  heading?: string;
  completedMessage?: string;
  partialMessage?: string;
  noTasksMessage?: string;
  showTaskList?: boolean;
  allowTaskEdit?: boolean;
}

export interface CheckInStepConfigEveningMood {
  question?: string;
  options: {
    value: string;
    label: string;
    gradient: string;
  }[];
}

export interface CheckInStepConfigEveningReflection {
  question?: string;
  placeholder?: string;
  fieldName?: string;
  showSkip?: boolean;
  enableVoice?: boolean;
}

// Weekly check-in specific config types
export interface CheckInStepConfigOnTrackScale {
  question?: string;
  subheading?: string;
  options: {
    value: string;
    label: string;
    gradient: string;
  }[];
}

export interface CheckInStepConfigMomentumProgress {
  question?: string;
  showGoal?: boolean;
  goalAchievedThreshold?: number;
  enableMomentum?: boolean;
  enableAudioFeedback?: boolean;
}

export interface CheckInStepConfigVoiceText {
  question?: string;
  placeholder?: string;
  fieldName?: string;
  isRequired?: boolean;
  enableVoice?: boolean;
}

export interface CheckInStepConfigWeeklyFocus {
  question?: string;
  placeholder?: string;
  fieldName?: string;
  showAiSuggestion?: boolean;
  showPublicBadge?: boolean;
  showShareButton?: boolean;
  showSkipButton?: boolean;
}

/**
 * Union type for all check-in step configurations
 */
export type CheckInStepConfig =
  | { type: 'mood_scale'; config: CheckInStepConfigMoodScale }
  | { type: 'single_select'; config: CheckInStepConfigSingleSelect }
  | { type: 'multi_select'; config: CheckInStepConfigMultiSelect }
  | { type: 'open_text'; config: CheckInStepConfigOpenText }
  | { type: 'task_planner'; config: CheckInStepConfigTaskPlanner }
  | { type: 'task_review'; config: CheckInStepConfigTaskReview }
  | { type: 'breathing'; config: CheckInStepConfigBreathing }
  | { type: 'accept'; config: CheckInStepConfigAccept }
  | { type: 'reframe_input'; config: CheckInStepConfigReframeInput }
  | { type: 'ai_reframe'; config: CheckInStepConfigAiReframe }
  | { type: 'begin_manifest'; config: CheckInStepConfigBeginManifest }
  | { type: 'visualization'; config: CheckInStepConfigVisualization }
  | { type: 'progress_scale'; config: CheckInStepConfigProgressScale }
  | { type: 'completion'; config: CheckInStepConfigCompletion }
  | { type: 'goal_achieved'; config: CheckInStepConfigGoalAchieved }
  | { type: 'explainer'; config: CheckInStepConfigExplainer }
  // Evening check-in specific configs
  | { type: 'evening_task_review'; config: CheckInStepConfigEveningTaskReview }
  | { type: 'evening_mood'; config: CheckInStepConfigEveningMood }
  | { type: 'evening_reflection'; config: CheckInStepConfigEveningReflection }
  // Weekly check-in specific configs
  | { type: 'on_track_scale'; config: CheckInStepConfigOnTrackScale }
  | { type: 'momentum_progress'; config: CheckInStepConfigMomentumProgress }
  | { type: 'voice_text'; config: CheckInStepConfigVoiceText }
  | { type: 'weekly_focus'; config: CheckInStepConfigWeeklyFocus };

/**
 * Check-in step condition - for conditional display of steps
 */
export interface CheckInStepCondition {
  field: string;                        // Field to evaluate (e.g., 'taskCompletionRate', 'weeklyProgress')
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  value: unknown;
}

/**
 * Check-in step - A single step in a check-in flow
 */
export interface CheckInStep {
  id: string;
  flowId: string;
  order: number;
  type: CheckInStepType;
  name?: string;                        // Custom name for coach differentiation
  config: CheckInStepConfig;
  enabled?: boolean;                    // Whether step is active (default: true)
  
  // Conditional display (for evening/weekly conditional screens)
  conditions?: CheckInStepCondition[];
  conditionLogic?: 'and' | 'or';        // How to combine multiple conditions (default: 'and')
  
  createdAt: string;
  updatedAt: string;
}

/**
 * CheckInFlowTemplate - Global, immutable template for default check-in flows
 * Stored in Firestore 'checkInFlowTemplates' collection
 */
export interface CheckInFlowTemplate {
  id: string;
  key: CheckInFlowType;                 // 'morning' | 'evening' | 'weekly'
  name: string;
  description?: string;
  defaultSteps: Omit<CheckInStep, 'id' | 'flowId' | 'createdAt' | 'updatedAt'>[];
  version: number;                      // For versioning template updates
  createdAt: string;
  updatedAt: string;
}

/**
 * OrgCheckInFlow - Organization-specific check-in flow instance
 * Stored in Firestore 'orgCheckInFlows' collection
 */
export interface OrgCheckInFlow {
  id: string;
  organizationId: string;               // Clerk Organization ID (multi-tenant)
  
  name: string;
  type: CheckInFlowType;
  description?: string;
  
  enabled: boolean;                     // Whether this flow is active for end-users
  
  // Steps stored in subcollection 'orgCheckInFlows/{flowId}/steps'
  stepCount: number;                    // Denormalized count for list views
  
  // Template reference
  createdFromTemplateId?: string;       // Reference to CheckInFlowTemplate
  templateVersion?: number;             // Version of template when created
  
  // System vs custom
  isSystemDefault: boolean;             // True for morning/evening/weekly instances
  
  // Custom flow display config (for custom type flows shown on homepage)
  displayConfig?: FlowDisplayConfig;    // Icon, gradient, title, subtitle for homepage card
  
  // Conditional display (for custom flows)
  showConditions?: FlowShowConditions;  // When to show this flow on homepage
  
  // Audit
  createdByUserId: string;
  lastEditedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Check-in session - State for a user going through a check-in
 * Stored in Firestore 'checkInSessions' collection
 */
export interface CheckInSession {
  id: string;
  flowId: string;
  organizationId: string;
  userId: string;
  
  // Date tracking (for daily/weekly uniqueness)
  date: string;                         // YYYY-MM-DD for morning/evening
  week?: string;                        // YYYY-WNN for weekly
  
  // Progress
  currentStepIndex: number;
  completedStepIds: string[];
  
  // Collected data
  data: Record<string, unknown>;
  
  // Computed values for conditions
  taskCompletionRate?: number;          // 0-100, for evening flow
  weeklyProgress?: number;              // 0-100, for weekly flow
  
  // Status
  status: 'in_progress' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt?: string;
}

// =============================================================================
// SOCIAL FEED TYPES
// =============================================================================

/**
 * Feed Post Settings - Coach-only settings for post display and interactions
 */
export interface FeedPostSettings {
  pinnedToFeed?: boolean;           // Pin to top of feed
  pinnedToSidebar?: boolean;        // Pin to sidebar section
  hideMetadata?: boolean;           // Hide author name, avatar, date
  disableInteractions?: boolean;    // Disable likes/comments/share/save
  pinnedAt?: string;                // ISO timestamp for sort order
}

/**
 * Feed Post - A post in the social feed
 * Stored in Stream Activity Feeds, mirrored to Firestore for search/reporting
 */
export interface FeedPost {
  id: string;                       // Stream activity ID
  authorId: string;                 // User ID who created the post
  organizationId: string;           // Clerk org ID for multi-tenancy
  text?: string;                    // Post text content (optional if media only)
  images?: string[];                // Array of image URLs (up to 4)
  videoUrl?: string;                // Video URL (alternative to images)
  
  // Engagement counts (denormalized for display)
  likeCount: number;
  commentCount: number;
  repostCount: number;
  bookmarkCount: number;
  
  // Timestamps
  createdAt: string;                // ISO timestamp
  updatedAt?: string;               // ISO timestamp (for edits)
  
  // Coach-only settings
  pinnedToFeed?: boolean;           // Pin to top of feed
  pinnedToSidebar?: boolean;        // Pin to sidebar section
  hideMetadata?: boolean;           // Hide author name, avatar, date
  disableInteractions?: boolean;    // Disable likes/comments/share/save
  pinnedAt?: string;                // ISO timestamp for sort order
}

/**
 * Feed Comment - A comment on a feed post
 */
export interface FeedComment {
  id: string;                       // Reaction ID in Stream
  postId: string;                   // The post being commented on
  authorId: string;                 // User ID who commented
  organizationId: string;           // For multi-tenancy
  text: string;                     // Comment text
  parentCommentId?: string;         // For threaded replies (1 level deep)
  
  // Timestamps
  createdAt: string;
  updatedAt?: string;               // When comment was last edited
}

/**
 * Feed Reaction - Like, bookmark, or repost
 */
export interface FeedReaction {
  id: string;                       // Reaction ID in Stream
  postId: string;                   // The post being reacted to
  userId: string;                   // User who reacted
  kind: 'like' | 'bookmark' | 'repost';
  createdAt: string;
}

/**
 * User-Posted Story - Ephemeral content (24hr TTL)
 * Stored in Stream, merged with auto-generated stories in UI
 */
export interface UserStory {
  id: string;                       // Stream activity ID
  authorId: string;                 // User ID who posted
  organizationId: string;           // For multi-tenancy
  imageUrl?: string;                // Story image
  videoUrl?: string;                // Story video (alternative to image)
  caption?: string;                 // Optional caption
  expiresAt: string;                // 24hrs from creation
  createdAt: string;
}

/**
 * Feed Report - Content moderation report
 * Stored in Firestore: feed_reports/{reportId}
 */
export interface FeedReport {
  id: string;
  postId: string;                   // The post being reported
  reporterId: string;               // User who reported
  organizationId: string;           // For multi-tenancy
  reason: FeedReportReason;
  details?: string;                 // Optional additional details
  status: FeedReportStatus;
  reviewedBy?: string;              // Coach who reviewed
  reviewedAt?: string;              // When reviewed
  resolution?: FeedReportResolution;
  createdAt: string;
}

export type FeedReportReason = 
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'misinformation'
  | 'other';

export type FeedReportStatus = 
  | 'pending'
  | 'reviewed'
  | 'dismissed';

export type FeedReportResolution =
  | 'content_removed'
  | 'user_warned'
  | 'no_action';

// =============================================================================
// SQUAD ANALYTICS TYPES
// =============================================================================

export type SquadHealthStatus = 'thriving' | 'active' | 'inactive';

/**
 * Squad Analytics - Daily computed metrics for community health
 * Stored in Firestore 'squad_analytics' collection
 */
export interface SquadAnalytics {
  id: string;
  squadId: string;
  organizationId: string;
  date: string; // YYYY-MM-DD
  
  // Member activity
  totalMembers: number;
  activeMembers: number; // Members with activity in last 7 days
  activityRate: number; // activeMembers / totalMembers * 100
  
  // Engagement metrics
  messageCount: number; // Chat messages in the period
  taskCompletionRate: number; // 0-100
  checkInCount: number; // Number of check-ins
  avgAlignmentScore: number; // Average across active members
  
  // Health status (computed)
  healthStatus: SquadHealthStatus;
  
  // Timestamp
  computedAt: string;
}

/**
 * Squad Analytics Summary - Aggregated view for coach dashboard
 */
export interface SquadAnalyticsSummary {
  squadId: string;
  squadName: string;
  squadAvatarUrl?: string;
  coachId?: string;
  squadType?: 'standalone' | 'program';
  programId?: string;
  
  // Current state
  totalMembers: number;
  activeMembers: number;
  activityRate: number;
  healthStatus: SquadHealthStatus;
  
  // Trend (comparing to previous period)
  activityTrend: 'up' | 'down' | 'stable';
  trendPercent: number; // Change in activity rate
  
  // Last activity
  lastActivityDate?: string;
}

// =============================================================================
// DISCOUNT CODE TYPES
// =============================================================================

export type DiscountType = 'percentage' | 'fixed';
export type DiscountApplicableTo = 'all' | 'programs' | 'squads' | 'custom';

/**
 * Discount Code - Reusable discount codes for programs and squads
 * Stored in Firestore 'discount_codes' collection
 */
export interface DiscountCode {
  id: string;
  organizationId: string;        // Clerk Organization ID
  code: string;                  // Uppercase code e.g., "ALUMNI20"
  name?: string;                 // Optional friendly name
  
  // Discount configuration
  type: DiscountType;            // 'percentage' or 'fixed'
  value: number;                 // 20 for 20% or 2000 for $20.00
  
  // Applicability
  applicableTo: DiscountApplicableTo;  // 'all', 'programs', 'squads', or 'custom'
  programIds?: string[];         // Specific programs (if empty, applies to all)
  squadIds?: string[];           // Specific squads (if empty, applies to all)
  
  // Usage limits
  maxUses?: number | null;       // null = unlimited
  useCount: number;              // Current redemption count
  maxUsesPerUser?: number;       // null = unlimited per user
  
  // Validity period
  startsAt?: string | null;      // null = immediately active
  expiresAt?: string | null;     // null = never expires
  
  // Status
  isActive: boolean;             // Can be manually disabled
  
  // Tracking
  createdBy: string;             // Coach userId who created it
  createdAt: string;
  updatedAt: string;
}

/**
 * Discount Code Usage - Track individual redemptions
 * Stored in Firestore 'discount_code_usages' collection
 */
export interface DiscountCodeUsage {
  id: string;
  discountCodeId: string;
  userId: string;
  organizationId: string;
  
  // What was discounted
  programId?: string;
  squadId?: string;
  enrollmentId?: string;         // Link to program_enrollments
  
  // Discount applied
  originalAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
  
  createdAt: string;
}

// =============================================================================
// REFERRAL SYSTEM TYPES
// =============================================================================

/**
 * Referral reward types
 */
export type ReferralRewardType = 'free_time' | 'free_program' | 'discount_code';

/**
 * Referral status
 */
export type ReferralStatus = 'pending' | 'completed' | 'rewarded';

/**
 * Referral reward configuration
 */
export interface ReferralReward {
  type: ReferralRewardType;
  // For 'free_time': days to add to subscription/access
  freeDays?: number;
  // For 'free_program': program ID to grant free access to
  freeProgramId?: string;
  // For 'discount_code': discount settings
  discountType?: 'percentage' | 'fixed';
  discountValue?: number; // 20 for 20% or 2000 for $20.00
}

/**
 * Referral configuration (stored on Program or Squad)
 * Enables coaches to set up referral programs for their products
 */
export interface ReferralConfig {
  enabled: boolean;
  funnelId: string; // Required funnel that referrals go through
  reward?: ReferralReward; // Optional reward for successful referrals
}

/**
 * Referral record - Tracks individual referral relationships
 * Stored in Firestore 'referrals' collection
 */
export interface Referral {
  id: string;
  organizationId: string;
  referrerId: string; // User who made the referral
  referredUserId: string; // User who was referred
  programId?: string; // If this is a program referral
  squadId?: string; // If this is a squad referral
  funnelId: string;
  flowSessionId: string;
  
  // Status tracking
  status: ReferralStatus;
  completedAt?: string; // When referred user completed enrollment
  
  // Reward tracking
  rewardType?: ReferralRewardType;
  rewardGrantedAt?: string;
  rewardDetails?: Record<string, unknown>; // Additional reward info (e.g., discount code created)
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Referral with extended info for display
 */
export interface ReferralWithDetails extends Referral {
  referrerName?: string;
  referrerEmail?: string;
  referrerImageUrl?: string;
  referredUserName?: string;
  referredUserEmail?: string;
  referredUserImageUrl?: string;
  programName?: string;
  squadName?: string;
}

// =============================================================================
// UNIFIED EVENT TYPES
// =============================================================================

/**
 * Event Type - Classification of what kind of event this is
 */
export type EventType = 
  | 'workshop'           // Discover workshops/webinars
  | 'community_event'    // General community events
  | 'squad_call'         // Squad group calls (coach or peer)
  | 'coaching_1on1';     // Individual coaching sessions

/**
 * Event Scope - Who can see/access this event
 */
export type EventScope = 
  | 'global'             // Public discover events
  | 'organization'       // Org-specific events
  | 'program'            // Program-enrolled users (visible on program page)
  | 'squad'              // Squad members only (not visible on program page by default)
  | 'private';           // Invite-only (1-on-1)

/**
 * Event Visibility - For squad events, controls program-level visibility
 * Coach can choose to make squad events visible to entire program
 */
export type EventVisibility = 
  | 'squad_only'         // Only visible to squad members
  | 'program_wide';      // Visible to all program enrollees (shows on program page)

/**
 * Participant Model - How participants are determined
 */
export type ParticipantModel = 
  | 'rsvp'               // Open RSVP (discover events)
  | 'squad_members'      // Auto-includes squad members
  | 'program_enrollees'  // Auto-includes program enrollees
  | 'invite_only';       // Specific attendeeIds

/**
 * Approval Type - How event confirmation works
 */
export type EventApprovalType = 
  | 'none'               // Immediately confirmed
  | 'voting';            // Requires member votes (for peer-led squad calls)

/**
 * Event Status - Lifecycle state of the event
 */
export type EventStatus = 
  | 'draft'              // Not yet published
  | 'pending_approval'   // Awaiting votes or approval
  | 'confirmed'          // Scheduled and confirmed
  | 'live'               // Currently happening
  | 'completed'          // Past event
  | 'canceled';          // Canceled

/**
 * Recurrence Frequency - How often a recurring event repeats
 */
export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

/**
 * Recurrence Pattern - Configuration for recurring events
 */
export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  dayOfWeek?: number;        // 0=Sun, 1=Mon, ... 6=Sat (for weekly/biweekly)
  dayOfMonth?: number;       // 1-31 (for monthly)
  time: string;              // "15:00" (HH:mm format)
  timezone: string;          // IANA timezone
  startDate: string;         // ISO date when recurrence starts
  endDate?: string;          // ISO date when recurrence ends (optional)
  count?: number;            // Number of occurrences (alternative to endDate)
}

/**
 * Voting Config - For events that require member approval
 */
export interface EventVotingConfig {
  yesCount: number;
  noCount: number;
  requiredVotes: number;      // Threshold to confirm (e.g., floor(members/2) + 1)
  totalEligibleVoters: number;
}

/**
 * UnifiedEvent - The consolidated event type for all events and calls
 * Stored in Firestore 'events' collection
 * 
 * This replaces:
 * - DiscoverEvent (community workshops/webinars)
 * - squads.nextCall* fields (coach-scheduled calls)
 * - standardSquadCalls (peer-proposed calls)
 * - coaching_relationships.nextCall (1-on-1 coaching)
 */
export interface UnifiedEvent {
  id: string;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE INFO
  // ═══════════════════════════════════════════════════════════════════════════
  title: string;
  description?: string;
  startDateTime: string;      // ISO 8601 UTC
  endDateTime?: string;       // Optional end time (UTC)
  timezone: string;           // IANA timezone for display
  durationMinutes?: number;   // Default 60
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LOCATION
  // ═══════════════════════════════════════════════════════════════════════════
  locationType: 'online' | 'in_person' | 'chat';
  locationLabel: string;      // "Online via Zoom", "Squad Chat", etc.
  meetingLink?: string;       // Zoom/Meet URL (hidden until RSVP for public events)
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CLASSIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  eventType: EventType;
  scope: EventScope;
  participantModel: ParticipantModel;
  approvalType: EventApprovalType;
  status: EventStatus;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VISIBILITY CONTROL (for squad events)
  // ═══════════════════════════════════════════════════════════════════════════
  // Coach can choose: squad_only (default) or program_wide
  visibility?: EventVisibility;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SCOPING
  // ═══════════════════════════════════════════════════════════════════════════
  organizationId?: string;    // Clerk Organization ID for multi-tenancy
  programId?: string;         // Single program association (for squad calls)
  programIds?: string[];      // Multiple programs (for discover events)
  squadId?: string;           // Squad association
  cohortId?: string;          // Cohort association
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RECURRENCE
  // ═══════════════════════════════════════════════════════════════════════════
  isRecurring: boolean;
  recurrence?: RecurrencePattern;
  parentEventId?: string;     // For generated instances, points to the recurring parent
  instanceDate?: string;      // For generated instances, the specific date (YYYY-MM-DD)
  programWeekId?: string;     // For instances: the ProgramWeek this call is linked to
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULING (for 1-on-1 coaching calls with propose/accept flow)
  // ═══════════════════════════════════════════════════════════════════════════
  schedulingStatus?: SchedulingStatus;
  proposedBy?: string;              // userId who proposed the call
  proposedTimes?: ProposedTime[];   // Alternative times offered by either party
  respondBy?: string;               // ISO deadline for response
  schedulingNotes?: string;         // Optional notes with the proposal
  rescheduledFromId?: string;       // Link to original event if this is a reschedule
  cancellationReason?: string;      // Reason provided when cancelling
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRICING (for paid coaching calls)
  // ═══════════════════════════════════════════════════════════════════════════
  isPaid?: boolean;
  priceInCents?: number;
  paymentIntentId?: string;         // Stripe payment intent ID
  paidAt?: string;                  // When payment was completed
  
  // ═══════════════════════════════════════════════════════════════════════════
  // NYLAS SYNC (external calendar integration)
  // ═══════════════════════════════════════════════════════════════════════════
  nylasEventId?: string;            // ID in Nylas/external calendar
  syncedToNylas?: boolean;          // Whether event has been synced to external cal
  nylasCalendarId?: string;         // Which calendar it was synced to
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HOST
  // ═══════════════════════════════════════════════════════════════════════════
  createdByUserId: string;
  hostUserId: string;         // May differ from creator
  hostName: string;
  hostAvatarUrl?: string;
  isCoachLed: boolean;        // Coach-managed vs. peer-organized

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT (for 1:1 coaching calls)
  // ═══════════════════════════════════════════════════════════════════════════
  clientUserId?: string;      // The client in a 1:1 coaching relationship
  clientName?: string;        // Client's display name
  clientAvatarUrl?: string;   // Client's profile image

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTICIPANTS
  // ═══════════════════════════════════════════════════════════════════════════
  attendeeIds: string[];      // Users who RSVPed or are confirmed
  maxAttendees?: number;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VOTING (when approvalType === 'voting')
  // ═══════════════════════════════════════════════════════════════════════════
  votingConfig?: EventVotingConfig;
  confirmedAt?: string;       // When event reached required votes
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RICH CONTENT (for discover events)
  // ═══════════════════════════════════════════════════════════════════════════
  coverImageUrl?: string;
  bulletPoints?: string[];    // "By the end of the session, you'll…"
  additionalInfo?: {
    type: string;
    language: string;
    difficulty: string;
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // POST-EVENT & CALL RECORDING
  // ═══════════════════════════════════════════════════════════════════════════
  recordingUrl?: string;
  callSummaryId?: string;                // FK to call_summaries collection
  hasCallRecording?: boolean;            // Whether recording exists
  recordingStatus?: 'recording' | 'processing' | 'ready' | 'failed';
  streamVideoCallId?: string;            // Stream Video call ID
  generateSummary?: boolean;             // Per-event override for auto-generation
  meetingUrl?: string;                   // Zoom/Google Meet/manual link
  meetingProvider?: 'zoom' | 'google_meet' | 'stream' | 'manual';
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  chatChannelId?: string;     // Stream chat channel to notify
  sendChatReminders: boolean; // Whether to post reminders in chat
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY COMPATIBILITY (for existing DiscoverEvent fields)
  // ═══════════════════════════════════════════════════════════════════════════
  /** @deprecated Use startDateTime instead */
  date?: string;              // Legacy: ISO date string
  /** @deprecated Use startDateTime time component instead */
  startTime?: string;         // Legacy: "18:00"
  /** @deprecated Use endDateTime time component instead */
  endTime?: string;           // Legacy: "20:00"
  /** @deprecated Use bulletPoints instead */
  shortDescription?: string;
  /** @deprecated Use description instead */
  longDescription?: string;
  /** @deprecated Use additionalInfo.category instead */
  category?: string;
  /** @deprecated Use programIds instead - track-based filtering is phased out */
  track?: UserTrack | null;
  /** @deprecated Use isCoachLed + role checks instead */
  featured?: boolean;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════════════════════
  createdAt: string;
  updatedAt: string;
}

/**
 * EventVote - Individual vote for events with voting approval
 * Stored in Firestore 'eventVotes' collection
 */
export interface EventVote {
  id: string;           // Format: `${eventId}_${userId}`
  eventId: string;
  userId: string;
  vote: 'yes' | 'no';
  createdAt: string;
  updatedAt: string;
}

/**
 * Event Job Type - Types of scheduled jobs for events
 */
export type EventJobType = 
  | 'notification_24h'      // Push notification 24 hours before
  | 'notification_1h'       // Push notification 1 hour before
  | 'notification_live'     // Push notification when event starts
  | 'email_24h'             // Email 24 hours before
  | 'email_1h'              // Email 1 hour before
  | 'chat_reminder_1h'      // Chat message 1 hour before
  | 'chat_reminder_live';   // Chat message when event starts

/**
 * EventScheduledJob - Scheduled notification/email jobs for events
 * Stored in Firestore 'eventScheduledJobs' collection
 * 
 * This replaces:
 * - squadCallScheduledJobs
 * - coachingCallScheduledJobs
 * - squadCallReminders
 */
export interface EventScheduledJob {
  id: string;                   // Format: `${eventId}_${jobType}`
  eventId: string;
  jobType: EventJobType;
  scheduledTime: string;        // ISO timestamp when job should execute
  
  // Denormalized for execution (avoid reads during cron)
  eventTitle: string;
  eventDateTime: string;
  eventTimezone: string;
  eventLocation: string;
  eventType: EventType;
  scope: EventScope;
  squadId?: string;
  squadName?: string;
  programId?: string;
  organizationId?: string;
  chatChannelId?: string;
  
  // For 1-on-1 coaching
  hostUserId?: string;
  hostName?: string;
  hostAvatarUrl?: string;
  clientUserId?: string;
  clientName?: string;
  clientAvatarUrl?: string;

  // Execution state
  executed: boolean;
  executedAt?: string;
  error?: string;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Helper type for event creation (omits auto-generated fields)
 */
export type CreateEventInput = Omit<UnifiedEvent, 'id' | 'createdAt' | 'updatedAt' | 'confirmedAt'>;

/**
 * Helper type for event update (all fields optional except id)
 */
export type UpdateEventInput = Partial<Omit<UnifiedEvent, 'id' | 'createdAt'>> & { id: string };

// =============================================================================
// FEATURE REQUESTS & VOTING
// =============================================================================

/**
 * Feature Request Status
 * - suggested: User-submitted, awaiting review
 * - in_progress: Admin marked as actively being worked on
 * - completed: Feature has been shipped
 * - declined: Feature will not be implemented
 */
export type FeatureRequestStatus = 'suggested' | 'in_progress' | 'completed' | 'declined';

/**
 * FeatureRequest - User-submitted feature suggestions with voting
 * Stored in Firestore 'feature_requests' collection
 * 
 * Global collection (not org-scoped) - all coaches can see and vote
 */
export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: FeatureRequestStatus;
  voteCount: number;
  
  // Submitter info
  suggestedBy: string;        // userId
  suggestedByName: string;
  suggestedByEmail?: string;
  
  // Admin management fields
  adminNotes?: string;        // Internal notes (not shown to users)
  priority?: number;          // For ordering in_progress items (lower = higher priority)
  statusChangedAt?: string;   // When status was last changed
  statusChangedBy?: string;   // Admin who changed status
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * FeatureVote - Individual vote on a feature request
 * Stored in Firestore 'feature_votes' collection
 * 
 * Each user (coach) gets one vote per feature.
 * Document ID format: `${featureId}_${userId}`
 */
export interface FeatureVote {
  id: string;                 // Format: `${featureId}_${userId}`
  featureId: string;
  userId: string;
  userName?: string;
  createdAt: string;
}

// =============================================================================
// MARKETPLACE LISTINGS
// =============================================================================

/**
 * Coach onboarding state
 * - needs_profile: Coach hasn't completed profile (avatar, bio)
 * - needs_plan: Coach hasn't selected a plan / subscription not active
 * - needs_branding: Coach has paid but needs to set up branding (logo, colors)
 * - active: Coach has completed onboarding and has active/trialing subscription
 */
export type CoachOnboardingState = 'needs_profile' | 'needs_plan' | 'needs_branding' | 'active';

/**
 * MarketplaceListing - Public listing for a coach's program/funnel
 * Stored in Firestore 'marketplace_listings' collection
 * 
 * One listing per organization. When enabled, shows the coach's program
 * on the public marketplace page with a link to their selected funnel.
 */
export interface MarketplaceListing {
  id: string;
  organizationId: string;           // Clerk Organization ID (unique per org)
  enabled: boolean;                 // Whether listing is publicly visible
  
  // Listing content (required when enabled=true)
  title: string;                    // e.g., "12-Week Fitness Transformation"
  description: string;              // Short description (max ~200 chars)
  coverImageUrl: string;            // Hero/cover image URL
  
  // Link configuration
  funnelId: string;                 // ID of funnel to link to
  
  // Organization info (denormalized for fast queries)
  coachName?: string;               // Coach/org display name
  coachAvatarUrl?: string;          // Coach/org avatar
  subdomain?: string;               // For building funnel URLs
  customDomain?: string;            // Verified custom domain (preferred over subdomain)
  
  // Searchable text (lowercased concat of title, description, coachName)
  searchableText: string;
  
  // Optional category tags
  categories?: string[];            // e.g., ['health', 'fitness', 'coaching']
  
  // Analytics
  viewCount?: number;
  clickCount?: number;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * MarketplaceListing creation input (omits auto-generated fields)
 */
export type CreateMarketplaceListingInput = Omit<
  MarketplaceListing, 
  'id' | 'searchableText' | 'viewCount' | 'clickCount' | 'createdAt' | 'updatedAt'
>;

/**
 * MarketplaceListing update input (partial)
 */
export type UpdateMarketplaceListingInput = Partial<
  Omit<MarketplaceListing, 'id' | 'organizationId' | 'createdAt'>
>;

/**
 * Marketplace category options
 */
export const MARKETPLACE_CATEGORIES = [
  { value: 'health', label: 'Health & Fitness', emoji: '🏃' },
  { value: 'business', label: 'Business', emoji: '💼' },
  { value: 'money', label: 'Money & Finance', emoji: '💰' },
  { value: 'mindset', label: 'Mindset', emoji: '🧠' },
  { value: 'relationships', label: 'Relationships', emoji: '❤️' },
  { value: 'creativity', label: 'Creativity', emoji: '🎨' },
  { value: 'tech', label: 'Tech & Skills', emoji: '💻' },
  { value: 'spirituality', label: 'Spirituality', emoji: '🙏' },
  { value: 'lifestyle', label: 'Lifestyle', emoji: '✨' },
] as const;

export type MarketplaceCategory = typeof MARKETPLACE_CATEGORIES[number]['value'];

// =============================================================================
// DECOY LISTINGS (Social Proof)
// =============================================================================

/**
 * DecoyListing - Fake marketplace listing for social proof
 * These are hardcoded in config and shown when enabled via platform settings.
 * They link to a "Program Full" landing page instead of a real funnel.
 */
export interface DecoyListing {
  id: string;                       // Unique decoy ID (e.g., 'decoy-jazz-piano')
  slug: string;                     // URL slug for the full page
  title: string;                    // Program title
  description: string;              // Program description
  coverImageUrl: string;            // Hero/cover image (Unsplash URL)
  coachName: string;                // Fake coach name
  coachAvatarUrl: string;           // Coach avatar (Unsplash URL)
  categories: MarketplaceCategory[];// Program categories
  isDecoy: true;                    // Always true for decoys
}

// =============================================================================
// PLATFORM SETTINGS
// =============================================================================

/**
 * PlatformSettings - Global platform configuration
 * Stored in Firebase 'platform_settings' collection with id='global'
 */
export interface PlatformSettings {
  id: 'global';
  marketplaceDecoysEnabled: boolean; // Show decoy listings on marketplace
  updatedAt: string;                 // ISO timestamp
  updatedBy: string;                 // Clerk user ID who last updated
}

// =============================================================================
// ORGANIZATION ONBOARDING FLOW TYPES
// Coach-customizable onboarding quiz for new users
// =============================================================================

/**
 * Step types available for onboarding flows
 * Reuses funnel step types that make sense for onboarding
 */
export type OnboardingStepType = 
  | 'question'        // Quiz question (single-select, multi-select, open text)
  | 'goal_setting'    // User sets their goal
  | 'identity'        // User defines their identity/who they're becoming
  | 'explainer'       // Rich media explanation step
  | 'success';        // Final success/welcome step

/**
 * Onboarding step - A single step in an onboarding flow
 * Reuses FunnelStep config structure for consistency
 */
export interface OnboardingStep {
  id: string;
  flowId: string;
  order: number;                      // 0-indexed order
  type: OnboardingStepType;
  name?: string;                      // Custom name for coach reference
  config: {
    type: OnboardingStepType;
    config: FunnelStepConfigQuestion | FunnelStepConfigGoal | FunnelStepConfigIdentity | FunnelStepConfigExplainer | FunnelStepConfigSuccess;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * OrgOnboardingFlow - Organization's customizable onboarding flow
 * Stored in Firestore 'org_onboarding_flows/{organizationId}' (one per org)
 */
export interface OrgOnboardingFlow {
  id: string;
  organizationId: string;             // Clerk Organization ID
  name: string;                       // e.g., "Welcome Quiz"
  description?: string;               // Coach notes about this flow
  enabled: boolean;                   // Whether to show to new users
  
  // Steps are stored in a subcollection: org_onboarding_flows/{id}/steps
  stepCount: number;                  // Denormalized count for display
  
  // Audit fields
  createdByUserId: string;
  lastEditedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * OnboardingResponse - User's answers to an onboarding flow
 * Stored in Firestore 'users/{userId}' under onboardingResponse field
 * OR in a separate 'onboarding_responses' collection for coach review
 */
export interface OnboardingResponse {
  id: string;
  userId: string;
  organizationId: string;
  flowId: string;
  
  // Answers keyed by step ID
  answers: Record<string, {
    stepId: string;
    stepType: OnboardingStepType;
    question?: string;                // The question that was asked
    answer: unknown;                  // String, string[], or object depending on type
    answeredAt: string;               // ISO timestamp
  }>;
  
  // Status
  status: 'in_progress' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt?: string;
}

// =============================================================================
// QUIZ LEADS (Landing Page Quiz Captures)
// =============================================================================

/**
 * UTM tracking data for attribution
 */
export interface UTMData {
  source?: string;                    // utm_source (e.g., "google", "woodpecker")
  medium?: string;                    // utm_medium (e.g., "cpc", "email")
  campaign?: string;                  // utm_campaign (e.g., "coaching_platform_jan26")
  content?: string;                   // utm_content (e.g., "skool_alternative")
  term?: string;                      // utm_term (keyword for paid search)
}

/**
 * QuizLead - Captured data from landing page quiz
 * Stored in Firestore 'quiz_leads/{id}'
 */
export interface QuizLead {
  id: string;
  email: string;
  name?: string;
  clientCount: string;                // From quiz step 1 (e.g., "1-10", "11-25", etc.)
  frustrations: string[];             // From quiz step 2 (multi-select)
  impactFeatures: string[];           // From quiz step 3 (multi-select)
  referralCode?: string;              // If came from coach referral
  source?: string;                    // UTM source or referrer (legacy, use utmData instead)
  utmData?: UTMData;                  // Full UTM tracking data
  referrer?: string;                  // document.referrer
  landingPage?: string;               // URL they landed on
  createdAt: string;                  // ISO timestamp
  convertedAt?: string;               // When they signed up (ISO timestamp)
  convertedToOrgId?: string;          // Their org after signup
  convertedToUserId?: string;         // Their user ID after signup
}

// =============================================================================
// COACH REFERRAL PROGRAM (Coach-to-Coach Referrals)
// =============================================================================

/**
 * CoachReferral - Tracks coach-to-coach referrals
 * Stored in Firestore 'coach_referrals/{id}'
 */
export interface CoachReferral {
  id: string;
  referrerOrgId: string;              // Coach's org who referred
  referrerUserId: string;             // Coach's user ID who referred
  referralCode: string;               // Unique code (e.g., "COACH-ABC123")
  referredEmail?: string;             // Email of referred coach (before signup)
  referredOrgId?: string;             // New coach's org (after conversion)
  referredUserId?: string;            // New coach's user ID
  status: CoachReferralStatus;
  rewardType: 'free_month';           // Currently only free month supported
  referrerRewarded: boolean;          // Whether referrer got their reward
  refereeRewarded: boolean;           // Whether referee got their reward
  referrerRewardAppliedAt?: string;   // When referrer reward was applied
  refereeRewardAppliedAt?: string;    // When referee reward was applied
  createdAt: string;                  // ISO timestamp
  signedUpAt?: string;                // When referred coach signed up
  subscribedAt?: string;              // When referred coach subscribed to paid plan
  rewardedAt?: string;                // When rewards were fully applied
}

export type CoachReferralStatus = 'pending' | 'signed_up' | 'subscribed' | 'rewarded';

/**
 * CoachReferralCode - Stores a coach's unique referral code
 * Stored in Firestore 'coach_referral_codes/{orgId}'
 */
export interface CoachReferralCode {
  id: string;                         // Same as orgId
  orgId: string;
  userId: string;                     // Coach's user ID
  code: string;                       // Unique code (e.g., "COACH-ABC123")
  totalReferrals: number;             // Total referrals made
  successfulReferrals: number;        // Referrals that converted to paid
  totalRewardsEarned: number;         // Total months earned
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// EMAIL AUTOMATION SYSTEM
// =============================================================================

/**
 * AutomatedEmailTemplate - Editable email template for automation flows
 * Stored in Firestore 'email_templates/{id}'
 */
export interface AutomatedEmailTemplate {
  id: string;                         // e.g., "abandoned_cart_1"
  flowId: string;                     // Links to email_flows
  name: string;                       // Human-readable name
  subject: string;                    // Email subject (supports {{variables}})
  htmlContent: string;                // HTML content (supports {{variables}})
  textContent?: string;               // Plain text fallback
  enabled: boolean;                   // Whether this template is active
  delayMinutes: number;               // Minutes after trigger to send
  order: number;                      // Order within the flow
  createdAt: string;
  updatedAt: string;
}

/**
 * EmailFlow - Defines an automated email sequence
 * Stored in Firestore 'email_flows/{id}'
 */
export interface EmailFlow {
  id: string;                         // e.g., "abandoned_cart"
  name: string;                       // Human-readable name
  description: string;                // What this flow does
  trigger: EmailFlowTrigger;          // What triggers this flow
  enabled: boolean;                   // Whether flow is active
  templateIds: string[];              // Ordered list of template IDs
  createdAt: string;
  updatedAt: string;
}

export type EmailFlowTrigger = 
  | 'signup_no_plan'                  // Coach signed up but didn't select plan
  | 'trial_started'                   // Coach started their trial
  | 'day_14'                          // 14 days after signup (testimonial request)
  | 'trial_ending'                    // Trial ending in 3 days
  | 'subscription_canceled';          // Subscription was canceled

/**
 * EmailSend - Record of a sent email
 * Stored in Firestore 'email_sends/{id}'
 */
export interface EmailSend {
  id: string;
  templateId: string;
  flowId: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientOrgId?: string;
  resendMessageId?: string;           // Resend's message ID for tracking
  status: EmailSendStatus;
  sentAt: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  bouncedAt?: string;
  metadata?: Record<string, string>;  // Additional tracking data
}

export type EmailSendStatus = 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

/**
 * EmailQueueItem - Pending email to be sent
 * Stored in Firestore 'email_queue/{id}'
 */
export interface EmailQueueItem {
  id: string;
  flowId: string;
  templateId: string;
  recipientEmail: string;
  recipientUserId: string;
  recipientOrgId?: string;
  scheduledFor: string;               // ISO timestamp when to send
  cancelled: boolean;                 // Set true if user converts (e.g., selects plan)
  cancelledReason?: string;           // Why it was cancelled
  variables?: Record<string, string>; // Template variables
  createdAt: string;
}

/**
 * EmailFlowStats - Aggregated stats for an email flow
 */
export interface EmailFlowStats {
  flowId: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  openRate: number;                   // Percentage
  clickRate: number;                  // Percentage
  lastUpdated: string;
}

// =============================================================================
// SCHEDULING SYSTEM
// =============================================================================

/**
 * Scheduling Status - Lifecycle state of a scheduled call
 */
export type SchedulingStatus = 
  | 'proposed'          // Coach or client has proposed a time
  | 'pending_response'  // Waiting for other party to respond
  | 'counter_proposed'  // Other party proposed alternative times
  | 'confirmed'         // Both parties agreed, call is scheduled
  | 'declined'          // Proposal was declined
  | 'cancelled'         // Confirmed call was cancelled
  | 'rescheduled';      // Call was moved to a new time

/**
 * ProposedTime - A proposed time slot for a call
 */
export interface ProposedTime {
  id: string;                    // Unique ID for this proposal
  startDateTime: string;         // ISO 8601 UTC
  endDateTime: string;           // ISO 8601 UTC
  proposedBy: string;            // userId who proposed this time
  proposedAt: string;            // ISO timestamp when proposed
  status: 'pending' | 'accepted' | 'declined';
}

/**
 * TimeSlot - A time range within a day (for availability)
 */
export interface TimeSlot {
  start: string;  // "09:00" (HH:mm format)
  end: string;    // "17:00" (HH:mm format)
}

/**
 * BlockedSlot - A specific blocked time period
 */
export interface BlockedSlot {
  id: string;
  start: string;        // ISO datetime
  end: string;          // ISO datetime
  reason?: string;      // Optional reason for blocking
  recurring?: boolean;  // Whether this repeats weekly
}

/**
 * WeeklySchedule - Availability for each day of the week
 * Keys are day numbers: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
 */
export type WeeklySchedule = {
  [day: number]: TimeSlot[];
};

/**
 * CoachAvailability - Coach's availability settings for scheduling
 * Stored in Firestore 'coach_availability/{odId}'
 */
export interface CoachAvailability {
  odId: string;                     // Organization ID (Clerk org)
  coachUserId: string;              // The coach's user ID
  
  // Weekly recurring schedule
  weeklySchedule: WeeklySchedule;
  
  // Specific blocked times (vacations, appointments, etc.)
  blockedSlots: BlockedSlot[];
  
  // Settings
  defaultDuration: number;          // Default call duration in minutes (30, 45, 60)
  bufferBetweenCalls: number;       // Minutes buffer between calls
  timezone: string;                 // Coach's timezone (IANA format)
  advanceBookingDays: number;       // How far in advance clients can book (default 30)
  minNoticeHours: number;           // Minimum hours notice for booking (default 24)
  
  // Calendar integration
  /** @deprecated Use direct calendar integration in organizations/{orgId}/integrations instead */
  nylasGrantId?: string;            // Legacy Nylas grant ID (deprecated)
  connectedCalendarId?: string;     // Which calendar is synced
  connectedCalendarName?: string;   // Display name of connected calendar
  syncExternalBusy: boolean;        // Block times from external calendar
  pushEventsToCalendar: boolean;    // Push scheduled calls to external calendar
  
  createdAt: string;
  updatedAt: string;
}

/**
 * CallPricingModel - How calls are priced
 */
export type CallPricingModel = 'free' | 'per_call' | 'credits' | 'both';

/**
 * CoachCallSettings - Coach's settings for client call requests
 * Stored as part of organization settings or coach profile
 */
export interface CoachCallSettings {
  allowClientRequests: boolean;     // Whether clients can request calls
  pricingModel: CallPricingModel;
  pricePerCallCents?: number;       // Price in cents for per-call pricing
  creditsIncludedMonthly?: number;  // Number of free calls per month (for credits model)
  
  // Display settings
  callRequestButtonLabel?: string;  // Custom label for request button
  callRequestDescription?: string;  // Description shown to clients
  
  // Notification preferences
  notifyOnRequest: boolean;         // Email coach on new requests
  autoDeclineIfNoResponse: boolean; // Auto-decline after X days
  autoDeclineDays?: number;         // Days before auto-decline
}

/**
 * NylasGrant - Stores Nylas OAuth grant information
 * Stored in Firestore 'nylas_grants/{odId}_{userId}'
 *
 * @deprecated Nylas integration has been replaced with direct Google/Microsoft OAuth.
 * Calendar integrations are now stored in organizations/{orgId}/integrations.
 * This type is kept only for backward compatibility during migration.
 */
export interface NylasGrant {
  id: string;                       // Format: `${odId}_${userId}`
  odId: string;                     // Organization ID
  userId: string;                   // User ID
  grantId: string;                  // Nylas grant ID
  email: string;                    // Email associated with the grant
  provider: 'google' | 'microsoft' | 'icloud';
  calendarId?: string;              // Selected calendar ID
  calendarName?: string;            // Selected calendar name
  scopes: string[];                 // Granted OAuth scopes
  accessTokenExpiresAt?: string;    // When access token expires
  isActive: boolean;                // Whether grant is still valid
  lastSyncAt?: string;              // Last successful sync
  syncError?: string;               // Last sync error message
  createdAt: string;
  updatedAt: string;
}

/**
 * UserCallCredits - Tracks call credits for users
 * Stored in Firestore 'user_call_credits/{odId}_{userId}'
 */
export interface UserCallCredits {
  id: string;                       // Format: `${odId}_${userId}`
  odId: string;
  userId: string;
  creditsRemaining: number;         // Current credits balance
  creditsUsedThisMonth: number;     // Credits used in current billing period
  monthlyAllowance: number;         // Monthly credit allowance
  billingPeriodStart: string;       // ISO date of current period start
  billingPeriodEnd: string;         // ISO date of current period end
  lastUpdated: string;
}

/**
 * SchedulingNotificationType - Types of scheduling-related notifications
 */
export type SchedulingNotificationType =
  | 'call_proposed'                 // Coach proposed a call
  | 'call_requested'                // Client requested a call
  | 'call_accepted'                 // Proposal was accepted
  | 'call_declined'                 // Proposal was declined
  | 'call_counter_proposed'         // Counter-proposal made
  | 'call_cancelled'                // Scheduled call was cancelled
  | 'call_rescheduled'              // Call was rescheduled
  | 'call_reminder_24h'             // 24 hour reminder
  | 'call_reminder_1h'              // 1 hour reminder
  | 'response_deadline_approaching'; // Deadline to respond approaching

// ============================================================================
// AI CALL SUMMARIES
// ============================================================================

/**
 * CallSummary - AI-generated summary of a coaching call
 * Stored in Firestore 'organizations/{orgId}/call_summaries/{summaryId}'
 */
export interface CallSummary {
  id: string;
  organizationId: string;
  callId: string;                    // Stream Video call ID
  eventId?: string;                  // UnifiedEvent ID
  transcriptionId: string;
  callType: 'coaching_1on1';         // Only 1:1 coaching calls supported

  // Participants
  hostUserId: string;
  participantUserIds: string[];
  clientUserId?: string;

  // Program context
  programId?: string;
  programEnrollmentId?: string;
  squadId?: string;

  // Recording
  recordingUrl?: string;             // Audio recording URL
  recordingDurationSeconds?: number;

  // AI Summary
  summary: {
    executive: string;
    keyDiscussionPoints: string[];
    clientProgress?: string;
    challenges?: string[];
    breakthroughs?: string[];
    coachingNotes?: string;
  };

  // AI Action Items
  actionItems: CallSummaryActionItem[];

  followUpQuestions?: string[];

  status: 'processing' | 'completed' | 'failed';
  processingError?: string;
  callDurationSeconds: number;
  callStartedAt: string;
  callEndedAt: string;

  reviewedByCoach: boolean;
  reviewedAt?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * CallSummaryActionItem - Individual action item from AI summary
 */
export interface CallSummaryActionItem {
  id: string;
  description: string;
  assignedTo: 'client' | 'coach' | 'both';
  priority: 'high' | 'medium' | 'low';
  category?: string;
}

/**
 * SuggestedTask - Task suggested from call summary pending coach review
 * Stored in Firestore 'organizations/{orgId}/suggested_tasks/{taskId}'
 */
export interface SuggestedTask {
  id: string;
  organizationId: string;
  callSummaryId: string;
  userId: string;                    // Client user ID
  title: string;
  notes?: string;
  programEnrollmentId?: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'assigned';
  assignedTaskId?: string;           // Task ID once assigned
  reviewedBy?: string;               // Coach user ID who reviewed
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * UploadedRecording - Manually uploaded call recording for external calls
 * Stored in Firestore 'organizations/{orgId}/uploaded_recordings/{recordingId}'
 */
export interface UploadedRecording {
  id: string;
  organizationId: string;
  uploadedBy: string;                // Coach user ID
  clientUserId?: string;
  programEnrollmentId?: string;
  // Cohort-specific fields (for group programs)
  cohortId?: string;
  programId?: string;
  weekId?: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  fileType?: 'audio' | 'video' | 'pdf';  // Type of uploaded file
  durationSeconds?: number;          // Extracted from audio/video file
  extractedText?: string;            // For PDFs: extracted text content
  pageCount?: number;                // For PDFs: number of pages
  status: 'uploaded' | 'transcribing' | 'summarizing' | 'completed' | 'failed';
  callSummaryId?: string;            // Once processed
  processingError?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// ORGANIZATION MEETING & SUMMARY SETTINGS
// ============================================================================

/**
 * MeetingIntegrations - External meeting provider integrations
 */
export interface MeetingIntegrations {
  zoom?: {
    connected: boolean;
    accessToken: string;             // Encrypted
    refreshToken: string;            // Encrypted
    userId: string;
    email: string;
    expiresAt?: string;
  };
  googleMeet?: {
    connected: boolean;
    calendarId: string;              // Uses existing Google Calendar OAuth
  };
}

/**
 * SummarySettings - AI summary generation settings
 */
export interface SummarySettings {
  autoGenerate: boolean;             // Auto-generate summaries for all calls
  taskGenerationMode: 'auto' | 'approve' | 'disabled';
}

/**
 * SummaryCredits - Credits tracking for AI summaries
 */
export interface SummaryCredits {
  allocatedMinutes: number;          // From plan tier (1200, 3000, 6000) = calls × 60
  usedMinutes: number;               // Minutes used this billing period
  purchasedMinutes: number;          // Purchased credit packs (in minutes, never expire)
  usedPurchasedMinutes: number;      // Purchased minutes used
  periodStart: string;               // ISO date
  periodEnd: string;                 // ISO date
}

/**
 * MeetingProvider - Types of meeting providers
 */
export type MeetingProvider = 'zoom' | 'google_meet' | 'stream' | 'manual';

/**
 * CreditPackType - Available credit pack sizes
 */
export type CreditPackType = 5 | 10 | 20;

/**
 * CreditPackPricing - Pricing for credit packs
 */
export const CREDIT_PACK_PRICING: Record<CreditPackType, number> = {
  5: 400,   // $4.00 in cents
  10: 600,  // $6.00 in cents
  20: 1000, // $10.00 in cents
};

/**
 * TIER_CALL_CREDITS - Monthly call credits per coach tier
 * Credits are in calls (1 call = 60 minutes)
 */
export const TIER_CALL_CREDITS: Record<CoachTier, number> = {
  starter: 20,  // 20 calls/month = 1200 minutes
  pro: 50,      // 50 calls/month = 3000 minutes
  scale: 100,   // 100 calls/month = 6000 minutes
};

