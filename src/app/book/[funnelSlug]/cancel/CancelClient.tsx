'use client';

import React, { useState } from 'react';
import { AlertTriangle, Calendar, Clock, Loader2, XCircle, CheckCircle } from 'lucide-react';

interface CancelClientProps {
  tokenId?: string;
  event?: {
    id: string;
    title: string;
    startDateTime: string;
    timezone: string;
    durationMinutes?: number;
  };
  config?: {
    id: string;
    name: string;
    slug: string;
    cancelDeadlineHours?: number;
  };
  organization?: {
    name: string;
    logoUrl?: string;
    plan?: 'starter' | 'pro' | 'scale';
  };
  coach?: {
    name: string;
    email?: string;
  };
  deadline?: {
    canMakeChanges: boolean;
    deadlineTime: string;
    cancelDeadlineHours: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

function formatDateTime(dateString: string, timezone: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short',
  });
}

export function CancelClient({
  tokenId,
  event,
  config,
  organization,
  coach,
  deadline,
  error,
}: CancelClientProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#1d222b] rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
            {error.code === 'NO_TOKEN' ? 'Invalid Link' : 'Error'}
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {error.message || 'Something went wrong. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (isCancelled) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#1d222b] rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
            Appointment Cancelled
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Your appointment has been successfully cancelled. You will receive a confirmation email shortly.
          </p>
        </div>
      </div>
    );
  }

  // Deadline passed
  if (deadline && !deadline.canMakeChanges) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#1d222b] rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
            Cancellation Deadline Passed
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
            The cancellation window for this appointment has closed (
            {deadline.cancelDeadlineHours} hours before the appointment).
          </p>
          {coach?.email && (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Please contact {coach.name} at{' '}
              <a href={`mailto:${coach.email}`} className="text-brand-accent hover:underline">
                {coach.email}
              </a>{' '}
              if you need to make changes.
            </p>
          )}
        </div>
      </div>
    );
  }

  const handleCancel = async () => {
    if (!tokenId) return;

    setIsSubmitting(true);
    setCancelError(null);

    try {
      const response = await fetch(`/api/public/intake/token/${tokenId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel appointment');
      }

      setIsCancelled(true);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#1d222b] rounded-2xl shadow-sm overflow-hidden">
        {/* Header with org branding - centered */}
        <div className="p-6 border-b border-[#e5e5e5] dark:border-[#2d333b] flex justify-center">
          {organization?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logoUrl}
              alt={organization?.name || coach?.name || 'Coach'}
              className="h-8 object-contain"
            />
          ) : (
            <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {organization?.name || coach?.name || 'your coach'}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
            Cancel Appointment
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6">
            Are you sure you want to cancel your {config?.name}?
          </p>

          {/* Appointment details */}
          {event && (
            <div className="bg-app-bg rounded-xl p-4 mb-6">
              <h3 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                {event.title}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2]">
                  <Calendar className="w-4 h-4" />
                  <span className="font-albert text-sm">
                    {formatDateTime(event.startDateTime, event.timezone)}
                  </span>
                </div>
                {event.durationMinutes && (
                  <div className="flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2]">
                    <Clock className="w-4 h-4" />
                    <span className="font-albert text-sm">{event.durationMinutes} minutes</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reason input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              Reason for cancellation (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#e5e5e5] dark:border-[#2d333b] bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/30 resize-none"
              rows={3}
              placeholder="Let us know why you're cancelling..."
            />
          </div>

          {/* Error message */}
          {cancelError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-albert">
              {cancelError}
            </div>
          )}

          {/* Actions */}
          <div>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-xl bg-red-500 text-white font-albert font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Appointment'
              )}
            </button>
          </div>

          {/* Powered by - only show for starter plans */}
          {organization?.plan === 'starter' && (
            <div className="mt-6 text-center">
              <p className="text-xs text-[#a7a39e] dark:text-[#6b7280]">
                Powered by Coachful
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
