import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import type { ProgramWeek, ProgramTaskTemplate, ProgramHabitTemplate, UnifiedEvent, CallSummary, DiscoverArticle } from '@/types';
import type { DiscoverCourse } from '@/types/discover';

/**
 * Weekly content response for client program view
 */
export interface WeeklyContentResponse {
  success: boolean;
  week: {
    weekNumber: number;
    name?: string;
    theme?: string;
    description?: string;
    weeklyPrompt?: string;
    currentFocus?: string[];  // Weekly outcomes
    notes?: string[];         // Coach notes (reminder items)
    manualNotes?: string;     // Coach manual notes
    startDayIndex: number;
    endDayIndex: number;
    calendarStartDate?: string;
    calendarEndDate?: string;
  } | null;
  days: Array<{
    dayIndex: number;
    globalDayIndex: number;
    calendarDate?: string;
    dayName: string;           // "Monday", "Tuesday", etc.
    isToday: boolean;
    isPast: boolean;
    tasks: ProgramTaskTemplate[];
    habits?: ProgramHabitTemplate[];
    // Linked content
    linkedEventIds?: string[];
    linkedArticleIds?: string[];
    linkedDownloadIds?: string[];
    linkedLinkIds?: string[];
    linkedQuestionnaireIds?: string[];
    linkedCourseIds?: string[];
    linkedSummaryIds?: string[];
  }>;
  // Resolved resources for the week
  events: UnifiedEvent[];
  courses: DiscoverCourse[];
  articles: DiscoverArticle[];
  downloads: Array<{ id: string; title: string; fileUrl: string; fileType?: string; }>;
  links: Array<{ id: string; title: string; url: string; description?: string; }>;
  summaries: CallSummary[];
}

/**
 * GET /api/programs/[programId]/weekly-content
 *
 * Get weekly content for the client program view.
 * Returns current week's theme, description, prompt, days with tasks/resources, and outcomes.
 *
 * Query params:
 * - weekNumber (optional): Specific week to fetch. Defaults to current week based on enrollment progress.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params;
    const { searchParams } = new URL(request.url);
    const requestedWeekNumber = searchParams.get('weekNumber');

    // Demo mode response
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoResponse(getDemoWeeklyContent());
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org context
    const organizationId = await getEffectiveOrgId();

    // Verify enrollment
    const enrollmentSnapshot = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'upcoming'])
      .limit(1)
      .get();

    if (enrollmentSnapshot.empty) {
      return NextResponse.json({ error: 'Not enrolled in this program' }, { status: 403 });
    }

    const enrollment = enrollmentSnapshot.docs[0].data();
    const enrollmentId = enrollmentSnapshot.docs[0].id;

    // Get program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data()!;

    // Verify org
    if (organizationId && program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Calculate current day and week
    const startDate = new Date(enrollment.startedAt);
    startDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentDayIndex = Math.max(1, daysSinceStart + 1);

    // Try to get instance-based data first (new system)
    const instanceSnapshot = await adminDb
      .collection('program_instances')
      .where('programId', '==', programId)
      .where('enrollmentId', '==', enrollmentId)
      .where('type', '==', 'individual')
      .limit(1)
      .get();

    let weekData: WeeklyContentResponse['week'] = null;
    let daysData: WeeklyContentResponse['days'] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (!instanceSnapshot.empty) {
      // Use instance data (new system)
      const instance = instanceSnapshot.docs[0].data();
      const weeks = instance.weeks || [];

      // Find current week
      let targetWeek = weeks.find((w: { weekNumber: number; startDayIndex?: number; endDayIndex?: number }) => {
        if (requestedWeekNumber) {
          return w.weekNumber === parseInt(requestedWeekNumber);
        }
        return currentDayIndex >= (w.startDayIndex || 1) && currentDayIndex <= (w.endDayIndex || 999);
      });

      // Fallback to first week if not found
      if (!targetWeek && weeks.length > 0) {
        targetWeek = requestedWeekNumber
          ? weeks.find((w: { weekNumber: number }) => w.weekNumber === parseInt(requestedWeekNumber))
          : weeks[0];
      }

      if (targetWeek) {
        weekData = {
          weekNumber: targetWeek.weekNumber,
          name: targetWeek.name,
          theme: targetWeek.theme,
          description: targetWeek.description,
          weeklyPrompt: targetWeek.weeklyPrompt,
          currentFocus: targetWeek.currentFocus,
          notes: targetWeek.notes,
          manualNotes: targetWeek.manualNotes,
          startDayIndex: targetWeek.startDayIndex || 1,
          endDayIndex: targetWeek.endDayIndex || 7,
          calendarStartDate: targetWeek.calendarStartDate,
          calendarEndDate: targetWeek.calendarEndDate,
        };

        // Process days
        const instanceDays = targetWeek.days || [];
        for (const day of instanceDays) {
          const dayDate = day.calendarDate ? new Date(day.calendarDate) : null;
          const dayOfWeek = dayDate ? dayDate.getDay() : (day.dayIndex - 1) % 7;

          daysData.push({
            dayIndex: day.dayIndex,
            globalDayIndex: day.globalDayIndex || day.dayIndex,
            calendarDate: day.calendarDate,
            dayName: dayNames[dayOfWeek],
            isToday: dayDate ? dayDate.toDateString() === today.toDateString() : day.globalDayIndex === currentDayIndex,
            isPast: dayDate ? dayDate < today : day.globalDayIndex < currentDayIndex,
            tasks: day.tasks || [],
            habits: day.habits,
            linkedEventIds: day.linkedEventIds,
            linkedArticleIds: day.linkedArticleIds,
            linkedDownloadIds: day.linkedDownloadIds,
            linkedLinkIds: day.linkedLinkIds,
            linkedQuestionnaireIds: day.linkedQuestionnaireIds,
            linkedCourseIds: targetWeek.linkedCourseIds,
            linkedSummaryIds: day.linkedSummaryIds,
          });
        }
      }
    } else {
      // Fallback to template-based data (legacy system)
      const weeks = program.weeks || [];

      // Find current week
      let targetWeek = weeks.find((w: ProgramWeek) => {
        if (requestedWeekNumber) {
          return w.weekNumber === parseInt(requestedWeekNumber);
        }
        return currentDayIndex >= w.startDayIndex && currentDayIndex <= w.endDayIndex;
      });

      if (!targetWeek && weeks.length > 0) {
        targetWeek = requestedWeekNumber
          ? weeks.find((w: ProgramWeek) => w.weekNumber === parseInt(requestedWeekNumber))
          : weeks[0];
      }

      if (targetWeek) {
        weekData = {
          weekNumber: targetWeek.weekNumber,
          name: targetWeek.name,
          theme: targetWeek.theme,
          description: targetWeek.description,
          weeklyPrompt: targetWeek.weeklyPrompt,
          currentFocus: targetWeek.currentFocus,
          notes: targetWeek.notes,
          manualNotes: targetWeek.manualNotes,
          startDayIndex: targetWeek.startDayIndex,
          endDayIndex: targetWeek.endDayIndex,
        };

        // Generate days from week range
        const daysInWeek = targetWeek.endDayIndex - targetWeek.startDayIndex + 1;
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(weekStartDate.getDate() + targetWeek.startDayIndex - 1);

        for (let i = 0; i < daysInWeek; i++) {
          const globalDayIndex = targetWeek.startDayIndex + i;
          const dayDate = new Date(weekStartDate);
          dayDate.setDate(dayDate.getDate() + i);
          const dayOfWeek = dayDate.getDay();

          // Distribute tasks based on distribution setting
          let dayTasks: ProgramTaskTemplate[] = [];
          const distribution = targetWeek.distribution || 'repeat-daily';

          if (distribution === 'repeat-daily') {
            dayTasks = targetWeek.weeklyTasks || [];
          } else if (distribution === 'spread') {
            // Spread tasks across days
            const allTasks = targetWeek.weeklyTasks || [];
            const tasksPerDay = Math.ceil(allTasks.length / daysInWeek);
            const startIdx = i * tasksPerDay;
            dayTasks = allTasks.slice(startIdx, startIdx + tasksPerDay);
          }

          daysData.push({
            dayIndex: i + 1,
            globalDayIndex,
            calendarDate: dayDate.toISOString().split('T')[0],
            dayName: dayNames[dayOfWeek],
            isToday: dayDate.toDateString() === today.toDateString(),
            isPast: dayDate < today,
            tasks: dayTasks,
            habits: targetWeek.weeklyHabits,
            linkedEventIds: targetWeek.linkedCallEventIds,
            linkedArticleIds: targetWeek.linkedArticleIds,
            linkedDownloadIds: targetWeek.linkedDownloadIds,
            linkedLinkIds: targetWeek.linkedLinkIds,
            linkedQuestionnaireIds: targetWeek.linkedQuestionnaireIds,
            linkedCourseIds: targetWeek.linkedCourseIds,
            linkedSummaryIds: targetWeek.linkedSummaryIds,
          });
        }
      }
    }

    // Collect all linked resource IDs from the week
    const allLinkedEventIds = new Set<string>();
    const allLinkedArticleIds = new Set<string>();
    const allLinkedDownloadIds = new Set<string>();
    const allLinkedLinkIds = new Set<string>();
    const allLinkedCourseIds = new Set<string>();
    const allLinkedSummaryIds = new Set<string>();

    for (const day of daysData) {
      day.linkedEventIds?.forEach(id => allLinkedEventIds.add(id));
      day.linkedArticleIds?.forEach(id => allLinkedArticleIds.add(id));
      day.linkedDownloadIds?.forEach(id => allLinkedDownloadIds.add(id));
      day.linkedLinkIds?.forEach(id => allLinkedLinkIds.add(id));
      day.linkedCourseIds?.forEach(id => allLinkedCourseIds.add(id));
      day.linkedSummaryIds?.forEach(id => allLinkedSummaryIds.add(id));
    }

    // Fetch linked resources
    const [events, courses, articles, downloads, links, summaries] = await Promise.all([
      fetchDocsByIds<UnifiedEvent>('events', Array.from(allLinkedEventIds)),
      fetchDocsByIds<DiscoverCourse>('courses', Array.from(allLinkedCourseIds)),
      fetchDocsByIds<DiscoverArticle>('articles', Array.from(allLinkedArticleIds)),
      fetchDocsByIds<{ id: string; title: string; fileUrl: string; fileType?: string; }>('downloads', Array.from(allLinkedDownloadIds)),
      fetchDocsByIds<{ id: string; title: string; url: string; description?: string; }>('links', Array.from(allLinkedLinkIds)),
      fetchDocsByIds<CallSummary>('call_summaries', Array.from(allLinkedSummaryIds)),
    ]);

    return NextResponse.json({
      success: true,
      week: weekData,
      days: daysData,
      events,
      courses,
      articles,
      downloads,
      links,
      summaries,
    } as WeeklyContentResponse);

  } catch (error) {
    console.error('[WEEKLY_CONTENT] Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

// Helper to fetch documents by IDs
async function fetchDocsByIds<T>(collection: string, ids: string[]): Promise<T[]> {
  if (ids.length === 0) return [];

  const results: T[] = [];
  const batchSize = 30; // Firestore 'in' query limit

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const snapshot = await adminDb.collection(collection).where('__name__', 'in', batch).get();
    snapshot.docs.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() } as T);
    });
  }

  return results;
}

// Demo data for weekly content
function getDemoWeeklyContent(): WeeklyContentResponse {
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    success: true,
    week: {
      weekNumber: 2,
      name: 'Week 2: Building Momentum',
      theme: 'Establishing Your Routine',
      description: 'This week we focus on creating sustainable habits and building the daily routines that will support your long-term success.',
      weeklyPrompt: 'What does your ideal morning routine look like, and what\'s one small step you can take to move closer to it?',
      currentFocus: [
        'Complete daily morning reflection',
        'Track your habits consistently',
        'Connect with your accountability partner',
      ],
      notes: [
        'Remember to celebrate small wins',
        'Focus on progress, not perfection',
        'Reach out if you need support',
      ],
      manualNotes: 'Great progress last week! This week, focus on consistency over intensity. The goal is to make these habits automatic.',
      startDayIndex: 8,
      endDayIndex: 14,
    },
    days: Array.from({ length: 5 }, (_, i) => {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - today.getDay() + 1 + i); // Start from Monday

      return {
        dayIndex: i + 1,
        globalDayIndex: 8 + i,
        calendarDate: dayDate.toISOString().split('T')[0],
        dayName: dayNames[dayDate.getDay()],
        isToday: dayDate.toDateString() === today.toDateString(),
        isPast: dayDate < today,
        tasks: [
          { id: `task-${i}-1`, label: 'Morning reflection', isPrimary: true, type: 'task' as const },
          { id: `task-${i}-2`, label: 'Complete daily lesson', isPrimary: false, type: 'learning' as const },
          { id: `task-${i}-3`, label: 'Evening journaling', isPrimary: false, type: 'task' as const },
        ],
        linkedEventIds: i === 2 ? ['demo-event-1'] : [],
        linkedArticleIds: i === 0 ? ['demo-article-1'] : [],
        linkedCourseIds: i === 1 ? ['demo-course-1'] : [],
      };
    }),
    events: [{
      id: 'demo-event-1',
      title: 'Weekly Group Call',
      description: 'Join us for Q&A and progress check-in',
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      startTime: '10:00',
      endTime: '11:00',
      organizationId: 'demo-org',
    }] as UnifiedEvent[],
    courses: [{
      id: 'demo-course-1',
      title: 'Habit Formation Fundamentals',
      shortDescription: 'Learn the science of building lasting habits',
      coverImageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
      category: 'Mindset',
      organizationId: 'demo-org',
    }] as DiscoverCourse[],
    articles: [{
      id: 'demo-article-1',
      title: 'The Power of Morning Routines',
      coverImageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
      authorName: 'Coach Adam',
      readingTimeMinutes: 5,
      organizationId: 'demo-org',
    }] as DiscoverArticle[],
    downloads: [],
    links: [],
    summaries: [],
  };
}
