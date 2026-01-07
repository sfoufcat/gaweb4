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
  onComplete: (data: Record<string, unknown>) => void;
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
  onComplete: (data: { userThought: string }) => void;
}

/**
 * Props for the NeutralizeStep (ai_reframe)
 */
export interface NeutralizeStepProps extends StepProps {
  config: Record<string, unknown>;
  data?: {
    userThought?: string;
  };
  onComplete: (data: { aiReframe: string }) => void;
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
    identityDuration?: number;
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
