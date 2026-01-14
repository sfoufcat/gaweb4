# Program Content Linking Plan

## Overview

Enable attaching various content types (events/calls, courses, articles, links, downloads, questionnaires) to program weeks and days, similar to how tasks work today. This creates a unified "Resources" concept that coaches can manage.

---

## Current State

### What Already Exists

1. **Week-level call linking**: `ProgramInstanceWeek.linkedCallEventIds` and `linkedSummaryIds` already exist and are used in WeekEditor
2. **Day-level course assignments**: `ProgramInstanceDay.courseAssignments` with `DayCourseAssignment` type
3. **Weekend handling**: `includeWeekends` flag on programs, with `calculateCalendarWeeks()` and `dayIndexToDate()` utilities in `calendar-weeks.ts`
4. **Event fields**: `UnifiedEvent` already has `programId`, `programIds`, `squadId`, `cohortId`, and `programWeekId`
5. **Call Summaries**: `CallSummary` type in `call_summaries` collection, linked via `linkedSummaryIds` on weeks
6. **Content Types**: `DiscoverArticle`, `DiscoverDownload`, `DiscoverLink`, `Questionnaire` all exist

### What's Missing

1. **Day-level event linking**: No `linkedEventIds` on `ProgramInstanceDay`
2. **Day-level summary linking**: No `linkedSummaryIds` on `ProgramInstanceDay`
3. **Content attachment**: No way to attach articles, downloads, links, questionnaires to weeks/days
4. **Auto-calculation of week/day from event date**: When scheduling a call, no automatic linking to the program day
5. **Instance-level linking on events**: `UnifiedEvent` lacks `instanceId`, `weekIndex`, `dayIndex`
6. **Resources tab UI**: Week/Day editors show calls and courses separately, not in a unified "Resources" tab

---

## Call Summary Flow (Current + Enhanced)

### Current Flow
1. **Call happens** → Stream Video webhook triggers
2. **Summary generated** → `CallSummary` doc created in `call_summaries` collection
3. **Summary linked to week** → `linkedSummaryIds` array on `ProgramInstanceWeek` gets the summary ID
4. **Events linked separately** → `linkedCallEventIds` on week stores event IDs

### Key Relationships
- `CallSummary.eventId` → points to the `UnifiedEvent`
- `CallSummary.programEnrollmentId` → links to enrollment context
- `ProgramInstanceWeek.linkedSummaryIds` → array of `CallSummary` IDs
- `ProgramInstanceWeek.linkedCallEventIds` → array of `UnifiedEvent` IDs

### Enhanced Flow (After This Work)
1. **When scheduling a call** with program context:
   - Calculate which week/day it falls on based on date
   - Store `instanceId`, `weekIndex`, `dayIndex` on the event
   - Add event ID to `week.linkedCallEventIds` AND `day.linkedEventIds`

2. **When call ends** and summary is generated:
   - Existing: Add to `week.linkedSummaryIds`
   - **NEW**: Also add to `day.linkedSummaryIds` for day-level display

3. **When coach uploads a recording** manually:
   - Summary gets generated
   - Link summary to the appropriate week AND day
   - This ensures uploaded recordings appear in the correct program context

---

## Data Model Changes

### 1. Add fields to `UnifiedEvent` (src/types/index.ts)

```typescript
// Add to UnifiedEvent interface:
instanceId?: string;      // program_instances doc ID
weekIndex?: number;       // 0-based week number in program
dayIndex?: number;        // 1-based global day index in program (optional - can be week-only)
```

### 2. Add fields to `ProgramInstanceDay` (src/types/index.ts)

```typescript
export interface ProgramInstanceDay {
  // ... existing fields ...
  linkedEventIds?: string[];      // UnifiedEvent IDs linked to this day
  linkedSummaryIds?: string[];    // CallSummary IDs linked to this day
  linkedArticleIds?: string[];    // DiscoverArticle IDs
  linkedDownloadIds?: string[];   // DiscoverDownload IDs
  linkedLinkIds?: string[];       // DiscoverLink IDs
  linkedQuestionnaireIds?: string[]; // Questionnaire IDs
}
```

### 3. Add fields to `ProgramInstanceWeek` (src/types/index.ts)

```typescript
export interface ProgramInstanceWeek {
  // ... existing fields (linkedCallEventIds, linkedSummaryIds already exist) ...
  linkedArticleIds?: string[];    // DiscoverArticle IDs
  linkedDownloadIds?: string[];   // DiscoverDownload IDs
  linkedLinkIds?: string[];       // DiscoverLink IDs
  linkedQuestionnaireIds?: string[]; // Questionnaire IDs
}
```

### 4. Update `CallSummary` (src/types/index.ts)

```typescript
export interface CallSummary {
  // ... existing fields ...
  instanceId?: string;    // NEW: program_instances doc ID
  weekIndex?: number;     // NEW: 0-based week number
  dayIndex?: number;      // NEW: 1-based global day index
}
```

---

## API Changes

### 1. Update Event Creation/Update APIs

**Files to modify:**
- `src/app/api/events/route.ts` (POST)
- `src/app/api/events/[eventId]/route.ts` (PATCH)
- `src/app/api/scheduling/propose/route.ts`
- `src/app/api/scheduling/respond/route.ts`

**Logic:**
When creating/updating a `coaching_1on1` event with `instanceId`:
1. Calculate which week/day the event falls on using `calculateProgramDayForDate()`
2. Set `weekIndex` and `dayIndex` on the event
3. Update the instance's week `linkedCallEventIds` array
4. Update the instance's day `linkedEventIds` array

### 2. New utility function: `calculateProgramDayForDate()`

**File:** `src/lib/calendar-weeks.ts`

```typescript
/**
 * Given an instance start date and a target date, calculate the program day index
 * Accounts for includeWeekends setting (skips weekends if false)
 * @returns { weekIndex, dayIndex, globalDayIndex } or null if date is outside program
 */
export function calculateProgramDayForDate(
  instanceStartDate: string,
  targetDate: string,
  totalDays: number,
  includeWeekends: boolean
): { weekIndex: number; dayIndex: number; globalDayIndex: number } | null
```

### 3. Update Call Summary Generation

**Files:**
- `src/lib/ai/call-summary.ts`
- `src/app/api/webhooks/stream-video/route.ts`
- `src/app/api/coach/recordings/upload/route.ts`

**Logic:**
When generating/linking a call summary:
1. If event has `instanceId`, `weekIndex`, `dayIndex`:
   - Add summary ID to `week.linkedSummaryIds` (existing)
   - **NEW**: Add summary ID to `day.linkedSummaryIds`
   - Store `instanceId`, `weekIndex`, `dayIndex` on the `CallSummary` doc
2. When coach uploads a recording manually:
   - Prompt for or auto-detect which week/day it belongs to
   - Link summary to both week AND day

### 4. Update Instance Day/Week APIs

**Files:**
- `src/app/api/instances/[instanceId]/days/[dayIndex]/route.ts`
- `src/app/api/instances/[instanceId]/weeks/[weekNum]/route.ts`

Add support for:
- `linkedEventIds` field updates (day)
- `linkedSummaryIds` field updates (day)
- `linkedArticleIds` field updates (day + week)
- `linkedDownloadIds` field updates (day + week)
- `linkedLinkIds` field updates (day + week)
- `linkedQuestionnaireIds` field updates (day + week)

---

## Content Types Summary

| Type | Collection | Week Field | Day Field | Special Logic |
|------|------------|------------|-----------|---------------|
| Events/Calls | `events` | `linkedCallEventIds` | `linkedEventIds` | Auto-link by date, shows upcoming calls |
| Call Summaries | `call_summaries` | `linkedSummaryIds` | `linkedSummaryIds` | Auto-generated after call, linked to week+day |
| Courses | `courses` | - | `courseAssignments` | Has completion tracking |
| Articles | `articles` | `linkedArticleIds` | `linkedArticleIds` | Simple attachment |
| Downloads | `downloads` | `linkedDownloadIds` | `linkedDownloadIds` | Simple attachment |
| Links | `links` | `linkedLinkIds` | `linkedLinkIds` | Simple attachment |
| Questionnaires | `questionnaires` | `linkedQuestionnaireIds` | `linkedQuestionnaireIds` | Has response tracking |

---

## UI Changes

### 1. ScheduleCallModal - Add program linking option

**File:** `src/components/scheduling/ScheduleCallModal.tsx`

**Changes:**
- Detect if client has an active 1:1 program enrollment
- If yes, show checkbox: "Link to [Program Name]?"
- When checked, auto-calculate which week/day based on selected datetime
- Display: "This will be added to Week X, Day Y"
- Pass `instanceId`, `weekIndex`, `dayIndex` to the API

### 2. WeekEditor - Add Resources tab

**File:** `src/components/coach/programs/WeekEditor.tsx`

**Changes:**
- Add new "Resources" tab alongside existing tabs
- Move existing "Link Call Events" UI into Resources tab
- Show linked summaries with their content
- Add selectors for: articles, downloads, links, questionnaires
- Show all resources in a unified list with type icons

### 3. DayEditor - Add Resources tab

**File:** `src/components/coach/programs/DayEditor.tsx`

**Changes:**
- Add new "Resources" tab
- Move existing `DayCourseSelector` into Resources tab
- Add ability to link events to specific days
- Show linked summaries
- Add selectors for: articles, downloads, links, questionnaires
- Show all resources in a unified list

### 4. Client view - Show resources

**Files:**
- `src/components/program/ProgramDetailView.tsx`
- `src/components/program/DayView.tsx` (if exists, or create)

**Changes:**
- Display linked events/calls for the day/week (e.g., "Call in 3 days")
- Display call summaries after calls complete
- Display assigned courses with progress
- Display articles, downloads, links, questionnaires
- Show appropriate CTAs (open, download, fill out, etc.)

---

## Implementation Phases

### Phase 1: Data Model & Utilities (Backend Foundation)

1. Add `instanceId`, `weekIndex`, `dayIndex` to `UnifiedEvent` type
2. Add day-level fields: `linkedEventIds`, `linkedSummaryIds`, `linkedArticleIds`, etc.
3. Add week-level fields: `linkedArticleIds`, `linkedDownloadIds`, etc.
4. Add `instanceId`, `weekIndex`, `dayIndex` to `CallSummary` type
5. Create `calculateProgramDayForDate()` utility

### Phase 2: Event & Summary Linking (Backend Logic)

1. Update event creation APIs to auto-link to week+day when `instanceId` provided
2. Update call summary generation to link to both week AND day
3. Update recording upload to link summaries to week+day
4. Update instance day/week APIs to handle all new fields

### Phase 3: ScheduleCallModal Enhancement (Frontend - Scheduling)

1. Detect active 1:1 enrollment for the client
2. Add "Link to program" checkbox
3. Show calculated week/day
4. Pass linking fields to API

### Phase 4: Resources Tab in WeekEditor (Coach UI)

1. Add Resources tab
2. Move call linking UI to Resources tab
3. Show linked summaries
4. Add content selectors (articles, downloads, links, questionnaires)
5. Test with existing programs

### Phase 5: Resources Tab in DayEditor (Coach UI)

1. Add Resources tab to DayEditor
2. Move course selector to Resources tab
3. Add event linking to specific days
4. Show linked summaries
5. Add content selectors

### Phase 6: Client View Enhancement

1. Display resources in day/week view
2. Show upcoming calls ("Call in 3 days")
3. Show linked calls with summaries after completion
4. Show course assignments with progress
5. Show articles, downloads, links, questionnaires with appropriate CTAs

---

## Deprecation Notes

### Fields to keep (backward compat):
- `ProgramInstanceWeek.linkedCallEventIds` - keep, used extensively
- `ProgramInstanceWeek.linkedSummaryIds` - keep, used for AI summaries
- `ProgramInstanceDay.courseAssignments` - keep, already works

### Fields to deprecate over time:
- `UnifiedEvent.programWeekId` - replace with `weekIndex` + `instanceId`
- `CallSummary.programEnrollmentId` - replace with `instanceId`

---

## Files to Modify

### Types
- `src/types/index.ts` - Add new fields to `UnifiedEvent`, `ProgramInstanceDay`, `ProgramInstanceWeek`, `CallSummary`

### Utilities
- `src/lib/calendar-weeks.ts` - Add `calculateProgramDayForDate()`

### APIs - Events
- `src/app/api/events/route.ts`
- `src/app/api/events/[eventId]/route.ts`
- `src/app/api/scheduling/propose/route.ts`
- `src/app/api/scheduling/respond/route.ts`

### APIs - Summaries
- `src/lib/ai/call-summary.ts`
- `src/app/api/webhooks/stream-video/route.ts`
- `src/app/api/coach/recordings/upload/route.ts`

### APIs - Instances
- `src/app/api/instances/[instanceId]/days/[dayIndex]/route.ts`
- `src/app/api/instances/[instanceId]/weeks/[weekNum]/route.ts`

### Components
- `src/components/scheduling/ScheduleCallModal.tsx`
- `src/components/coach/programs/WeekEditor.tsx`
- `src/components/coach/programs/DayEditor.tsx`
- `src/components/program/ProgramDetailView.tsx`

### Hooks (may need)
- `src/hooks/useClientEnrollment.ts` or similar - to detect active 1:1 program
