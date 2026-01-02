/**
 * API Route: Get Discover Courses
 * 
 * GET /api/discover/courses - Get all courses
 * 
 * Multi-tenancy: If user belongs to an organization, only show org's courses.
 * Otherwise, show all courses (default GA experience).
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateDemoDiscoverContent } from '@/lib/demo-data';

export async function GET() {
  try {
    // Demo mode: return demo courses
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const demoContent = generateDemoDiscoverContent();
      const demoCourses = demoContent.filter(c => c.type === 'course').map(c => ({
        id: c.id,
        organizationId: 'demo-org',
        title: c.title,
        shortDescription: c.shortDescription || c.description,
        longDescription: c.description,
        coverImageUrl: c.imageUrl,
        isPublished: c.isPublished,
        isPremium: c.isPremium,
        priceInCents: c.priceInCents || 0,
        currency: c.currency || 'usd',
        category: c.category || 'General',
        level: c.level || 'All Levels',
        purchaseType: c.purchaseType || 'popup',
        keyOutcomes: c.keyOutcomes,
        features: c.features,
        testimonials: c.testimonials,
        faqs: c.faqs,
        coachName: c.author,
        coachImageUrl: c.authorImageUrl,
        totalLessons: 8,
        totalDurationMinutes: 150,
        modules: [
          {
            id: 'mod-1',
            title: 'Getting Started',
            lessons: [
              { id: 'l-1', title: 'Welcome & Overview', durationMinutes: 10 },
              { id: 'l-2', title: 'Setting Your Foundation', durationMinutes: 15 },
            ],
          },
          {
            id: 'mod-2',
            title: 'Core Framework',
            lessons: [
              { id: 'l-3', title: 'Defining Your Vision', durationMinutes: 20 },
              { id: 'l-4', title: 'Breaking Down Goals', durationMinutes: 18 },
              { id: 'l-5', title: 'Creating Action Plans', durationMinutes: 22 },
            ],
          },
          {
            id: 'mod-3',
            title: 'Implementation',
            lessons: [
              { id: 'l-6', title: 'Tracking Progress', durationMinutes: 15 },
              { id: 'l-7', title: 'Overcoming Obstacles', durationMinutes: 25 },
              { id: 'l-8', title: 'Celebrating & Iterating', durationMinutes: 25 },
            ],
          },
        ],
        createdAt: c.publishedAt,
        updatedAt: c.publishedAt,
      }));
      return demoResponse({ courses: demoCourses });
    }
    
    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    
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











