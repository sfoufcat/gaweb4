/**
 * Coach API: Organization-scoped Courses Management
 * 
 * GET /api/coach/org-discover/courses - List courses in coach's organization
 * POST /api/coach/org-discover/courses - Create new course in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

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
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_COURSES] Fetching courses for organization: ${organizationId}`);

    const coursesSnapshot = await adminDb
      .collection('courses')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .get();

    const courses = coursesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ 
      courses,
      totalCount: courses.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_COURSES_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
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

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['title', 'coverImageUrl', 'shortDescription', 'category', 'level'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate track if provided
    const validTracks = ['content_creator', 'saas', 'coach_consultant', 'ecom', 'agency', 'community_builder', 'general'];
    if (body.track && !validTracks.includes(body.track)) {
      return NextResponse.json(
        { error: `Invalid track. Must be one of: ${validTracks.join(', ')}` },
        { status: 400 }
      );
    }

    // Process modules with IDs
    const modules = (body.modules || []).map((module: CourseModule, mIndex: number) => ({
      ...module,
      id: module.id || `module-${Date.now()}-${mIndex}`,
      order: module.order ?? mIndex + 1,
      lessons: (module.lessons || []).map((lesson: CourseLesson, lIndex: number) => ({
        ...lesson,
        id: lesson.id || `lesson-${Date.now()}-${mIndex}-${lIndex}`,
        order: lesson.order ?? lIndex + 1,
      })),
    }));

    // Compute totals
    const totals = computeCourseTotals(modules);

    const courseData = {
      title: body.title,
      coverImageUrl: body.coverImageUrl,
      shortDescription: body.shortDescription,
      category: body.category,
      level: body.level,
      modules,
      track: body.track || null,
      featured: body.featured || false,
      trending: body.trending || false,
      organizationId, // Scope to coach's organization
      ...totals,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('courses').add(courseData);

    console.log(`[COACH_ORG_COURSES] Created course ${docRef.id} in organization ${organizationId}`);

    return NextResponse.json({
      id: docRef.id,
      ...courseData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_ORG_COURSES_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 });
  }
}

