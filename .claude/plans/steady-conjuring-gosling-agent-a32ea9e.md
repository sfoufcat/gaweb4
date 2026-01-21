# Plan: Fix Module Auto-Expansion in Template Mode

## Problem Summary

When returning to edit an existing program, modules are collapsed and the user sees collapsed module headers instead of the WeekEditor. The parent (CoachProgramsTab) correctly selects the first week, but the sidebar doesn't expand the containing module.

## Root Cause

1. `expandedModules` in ModuleWeeksSidebar starts as empty `Set<string>()`
2. Auto-expansion useEffect (lines 754-861) has early return for template mode - does nothing
3. No useEffect responds to `selection` prop changes to expand the containing module
4. Parent sets `sidebarSelection` with `moduleId`, but sidebar ignores this for module expansion

## Implementation Plan

### Option Chosen: Option C (Both fixes) - Belt and Suspenders

This ensures robust behavior across all entry points.

### Change 1: Auto-expand first module in template mode

**File:** `src/components/coach/programs/ModuleWeeksSidebar.tsx`  
**Location:** Lines 759-764 (inside the template mode early return block)

**Current Code:**
```typescript
if (viewStatus === 'template') {
  hasInitializedExpansion.current = true;
  // Don't auto-expand anything in template mode
  return;
}
```

**New Code:**
```typescript
if (viewStatus === 'template') {
  hasInitializedExpansion.current = true;
  // Auto-expand the first module's worth of weeks for template mode
  // This ensures coach sees weeks on initial load
  if (sortedModules.length > 0) {
    const firstModule = sortedModules[0];
    setExpandedModules(new Set([firstModule.id]));
  }
  return;
}
```

**Rationale:** When in template mode with no external selection context, expand the first module so weeks are immediately visible.

### Change 2: Expand module when selection changes from parent

**File:** `src/components/coach/programs/ModuleWeeksSidebar.tsx`  
**Location:** After line 730 (after the existing selection-related useEffects)

**Add new useEffect:**
```typescript
// Auto-expand the module containing the selected week when selection comes from parent
React.useEffect(() => {
  if (selection?.type === 'week' && selection.moduleId) {
    setExpandedModules(prev => {
      if (prev.has(selection.moduleId!)) return prev;
      return new Set([...prev, selection.moduleId!]);
    });
  }
}, [selection]);
```

**Rationale:** When parent sets a week selection (e.g., on initial load or navigation), the containing module should expand automatically. This handles cases where:
- User returns to a program (parent auto-selects first week)
- User clicks a week from search results or external link
- Any future feature that sets selection programmatically

### Dependency Consideration

`sortedModules` is defined at line 864, AFTER the useEffect at line 754. The useEffect references `displayWeeks` but not `sortedModules` directly. 

For Change 1, we need `sortedModules` available. Options:
- **A.** Move the useEffect after `sortedModules` definition (could break other logic)
- **B.** Compute first module inline using same logic as `sortedModules`
- **C.** Use `modules` prop directly with sorting

**Recommended: Option C** - use `modules` prop directly:
```typescript
if (viewStatus === 'template') {
  hasInitializedExpansion.current = true;
  const firstModule = [...modules].sort((a, b) => a.order - b.order)[0];
  if (firstModule) {
    setExpandedModules(new Set([firstModule.id]));
  }
  return;
}
```

This avoids dependency ordering issues and uses the same sorting logic.

## Questions Resolved

1. **Should ALL modules be expanded in template mode, or just the first one?**
   - Answer: Just the first one - maintains cleaner UI and avoids performance concerns

2. **Should we preserve previously expanded modules, or reset to just the selected module's parent?**
   - Answer: Preserve + add. The new useEffect uses `prev => new Set([...prev, moduleId])` pattern

3. **Performance concern with all weeks rendered?**
   - Answer: Not applicable since we only expand first module by default

## Testing Strategy

1. **Test returning to existing program:**
   - Clear browser storage, load app, create program, navigate away, return
   - Expected: First module expanded, first week selected, WeekEditor visible

2. **Test new program creation:**
   - Create new program
   - Expected: Same as above

3. **Test cohort/client modes (no regression):**
   - Switch to cohort view, verify current-week auto-expansion still works
   - Switch to client view, verify same

4. **Test manual module collapse:**
   - Collapse module manually, verify it stays collapsed
   - Refresh page, verify first module re-expands (fresh load)

## Files to Modify

1. `src/components/coach/programs/ModuleWeeksSidebar.tsx` - Two changes as detailed above

## Unresolved Questions

None - all questions from the original analysis have been resolved through the implementation approach.
