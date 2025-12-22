import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Task, Habit } from '@/types';

/**
 * GET /api/dashboard
 * 
 * Unified API endpoint that returns ALL dashboard data in one request:
 * - User data (identity, goal) - from both users collection and org_memberships for org-specific data
 * - Today's tasks (filtered by organizationId)
 * - Active habits (filtered by organizationId)
 * 
 * This reduces multiple API calls to 1, improving performance significantly
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current organization from tenant context
    const organizationId = await getEffectiveOrgId();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Build queries with organization filtering
    let habitsQuery = adminDb
      .collection('habits')
      .where('userId', '==', userId)
      .where('archived', '==', false);
    
    let tasksQuery = adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', date);

    // Apply organization filtering if we have an organizationId
    if (organizationId) {
      habitsQuery = habitsQuery.where('organizationId', '==', organizationId);
      tasksQuery = tasksQuery.where('organizationId', '==', organizationId);
    }

    // Fetch all data in parallel using Promise.all for maximum speed
    const fetchPromises: Promise<FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QuerySnapshot>[] = [
      // 1. User data (base)
      adminDb.collection('users').doc(userId).get(),
      
      // 2. Habits (active only, filtered by org)
      habitsQuery.orderBy('createdAt', 'desc').get(),
      
      // 3. Tasks for today (filtered by org)
      tasksQuery.orderBy('order', 'asc').get(),
    ];

    // Also fetch org membership for org-specific profile data
    if (organizationId) {
      fetchPromises.push(
        adminDb.collection('org_memberships').doc(`${organizationId}_${userId}`).get()
      );
    }

    const results = await Promise.all(fetchPromises);
    const userDoc = results[0] as FirebaseFirestore.DocumentSnapshot;
    const habitsSnapshot = results[1] as FirebaseFirestore.QuerySnapshot;
    const tasksSnapshot = results[2] as FirebaseFirestore.QuerySnapshot;
    const orgMembershipDoc = results[3] as FirebaseFirestore.DocumentSnapshot | undefined;

    // Process user data - merge base user data with org-specific data
    const baseUserData = userDoc.exists ? userDoc.data() : null;
    const orgMembershipData = orgMembershipDoc?.exists ? orgMembershipDoc.data() : null;
    
    // Merge user data: org-specific fields override base user fields
    const userData = baseUserData ? {
      ...baseUserData,
      // Org-specific fields from org_memberships
      ...(orgMembershipData && {
        goal: orgMembershipData.goal,
        goalStartDate: orgMembershipData.goalStartDate,
        targetDate: orgMembershipData.targetDate,
        identity: orgMembershipData.identity,
        bio: orgMembershipData.bio,
        onboardingStatus: orgMembershipData.onboardingStatus,
        hasCompletedOnboarding: orgMembershipData.hasCompletedOnboarding,
        weeklyFocus: orgMembershipData.weeklyFocus,
        primarySquadId: orgMembershipData.primarySquadId,
        standardSquadId: orgMembershipData.standardSquadId,
        premiumSquadId: orgMembershipData.premiumSquadId,
      }),
    } : null;

    // Process habits
    const habits: Habit[] = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Habit));

    // Process tasks
    const tasks: Task[] = tasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Task));

    // Separate tasks by type
    const focusTasks = tasks.filter(t => t.listType === 'focus');
    const backlogTasks = tasks.filter(t => t.listType === 'backlog');

    return NextResponse.json({
      user: userData,
      habits,
      tasks: {
        focus: focusTasks,
        backlog: backlogTasks,
      },
      date,
      organizationId,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

