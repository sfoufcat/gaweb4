/**
 * Coach API: Organization-scoped Single Course Management
 * 
 * GET /api/coach/org-discover/courses/[courseId] - Get course details
 * PATCH /api/coach/org-discover/courses/[courseId] - Update course
 * DELETE /api/coach/org-discover/courses/[courseId] - Delete course
 * 
 * All operations verify the course belongs to the coach's organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
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
    const { organizationId } = await requireCoachWithOrg();
    const { courseId } = await params;

    const courseDoc = await adminDb.collection('courses').doc(courseId).get();

    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const courseData = courseDoc.data();
    
    // Verify course belongs to coach's organization
    if (courseData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const course = {
      id: courseDoc.id,
      ...courseData,
      createdAt: courseData?.createdAt?.toDate?.()?.toISOString?.() || courseData?.createdAt,
      updatedAt: courseData?.updatedAt?.toDate?.()?.toISOString?.() || courseData?.updatedAt,
    };

    return NextResponse.json({ course });
  } catch (error) {
    console.error('[COACH_ORG_COURSE_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { courseId } = await params;
    const body = await request.json();

    // Check if course exists and belongs to organization
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const existingData = courseDoc.data();
    if (existingData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Handle basic fields
    const basicFields = [
      'title', 'coverImageUrl', 'shortDescription', 'category', 'level',
      'track', 'programIds', 'featured', 'trending',
      // Pricing fields
      'priceInCents', 'currency', 'purchaseType', 'isPublic',
      'keyOutcomes', 'features', 'testimonials', 'faqs'
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

    console.log(`[COACH_ORG_COURSE] Updated course ${courseId} in organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Course updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_COURSE_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update course' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { courseId } = await params;

    // Check if course exists and belongs to organization
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const courseData = courseDoc.data();
    if (courseData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    await adminDb.collection('courses').doc(courseId).delete();

    console.log(`[COACH_ORG_COURSE] Deleted course ${courseId} from organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Course deleted successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_COURSE_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 });
  }
}

