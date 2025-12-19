# Quick Reference Card

## 🔑 Environment Variables Template

Copy this to your `.env.local` or add to Doppler:

```env
# === CLERK (Authentication) ===
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# === FIREBASE (Database) ===
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# === STREAM (Chat) ===
NEXT_PUBLIC_STREAM_API_KEY=
STREAM_API_SECRET=

# === APP ===
NEXT_PUBLIC_APP_URL=http://localhost:3000

# === EMAIL (Resend) ===
RESEND_API_KEY=re_...

# === CRON ===
CRON_SECRET=...
```

---

## 🚀 Common Commands

```bash
# Development
npm run dev              # Run with .env.local
npm run dev:doppler      # Run with Doppler

# Build & Production
npm run build            # Build for production
npm run start            # Start production server

# Linting
npm run lint             # Run ESLint

# Doppler
doppler setup            # Setup Doppler project
doppler open             # Open Doppler dashboard
doppler run -- npm run dev  # Run with Doppler
```

---

## 📦 Code Snippets

### Get Current User (Clerk)
```tsx
import { useUser } from '@clerk/nextjs';

function MyComponent() {
  const { user, isLoaded, isSignedIn } = useUser();
  
  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Please sign in</div>;
  
  return <div>Hello {user.firstName}!</div>;
}
```

### Get Firebase User Data
```tsx
import { useFirebaseUser } from '@/hooks/useFirebaseUser';

function MyComponent() {
  const { userData, loading, userId } = useFirebaseUser();
  
  if (loading) return <div>Loading...</div>;
  
  return <div>{userData?.email}</div>;
}
```

### Create Firestore Document
```tsx
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

async function createTask(taskData) {
  const docRef = await addDoc(collection(db, 'tasks'), {
    ...taskData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}
```

### Query Firestore
```tsx
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function getUserTasks(userId: string) {
  const q = query(
    collection(db, 'tasks'),
    where('userId', '==', userId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

### Real-time Firestore Listener
```tsx
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

function useRealtimeTasks(userId: string) {
  const [tasks, setTasks] = useState([]);
  
  useEffect(() => {
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', userId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })));
    });
    
    return () => unsubscribe();
  }, [userId]);
  
  return tasks;
}
```

### Initialize Stream Chat
```tsx
import { useStreamChat } from '@/hooks/useStreamChat';

function ChatApp() {
  const { client, isConnecting } = useStreamChat();
  
  if (isConnecting || !client) {
    return <div>Connecting to chat...</div>;
  }
  
  // Client is ready, use it
  return <div>Chat ready!</div>;
}
```

### Create a Stream Channel
```tsx
import { useStreamChat } from '@/hooks/useStreamChat';
import { useEffect, useState } from 'react';

function MyChat() {
  const { client } = useStreamChat();
  const [channel, setChannel] = useState(null);
  
  useEffect(() => {
    if (!client) return;
    
    const initChannel = async () => {
      const newChannel = client.channel('messaging', 'my-channel-id', {
        name: 'My Channel',
      });
      
      await newChannel.watch();
      setChannel(newChannel);
    };
    
    initChannel();
  }, [client]);
  
  return channel ? <div>Channel ready</div> : <div>Loading...</div>;
}
```

### Protect Server Action/Route
```tsx
import { auth } from '@clerk/nextjs/server';

export async function myServerAction() {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  // Do something with userId
}
```

### Server-side Firebase Query
```tsx
import { adminDb } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs/server';

export async function getUserData() {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  const userDoc = await adminDb.collection('users').doc(userId).get();
  return userDoc.data();
}
```

---

## 🎯 File Paths Reference

### Configuration
- `src/middleware.ts` - Route protection
- `src/app/layout.tsx` - Root layout
- `.env.example` - Environment template
- `doppler.yaml` - Doppler config

### Infrastructure
- `src/lib/firebase.ts` - Firebase client
- `src/lib/firebase-admin.ts` - Firebase server
- `src/lib/stream-client.ts` - Stream client
- `src/lib/stream-server.ts` - Stream server
- `src/lib/clerk-firebase-sync.ts` - User sync

### API Routes
- `src/app/api/stream-token/route.ts` - Token gen
- `src/app/api/webhooks/clerk/route.ts` - User webhook

### Hooks
- `src/hooks/useFirebaseUser.ts` - Firebase user
- `src/hooks/useStreamChat.ts` - Stream chat

### Components
- `src/components/StreamChatProvider.tsx` - Chat provider

### Types
- `src/types/index.ts` - Type definitions

---

## 🌐 API Endpoints

### GET `/api/stream-token`
**Purpose:** Generate Stream Chat token  
**Auth:** Required (Clerk)  
**Response:**
```json
{
  "token": "eyJhbGc...",
  "userId": "user_abc123"
}
```

### POST `/api/webhooks/clerk`
**Purpose:** Sync Clerk users to Firebase  
**Auth:** Webhook signature  
**Events:** user.created, user.updated, user.deleted

---

## 📊 Collections Structure (Firebase)

### `users` Collection
```typescript
{
  id: string;              // Clerk user ID
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}
```

### Example: `tasks` Collection (to create)
```typescript
{
  id: string;              // Auto-generated
  userId: string;          // Reference to user
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 🔐 Security Rules Examples

### Firestore Rules (to add in Firebase Console)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Tasks - users can only access their own
    match /tasks/{taskId} {
      allow read, write: if request.auth != null 
        && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
  }
}
```

---

## 📚 Documentation Links

| Service | Documentation |
|---------|--------------|
| Clerk | https://clerk.com/docs |
| Firebase | https://firebase.google.com/docs |
| Stream | https://getstream.io/chat/docs |
| Next.js | https://nextjs.org/docs |
| Doppler | https://docs.doppler.com |

---

## 💡 Tips

1. **Always use server-side for sensitive operations**
   - Use `firebase-admin` for privileged operations
   - Generate Stream tokens server-side only
   - Validate permissions on the server

2. **Use real-time listeners sparingly**
   - They keep connections open
   - Use `getDocs()` for one-time fetches
   - Unsubscribe when component unmounts

3. **Type everything**
   - Add types to `src/types/index.ts`
   - Use TypeScript for better DX

4. **Keep secrets safe**
   - Never commit `.env.local`
   - Use Doppler for team collaboration
   - Rotate keys regularly

---

**Quick Start:**
```bash
cp .env.example .env.local
# Add your keys
npm run dev
```

**Open:** http://localhost:3000

