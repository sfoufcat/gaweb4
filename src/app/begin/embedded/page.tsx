'use client';

import { useSearchParams } from 'next/navigation';
import { SignUpForm } from '@/components/auth';
import { Suspense } from 'react';

/**
 * /begin/embedded - Embeddable sign-up form for iframes
 * 
 * Used by satellite domains to embed sign-up in an iframe.
 * Accepts ?origin=https://example.com to send postMessage to parent window.
 * 
 * This page is minimal - no background, no header, just the form.
 * OAuth buttons are hidden since they're handled by the parent page.
 */
function EmbeddedBeginContent() {
  const searchParams = useSearchParams();
  const origin = searchParams.get('origin') || '';
  
  return (
    <div className="p-2">
      <SignUpForm 
        embedded={true}
        origin={origin}
        redirectUrl="/onboarding/welcome"
        hideOAuth={true}
      />
    </div>
  );
}

export default function EmbeddedBeginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
      </div>
    }>
      <EmbeddedBeginContent />
    </Suspense>
  );
}
