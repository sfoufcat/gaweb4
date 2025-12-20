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
 * This page has no wrapper/header - just the form.
 */
function EmbeddedBeginContent() {
  const searchParams = useSearchParams();
  const origin = searchParams.get('origin') || '';
  
  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
      <SignUpForm 
        embedded={true}
        origin={origin}
        redirectUrl="/onboarding/welcome"
      />
    </div>
  );
}

export default function EmbeddedBeginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
      </div>
    }>
      <EmbeddedBeginContent />
    </Suspense>
  );
}
