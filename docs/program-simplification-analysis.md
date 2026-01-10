# Program Task System - Simplification Analysis

## Your Mental Model (Correct & Simple)

```
Template ──(copy on sync)──> Client/Cohort Editor ──(filters)──> Daily Focus
                                     │
                                     ├── Correct day?
                                     ├── Correct enrollment?
                                     └── Correct client/cohort?
```

### How Tasks Sync to Daily Focus
1. **Manual trigger** - Coach adds task to today → appears immediately
2. **Cron job** - Runs hourly, adds scheduled tasks for upcoming days

### How Template Syncs to Editor
1. **On "Save & Sync" button** - Coach explicitly pushes template changes
2. **On client/cohort creation** - Initial copy from template
3. **Weekly distribution** - Spread or repeat-daily applied during sync

### Task Display
- **1:1 (Client)**: Direct 1-1 mapping, client sees exactly what's in their editor
- **Cohort**: Aggregated view, dropdown shows members, % completion rule

---

## Where Current Code Over-Engineers

### 1. Runtime Template Fallback (BAD)
**Current**: If `client_program_days` doesn't exist, falls back to `client_program_weeks`, then `program_weeks`, then `program_days`

**Problem**: Template shouldn't be read at runtime. Client/cohort editor IS the source of truth.

**Simple**: Only read from `client_program_days` or `cohort_program_days`. If empty, show nothing.

**Files involved**:
- `syncProgramV2TasksForToday()` - has 5-level priority chain
- `syncProgramTasksToClientDay()` - also has fallback logic

---

### 2. Multiple Sync Entry Points (BAD)
**Current**: 4+ different sync functions that can create tasks:
- `syncProgramV2TasksForToday()` - lazy sync on app open
- `syncWeeklyTasks()` - week-level sync
- `syncProgramTasksToClientDay()` - day-level sync from coach
- `syncProgramTasksAuto()` - auto-detect which to call
- Cron job also calls sync

**Problem**: Hard to reason about when/why tasks appear

**Simple**:
- ONE sync function that reads from client/cohort editor
- Called by: (1) cron for scheduled tasks, (2) coach manual trigger

---

### 3. Tasks Created for Future Days (BAD)
**Current**: When coach saves week, creates actual `tasks` documents for ALL days in the week (including future)

**Problem**: Future tasks exist in DB, then migration moves them around, causing duplicates

**Simple**:
- Client/cohort editor stores the PLAN (what tasks go on which days)
- Cron creates actual `tasks` documents only when that day arrives (or within 24h window)

---

### 4. Migration Logic (BAD)
**Current**: Every time client opens app, migration query runs to move old pending tasks to today

**Problem**: We just had to add exceptions for program tasks. Complex edge cases.

**Simple**:
- Program tasks: NEVER migrate (stay on their day)
- Manual tasks: User explicitly moves them if needed (or auto-archive after X days)

---

### 5. Lazy Sync on App Open (UNNECESSARY)
**Current**: When client opens app, if no program tasks exist, triggers sync

**Problem**: Adds latency, complex logic, race conditions

**Simple**: Cron ensures tasks exist before client needs them. No lazy sync needed.

---

### 6. Two Layers of "Days" (CONFUSING)
**Current**:
- `client_program_weeks.weeklyTasks[]` - tasks at week level
- `client_program_days.tasks[]` - tasks at day level
- `distributeClientWeeklyTasksToDays()` copies week→days

**Problem**: Two places to look, sync between them

**Simple**:
- Only `client_program_days` exists
- When coach edits week view, it directly updates the day documents
- "Spread" is just a UI helper that auto-fills days

---

## Cases You Might Be Missing

### 1. Mid-Enrollment Template Changes
**Scenario**: Coach updates template after clients are enrolled
**Current**: Template changes don't affect existing enrollments (correct)
**Question**: Should there be a "re-sync from template" option?

Answer: Yes, we already have that I believe. Any time a coach saveds a template, they get a sync button that on press tells them what changes to sync and they select. we want to keep this functionality, without it affecting manually added tasks to days.

### 2. Evergreen/Cycling Programs
**Scenario**: Program repeats (cycle 1, cycle 2, etc.)
**Current**: `cycleNumber` tracked, tasks tagged with cycle
**Question**: Does this add complexity? Is it needed?

Answer: yes

### 3. Weekend Exclusion
**Scenario**: Program skips weekends
**Current**: `calculateCurrentDayIndexV2()` handles this
**Question**: Is this per-program or global?

Answer: include or skip weekend is per program. week distribution must account for this.

### 4. Coach Edits Task Client Already Has
**Scenario**: Task "Do X" exists in client's focus, coach renames to "Do Y"
**Current**: `clientLocked` flag prevents overwrite, `programTaskId` for matching
**Question**: Should edits propagate or not?

Answer: Yes, only if the task is added by the coach in the program. If the client added that task themselves, coach cannot edit.

### 5. Task Deletion Lifecycle
**Scenario**: Coach removes task from editor, client still has it
**Current**: Tasks have `status: deleted/archived`, archival cron
**Question**: Immediate delete vs soft delete?

Answer: soft delete

### 6. Cohort Members with Different Progress
**Scenario**: Member A is on day 5, Member B joined late and is on day 2
**Current**: Each has own enrollment with own `startedAt`
**Question**: Is this supported in cohort view?

Answer: Cohort members cannot have different progress. if a member joins late, they should be on day 5 regardless. In group programs, cohorts take the source of truth of what day we're on, not clients. this must be addressed, this is extremely important.

### 7. Client Creates Their Own Task
**Scenario**: Client adds manual task, coach shouldn't override it
**Current**: `sourceType: 'user'` marks client-created tasks
**Works correctly**

Answer: correct. coach cannot override client-created tasks, and they don't even see them in program editor.
Coach can see if a client edits or deletes a coach-created task in the program editor with the badges.

### 8. Retroactive Day Edits
**Scenario**: Coach edits content for day 3, but client is already on day 7
**Current**: Unclear behavior
**Question**: Should past days be editable? What happens to completed tasks?

coach can edit it, but nothing happens to the task, it's never shown to the client or cohort, since it's in the past and the day filter must prevent that.

---

## Proposed Simplified Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TEMPLATE                                 │
│  programs + program_weeks + program_days                        │
│  (Reference only - never read at runtime for task creation)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ "Sync from Template" button
                           │ (or on enrollment creation)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT/COHORT EDITOR                          │
│                                                                  │
│  1:1 Programs:    client_program_days (one per day)             │
│  Group Programs:  cohort_program_days (one per day)             │
│                                                                  │
│  Each day document has:                                          │
│  - dayIndex                                                      │
│  - tasks[] (the planned tasks for that day)                     │
│  - habits[], prompt, etc.                                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Cron (hourly) OR Coach manual trigger (on save)
                           │ Creates tasks for: today + tomorrow
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TASKS COLLECTION                            │
│                                                                  │
│  Actual task documents that client sees in Daily Focus          │
│  - Only created when day arrives (not for future)               │
│  - Never migrated (program tasks stay on their day)             │
│  - sourceType identifies origin                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Rules (Simple)
1. **Template → Editor**: Only on explicit sync or enrollment creation
2. **Editor → Tasks**: Cron creates tasks for today/tomorrow, or coach triggers manually
3. **No fallback**: If editor has no tasks for a day, client sees no program tasks
4. **No migration**: Program tasks don't move between days
5. **No lazy sync**: Cron handles everything proactively

### What to Remove/Simplify
1. Remove `client_program_weeks` (or make it UI-only, not a source of truth)
2. Remove runtime template fallback in sync functions
3. Remove lazy sync on app open
4. Remove migration for program tasks (already done!)
5. Consolidate to ONE sync function

---

## Summary: Current vs Simple

| Aspect | Current (Complex) | Proposed (Simple) |
|--------|-------------------|-------------------|
| Task source | 5-level fallback chain | Editor only |
| When tasks created | On app open (lazy) + coach save | Cron + coach trigger |
| Future tasks | Created immediately | Created when day arrives |
| Migration | Complex with exceptions | None for program tasks |
| Sync functions | 4+ different ones | 1 unified function |
| Week vs Day storage | Both exist, sync between | Day only |
