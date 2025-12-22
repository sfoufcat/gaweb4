/**
 * Admin API: Single Course Management
 * 
 * GET /api/admin/discover/courses/[courseId] - Get course details
 * PATCH /api/admin/discover/courses/[courseId] - Update course
 * DELETE /api/admin/discover/courses/[courseId] - Delete course
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canManageDiscoverContent } from '@/lib/admin-utils-shared';
import { getCurrentUserRole } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

// Types for course modules and lessons
interface CourseLesson {
  id?: string;
  title: string;
  durationMinutes?: number;
  order?: number;
  [key: string]: unknown;
}

interface CourseModule {
  id?: string;
  title: string;
  order?: number;
  lessons?: CourseLesson[];
  [key: string]: unknown;
}

// Helper to compute course totals
function computeCourseTotals(modules: CourseModule[]) {
  const totalModules = modules.length;
  let totalLessons = 0;
  let totalDurationMinutes = 0;

  modules.forEach(module => {
    if (module.lessons && Array.isArray(module.lessons)) {
      totalLessons += module.lessons.length;
      module.lessons.forEach((lesson: CourseLesson) => {
        if (lesson.durationMinutes) {
          totalDurationMinutes += lesson.durationMinutes;
        }
      });
    }
  });

  return { totalModules, totalLessons, totalDurationMinutes };
}

// Helper to normalize module/lesson orders
function normalizeOrders(modules: CourseModule[]) {
  return modules.map((module, moduleIndex) => ({
    ...module,
    order: moduleIndex + 1,
    lessons: (module.lessons || []).map((lesson: CourseLesson, lessonIndex: number) => ({
      ...lesson,
      order: lessonIndex + 1,
    })),
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { courseId } = await params;
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();

    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const courseData = courseDoc.data();
    const course = {
      id: courseDoc.id,
      ...courseData,
      createdAt: courseData?.createdAt?.toDate?.()?.toISOString?.() || courseData?.createdAt,
      updatedAt: courseData?.updatedAt?.toDate?.()?.toISOString?.() || courseData?.updatedAt,
    };

    return NextResponse.json({ course });
  } catch (error) {
    console.error('[ADMIN_COURSE_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { courseId } = await params;
    const body = await request.json();

    // Check if course exists
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Validate track if provided
    const validTracks = ['content_creator', 'saas', 'coach_consultant', 'ecom', 'agency', 'community_builder', 'general'];
    if (body.track && !validTracks.includes(body.track)) {
      return NextResponse.json(
        { error: `Invalid track. Must be one of: ${validTracks.join(', ')}` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Handle basic fields
    const basicFields = [
      'title', 'coverImageUrl', 'shortDescription', 'category', 'level',
      'track', 'programIds', 'featured', 'trending'
    ];

    for (const field of basicFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Handle modules separately - normalize and compute totals
    if (body.modules !== undefined) {
      const modules = normalizeOrders(body.modules || []);
      const { totalModules, totalLessons, totalDurationMinutes } = computeCourseTotals(modules);
      
      updateData.modules = modules;
      updateData.totalModules = totalModules;
      updateData.totalLessons = totalLessons;
      updateData.totalDurationMinutes = totalDurationMinutes;
    }

    await adminDb.collection('courses').doc(courseId).update(updateData);

    return NextResponse.json({ 
      success: true, 
      message: 'Course updated successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_COURSE_PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update course' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { courseId } = await params;

    // Check if course exists
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    await adminDb.collection('courses').doc(courseId).delete();

    return NextResponse.json({ 
      success: true, 
      message: 'Course deleted successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_COURSE_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete course' },
      { status: 500 }
    );
  }
}



