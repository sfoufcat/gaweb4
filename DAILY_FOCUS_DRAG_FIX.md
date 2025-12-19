# Daily Focus - Drag & Drop Fix

**Date:** November 24, 2025  
**Issue:** Reordering tasks caused a "snap back" effect before moving to final position

---

## 🐛 Problem

When dragging and dropping tasks to reorder them:
1. Task would move to new position
2. Then snap back to original position
3. Then jump to new position after ~1 second

This happened because the UI was waiting for the server response before updating.

---

## ✅ Solution

### 1. Optimistic Updates in `useTasks` Hook

Changed the `reorderTasks` function to:
- **Update UI immediately** with the new order
- **Then sync with server** in the background
- No longer blocks UI on server response

```typescript
// FIRST: Update UI immediately
setTasks((prevTasks) => {
  // Merge reordered tasks with existing tasks
  const updatedTasks = prevTasks.map(task => {
    const reordered = reorderedTasks.find(rt => rt.id === task.id);
    return reordered || task;
  });
  
  // Sort properly
  updatedTasks.sort((a, b) => {
    if (a.listType === b.listType) {
      return a.order - b.order;
    }
    return a.listType === 'focus' ? -1 : 1;
  });
  
  return updatedTasks;
});

// THEN: Sync with server in background
```

### 2. Improved Drag Activation

Added activation constraint to prevent accidental drags:
```typescript
useSensor(PointerSensor, {
  activationConstraint: {
    distance: 8, // Must move 8px before drag starts
  },
})
```

This helps distinguish between clicks and drags.

### 3. Added Drag Overlay

Shows a semi-transparent preview of the task being dragged:
- Better visual feedback
- Clearer indication of what's moving
- Smoother drag experience

### 4. Non-blocking Reorder

Removed `await` in DailyFocusSection:
```typescript
// No longer awaits - fires and forgets
reorderTasks(reordered);
```

---

## 🎯 Result

✅ Instant visual feedback when dragging  
✅ No snap-back effect  
✅ Smooth, native-feeling drag and drop  
✅ Server syncs in background without blocking UI  

---

## 🧪 How to Test

1. Create 3 tasks in Daily Focus
2. Grab the drag handle (⋮⋮) on the left
3. Drag a task up or down
4. Release

Expected: Task stays in new position immediately, no jumping or snapping back.

---

## 💡 Additional Improvements Made

1. **Backlog now shows by default** - When you have backlog tasks, they're visible immediately
2. **Can uncheck completed tasks** - Click a completed task → "Mark incomplete" button
3. **Separate drag handle** - Click task to open, drag handle to reorder
4. **Better error handling** - If server sync fails, errors are logged but UI isn't reverted

