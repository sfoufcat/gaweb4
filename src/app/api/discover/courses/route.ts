/**
 * API Route: Get Discover Courses
 * 
 * GET /api/discover/courses - Get all courses
 * 
 * Multi-tenancy: If user belongs to an organization, only show org's courses.
 * Otherwise, show all courses (default GA experience).
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCurrentUserOrganizationId } from '@/lib/clerk-organizations';

export async function GET() {
  try {
    const { userId } = await auth();
    
    // Get user's organization (null if no org = default GA experience)
    const organizationId = userId ? await getCurrentUserOrganizationId() : null;
    
    let query: FirebaseFirestore.Query = adminDb.collection('courses');
    
    if (organizationId) {
      // User belongs to an org - show only their org's content
      query = query.where('organizationId', '==', organizationId);
    }
    // else: no org = show all content (global GA experience)
    
    const coursesSnapshot = await query.get();

    const courses = coursesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    // Sort in memory by createdAt descending
    courses.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());

    return NextResponse.json({ courses });
  } catch (error) {
    console.error('[DISCOVER_COURSES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses', courses: [] },
      { status: 500 }
    );
  }
}











