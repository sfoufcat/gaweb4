# Calendar-Aligned Weeks Implementation Plan

## Overview

Change program week display to align with calendar weeks (Mon-Fri) instead of continuous day counting. Users always start with an "Onboarding Week" (partial or full), then continue with "Week 1", "Week 2", etc., ending with a "Closing Week".

## Current vs. New Behavior

### Current (Continuous Days)
```
Join Thursday, 15-day program (weekends off):
Day:     1    2    —    —    3    4    5    6    7    —    —    8    9   10   11   12   —    —   13   14   15
Date:   Thu  Fri  Sat  Sun  Mon  Tue  Wed  Thu  Fri  Sat  Sun  Mon  Tue  Wed  Thu  Fri  Sat  Sun  Mon  Tue  Wed
Week:   ←────── "Week 1" (D1-5) ───────→←───── "Week 2" (D6-10) ──────→←───── "Week 3" (D11-15) ─────→
```
- "Week 1" spans two calendar weeks
- Confusing labeling

### New (Calendar-Aligned)
```
Join Thursday, 15-day program (weekends off):
Day:     1    2    —    —    3    4    5    6    7    —    —    8    9   10   11   12   —    —   13   14   15
Date:   Thu  Fri  Sat  Sun  Mon  Tue  Wed  Thu  Fri  Sat  Sun  Mon  Tue  Wed  Thu  Fri  Sat  Sun  Mon  Tue  Wed
Week:   ←─ Onboarding ─→    ←────── Week 1 (Mon-Fri) ─────→    ←────── Week 2 (Mon-Fri) ─────→    ←─ Closing ─→
        (2 days)                    (5 days)                            (5 days)                     (3 days)
```
- Weeks align to Mon-Fri calendar weeks
- Clear, intuitive labeling

## Week Labeling Rules

| User Joins | First Week Label | Middle Weeks | Last Week Label |
|------------|------------------|--------------|-----------------|
| Monday     | Onboarding (5d)  | Week 2, 3... | Closing         |
| Thursday   | Onboarding (2d)  | Week 1, 2... | Closing         |
| Sat/Sun    | Onboarding (5d, starts Mon) | Week 2, 3... | Closing |

**Rules:**
1. First week is ALWAYS "Onboarding Week" (even if full 5 days)
2. Last week is ALWAYS "Closing Week" (even if full 5 days)
3. Middle weeks are "Week 1", "Week 2", etc.
4. Sat/Sun enrollment → Onboarding starts Monday
5. Weeks cannot be dragged/reordered (calendar-determined)

## Data Model Changes

### ProgramEnrollment (add fields)
```typescript
interface ProgramEnrollment {
  // ... existing fields ...

  // New: Calendar week tracking
  enrollmentDayOfWeek: number;     // 0-6, day of week when enrolled
  firstMondayDate: string;         // ISO date of first Monday after enrollment
  totalCalendarWeeks: number;      // Calculated total weeks for this user
}
```

### New Type: CalendarWeek
```typescript
interface CalendarWeek {
  type: 'onboarding' | 'regular' | 'closing';
  label: string;                   // "Onboarding Week", "Week 1", "Closing Week"
  weekNumber: number;              // 0 for onboarding, 1+ for regular, -1 for closing
  startDate: string;               // ISO date (Monday or enrollment date)
  endDate: string;                 // ISO date (Friday or program end)
  startDayIndex: number;           // First program day in this week
  endDayIndex: number;             // Last program day in this week
  dayCount: number;                // Number of active days (1-5)
}
```

## New Utility Functions

### `src/lib/calendar-weeks.ts`

```typescript
/**
 * Calculate calendar weeks for an enrollment
 */
export function calculateCalendarWeeks(
  enrollmentStartDate: string,
  programLengthDays: number,
  includeWeekends: boolean
): CalendarWeek[]

/**
 * Get the calendar week for a specific program day
 */
export function getCalendarWeekForDay(
  enrollmentStartDate: string,
  dayIndex: number,
  programLengthDays: number,
  includeWeekends: boolean
): CalendarWeek

/**
 * Get current calendar week for an enrollment
 */
export function getCurrentCalendarWeek(
  enrollment: ProgramEnrollment,
  program: Program
): CalendarWeek

/**
 * Map program day index to calendar date
 */
export function dayIndexToDate(
  enrollmentStartDate: string,
  dayIndex: number,
  includeWeekends: boolean
): Date

/**
 * Get week label for display
 */
export function getWeekLabel(week: CalendarWeek): string
```

## Files to Modify

### Core Logic
| File | Changes |
|------|---------|
| `src/lib/calendar-weeks.ts` | **NEW** - Calendar week calculation utilities |
| `src/lib/program-engine.ts` | Update `calculateCycleAwareDayIndex` to be calendar-aware |
| `src/lib/program-utils.ts` | Update `syncProgramWeeks` - weeks now calendar-based |
| `src/types/index.ts` | Add `CalendarWeek` type, update `ProgramEnrollment` |

### API Routes
| File | Changes |
|------|---------|
| `src/app/api/programs/[programId]/content/route.ts` | Use calendar weeks for day selection |
| `src/app/api/programs/[programId]/structure/route.ts` | Return calendar week structure |
| `src/app/api/coach/org-programs/[programId]/weeks/route.ts` | Remove reorder capability |
| `src/app/api/coach/org-programs/[programId]/weeks/reorder/route.ts` | **DELETE** or disable |

### UI Components
| File | Changes |
|------|---------|
| `src/components/program/ProgramDetailView.tsx` | Show calendar weeks in 3-day focus |
| `src/components/program/ModulePreviewSection.tsx` | Display calendar week labels |
| `src/components/program/WeeklyOverviewCard.tsx` | Use calendar week labels |
| `src/components/coach/programs/ModuleWeeksSidebar.tsx` | Remove drag-to-reorder for weeks |
| `src/components/coach/programs/ProgramSidebarNav.tsx` | Show calendar week structure |
| `src/components/coach/programs/CoachProgramsTab.tsx` | Update week display logic |
| `src/components/coach/programs/ProgramScheduleEditor.tsx` | Calendar-based week view |

### Hooks
| File | Changes |
|------|---------|
| `src/hooks/useProgramStructure.ts` | Return calendar weeks |

## Implementation Phases

### Phase 1: Core Utilities (No UI changes)
1. Create `src/lib/calendar-weeks.ts` with calculation functions
2. Add unit tests for edge cases:
   - Join Monday → Onboarding (5d)
   - Join Thursday → Onboarding (2d)
   - Join Saturday → Onboarding starts Monday
   - Various program lengths
3. Add `CalendarWeek` type to `src/types/index.ts`

### Phase 2: Backend Integration
1. Update `program-engine.ts` to use calendar weeks
2. Modify content API to select days based on calendar week
3. Update structure API to return calendar week data
4. Test with existing programs (backward compatible)

### Phase 3: Client UI Updates
1. Update `ProgramDetailView` 3-day focus
2. Update sidebar week display
3. Update week labels throughout UI
4. Add "Onboarding Week" / "Closing Week" labels

### Phase 4: Coach UI Updates
1. Disable week drag-to-reorder in sidebar
2. Update week editor to show calendar context
3. Show how content maps to calendar weeks

### Phase 5: Migration & Cleanup
1. Verify existing enrollments work correctly
2. Remove deprecated reorder functionality
3. Update documentation

## Edge Cases to Handle

1. **User joins on Saturday/Sunday**
   - Onboarding Week starts the following Monday
   - They effectively wait until Monday to start

2. **Program shorter than 5 days**
   - Onboarding Week = Closing Week (same week)
   - Label: "Program Week" or just show day range

3. **Evergreen programs**
   - Each cycle restarts with new Onboarding Week
   - Calendar alignment resets on cycle rollover

4. **Custom start date in future**
   - Calculate calendar weeks from that start date
   - Same logic applies

5. **Program with weekends included**
   - Weeks are still Mon-Sun (7 days)
   - Onboarding/Closing still apply

## Algorithm: Calculate Calendar Weeks

```typescript
function calculateCalendarWeeks(
  enrollmentStartDate: string,
  programLengthDays: number,
  includeWeekends: boolean
): CalendarWeek[] {
  const weeks: CalendarWeek[] = [];
  const startDate = new Date(enrollmentStartDate);
  const startDayOfWeek = startDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Handle weekend enrollment - push to Monday
  let effectiveStartDate = startDate;
  if (startDayOfWeek === 0 || startDayOfWeek === 6) {
    const daysUntilMonday = startDayOfWeek === 0 ? 1 : 2;
    effectiveStartDate = addDays(startDate, daysUntilMonday);
  }

  const effectiveDayOfWeek = effectiveStartDate.getDay();
  const daysUntilFriday = 5 - effectiveDayOfWeek; // Days remaining in first week
  const onboardingDays = Math.min(daysUntilFriday + 1, programLengthDays);

  // Onboarding Week
  weeks.push({
    type: 'onboarding',
    label: 'Onboarding Week',
    weekNumber: 0,
    startDate: formatDate(effectiveStartDate),
    endDate: formatDate(addDays(effectiveStartDate, onboardingDays - 1)),
    startDayIndex: 1,
    endDayIndex: onboardingDays,
    dayCount: onboardingDays,
  });

  // Middle weeks (full Mon-Fri)
  let currentDayIndex = onboardingDays + 1;
  let weekNumber = 1;
  let currentMonday = getNextMonday(effectiveStartDate);

  while (currentDayIndex <= programLengthDays) {
    const daysRemaining = programLengthDays - currentDayIndex + 1;
    const daysInThisWeek = Math.min(5, daysRemaining);
    const isLastWeek = currentDayIndex + daysInThisWeek > programLengthDays;

    weeks.push({
      type: isLastWeek ? 'closing' : 'regular',
      label: isLastWeek ? 'Closing Week' : `Week ${weekNumber}`,
      weekNumber: isLastWeek ? -1 : weekNumber,
      startDate: formatDate(currentMonday),
      endDate: formatDate(addDays(currentMonday, daysInThisWeek - 1)),
      startDayIndex: currentDayIndex,
      endDayIndex: currentDayIndex + daysInThisWeek - 1,
      dayCount: daysInThisWeek,
    });

    currentDayIndex += daysInThisWeek;
    weekNumber++;
    currentMonday = addDays(currentMonday, 7);
  }

  return weeks;
}
```

## Testing Scenarios

| Scenario | Days | Join Day | Expected Weeks |
|----------|------|----------|----------------|
| Short program | 5 | Monday | Onboarding(5d) + Closing (same week) |
| Short program | 5 | Thursday | Onboarding(2d) + Closing(3d) |
| Medium program | 15 | Monday | Onboarding(5d) + Week 2(5d) + Closing(5d) |
| Medium program | 15 | Thursday | Onboarding(2d) + Week 1(5d) + Week 2(5d) + Closing(3d) |
| Weekend join | 15 | Saturday | Onboarding(5d) + Week 2(5d) + Closing(5d) |
| With weekends | 21 | Monday | Onboarding(7d) + Week 2(7d) + Closing(7d) |

## Rollback Plan

If issues arise:
1. Feature flag: `program.useCalendarAlignedWeeks`
2. Default to `false` for existing programs
3. New programs default to `true`
4. Coach can toggle in program settings (migration period)

## Questions to Resolve

1. **Existing enrollments**: Apply new logic or grandfather?
   - Recommendation: Apply new logic - just changes display, not content

2. **Coach week editor**: How should coach see the calendar mapping?
   - Show: "Week 1 content (Days 1-5) will appear in:"
   - "Onboarding Week for Thu-Fri joiners"
   - "Week 1 for Mon-Wed joiners"

3. **Program length input**: Keep as days or add week helper?
   - Keep days as source of truth
   - Show "≈ X weeks" helper text
