/**
 * Admin API: Discover Courses Management
 * 
 * GET /api/admin/discover/courses - List all courses
 * POST /api/admin/discover/courses - Create new course
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

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const coursesSnapshot = await adminDb
      .collection('courses')
      .orderBy('createdAt', 'desc')
      .get();

    const courses = coursesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ courses });
  } catch (error) {
    console.error('[ADMIN_COURSES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['title', 'coverImageUrl', 'shortDescription'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Normalize modules and compute totals
    const modules = normalizeOrders(body.modules || []);
    const { totalModules, totalLessons, totalDurationMinutes } = computeCourseTotals(modules);

    const courseData = {
      title: body.title,
      coverImageUrl: body.coverImageUrl,
      shortDescription: body.shortDescription,
      category: body.category,
      level: body.level,
      track: body.track || null, // Track-specific content (deprecated)
      programIds: Array.isArray(body.programIds) ? body.programIds : [], // New: program association
      featured: body.featured || false,
      trending: body.trending || false,
      modules,
      totalModules,
      totalLessons,
      totalDurationMinutes,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('courses').add(courseData);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      message: 'Course created successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_COURSES_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    );
  }
}



