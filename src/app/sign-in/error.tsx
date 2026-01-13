'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Error boundary for sign-in pages
 * Shows a graceful error message instead of "Application Error"
 */
export default function SignInError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SIGN_IN_ERROR]', error.message);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="font-albert text-2xl text-text-primary mb-3">
          Something went wrong
        </h1>
        <p className="font-sans text-text-secondary mb-8">
          We encountered an issue during sign in. Please try again.
        </p>

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-[#2c2520] hover:bg-[#1a1512] text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Try Again
          </button>

          <Link
            href="/"
            className="block w-full py-3 px-6 rounded-full font-sans font-medium text-text-secondary hover:text-text-primary transition-colors border border-[#e1ddd8] dark:border-border-subtle"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
