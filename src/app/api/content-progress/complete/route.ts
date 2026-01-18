/**
 * Content Progress Complete API
 *
 * POST /api/content-progress/complete
 * Mark content as complete (creates record if needed, increments count if re-completing)
 *
 * This is a convenience endpoint for marking content complete in a single call.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { ContentProgress, ContentProgressType } from '@/types';

const COLLECTION = 'content_progress';

/**
 * POST /api/content-progress/complete
 * Mark content as complete
 *
 * Body:
 * - contentType: 'course' | 'course_module' | 'course_lesson' | 'article' (required)
 * - contentId: string (required)
 * - moduleId?: string (for module/lesson progress)
 * - lessonId?: string (for lesson progress)
 * - watchProgress?: number (0-100, for video content)
 * - instanceId?: string (program instance context)
 * - weekIndex?: number
 * - dayIndex?: number
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    let {
      contentType,
      contentId,
      moduleId,
      lessonId,
      watchProgress,
      instanceId,
      weekIndex,
      dayIndex,
      enrollmentId, // Alternative to instanceId - API will look up instance
    } = body;

    // If enrollmentId provided but no instanceId, look up the instance
    if (enrollmentId && !instanceId) {
      try {
        const instanceSnapshot = await adminDb
          .collection('program_instances')
          .where('enrollmentId', '==', enrollmentId)
          .limit(1)
          .get();

        if (!instanceSnapshot.empty) {
          instanceId = instanceSnapshot.docs[0].id;
        }
      } catch (err) {
        console.warn('[CONTENT_PROGRESS_COMPLETE] Instance lookup failed:', err);
        // Continue without instanceId - progress will still be tracked, just not linked
      }
    }

    // Validation
    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'contentType and contentId are required' },
        { status: 400 }
      );
    }

    const validTypes: ContentProgressType[] = ['course', 'course_module', 'course_lesson', 'article'];
    if (!validTypes.includes(contentType)) {
      return NextResponse.json(
        { error: `Invalid contentType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Check for existing record
    let existingQuery = adminDb
      .collection(COLLECTION)
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('contentType', '==', contentType)
      .where('contentId', '==', contentId);

    // For lessons, also match on lessonId
    if (contentType === 'course_lesson' && lessonId) {
      existingQuery = existingQuery.where('lessonId', '==', lessonId);
    }

    const existingSnapshot = await existingQuery.limit(1).get();

    if (!existingSnapshot.empty) {
      // Update existing record - increment completion count
      const docRef = existingSnapshot.docs[0].ref;
      const existing = existingSnapshot.docs[0].data() as ContentProgress;

      const isRecompletion = existing.status === 'completed';

      const updates: Partial<ContentProgress> = {
        status: 'completed',
        completedAt: now,
        lastAccessedAt: now,
        updatedAt: now,
        manuallyCompleted: true,
      };

      // Track first completion
      if (!existing.firstCompletedAt) {
        updates.firstCompletedAt = now;
      }

      // Increment completion count
      updates.completionCount = (existing.completionCount || 0) + (isRecompletion ? 1 : 1);

      // Update watch progress if provided
      if (watchProgress !== undefined) {
        updates.watchProgress = watchProgress;
      }

      // Update program context fields if provided (and not already set)
      // This allows late binding of progress to a program instance
      if (instanceId !== undefined && !existing.instanceId) {
        updates.instanceId = instanceId;
      }
      if (weekIndex !== undefined && existing.weekIndex === undefined) {
        updates.weekIndex = weekIndex;
      }
      if (dayIndex !== undefined && existing.dayIndex === undefined) {
        updates.dayIndex = dayIndex;
      }

      await docRef.update(updates);

      return NextResponse.json({
        progress: { ...existing, ...updates, id: docRef.id },
        updated: true,
        recompletion: isRecompletion,
        completionCount: updates.completionCount,
      });
    }

    // Create new completed record
    const newProgress: Omit<ContentProgress, 'id'> = {
      userId,
      organizationId,
      contentType,
      contentId,
      moduleId: moduleId || undefined,
      lessonId: lessonId || undefined,
      status: 'completed',
      progressPercent: 100,
      watchProgress: watchProgress || 100,
      completionCount: 1,
      startedAt: now,
      completedAt: now,
      firstCompletedAt: now,
      lastAccessedAt: now,
      manuallyCompleted: true,
      createdAt: now,
      updatedAt: now,
      instanceId: instanceId || undefined,
      weekIndex: weekIndex !== undefined ? weekIndex : undefined,
      dayIndex: dayIndex !== undefined ? dayIndex : undefined,
    };

    const docRef = await adminDb.collection(COLLECTION).add(newProgress);

    return NextResponse.json({
      progress: { ...newProgress, id: docRef.id },
      created: true,
      completionCount: 1,
    });
  } catch (error) {
    console.error('[CONTENT_PROGRESS_COMPLETE] POST Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
