import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/admin-utils-shared';
import type { UserRole } from '@/types';

// Step order for calculating funnel progression
const STEP_ORDER = [
  'start',
  'workday',
  'obstacles',
  'business-stage',
  'transformation',
  'identity',
  'goal',
  'goal-impact',
  'support-needs',
  'commitment',
  'content-creator', // Content creator quiz (has internal steps tracked separately)
  'analyzing',
  'plan',
  'profile',
  'success',
  'welcome',
  'create-account',
  'complete',
];

// Total steps in the content-creator quiz (for progress display)
const CONTENT_CREATOR_TOTAL_STEPS = 29;

// Human-readable step names
const STEP_LABELS: Record<string, string> = {
  'start': 'Landing Page',
  'workday': 'Workday Style',
  'obstacles': 'Obstacles',
  'business-stage': 'Business Stage',
  'transformation': 'Transformation',
  'identity': 'Identity',
  'goal': 'Goal Setting',
  'goal-impact': 'Goal Impact',
  'support-needs': 'Support Needs',
  'commitment': 'Commitment',
  'content-creator': 'Content Creator Quiz',
  'analyzing': 'Analyzing',
  'plan': 'Plan Selection',
  'profile': 'Profile Info',
  'success': 'Success',
  'welcome': 'Welcome',
  'create-account': 'Create Account',
  'complete': 'Complete',
};

// Human-readable quiz/track labels
const QUIZ_LABELS: Record<string, string> = {
  'content_creator': 'Content Creator',
  'saas': 'SaaS Founder',
  'coach_consultant': 'Coach/Consultant',
  'ecom': 'E-commerce',
  'agency': 'Agency Owner',
  'community_builder': 'Community Builder',
  'general': 'General',
};

interface GuestSession {
  sessionId: string;
  currentStep?: string;
  createdAt?: string;
  updatedAt?: string;
  // Track/Quiz type
  preselectedTrack?: string;
  // User info
  firstName?: string;
  lastName?: string;
  email?: string;
  // Geo tracking
  country?: string;
  // Quiz answers
  workdayStyle?: string;
  peerAccountability?: string;
  businessStage?: string;
  goalImpact?: string[];
  supportNeeds?: string[];
  // Content creator quiz progress & answers
  contentCreatorQuizStep?: number;
  creatorType?: string;
  // Mission & Goal
  mission?: string;
  goal?: string;
  goalTargetDate?: string;
  // Commitment
  accountability?: boolean;
  readyToInvest?: boolean;
  // Plan
  selectedPlan?: string;
  paymentStatus?: string;
}

/**
 * Detect if a session went through the Content Creator quiz
 * Uses multiple indicators since preselectedTrack may not always be set
 */
function isContentCreatorSession(session: GuestSession): boolean {
  return (
    session.preselectedTrack === 'content_creator' ||
    !!session.creatorType ||
    typeof session.contentCreatorQuizStep === 'number' ||
    session.currentStep === 'content-creator'
  );
}

/**
 * Get the effective quiz/track for a session
 * Falls back to detecting Content Creator sessions even without preselectedTrack
 */
function getSessionQuizType(session: GuestSession): string {
  if (session.preselectedTrack) {
    return session.preselectedTrack;
  }
  // Detect Content Creator sessions without explicit preselectedTrack
  if (isContentCreatorSession(session)) {
    return 'content_creator';
  }
  return 'unknown';
}

interface FunnelStep {
  step: string;
  label: string;
  count: number;
  dropOffCount: number;
  dropOffRate: number;
  cumulativeRate: number;
}

/**
 * GET /api/admin/start-flow-analytics
 * Returns funnel analytics and individual session data
 */
export async function GET(req: Request) {
  try {
    // Auth check
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role as UserRole;
    
    if (!isAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('timeRange') || 'all'; // 'today', 'yesterday', '7d', '30d', 'all'
    const quizFilter = searchParams.get('quiz') || 'all'; // Quiz/track filter

    // Calculate date filter
    let dateFilter: Date | null = null;
    let dateFilterEnd: Date | null = null; // For 'yesterday' we need a range
    
    if (timeRange === 'today') {
      dateFilter = new Date();
      dateFilter.setHours(0, 0, 0, 0);
    } else if (timeRange === 'yesterday') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 1);
      dateFilter.setHours(0, 0, 0, 0);
      dateFilterEnd = new Date();
      dateFilterEnd.setHours(0, 0, 0, 0);
    } else if (timeRange === '7d') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 7);
    } else if (timeRange === '30d') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 30);
    }

    // Fetch all guest sessions
    const query = adminDb.collection('guestSessions').orderBy('createdAt', 'desc');
    
    const snapshot = await query.get();
    
    // Process sessions
    let sessions: GuestSession[] = snapshot.docs.map(doc => ({
      sessionId: doc.id,
      ...doc.data(),
    })) as GuestSession[];

    // Apply date filter if specified
    if (dateFilter) {
      sessions = sessions.filter(session => {
        if (!session.createdAt) return false;
        const sessionDate = new Date(session.createdAt);
        // If we have an end date (for 'yesterday'), filter within range
        if (dateFilterEnd) {
          return sessionDate >= dateFilter! && sessionDate < dateFilterEnd;
        }
        return sessionDate >= dateFilter!;
      });
    }

    // Calculate available quizzes from date-filtered sessions (before quiz filter)
    // Uses smart detection to count Content Creator sessions even without preselectedTrack
    const quizCounts: Record<string, number> = {};
    sessions.forEach(session => {
      const quizType = getSessionQuizType(session);
      quizCounts[quizType] = (quizCounts[quizType] || 0) + 1;
    });
    
    // Build availableQuizzes list (only quizzes with at least 1 session)
    const availableQuizzes = Object.entries(quizCounts)
      .filter(([id]) => id !== 'unknown') // Exclude unknown tracks
      .map(([id, count]) => ({
        id,
        label: QUIZ_LABELS[id] || id,
        count,
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending

    // Apply quiz filter if specified
    // Uses smart detection for content_creator to catch sessions without preselectedTrack
    if (quizFilter !== 'all') {
      if (quizFilter === 'content_creator') {
        sessions = sessions.filter(session => isContentCreatorSession(session));
      } else {
        sessions = sessions.filter(session => session.preselectedTrack === quizFilter);
      }
    }

    // Calculate funnel metrics
    const stepCounts: Record<string, number> = {};
    STEP_ORDER.forEach(step => {
      stepCounts[step] = 0;
    });

    // Count sessions at each step (sessions that reached at least this step)
    sessions.forEach(session => {
      const currentStep = session.currentStep || 'start';
      const stepIndex = STEP_ORDER.indexOf(currentStep);
      
      // Count this session for all steps up to and including current step
      for (let i = 0; i <= stepIndex && i < STEP_ORDER.length; i++) {
        stepCounts[STEP_ORDER[i]]++;
      }
    });

    // Build funnel data
    const totalSessions = sessions.length;
    const funnel: FunnelStep[] = STEP_ORDER.map((step, index) => {
      const count = stepCounts[step];
      const previousCount = index > 0 ? stepCounts[STEP_ORDER[index - 1]] : totalSessions;
      const dropOffCount = previousCount - count;
      const dropOffRate = previousCount > 0 ? (dropOffCount / previousCount) * 100 : 0;
      const cumulativeRate = totalSessions > 0 ? (count / totalSessions) * 100 : 0;

      return {
        step,
        label: STEP_LABELS[step] || step,
        count,
        dropOffCount,
        dropOffRate: Math.round(dropOffRate * 10) / 10,
        cumulativeRate: Math.round(cumulativeRate * 10) / 10,
      };
    });

    // Calculate summary stats
    const completedSessions = stepCounts['complete'] || 0;
    const conversionRate = totalSessions > 0 
      ? Math.round((completedSessions / totalSessions) * 1000) / 10 
      : 0;

    // Format individual sessions for the table
    const formattedSessions = sessions.map(session => {
      const currentStep = session.currentStep || 'start';
      const stepIndex = STEP_ORDER.indexOf(currentStep);
      
      // Generate detailed label for content-creator quiz showing progress
      let currentStepLabel = STEP_LABELS[currentStep] || currentStep;
      if (currentStep === 'content-creator' && typeof session.contentCreatorQuizStep === 'number') {
        // Show 1-indexed step number for display (step 0 = Step 1)
        const displayStep = session.contentCreatorQuizStep + 1;
        currentStepLabel = `Creator Quiz (${displayStep}/${CONTENT_CREATOR_TOTAL_STEPS})`;
      }
      
      return {
        sessionId: session.sessionId,
        createdAt: session.createdAt || null,
        updatedAt: session.updatedAt || null,
        currentStep,
        currentStepLabel,
        stepIndex,
        // Content creator quiz progress
        contentCreatorQuizStep: session.contentCreatorQuizStep ?? null,
        // Geo tracking
        country: session.country || null,
        // User info
        firstName: session.firstName || null,
        lastName: session.lastName || null,
        email: session.email || null,
        // Quiz answers
        workdayStyle: session.workdayStyle || null,
        businessStage: session.businessStage || null,
        goalImpact: session.goalImpact || null,
        supportNeeds: session.supportNeeds || null,
        // Mission & Goal
        mission: session.mission || null,
        goal: session.goal || null,
        goalTargetDate: session.goalTargetDate || null,
        // Commitment
        accountability: session.accountability ?? null,
        readyToInvest: session.readyToInvest ?? null,
        // Plan
        selectedPlan: session.selectedPlan || null,
        paymentStatus: session.paymentStatus || null,
      };
    });

    return NextResponse.json({
      summary: {
        totalSessions,
        completedSessions,
        conversionRate,
        timeRange,
        quizFilter,
      },
      funnel,
      sessions: formattedSessions,
      stepOrder: STEP_ORDER,
      stepLabels: STEP_LABELS,
      availableQuizzes,
    });
  } catch (error) {
    console.error('[START_FLOW_ANALYTICS]', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

