/**
 * Check-in Step Components
 *
 * These components are extracted from the original check-in pages
 * and adapted to work with the dynamic flow system (CheckInFlowRenderer).
 *
 * Each component accepts standardized props:
 * - config: Step configuration from flow definition
 * - data: Session data from previous steps (optional)
 * - onComplete: Callback to advance to next step
 */

export * from './types';

// Morning check-in steps
export { EmotionalStartStep } from './EmotionalStartStep';
export { AcceptStep } from './AcceptStep';
export { BreathStep } from './BreathStep';
export { ReframeStep } from './ReframeStep';
export { NeutralizeStep } from './NeutralizeStep';
export { BeginManifestStep } from './BeginManifestStep';
export { ManifestStep } from './ManifestStep';
export { PlanDayStep } from './PlanDayStep';

// Evening check-in steps
export { EveningTaskReviewStep } from './EveningTaskReviewStep';
export { EveningMoodStep } from './EveningMoodStep';
export { EveningReflectionStep } from './EveningReflectionStep';

// Weekly check-in steps
export { OnTrackStep } from './OnTrackStep';
export { WeeklyProgressStep } from './WeeklyProgressStep';
export { VoiceTextStep } from './VoiceTextStep';
export { WeeklyFocusStep } from './WeeklyFocusStep';
