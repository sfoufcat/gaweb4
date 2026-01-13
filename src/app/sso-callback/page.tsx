'use client';

import { useEffect, Suspense, Component, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthenticateWithRedirectCallback, useUser } from '@clerk/nextjs';

/**
 * SSO Callback page - handles OAuth redirect flow
 * This page is required for Google/Apple sign-in to work
 *
 * Modes:
 * 1. Normal: Clerk handles redirect to final destination
 * 2. Popup: After auth, send postMessage to opener and close popup
 */

/**
 * Error boundary to catch errors during OAuth callback processing
 * This prevents the default Next.js "Application Error" screen from showing
 * during brief authentication state transitions
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class AuthErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Log but don't disrupt - Clerk will often recover
    console.error('[SSO_CALLBACK] Auth error caught:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function SSOCallbackContent() {
  const searchParams = useSearchParams();
  const isPopup = searchParams.get('popup') === '1';
  const origin = searchParams.get('origin') || '';
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    // In popup mode, once signed in, notify opener and close
    if (isPopup && origin && isLoaded && isSignedIn && window.opener) {
      window.opener.postMessage({ type: 'auth-success' }, origin);
      window.close();
    }
  }, [isPopup, origin, isLoaded, isSignedIn]);

  // Loading UI shown both normally and as error fallback
  const loadingUI = (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-text-secondary/30 border-t-text-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="font-sans text-text-secondary">Completing sign in...</p>
      </div>
    </div>
  );

  return (
    <>
      {loadingUI}
      <AuthErrorBoundary fallback={loadingUI}>
        <AuthenticateWithRedirectCallback />
      </AuthErrorBoundary>
    </>
  );
}

export default function SSOCallbackPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-text-secondary/30 border-t-text-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="font-sans text-text-secondary">Loading...</p>
        </div>
      </div>
    }>
      <SSOCallbackContent />
    </Suspense>
  );
}

