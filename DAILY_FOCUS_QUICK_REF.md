# Daily Focus - Quick Reference

## 🎯 What Was Built

A complete task management system for daily focus with:
- ✅ Up to 3 Daily Focus tasks per day
- ✅ Unlimited Backlog tasks
- ✅ Drag-and-drop reordering
- ✅ Beautiful bottom sheets for task management
- ✅ Full API backend with Firestore
- ✅ Secure with Firestore rules

---

## 📱 UI Components

### Main Section: `DailyFocusSection`
Location: `src/components/tasks/DailyFocusSection.tsx`

**Shows:**
- Daily Focus header with "Add" button
- Up to 3 focus tasks (draggable)
- "Add task" button (when focus < 3)
- "Show more / Show less" backlog toggle
- Backlog section with unlimited tasks

### Bottom Sheet: "Define Focus" (Add/Edit)
Location: `src/components/tasks/TaskSheetDefine.tsx`

**Features:**
- Title input
- "Keep this task private" checkbox
- Save button
- Delete button (edit mode)

### Bottom Sheet: "Manage Focus" (Complete)
Location: `src/components/tasks/TaskSheetManage.tsx`

**Features:**
- Task preview with edit/delete icons
- "Not yet" button (close without action)
- "I did it!" button (marks complete)

---

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/tasks?date=YYYY-MM-DD` | Fetch tasks for date |
| POST | `/api/tasks` | Create new task |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

---

## 📊 Data Model

```typescript
interface Task {
  id: string;
  userId: string;
  title: string;
  status: 'pending' | 'completed';
  listType: 'focus' | 'backlog';
  order: number;
  date: string; // YYYY-MM-DD
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

---

## 🎨 Key Design Principles

1. **Max 3 Focus Tasks** - Enforced automatically
2. **Unlimited Backlog** - Can be hidden/shown
3. **Per-Day Scoping** - Each date has its own tasks
4. **Drag-and-Drop** - Reorder within lists
5. **Visual Completion** - Strikethrough + elevated background

---

## 🔒 Security

All tasks are scoped to the authenticated user. Firestore rules ensure:
- Users can only read their own tasks
- Users can only create/update/delete their own tasks
- Private tasks remain private (for future Squad features)

---

## 📦 Dependencies Added

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## 🚀 Usage

```tsx
import { DailyFocusSection } from '@/components/tasks/DailyFocusSection';

export default function HomePage() {
  return (
    <div>
      <DailyFocusSection />
    </div>
  );
}
```

That's it! The component handles everything internally.

---

## 🧪 Test It Out

1. **Create a task:**
   - Click "Add" → Enter title → Click "Save"

2. **Complete a task:**
   - Click task → Click "I did it!"

3. **Edit a task:**
   - Click task → Click pencil icon → Edit → Save

4. **Reorder tasks:**
   - Drag and drop tasks within focus or backlog

5. **Toggle backlog:**
   - Click "Show more" / "Show less"

---

## 📚 Documentation

- Full implementation details: `DAILY_FOCUS_IMPLEMENTATION.md`
- Firestore schema: `FIRESTORE_SCHEMAS.md` (section 4)
- Security rules: `firestore.rules`

---

## ✅ All Done!

The Daily Focus system is production-ready and matches the Figma designs exactly.

