/**
 * Join Callback Page
 * 
 * This page handles the redirect after signup/signin in the funnel flow.
 * It links the flow session to the user, enrolls them in the organization,
 * refreshes the session, and redirects back to the funnel.
 * 
 * IMPORTANT: For existing users who sign in (instead of sign up), this page
 * handles enrolling them in the organization so they can access the tenant domain.
 */

'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useSession } from '@clerk/nextjs';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, isLoaded, isSignedIn } = useAuth();
  const { session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Setting up your account...');

  const flowSessionId = searchParams.get('flowSessionId');

  const linkSessionAndRedirect = useCallback(async () => {
    try {
      setStatus('Linking your account...');
      
      // Link the flow session to this user
      // The API now also enrolls the user in the organization and updates Clerk metadata
      const linkResponse = await fetch('/api/funnel/link-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowSessionId }),
      });

      if (!linkResponse.ok) {
        const errorData = await linkResponse.json();
        throw new Error(errorData.error || 'Failed to link session');
      }

      const linkData = await linkResponse.json();
      
      // If user was enrolled in an organization, refresh the session to get updated claims
      // This is critical for the middleware to recognize the user as a member
      if (linkData.enrolledInOrg && session) {
        setStatus('Updating your access...');
        try {
          // Touch the session to refresh claims with the new organization membership
          // This ensures the middleware will see the updated primaryOrganizationId
          await session.touch();
          console.log('[JoinCallback] Session refreshed after org enrollment');
          
          // Allow time for session propagation across Clerk's infrastructure
          // This prevents race conditions where middleware checks old claims
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (refreshErr) {
          // Non-fatal - continue anyway, the user will be enrolled
          // The next page load should have updated claims
          console.warn('[JoinCallback] Failed to refresh session (non-fatal):', refreshErr);
        }
      }

      setStatus('Redirecting to your program...');

      // Get session details to know where to redirect
      const sessionResponse = await fetch(`/api/funnel/session?sessionId=${flowSessionId}`);
      const sessionData = await sessionResponse.json();

      if (sessionData.session) {
        // Get funnel details
        const funnelResponse = await fetch(`/api/funnel/${sessionData.session.funnelId}`);
        const funnelData = await funnelResponse.json();

        if (funnelData.funnel && funnelData.program) {
          // Redirect back to funnel
          router.replace(`/join/${funnelData.program.slug}/${funnelData.funnel.slug}`);
          return;
        }
      }

      // Fallback to dashboard
      router.replace('/');
    } catch (err) {
      console.error('Failed to link session:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [flowSessionId, session, router]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !userId) {
      // Redirect to sign in
      router.replace('/sign-in');
      return;
    }

    if (!flowSessionId) {
      // No flow session, redirect to dashboard
      router.replace('/');
      return;
    }

    // Link the session and redirect back to funnel
    linkSessionAndRedirect();
  }, [isLoaded, isSignedIn, userId, flowSessionId, linkSessionAndRedirect, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Something went wrong</h2>
          <p className="text-text-secondary mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <div className="text-center">
        <div className="relative mb-4 mx-auto w-fit">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
        <p className="text-text-secondary">{status}</p>
      </div>
    </div>
  );
}

export default function JoinCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-4 mx-auto w-fit">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
          </div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}






