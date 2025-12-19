/**
 * API Route: Get Single Course
 * 
 * GET /api/discover/courses/[id] - Get course by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const courseDoc = await adminDb.collection('courses').doc(id).get();
    
    if (!courseDoc.exists) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
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
    console.error('[DISCOVER_COURSE_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course' },
      { status: 500 }
    );
  }
}











