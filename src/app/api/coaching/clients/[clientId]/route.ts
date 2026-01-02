import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { resolveActivity } from '@/lib/analytics/activity';
import { isDemoRequest, demoResponse, demoNotAvailable } from '@/lib/demo-api';
import { generateDemoClients, generateDemoUserProfile } from '@/lib/demo-data';
import type { 
  ClientCoachingData, 
  UserRole, 
  OrgRole,
  FirebaseUser, 
  Coach,
  CoachingActionItem,
  CoachingSessionHistory,
  CoachingResource,
  CoachPrivateNotes,
  ClerkPublicMetadata,
  Task,
  Habit,
  MorningCheckIn,
  EveningCheckIn,
  WeeklyReflectionCheckIn,
} from '@/types';

// Types for comprehensive client data response
interface ClientTask {
  id: string;
  title: string;
  status: string;
  listType: string;
  date: string;
  completedAt?: string;
  createdAt: string;
}

interface ClientHabit {
  id: string;
  text: string;
  frequencyType: string;
  frequencyValue: number | number[];
  progress: {
    currentCount: number;
    lastCompletedDate: string | null;
    completionDates: string[];
  };
  status?: string;
  createdAt: string;
}

interface ClientMorningCheckin {
  id: string;
  date: string;
  emotionalState: string;
  userThought?: string;
  aiReframe?: string;
  completedAt?: string;
}

interface ClientEveningCheckin {
  id: string;
  date: string;
  emotionalState: string;
  reflectionText?: string;
  tasksCompleted: number;
  tasksTotal: number;
  completedAt?: string;
}

interface ClientWeeklyCheckin {
  id: string;
  date: string;
  onTrackStatus: string;
  progress: number;
  previousProgress: number;
  whatWentWell?: string;
  biggestObstacles?: string;
  nextWeekPlan?: string;
  publicFocus?: string;
  completedAt?: string;
}

interface ClientProgramEnrollment {
  id: string;
  programId: string;
  programName: string;
  status: string;
  progress: number;
  startedAt: string;
  completedAt?: string;
}

interface ClientActivityScore {
  status: 'thriving' | 'active' | 'inactive';
  atRisk: boolean;
  lastActivityAt: string | null;
  daysActiveInPeriod: number;
  primarySignal: string | null;
}

/**
 * GET /api/coaching/clients/[clientId]
 * Fetches comprehensive coaching data for a specific client
 * 
 * Query params:
 * - comprehensive=true: Fetch all client data (tasks, habits, checkins, programs, activity)
 * 
 * MULTI-TENANCY: Coaching data is scoped per organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    
    // Demo mode: return demo client data
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const { clients } = generateDemoClients(18);
      // Client ID format: "demo-org_demo-user-X", extract the userId part
      const extractedUserId = clientId.includes('_') ? clientId.split('_').pop() : clientId;
      const demoClient = clients.find(c => c.userId === extractedUserId) || clients[0];
      
      // Generate comprehensive demo data for this client
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Demo tasks for last 7 days
      const demoTasks = Array.from({ length: 20 }, (_, i) => {
        const date = new Date(now.getTime() - (i % 7) * 24 * 60 * 60 * 1000);
        return {
          id: `demo-task-${i}`,
          title: ['Complete morning reflection', 'Watch training video', 'Journal exercise', 'Practice new skill', 'Community check-in'][i % 5],
          status: i < 12 ? 'completed' : 'pending',
          listType: 'focus',
          date: date.toISOString().split('T')[0],
          completedAt: i < 12 ? date.toISOString() : undefined,
          createdAt: date.toISOString(),
        };
      });
      
      // Demo habits
      const demoHabits = [
        { id: 'demo-habit-1', text: 'Morning Meditation', frequencyType: 'daily', frequencyValue: 1, progress: { currentCount: 8, lastCompletedDate: now.toISOString().split('T')[0], completionDates: [] }, createdAt: thirtyDaysAgo.toISOString() },
        { id: 'demo-habit-2', text: 'Exercise', frequencyType: 'daily', frequencyValue: 1, progress: { currentCount: 5, lastCompletedDate: now.toISOString().split('T')[0], completionDates: [] }, createdAt: thirtyDaysAgo.toISOString() },
        { id: 'demo-habit-3', text: 'Read 30 minutes', frequencyType: 'daily', frequencyValue: 1, progress: { currentCount: 12, lastCompletedDate: now.toISOString().split('T')[0], completionDates: [] }, createdAt: thirtyDaysAgo.toISOString() },
      ];
      
      // Demo check-ins
      const demoMorningCheckins = Array.from({ length: 14 }, (_, i) => {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        return {
          id: `demo-morning-${i}`,
          date: date.toISOString().split('T')[0],
          emotionalState: ['excited', 'focused', 'calm', 'motivated', 'energized'][i % 5],
          userThought: 'Looking forward to making progress today!',
          completedAt: date.toISOString(),
        };
      });
      
      const demoEveningCheckins = Array.from({ length: 14 }, (_, i) => {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        return {
          id: `demo-evening-${i}`,
          date: date.toISOString().split('T')[0],
          emotionalState: ['accomplished', 'grateful', 'satisfied', 'content'][i % 4],
          tasksCompleted: 2 + (i % 3),
          tasksTotal: 3 + (i % 2),
          completedAt: date.toISOString(),
        };
      });
      
      const demoWeeklyCheckins = Array.from({ length: 4 }, (_, i) => {
        const date = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        return {
          id: `demo-weekly-${i}`,
          date: date.toISOString().split('T')[0],
          onTrackStatus: i === 0 ? 'on_track' : ['on_track', 'slightly_behind', 'ahead'][i % 3],
          progress: 45 + i * 10,
          previousProgress: 35 + i * 10,
          whatWentWell: 'Made good progress on daily habits',
          nextWeekPlan: 'Focus on consistency and deep work',
          completedAt: date.toISOString(),
        };
      });
      
      // Demo program enrollment
      const demoProgramEnrollments = demoClient.programId ? [{
        id: 'demo-enrollment-1',
        programId: demoClient.programId,
        programName: demoClient.programName || '30-Day Transformation',
        status: 'active',
        progress: 40,
        startedAt: thirtyDaysAgo.toISOString(),
      }] : [];
      
      return demoResponse({
        data: {
          id: `demo-org_${clientId}`,
          userId: clientId,
          organizationId: 'demo-org',
          coachId: 'demo-coach',
          focusAreas: ['Goal Setting', 'Habit Building', 'Time Management'],
          actionItems: [
            { id: 'action-1', text: 'Complete morning routine checklist', completed: true, createdAt: thirtyDaysAgo.toISOString() },
            { id: 'action-2', text: 'Schedule weekly review', completed: false, createdAt: thirtyDaysAgo.toISOString() },
          ],
          resources: [
            { id: 'resource-1', title: 'Morning Routine Guide', url: '#', createdAt: thirtyDaysAgo.toISOString() },
          ],
          privateNotes: [],
          sessionHistory: [
            { id: 'session-1', date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], title: 'Initial Strategy Session', summary: 'Discussed goals and created action plan.', takeaways: ['Set clear daily priorities', 'Build keystone habits'], createdAt: thirtyDaysAgo.toISOString(), updatedAt: thirtyDaysAgo.toISOString() },
          ],
          nextCall: null,
          createdAt: thirtyDaysAgo.toISOString(),
          updatedAt: now.toISOString(),
        },
        user: {
          id: clientId,
          firstName: demoClient.name.split(' ')[0],
          lastName: demoClient.name.split(' ').slice(1).join(' '),
          email: demoClient.email,
          imageUrl: demoClient.avatarUrl,
          avatarUrl: demoClient.avatarUrl,
          goal: 'Build consistent habits and achieve my goals',
          goalProgress: 45, // Number, not object
          tier: 'standard',
          coachingStatus: 'active',
          coaching: true,
        },
        coach: {
          id: 'demo-coach',
          userId: 'demo-coach-user',
          name: 'Coach Adam',
          email: 'coach@demo.growthaddicts.com',
          imageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
        },
        tasks: demoTasks,
        habits: demoHabits,
        morningCheckins: demoMorningCheckins,
        eveningCheckins: demoEveningCheckins,
        weeklyCheckins: demoWeeklyCheckins,
        programEnrollments: demoProgramEnrollments,
        activityScore: {
          status: demoClient.status,
          atRisk: demoClient.atRisk,
          lastActivityAt: demoClient.lastActivityAt,
          daysActiveInPeriod: demoClient.daysActiveInPeriod,
          primarySignal: demoClient.primarySignal,
        },
        coachNotes: 'Great progress this week! Client is showing strong commitment to their morning routine.',
        streak: 8,
      });
    }
    
    const { userId, sessionClaims } = await auth();
    const { searchParams } = new URL(request.url);
    const isComprehensive = searchParams.get('comprehensive') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    // MULTI-TENANCY: Get effective org ID
    const organizationId = await getEffectiveOrgId();

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Fetch coaching data (org-scoped document ID: organizationId_clientId)
    const orgScopedDocId = `${organizationId}_${clientId}`;
    let coachingDoc = await adminDb.collection('clientCoachingData').doc(orgScopedDocId).get();

    // Legacy fallback: try clientId only
    if (!coachingDoc.exists) {
      coachingDoc = await adminDb.collection('clientCoachingData').doc(clientId).get();
    }

    // Allow access even without coaching data document (for viewing any client)
    const coachingData = coachingDoc.exists 
      ? { id: coachingDoc.id, ...coachingDoc.data() } as ClientCoachingData
      : null;

    // MULTI-TENANCY: Verify coaching data belongs to current organization (if exists)
    if (coachingData?.organizationId && coachingData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // For org-level coaches, they can view any client in their org
    // For global coaches, verify they are assigned to this client
    const isGlobalCoach = role === 'coach';
    const isSuperCoach = orgRole === 'super_coach';
    const isOrgCoach = orgRole === 'coach';
    
    // Super coaches can see all clients in the org
    // Global coaches and regular org coaches need to be assigned
    if (!isSuperCoach && (isGlobalCoach || isOrgCoach) && coachingData && coachingData.coachId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch user details (try org_memberships first, then users)
    let user: Partial<FirebaseUser> | null = null;
    
    // Get user's profile from org_memberships (multi-tenancy)
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', clientId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();
    
    if (!membershipSnapshot.empty) {
      const memberData = membershipSnapshot.docs[0].data();
      user = {
        id: clientId,
        firstName: memberData.firstName,
        lastName: memberData.lastName,
        email: memberData.email,
        imageUrl: memberData.imageUrl,
        avatarUrl: memberData.avatarUrl,
        timezone: memberData.timezone,
        goal: memberData.goal,
        goalTargetDate: memberData.goalTargetDate,
        goalProgress: memberData.goalProgress,
        goalSetAt: memberData.goalSetAt,
        identity: memberData.identity,
        goalHistory: memberData.goalHistory,
        identityHistory: memberData.identityHistory,
        tier: memberData.tier,
        coachingStatus: memberData.coachingStatus,
        coaching: memberData.coaching,
      };
    }
    
    // Fallback: get from users collection
    if (!user) {
      const userDoc = await adminDb.collection('users').doc(clientId).get();
      if (userDoc.exists) {
        const userData = userDoc.data() as FirebaseUser;
        user = {
          id: userDoc.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          imageUrl: userData.imageUrl,
          avatarUrl: userData.avatarUrl,
          timezone: userData.timezone,
          goal: userData.goal,
          goalTargetDate: userData.goalTargetDate,
          goalProgress: userData.goalProgress,
          goalSetAt: userData.goalSetAt,
          identity: userData.identity,
          goalHistory: userData.goalHistory,
          identityHistory: userData.identityHistory,
          tier: userData.tier,
          coachingStatus: userData.coachingStatus,
          coaching: userData.coaching,
        };
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch coach info
    let coach: Coach | null = null;
    if (coachingData?.coachId) {
      const coachDoc = await adminDb.collection('coaches').doc(coachingData.coachId).get();
      if (coachDoc.exists) {
        coach = { id: coachDoc.id, ...coachDoc.data() } as Coach;
      }
    }

    // If not comprehensive request, return basic data
    if (!isComprehensive) {
      return NextResponse.json({
        data: coachingData,
        user,
        coach,
      });
    }

    // ============================================================================
    // COMPREHENSIVE DATA FETCH
    // ============================================================================
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    // Fetch all comprehensive data in parallel
    const [
      tasksSnapshot,
      habitsSnapshot,
      morningCheckinsSnapshot,
      eveningCheckinsSnapshot,
      weeklyCheckinsSnapshot,
      programEnrollmentsSnapshot,
      activityResult,
      coachNotesDoc,
    ] = await Promise.all([
      // Tasks - last 30 days
      adminDb.collection('tasks')
        .where('userId', '==', clientId)
        .where('organizationId', '==', organizationId)
        .orderBy('date', 'desc')
        .limit(100)
        .get(),
      
      // Habits - all active
      adminDb.collection('habits')
        .where('userId', '==', clientId)
        .where('organizationId', '==', organizationId)
        .where('archived', '==', false)
        .get(),
      
      // Morning check-ins - last 30 days
      adminDb.collection('morning_checkins')
        .where('userId', '==', clientId)
        .where('organizationId', '==', organizationId)
        .orderBy('date', 'desc')
        .limit(30)
        .get(),
      
      // Evening check-ins - last 30 days
      adminDb.collection('evening_checkins')
        .where('userId', '==', clientId)
        .where('organizationId', '==', organizationId)
        .orderBy('date', 'desc')
        .limit(30)
        .get(),
      
      // Weekly check-ins - last 8 weeks
      adminDb.collection('weekly_reflections')
        .where('userId', '==', clientId)
        .where('organizationId', '==', organizationId)
        .orderBy('date', 'desc')
        .limit(8)
        .get(),
      
      // Program enrollments
      adminDb.collection('program_enrollments')
        .where('userId', '==', clientId)
        .where('organizationId', '==', organizationId)
        .get(),
      
      // Activity score
      resolveActivity({ orgId: organizationId, userId: clientId }),
      
      // Coach notes about this client
      adminDb.collection('coach_client_notes')
        .doc(`${organizationId}_${userId}_${clientId}`)
        .get(),
    ]);

    // Process tasks
    const tasks: ClientTask[] = tasksSnapshot.docs.map(doc => {
      const data = doc.data() as Task;
      return {
        id: doc.id,
        title: data.title,
        status: data.status,
        listType: data.listType,
        date: data.date,
        completedAt: data.completedAt,
        createdAt: data.createdAt,
      };
    });

    // Process habits
    const habits: ClientHabit[] = habitsSnapshot.docs.map(doc => {
      const data = doc.data() as Habit;
      return {
        id: doc.id,
        text: data.text,
        frequencyType: data.frequencyType,
        frequencyValue: data.frequencyValue,
        progress: {
          currentCount: data.progress?.currentCount || 0,
          lastCompletedDate: data.progress?.lastCompletedDate || null,
          completionDates: data.progress?.completionDates || [],
        },
        status: data.status,
        createdAt: data.createdAt,
      };
    });

    // Process morning check-ins
    const morningCheckins: ClientMorningCheckin[] = morningCheckinsSnapshot.docs.map(doc => {
      const data = doc.data() as MorningCheckIn;
      return {
        id: doc.id,
        date: data.date,
        emotionalState: data.emotionalState,
        userThought: data.userThought,
        aiReframe: data.aiReframe,
        completedAt: data.completedAt,
      };
    });

    // Process evening check-ins
    const eveningCheckins: ClientEveningCheckin[] = eveningCheckinsSnapshot.docs.map(doc => {
      const data = doc.data() as EveningCheckIn;
      return {
        id: doc.id,
        date: data.date,
        emotionalState: data.emotionalState,
        reflectionText: data.reflectionText,
        tasksCompleted: data.tasksCompleted,
        tasksTotal: data.tasksTotal,
        completedAt: data.completedAt,
      };
    });

    // Process weekly check-ins
    const weeklyCheckins: ClientWeeklyCheckin[] = weeklyCheckinsSnapshot.docs.map(doc => {
      const data = doc.data() as WeeklyReflectionCheckIn;
      return {
        id: doc.id,
        date: data.date,
        onTrackStatus: data.onTrackStatus,
        progress: data.progress,
        previousProgress: data.previousProgress,
        whatWentWell: data.whatWentWell,
        biggestObstacles: data.biggestObstacles,
        nextWeekPlan: data.nextWeekPlan,
        publicFocus: data.publicFocus,
        completedAt: data.completedAt,
      };
    });

    // Process program enrollments - fetch program names
    const programIds = [...new Set(programEnrollmentsSnapshot.docs.map(doc => doc.data().programId))];
    const programMap = new Map<string, string>();
    
    if (programIds.length > 0) {
      const programDocs = await Promise.all(
        programIds.slice(0, 20).map(id => adminDb.collection('programs').doc(id).get())
      );
      for (const doc of programDocs) {
        if (doc.exists) {
          programMap.set(doc.id, doc.data()?.name || 'Unknown Program');
        }
      }
    }

    const programEnrollments: ClientProgramEnrollment[] = programEnrollmentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        programId: data.programId,
        programName: programMap.get(data.programId) || 'Unknown Program',
        status: data.status || 'active',
        progress: data.progress || 0,
        startedAt: data.startedAt || data.createdAt,
        completedAt: data.completedAt,
      };
    });

    // Process activity score
    const activityScore: ClientActivityScore = {
      status: activityResult.status,
      atRisk: activityResult.atRisk,
      lastActivityAt: activityResult.activitySignals.lastActivityAt?.toISOString() || null,
      daysActiveInPeriod: activityResult.activitySignals.daysActiveInPeriod,
      primarySignal: activityResult.activitySignals.primarySignal,
    };

    // Get coach notes
    const coachNotes = coachNotesDoc.exists ? coachNotesDoc.data()?.notes || '' : '';

    // Calculate streak from alignment data
    let streak = 0;
    try {
      const alignmentSnapshot = await adminDb.collection('user_alignments')
        .where('userId', '==', clientId)
        .where('organizationId', '==', organizationId)
        .orderBy('date', 'desc')
        .limit(30)
        .get();
      
      // Count consecutive days with full alignment (starting from most recent)
      const today = new Date().toISOString().split('T')[0];
      for (const doc of alignmentSnapshot.docs) {
        const data = doc.data();
        // Check if all alignment activities are completed
        const isFullyAligned = data.didMorningCheckin && data.didSetTasks && 
                               data.didInteractWithSquad && data.hasActiveGoal;
        if (isFullyAligned) {
          streak++;
        } else {
          break;
        }
      }
    } catch (err) {
      console.warn('[COACHING_CLIENT] Failed to fetch alignment data:', err);
    }

    return NextResponse.json({
      data: coachingData,
      user,
      coach,
      // Comprehensive data
      tasks,
      habits,
      morningCheckins,
      eveningCheckins,
      weeklyCheckins,
      programEnrollments,
      activityScore,
      coachNotes,
      streak,
    });
  } catch (error) {
    console.error('[COACHING_CLIENT_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/coaching/clients/[clientId]
 * Updates coaching data for a specific client (coach only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // Demo mode: block write operations
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoNotAvailable('Updating client data');
    }
    
    const { clientId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const patchMetadata = sessionClaims?.publicMetadata as { role?: UserRole; orgRole?: OrgRole };
    const patchRole = patchMetadata?.role;
    const patchOrgRole = patchMetadata?.orgRole;

    if (!canAccessCoachDashboard(patchRole, patchOrgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    // Fetch existing coaching data
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(clientId).get();

    if (!coachingDoc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const existingData = coachingDoc.data() as ClientCoachingData;

    // Verify coach has access to this client (global coach role or assigned org coach)
    const isPatchGlobalCoach = patchRole === 'coach';
    const isPatchOrgCoach = patchOrgRole === 'coach';
    if ((isPatchGlobalCoach || isPatchOrgCoach) && existingData.coachId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    // Build update object - only allow specific fields
    const updateData: Partial<ClientCoachingData> = {
      updatedAt: now,
    };

    // Focus areas
    if (body.focusAreas !== undefined && Array.isArray(body.focusAreas)) {
      updateData.focusAreas = body.focusAreas;
    }

    // Action items
    if (body.actionItems !== undefined && Array.isArray(body.actionItems)) {
      updateData.actionItems = body.actionItems.map((item: Partial<CoachingActionItem>) => ({
        id: item.id || `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: item.text || '',
        completed: item.completed || false,
        completedAt: item.completedAt,
        createdAt: item.createdAt || now,
      }));
    }

    // Session history (add or update)
    if (body.sessionHistory !== undefined && Array.isArray(body.sessionHistory)) {
      updateData.sessionHistory = body.sessionHistory.map((session: Partial<CoachingSessionHistory>) => ({
        id: session.id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: session.date || now.split('T')[0],
        title: session.title || 'Coaching Session',
        summary: session.summary || '',
        takeaways: session.takeaways || [],
        createdAt: session.createdAt || now,
        updatedAt: now,
      }));
    }

    // Resources
    if (body.resources !== undefined && Array.isArray(body.resources)) {
      updateData.resources = body.resources.map((resource: Partial<CoachingResource>) => ({
        id: resource.id || `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: resource.title || 'Resource',
        url: resource.url || '',
        description: resource.description,
        createdAt: resource.createdAt || now,
      }));
    }

    // Private notes (coach only)
    if (body.privateNotes !== undefined && Array.isArray(body.privateNotes)) {
      updateData.privateNotes = body.privateNotes.map((note: Partial<CoachPrivateNotes>) => ({
        sessionId: note.sessionId || `note_${Date.now()}`,
        notes: note.notes || '',
        plannedTopics: note.plannedTopics,
        tags: note.tags || [],
        createdAt: note.createdAt || now,
        updatedAt: now,
      }));
    }

    // Update Firestore
    await adminDb.collection('clientCoachingData').doc(clientId).update(updateData);

    return NextResponse.json({ success: true, updatedAt: now });
  } catch (error) {
    console.error('[COACHING_CLIENT_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}









