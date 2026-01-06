import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isDemoRequest, withDemoMode, demoResponse } from '@/lib/demo-api';
import { generateDemoUserProfile, generateDemoSquadMembers, generateDemoDiscoverContent } from '@/lib/demo-data';
import {
  getActiveEnrollment,
  getProgramById,
  calculateCurrentDayIndex,
} from '@/lib/program-engine';
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
 * - Carousel cards data (program prompt + discover recommendation)
 *
 * This reduces 10+ API calls to 1, dramatically improving performance
 */

// ============================================================================
// CAROUSEL CARDS - Types and Constants
// ============================================================================
interface ProgramPrompt {
  title: string;
  description: string;
}

interface DiscoverRecommendation {
  id: string;
  type: 'article' | 'course';
  title: string;
  description: string;
  coverImageUrl?: string;
  category?: string;
}

// Generic fallback prompts when user has no active program
const GENERIC_PROMPTS: ProgramPrompt[] = [
  {
    title: "Start Your Day with Purpose",
    description: "Take a moment to reflect on what you want to accomplish today. What's the one thing that will make today a success?",
  },
  {
    title: "Focus on Progress",
    description: "Small steps lead to big changes. What's one small action you can take today toward your goals?",
  },
  {
    title: "Embrace the Journey",
    description: "Every day is an opportunity to learn and grow. What will you explore today?",
  },
  {
    title: "Make It Count",
    description: "Time is your most valuable asset. How will you invest it wisely today?",
  },
  {
    title: "Build Momentum",
    description: "Consistency beats intensity. What daily habit are you strengthening today?",
  },
];

/**
 * Get a prompt index that cycles daily
 */
function getDailyPromptIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

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
    description?: string;
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
    // Demo mode: return demo dashboard data
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const profile = generateDemoUserProfile();
      const today = new Date().toISOString().split('T')[0];
      const weekId = getWeekId();
      
      return demoResponse({
        user: {
          id: profile.id,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          imageUrl: profile.imageUrl,
        },
        habits: profile.habits.map(h => ({
          id: h.id,
          text: h.title,
          userId: profile.id,
          organizationId: 'demo-org',
          frequencyType: 'daily' as const,
          frequencyValue: 1,
          reminder: null,
          targetRepetitions: null,
          progress: {
            currentCount: h.streak,
            completionDates: h.completedToday ? [today] : [],
            lastCompletedDate: h.completedToday ? today : null,
            skipDates: [],
          },
          archived: false,
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        tasks: {
          focus: profile.todaysTasks.map(t => ({
            id: t.id,
            label: t.label,
            completed: t.completed,
            isPrimary: t.isPrimary,
            date: today,
          })),
          backlog: [],
        },
        checkIns: {
          morning: {
            id: 'demo-morning-checkin',
            userId: profile.id,
            organizationId: 'demo-org',
            date: today,
            emotionalState: 'confident',
            completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          },
          evening: null,
          weekly: null,
          program: { show: false, programId: null, programName: null, programDays: null },
        },
        programEnrollments: {
          active: profile.programs.map((p, i) => ({
            id: `demo-enrollment-${i + 1}`,
            programId: p.id,
            program: {
              id: p.id,
              name: p.name,
              type: p.type,
              lengthDays: p.totalDays,
              coverImageUrl: p.coverImageUrl,
            },
            progress: {
              currentDay: p.currentDay,
              totalDays: p.totalDays,
              percentComplete: p.progress,
              daysRemaining: p.totalDays - p.currentDay,
            },
            status: 'active',
          })),
          upcoming: [],
        },
        squads: {
          premium: { squad: null, members: [] },
          standard: profile.squad ? {
            squad: {
              id: profile.squad.id,
              name: profile.squad.name,
              avatarUrl: profile.squad.avatarUrl || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&h=200&fit=crop',
              chatChannelId: profile.squad.chatChannelId,
              coachId: null,
              createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date().toISOString(),
            },
            members: generateDemoSquadMembers(profile.squad.id, 5).map(m => ({
              id: m.odataId,
              odataId: m.odataId,
              odataUserId: m.odataUserId,
              odataSquadId: m.odataSquadId,
              squadId: profile.squad!.id,
              userId: m.odataUserId,
              name: m.name,
              firstName: m.firstName,
              lastName: m.lastName,
              imageUrl: m.imageUrl,
              roleInSquad: m.role === 'admin' ? 'admin' : 'member',
              createdAt: m.joinedAt,
              updatedAt: m.joinedAt,
            })),
          } : { squad: null, members: [] },
        },
        // Carousel cards data
        carouselCards: {
          programPrompt: {
            hasEnrollment: true,
            prompt: GENERIC_PROMPTS[getDailyPromptIndex() % GENERIC_PROMPTS.length],
            programName: profile.programs[0]?.name || null,
            currentDay: profile.programs[0]?.currentDay || null,
            totalDays: profile.programs[0]?.totalDays || null,
          },
          discoverRecommendation: (() => {
            const demoContent = generateDemoDiscoverContent();
            const randomItem = demoContent[getDailyPromptIndex() % demoContent.length];
            return randomItem ? {
              id: randomItem.id,
              type: randomItem.type as 'article' | 'course',
              title: randomItem.title,
              description: randomItem.description,
              coverImageUrl: randomItem.imageUrl,
              category: randomItem.category,
            } : null;
          })(),
        },
        date: today,
        weekId,
        organizationId: 'demo-org',
      });
    }

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
        // 5. Org membership (query-based since docs are created with auto-generated IDs)
        adminDb.collection('org_memberships')
          .where('userId', '==', userId)
          .where('organizationId', '==', organizationId)
          .limit(1)
          .get(),
        
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
    
    const orgMembershipSnapshot = organizationId ? results[4] as FirebaseFirestore.QuerySnapshot : undefined;
    const morningCheckInDoc = organizationId ? results[5] as FirebaseFirestore.DocumentSnapshot : undefined;
    const eveningCheckInDoc = organizationId ? results[6] as FirebaseFirestore.DocumentSnapshot : undefined;
    const weeklyReflectionDoc = organizationId ? results[7] as FirebaseFirestore.DocumentSnapshot : undefined;

    // =========================================================================
    // PROCESS USER DATA
    // =========================================================================
    const baseUserData = userDoc.exists ? userDoc.data() : null;
    const orgMembershipData = orgMembershipSnapshot && !orgMembershipSnapshot.empty 
      ? orgMembershipSnapshot.docs[0].data() 
      : null;
    
    // MULTI-TENANCY: Exclude goal fields from baseUserData to prevent cross-org leakage
    // Goal data should ONLY come from org_memberships for the current organization
    let safeBaseUserData = baseUserData;
    if (baseUserData) {
      const { goal: _g, goalStartDate: _gs, goalTargetDate: _gt, goalProgress: _gp, goalSetAt: _gsa, goalCompleted: _gc, goalCompletedAt: _gca, goalIsAISuggested: _gai, ...rest } = baseUserData;
      safeBaseUserData = rest;
    }
    
    const userData = safeBaseUserData ? {
      ...safeBaseUserData,
      // Only include org-scoped data when we have org context
      ...(organizationId && orgMembershipData && {
        goal: orgMembershipData.goal || null,
        goalStartDate: orgMembershipData.goalStartDate || null,
        goalTargetDate: orgMembershipData.goalTargetDate || null,
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
    interface ProgramCheckInInfo {
      show: boolean;
      programId: string | null;
      programName: string | null;
      programDays: number | null;
      completionConfig?: {
        showConfetti?: boolean;
        upsellProgramId?: string;
        upsellHeadline?: string;
        upsellDescription?: string;
      };
      upsellProgram?: {
        id: string;
        name: string;
        description: string;
        coverImageUrl?: string;
        priceInCents: number;
        currency: string;
        lengthDays: number;
      };
    }
    
    let programCheckIn: ProgramCheckInInfo = { 
      show: false, 
      programId: null, 
      programName: null,
      programDays: null,
    };
    
    const shouldShowCheckIn = baseUserData?.pendingProgramCheckIn || 
      (baseUserData?.programCheckInDismissedAt && 
       ((new Date().getTime() - new Date(baseUserData.programCheckInDismissedAt).getTime()) / (1000 * 60 * 60)) < 24);
    
    if (shouldShowCheckIn && baseUserData?.lastCompletedProgramId) {
      // Fetch the completed program to get its completionConfig
      const completedProgramDoc = await adminDb.collection('programs').doc(baseUserData.lastCompletedProgramId).get();
      const completedProgram = completedProgramDoc.exists ? completedProgramDoc.data() as Program : null;
      
      programCheckIn = {
        show: true,
        programId: baseUserData.lastCompletedProgramId,
        programName: baseUserData.lastCompletedProgramName || completedProgram?.name || null,
        programDays: completedProgram?.lengthDays || null,
        completionConfig: completedProgram?.completionConfig,
      };
      
      // If there's an upsell program configured, fetch its details
      if (completedProgram?.completionConfig?.upsellProgramId) {
        const upsellProgramDoc = await adminDb.collection('programs').doc(completedProgram.completionConfig.upsellProgramId).get();
        if (upsellProgramDoc.exists) {
          const upsellData = upsellProgramDoc.data() as Program;
          // Only include if the upsell program is active
          if (upsellData.isActive) {
            programCheckIn.upsellProgram = {
              id: upsellProgramDoc.id,
              name: upsellData.name,
              description: upsellData.description,
              coverImageUrl: upsellData.coverImageUrl,
              priceInCents: upsellData.priceInCents,
              currency: upsellData.currency,
              lengthDays: upsellData.lengthDays,
            };
          }
        }
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
            description: program.description,
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
    // PROCESS CAROUSEL CARDS DATA
    // =========================================================================
    // Fetch program prompt and discover recommendation in parallel
    const carouselCardsPromise = (async () => {
      // Program Prompt
      let programPromptData: {
        hasEnrollment: boolean;
        prompt: ProgramPrompt;
        programName: string | null;
        currentDay: number | null;
        totalDays: number | null;
      } = {
        hasEnrollment: false,
        prompt: GENERIC_PROMPTS[getDailyPromptIndex() % GENERIC_PROMPTS.length],
        programName: null,
        currentDay: null,
        totalDays: null,
      };

      // Discover Recommendation
      let discoverRecommendationData: DiscoverRecommendation | null = null;

      // Fetch in parallel
      const [enrollment, articlesSnapshot, coursesSnapshot] = await Promise.all([
        getActiveEnrollment(userId),
        organizationId
          ? adminDb.collection('articles').where('organizationId', '==', organizationId).get()
          : adminDb.collection('articles').get(),
        organizationId
          ? adminDb.collection('courses').where('organizationId', '==', organizationId).get()
          : adminDb.collection('courses').get(),
      ]);

      // Process program prompt
      if (enrollment) {
        const program = await getProgramById(enrollment.programId);
        if (program) {
          const today = new Date().toISOString().split('T')[0];
          const currentDayIndex = calculateCurrentDayIndex(enrollment.startedAt, program.lengthDays, today);

          // Fetch the program day for current day
          const daySnapshot = await adminDb
            .collection('program_days')
            .where('programId', '==', program.id)
            .where('dayIndex', '==', currentDayIndex)
            .limit(1)
            .get();

          let prompt: ProgramPrompt = GENERIC_PROMPTS[getDailyPromptIndex() % GENERIC_PROMPTS.length];

          if (!daySnapshot.empty) {
            const dayData = daySnapshot.docs[0].data();
            if (dayData.dailyPrompt) {
              prompt = {
                title: dayData.title || `Day ${currentDayIndex}`,
                description: dayData.dailyPrompt,
              };
            }
          }

          programPromptData = {
            hasEnrollment: true,
            prompt,
            programName: program.name,
            currentDay: currentDayIndex,
            totalDays: program.lengthDays,
          };
        }
      }

      // Process discover recommendation
      interface ArticleData {
        id: string;
        title: string;
        content?: string;
        coverImageUrl?: string;
        category?: string;
        articleType?: string;
        featured?: boolean;
      }

      interface CourseData {
        id: string;
        title: string;
        shortDescription?: string;
        coverImageUrl?: string;
        category?: string;
        featured?: boolean;
      }

      const articles: ArticleData[] = articlesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ArticleData));

      const courses: CourseData[] = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as CourseData));

      // Combine featured content, prioritize featured items
      const featuredArticles = articles.filter(a => a.featured);
      const featuredCourses = courses.filter(c => c.featured);

      // If no featured content, use any content
      const availableArticles = featuredArticles.length > 0 ? featuredArticles : articles;
      const availableCourses = featuredCourses.length > 0 ? featuredCourses : courses;

      // Combine all available content
      const allContent: DiscoverRecommendation[] = [
        ...availableArticles.map(a => ({
          id: a.id,
          type: 'article' as const,
          title: a.title,
          description: a.content?.slice(0, 120)?.replace(/<[^>]*>/g, '') + '...' || 'Read this article',
          coverImageUrl: a.coverImageUrl,
          category: a.category || a.articleType,
        })),
        ...availableCourses.map(c => ({
          id: c.id,
          type: 'course' as const,
          title: c.title,
          description: c.shortDescription || 'Start learning',
          coverImageUrl: c.coverImageUrl,
          category: c.category,
        })),
      ];

      if (allContent.length > 0) {
        // Return a random item (seeded by day for consistency throughout the day)
        const now = new Date();
        const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        const index = dayOfYear % allContent.length;
        discoverRecommendationData = allContent[index];
      }

      return {
        programPrompt: programPromptData,
        discoverRecommendation: discoverRecommendationData,
      };
    })();

    const carouselCards = await carouselCardsPromise;

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

      // Carousel cards data (program prompt + discover recommendation)
      carouselCards,

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
