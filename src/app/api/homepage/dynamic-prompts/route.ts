import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { OrgCheckInFlow } from '@/types';

/**
 * GET /api/homepage/dynamic-prompts
 * 
 * Returns custom flows that should potentially be shown on the homepage,
 * along with user's current state for condition evaluation.
 * 
 * The client evaluates time-based conditions locally for accuracy,
 * while action-based conditions use the server-provided state.
 */

// Helper functions for document IDs
function getMorningCheckInDocId(organizationId: string, userId: string, date: string): string {
  return `${organizationId}_${userId}_${date}`;
}

function getEveningCheckInDocId(organizationId: string, userId: string, date: string): string {
  return `${organizationId}_${userId}_${date}`;
}

function getWeeklyReflectionDocId(organizationId: string, userId: string, weekId: string): string {
  return `${organizationId}_${userId}_${weekId}`;
}

function getWeekId(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export interface DynamicPromptsResponse {
  flows: Array<{
    id: string;
    name: string;
    type: string;
    displayConfig?: OrgCheckInFlow['displayConfig'];
    showConditions?: OrgCheckInFlow['showConditions'];
  }>;
  userState: {
    // Tasks
    completedTasksToday: number;
    totalTasksToday: number;
    
    // Habits
    completedHabitsToday: number;
    completedHabitIds: string[];
    
    // Flows completed today
    morningCheckInCompleted: boolean;
    eveningCheckInCompleted: boolean;
    weeklyReflectionCompleted: boolean;
    
    // Custom flows completed today (by flow ID)
    completedCustomFlowIds: string[];
    
    // Current date info (for client reference)
    today: string;
    dayOfWeek: number; // 0=Sun, 6=Sat
  };
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    
    if (!organizationId) {
      return NextResponse.json({ 
        flows: [], 
        userState: getEmptyUserState() 
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const weekId = getWeekId();
    const dayOfWeek = new Date().getDay();

    // =========================================================================
    // PARALLEL FETCH ALL DATA
    // =========================================================================
    const [
      customFlowsSnapshot,
      tasksSnapshot,
      habitsSnapshot,
      habitCompletionsSnapshot,
      morningCheckInDoc,
      eveningCheckInDoc,
      weeklyReflectionDoc,
      customFlowSessionsSnapshot,
    ] = await Promise.all([
      // 1. Custom flows with showConditions
      adminDb
        .collection('orgCheckInFlows')
        .where('organizationId', '==', organizationId)
        .where('type', '==', 'custom')
        .where('enabled', '==', true)
        .get(),
      
      // 2. Today's tasks
      adminDb
        .collection('tasks')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .where('date', '==', today)
        .get(),
      
      // 3. Active habits
      adminDb
        .collection('habits')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .where('archived', '==', false)
        .get(),
      
      // 4. Habit completions today
      adminDb
        .collection('habitCompletions')
        .where('userId', '==', userId)
        .where('date', '==', today)
        .get(),
      
      // 5. Morning check-in
      adminDb
        .collection('morning_checkins')
        .doc(getMorningCheckInDocId(organizationId, userId, today))
        .get(),
      
      // 6. Evening check-in
      adminDb
        .collection('evening_checkins')
        .doc(getEveningCheckInDocId(organizationId, userId, today))
        .get(),
      
      // 7. Weekly reflection
      adminDb
        .collection('weekly_reflections')
        .doc(getWeeklyReflectionDocId(organizationId, userId, weekId))
        .get(),
      
      // 8. Custom flow sessions completed today
      adminDb
        .collection('checkInSessions')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .where('completedAt', '>=', `${today}T00:00:00.000Z`)
        .where('completedAt', '<', `${today}T23:59:59.999Z`)
        .get(),
    ]);

    // =========================================================================
    // PROCESS CUSTOM FLOWS
    // =========================================================================
    const flows = customFlowsSnapshot.docs
      .filter(doc => {
        const data = doc.data();
        // Only include flows that have showConditions configured
        return data.showConditions && data.showConditions.conditions?.length > 0;
      })
      .map(doc => {
        const data = doc.data() as OrgCheckInFlow;
        return {
          id: doc.id,
          name: data.name,
          type: data.type,
          displayConfig: data.displayConfig,
          showConditions: data.showConditions,
        };
      });

    // =========================================================================
    // BUILD USER STATE
    // =========================================================================
    
    // Tasks
    const tasks = tasksSnapshot.docs.map(doc => doc.data());
    const completedTasksToday = tasks.filter(t => t.status === 'completed').length;
    const totalTasksToday = tasks.length;
    
    // Habits
    const completedHabitIds = habitCompletionsSnapshot.docs.map(doc => doc.data().habitId);
    const completedHabitsToday = completedHabitIds.length;
    
    // Flow completions
    const morningCheckInCompleted = morningCheckInDoc.exists && !!morningCheckInDoc.data()?.completedAt;
    const eveningCheckInCompleted = eveningCheckInDoc.exists && !!eveningCheckInDoc.data()?.completedAt;
    const weeklyReflectionCompleted = weeklyReflectionDoc.exists && !!weeklyReflectionDoc.data()?.completedAt;
    
    // Custom flow completions
    const completedCustomFlowIds = customFlowSessionsSnapshot.docs
      .map(doc => doc.data().flowId)
      .filter(Boolean);

    const userState: DynamicPromptsResponse['userState'] = {
      completedTasksToday,
      totalTasksToday,
      completedHabitsToday,
      completedHabitIds,
      morningCheckInCompleted,
      eveningCheckInCompleted,
      weeklyReflectionCompleted,
      completedCustomFlowIds,
      today,
      dayOfWeek,
    };

    return NextResponse.json({ flows, userState } satisfies DynamicPromptsResponse);
  } catch (error) {
    console.error('[DYNAMIC_PROMPTS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

function getEmptyUserState(): DynamicPromptsResponse['userState'] {
  const today = new Date().toISOString().split('T')[0];
  return {
    completedTasksToday: 0,
    totalTasksToday: 0,
    completedHabitsToday: 0,
    completedHabitIds: [],
    morningCheckInCompleted: false,
    eveningCheckInCompleted: false,
    weeklyReflectionCompleted: false,
    completedCustomFlowIds: [],
    today,
    dayOfWeek: new Date().getDay(),
  };
}

