'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import Image from 'next/image';

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af';

/**
 * Coach Complete Signup Page
 * 
 * Handles the OAuth completion flow for new coaches:
 * 1. User signs up via Google OAuth from the marketplace modal
 * 2. After OAuth, Clerk redirects here
 * 3. This page creates the coach organization
 * 4. Then redirects to /coach/onboarding/profile
 * 
 * Also handles the case where an existing user clicks "become a coach"
 */
export default function CompleteSignupPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'creating' | 'redirecting' | 'error'>('loading');

  useEffect(() => {
    if (!isLoaded) return;
    
    // If not signed in, redirect to sign-in
    if (!user) {
      router.push('/sign-in?redirect_url=/coach/complete-signup');
      return;
    }
    
    const completeSignup = async () => {
      try {
        // Always create a new organization (supports multi-org for coaches)
        // The API handles setting primaryOrganizationId to the new org
        setStatus('creating');
        
        // Try to save quiz data from localStorage (if present from OAuth flow)
        let parsedQuizData: { 
          clientCount?: string; 
          frustrations?: string[]; 
          impactFeatures?: string[];
          referralCode?: string;
          source?: string;
        } | null = null;
        
        try {
          const storedQuizData = localStorage.getItem('ga_quiz_data');
          if (storedQuizData && user?.primaryEmailAddress?.emailAddress) {
            parsedQuizData = JSON.parse(storedQuizData);
            await fetch('/api/quiz-leads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: user.primaryEmailAddress.emailAddress,
                name: user.fullName || undefined,
                clientCount: parsedQuizData?.clientCount || '',
                frustrations: parsedQuizData?.frustrations || [],
                impactFeatures: parsedQuizData?.impactFeatures || [],
                referralCode: parsedQuizData?.referralCode,
                source: parsedQuizData?.source,
              }),
            });
            // Clear stored quiz data
            localStorage.removeItem('ga_quiz_data');
            console.log('[COMPLETE_SIGNUP] Quiz data saved from OAuth flow');
          }
        } catch (quizErr) {
          console.warn('[COMPLETE_SIGNUP] Failed to save quiz data:', quizErr);
          // Don't block signup on quiz save failure
        }
        
        // Create organization with quiz data for personalized emails and referral tracking
        const response = await fetch('/api/coach/create-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quizData: parsedQuizData ? {
              clientCount: parsedQuizData.clientCount,
              frustrations: parsedQuizData.frustrations,
              impactFeatures: parsedQuizData.impactFeatures,
              referralCode: parsedQuizData.referralCode,
            } : undefined,
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create organization');
        }
        
        console.log(`[COMPLETE_SIGNUP] Created organization ${data.organizationId} (isFirstOrg: ${data.isFirstOrg})`);
        
        // Success! Redirect to profile setup for the new organization
        setStatus('redirecting');
        router.push('/coach/onboarding/profile');
        
      } catch (err) {
        console.error('Complete signup error:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setStatus('error');
      }
    };
    
    completeSignup();
  }, [isLoaded, user, router]);

  // Loading state
  if (status === 'loading' || !isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#faf8f6] to-[#f5f2ed] dark:from-[#0a0c10] dark:to-[#11141b] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-accent mx-auto mb-4" />
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-sans">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Creating organization state
  if (status === 'creating') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#faf8f6] to-[#f5f2ed] dark:from-[#0a0c10] dark:to-[#11141b] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 mx-auto mb-6 relative">
            <Image
              src={LOGO_URL}
              alt="Growth Addicts"
              fill
              className="object-cover rounded-2xl"
              unoptimized
            />
          </div>
          
          <div className="w-16 h-16 bg-gradient-to-br from-brand-accent to-brand-accent rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          
          <h1 className="font-albert text-[24px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px] mb-2">
            Setting up your workspace...
          </h1>
          <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2]">
            Creating your coaching organization
          </p>
          
          <div className="mt-8 space-y-3 max-w-xs mx-auto">
            {[
              { text: 'Creating organization', done: true },
              { text: 'Setting up workspace', done: false },
              { text: 'Preparing dashboard', done: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-left">
                {item.done ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                    <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <Loader2 className="w-5 h-5 text-brand-accent animate-spin" />
                )}
                <span className={`font-sans text-[14px] ${
                  item.done 
                    ? 'text-[#5f5a55] dark:text-[#b2b6c2]' 
                    : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                }`}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Redirecting state
  if (status === 'redirecting') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#faf8f6] to-[#f5f2ed] dark:from-[#0a0c10] dark:to-[#11141b] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-accent mx-auto mb-4" />
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-sans">
            Redirecting to onboarding...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#faf8f6] to-[#f5f2ed] dark:from-[#0a0c10] dark:to-[#11141b] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          
          <h1 className="font-albert text-[24px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px] mb-2">
            Something went wrong
          </h1>
          <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] mb-6">
            {error || 'Failed to complete signup. Please try again.'}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-sans font-medium text-[14px] transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => router.push('/marketplace')}
              className="px-6 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-sans font-medium text-[14px] transition-colors hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]"
            >
              Back to marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

