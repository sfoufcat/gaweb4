'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

/**
 * SSO Callback page - handles OAuth redirect flow
 * This page is required for Google/Apple sign-in to work
 */
export default function SSOCallbackPage() {
  return (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-text-secondary/30 border-t-text-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="font-sans text-text-secondary">Completing sign in...</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}

