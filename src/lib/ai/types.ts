/**
 * AI Helper Types
 * 
 * Centralized type definitions for the AI generation system.
 * Used across API routes, services, and UI components.
 */

// =============================================================================
// USE CASES
// =============================================================================

export type AIUseCase = 
  | 'PROGRAM_CONTENT'
  | 'LANDING_PAGE_PROGRAM'
  | 'LANDING_PAGE_SQUAD';

// =============================================================================
// PROGRAM CONTENT SCHEMA
// =============================================================================

export type ProgramStructure = 'days' | 'weeks';
export type TaskType = 'action' | 'reflection';
export type HabitFrequency = 'daily' | '3x_week' | 'weekly';

export interface GeneratedTask {
  title: string;
  description?: string;
  type: TaskType;
  estimatedMinutes?: number;
}

export interface GeneratedHabit {
  title: string;
  frequency: HabitFrequency;
  notes?: string;
}

export interface GeneratedDayOrWeek {
  index: number; // 1-based
  title: string;
  focus: string;
  tasks: GeneratedTask[];
  defaultHabits: GeneratedHabit[];
}

export interface ProgramContentDraft {
  structure: ProgramStructure;
  duration: number; // days or weeks based on structure
  daysOrWeeks: GeneratedDayOrWeek[];
  globalDefaultHabits: GeneratedHabit[];
}

// =============================================================================
// LANDING PAGE SCHEMA
// =============================================================================

export type LandingPageTone = 'friendly' | 'direct' | 'premium' | 'playful';

export interface LandingPageHero {
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta?: string;
}

export interface LandingPageAboutCoach {
  headline: string;
  bio: string;
  bullets: string[];
}

export interface LandingPageLearnItem {
  title: string;
  description: string;
}

export interface LandingPageWhatYoullLearn {
  headline: string;
  items: LandingPageLearnItem[];
}

export interface LandingPageIncludedItem {
  title: string;
  description: string;
}

export interface LandingPageWhatsIncluded {
  headline: string;
  items: LandingPageIncludedItem[];
}

export interface LandingPageWhoItsFor {
  headline: string;
  items: string[];
}

export interface LandingPageTestimonial {
  name: string;
  role?: string;
  quote: string;
}

export interface LandingPageFAQ {
  question: string;
  answer: string;
}

export interface LandingPageDraft {
  hero: LandingPageHero;
  aboutCoach: LandingPageAboutCoach;
  whatYoullLearn: LandingPageWhatYoullLearn;
  whatsIncluded: LandingPageWhatsIncluded;
  whoItsFor: LandingPageWhoItsFor;
  testimonials: LandingPageTestimonial[];
  faq: LandingPageFAQ[];
  tone: LandingPageTone;
}

// =============================================================================
// GENERATION REQUEST/RESPONSE
// =============================================================================

export interface AIGenerationContext {
  // Common fields
  programName?: string;
  squadName?: string;
  coachName?: string;
  niche?: string;
  targetAudience?: string;
  duration?: number; // in days
  structure?: ProgramStructure;
  
  // Program-specific
  programType?: 'group' | 'individual';
  existingContentCount?: number;
  
  // Landing page-specific
  price?: number;
  currency?: string;
  
  // Custom constraints
  constraints?: string;
}

export interface AIGenerationRequest {
  orgId: string;
  useCase: AIUseCase;
  userPrompt: string;
  context?: AIGenerationContext;
}

export interface AIGenerationMeta {
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
  estimatedCost?: number; // in USD
}

export interface AIGenerationResponse<T = ProgramContentDraft | LandingPageDraft> {
  draft: T;
  meta: AIGenerationMeta;
}

export interface AIValidationError {
  path: string;
  message: string;
}

export interface AIValidationWarning {
  path: string;
  message: string;
}

export interface AIValidationResult {
  valid: boolean;
  errors: AIValidationError[];
  warnings: AIValidationWarning[];
}

// =============================================================================
// USAGE LOGGING
// =============================================================================

export interface AIUsageLog {
  id: string;
  organizationId: string;
  userId: string;
  useCase: AIUseCase;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  errorMessage?: string;
  createdAt: string;
}






