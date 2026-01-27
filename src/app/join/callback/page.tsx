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

import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useSession, useClerk } from '@clerk/nextjs';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, isLoaded, isSignedIn } = useAuth();
  const { session } = useSession();
  const clerk = useClerk();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Setting up your account...');
  const [authRetryCount, setAuthRetryCount] = useState(0);
  const hasLinkedSession = useRef(false);
  const MAX_AUTH_RETRIES = 6; // Wait 3 seconds before reloading
  const RELOAD_RETRY_COUNT = 6; // After 6 retries (3s), do a hard reload

  const flowSessionId = searchParams.get('flowSessionId');
  const pendingSessionId = searchParams.get('_sessionId'); // Session ID from signup form
  const alreadyReloaded = searchParams.get('_reloaded') === '1';
  const hasReloaded = useRef(alreadyReloaded);
  const hasActivatedSession = useRef(false);

  // Helper to preserve ?tenant= param in redirects (critical for localhost dev)
  const buildRedirectUrl = useCallback((path: string) => {
    const tenant = searchParams.get('tenant');
    return tenant ? `${path}${path.includes('?') ? '&' : '?'}tenant=${tenant}` : path;
  }, [searchParams]);

  const linkSessionAndRedirect = useCallback(async () => {
    try {
      setStatus('Linking your account...');

      // Link the flow session to this user
      // The API now also enrolls the user in the organization and updates Clerk metadata
      // Pass clerkSessionId as backup for localhost where server-side auth() may fail
      // Use session?.id first, fall back to pendingSessionId from URL, or try clerk.session
      const clerkSessionId = session?.id || pendingSessionId || clerk.session?.id;
      console.log('[JoinCallback] linkSessionAndRedirect - clerkSessionId:', clerkSessionId, 'session?.id:', session?.id, 'pendingSessionId:', pendingSessionId);

      const linkResponse = await fetch('/api/funnel/link-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowSessionId,
          clerkSessionId,
        }),
      });

      if (!linkResponse.ok) {
        const errorData = await linkResponse.json();
        throw new Error(errorData.error || 'Failed to link session');
      }

      const linkData = await linkResponse.json();
      
      // If user was enrolled in an organization, refresh the session to get updated claims
      // This is critical for the middleware to recognize the user as a member
      if (linkData.enrolledInOrg) {
        setStatus('Updating your access...');
        try {
          // Touch the session to refresh claims with the new organization membership
          // This ensures the middleware will see the updated primaryOrganizationId
          // Try multiple sources for session object
          const activeSession = session || clerk.session;
          if (activeSession) {
            await activeSession.touch();
            console.log('[JoinCallback] Session refreshed after org enrollment');
          } else {
            console.log('[JoinCallback] No session object available for touch, will do hard reload');
          }

          // Allow time for session propagation across Clerk's infrastructure
          // This prevents race conditions where middleware checks old claims
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Do a hard reload to force Clerk to re-fetch session with new claims
          // This is the most reliable way to get updated organizationId in session
          const tenant = searchParams.get('tenant');
          const reloadUrl = tenant
            ? `/join/callback?flowSessionId=${flowSessionId}&tenant=${tenant}&_orgRefresh=1`
            : `/join/callback?flowSessionId=${flowSessionId}&_orgRefresh=1`;

          // Only reload once to avoid infinite loops
          if (!searchParams.get('_orgRefresh')) {
            console.log('[JoinCallback] Doing hard reload to refresh session claims...');
            window.location.href = reloadUrl;
            return;
          }
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
          // Redirect back to funnel (preserve ?tenant= for localhost dev)
          router.replace(buildRedirectUrl(`/join/${funnelData.program.slug}/${funnelData.funnel.slug}`));
          return;
        }
      }

      // Fallback to dashboard (preserve ?tenant= for localhost dev)
      router.replace(buildRedirectUrl('/'));
    } catch (err) {
      console.error('Failed to link session:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [flowSessionId, session, router, buildRedirectUrl, pendingSessionId, clerk.session?.id]);

  useEffect(() => {
    // Wait for both Clerk client and auth to be loaded
    if (!isLoaded || !clerk.loaded) {
      console.log('[JoinCallback] Waiting for Clerk to load...', { isLoaded, clerkLoaded: clerk.loaded });
      return;
    }

    // After signup, there's a race condition where Clerk's auth state hasn't propagated yet.
    // Instead of immediately redirecting to sign-in, wait and retry.
    if (!isSignedIn || !userId) {
      // If we have a pending session ID from the signup form, try to activate it
      // This is the fix for localhost where cookies don't propagate properly
      if (pendingSessionId && !hasActivatedSession.current) {
        hasActivatedSession.current = true;
        console.log('[JoinCallback] Attempting to activate session from URL param:', pendingSessionId);
        setStatus('Activating your session...');

        clerk.setActive({ session: pendingSessionId })
          .then(() => {
            console.log('[JoinCallback] Session activated successfully, reloading...');
            // Remove the session ID from URL and reload to get fresh auth state
            const url = new URL(window.location.href);
            url.searchParams.delete('_sessionId');
            url.searchParams.set('_activated', '1');
            window.location.href = url.toString();
          })
          .catch((err) => {
            console.error('[JoinCallback] Failed to activate session:', err);
            // Continue with normal retry flow
            hasActivatedSession.current = false;
          });
        return;
      }

      if (flowSessionId) {
        // Check if we should do a hard reload to force Clerk to re-read cookies
        // This is the nuclear option that reliably fixes localhost cookie issues
        if (authRetryCount >= RELOAD_RETRY_COUNT && !hasReloaded.current) {
          console.log('[JoinCallback] Auth still not ready after soft retries, doing hard reload...');
          hasReloaded.current = true;
          // Add a marker to prevent infinite reload loops
          const url = new URL(window.location.href);
          if (!url.searchParams.has('_reloaded')) {
            url.searchParams.set('_reloaded', '1');
            window.location.href = url.toString();
            return;
          }
        }

        // If we already reloaded and still no auth, give up after a few more tries
        const maxRetries = hasReloaded.current ? RELOAD_RETRY_COUNT + 6 : RELOAD_RETRY_COUNT;
        if (authRetryCount < maxRetries) {
          // We have a flowSessionId, so user likely just signed up
          // Wait and retry to give Clerk time to propagate the session
          console.log(`[JoinCallback] Auth not ready yet (userId: ${userId}, isSignedIn: ${isSignedIn}), retrying... (${authRetryCount + 1}/${maxRetries})`);
          setStatus('Verifying your account...');
          const timer = setTimeout(() => {
            setAuthRetryCount(prev => prev + 1);
          }, 500);
          return () => clearTimeout(timer);
        }
      }

      // No flowSessionId or max retries reached - redirect to sign in
      console.log('[JoinCallback] Auth not available after retries, redirecting to sign-in');
      router.replace(buildRedirectUrl('/sign-in'));
      return;
    }

    if (!flowSessionId) {
      // No flow session, redirect to dashboard
      router.replace(buildRedirectUrl('/'));
      return;
    }

    // Prevent duplicate calls to linkSessionAndRedirect
    if (hasLinkedSession.current) {
      console.log('[JoinCallback] Already linking session, skipping...');
      return;
    }

    // Wait for session to be available (or use fallback from URL param)
    // On localhost, useSession() can return null even when isSignedIn is true
    const hasSessionId = session?.id || pendingSessionId || clerk.session?.id;
    if (!hasSessionId && authRetryCount < 4) {
      // Wait a bit more for session to populate
      console.log(`[JoinCallback] Waiting for session object... (retry ${authRetryCount + 1}/4)`);
      const timer = setTimeout(() => {
        setAuthRetryCount(prev => prev + 1);
      }, 300);
      return () => clearTimeout(timer);
    }

    hasLinkedSession.current = true;

    // Link the session and redirect back to funnel
    console.log('[JoinCallback] Auth ready, linking session for user:', userId, 'sessionId:', hasSessionId);
    linkSessionAndRedirect();
  }, [isLoaded, isSignedIn, userId, flowSessionId, linkSessionAndRedirect, router, authRetryCount, clerk.loaded, clerk, pendingSessionId, buildRedirectUrl, session]);

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






