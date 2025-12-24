import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import type { FeedReport, FeedReportReason } from '@/types';

const VALID_REASONS: FeedReportReason[] = [
  'spam',
  'harassment',
  'inappropriate',
  'misinformation',
  'other',
];

/**
 * POST /api/feed/[postId]/report
 * Report a post for moderation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Parse body
    const body = await request.json();
    const { reason, details } = body;

    // Validate reason
    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid report reason', validReasons: VALID_REASONS },
        { status: 400 }
      );
    }

    // Check if user already reported this post
    const existingReport = await adminDb
      .collection('feed_reports')
      .where('postId', '==', postId)
      .where('reporterId', '==', userId)
      .limit(1)
      .get();

    if (!existingReport.empty) {
      return NextResponse.json(
        { error: 'You have already reported this post' },
        { status: 409 }
      );
    }

    // Create report
    const now = new Date().toISOString();
    const reportData: Omit<FeedReport, 'id'> = {
      postId,
      reporterId: userId,
      organizationId,
      reason: reason as FeedReportReason,
      details: details?.trim() || undefined,
      status: 'pending',
      createdAt: now,
    };

    const reportRef = await adminDb.collection('feed_reports').add(reportData);

    return NextResponse.json({
      success: true,
      reportId: reportRef.id,
      message: 'Report submitted. Our team will review it shortly.',
    });
  } catch (error) {
    console.error('[FEED_REPORT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}

