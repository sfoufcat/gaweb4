import type { EmotionalState } from '@/types';

/**
 * Base props interface for all check-in step components.
 * Each step receives configuration from the flow system and calls onComplete when done.
 */
export interface StepProps {
  /** Step-specific configuration from the flow definition */
  config: Record<string, unknown>;
  /** Accumulated session data from previous steps */
  data?: Record<string, unknown>;
  /** Callback to signal step completion, optionally passing data to accumulate */
  onComplete: (data?: Record<string, unknown>) => void;
}

/**
 * Props for the EmotionalStartStep (mood_scale)
 */
export interface EmotionalStartStepProps extends StepProps {
  config: {
    question?: string;
    fieldName?: string;
  };
}

/**
 * Props for the AcceptStep
 */
export interface AcceptStepProps extends StepProps {
  config: {
    heading?: string;
    message?: string;
  };
  data?: {
    emotionalState?: EmotionalState;
  };
}

/**
 * Props for the BreathStep (breathing)
 */
export interface BreathStepProps extends StepProps {
  config: {
    cycles?: number;
    heading?: string;
  };
}

/**
 * Props for the ReframeStep (reframe_input)
 */
export interface ReframeStepProps extends StepProps {
  config: {
    placeholder?: string;
  };
}

/**
 * Props for the NeutralizeStep (ai_reframe)
 */
export interface NeutralizeStepProps extends StepProps {
  config: Record<string, unknown>;
  data?: {
    userThought?: string;
  };
}

/**
 * Props for the BeginManifestStep
 */
export interface BeginManifestStepProps extends StepProps {
  config: {
    heading?: string;
  };
}

/**
 * Props for the ManifestStep (visualization)
 */
export interface ManifestStepProps extends StepProps {
  config: {
    showIdentity?: boolean;
    showGoal?: boolean;
    identityUnlockDuration?: number;
    identityAutoContinueDuration?: number;
    goalDuration?: number;
  };
}

/**
 * Props for the PlanDayStep (task_planner)
 */
export interface PlanDayStepProps extends StepProps {
  config: {
    heading?: string;
  };
}

// ============================================
// Evening Check-in Step Props
// ============================================

/**
 * Props for the EveningTaskReviewStep (evening_task_review)
 */
export interface EveningTaskReviewStepProps extends StepProps {
  config: {
    heading?: string;
    allCompletedEmoji?: string;
    partialEmoji?: string;
    allCompletedTitle?: string;
    partialTitle?: string;
    allCompletedMessage?: string;
    partialMessage?: string;
    noTasksMessage?: string;
  };
}

/**
 * Props for the EveningMoodStep (evening_mood)
 */
export interface EveningMoodStepProps extends StepProps {
  config: {
    question?: string;
    states?: Array<{
      value: string;
      label: string;
      gradient: string;
    }>;
  };
}

/**
 * Props for the EveningReflectionStep (evening_reflection)
 */
export interface EveningReflectionStepProps extends StepProps {
  config: {
    question?: string;
    placeholder?: string;
    showSkip?: boolean;
    fieldName?: string;
    enableVoice?: boolean;
  };
}

// ============================================
// Weekly Check-in Step Props
// ============================================

/**
 * Props for the OnTrackStep (on_track_scale)
 */
export interface OnTrackStepProps extends StepProps {
  config: {
    question?: string;
    subheading?: string;
    options?: Array<{
      value: string;
      label: string;
      gradient: string;
    }>;
  };
}

/**
 * Props for the WeeklyProgressStep (momentum_progress)
 */
export interface WeeklyProgressStepProps extends StepProps {
  config: {
    question?: string;
    showGoal?: boolean;
    goalAchievedThreshold?: number;
    enableMomentum?: boolean;
    enableAudioFeedback?: boolean;
  };
}

/**
 * Props for the VoiceTextStep (voice_text)
 */
export interface VoiceTextStepProps extends StepProps {
  config: {
    question?: string;
    placeholder?: string;
    fieldName?: string;
    isRequired?: boolean;
    enableVoice?: boolean;
  };
}

/**
 * Props for the WeeklyFocusStep (weekly_focus)
 */
export interface WeeklyFocusStepProps extends StepProps {
  config: {
    question?: string;
    placeholder?: string;
    showAiSuggestion?: boolean;
    showSkip?: boolean;
    isPublic?: boolean;
  };
}
