/**
 * AI Generation Schemas
 * 
 * Zod schemas for validating AI-generated content.
 * These enforce structure, length limits, and required fields.
 */

import { z } from 'zod';

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

const nonEmptyString = z.string().min(1, 'Required field cannot be empty');
const optionalString = z.string().optional();

// =============================================================================
// PROGRAM CONTENT SCHEMAS
// =============================================================================

export const taskTypeSchema = z.enum(['action', 'reflection']);
export const habitFrequencySchema = z.enum(['daily', '3x_week', 'weekly']);
export const programStructureSchema = z.enum(['days', 'weeks']);

export const generatedTaskSchema = z.object({
  title: nonEmptyString.max(100, 'Task title must be 100 characters or less'),
  description: z.string().max(500, 'Task description must be 500 characters or less').optional(),
  type: taskTypeSchema,
  estimatedMinutes: z.number().min(5).max(180).optional(),
});

export const generatedHabitSchema = z.object({
  title: nonEmptyString.max(80, 'Habit title must be 80 characters or less'),
  frequency: habitFrequencySchema,
  notes: z.string().max(300, 'Habit notes must be 300 characters or less').optional(),
});

export const generatedDayOrWeekSchema = z.object({
  index: z.number().int().min(1),
  title: nonEmptyString.max(80, 'Day/week title must be 80 characters or less'),
  focus: nonEmptyString.max(200, 'Focus description must be 200 characters or less'),
  tasks: z.array(generatedTaskSchema)
    .min(1, 'Each day/week must have at least 1 task')
    .max(6, 'Each day/week can have at most 6 tasks'),
  defaultHabits: z.array(generatedHabitSchema)
    .max(3, 'Each day/week can have at most 3 habits'),
});

export const programContentDraftSchema = z.object({
  structure: programStructureSchema,
  duration: z.number().int().min(1).max(365),
  daysOrWeeks: z.array(generatedDayOrWeekSchema)
    .min(1, 'Must generate at least 1 day/week'),
  globalDefaultHabits: z.array(generatedHabitSchema)
    .max(5, 'Can have at most 5 global default habits'),
}).refine(
  (data) => data.daysOrWeeks.length <= data.duration,
  { message: 'Number of days/weeks cannot exceed duration' }
);

// =============================================================================
// LANDING PAGE SCHEMAS
// =============================================================================

export const landingPageToneSchema = z.enum(['friendly', 'direct', 'premium', 'playful']);

export const landingPageHeroSchema = z.object({
  title: nonEmptyString.max(100, 'Hero title must be 100 characters or less'),
  subtitle: nonEmptyString.max(200, 'Hero subtitle must be 200 characters or less'),
  primaryCta: nonEmptyString.max(40, 'Primary CTA must be 40 characters or less'),
  secondaryCta: z.string().max(40, 'Secondary CTA must be 40 characters or less').optional(),
});

export const landingPageAboutCoachSchema = z.object({
  headline: nonEmptyString.max(80, 'About coach headline must be 80 characters or less'),
  bio: nonEmptyString.max(1000, 'Coach bio must be 1000 characters or less'),
  bullets: z.array(z.string().max(150))
    .min(2, 'Must have at least 2 bullet points')
    .max(6, 'Can have at most 6 bullet points'),
});

export const landingPageLearnItemSchema = z.object({
  title: nonEmptyString.max(80, 'Learn item title must be 80 characters or less'),
  description: nonEmptyString.max(200, 'Learn item description must be 200 characters or less'),
});

export const landingPageWhatYoullLearnSchema = z.object({
  headline: nonEmptyString.max(80, 'What you\'ll learn headline must be 80 characters or less'),
  items: z.array(landingPageLearnItemSchema)
    .min(3, 'Must have at least 3 learning outcomes')
    .max(8, 'Can have at most 8 learning outcomes'),
});

export const landingPageIncludedItemSchema = z.object({
  title: nonEmptyString.max(80, 'Included item title must be 80 characters or less'),
  description: nonEmptyString.max(200, 'Included item description must be 200 characters or less'),
});

export const landingPageWhatsIncludedSchema = z.object({
  headline: nonEmptyString.max(80, 'What\'s included headline must be 80 characters or less'),
  items: z.array(landingPageIncludedItemSchema)
    .min(3, 'Must have at least 3 included items')
    .max(8, 'Can have at most 8 included items'),
});

export const landingPageWhoItsForSchema = z.object({
  headline: nonEmptyString.max(80, 'Who it\'s for headline must be 80 characters or less'),
  items: z.array(z.string().max(150))
    .min(3, 'Must have at least 3 target audience items')
    .max(8, 'Can have at most 8 target audience items'),
});

export const landingPageTestimonialSchema = z.object({
  // Use placeholder names by default
  name: nonEmptyString.max(50, 'Testimonial name must be 50 characters or less'),
  role: z.string().max(80, 'Testimonial role must be 80 characters or less').optional(),
  quote: nonEmptyString.max(500, 'Testimonial quote must be 500 characters or less'),
});

export const landingPageFAQSchema = z.object({
  question: nonEmptyString.max(150, 'FAQ question must be 150 characters or less'),
  answer: nonEmptyString.max(500, 'FAQ answer must be 500 characters or less'),
});

export const landingPageDraftSchema = z.object({
  hero: landingPageHeroSchema,
  aboutCoach: landingPageAboutCoachSchema,
  whatYoullLearn: landingPageWhatYoullLearnSchema,
  whatsIncluded: landingPageWhatsIncludedSchema,
  whoItsFor: landingPageWhoItsForSchema,
  testimonials: z.array(landingPageTestimonialSchema)
    .min(2, 'Must have at least 2 testimonials')
    .max(6, 'Can have at most 6 testimonials'),
  faq: z.array(landingPageFAQSchema)
    .min(4, 'Must have at least 4 FAQs')
    .max(8, 'Can have at most 8 FAQs'),
  tone: landingPageToneSchema,
});

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export type ProgramContentDraft = z.infer<typeof programContentDraftSchema>;
export type LandingPageDraft = z.infer<typeof landingPageDraftSchema>;

/**
 * Validate a program content draft
 */
export function validateProgramContentDraft(draft: unknown): {
  success: boolean;
  data?: ProgramContentDraft;
  errors?: Array<{ path: string; message: string }>;
} {
  const result = programContentDraftSchema.safeParse(draft);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
    })),
  };
}

/**
 * Validate a landing page draft
 */
export function validateLandingPageDraft(draft: unknown): {
  success: boolean;
  data?: LandingPageDraft;
  errors?: Array<{ path: string; message: string }>;
} {
  const result = landingPageDraftSchema.safeParse(draft);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
    })),
  };
}

