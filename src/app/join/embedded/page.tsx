'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
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
 * 2. User fills out email/password signup form
 * 3. After successful signup, this page sends postMessage to parent with redirectUrl
 * 4. Parent (SignupStep) receives message and redirects appropriately
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
  
  // Make body transparent for iframe embedding
  useEffect(() => {
    document.body.style.background = 'transparent';
    return () => {
      document.body.style.background = '';
    };
  }, []);
  
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











