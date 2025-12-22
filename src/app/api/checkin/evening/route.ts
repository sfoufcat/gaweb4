import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendWeeklyReflectionNotification } from '@/lib/notifications';
import { isFridayInTimezone, DEFAULT_TIMEZONE } from '@/lib/timezone';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Task, EveningCheckIn, EveningEmotionalState, ClerkPublicMetadata } from '@/types';

// Task snapshot stored in evening check-in
interface TaskSnapshot {
  id: string;
  title: string;
  status: string;
  completedAt?: string;
}

/**
 * Generate document ID for evening check-in: `${organizationId}_${userId}_${date}`
 * Multi-tenancy: Check-ins are scoped per organization
 */
function getEveningCheckInDocId(organizationId: string, userId: string, date: string): string {
  return `${organizationId}_${userId}_${date}`;
}

// GET - Fetch today's evening check-in
// MULTI-TENANCY: Fetches check-in for current organization (with legacy fallback)
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Try new top-level collection first if we have organizationId
    if (organizationId) {
      const docId = getEveningCheckInDocId(organizationId, userId, date);
      const checkInDoc = await adminDb.collection('evening_checkins').doc(docId).get();
      if (checkInDoc.exists) {
        return NextResponse.json({ checkIn: { id: checkInDoc.id, ...checkInDoc.data() } });
      }
    }

    // Legacy fallback: Check user subcollection
    const legacyRef = adminDb.collection('users').doc(userId).collection('eveningCheckins').doc(date);
    const legacyDoc = await legacyRef.get();
    
    if (legacyDoc.exists) {
      return NextResponse.json({ checkIn: { id: legacyDoc.id, ...legacyDoc.data() } });
    }

    return NextResponse.json({ checkIn: null });
  } catch (error) {
    console.error('Error fetching evening check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch evening check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Start a new evening check-in
// MULTI-TENANCY: Creates check-in scoped to current organization (with legacy fallback)
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    const body = await request.json();
    let { tasksCompleted = 0, tasksTotal = 0 } = body;

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Snapshot the current Daily Focus tasks
    const completedTasksSnapshot: TaskSnapshot[] = [];
    try {
      let tasksQuery = adminDb
        .collection('tasks')
        .where('userId', '==', userId)
        .where('date', '==', today)
        .where('listType', '==', 'focus');
      
      // Add org filter if available
      if (organizationId) {
        tasksQuery = tasksQuery.where('organizationId', '==', organizationId);
      }
      
      const tasksSnapshot = await tasksQuery.get();
      const focusTasks: Task[] = [];
      
      tasksSnapshot.forEach((doc) => {
        const task = { id: doc.id, ...doc.data() } as Task;
        focusTasks.push(task);
        if (task.status === 'completed') {
          completedTasksSnapshot.push({
            id: task.id,
            title: task.title,
            status: task.status,
            completedAt: task.completedAt,
          });
        }
      });
      
      // Use actual counts from the snapshot
      tasksCompleted = completedTasksSnapshot.length;
      tasksTotal = focusTasks.length;
    } catch (taskError) {
      console.error('Error snapshotting tasks for check-in:', taskError);
      // Continue with passed values if snapshot fails
    }

    // If we have organizationId, use new structure
    if (organizationId) {
      const docId = getEveningCheckInDocId(organizationId, userId, today);
      const checkInRef = adminDb.collection('evening_checkins').doc(docId);
      const existingDoc = await checkInRef.get();

      // If check-in already exists, return it
      if (existingDoc.exists) {
        return NextResponse.json({ checkIn: { id: existingDoc.id, ...existingDoc.data() } });
      }

      const newCheckIn: Omit<EveningCheckIn, 'id'> & { completedTasksSnapshot: TaskSnapshot[] } = {
        date: today,
        userId,
        organizationId,
        emotionalState: 'steady' as EveningEmotionalState,
        tasksCompleted,
        tasksTotal,
        completedTasksSnapshot,
        createdAt: now,
        updatedAt: now,
      };

      await checkInRef.set(newCheckIn);
      return NextResponse.json({ checkIn: { id: docId, ...newCheckIn } }, { status: 201 });
    }

    // Legacy fallback: Use user subcollection
    console.warn('[EVENING_CHECKIN] No organization context, using legacy structure for user', userId);
    const legacyRef = adminDb.collection('users').doc(userId).collection('eveningCheckins').doc(today);
    const existingDoc = await legacyRef.get();

    if (existingDoc.exists) {
      return NextResponse.json({ checkIn: { id: existingDoc.id, ...existingDoc.data() } });
    }

    const legacyCheckIn = {
      date: today,
      userId,
      emotionalState: 'steady' as EveningEmotionalState,
      tasksCompleted,
      tasksTotal,
      completedTasksSnapshot,
      createdAt: now,
      updatedAt: now,
    };

    await legacyRef.set(legacyCheckIn);
    return NextResponse.json({ checkIn: { id: today, ...legacyCheckIn } }, { status: 201 });
  } catch (error) {
    console.error('Error creating evening check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to create evening check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update evening check-in progress
// MULTI-TENANCY: Updates check-in scoped to current organization (with legacy fallback)
export async function PATCH(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    const updates = await request.json();
    const today = new Date().toISOString().split('T')[0];
    
    let checkInRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> | null = null;
    let existingDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    // Try new top-level collection first if we have organizationId
    if (organizationId) {
      const docId = getEveningCheckInDocId(organizationId, userId, today);
      checkInRef = adminDb.collection('evening_checkins').doc(docId);
      existingDoc = await checkInRef.get();
    }

    // Legacy fallback: Check user subcollection
    if (!existingDoc?.exists) {
      const legacyRef = adminDb.collection('users').doc(userId).collection('eveningCheckins').doc(today);
      existingDoc = await legacyRef.get();
      if (existingDoc.exists) {
        checkInRef = legacyRef;
      }
    }

    if (!existingDoc?.exists || !checkInRef) {
      return NextResponse.json({ error: 'Evening check-in not found' }, { status: 404 });
    }

    const updatedData: Partial<EveningCheckIn> & { completedTasksSnapshot?: TaskSnapshot[] } = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // If marking as completed, capture final task state snapshot
    if (updates.completedAt === true) {
      updatedData.completedAt = new Date().toISOString();
      
      // Snapshot the Daily Focus tasks
      try {
        let tasksQuery = adminDb
          .collection('tasks')
          .where('userId', '==', userId)
          .where('date', '==', today)
          .where('listType', '==', 'focus');
        
        // Add org filter if available
        if (organizationId) {
          tasksQuery = tasksQuery.where('organizationId', '==', organizationId);
        }
        
        const tasksSnapshot = await tasksQuery.get();
        const focusTasks: Task[] = [];
        const completedTasksSnapshot: TaskSnapshot[] = [];
        
        tasksSnapshot.forEach((doc) => {
          const task = { id: doc.id, ...doc.data() } as Task;
          focusTasks.push(task);
          if (task.status === 'completed') {
            completedTasksSnapshot.push({
              id: task.id,
              title: task.title,
              status: task.status,
              completedAt: task.completedAt,
            });
          }
        });
        
        // Update with actual task data at completion time
        updatedData.tasksCompleted = completedTasksSnapshot.length;
        updatedData.tasksTotal = focusTasks.length;
        updatedData.completedTasksSnapshot = completedTasksSnapshot;
      } catch (taskError) {
        console.error('Error snapshotting tasks for check-in completion:', taskError);
        // Continue without task data - will fall back to original counts
      }
    }

    await checkInRef.update(updatedData);
    const updatedDoc = await checkInRef.get();

    // If completing evening check-in on Friday, trigger weekly reflection notification
    if (updates.completedAt === true) {
      try {
        // Get user's timezone to check if it's Friday in their local time
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userTimezone = userDoc.data()?.timezone || DEFAULT_TIMEZONE;
        
        if (isFridayInTimezone(userTimezone)) {
          // It's Friday in user's timezone - send weekly reflection notification
          await sendWeeklyReflectionNotification(userId, true);
        }
      } catch (notificationError) {
        // Don't fail check-in if notification fails
        console.error('[EVENING_CHECKIN] Weekly reflection notification failed:', notificationError);
      }
    }

    return NextResponse.json({ checkIn: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error) {
    console.error('Error updating evening check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to update evening check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}




