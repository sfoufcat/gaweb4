'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { useBrandingValues } from '@/contexts/BrandingContext';
import type { FeedReport, FeedReportReason, FeedReportStatus, FeedReportResolution } from '@/types';

interface ReportWithUser extends FeedReport {
  reporter?: {
    firstName: string;
    lastName: string;
    imageUrl?: string;
  };
}

interface ReportCounts {
  pending: number;
  reviewed: number;
  total: number;
}

const REASON_LABELS: Record<FeedReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate: 'Inappropriate Content',
  misinformation: 'Misinformation',
  other: 'Other',
};

const RESOLUTION_LABELS: Record<FeedReportResolution, string> = {
  content_removed: 'Content Removed',
  user_warned: 'User Warned',
  no_action: 'No Action Taken',
};

/**
 * FeedModerationTab - Coach moderation panel for feed reports
 * 
 * Features:
 * - View pending and reviewed reports
 * - Take action on reports (delete post, warn user, dismiss)
 * - Filter by status
 */
export function FeedModerationTab() {
  const { colors, isDefault } = useBrandingValues();
  const accentColor = colors.accentLight || 'var(--brand-accent-light)';

  const [reports, setReports] = useState<ReportWithUser[]>([]);
  const [counts, setCounts] = useState<ReportCounts>({ pending: 0, reviewed: 0, total: 0 });
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportWithUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const statusParam = filter === 'all' ? '' : `?status=${filter}`;
      const response = await fetch(`/api/coach/feed-reports${statusParam}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch reports');
      }

      const data = await response.json();
      setReports(data.reports || []);
      setCounts(data.counts || { pending: 0, reviewed: 0, total: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reports');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Handle action on report
  const handleAction = useCallback(async (
    reportId: string,
    action: 'review' | 'dismiss' | 'reopen',
    resolution?: FeedReportResolution
  ) => {
    setActionLoading(reportId);

    try {
      const response = await fetch('/api/coach/feed-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, action, resolution }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update report');
      }

      // Refresh reports
      await fetchReports();
      setSelectedReport(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update report');
    } finally {
      setActionLoading(null);
    }
  }, [fetchReports]);

  // Delete the reported post
  const handleDeletePost = useCallback(async (postId: string, reportId: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    setActionLoading(reportId);

    try {
      // Delete the post
      const deleteResponse = await fetch(`/api/feed/${postId}`, {
        method: 'DELETE',
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete post');
      }

      // Mark report as reviewed with content_removed
      await handleAction(reportId, 'review', 'content_removed');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete post');
      setActionLoading(null);
    }
  }, [handleAction]);

  // Filter badge color
  const getBadgeColor = (status: FeedReportStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'reviewed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'dismissed':
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#faf8f6]">
            Feed Moderation
          </h2>
          <p className="text-[14px] text-[#8a857f] mt-1">
            Review and moderate reported content
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-[#f5f3f0] dark:bg-[#1a1f2a] rounded-lg p-1">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-md text-[14px] font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#faf8f6] shadow-sm'
                : 'text-[#8a857f] hover:text-[#5f5a55]'
            }`}
          >
            Pending ({counts.pending})
          </button>
          <button
            onClick={() => setFilter('reviewed')}
            className={`px-4 py-2 rounded-md text-[14px] font-medium transition-colors ${
              filter === 'reviewed'
                ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#faf8f6] shadow-sm'
                : 'text-[#8a857f] hover:text-[#5f5a55]'
            }`}
          >
            Reviewed ({counts.reviewed})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-[14px] font-medium transition-colors ${
              filter === 'all'
                ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#faf8f6] shadow-sm'
                : 'text-[#8a857f] hover:text-[#5f5a55]'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[14px]">
          {error}
          <button
            onClick={fetchReports}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35] animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-4 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                  <div className="w-full h-4 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        // Empty state
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-[#f5f3f0] dark:bg-[#262b35] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#8a857f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#faf8f6] mb-2">
            {filter === 'pending' ? 'No pending reports' : 'No reports found'}
          </h3>
          <p className="text-[14px] text-[#8a857f]">
            {filter === 'pending'
              ? 'All reports have been reviewed. Great job!'
              : 'No content has been reported yet.'}
          </p>
        </div>
      ) : (
        // Reports list
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Reporter info */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] flex-shrink-0">
                    {report.reporter?.imageUrl ? (
                      <Image
                        src={report.reporter.imageUrl}
                        alt="Reporter"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-[#5f5a55]">
                        {(report.reporter?.firstName?.[0] || 'U') + (report.reporter?.lastName?.[0] || '')}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[14px] text-[#1a1a1a] dark:text-[#faf8f6]">
                      {report.reporter?.firstName} {report.reporter?.lastName}
                    </p>
                    <p className="text-[13px] text-[#8a857f]">
                      reported {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Status badge */}
                <span className={`px-2 py-1 rounded-full text-[12px] font-medium ${getBadgeColor(report.status)}`}>
                  {report.status === 'pending' ? 'Pending Review' : 
                   report.status === 'reviewed' ? 'Reviewed' : 'Dismissed'}
                </span>
              </div>

              {/* Report details */}
              <div className="mt-3 pl-13">
                <div className="p-3 rounded-lg bg-[#f5f3f0] dark:bg-[#1a1f2a]">
                  <p className="text-[13px] font-medium text-[#5f5a55] dark:text-[#b5b0ab] mb-1">
                    Reason: {REASON_LABELS[report.reason]}
                  </p>
                  {report.details && (
                    <p className="text-[14px] text-[#1a1a1a] dark:text-[#faf8f6]">
                      {report.details}
                    </p>
                  )}
                </div>

                {/* Resolution info (if reviewed) */}
                {report.resolution && (
                  <p className="mt-2 text-[13px] text-[#8a857f]">
                    Resolution: {RESOLUTION_LABELS[report.resolution]}
                  </p>
                )}
              </div>

              {/* Actions */}
              {report.status === 'pending' && (
                <div className="mt-4 flex items-center gap-2 pl-13">
                  {/* View Post */}
                  <a
                    href={`/feed?post=${report.postId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[13px] font-medium text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#ebe7e2] dark:hover:bg-[#262b35] transition-colors"
                  >
                    View Post
                  </a>

                  {/* Delete Post */}
                  <button
                    onClick={() => handleDeletePost(report.postId, report.id)}
                    disabled={actionLoading === report.id}
                    className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === report.id ? 'Deleting...' : 'Delete Post'}
                  </button>

                  {/* Warn User */}
                  <button
                    onClick={() => handleAction(report.id, 'review', 'user_warned')}
                    disabled={actionLoading === report.id}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-[13px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === report.id ? 'Processing...' : 'Warn User'}
                  </button>

                  {/* Dismiss */}
                  <button
                    onClick={() => handleAction(report.id, 'dismiss')}
                    disabled={actionLoading === report.id}
                    className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[#8a857f] hover:text-[#5f5a55] hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a] transition-colors disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Reopen for reviewed reports */}
              {report.status !== 'pending' && (
                <div className="mt-4 pl-13">
                  <button
                    onClick={() => handleAction(report.id, 'reopen')}
                    disabled={actionLoading === report.id}
                    className="text-[13px] text-[#8a857f] hover:text-[#5f5a55] underline hover:no-underline disabled:opacity-50"
                  >
                    Reopen Report
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

