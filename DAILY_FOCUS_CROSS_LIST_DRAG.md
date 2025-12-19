# Daily Focus - Cross-List Drag & Drop

**Date:** November 24, 2025  
**Feature:** Drag tasks between Daily Focus and Backlog

---

## ✨ What's New

You can now **drag tasks between Daily Focus and Backlog**!

- Drag a task from Daily Focus → Backlog
- Drag a task from Backlog → Daily Focus (if Focus has < 3 tasks)
- Reorder within each list
- Automatic enforcement of 3-task limit on Focus

---

## 🎯 How It Works

### Unified DndContext

Both Focus and Backlog are now under a single DndContext with two separate SortableContext areas:

```typescript
<DndContext>
  {/* Focus Tasks */}
  <SortableContext items={focusTasks}>
    {focusTasks.map(task => <TaskItem />)}
  </SortableContext>
  
  {/* Backlog Tasks */}
  <SortableContext items={backlogTasks}>
    {backlogTasks.map(task => <TaskItem />)}
  </SortableContext>
</DndContext>
```

### Smart Drag Logic

#### Moving Between Lists
When you drag a task from one list to another:

1. **Check if move is allowed**
   - If moving TO Focus and Focus already has 3 tasks → block the move
   - Otherwise, allow the move

2. **Update both lists**
   - Remove task from source list
   - Insert task at drop position in target list
   - Recalculate order for both lists
   - Update all affected tasks on server

3. **Optimistic UI**
   - UI updates immediately
   - Server sync happens in background

#### Reordering Within a List
When you drag within the same list:
- Use `arrayMove` to reorder
- Update order numbers
- Sync with server

---

## 🚫 3-Task Limit Enforcement

The system prevents adding a 4th task to Daily Focus:

```typescript
const currentFocusCount = focusTasks.filter(t => t.id !== active.id).length;
if (overListType === 'focus' && currentFocusCount >= 3) {
  console.log('Cannot move to focus: limit of 3 tasks reached');
  return; // Block the drag
}
```

**Note:** The count excludes the active task if it's already in Focus (so you can reorder within Focus even when at the limit).

---

## 🎨 Visual Feedback

### Drag Overlay
When dragging, you see a preview of the task:
- Semi-transparent card
- Slight rotation (2°)
- Drag handle icon visible
- Follows your cursor

### List States
- **Focus List:** Always visible, shows current tasks
- **Backlog List:** Expandable, shows when there are backlog tasks
- Both lists highlight drop zones during drag

---

## 🧪 How to Test

### Test 1: Move from Focus to Backlog
1. Create 3 tasks in Daily Focus
2. Drag any task down to the Backlog section
3. ✅ Task moves to Backlog
4. ✅ Focus now has 2 tasks

### Test 2: Move from Backlog to Focus
1. Have a task in Backlog
2. Have < 3 tasks in Focus
3. Drag backlog task up to Focus
4. ✅ Task moves to Focus

### Test 3: 3-Task Limit
1. Have 3 tasks in Daily Focus
2. Try to drag a backlog task into Focus
3. ✅ Drag is blocked (task snaps back)
4. ✅ Console shows: "Cannot move to focus: limit of 3 tasks reached"

### Test 4: Reorder Within Lists
1. Drag tasks up/down within Focus
2. ✅ Smooth reordering
3. Drag tasks up/down within Backlog
4. ✅ Smooth reordering

---

## 💡 UX Notes

- **Drag Handle Required:** Must grab the grip icon (⋮⋮) to drag
- **Click to Manage:** Click anywhere else on the task to open management sheet
- **8px Threshold:** Must move 8px before drag activates (prevents accidental drags)
- **Instant Feedback:** UI updates immediately, no waiting for server

---

## 🔧 Technical Details

### Files Modified
- `src/components/tasks/DailyFocusSection.tsx`
  - Unified DndContext spanning both lists
  - Enhanced `handleDragEnd` with cross-list logic
  - Both Focus and Backlog use `TaskItem` (draggable)

### Key Functions

#### `handleDragEnd`
```typescript
// Detects source and target lists
// Enforces 3-task limit
// Updates both lists atomically
// Optimistically updates UI
```

#### `reorderTasks` (in useTasks hook)
```typescript
// Updates UI immediately
// Syncs with server in background
// Handles failures gracefully
```

---

## ✅ Benefits

1. **Flexible Task Management** - Easily promote/demote tasks
2. **Enforced Limits** - Can't accidentally overload Daily Focus
3. **Smooth UX** - Instant visual feedback
4. **Reliable** - Server sync ensures data consistency
5. **Intuitive** - Natural drag-and-drop behavior

---

## 🚀 Future Enhancements

Possible improvements:
- Visual indicator when dragging over a "full" Focus list
- Animation when task is blocked
- Undo action for moves
- Keyboard shortcuts for moving tasks

