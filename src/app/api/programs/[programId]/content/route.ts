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

    console.log(`[PROGRAM_CONTENT] Fetching content for program: ${programId}, user: ${userId}`);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    console.log(`[PROGRAM_CONTENT] Organization context: ${organizationId || 'platform mode'}`);

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

    // Helper to deduplicate results by id
    const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
      const seen = new Set<string>();
      return items.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };

    // Fetch courses associated with this program
    // Query both programIds array (new schema) and programId field (legacy schema)
    const [coursesArraySnapshot, coursesLegacySnapshot] = await Promise.all([
      adminDb
        .collection('courses')
        .where('programIds', 'array-contains', programId)
        .get(),
      adminDb
        .collection('courses')
        .where('programId', '==', programId)
        .get(),
    ]);

    const courses: DiscoverCourse[] = dedupeById([
      ...coursesArraySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
      ...coursesLegacySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
    ]) as DiscoverCourse[];

    // Fetch articles associated with this program
    // Query both programIds array (new schema) and programId field (legacy schema)
    const [articlesArraySnapshot, articlesLegacySnapshot] = await Promise.all([
      adminDb
        .collection('articles')
        .where('programIds', 'array-contains', programId)
        .get(),
      adminDb
        .collection('articles')
        .where('programId', '==', programId)
        .get(),
    ]);

    const articles: DiscoverArticle[] = dedupeById([
      ...articlesArraySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
      ...articlesLegacySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
    ]) as DiscoverArticle[];

    // Fetch events associated with this program (upcoming only)
    // Query both programIds array (new schema) and programId field (legacy schema)
    // Both use simple queries without composite index requirements - filter/sort in memory
    const now = new Date().toISOString().split('T')[0];
    const [eventsArraySnapshot, eventsLegacySnapshot] = await Promise.all([
      // New schema: programIds array - simple query to avoid composite index requirement
      adminDb
        .collection('events')
        .where('programIds', 'array-contains', programId)
        .get(),
      // Legacy schema: programId field - simple query
      adminDb
        .collection('events')
        .where('programId', '==', programId)
        .get(),
    ]);

    // Merge and dedupe events from programIds and programId queries
    let mergedEvents = dedupeById([
      ...eventsArraySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
      ...eventsLegacySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
    ]) as DiscoverEvent[];

    // Query 3: Get events from squads belonging to this program
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('programId', '==', programId)
      .get();

    const squadIds = squadsSnapshot.docs.map(doc => doc.id);
    
    // Fetch events for squads (Firestore 'in' supports max 30 values)
    if (squadIds.length > 0) {
      const batchSize = 30;
      for (let i = 0; i < squadIds.length; i += batchSize) {
        const batch = squadIds.slice(i, i + batchSize);
        const squadEventsSnapshot = await adminDb
          .collection('events')
          .where('squadId', 'in', batch)
          .get();
        
        squadEventsSnapshot.docs.forEach(doc => {
          // Add to mergedEvents if not already present
          if (!mergedEvents.find(e => e.id === doc.id)) {
            mergedEvents.push({
              id: doc.id,
              ...doc.data(),
            } as DiscoverEvent);
          }
        });
      }
    }

    // Filter to upcoming events, sort by date, and limit
    const events: DiscoverEvent[] = mergedEvents
      .filter(e => e.date && e.date >= now)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 10);

    // Fetch program-specific links
    // Query both programIds array (new schema) and programId field (legacy schema)
    const [linksArraySnapshot, linksLegacySnapshot] = await Promise.all([
      adminDb
        .collection('program_links')
        .where('programIds', 'array-contains', programId)
        .orderBy('order', 'asc')
        .get(),
      adminDb
        .collection('program_links')
        .where('programId', '==', programId)
        .orderBy('order', 'asc')
        .get(),
    ]);

    const links = dedupeById([
      ...linksArraySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
      ...linksLegacySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
    ]);

    // Fetch program-specific downloads
    // Query both programIds array (new schema) and programId field (legacy schema)
    const [downloadsArraySnapshot, downloadsLegacySnapshot] = await Promise.all([
      adminDb
        .collection('program_downloads')
        .where('programIds', 'array-contains', programId)
        .orderBy('order', 'asc')
        .get(),
      adminDb
        .collection('program_downloads')
        .where('programId', '==', programId)
        .orderBy('order', 'asc')
        .get(),
    ]);

    const downloads = dedupeById([
      ...downloadsArraySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
      ...downloadsLegacySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
    ]);

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

    console.log(`[PROGRAM_CONTENT] Results for program ${programId}:`, {
      courses: courses.length,
      articles: articles.length,
      events: events.length,
      links: links.length,
      downloads: downloads.length,
      days: days.length,
      squadIds: squadIds.length,
    });

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
    console.error('[PROGRAM_CONTENT] Error:', error);
    
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

