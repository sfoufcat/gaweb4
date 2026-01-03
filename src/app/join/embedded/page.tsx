'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { SignUpForm } from '@/components/auth';

/**
 * /join/embedded - Embeddable sign-up form for funnel iframes
 * 
 * This page runs on the subdomain (where Clerk is registered) and is embedded
 * as an iframe in custom domain funnel pages.
 * 
 * Query params:
 * - origin: Parent window origin for postMessage (e.g., https://mycoach.com)
 * - flowSessionId: The flow session ID (for context, not directly used here)
 * - redirectUrl: Where to redirect after auth (passed to parent via postMessage)
 * 
 * Flow:
 * 1. Custom domain's SignupStep renders iframe with this as src
 * 2. If user is already signed in, sends postMessage to parent with user info
 * 3. If not signed in, user fills out email/password signup form
 * 4. After successful signup, this page sends postMessage to parent with redirectUrl
 * 5. Parent (SignupStep) receives message and handles appropriately
 * 
 * This page is minimal - no background, no header, just the form.
 * OAuth buttons are hidden since they're handled by the parent page.
 */
function EmbeddedContent() {
  const searchParams = useSearchParams();
  const origin = searchParams.get('origin') || '';
  const flowSessionId = searchParams.get('flowSessionId') || '';
  // Get redirectUrl from query params - this is passed from the parent page
  // so we can include it in the postMessage for the parent to redirect correctly
  const redirectUrl = searchParams.get('redirectUrl') || '';
  
  // Auth state detection
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const hasNotifiedParent = useRef(false);
  
  // Make body transparent for iframe embedding
  useEffect(() => {
    document.body.style.background = 'transparent';
    return () => {
      document.body.style.background = '';
    };
  }, []);
  
  // Notify parent if user is already signed in
  // This is critical for custom domains where the parent doesn't have access to Clerk session
  useEffect(() => {
    if (!isLoaded || !origin || hasNotifiedParent.current) return;
    
    if (isSignedIn && user) {
      // User is already signed in - notify the parent so it can show "Continue as X"
      // instead of the signup form with nested sign-in
      const userInfo = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.primaryEmailAddress?.emailAddress || '',
        imageUrl: user.imageUrl || '',
      };
      
      window.parent.postMessage({
        type: 'auth-already-signed-in',
        userInfo,
        redirectUrl,
      }, origin);
      
      hasNotifiedParent.current = true;
    }
  }, [isLoaded, isSignedIn, user, origin, redirectUrl]);
  
  // Show loading while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
      </div>
    );
  }
  
  // If user is signed in, show a simple message
  // The parent will receive the postMessage and show "Continue as X" screen
  if (isSignedIn && user) {
    return (
      <div className="p-4 text-center">
        <p className="text-text-secondary text-sm">
          Detected existing account...
        </p>
      </div>
    );
  }
  
  // Not signed in - show the signup form
  return (
    <div className="p-2">
      <SignUpForm 
        embedded={true}
        origin={origin}
        // Pass redirectUrl so it gets included in postMessage to parent
        redirectUrl={redirectUrl}
        hideOAuth={true}
      />
    </div>
  );
}

export default function JoinEmbeddedPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
      </div>
    }>
      <EmbeddedContent />
    </Suspense>
  );
}
