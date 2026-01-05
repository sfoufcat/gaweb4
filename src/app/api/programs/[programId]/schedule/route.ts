/**
 * Program Schedule API
 *
 * GET /api/programs/[programId]/schedule - Fetch aggregated schedule items
 * Combines calls, courses, and tasks into a unified timeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ScheduledItem } from '@/types';

interface ScheduleGroup {
  label: string;
  items: ScheduledItem[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { programId } = await params;
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');

    // Verify user is enrolled in this program
    let enrollmentQuery = adminDb
      .collection('enrollments')
      .where('userId', '==', userId)
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'completed']);

    if (enrollmentId) {
      enrollmentQuery = enrollmentQuery.where('__name__', '==', enrollmentId);
    }

    const enrollmentsSnapshot = await enrollmentQuery.limit(1).get();

    if (enrollmentsSnapshot.empty) {
      return NextResponse.json({ error: 'Not enrolled in this program' }, { status: 403 });
    }

    const enrollment = enrollmentsSnapshot.docs[0].data();
    const enrollmentStartDate = enrollment.startDate
      ? new Date(enrollment.startDate)
      : new Date();

    // Get today's date for grouping
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const scheduleItems: ScheduledItem[] = [];

    // Fetch upcoming scheduled calls (events)
    try {
      const eventsSnapshot = await adminDb
        .collection('events')
        .where('programIds', 'array-contains', programId)
        .where('date', '>=', today.toISOString().split('T')[0])
        .orderBy('date', 'asc')
        .limit(10)
        .get();

      for (const doc of eventsSnapshot.docs) {
        const event = doc.data();
        scheduleItems.push({
          id: doc.id,
          type: 'call',
          eventId: doc.id,
          title: event.title || 'Scheduled Call',
          description: event.description,
          scheduledTime: event.date && event.startTime
            ? `${event.date}T${event.startTime}`
            : event.date,
          estimatedMinutes: event.durationMinutes,
          isRequired: event.isRequired !== false,
          order: scheduleItems.length,
        });
      }
    } catch {
      // Events collection might not have the required index yet
      console.log('[PROGRAM_SCHEDULE] Events query skipped - index may be building');
    }

    // Fetch program days with tasks for upcoming days
    const currentDay = Math.max(
      1,
      Math.ceil((today.getTime() - enrollmentStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    const daysSnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .where('dayIndex', '>=', currentDay)
      .where('dayIndex', '<=', currentDay + 7)
      .orderBy('dayIndex', 'asc')
      .get();

    for (const doc of daysSnapshot.docs) {
      const day = doc.data();
      if (day.scheduledItems && Array.isArray(day.scheduledItems)) {
        for (const item of day.scheduledItems) {
          scheduleItems.push({
            ...item,
            order: scheduleItems.length,
          });
        }
      }
    }

    // Sort all items by scheduled time
    scheduleItems.sort((a, b) => {
      const aTime = a.scheduledTime || a.dueDate || '';
      const bTime = b.scheduledTime || b.dueDate || '';
      return aTime.localeCompare(bTime);
    });

    // Group items
    const groups: ScheduleGroup[] = [
      { label: 'Today', items: [] },
      { label: 'Tomorrow', items: [] },
      { label: 'This Week', items: [] },
      { label: 'Upcoming', items: [] },
    ];

    for (const item of scheduleItems) {
      const itemDate = item.scheduledTime || item.dueDate;
      if (!itemDate) {
        groups[3].items.push(item); // Upcoming
        continue;
      }

      const date = new Date(itemDate);
      date.setHours(0, 0, 0, 0);

      if (date.getTime() === today.getTime()) {
        groups[0].items.push(item); // Today
      } else if (date.getTime() === tomorrow.getTime()) {
        groups[1].items.push(item); // Tomorrow
      } else if (date < weekEnd) {
        groups[2].items.push(item); // This Week
      } else {
        groups[3].items.push(item); // Upcoming
      }
    }

    // Filter out empty groups
    const nonEmptyGroups = groups.filter(g => g.items.length > 0);

    // Count upcoming calls and pending tasks
    const upcomingCallCount = scheduleItems.filter(i => i.type === 'call').length;
    const pendingTaskCount = scheduleItems.filter(i => i.type === 'assignment').length;

    return NextResponse.json({
      scheduleItems,
      groups: nonEmptyGroups,
      upcomingCallCount,
      pendingTaskCount,
    });
  } catch (error) {
    console.error('[PROGRAM_SCHEDULE_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch program schedule' }, { status: 500 });
  }
}
