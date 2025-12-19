# Firestore Database Schemas

Firebase Project: **gawebdev2-3191a**

## Collections Overview

1. **users** - User profiles and identity
2. **goals** - User goals with progress tracking
3. **habits** - Daily/weekly habits and routines
4. **tasks** - Daily Focus tasks and backlog
5. **squads** - User groups/communities
6. **squad_members** - Squad membership and member data
7. **chat_channels** - Stream chat metadata (future)

---

## 1. Users Collection

**Path:** `/users/{userId}`

```typescript
interface User {
  // Core Identity
  id: string;                    // Clerk user ID
  clerkId: string;               // Clerk user ID (duplicate for clarity)
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  
  // Mission & Identity
  identity: string | null;        // "I am..." mission statement
  identityValidatedAt: string | null;  // ISO timestamp
  
  // Profile
  bio: string | null;
  location: string | null;
  timezone: string;               // e.g., "America/New_York"
  
  // Role & Permissions
  role: 'user' | 'coach' | 'super_admin';  // User role for permissions
  
  // Squad Membership
  squadId: string | null;         // Squad ID if user is in a squad
  
  // Stats
  alignmentScore: number;         // Days streak (0-365+)
  totalGoalsCompleted: number;
  totalHabitsCompleted: number;
  
  // Metadata
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
  lastActiveAt: string;           // ISO timestamp
  onboardingCompletedAt: string | null;
  
  // Settings
  settings: {
    notifications: boolean;
    emailUpdates: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
}
```

### Example Document

```json
{
  "id": "user_2abc123",
  "clerkId": "user_2abc123",
  "email": "nour@example.com",
  "firstName": "Nour",
  "lastName": "Chaaban",
  "imageUrl": "https://...",
  "identity": "I am a disciplined creator who brings clarity to chaos",
  "identityValidatedAt": "2025-11-24T10:00:00.000Z",
  "bio": null,
  "location": null,
  "timezone": "America/New_York",
  "alignmentScore": 288,
  "totalGoalsCompleted": 5,
  "totalHabitsCompleted": 142,
  "createdAt": "2025-11-24T09:00:00.000Z",
  "updatedAt": "2025-11-24T15:00:00.000Z",
  "lastActiveAt": "2025-11-24T15:00:00.000Z",
  "onboardingCompletedAt": "2025-11-24T10:30:00.000Z",
  "settings": {
    "notifications": true,
    "emailUpdates": true,
    "theme": "auto"
  }
}
```

---

## 2. Goals Collection

**Path:** `/goals/{goalId}`

```typescript
interface Goal {
  // Core
  id: string;                     // Auto-generated doc ID
  userId: string;                 // Owner's Clerk ID
  
  // Goal Details
  goal: string;                   // "Reach €1M in total sales"
  targetDate: string;             // ISO date "2025-12-31"
  category: string | null;        // "business" | "health" | "personal" | "financial"
  
  // Progress
  status: 'active' | 'completed' | 'archived' | 'paused';
  progress: {
    current: number;              // Current value (e.g., 890000)
    target: number;               // Target value (e.g., 1000000)
    unit: string | null;          // "€" | "$" | "kg" | null
    percentage: number;           // 0-100
    lastUpdatedAt: string;        // ISO timestamp
  };
  
  // Milestones (optional)
  milestones: Array<{
    id: string;
    title: string;
    value: number;
    completed: boolean;
    completedAt: string | null;
  }>;
  
  // AI Validation
  aiValidated: boolean;
  aiReasoning: string | null;
  aiSuggestion: string | null;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  
  // Visibility
  isPublic: boolean;              // Share with squad
  squadId: string | null;         // If shared with squad
}
```

### Example Document

```json
{
  "id": "goal_xyz789",
  "userId": "user_2abc123",
  "goal": "Reach €1M in total sales",
  "targetDate": "2025-12-31",
  "category": "business",
  "status": "active",
  "progress": {
    "current": 890000,
    "target": 1000000,
    "unit": "€",
    "percentage": 89,
    "lastUpdatedAt": "2025-11-24T14:00:00.000Z"
  },
  "milestones": [
    {
      "id": "m1",
      "title": "First 250k",
      "value": 250000,
      "completed": true,
      "completedAt": "2025-08-15T10:00:00.000Z"
    },
    {
      "id": "m2",
      "title": "Halfway there (500k)",
      "value": 500000,
      "completed": true,
      "completedAt": "2025-10-10T10:00:00.000Z"
    },
    {
      "id": "m3",
      "title": "750k milestone",
      "value": 750000,
      "completed": true,
      "completedAt": "2025-11-01T10:00:00.000Z"
    }
  ],
  "aiValidated": true,
  "aiReasoning": "Great goal with specific metric and timeline",
  "aiSuggestion": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-11-24T14:00:00.000Z",
  "completedAt": null,
  "archivedAt": null,
  "isPublic": false,
  "squadId": null
}
```

---

## 3. Habits Collection

**Path:** `/habits/{habitId}`

```typescript
interface Habit {
  // Core
  id: string;                     // Auto-generated doc ID
  userId: string;                 // Owner's Clerk ID
  
  // Habit Details
  text: string;                   // "Read for 20 minutes"
  linkedRoutine: string | null;   // "after breakfast" | null
  
  // Frequency
  frequencyType: 'daily' | 'weekly' | 'custom';
  frequencyValue: number;         // 7 for daily, 3 for 3x/week, etc.
  daysOfWeek: number[];          // [0,1,2,3,4,5,6] for Mon-Sun, [] for daily
  
  // Time
  time: string;                   // "09:00" (24hr format)
  reminder: {
    enabled: boolean;
    time: string;                 // "09:00"
    sound: boolean;
    notification: boolean;
  } | null;
  
  // Progress
  status: 'active' | 'archived' | 'paused';
  progress: {
    completionCount: number;      // Total times completed
    completionDates: string[];    // Array of ISO dates ["2025-11-24", ...]
    currentStreak: number;        // Days in a row
    longestStreak: number;        // Best streak ever
    lastCompletedAt: string | null;  // ISO timestamp
  };
  
  // Target (optional)
  targetRepetitions: number | null;  // null = infinite
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  
  // Visibility
  isPublic: boolean;
  squadId: string | null;
}
```

### Example Document

```json
{
  "id": "habit_def456",
  "userId": "user_2abc123",
  "text": "Read for 20 minutes",
  "linkedRoutine": "after breakfast",
  "frequencyType": "daily",
  "frequencyValue": 7,
  "daysOfWeek": [],
  "time": "09:00",
  "reminder": {
    "enabled": true,
    "time": "08:45",
    "sound": true,
    "notification": true
  },
  "status": "active",
  "progress": {
    "completionCount": 142,
    "completionDates": [
      "2025-11-24",
      "2025-11-23",
      "2025-11-22"
    ],
    "currentStreak": 15,
    "longestStreak": 32,
    "lastCompletedAt": "2025-11-24T09:30:00.000Z"
  },
  "targetRepetitions": null,
  "createdAt": "2025-07-01T00:00:00.000Z",
  "updatedAt": "2025-11-24T09:30:00.000Z",
  "archivedAt": null,
  "isPublic": false,
  "squadId": null
}
```

---

## 4. Tasks Collection (Daily Focus)

**Path:** `/tasks/{taskId}`

```typescript
interface Task {
  // Core
  id: string;                     // Auto-generated doc ID
  userId: string;                 // Owner's Clerk ID
  
  // Task Details
  title: string;                  // Task description
  status: 'pending' | 'completed';
  listType: 'focus' | 'backlog';  // Focus (max 3) or Backlog
  order: number;                  // Order within the list
  date: string;                   // ISO date (YYYY-MM-DD) for which day
  isPrivate: boolean;             // Keep task private (for Squad feature)
  
  // Metadata
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
  completedAt?: string;           // ISO timestamp (when marked complete)
}
```

### Example Documents

#### Focus Task (Active)
```json
{
  "id": "task_abc123",
  "userId": "user_2abc123",
  "title": "Weekly planning session",
  "status": "pending",
  "listType": "focus",
  "order": 0,
  "date": "2025-11-24",
  "isPrivate": false,
  "createdAt": "2025-11-24T08:00:00.000Z",
  "updatedAt": "2025-11-24T08:00:00.000Z"
}
```

#### Focus Task (Completed)
```json
{
  "id": "task_def456",
  "userId": "user_2abc123",
  "title": "Prepare client proposal",
  "status": "completed",
  "listType": "focus",
  "order": 2,
  "date": "2025-11-24",
  "isPrivate": false,
  "createdAt": "2025-11-24T08:15:00.000Z",
  "updatedAt": "2025-11-24T14:30:00.000Z",
  "completedAt": "2025-11-24T14:30:00.000Z"
}
```

#### Backlog Task
```json
{
  "id": "task_ghi789",
  "userId": "user_2abc123",
  "title": "Research competitor features",
  "status": "pending",
  "listType": "backlog",
  "order": 0,
  "date": "2025-11-24",
  "isPrivate": true,
  "createdAt": "2025-11-24T10:00:00.000Z",
  "updatedAt": "2025-11-24T10:00:00.000Z"
}
```

### Business Rules

1. **Daily Focus List:**
   - Maximum of 3 tasks per day in "focus" list
   - If a 4th task is added, it automatically goes to "backlog"
   - Tasks are ordered and can be reordered via drag-and-drop

2. **Backlog:**
   - Unlimited tasks
   - Users can promote tasks from backlog to focus (if focus has < 3)

3. **Task Lifecycle:**
   - Created as "pending"
   - Can be marked "completed" (with completedAt timestamp)
   - Completed tasks remain in the list but are visually distinct

4. **Privacy:**
   - `isPrivate: true` means task won't be visible to Squad members (future feature)
   - `isPrivate: false` means task may be visible in social/Squad contexts

5. **Date-based:**
   - Tasks are per-day (date field is YYYY-MM-DD)
   - Each day can have its own set of focus + backlog tasks

---

## 5. Squads Collection

**Path:** `/squads/{squadId}`

```typescript
interface Squad {
  // Core
  id: string;                     // Auto-generated doc ID
  name: string;                   // Squad name
  avatarUrl: string;              // Squad image URL
  
  // Type
  isPremium: boolean;             // Premium squad with coach
  coachId: string | null;         // Coach user ID (required if premium)
  
  // Stats (TODO: Real calculations will be implemented later)
  streak: number | null;          // Squad streak (days)
  avgAlignment: number | null;    // Average alignment score (0-100)
  
  // Metadata
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
}
```

### Example Document

```json
{
  "id": "squad_abc123",
  "name": "Growth League",
  "avatarUrl": "https://example.com/squad-avatar.png",
  "isPremium": false,
  "coachId": null,
  "streak": 5,
  "avgAlignment": 78,
  "createdAt": "2025-11-01T00:00:00.000Z",
  "updatedAt": "2025-11-24T15:00:00.000Z"
}
```

---

## 6. Squad Members Collection

**Path:** `/squad_members/{memberId}`

```typescript
interface SquadMember {
  // Core
  id: string;                     // Auto-generated doc ID
  squadId: string;                // Squad ID
  userId: string;                 // User ID
  roleInSquad: 'member' | 'coach'; // Role in squad
  
  // Denormalized User Data (for display)
  firstName: string;
  lastName: string;
  imageUrl: string;
  
  // Stats (TODO: Real calculations will be implemented later)
  alignmentScore: number | null;  // Individual alignment score
  streak: number | null;          // Individual streak
  moodState: 'energized' | 'confident' | 'neutral' | 'uncertain' | 'stuck' | null;
  
  // Metadata
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
}
```

### Example Documents

#### Regular Member
```json
{
  "id": "member_def456",
  "squadId": "squad_abc123",
  "userId": "user_2abc123",
  "roleInSquad": "member",
  "firstName": "Michael",
  "lastName": "Johnson",
  "imageUrl": "https://example.com/avatar.jpg",
  "alignmentScore": 85,
  "streak": 21,
  "moodState": "energized",
  "createdAt": "2025-11-01T00:00:00.000Z",
  "updatedAt": "2025-11-24T15:00:00.000Z"
}
```

#### Coach Member (Premium Squad)
```json
{
  "id": "member_ghi789",
  "squadId": "squad_xyz789",
  "userId": "user_coach123",
  "roleInSquad": "coach",
  "firstName": "Nick",
  "lastName": "Coach",
  "imageUrl": "https://example.com/coach.jpg",
  "alignmentScore": 95,
  "streak": 100,
  "moodState": "energized",
  "createdAt": "2025-11-01T00:00:00.000Z",
  "updatedAt": "2025-11-24T15:00:00.000Z"
}
```

### Business Rules

1. **Squad Creation:**
   - Only users with role `coach` or `super_admin` can create squads
   - Coach must be assigned if `isPremium: true`
   - Coach is automatically added as a member with `roleInSquad: 'coach'`

2. **Squad Membership:**
   - A user can only be in one squad at a time
   - When a user joins a squad, their `squadId` field is updated
   - When a user leaves a squad, their `squadId` is set to null

3. **Placeholder Stats:**
   - `alignmentScore`, `streak`, and `moodState` are currently placeholders
   - Real calculations will be implemented later based on:
     - Daily task completion
     - Habit completion
     - Identity alignment

4. **Squad Streak:**
   - Squad streak is kept only if >50% of members complete their daily focus tasks
   - This is a placeholder value for now

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the resource
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      // Anyone can read public user data
      allow read: if true;
      
      // Only the user can create/update their own profile
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      
      // Only the user can delete their profile
      allow delete: if isOwner(userId);
    }
    
    // Goals collection
    match /goals/{goalId} {
      // Users can read their own goals or public goals
      allow read: if isAuthenticated() && 
        (resource.data.userId == request.auth.uid || resource.data.isPublic == true);
      
      // Users can create their own goals
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
      
      // Users can update their own goals
      allow update: if isOwner(resource.data.userId);
      
      // Users can delete their own goals
      allow delete: if isOwner(resource.data.userId);
    }
    
    // Habits collection
    match /habits/{habitId} {
      // Users can read their own habits or public habits
      allow read: if isAuthenticated() && 
        (resource.data.userId == request.auth.uid || resource.data.isPublic == true);
      
      // Users can create their own habits
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
      
      // Users can update their own habits
      allow update: if isOwner(resource.data.userId);
      
      // Users can delete their own habits
      allow delete: if isOwner(resource.data.userId);
    }
    
    // Squads collection
    match /squads/{squadId} {
      // Anyone authenticated can read squads
      allow read: if isAuthenticated();
      
      // Only coaches and super_admins can create squads
      allow create: if isAuthenticated() && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['coach', 'super_admin']);
      
      // Only coaches and super_admins can update squads
      allow update: if isAuthenticated() && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['coach', 'super_admin']);
      
      // Only super_admins can delete squads
      allow delete: if isAuthenticated() && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin');
    }
    
    // Squad Members collection
    match /squad_members/{memberId} {
      // Users can read members of their own squad
      allow read: if isAuthenticated() && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.squadId == resource.data.squadId);
      
      // Only coaches and super_admins can add members
      allow create: if isAuthenticated() && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['coach', 'super_admin']);
      
      // Users can update their own member record
      allow update: if isOwner(resource.data.userId);
      
      // Only coaches and super_admins can remove members
      allow delete: if isAuthenticated() && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['coach', 'super_admin']);
    }
  }
}
```

---

## Firestore Indexes

### Composite Indexes Needed

1. **Goals by User and Status**
   ```
   Collection: goals
   Fields: userId (Ascending), status (Ascending), targetDate (Ascending)
   ```

2. **Habits by User and Status**
   ```
   Collection: habits
   Fields: userId (Ascending), status (Ascending), createdAt (Descending)
   ```

3. **Habits by User and Completion**
   ```
   Collection: habits
   Fields: userId (Ascending), progress.lastCompletedAt (Descending)
   ```

4. **Users by Alignment Score**
   ```
   Collection: users
   Fields: alignmentScore (Descending), lastActiveAt (Descending)
   ```

### Single Field Indexes

These are automatically created by Firebase:
- `users`: `clerkId`, `email`, `createdAt`, `updatedAt`
- `goals`: `userId`, `status`, `targetDate`, `createdAt`
- `habits`: `userId`, `status`, `frequencyType`, `createdAt`

---

## Migration Scripts

### Initialize User Document (after Clerk signup)

```typescript
async function initializeUserDocument(clerkUserId: string, userData: {
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
}) {
  const userRef = db.collection('users').doc(clerkUserId);
  
  await userRef.set({
    id: clerkUserId,
    clerkId: clerkUserId,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    imageUrl: userData.imageUrl,
    identity: null,
    identityValidatedAt: null,
    bio: null,
    location: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alignmentScore: 0,
    totalGoalsCompleted: 0,
    totalHabitsCompleted: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    onboardingCompletedAt: null,
    settings: {
      notifications: true,
      emailUpdates: true,
      theme: 'auto'
    }
  });
}
```

---

## Query Examples

### Get User's Active Goals

```typescript
const activeGoals = await db
  .collection('goals')
  .where('userId', '==', userId)
  .where('status', '==', 'active')
  .orderBy('targetDate', 'asc')
  .get();
```

### Get Today's Habits

```typescript
const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday

const todayHabits = await db
  .collection('habits')
  .where('userId', '==', userId)
  .where('status', '==', 'active')
  .where('daysOfWeek', 'array-contains', today)
  .get();
```

### Get Habit Completion History

```typescript
const habit = await db.collection('habits').doc(habitId).get();
const completionDates = habit.data()?.progress.completionDates || [];

// Get last 30 days
const last30Days = completionDates.slice(-30);
```

### Get User's Tasks for a Specific Date

```typescript
const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

const tasks = await db
  .collection('tasks')
  .where('userId', '==', userId)
  .where('date', '==', today)
  .get();

// Sort by listType (focus first) then order
const sortedTasks = tasks.docs
  .map(doc => ({ id: doc.id, ...doc.data() }))
  .sort((a, b) => {
    if (a.listType === b.listType) {
      return a.order - b.order;
    }
    return a.listType === 'focus' ? -1 : 1;
  });
```

### Get Only Daily Focus Tasks (Max 3)

```typescript
const focusTasks = await db
  .collection('tasks')
  .where('userId', '==', userId)
  .where('date', '==', today)
  .where('listType', '==', 'focus')
  .orderBy('order', 'asc')
  .limit(3)
  .get();
```

### Get Completed Tasks for Today

```typescript
const completedTasks = await db
  .collection('tasks')
  .where('userId', '==', userId)
  .where('date', '==', today)
  .where('status', '==', 'completed')
  .get();
```

---

## Best Practices

1. **Always use server timestamp** for `createdAt`, `updatedAt`
2. **Use transactions** for progress updates to avoid race conditions
3. **Batch writes** for multiple related updates (e.g., completing habit + updating user stats)
4. **Denormalize** critical data (e.g., store user firstName in goals for display)
5. **Use subcollections** for large nested data (future: habit check-ins)
6. **Index strategy**: Create indexes based on actual queries, not preemptively
7. **Security**: Always validate `userId` matches `request.auth.uid` in rules

---

## Firestore Setup Checklist

- [ ] Create Firestore database in Firebase Console
- [ ] Deploy security rules
- [ ] Create composite indexes
- [ ] Set up backup schedule (Firebase Console)
- [ ] Configure data retention policy
- [ ] Enable point-in-time recovery
- [ ] Set up monitoring and alerts
- [ ] Test security rules with Firestore Emulator

---

## Environment Variables (Already in Doppler)

```bash
# Client-side (NEXT_PUBLIC prefix required)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCXcIuwF2p-k7sQJ--Lb3J3FzmTmy6v4RM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gawebdev2-3191a.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gawebdev2-3191a
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=gawebdev2-3191a.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=221349781882
NEXT_PUBLIC_FIREBASE_APP_ID=1:221349781882:web:9d47d18c69fc3fdfa5f6c3
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-LZG4737FZC

# Server-side (Admin SDK)
FIREBASE_PROJECT_ID=gawebdev2-3191a
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@gawebdev2-3191a.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=<stored in Doppler>
```

