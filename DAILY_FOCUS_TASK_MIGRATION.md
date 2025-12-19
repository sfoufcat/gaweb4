# Daily Focus - Task Migration Between Days

**Date:** November 25, 2025  
**Feature:** Automatic task migration from previous days

---

## 🔄 How It Works

When you load the Daily Focus section for a new day, the system automatically:

1. **Carries over unfinished tasks** from previous days → moved to today's **Backlog**
2. **Completed tasks stay on their original day** → don't carry over

---

## ✨ User Experience

### Morning of Day 2

**Yesterday (Day 1):**
- Daily Focus: Task A ✅ (completed), Task B (pending), Task C (pending)
- Backlog: Task D (pending)

**Today (Day 2) - What you see:**
- Daily Focus: (empty, ready for new tasks)
- Backlog: Task B, Task C, Task D (all carried over from yesterday)

**What happened:**
- ✅ Task A (completed) → stayed on Day 1, doesn't show today
- ⏳ Task B, C, D (pending) → automatically moved to Day 2's backlog

---

## 🎯 Benefits

1. **No lost tasks** - Unfinished work automatically carries forward
2. **Clean slate** - Daily Focus starts empty, ready for new priorities
3. **Historical record** - Completed tasks stay on the day they were completed
4. **Automatic** - No manual action needed from users

---

## 🔧 Technical Implementation

### Migration Logic (GET /api/tasks)

When fetching tasks for a specific date:

```typescript
// 1. Query all PENDING tasks from BEFORE today
const previousTasksSnapshot = await adminDb
  .collection('tasks')
  .where('userId', '==', userId)
  .where('status', '==', 'pending')
  .where('date', '<', date)  // All previous dates
  .get();

// 2. Query tasks FOR today
const tasksRef = adminDb
  .collection('tasks')
  .where('userId', '==', userId)
  .where('date', '==', date);

// 3. Migrate previous pending tasks
if (tasksToMigrate.length > 0) {
  // Update each task:
  batch.update(taskRef, {
    date,                    // Change to today
    listType: 'backlog',    // Move to backlog
    order: maxBacklogOrder++, // Append to end
    updatedAt: now,
  });
}

// 4. Return combined list
return { tasks: [...todaysTasks, ...migratedTasks] };
```

---

## 📋 Migration Rules

| Original State | New Day Behavior | New Location |
|---------------|------------------|--------------|
| Focus + Pending | Carry over | Backlog |
| Focus + Completed | Stay on original day | N/A (hidden) |
| Backlog + Pending | Carry over | Backlog |
| Backlog + Completed | Stay on original day | N/A (hidden) |

---

## 🔍 Database Queries

### Tasks Migrated (Pending from Previous Days)
```sql
tasks
  WHERE userId = currentUser
  AND status = 'pending'
  AND date < today
```

### Tasks for Today
```sql
tasks
  WHERE userId = currentUser
  AND date = today
```

### Completed Tasks (Stay on Original Date)
```sql
-- These are NOT queried when loading a new day
-- They remain in the database with their original date
tasks
  WHERE userId = currentUser
  AND status = 'completed'
  AND date < today
```

---

## 🎨 Visual Flow

```
DAY 1 (Nov 24)
┌─────────────────────┐
│  Daily Focus        │
│  ✅ Task A          │
│  ⏳ Task B          │
│  ⏳ Task C          │
│                     │
│  Backlog            │
│  ⏳ Task D          │
└─────────────────────┘

        ⬇️ Overnight migration

DAY 2 (Nov 25)
┌─────────────────────┐
│  Daily Focus        │
│  (empty - ready!)   │
│                     │
│  Backlog            │
│  ⏳ Task B (from D1)│
│  ⏳ Task C (from D1)│
│  ⏳ Task D (from D1)│
└─────────────────────┘

Task A (✅) stayed on Nov 24
```

---

## ⚙️ Order Preservation

When migrating tasks to the backlog:

1. **Calculate max order** in today's existing backlog
2. **Append migrated tasks** in their original order
3. **Increment order** for each migrated task

```typescript
let maxBacklogOrder = backlogTasks.length > 0 
  ? Math.max(...backlogTasks.map(t => t.order)) 
  : -1;

for (const task of tasksToMigrate) {
  maxBacklogOrder++;  // Increment for each
  task.order = maxBacklogOrder;
}
```

---

## 🚀 Performance

- **Batch writes** - All migrations happen in a single Firestore batch
- **One-time migration** - Each task is migrated only once when loading that day
- **Efficient queries** - Uses indexed fields (userId, status, date)

---

## 🧪 Test Scenarios

### Scenario 1: Simple Carry-Over
**Day 1:**
- Create 3 tasks in Daily Focus
- Complete 1, leave 2 pending

**Day 2 (Expected):**
- Daily Focus: empty
- Backlog: 2 pending tasks from Day 1

---

### Scenario 2: Multiple Days
**Day 1:**
- Task A (pending)

**Day 2:**
- Task A → backlog (from Day 1)
- Task B (pending, created today)

**Day 3 (Expected):**
- Backlog: Task A (from Day 1), Task B (from Day 2)

---

### Scenario 3: All Completed
**Day 1:**
- Task A ✅
- Task B ✅
- Task C ✅

**Day 2 (Expected):**
- Daily Focus: empty
- Backlog: empty
- (All tasks stayed on Day 1)

---

## 🔐 Security

- Migration respects `userId` - users only see their own tasks
- Original task ownership is preserved
- Firestore security rules still apply

---

## 📊 Analytics Potential

This migration creates useful data:
- **Completion rate** = Tasks completed on original day / Total tasks
- **Carry-over rate** = Tasks migrated / Total tasks created
- **Task age** = Days between creation and completion
- **Backlog growth** = Rate of task accumulation

---

## 🎯 Future Enhancements

Possible improvements:
1. **Notification** - "You have 3 unfinished tasks from yesterday"
2. **Limit** - Auto-archive tasks older than 7 days
3. **Priority boost** - Older tasks appear first in backlog
4. **Visual indicator** - Show which tasks are carried over
5. **Stats** - "You've been working on this for 3 days"

---

## ⚠️ Edge Cases Handled

1. **No tasks to migrate** - Works fine, returns only today's tasks
2. **Empty today** - Works fine, returns only migrated tasks
3. **Duplicate dates** - Impossible, each task has one date
4. **Time zones** - Uses ISO dates (YYYY-MM-DD) consistently
5. **Batch failure** - Transaction ensures all-or-nothing migration

