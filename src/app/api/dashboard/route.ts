import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Task, Habit, Program, ProgramCohort, ProgramEnrollment, Squad, SquadMember } from '@/types';

/**
 * GET /api/dashboard
 * 
 * Unified API endpoint that returns ALL homepage data in ONE request:
 * - User data (identity, goal)
 * - Today's tasks
 * - Active habits
 * - Morning check-in status
 * - Evening check-in status
 * - Weekly reflection status
 * - Program check-in status
 * - Program enrollments
 * - Squad data
 * 
 * This reduces 10+ API calls to 1, dramatically improving performance
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

interface EnrollmentWithDetails extends ProgramEnrollment {
  program: {
    id: string;
    name: string;
    type: 'group' | 'individual';
    lengthDays: number;
    coverImageUrl?: string;
  };
  cohort?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  progress: {
    currentDay: number;
    totalDays: number;
    percentComplete: number;
    daysRemaining: number;
  };
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const weekId = getWeekId();

    // Build queries with organization filtering
    let habitsQuery = adminDb
      .collection('habits')
      .where('userId', '==', userId)
      .where('archived', '==', false);
    
    let tasksQuery = adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('date', '==', date);

    if (organizationId) {
      habitsQuery = habitsQuery.where('organizationId', '==', organizationId);
      tasksQuery = tasksQuery.where('organizationId', '==', organizationId);
    }

    // =========================================================================
    // PARALLEL FETCH ALL DATA
    // =========================================================================
    const fetchPromises: Promise<FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QuerySnapshot>[] = [
      // 1. User data (base)
      adminDb.collection('users').doc(userId).get(),
      
      // 2. Habits
      habitsQuery.orderBy('createdAt', 'desc').get(),
      
      // 3. Tasks for today
      tasksQuery.orderBy('order', 'asc').get(),
      
      // 4. Program enrollments
      adminDb.collection('program_enrollments')
        .where('userId', '==', userId)
        .where('status', 'in', ['active', 'upcoming'])
        .orderBy('createdAt', 'desc')
        .get(),
    ];

    // Org-specific data fetches
    if (organizationId) {
      fetchPromises.push(
        // 5. Org membership
        adminDb.collection('org_memberships').doc(`${organizationId}_${userId}`).get(),
        
        // 6. Morning check-in
        adminDb.collection('morning_checkins').doc(getMorningCheckInDocId(organizationId, userId, date)).get(),
        
        // 7. Evening check-in
        adminDb.collection('evening_checkins').doc(getEveningCheckInDocId(organizationId, userId, date)).get(),
        
        // 8. Weekly reflection
        adminDb.collection('weekly_reflections').doc(getWeeklyReflectionDocId(organizationId, userId, weekId)).get(),
      );
    }

    const results = await Promise.all(fetchPromises);
    
    const userDoc = results[0] as FirebaseFirestore.DocumentSnapshot;
    const habitsSnapshot = results[1] as FirebaseFirestore.QuerySnapshot;
    const tasksSnapshot = results[2] as FirebaseFirestore.QuerySnapshot;
    const enrollmentsSnapshot = results[3] as FirebaseFirestore.QuerySnapshot;
    
    const orgMembershipDoc = organizationId ? results[4] as FirebaseFirestore.DocumentSnapshot : undefined;
    const morningCheckInDoc = organizationId ? results[5] as FirebaseFirestore.DocumentSnapshot : undefined;
    const eveningCheckInDoc = organizationId ? results[6] as FirebaseFirestore.DocumentSnapshot : undefined;
    const weeklyReflectionDoc = organizationId ? results[7] as FirebaseFirestore.DocumentSnapshot : undefined;

    // =========================================================================
    // PROCESS USER DATA
    // =========================================================================
    const baseUserData = userDoc.exists ? userDoc.data() : null;
    const orgMembershipData = orgMembershipDoc?.exists ? orgMembershipDoc.data() : null;
    
    const userData = baseUserData ? {
      ...baseUserData,
      ...(orgMembershipData && {
        goal: orgMembershipData.goal,
        goalStartDate: orgMembershipData.goalStartDate,
        goalTargetDate: orgMembershipData.goalTargetDate,
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

    // =========================================================================
    // PROCESS HABITS
    // =========================================================================
    const habits: Habit[] = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Habit));

    // =========================================================================
    // PROCESS TASKS
    // =========================================================================
    const tasks: Task[] = tasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Task));

    const focusTasks = tasks.filter(t => t.listType === 'focus');
    const backlogTasks = tasks.filter(t => t.listType === 'backlog');

    // =========================================================================
    // PROCESS CHECK-INS
    // =========================================================================
    const morningCheckIn = morningCheckInDoc?.exists 
      ? { id: morningCheckInDoc.id, ...morningCheckInDoc.data() }
      : null;
    
    const eveningCheckIn = eveningCheckInDoc?.exists
      ? { id: eveningCheckInDoc.id, ...eveningCheckInDoc.data() }
      : null;
    
    const weeklyReflection = weeklyReflectionDoc?.exists
      ? { id: weeklyReflectionDoc.id, ...weeklyReflectionDoc.data() }
      : null;

    // =========================================================================
    // PROCESS PROGRAM CHECK-IN STATUS
    // =========================================================================
    let programCheckIn = { show: false, programId: null as string | null, programName: null as string | null };
    
    if (baseUserData?.pendingProgramCheckIn) {
      programCheckIn = {
        show: true,
        programId: baseUserData.lastCompletedProgramId || null,
        programName: baseUserData.lastCompletedProgramName || null,
      };
    } else if (baseUserData?.programCheckInDismissedAt) {
      const dismissedAt = new Date(baseUserData.programCheckInDismissedAt);
      const now = new Date();
      const hoursSinceDismissal = (now.getTime() - dismissedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceDismissal < 24) {
        programCheckIn = {
          show: true,
          programId: baseUserData.lastCompletedProgramId || null,
          programName: baseUserData.lastCompletedProgramName || null,
        };
      }
    }

    // =========================================================================
    // PROCESS PROGRAM ENROLLMENTS
    // =========================================================================
    const enrollments: EnrollmentWithDetails[] = [];
    
    if (!enrollmentsSnapshot.empty) {
      // Get unique program IDs and cohort IDs
      const programIds = new Set<string>();
      const cohortIds = new Set<string>();
      
      enrollmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        programIds.add(data.programId);
        if (data.cohortId) cohortIds.add(data.cohortId);
      });
      
      // Batch fetch programs and cohorts
      const [programDocs, cohortDocs] = await Promise.all([
        Promise.all([...programIds].map(id => adminDb.collection('programs').doc(id).get())),
        cohortIds.size > 0 
          ? Promise.all([...cohortIds].map(id => adminDb.collection('program_cohorts').doc(id).get()))
          : Promise.resolve([]),
      ]);
      
      // Create lookup maps
      const programMap = new Map<string, Program>();
      programDocs.forEach(doc => {
        if (doc.exists) {
          programMap.set(doc.id, { id: doc.id, ...doc.data() } as Program);
        }
      });
      
      const cohortMap = new Map<string, ProgramCohort>();
      cohortDocs.forEach(doc => {
        if (doc.exists) {
          cohortMap.set(doc.id, { id: doc.id, ...doc.data() } as ProgramCohort);
        }
      });
      
      // Build enrollment details
      for (const doc of enrollmentsSnapshot.docs) {
        const enrollment = { id: doc.id, ...doc.data() } as ProgramEnrollment;
        const program = programMap.get(enrollment.programId);
        
        if (!program) continue;
        
        const cohort = enrollment.cohortId ? cohortMap.get(enrollment.cohortId) : undefined;
        
        // Calculate progress
        const startDate = new Date(enrollment.startedAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentDay = Math.max(1, Math.min(daysSinceStart + 1, program.lengthDays));
        const percentComplete = Math.round((currentDay / program.lengthDays) * 100);
        const daysRemaining = Math.max(0, program.lengthDays - currentDay);
        
        enrollments.push({
          ...enrollment,
          program: {
            id: program.id,
            name: program.name,
            type: program.type,
            lengthDays: program.lengthDays,
            coverImageUrl: program.coverImageUrl,
          },
          cohort: cohort ? {
            id: cohort.id,
            name: cohort.name,
            startDate: cohort.startDate,
            endDate: cohort.endDate,
          } : undefined,
          progress: {
            currentDay: enrollment.status === 'upcoming' ? 0 : currentDay,
            totalDays: program.lengthDays,
            percentComplete: enrollment.status === 'upcoming' ? 0 : percentComplete,
            daysRemaining: enrollment.status === 'upcoming' ? program.lengthDays : daysRemaining,
          },
        });
      }
    }

    const activeEnrollments = enrollments.filter(e => e.status === 'active');
    const upcomingEnrollments = enrollments.filter(e => e.status === 'upcoming');

    // =========================================================================
    // PROCESS SQUAD DATA
    // =========================================================================
    const squads: { premium: { squad: Squad | null; members: SquadMember[] }; standard: { squad: Squad | null; members: SquadMember[] } } = {
      premium: { squad: null, members: [] },
      standard: { squad: null, members: [] },
    };
    
    const premiumSquadId = orgMembershipData?.premiumSquadId || baseUserData?.premiumSquadId;
    const standardSquadId = orgMembershipData?.standardSquadId || baseUserData?.standardSquadId;
    
    if (premiumSquadId || standardSquadId) {
      const squadFetches: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];
      const memberFetches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
      
      if (premiumSquadId) {
        squadFetches.push(adminDb.collection('squads').doc(premiumSquadId).get());
        memberFetches.push(
          adminDb.collection('squad_members')
            .where('squadId', '==', premiumSquadId)
            .where('status', '==', 'active')
            .limit(10)
            .get()
        );
      }
      
      if (standardSquadId) {
        squadFetches.push(adminDb.collection('squads').doc(standardSquadId).get());
        memberFetches.push(
          adminDb.collection('squad_members')
            .where('squadId', '==', standardSquadId)
            .where('status', '==', 'active')
            .limit(10)
            .get()
        );
      }
      
      const [squadResults, memberResults] = await Promise.all([
        Promise.all(squadFetches),
        Promise.all(memberFetches),
      ]);
      
      let idx = 0;
      if (premiumSquadId) {
        const squadDoc = squadResults[idx];
        const membersSnapshot = memberResults[idx];
        if (squadDoc.exists) {
          squads.premium = {
            squad: { id: squadDoc.id, ...squadDoc.data() } as Squad,
            members: membersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as SquadMember)),
          };
        }
        idx++;
      }
      
      if (standardSquadId) {
        const squadDoc = squadResults[idx];
        const membersSnapshot = memberResults[idx];
        if (squadDoc.exists) {
          squads.standard = {
            squad: { id: squadDoc.id, ...squadDoc.data() } as Squad,
            members: membersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as SquadMember)),
          };
        }
      }
    }

    // =========================================================================
    // RETURN UNIFIED RESPONSE
    // =========================================================================
    return NextResponse.json({
      // Core data
      user: userData,
      habits,
      tasks: {
        focus: focusTasks,
        backlog: backlogTasks,
      },
      
      // Check-in status
      checkIns: {
        morning: morningCheckIn,
        evening: eveningCheckIn,
        weekly: weeklyReflection,
        program: programCheckIn,
      },
      
      // Program enrollments
      programEnrollments: {
        active: activeEnrollments,
        upcoming: upcomingEnrollments,
      },
      
      // Squad data
      squads,
      
      // Metadata
      date,
      weekId,
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
