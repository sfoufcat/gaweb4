# Mission Onboarding System - Technical Documentation

## Overview

The mission onboarding system guides users through defining their personal mission statement with AI-powered validation. This document explains the architecture, state management, and extension points.

## Architecture

### Component Structure

```
src/app/onboarding/page.tsx          # Main page with state orchestration
├── src/components/onboarding/
│   ├── MissionInput.tsx             # Card-based input with typewriter effect
│   ├── MissionTipCard.tsx           # Helper tips and templates
│   └── MissionSuggestionCard.tsx    # AI feedback display
```

### API Endpoints

```
POST /api/identity/validate          # Validates mission with Anthropic Claude AI
├── Input: { statement: string }
└── Output: { isValid: boolean, reasoning?: string, suggestion?: string }

POST /api/identity/save              # Saves mission to Firestore
├── Input: { statement: string }
└── Output: { success: boolean, identity: string, setAt: string }
```

## State Management

### Validation States

The onboarding page uses a single state machine with these states:

| State | Description | User Actions Available | Next State(s) |
|-------|-------------|----------------------|---------------|
| `idle` | Initial state, user entering mission | Type, Click "Continue" | `validating` |
| `validating` | AI is analyzing mission | None (loading) | `accepted`, `needs_suggestion`, `error` |
| `accepted` | AI approved the mission | Click "Proceed with this mission" | `saving` |
| `needs_suggestion` | AI suggests improvements | "Use suggestion", "Keep mine" | `accepted` |
| `saving` | Mission being saved to database | None (loading) | Success → Navigate to home, `error` |
| `error` | An error occurred | Edit mission, Retry | `idle` |

### State Transitions Flow

```
┌─────────────────────────────────────────────────────────┐
│                         START                           │
│                           ↓                             │
│                        [idle]                           │
│                           ↓                             │
│                    User types mission                   │
│                           ↓                             │
│                  User clicks "Continue"                 │
│                           ↓                             │
│                     [validating]                        │
│                           ↓                             │
│          ┌────────────────┴────────────────┐           │
│          ↓                                  ↓           │
│     AI approves                       AI suggests       │
│          ↓                            improvement       │
│     [accepted] ←──────────────────────────┘            │
│          │                                              │
│          │  User: "Use suggestion" or "Keep mine"      │
│          ↓                                              │
│  User clicks "Proceed"                                  │
│          ↓                                              │
│       [saving]                                          │
│          ↓                                              │
│  Navigate to home (/)                                   │
└─────────────────────────────────────────────────────────┘

Error handling: Any state can transition to [error], 
then back to [idle] for retry
```

## Component API Documentation

### MissionInput

Card-based input component with typewriter placeholder effect.

**Props:**
- `value: string` - Current mission text
- `onChange: (value: string) => void` - Called when user types
- `disabled?: boolean` - Disable input during validation/saving
- `isValid?: boolean` - Show green validation styling
- `autoFocus?: boolean` - Auto-focus on mount (default: true)

**Features:**
- Typewriter effect cycles through 5 example missions
- "I am..." prefix with perfect cursor alignment
- 200 character limit with live counter
- Multiline support with proper text wrapping
- Visual feedback for validation state (green border when valid)

**Technical Details:**
- Uses `useRef` to measure "I am " width dynamically
- Applies `text-indent` to textarea for cursor alignment
- Overlay architecture: visual layer (pointer-events-none) + interactive layer (textarea)
- Custom caret color: `#a07855` (accent-secondary)

### MissionTipCard

Compact card displaying helpful tips and templates.

**Features:**
- Icon-based visual hierarchy
- 3 mission statement templates
- Warm amber color scheme
- No props - static content

**Usage:**
Show during `idle` state to guide users before validation.

### MissionSuggestionCard

Displays AI feedback when a mission needs improvement.

**Props:**
- `feedback: string` - AI reasoning/explanation
- `suggestion: string` - AI-suggested alternative mission
- `onUseSuggestion: () => void` - Replace user's mission with suggestion
- `onKeepOriginal: () => void` - Keep user's original mission

**Features:**
- Clear visual hierarchy: icon → feedback → suggestion quote → buttons
- Two-button layout: primary (use suggestion) + secondary (keep mine)
- Blue color scheme to differentiate from tip card

**Usage:**
Show during `needs_suggestion` state, hide when user makes a choice.

## Database Schema

### Firestore: users/{userId}

```typescript
{
  identity: string,              // Current mission statement
  identitySetAt: string,         // ISO timestamp when set
  identityHistory: [             // Previous missions (for edit tracking)
    {
      statement: string,
      setAt: string
    }
  ],
  updatedAt: string              // Last profile update timestamp
}
```

## Extension Points

### Adding Profile Page

To display/edit mission on profile page:

1. Import `useServerUser` hook:
```typescript
import { useServerUser } from '@/hooks/useServerUser';

const { user, loading } = useServerUser();
// user.identity contains the mission
```

2. To allow editing, reuse `MissionInput` component:
```typescript
<MissionInput 
  value={editedMission} 
  onChange={setEditedMission}
  autoFocus={false}
/>
```

3. Save changes via same API:
```typescript
await fetch('/api/identity/save', {
  method: 'POST',
  body: JSON.stringify({ statement: newMission })
});
```

### Customizing Validation Logic

Edit `src/lib/anthropic.ts` to modify AI prompts or validation criteria.

Current validation checks:
- Is an identity statement (not a goal)
- Uses "I am" framing
- Specific and actionable
- Not too generic

### Adding Analytics

Track state transitions in `src/app/onboarding/page.tsx`:

```typescript
// Add to each state transition
const handleValidate = async () => {
  analytics.track('mission_validation_started');
  setValidationState('validating');
  // ...
};
```

Key events to track:
- `mission_validation_started`
- `mission_validation_accepted`
- `mission_validation_rejected`
- `mission_suggestion_used`
- `mission_suggestion_ignored`
- `mission_saved`

### Internationalization

To add i18n support:

1. Extract all strings to translation files:
   - Page title: "What is your mission?"
   - Button labels: "Continue", "Proceed with this mission"
   - Tip content in `MissionTipCard`
   - Error messages

2. Update `EXAMPLE_IDENTITIES` array in `MissionInput.tsx` with localized examples

3. Ensure AI validation supports target language (Anthropic Claude is multilingual)

## Styling System

### Color Palette

- **Primary Action**: `#1A1A1A` (gray-900) - Main buttons
- **Disabled**: `#E5E5E5` (gray-200) - Disabled button background
- **Success**: Green-50/200/700 - Validation success
- **Suggestion**: Blue-50/100/600/700 - AI suggestion card
- **Tip**: Amber-50/100/200/700 - Helper tips
- **Accent**: `#a07855` - Cursor and highlights

### Responsive Design

- Mobile: Full-width card with padding
- Desktop: Centered card (max-width: 2xl = 672px)
- All components designed mobile-first
- Touch-friendly button sizes (py-4 = 1rem top/bottom)

### Typography

- **Heading**: 4xl-5xl (36-48px), bold, gray-900
- **Subtitle**: lg (18px), regular, gray-600
- **Mission Input**: 2xl (24px), gray-900
- **Body Text**: sm-base (14-16px), gray-600/700
- **Helper Text**: xs-sm (12-14px), gray-500

## Testing Checklist

### Manual Testing

- [ ] Typewriter effect cycles through examples
- [ ] Can type in mission (min 10 chars to enable button)
- [ ] "Continue" button disabled when < 10 chars
- [ ] Loading state shows spinner during validation
- [ ] AI approval shows green success message
- [ ] AI rejection shows suggestion card
- [ ] "Use suggestion" replaces text and shows success
- [ ] "Keep mine" proceeds with original text
- [ ] "Proceed" button saves to database
- [ ] After save, redirects to home page
- [ ] Error states show helpful messages
- [ ] Character counter updates live (0/200)
- [ ] Mission history preserved in database

### API Testing

```bash
# Test validation endpoint
curl -X POST http://localhost:3000/api/identity/validate \
  -H "Content-Type: application/json" \
  -d '{"statement":"a developer who builds great products"}'

# Test save endpoint (requires auth)
curl -X POST http://localhost:3000/api/identity/save \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=..." \
  -d '{"statement":"a developer who builds great products"}'
```

## Troubleshooting

### Issue: Cursor misaligned in input

**Cause**: Font measurement mismatch between visual and interactive layers

**Fix**: Ensure both layers use identical font styles:
```css
font-sans text-2xl tracking-[-0.5px] leading-[1.3]
```

### Issue: Typewriter effect stops

**Cause**: Component unmounted/remounted or hook not properly initialized

**Fix**: Check `useTypewriter` hook dependencies and cleanup

### Issue: Save fails silently

**Cause**: Firebase Admin SDK not initialized or auth token missing

**Fix**: 
1. Verify Doppler environment variables are loaded
2. Check Clerk auth token in request
3. Review Firebase Admin SDK initialization in `src/lib/firebase-admin.ts`

### Issue: AI validation returns error

**Cause**: Anthropic API key missing or rate limited

**Fix**:
1. Verify `ANTHROPIC_API_KEY` in Doppler
2. Check Anthropic dashboard for rate limits
3. Review error logs in API route

## Performance Considerations

- **Typewriter effect**: Uses `setTimeout`, cleanup prevents memory leaks
- **Textarea measurement**: Only measures on mount, cached in ref
- **API calls**: Debounce not needed (user-triggered, not on-change)
- **Database writes**: Single write per save, atomic operation
- **Loading states**: Prevent double-submission with state checks

## Security

- **Authentication**: All API routes check Clerk auth token
- **Input validation**: 200 char limit, trim whitespace, type checking
- **Database access**: Firebase Admin SDK with server-side rules
- **XSS prevention**: React escapes text automatically
- **Rate limiting**: Consider adding for API routes in production

## Future Enhancements

1. **Mission categories/tags**: Allow users to categorize their mission
2. **Mission sharing**: Share mission with community (optional)
3. **Mission reminders**: Daily/weekly notifications
4. **Mission evolution tracking**: Visualize how mission changes over time
5. **AI-powered suggestions**: Proactive mission refinement suggestions
6. **Mission templates library**: Curated examples by industry/role
7. **Collaborative missions**: Team or partnership missions

---

**Last Updated**: November 2025  
**Maintained By**: GrowthAddicts Team

