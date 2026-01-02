/**
 * Coach API: Product Analytics
 * 
 * GET /api/coach/analytics/products
 * 
 * Returns product-level analytics for the coach's organization:
 * - Programs with enrollment counts and revenue
 * - Squads with member counts
 * - Content sales (courses, articles, events, downloads, links) with purchaser counts and revenue
 * 
 * Query params:
 *   - type: 'all' | 'programs' | 'squads' | 'content'
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { withDemoMode } from '@/lib/demo-api';
import type { Program, Squad } from '@/types';

interface ProgramAnalytics {
  id: string;
  name: string;
  type: 'group' | 'individual';
  enrolledCount: number;
  activeEnrollments: number;
  completedEnrollments: number;
  totalRevenue: number;
  createdAt: string;
}

interface SquadAnalytics {
  id: string;
  name: string;
  type: 'standalone' | 'program';
  memberCount: number;
  programId?: string;
  programName?: string;
  createdAt: string;
}

interface ContentAnalytics {
  id: string;
  type: 'course' | 'article' | 'event' | 'download' | 'link';
  title: string;
  purchaserCount: number;
  totalRevenue: number;
  priceInCents: number;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('analytics-products');
    if (demoData) return demoData;
    
    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') || 'all';

    const results: {
      programs?: ProgramAnalytics[];
      squads?: SquadAnalytics[];
      content?: ContentAnalytics[];
      summary: {
        totalPrograms: number;
        totalSquads: number;
        totalContentItems: number;
        totalEnrollments: number;
        totalMembers: number;
        totalRevenue: number;
      };
    } = {
      summary: {
        totalPrograms: 0,
        totalSquads: 0,
        totalContentItems: 0,
        totalEnrollments: 0,
        totalMembers: 0,
        totalRevenue: 0,
      },
    };

    // ========================
    // PROGRAMS
    // ========================
    if (typeFilter === 'all' || typeFilter === 'programs') {
      const programsSnapshot = await adminDb
        .collection('programs')
        .where('organizationId', '==', organizationId)
        .get();

      const programs: ProgramAnalytics[] = [];
      let totalEnrollments = 0;
      let totalProgramRevenue = 0;

      for (const doc of programsSnapshot.docs) {
        const program = doc.data() as Program;
        
        // Get enrollment counts
        const enrollmentsSnapshot = await adminDb
          .collection('program_enrollments')
          .where('programId', '==', doc.id)
          .where('organizationId', '==', organizationId)
          .get();

        let activeEnrollments = 0;
        let completedEnrollments = 0;
        let programRevenue = 0;

        for (const enrollDoc of enrollmentsSnapshot.docs) {
          const enrollment = enrollDoc.data();
          if (enrollment.status === 'active') activeEnrollments++;
          if (enrollment.status === 'completed') completedEnrollments++;
          programRevenue += enrollment.amountPaid || 0;
        }

        programs.push({
          id: doc.id,
          name: program.name || 'Untitled Program',
          type: program.type || 'individual',
          enrolledCount: enrollmentsSnapshot.size,
          activeEnrollments,
          completedEnrollments,
          totalRevenue: programRevenue / 100, // Convert cents to dollars
          createdAt: program.createdAt || '',
        });

        totalEnrollments += enrollmentsSnapshot.size;
        totalProgramRevenue += programRevenue;
      }

      // Sort by enrollment count descending
      programs.sort((a, b) => b.enrolledCount - a.enrolledCount);

      results.programs = programs;
      results.summary.totalPrograms = programs.length;
      results.summary.totalEnrollments = totalEnrollments;
      results.summary.totalRevenue += totalProgramRevenue / 100;
    }

    // ========================
    // SQUADS
    // ========================
    if (typeFilter === 'all' || typeFilter === 'squads') {
      // Fetch all squads and filter in memory to avoid != operator requiring composite index
      const squadsSnapshot = await adminDb
        .collection('squads')
        .where('organizationId', '==', organizationId)
        .get();

      // Filter out closed squads in memory
      const openSquadDocs = squadsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.isClosed !== true;
      });

      // Get program names for program squads
      const programIds = new Set<string>();
      for (const doc of openSquadDocs) {
        const squad = doc.data() as Squad;
        if (squad.programId) programIds.add(squad.programId);
      }

      const programMap = new Map<string, string>();
      if (programIds.size > 0) {
        const programDocs = await Promise.all(
          Array.from(programIds).slice(0, 30).map(id => adminDb.collection('programs').doc(id).get())
        );
        for (const doc of programDocs) {
          if (doc.exists) {
            programMap.set(doc.id, doc.data()?.name || 'Unknown Program');
          }
        }
      }

      const squads: SquadAnalytics[] = [];
      let totalMembers = 0;

      for (const doc of openSquadDocs) {
        const squad = doc.data() as Squad;
        const memberCount = squad.memberIds?.length || 0;

        squads.push({
          id: doc.id,
          name: squad.name || 'Unnamed Squad',
          type: squad.programId ? 'program' : 'standalone',
          memberCount,
          programId: squad.programId || undefined,
          programName: squad.programId ? programMap.get(squad.programId) : undefined,
          createdAt: squad.createdAt || '',
        });

        totalMembers += memberCount;
      }

      // Sort by member count descending
      squads.sort((a, b) => b.memberCount - a.memberCount);

      results.squads = squads;
      results.summary.totalSquads = squads.length;
      results.summary.totalMembers = totalMembers;
    }

    // ========================
    // CONTENT (Courses, Articles, Events, Downloads, Links)
    // ========================
    if (typeFilter === 'all' || typeFilter === 'content') {
      const contentItems: ContentAnalytics[] = [];
      let totalContentRevenue = 0;

      // Helper to fetch content from a collection
      const fetchContentType = async (collectionName: string, contentType: ContentAnalytics['type']) => {
        try {
          const snapshot = await adminDb
            .collection(collectionName)
            .where('organizationId', '==', organizationId)
            .where('isPaid', '==', true)
            .get();

          for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Get purchase count and revenue
            const purchasesSnapshot = await adminDb
              .collection('user_content_purchases')
              .where('contentId', '==', doc.id)
              .where('contentType', '==', contentType)
              .where('organizationId', '==', organizationId)
              .get();

            let revenue = 0;
            for (const purchaseDoc of purchasesSnapshot.docs) {
              revenue += purchaseDoc.data().amountPaid || 0;
            }

            contentItems.push({
              id: doc.id,
              type: contentType,
              title: data.title || data.name || 'Untitled',
              purchaserCount: purchasesSnapshot.size,
              totalRevenue: revenue / 100,
              priceInCents: data.priceInCents || 0,
              createdAt: data.createdAt || '',
            });

            totalContentRevenue += revenue;
          }
        } catch (error) {
          console.warn(`[PRODUCT_ANALYTICS] Failed to fetch ${collectionName}:`, error);
        }
      };

      // Fetch all content types
      await Promise.all([
        fetchContentType('discover_courses', 'course'),
        fetchContentType('discover_articles', 'article'),
        fetchContentType('discover_events', 'event'),
        fetchContentType('discover_downloads', 'download'),
        fetchContentType('discover_links', 'link'),
      ]);

      // Sort by revenue descending
      contentItems.sort((a, b) => b.totalRevenue - a.totalRevenue);

      results.content = contentItems;
      results.summary.totalContentItems = contentItems.length;
      results.summary.totalRevenue += totalContentRevenue / 100;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('[COACH_ANALYTICS_PRODUCTS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch product analytics' }, { status: 500 });
  }
}

