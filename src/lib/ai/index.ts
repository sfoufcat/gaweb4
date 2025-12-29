/**
 * AI Helper Module
 * 
 * Centralized exports for the AI generation system.
 */

// Core generation functions
export { generate, validateDraft } from './generate';
export type { GenerateOptions } from './generate';

// Types
export type {
  AIUseCase,
  AIGenerationContext,
  AIGenerationMeta,
  AIGenerationResponse,
  ProgramContentDraft,
  LandingPageDraft,
  AIValidationResult,
  AIValidationError,
  AIValidationWarning,
  // Program content types
  ProgramStructure,
  TaskType,
  HabitFrequency,
  GeneratedTask,
  GeneratedHabit,
  GeneratedDayOrWeek,
  // Landing page types
  LandingPageTone,
  LandingPageHero,
  LandingPageAboutCoach,
  LandingPageLearnItem,
  LandingPageWhatYoullLearn,
  LandingPageIncludedItem,
  LandingPageWhatsIncluded,
  LandingPageWhoItsFor,
  LandingPageTestimonial,
  LandingPageFAQ,
  // Usage logging
  AIUsageLog,
} from './types';

// Schemas (for client-side validation if needed)
export {
  programContentDraftSchema,
  landingPageDraftSchema,
  validateProgramContentDraft,
  validateLandingPageDraft,
} from './schemas';






