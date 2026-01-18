/**
 * Content Progress API
 *
 * GET /api/content-progress - Get user's content progress records
 * POST /api/content-progress - Create or update a progress record
 *
 * Query params (GET):
 * - contentType?: 'course' | 'course_module' | 'course_lesson' | 'article'
 * - contentId?: string - Filter by specific content
 * - instanceId?: string - Filter by program instance
 * - status?: 'not_started' | 'in_progress' | 'completed'
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { ContentProgress, ContentProgressType, ContentProgressStatus } from '@/types';

const COLLECTION = 'content_progress';

/**
 * GET /api/content-progress
 * List user's content progress with optional filters
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('contentType') as ContentProgressType | null;
    const contentId = searchParams.get('contentId');
    const instanceId = searchParams.get('instanceId');
    const status = searchParams.get('status') as ContentProgressStatus | null;
    const targetUserId = searchParams.get('userId'); // For coaches to view client progress

    // Start building query
    let query = adminDb
      .collection(COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('userId', '==', targetUserId || userId);

    // Apply filters
    if (contentType) {
      query = query.where('contentType', '==', contentType);
    }
    if (contentId) {
      query = query.where('contentId', '==', contentId);
    }
    if (instanceId) {
      query = query.where('instanceId', '==', instanceId);
    }
    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.orderBy('lastAccessedAt', 'desc').get();

    const progress: ContentProgress[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ContentProgress[];

    return NextResponse.json({
      progress,
      totalCount: progress.length,
    });
  } catch (error) {
    console.error('[CONTENT_PROGRESS] GET Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/content-progress
 * Create or update a progress record (upsert based on userId + contentType + contentId + lessonId)
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
      status,
      progressPercent,
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
        console.warn('[CONTENT_PROGRESS] Instance lookup failed:', err);
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

    // Check for existing record (upsert pattern)
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
      // Update existing record
      const docRef = existingSnapshot.docs[0].ref;
      const existing = existingSnapshot.docs[0].data() as ContentProgress;

      const updates: Partial<ContentProgress> = {
        lastAccessedAt: now,
        updatedAt: now,
      };

      if (status !== undefined) {
        updates.status = status;
        if (status === 'completed' && existing.status !== 'completed') {
          updates.completedAt = now;
          if (!existing.firstCompletedAt) {
            updates.firstCompletedAt = now;
          }
          updates.completionCount = (existing.completionCount || 0) + 1;
        } else if (status === 'in_progress' && existing.status === 'not_started') {
          updates.startedAt = now;
        }
      }

      if (progressPercent !== undefined) {
        updates.progressPercent = progressPercent;
      }

      if (watchProgress !== undefined) {
        updates.watchProgress = watchProgress;
        // Auto-complete at 90% watch progress
        if (watchProgress >= 90 && existing.status !== 'completed') {
          updates.status = 'completed';
          updates.completedAt = now;
          updates.autoCompleted = true;
          if (!existing.firstCompletedAt) {
            updates.firstCompletedAt = now;
          }
          updates.completionCount = (existing.completionCount || 0) + 1;
        }
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

      const updated = { ...existing, ...updates, id: docRef.id };
      return NextResponse.json({ progress: updated, updated: true });
    }

    // Create new record
    const newProgress: Omit<ContentProgress, 'id'> = {
      userId,
      organizationId,
      contentType,
      contentId,
      moduleId: moduleId || undefined,
      lessonId: lessonId || undefined,
      status: status || 'not_started',
      progressPercent: progressPercent || 0,
      watchProgress: watchProgress || 0,
      completionCount: 0,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
      instanceId: instanceId || undefined,
      weekIndex: weekIndex !== undefined ? weekIndex : undefined,
      dayIndex: dayIndex !== undefined ? dayIndex : undefined,
    };

    // Set timestamps based on status
    if (newProgress.status === 'in_progress') {
      newProgress.startedAt = now;
    } else if (newProgress.status === 'completed') {
      newProgress.startedAt = now;
      newProgress.completedAt = now;
      newProgress.firstCompletedAt = now;
      newProgress.completionCount = 1;
    }

    // Handle auto-complete at 90%
    if (watchProgress && watchProgress >= 90) {
      newProgress.status = 'completed';
      newProgress.completedAt = now;
      newProgress.firstCompletedAt = now;
      newProgress.completionCount = 1;
      newProgress.autoCompleted = true;
    }

    const docRef = await adminDb.collection(COLLECTION).add(newProgress);

    return NextResponse.json({
      progress: { ...newProgress, id: docRef.id },
      created: true,
    });
  } catch (error) {
    console.error('[CONTENT_PROGRESS] POST Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
