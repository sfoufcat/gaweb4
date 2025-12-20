'use client';

import { useSearchParams } from 'next/navigation';
import { SignInForm } from '@/components/auth';
import { Suspense } from 'react';

/**
 * /sign-in/embedded - Embeddable sign-in form for iframes
 * 
 * Used by satellite domains to embed sign-in in an iframe.
 * Accepts ?origin=https://example.com to send postMessage to parent window.
 * 
 * This page is minimal - no background, no header, just the form.
 * OAuth buttons are hidden since they're handled by the parent page.
 */
function EmbeddedSignInContent() {
  const searchParams = useSearchParams();
  const origin = searchParams.get('origin') || '';
  
  return (
    <div className="p-2">
      <SignInForm 
        embedded={true}
        origin={origin}
        redirectUrl="/"
        hideOAuth={true}
      />
    </div>
  );
}

export default function EmbeddedSignInPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
      </div>
    }>
      <EmbeddedSignInContent />
    </Suspense>
  );
}
