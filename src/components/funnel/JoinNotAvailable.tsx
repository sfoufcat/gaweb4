'use client';

import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

interface JoinNotAvailableProps {
  /** Coach/organization name to display */
  coachName?: string;
  /** Type of resource that wasn't found */
  type?: 'program' | 'funnel' | 'squad';
}

/**
 * JoinNotAvailable Component
 *
 * Shown when a join/invite link fails due to:
 * - Program not found or inactive
 * - Funnel not found or inactive
 * - Squad not found or inactive
 * - Wrong organization/subdomain
 *
 * Design goals:
 * - Non-alarming, friendly message
 * - Suggests contacting coach for new link
 * - Minimal branding
 */
export function JoinNotAvailable({ coachName, type = 'program' }: JoinNotAvailableProps) {
  const displayName = coachName || 'your coach';

  const typeLabel = type === 'squad' ? 'group' : 'program';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#faf8f6] to-[#f5f2ef] dark:from-[#05070b] dark:to-[#0a0d12] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          This link isn&apos;t working
        </h1>

        {/* Description */}
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
          The {typeLabel} or signup page may have been updated or is no longer available.
        </p>

        <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-8">
          Please contact {displayName} for a new link.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          {/* Try again */}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-medium rounded-xl transition-colors font-albert"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>

          {/* Go back */}
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 w-full px-6 py-3 border border-[#e1ddd8] dark:border-[#262b35] hover:bg-white dark:hover:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium rounded-xl transition-colors font-albert"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        {/* Help text */}
        <p className="mt-8 text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
          If you believe this is an error, please reach out to {displayName}.
        </p>
      </div>
    </div>
  );
}

export default JoinNotAvailable;
