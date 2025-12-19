'use client';

import { ReactNode } from 'react';

interface CheckInLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function CheckInLayout({ children, showBackButton = false, onBack }: CheckInLayoutProps) {
  return (
    <div className="min-h-screen bg-background-primary">
      <div className="max-w-[550px] mx-auto px-6 pb-32 pt-6">
        {showBackButton && onBack && (
          <button
            onClick={onBack}
            className="mb-4 p-2 -ml-2 hover:bg-earth-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <svg className="w-6 h-6 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

