// ============================================================================
// PROGRAM INSTANCE CONTENT COMPLETIONS API - Part of 3-Collection Architecture
// ============================================================================
//
// This endpoint aggregates course/article completion data for program instances,
// similar to how /completions works for tasks.
//
// Content progress is tracked via the `content_progress` collection with an
// `instanceId` field linking back to the program_instances document.
//
// For cohort programs, this route aggregates completions across all members
// to calculate completion rates for the coach dashboard.
//
// See CLAUDE.md "Program System Architecture" for full documentation.
// ============================================================================

/**
 * Program Instance Content Completions API
 *
 * GET /api/instances/[instanceId]/content-completions
 *   Returns aggregated content completion data for courses/articles
 *
 * Query params:
 * - contentType: Filter by type ('course', 'course_lesson', 'course_module', 'article')
 * - contentId: Filter by specific content
 * - threshold: Completion threshold percentage (default: 80)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { ProgramInstance, ContentProgress, ContentProgressType } from '@/types';

type RouteParams = { params: Promise<{ instanceId: string }> };

interface ContentCompletionSummary {
  contentType: ContentProgressType;
  contentId: string;
  title: string;
  lessonId?: string;
  totalMembers: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  completionRate: number;
  isThresholdMet: boolean;
  memberBreakdown: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
    status: 'not_started' | 'in_progress' | 'completed';
    progressPercent?: number;
    watchProgress?: number;
    completedAt?: string;
  }>;
}

/**
 * GET /api/instances/[instanceId]/content-completions
 * Returns completion data for all content linked to this instance
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId } = await params;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('contentType') as ContentProgressType | null;
    const contentId = searchParams.get('contentId');
    const threshold = parseInt(searchParams.get('threshold') || '80', 10);

    // Get the instance
    const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();

    if (!instanceDoc.exists) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const instanceData = instanceDoc.data();

    // Verify organization access
    if (instanceData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const instance = instanceData as ProgramInstance;

    // Get members based on instance type
    let memberIds: string[] = [];
    const memberProfiles: Map<string, { firstName: string; lastName: string; imageUrl: string }> = new Map();

    if (instance.type === 'cohort' && instance.cohortId) {
      // Get cohort members from enrollments
      const enrollmentsSnap = await adminDb.collection('program_enrollments')
        .where('cohortId', '==', instance.cohortId)
        .where('status', 'in', ['active', 'completed'])
        .get();

      memberIds = enrollmentsSnap.docs.map(d => d.data().userId);
    } else if (instance.type === 'individual' && instance.userId) {
      memberIds = [instance.userId];
    }

    // Fetch member profiles
    if (memberIds.length > 0) {
      const userDocs = await Promise.all(
        memberIds.slice(0, 100).map(userId =>
          adminDb.collection('users').doc(userId).get()
        )
      );

      for (const userDoc of userDocs) {
        if (userDoc.exists) {
          const userData = userDoc.data();
          memberProfiles.set(userDoc.id, {
            firstName: userData?.firstName || 'Unknown',
            lastName: userData?.lastName || '',
            imageUrl: userData?.imageUrl || '',
          });
        }
      }
    }

    // Get content progress records for this instance
    let progressQuery = adminDb.collection('content_progress')
      .where('instanceId', '==', instanceId);

    if (contentType) {
      progressQuery = progressQuery.where('contentType', '==', contentType);
    }
    if (contentId) {
      progressQuery = progressQuery.where('contentId', '==', contentId);
    }

    const progressSnap = await progressQuery.get();

    // Build progress map: Map<contentKey, Map<userId, ContentProgress>>
    // contentKey = contentType:contentId:lessonId (lessonId optional)
    const progressByContent = new Map<string, Map<string, ContentProgress>>();
    const contentMetadata = new Map<string, { contentType: ContentProgressType; contentId: string; lessonId?: string }>();

    for (const doc of progressSnap.docs) {
      const progress = { id: doc.id, ...doc.data() } as ContentProgress;
      const key = progress.lessonId
        ? `${progress.contentType}:${progress.contentId}:${progress.lessonId}`
        : `${progress.contentType}:${progress.contentId}`;

      if (!progressByContent.has(key)) {
        progressByContent.set(key, new Map());
        contentMetadata.set(key, {
          contentType: progress.contentType,
          contentId: progress.contentId,
          lessonId: progress.lessonId,
        });
      }

      if (progress.userId) {
        progressByContent.get(key)!.set(progress.userId, progress);
      }
    }

    // Also get content assigned to this instance via weeks (for complete picture)
    // This ensures we show content even if no one has started it yet
    for (const week of instance.weeks || []) {
      for (const assignment of week.resourceAssignments || []) {
        if (assignment.resourceType === 'course' || assignment.resourceType === 'article') {
          const assignmentContentType = assignment.resourceType === 'course' ? 'course' : 'article';
          const key = `${assignmentContentType}:${assignment.resourceId}`;

          if (!progressByContent.has(key)) {
            progressByContent.set(key, new Map());
            contentMetadata.set(key, {
              contentType: assignmentContentType as ContentProgressType,
              contentId: assignment.resourceId,
            });
          }
        }
      }

      // Also check legacy courseAssignments
      for (const assignment of week.courseAssignments || []) {
        const key = `course:${assignment.courseId}`;

        if (!progressByContent.has(key)) {
          progressByContent.set(key, new Map());
          contentMetadata.set(key, {
            contentType: 'course',
            contentId: assignment.courseId,
          });
        }
      }
    }

    // Fetch content titles
    const contentTitles = new Map<string, string>();
    const courseIds = new Set<string>();
    const articleIds = new Set<string>();

    for (const metadata of contentMetadata.values()) {
      if (metadata.contentType === 'course' || metadata.contentType === 'course_lesson' || metadata.contentType === 'course_module') {
        courseIds.add(metadata.contentId);
      } else if (metadata.contentType === 'article') {
        articleIds.add(metadata.contentId);
      }
    }

    // Fetch course titles
    for (const courseId of courseIds) {
      try {
        const courseDoc = await adminDb.collection('courses').doc(courseId).get();
        if (courseDoc.exists) {
          contentTitles.set(`course:${courseId}`, courseDoc.data()?.title || 'Untitled Course');
        }
      } catch {
        // Skip if not found
      }
    }

    // Fetch article titles
    for (const articleId of articleIds) {
      try {
        const articleDoc = await adminDb.collection('articles').doc(articleId).get();
        if (articleDoc.exists) {
          contentTitles.set(`article:${articleId}`, articleDoc.data()?.title || 'Untitled Article');
        }
      } catch {
        // Skip if not found
      }
    }

    // Build completion summaries
    const completions: ContentCompletionSummary[] = [];

    for (const [key, userProgress] of progressByContent) {
      const metadata = contentMetadata.get(key)!;
      const titleKey = `${metadata.contentType.replace('_lesson', '').replace('_module', '')}:${metadata.contentId}`;
      const title = contentTitles.get(titleKey) || 'Unknown Content';

      // Build member breakdown
      const memberBreakdown = memberIds.map(userId => {
        const progress = userProgress.get(userId);
        const profile = memberProfiles.get(userId) || { firstName: 'Unknown', lastName: '', imageUrl: '' };

        return {
          userId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          imageUrl: profile.imageUrl,
          status: progress?.status || 'not_started' as const,
          progressPercent: progress?.progressPercent,
          watchProgress: progress?.watchProgress,
          completedAt: progress?.completedAt,
        };
      });

      const completedCount = memberBreakdown.filter(m => m.status === 'completed').length;
      const inProgressCount = memberBreakdown.filter(m => m.status === 'in_progress').length;
      const notStartedCount = memberBreakdown.filter(m => m.status === 'not_started').length;
      const totalMembers = memberBreakdown.length;
      const completionRate = totalMembers > 0 ? Math.round((completedCount / totalMembers) * 100) : 0;

      completions.push({
        contentType: metadata.contentType,
        contentId: metadata.contentId,
        title,
        lessonId: metadata.lessonId,
        totalMembers,
        completedCount,
        inProgressCount,
        notStartedCount,
        completionRate,
        isThresholdMet: completionRate >= threshold,
        memberBreakdown,
      });
    }

    // Sort by content type, then by title
    completions.sort((a, b) => {
      if (a.contentType !== b.contentType) {
        return a.contentType.localeCompare(b.contentType);
      }
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({
      completions,
      totalMembers: memberIds.length,
      threshold,
    });
  } catch (error) {
    console.error('[INSTANCE_CONTENT_COMPLETIONS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch content completions' }, { status: 500 });
  }
}
