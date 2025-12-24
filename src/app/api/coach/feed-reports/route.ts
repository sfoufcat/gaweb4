import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import type { FeedReport, FeedReportStatus, FeedReportResolution } from '@/types';

/**
 * GET /api/coach/feed-reports
 * Get feed reports for the coach's organization
 */
export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as FeedReportStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query
    let query = adminDb
      .collection('feed_reports')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    // Filter by status if provided
    if (status) {
      query = adminDb
        .collection('feed_reports')
        .where('organizationId', '==', organizationId)
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }

    const snapshot = await query.get();

    // Get reports with user data
    const reports: (FeedReport & { 
      reporter?: { firstName: string; lastName: string; imageUrl?: string };
    })[] = [];

    const reporterIds = new Set<string>();
    const reportsData: FeedReport[] = [];

    snapshot.forEach((doc) => {
      const report = { id: doc.id, ...doc.data() } as FeedReport;
      reportsData.push(report);
      reporterIds.add(report.reporterId);
    });

    // Fetch reporter data in batch
    const reporterDocs = await Promise.all(
      Array.from(reporterIds).map((id) => 
        adminDb.collection('users').doc(id).get()
      )
    );

    const reportersMap = new Map<string, { firstName: string; lastName: string; imageUrl?: string }>();
    reporterDocs.forEach((doc) => {
      if (doc.exists) {
        const data = doc.data();
        reportersMap.set(doc.id, {
          firstName: data?.firstName || 'Unknown',
          lastName: data?.lastName || '',
          imageUrl: data?.avatarUrl || data?.imageUrl,
        });
      }
    });

    // Combine reports with reporter data
    for (const report of reportsData) {
      reports.push({
        ...report,
        reporter: reportersMap.get(report.reporterId),
      });
    }

    // Get counts by status
    const pendingQuery = await adminDb
      .collection('feed_reports')
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'pending')
      .count()
      .get();

    const reviewedQuery = await adminDb
      .collection('feed_reports')
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'reviewed')
      .count()
      .get();

    return NextResponse.json({
      reports,
      counts: {
        pending: pendingQuery.data().count,
        reviewed: reviewedQuery.data().count,
        total: reports.length,
      },
    });
  } catch (error) {
    console.error('[FEED_REPORTS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch reports';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/feed-reports
 * Update a report (review, dismiss, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    const { reportId, action, resolution } = body;

    if (!reportId || !action) {
      return NextResponse.json(
        { error: 'reportId and action are required' },
        { status: 400 }
      );
    }

    // Get the report
    const reportRef = adminDb.collection('feed_reports').doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const report = reportDoc.data() as FeedReport;

    // Verify report belongs to this org
    if (report.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const now = new Date().toISOString();
    let updateData: Partial<FeedReport>;

    switch (action) {
      case 'review':
        // Mark as reviewed with resolution
        if (!resolution) {
          return NextResponse.json(
            { error: 'resolution is required for review action' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'reviewed' as FeedReportStatus,
          reviewedBy: userId,
          reviewedAt: now,
          resolution: resolution as FeedReportResolution,
        };
        break;

      case 'dismiss':
        // Dismiss without action
        updateData = {
          status: 'dismissed' as FeedReportStatus,
          reviewedBy: userId,
          reviewedAt: now,
          resolution: 'no_action' as FeedReportResolution,
        };
        break;

      case 'reopen':
        // Reopen a previously reviewed report
        updateData = {
          status: 'pending' as FeedReportStatus,
          reviewedBy: undefined,
          reviewedAt: undefined,
          resolution: undefined,
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Valid: review, dismiss, reopen' },
          { status: 400 }
        );
    }

    await reportRef.update(updateData);

    return NextResponse.json({
      success: true,
      report: { ...report, id: reportId, ...updateData },
    });
  } catch (error) {
    console.error('[FEED_REPORTS_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update report';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

