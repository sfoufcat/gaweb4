'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Check, Users } from 'lucide-react';
import Script from 'next/script';
import { usePendingInvite } from '@/hooks/usePendingInvite';

/**
 * Inner component that uses useSearchParams
 */
function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  const [status, setStatus] = useState<'verifying' | 'polling' | 'success' | 'joining_squad' | 'timeout' | 'error'>('verifying');
  const [pollCount, setPollCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasVerified, setHasVerified] = useState(false);
  const [joinedSquadName, setJoinedSquadName] = useState<string | null>(null);

  const { clearPendingInvite, getToken } = usePendingInvite();

  const sessionId = searchParams.get('session_id');
  const MAX_POLLS = 10; // Reduced since we verify first
  const POLL_INTERVAL = 2000; // 2 seconds

  // Auto-join squad after successful payment
  const attemptSquadJoin = useCallback(async () => {
    const token = getToken();
    if (!token) return false;

    setStatus('joining_squad');
    
    let squadJoined = false;
    let squadName: string | null = null;
    
    try {
      const response = await fetch('/api/squad/join-by-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        squadName = data.squadName;
        squadJoined = true;
        setJoinedSquadName(squadName);
        clearPendingInvite();
      } else {
        // Failed to join, but don't block the success flow
        console.error('Failed to join squad:', data.error);
        clearPendingInvite();
      }
    } catch (error) {
      console.error('Error joining squad:', error);
      clearPendingInvite();
    }
    
    // Continue with success flow
    setStatus('success');
    setShowConfetti(true);
    
    // Store pending squad join info so profile edit can redirect to squad after
    if (squadJoined) {
      sessionStorage.setItem('pendingSquadRedirect', 'true');
    }
    
    // Always go to profile creation first (required onboarding step)
    // This also gives Clerk metadata time to update with billing status
    setTimeout(() => {
      router.push('/onboarding/identity');
    }, 2500);
    
    return squadJoined;
  }, [getToken, clearPendingInvite, router]);

  // Direct verification with Stripe via our API
  const verifyCheckout = useCallback(async () => {
    if (!sessionId) {
      console.log('No session_id, falling back to polling');
      setStatus('polling');
      return false;
    }

    try {
      const response = await fetch('/api/verify-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();

      if (data.success && data.status === 'active') {
        // Check if there's a pending squad invite to join
        const token = getToken();
        if (token) {
          await attemptSquadJoin();
        } else {
          setStatus('success');
          setShowConfetti(true);
          
          // Redirect to profile creation after showing success
          setTimeout(() => {
            router.push('/onboarding/identity');
          }, 2000);
        }
        return true;
      }

      // If verification returned but not active, fall back to polling
      console.log('Verification response:', data);
      setStatus('polling');
      return false;
    } catch (error) {
      console.error('Error verifying checkout:', error);
      setStatus('polling');
      return false;
    }
  }, [sessionId, router, getToken, attemptSquadJoin]);

  // Fallback polling for billing status using Clerk metadata (SINGLE SOURCE OF TRUTH)
  const checkBillingStatus = useCallback(async () => {
    // Check Clerk metadata directly - this is the source of truth
    const publicMetadata = user?.publicMetadata as {
      billingStatus?: string;
      billingPeriodEnd?: string;
      tier?: string;
    } | undefined;

    const billingStatus = publicMetadata?.billingStatus;

    if (billingStatus === 'active' || billingStatus === 'trialing') {
      // Check if there's a pending squad invite to join
      const token = getToken();
      if (token) {
        await attemptSquadJoin();
      } else {
        setStatus('success');
        setShowConfetti(true);
        
        setTimeout(() => {
          router.push('/onboarding/identity');
        }, 2000);
      }
      return true;
    }
    
    // If Clerk doesn't have the update yet (webhook delay), force a session refresh
    // by calling an API that will trigger Clerk to refresh the session
    try {
      // This API call will help sync Clerk if the webhook updated it
      await fetch('/api/billing/sync', { method: 'POST' });
    } catch (_error) {
      // Ignore errors - this is just a best-effort sync
    }
    
    return false;
  }, [user, router, getToken, attemptSquadJoin]);

  // Initial verification on mount
  useEffect(() => {
    if (!isLoaded || !user || hasVerified) return;

    const verify = async () => {
      setHasVerified(true);
      const verified = await verifyCheckout();
      
      // If verification didn't succeed immediately, start polling
      if (!verified && status !== 'success') {
        setStatus('polling');
      }
    };

    verify();
  }, [isLoaded, user, hasVerified, verifyCheckout, status]);

  // Polling effect (only runs when status is 'polling')
  useEffect(() => {
    if (!isLoaded || !user || status !== 'polling') return;

    const poll = async () => {
      const isComplete = await checkBillingStatus();
      
      if (!isComplete) {
        setPollCount(prev => {
          const newCount = prev + 1;
          if (newCount >= MAX_POLLS) {
            setStatus('timeout');
            return newCount;
          }
          return newCount;
        });
      }
    };

    // Start polling
    poll();

    const interval = setInterval(() => {
      if (status === 'polling' && pollCount < MAX_POLLS) {
        poll();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [isLoaded, user, checkBillingStatus, status, pollCount]);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/join/starter-90');
    }
  }, [isLoaded, user, router]);

  // Retry handler for timeout state
  const handleRetry = async () => {
    setStatus('verifying');
    setPollCount(0);
    setHasVerified(false);
  };

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-app-bg overflow-hidden">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {Array.from({ length: 100 }).map((_, i) => (
            <ConfettiPiece key={i} index={i} />
          ))}
        </div>
      )}

      <div className="min-h-full flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto text-center">
          {(status === 'verifying' || status === 'polling') && (
            <>
              {/* Processing Animation */}
              <div className="mb-8 inline-flex items-center justify-center w-24 h-24 bg-[#f3f1ef] rounded-3xl">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#a07855] dark:border-[#b8896a]" />
              </div>

              <h1 className="font-albert text-[36px] lg:text-[42px] text-text-primary tracking-[-2px] leading-[1.2] mb-4">
                {status === 'verifying' ? 'Verifying your payment...' : 'Processing your payment...'}
              </h1>
              
              <p className="font-sans text-[16px] text-text-secondary leading-[1.5] mb-8">
                Please wait while we confirm your subscription. This usually takes just a few seconds.
              </p>

              {/* Progress dots */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#a07855] animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </>
          )}

          {status === 'joining_squad' && (
            <>
              {/* Joining Squad Animation */}
              <div className="mb-8 inline-flex items-center justify-center w-24 h-24 bg-[#f3f1ef] rounded-3xl">
                <Users className="w-10 h-10 text-[#a07855] dark:text-[#b8896a] animate-pulse" />
              </div>

              <h1 className="font-albert text-[36px] lg:text-[42px] text-text-primary tracking-[-2px] leading-[1.2] mb-4">
                Joining your squad...
              </h1>
              
              <p className="font-sans text-[16px] text-text-secondary leading-[1.5]">
                We're adding you to your friend's squad now.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              {/* Success Icon */}
              <div className="mb-8 inline-flex items-center justify-center w-24 h-24 bg-[#a07855] rounded-3xl">
                <Check className="w-12 h-12 text-white stroke-[3]" />
              </div>

              <h1 className="font-albert text-[42px] lg:text-[52px] text-text-primary tracking-[-2px] leading-[1.2] mb-4">
                {joinedSquadName ? `You're in! 🎉` : 'Welcome to GrowthAddicts!'}
              </h1>
              
              <p className="font-sans text-[18px] text-text-secondary leading-[1.5]">
                {joinedSquadName 
                  ? `You've joined ${joinedSquadName}. Redirecting to your squad...`
                  : 'Your subscription is active. Let\'s set up your profile...'}
              </p>
            </>
          )}

          {status === 'timeout' && (
            <>
              {/* Warning Icon */}
              <div className="mb-8 inline-flex items-center justify-center w-24 h-24 bg-amber-100 rounded-3xl">
                <svg className="w-12 h-12 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h1 className="font-albert text-[36px] lg:text-[42px] text-text-primary tracking-[-2px] leading-[1.2] mb-4">
                Taking longer than expected
              </h1>
              
              <p className="font-sans text-[16px] text-text-secondary leading-[1.5] mb-8">
                Your payment was successful, but it&apos;s taking a moment to process. You can try refreshing or contact support if this persists.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRetry}
                  className="w-full bg-[#2c2520] text-white font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  Try again
                </button>
                
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-white border border-[#e1ddd8] text-[#2c2520] font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] hover:bg-[#faf8f6] transition-colors"
                >
                  Go to dashboard anyway
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Meta Pixel Code */}
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '1347713597075016');
          fbq('track', 'PageView');
          fbq('track', 'Purchase');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: 'none' }} alt=""
          src="https://www.facebook.com/tr?id=1347713597075016&ev=PageView&noscript=1"
        />
      </noscript>

      {/* Google tag (gtag.js) */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-16653181105"
        strategy="afterInteractive"
      />
      <Script id="google-gtag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-16653181105');
        `}
      </Script>

      {/* Confetti Animation Styles */}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        :global(.animate-confetti-fall) {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}

/**
 * Checkout Success Page
 * Verifies payment directly with Stripe, then falls back to polling
 */
export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}

/**
 * Confetti Piece Component
 */
function ConfettiPiece({ index }: { index: number }) {
  const colors = ['#ff6b6b', '#ff8c42', '#ffa500', '#9b59b6', '#a07855', '#4ecdc4', '#45b7d1', '#96ceb4'];
  const color = colors[index % colors.length];
  const left = Math.random() * 100;
  const animationDelay = Math.random() * 0.5;
  const animationDuration = 2 + Math.random() * 2;
  const size = 8 + Math.random() * 8;
  const rotation = Math.random() * 360;

  return (
    <div
      className="fixed pointer-events-none animate-confetti-fall"
      style={{
        left: `${left}%`,
        top: '-20px',
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        transform: `rotate(${rotation}deg)`,
        animationDelay: `${animationDelay}s`,
        animationDuration: `${animationDuration}s`,
        zIndex: 9999,
      }}
    />
  );
}

