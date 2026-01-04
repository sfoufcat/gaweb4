# Goal-Setting Onboarding Flow

## Overview

The goal-setting flow is the second part of the onboarding experience, coming immediately after the identity/mission screen. It allows users to set a specific, measurable goal with a target date, and uses AI validation to ensure goals are well-formed and achievable.

## Flow Architecture

### Pages

1. **Goal Input Page** (`/onboarding/goal`)
   - User enters their goal with typewriter-style input prefix "I want to..."
   - User selects a target date using a date picker
   - Displays a tip card with guidance on setting good goals
   - Full-width "Next" button at the bottom

2. **Commitment Page** (`/onboarding/commitment`)
   - Final success screen after goal is saved
   - Congratulatory message: "Fantastic! You've set your goal and your path. Now, it's time to commit!"
   - "Let's go!" button to complete onboarding

### State Machine

The goal page follows this state flow:

```
idle → validating → (good | needs_improvement) → saving → success
```

- **idle**: User is entering goal and selecting date
- **validating**: AI is validating the goal via Claude API
- **good**: Goal is well-formed, proceeds directly to saving
- **needs_improvement**: Shows suggestion modal with AI feedback
- **saving**: Saving goal to Firebase
- **success**: Redirects to commitment page

## Components

### GoalInput (`src/components/onboarding/GoalInput.tsx`)

- Typewriter-style input with prefix "I want to..."
- Example goals cycle through:
  - "launch the Coachful app..."
  - "grow to $50k MRR..."
  - "lose 10 kg..."
  - etc.
- Date picker interface for target date selection
- Styled to match identity input component

### GoalTip (`src/components/onboarding/GoalTip.tsx`)

- Simple tip card providing guidance
- Message: "Keep your goals simple and measurable. Avoid vague goals like 'I want to make money.' Instead set something like 'I want to grow to 50k MRR.'"
- Consistent styling with IdentityTip

### GoalSuggestionModal (`src/components/onboarding/GoalSuggestionModal.tsx`)

- Modal that appears when AI suggests improvements
- Displays:
  - Original goal with target date
  - AI feedback explaining the issue
  - Suggested improved goal
- Action buttons:
  - "Edit my goal" - Pre-fills input with suggested goal
  - "Proceed with this goal" - Keeps original goal

## API Endpoints

### POST `/api/goal/validate`

Validates a goal using Claude AI.

**Request:**
```json
{
  "goal": "string",
  "targetDate": "YYYY-MM-DD"
}
```

**Response:**
```json
{
  "status": "good" | "needs_improvement",
  "feedback": "AI explanation",
  "suggestedGoal": "improved goal text (if needs_improvement)"
}
```

### POST `/api/goal/save`

Saves the goal to Firebase.

**Request:**
```json
{
  "goal": "string",
  "targetDate": "YYYY-MM-DD",
  "isAISuggested": boolean
}
```

**Response:**
```json
{
  "success": true,
  "goal": "string",
  "targetDate": "YYYY-MM-DD",
  "setAt": "ISO timestamp"
}
```

## AI Validation Logic

The `validateGoal` function in `src/lib/anthropic.ts` uses Claude to:

1. Check if the goal is specific and measurable
2. Verify it's focused on a single objective
3. Ensure it's realistic for the timeframe
4. Confirm it's clear and actionable

Good goals:
- "Launch the Coachful app"
- "Grow to $50k MRR"
- "Lose 10 kg"

Goals that need improvement:
- "Make money" (too vague)
- "Complete tax filing for last year and this year, and set up a bookkeeper" (multiple objectives)
- "Become successful" (not measurable)

## Database Schema

Goals are stored in the `users` collection in Firebase with these fields:

```typescript
{
  goal: string;              // Current goal text
  goalTargetDate: string;    // Target date (ISO format)
  goalSetAt: string;         // When goal was set (ISO format)
  goalIsAISuggested: boolean; // Whether user accepted AI suggestion
  goalHistory: [{
    goal: string;
    targetDate: string;
    setAt: string;
    completedAt: string | null;
  }];
}
```

## Navigation Flow

```
/onboarding (mission) 
  → save identity 
  → /onboarding/goal 
  → validate goal
  → save goal 
  → /onboarding/commitment 
  → / (home)
```

## Design Consistency

All screens maintain the same visual system as the identity/mission page:

- **Layout**: Mobile-first 402px max width with desktop frame
- **Typography**: 
  - Headings: Albert Sans, 36px, -2px tracking
  - Body: Geist Sans
- **Colors**: 
  - Background: #faf8f6
  - Primary text: #1a1a1a
  - Secondary text: #5f5a55
  - Accent: #a07855
- **Buttons**: Full-width, rounded-full, bold with hover/active states
- **Spacing**: Generous whitespace, clear hierarchy

## Future Enhancements

- Goal progress tracking
- Goal completion flow
- Sub-goals or milestones
- Goal templates/categories
- Goal sharing with accountability partners
- Notifications/reminders based on target date















