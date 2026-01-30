/**
 * Questionnaire Types
 *
 * Types for the Questionnaire feature - Tally-style forms that coaches
 * can create to collect information from clients.
 */

// ==========================================
// QUESTION TYPES
// ==========================================

/**
 * Available question types for questionnaires
 */
export type QuestionnaireQuestionType =
  | 'single_choice'     // Radio buttons - select one option
  | 'multi_choice'      // Checkboxes - select multiple options
  | 'short_text'        // Single line text input
  | 'long_text'         // Paragraph/textarea for longer responses
  | 'file_upload'       // File attachment (any file type)
  | 'media_upload'      // Image/video specifically
  | 'number'            // Numeric input
  | 'scale'             // Rating scale (1-5, 1-10, etc.)
  | 'info'              // Display-only content step (text, image, video)
  | 'page_break';       // Divides questionnaire into pages

/**
 * Option for choice-type questions (single_choice, multi_choice)
 */
export interface QuestionnaireOption {
  id: string;
  label: string;
  value: string;
  emoji?: string;
  imageUrl?: string;
  order: number;
}

/**
 * A single condition within a skip logic rule
 */
export interface SkipLogicCondition {
  id: string;
  /** Which question's answer to check (current question if omitted for backwards compat) */
  questionId?: string;
  /** The condition to evaluate */
  conditionType: 'equals' | 'contains' | 'not_equals';
  /** The value to match against the answer */
  conditionValue: string;
}

/**
 * Skip logic rule - conditionally skip to a question based on answer(s)
 * Supports multiple conditions with AND/OR logic
 */
export interface SkipLogicRule {
  id: string;
  /** Multiple conditions to evaluate */
  conditions: SkipLogicCondition[];
  /** How to combine conditions: 'and' = all must match, 'or' = any must match */
  operator: 'and' | 'or';
  /** Question ID to skip to, or null to skip to end/submit */
  skipToQuestionId: string | null;

  // Legacy fields for backwards compatibility (pre-migration rules)
  /** @deprecated Use conditions[0].conditionType */
  conditionType?: 'equals' | 'contains' | 'not_equals';
  /** @deprecated Use conditions[0].conditionValue */
  conditionValue?: string;
}

/**
 * Normalize a skip logic rule to ensure it has the new structure
 * Converts legacy single-condition rules to the new multi-condition format
 */
export function normalizeSkipLogicRule(rule: SkipLogicRule, currentQuestionId: string): SkipLogicRule {
  // Already has conditions array - return as-is
  if (rule.conditions && rule.conditions.length > 0) {
    return rule;
  }

  // Convert legacy format to new format
  if (rule.conditionType && rule.conditionValue !== undefined) {
    return {
      id: rule.id,
      conditions: [{
        id: crypto.randomUUID(),
        questionId: currentQuestionId,
        conditionType: rule.conditionType,
        conditionValue: rule.conditionValue,
      }],
      operator: 'and',
      skipToQuestionId: rule.skipToQuestionId,
    };
  }

  // Fallback: empty conditions
  return {
    ...rule,
    conditions: [],
    operator: rule.operator || 'and',
  };
}

/**
 * Individual question in a questionnaire
 */
export interface QuestionnaireQuestion {
  id: string;
  type: QuestionnaireQuestionType;
  /** The question text shown to respondents */
  title: string;
  /** Optional helper text below the question */
  description?: string;
  /** Whether an answer is required */
  required: boolean;
  /** Display order (0-indexed) */
  order: number;

  // ---- Type-specific configuration ----

  /** Options for choice types (single_choice, multi_choice) */
  options?: QuestionnaireOption[];

  /** Placeholder text for text inputs */
  placeholder?: string;

  /** Minimum character length for text types */
  minLength?: number;
  /** Maximum character length for text types */
  maxLength?: number;

  /** Minimum value for number/scale types */
  minValue?: number;
  /** Maximum value for number/scale types */
  maxValue?: number;

  /** Labels for scale endpoints (e.g., "Not satisfied" to "Very satisfied") */
  scaleLabels?: {
    min: string;
    max: string;
  };

  /** Accepted file types for file uploads (e.g., ['image/*', 'application/pdf']) */
  acceptedFileTypes?: string[];
  /** Maximum file size in MB for uploads */
  maxFileSizeMB?: number;

  // ---- Info step specific ----

  /** URL to media (image or video) for info step */
  mediaUrl?: string;
  /** Type of media for info step */
  mediaType?: 'image' | 'video';

  // ---- Skip logic ----

  /** Rules for conditionally skipping questions based on this answer */
  skipLogic?: SkipLogicRule[];
}

// ==========================================
// QUESTIONNAIRE
// ==========================================

/**
 * Questionnaire - A coach-created form for collecting information
 * Stored in Firestore 'questionnaires' collection
 */
export interface Questionnaire {
  id: string;
  /** Clerk Organization ID for multi-tenant scoping */
  organizationId: string;

  // ---- Identification ----

  /** URL-friendly identifier for shareable links */
  slug: string;
  /** Display title */
  title: string;
  /** Optional introduction text shown before questions */
  description?: string;

  // ---- Configuration ----

  /** Ordered list of questions */
  questions: QuestionnaireQuestion[];
  /** Whether the questionnaire is accepting responses */
  isActive: boolean;

  // ---- Response settings ----

  /** Whether the same user can submit multiple times */
  allowMultipleResponses: boolean;
  /** Always true - responses must be linked to authenticated users */
  requireAuth: true;

  // ---- Program association ----

  /** Program IDs this questionnaire is associated with (for content gating) */
  programIds?: string[];

  // ---- Skip Logic ----

  /** Global skip logic rules (cross-question logic) */
  skipLogicRules?: SkipLogicRule[];

  // ---- Styling (optional) ----

  /** Cover image URL for the questionnaire header */
  coverImageUrl?: string;
  /** Custom accent color (hex) */
  accentColor?: string;

  // ---- Metadata ----

  /** Denormalized count of responses for quick display */
  responseCount: number;
  /** Count of NEW responses since lastViewedAt (computed, not stored) */
  newResponseCount?: number;
  /** ISO timestamp when coach last viewed responses */
  lastViewedAt?: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** User ID of the creator */
  createdBy: string;
}

/**
 * Data for creating a new questionnaire
 */
export type CreateQuestionnaireData = Omit<
  Questionnaire,
  'id' | 'responseCount' | 'createdAt' | 'updatedAt' | 'createdBy' | 'organizationId'
>;

/**
 * Data for updating an existing questionnaire
 */
export type UpdateQuestionnaireData = Partial<
  Omit<Questionnaire, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>
>;

// ==========================================
// RESPONSES
// ==========================================

/**
 * Answer to a single question
 * The value type depends on the question type:
 * - single_choice: string (option value)
 * - multi_choice: string[] (array of option values)
 * - short_text/long_text: string
 * - number: number
 * - scale: number
 * - file_upload/media_upload: null (files stored in fileUrls)
 */
export interface QuestionnaireAnswer {
  questionId: string;
  questionType: QuestionnaireQuestionType;
  /** The answer value - type depends on question type */
  value: string | string[] | number | null;
  /** URLs for uploaded files (for file_upload/media_upload types) */
  fileUrls?: string[];
}

/**
 * A submitted response to a questionnaire
 * Stored in Firestore 'questionnaire_responses' collection
 */
export interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  organizationId: string;

  // ---- Respondent info ----

  /** Authenticated user ID (always present) */
  userId: string;
  /** Denormalized email for quick display in responses table */
  userEmail?: string;
  /** Denormalized name for quick display in responses table */
  userName?: string;
  /** User's avatar URL */
  userAvatarUrl?: string;

  // ---- Answers ----

  /** Array of answers, one per question answered */
  answers: QuestionnaireAnswer[];

  // ---- Metadata ----

  /** ISO timestamp of submission */
  submittedAt: string;
  /** Time from form load to submit in milliseconds */
  completionTimeMs?: number;
}

/**
 * Data for submitting a response
 */
export type SubmitResponseData = {
  questionnaireId: string;
  answers: QuestionnaireAnswer[];
  completionTimeMs?: number;
};

// ==========================================
// API RESPONSE TYPES
// ==========================================

/**
 * Response from GET /api/coach/questionnaires
 */
export interface QuestionnairesListResponse {
  questionnaires: Questionnaire[];
  totalCount: number;
}

/**
 * Response from GET /api/coach/questionnaires/[id]/responses
 */
export interface QuestionnaireResponsesListResponse {
  responses: QuestionnaireResponse[];
  totalCount: number;
  questionnaire: Pick<Questionnaire, 'id' | 'title' | 'questions'>;
}

// ==========================================
// UI HELPER TYPES
// ==========================================

/**
 * Question type metadata for the UI
 */
export interface QuestionTypeInfo {
  type: QuestionnaireQuestionType;
  label: string;
  description: string;
  icon: string; // Lucide icon name
}

/**
 * All available question types with their metadata
 */
export const QUESTION_TYPES: QuestionTypeInfo[] = [
  {
    type: 'single_choice',
    label: 'Single Choice',
    description: 'Select one option from a list',
    icon: 'CircleDot',
  },
  {
    type: 'multi_choice',
    label: 'Multiple Choice',
    description: 'Select multiple options',
    icon: 'CheckSquare',
  },
  {
    type: 'short_text',
    label: 'Short Text',
    description: 'Single line text response',
    icon: 'Type',
  },
  {
    type: 'long_text',
    label: 'Long Text',
    description: 'Paragraph text response',
    icon: 'AlignLeft',
  },
  {
    type: 'file_upload',
    label: 'File Upload',
    description: 'Upload any file type',
    icon: 'Paperclip',
  },
  {
    type: 'media_upload',
    label: 'Image/Video',
    description: 'Upload images or videos',
    icon: 'Image',
  },
  {
    type: 'number',
    label: 'Number',
    description: 'Numeric input',
    icon: 'Hash',
  },
  {
    type: 'scale',
    label: 'Scale',
    description: 'Rating on a numeric scale',
    icon: 'SlidersHorizontal',
  },
  {
    type: 'info',
    label: 'Info',
    description: 'Display text, image or video',
    icon: 'Info',
  },
  {
    type: 'page_break',
    label: 'Page Break',
    description: 'Divide into sections',
    icon: 'SeparatorHorizontal',
  },
];

/**
 * Get question type info by type
 */
export function getQuestionTypeInfo(type: QuestionnaireQuestionType): QuestionTypeInfo | undefined {
  return QUESTION_TYPES.find(t => t.type === type);
}

/**
 * Create a new empty question with defaults
 */
export function createEmptyQuestion(type: QuestionnaireQuestionType, order: number): QuestionnaireQuestion {
  const baseQuestion: QuestionnaireQuestion = {
    id: crypto.randomUUID(),
    type,
    title: '',
    required: false,
    order,
  };

  // Add type-specific defaults
  switch (type) {
    case 'single_choice':
    case 'multi_choice':
      return {
        ...baseQuestion,
        options: [
          { id: crypto.randomUUID(), label: 'Option 1', value: 'option_1', order: 0 },
          { id: crypto.randomUUID(), label: 'Option 2', value: 'option_2', order: 1 },
        ],
      };
    case 'short_text':
      return {
        ...baseQuestion,
        placeholder: 'Type your answer...',
        maxLength: 500,
      };
    case 'long_text':
      return {
        ...baseQuestion,
        placeholder: 'Type your answer...',
        maxLength: 5000,
      };
    case 'number':
      return {
        ...baseQuestion,
        placeholder: 'Enter a number',
      };
    case 'scale':
      return {
        ...baseQuestion,
        minValue: 1,
        maxValue: 5,
        scaleLabels: {
          min: 'Low',
          max: 'High',
        },
      };
    case 'file_upload':
      return {
        ...baseQuestion,
        acceptedFileTypes: ['*/*'],
        maxFileSizeMB: 10,
      };
    case 'media_upload':
      return {
        ...baseQuestion,
        acceptedFileTypes: ['image/*', 'video/*'],
        maxFileSizeMB: 50,
      };
    case 'info':
      return {
        ...baseQuestion,
        title: '',
        description: '',
        required: false, // Info steps are never required (no input)
      };
    case 'page_break':
      return {
        ...baseQuestion,
        title: '',
        description: '',
        required: false, // Page breaks are never required
      };
    default:
      return baseQuestion;
  }
}

/**
 * Create a new empty questionnaire with defaults
 */
export function createEmptyQuestionnaire(): Omit<Questionnaire, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'responseCount'> {
  return {
    slug: '',
    title: 'Untitled Questionnaire',
    description: '',
    questions: [],
    isActive: true,
    allowMultipleResponses: false,
    requireAuth: true,
  };
}
