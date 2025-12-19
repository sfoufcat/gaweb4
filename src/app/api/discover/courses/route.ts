/**
 * API Route: Get Discover Courses
 * 
 * GET /api/discover/courses - Get all courses
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
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
    console.error('[DISCOVER_COURSES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses', courses: [] },
      { status: 500 }
    );
  }
}











