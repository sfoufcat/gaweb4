# AI Helper System Documentation

## Overview

A reusable AI generation system for the coach/admin dashboard that generates:
1. **Program content** (days/weeks → tasks + default habits)
2. **Landing pages** (for Program and Squad)

Built on top of the existing Anthropic integration with one-shot generation (single prompt input), safe preview + confirm workflow, and full multi-tenant support.

---

## Architecture

### Core Library (`src/lib/ai/`)

```
src/lib/ai/
├── index.ts        # Public exports
├── types.ts        # TypeScript type definitions
├── schemas.ts      # Zod validation schemas
├── prompts.ts      # AI prompt templates (server-only)
└── generate.ts     # Core generation service
```

#### Key Components:

1. **`types.ts`** - Centralized type definitions
   - `AIUseCase`: `'PROGRAM_CONTENT' | 'LANDING_PAGE_PROGRAM' | 'LANDING_PAGE_SQUAD'`
   - `ProgramContentDraft`: Schema for generated program content
   - `LandingPageDraft`: Schema for generated landing pages
   - `AIGenerationContext`: Context object for generation

2. **`schemas.ts`** - Zod validation schemas
   - Enforces structure, length limits, and required fields
   - `validateProgramContentDraft()` / `validateLandingPageDraft()`

3. **`prompts.ts`** - Server-side prompt templates
   - `buildProgramContentPrompt()`: Creates prompts for program content
   - `buildLandingPagePrompt()`: Creates prompts for landing pages

4. **`generate.ts`** - Core generation service
   - `generate()`: Main function that calls Anthropic API
   - `validateDraft()`: Validates drafts against schemas
   - Built-in rate limiting (10 req/org/min)
   - Usage logging to `ai_usage_logs` collection

---

## API Routes

### POST `/api/ai/generate`

Generates content using AI based on the specified use case.

**Authorization:** Coach/Admin only (org-scoped)

**Request Body:**
```json
{
  "useCase": "PROGRAM_CONTENT" | "LANDING_PAGE_PROGRAM" | "LANDING_PAGE_SQUAD",
  "userPrompt": "Describe what you want...",
  "context": {
    "programName": "30-Day Creator Challenge",
    "duration": 30,
    "structure": "days",
    "niche": "Content creation",
    "targetAudience": "Aspiring creators"
  }
}
```

**Response:**
```json
{
  "draft": { /* ProgramContentDraft or LandingPageDraft */ },
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "inputTokens": 1234,
    "outputTokens": 5678,
    "createdAt": "2025-01-15T12:00:00.000Z",
    "estimatedCost": 0.0123
  }
}
```

### POST `/api/ai/validate`

Validates a draft against the schema for a given use case.

**Request Body:**
```json
{
  "useCase": "PROGRAM_CONTENT",
  "draft": { /* draft object */ }
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    { "path": "faq", "message": "Consider adding more FAQs" }
  ]
}
```

---

## UI Components

### `AIHelperModal` (`src/components/ai/AIHelperModal.tsx`)

A reusable modal component for AI content generation.

**Props:**
```typescript
interface AIHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  useCase: AIUseCase;
  context?: AIGenerationContext;
  onApply: (draft: ProgramContentDraft | LandingPageDraft) => void;
  hasExistingContent?: boolean;
  overwriteWarning?: string;
}
```

**Flow:**
1. Coach clicks "Fill with AI" or "Generate with AI"
2. Modal opens with textarea for prompt input
3. Context preview shows program/squad name, duration, etc.
4. User enters description of what they want
5. Loading state during generation (15-30 seconds)
6. Preview of generated content (read-only, expandable)
7. Apply / Regenerate / Cancel buttons
8. Overwrite warning if existing content exists

---

## Integration Points

### Program Content Editor

**Location:** `CoachProgramsTab.tsx` → Days view sidebar

**Button:** "Fill with AI" (gradient button with Sparkles icon)

**Behavior:**
- Generates content for all program days
- Creates tasks and habits per day
- Can set global default habits
- Shows warning if existing content will be replaced

### Program Landing Page Editor

**Location:** `CoachProgramsTab.tsx` → Landing Page view header

**Button:** "Generate with AI" (outline button)

**Behavior:**
- Generates complete landing page copy
- Maps to existing landing page fields
- Includes coach bio, outcomes, features, testimonials, FAQs

### Squad Landing Page Editor

**Location:** `CoachSquadsTab.tsx` → Landing Page view header

**Button:** "Generate with AI" (outline button)

**Behavior:**
- Same as program landing page
- Uses `LANDING_PAGE_SQUAD` use case
- Optimized for community/squad context

---

## Generated Content Schemas

### Program Content Draft

```typescript
{
  "structure": "days" | "weeks",
  "duration": number,
  "daysOrWeeks": [
    {
      "index": 1,
      "title": "Define Your Niche",
      "focus": "Clarity is the foundation of growth",
      "tasks": [
        {
          "title": "Define your content creator goal",
          "description": "Write down your 90-day vision",
          "type": "action" | "reflection",
          "estimatedMinutes": 20
        }
      ],
      "defaultHabits": [
        {
          "title": "Morning journaling",
          "frequency": "daily" | "3x_week" | "weekly",
          "notes": "5 minutes of reflection"
        }
      ]
    }
  ],
  "globalDefaultHabits": [/* same as defaultHabits */]
}
```

**Constraints:**
- 3-6 tasks per day/week max
- 0-3 default habits per day/week max
- Titles concise (≤100 chars)
- No medical/clinical claims

### Landing Page Draft

```typescript
{
  "hero": {
    "title": "Transform Your Content Game",
    "subtitle": "Join 100+ creators...",
    "primaryCta": "Get Started",
    "secondaryCta": "Learn More"
  },
  "aboutCoach": {
    "headline": "Your Guide to Growth",
    "bio": "I've helped 500+ creators...",
    "bullets": ["10+ years experience", "..."]
  },
  "whatYoullLearn": {
    "headline": "What You'll Master",
    "items": [{ "title": "...", "description": "..." }]
  },
  "whatsIncluded": {
    "headline": "Everything You Need",
    "items": [{ "title": "...", "description": "..." }]
  },
  "whoItsFor": {
    "headline": "Perfect For",
    "items": ["Aspiring creators", "..."]
  },
  "testimonials": [
    { "name": "Client A", "role": "Past Participant", "quote": "..." }
  ],
  "faq": [
    { "question": "How long is the program?", "answer": "..." }
  ],
  "tone": "friendly" | "direct" | "premium" | "playful"
}
```

**Constraints:**
- Testimonials use placeholder names (Client A, Client B, etc.)
- 4-8 FAQ items
- Scannable copy, no giant paragraphs

---

## Rate Limiting & Security

### Rate Limits
- 10 requests per organization per minute
- Window resets after 60 seconds
- Returns 429 with reset time on limit exceeded

### Authorization
- Only org admin/coach can call `/api/ai/generate`
- Validates orgId matches authenticated user's org
- Uses `requireCoachWithOrg()` for tenant-aware auth

### Usage Logging

All AI generation attempts are logged to Firestore:

```typescript
// ai_usage_logs collection
{
  id: string;
  organizationId: string;
  userId: string;
  useCase: AIUseCase;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number; // USD
  errorMessage?: string;
  createdAt: Timestamp;
}
```

---

## Future Extensions

The system is designed to be extensible for additional use cases:

1. **Add new use case:**
   - Add to `AIUseCase` type
   - Create schema in `schemas.ts`
   - Add prompt template in `prompts.ts`
   - Update `generate.ts` switch statement

2. **Add new entity type:**
   - Add context fields to `AIGenerationContext`
   - Create component integration similar to Programs/Squads

3. **Potential future use cases:**
   - Email sequences
   - Onboarding flows
   - Marketing copy
   - Course modules







