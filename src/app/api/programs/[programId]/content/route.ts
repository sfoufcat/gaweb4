import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { DiscoverCourse, DiscoverArticle, DiscoverEvent } from '@/types/discover';

/**
 * GET /api/programs/[programId]/content
 * 
 * Get program-specific content (courses, articles, events, links, downloads).
 * Content is scoped to the program via programIds array field.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { userId } = await auth();
    const { programId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();

    // Verify user is enrolled in this program
    const enrollmentSnapshot = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'upcoming'])
      .limit(1)
      .get();

    if (enrollmentSnapshot.empty) {
      return NextResponse.json({ error: 'Not enrolled in this program' }, { status: 403 });
    }

    // Get program to verify organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data();
    const programOrgId = program?.organizationId;
    
    // Verify program belongs to current tenant
    if (organizationId && programOrgId !== organizationId) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Fetch courses associated with this program
    const coursesSnapshot = await adminDb
      .collection('discover_courses')
      .where('programIds', 'array-contains', programId)
      .get();

    const courses: DiscoverCourse[] = coursesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as DiscoverCourse[];

    // Fetch articles associated with this program
    const articlesSnapshot = await adminDb
      .collection('discover_articles')
      .where('programIds', 'array-contains', programId)
      .get();

    const articles: DiscoverArticle[] = articlesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as DiscoverArticle[];

    // Fetch events associated with this program (upcoming only)
    const now = new Date().toISOString().split('T')[0];
    const eventsSnapshot = await adminDb
      .collection('discover_events')
      .where('programIds', 'array-contains', programId)
      .where('date', '>=', now)
      .orderBy('date', 'asc')
      .limit(10)
      .get();

    const events: DiscoverEvent[] = eventsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as DiscoverEvent[];

    // Fetch program-specific links
    const linksSnapshot = await adminDb
      .collection('program_links')
      .where('programId', '==', programId)
      .orderBy('order', 'asc')
      .get();

    const links = linksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Fetch program-specific downloads
    const downloadsSnapshot = await adminDb
      .collection('program_downloads')
      .where('programId', '==', programId)
      .orderBy('order', 'asc')
      .get();

    const downloads = downloadsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Fetch program days (for 3-day focus)
    // Get the user's enrollment to determine current day
    const enrollment = enrollmentSnapshot.docs[0].data();
    const startDate = new Date(enrollment.startedAt);
    startDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentDayIndex = Math.max(1, daysSinceStart + 1);
    
    // Fetch days for today, tomorrow, and day after
    const dayIndices = [currentDayIndex, currentDayIndex + 1, currentDayIndex + 2];
    const daysSnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .where('dayIndex', 'in', dayIndices)
      .get();

    const days = daysSnapshot.docs.map(doc => ({
      dayIndex: doc.data().dayIndex,
      tasks: doc.data().tasks || [],
    }));

    return NextResponse.json({
      success: true,
      courses,
      articles,
      events,
      links,
      downloads,
      days,
    });
  } catch (error) {
    console.error('[API_PROGRAM_CONTENT_GET_ERROR]', error);
    
    // Handle Firestore index errors gracefully
    if (error instanceof Error && error.message.includes('index')) {
      // Return empty arrays if indexes aren't set up yet
      return NextResponse.json({
        success: true,
        courses: [],
        articles: [],
        events: [],
        links: [],
        downloads: [],
        days: [],
      });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

