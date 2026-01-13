'use client';

import { useEffect } from 'react';

/**
 * Error boundary for SSO callback page
 * Shows a loading spinner instead of an error - Clerk often recovers from transient errors
 */
export default function SSOCallbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error but don't show it to user - auth often recovers
    console.error('[SSO_CALLBACK_ERROR]', error.message);

    // Try to recover after a brief delay
    const timer = setTimeout(() => {
      reset();
    }, 1000);

    return () => clearTimeout(timer);
  }, [error, reset]);

  return (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-text-secondary/30 border-t-text-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="font-sans text-text-secondary">Completing sign in...</p>
      </div>
    </div>
  );
}
