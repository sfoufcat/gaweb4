'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { SignUpForm } from '@/components/auth';

interface BeginPageClientProps {
  logoUrl: string;
  appTitle: string;
}

/**
 * /begin - Client Component with auth logic
 * 
 * Purpose: Marketing entry point for "Take the quiz" / "Begin your journey" CTAs
 * - Shows custom sign-up form for unauthenticated users
 * - Redirects authenticated users to onboarding
 */
export function BeginPageClient({ logoUrl, appTitle }: BeginPageClientProps) {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  // Redirect authenticated users to onboarding or dashboard
  useEffect(() => {
    if (isLoaded && user) {
      // Check billing from Clerk metadata (SINGLE SOURCE OF TRUTH - no DB call needed)
      const publicMetadata = user.publicMetadata as {
        billingStatus?: string;
        billingPeriodEnd?: string;
        tier?: string;
      };
      
      const billingStatus = publicMetadata?.billingStatus;
      const billingPeriodEnd = publicMetadata?.billingPeriodEnd;
      const now = new Date();
      const periodEndDate = billingPeriodEnd ? new Date(billingPeriodEnd) : null;
      const hasTimeRemaining = periodEndDate && periodEndDate > now;
      
      const hasActiveSubscription = billingStatus === 'active' || 
        billingStatus === 'trialing' ||
        (billingStatus === 'canceled' && hasTimeRemaining);
      
      if (hasActiveSubscription) {
        router.push('/');
        return;
      }
      
      // No active subscription - fetch onboarding status from Firebase
      // (onboarding status is NOT in Clerk, only billing/tier is)
      const checkOnboardingStatus = async () => {
        try {
          const response = await fetch('/api/user/me');
          const data = await response.json();
          
          const status = data.user?.onboardingStatus;
          if (!status || status === 'welcome') {
            router.push('/onboarding/welcome');
          } else if (status === 'workday') {
            router.push('/onboarding/workday');
          } else if (status === 'obstacles') {
            router.push('/onboarding/obstacles');
          } else if (status === 'business_stage') {
            router.push('/onboarding/business-stage');
          } else if (status === 'goal_impact') {
            router.push('/onboarding/goal-impact');
          } else if (status === 'support_needs') {
            router.push('/onboarding/support-needs');
          } else if (status === 'create_profile_intro') {
            router.push('/onboarding/create-profile-intro');
          } else if (status === 'edit_profile') {
            router.push('/profile?edit=true&fromOnboarding=true');
          } else if (status === 'mission') {
            router.push('/onboarding');
          } else if (status === 'goal') {
            router.push('/onboarding/goal');
          } else if (status === 'transformation') {
            router.push('/onboarding/transformation');
          } else if (status === 'plan' || status === 'completed') {
            router.push('/onboarding/plan');
          } else {
            router.push('/onboarding/welcome');
          }
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          router.push('/onboarding/welcome');
        }
      };
      
      checkOnboardingStatus();
    }
  }, [isLoaded, user, router]);

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  // If user is authenticated, show loading while redirecting
  if (user) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary mx-auto mb-4" />
          <p className="text-text-secondary">Resuming your journey...</p>
        </div>
      </div>
    );
  }

  // Show sign-up for unauthenticated users
  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 lg:py-16">
        <div className="w-full max-w-xl mx-auto">
          {/* Marketing Header */}
          <div className="text-center mb-10 lg:mb-12">
            {/* Logo */}
            <Image 
              src={logoUrl} 
              alt={appTitle} 
              width={80}
              height={80}
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-6 shadow-lg"
              unoptimized={logoUrl.startsWith('http')}
            />
            <h1 className="font-albert text-[38px] sm:text-[46px] lg:text-[56px] text-text-primary tracking-[-2px] leading-[1.1] mb-5 lg:mb-6 lg:whitespace-nowrap">
              Begin your growth journey
            </h1>
            <p className="font-sans text-[16px] lg:text-[18px] text-text-secondary leading-[1.6] max-w-md mx-auto">
              Create your account to set your mission, define your goal, and start building momentum.
            </p>
          </div>

          {/* Custom Sign Up Form */}
          <SignUpForm redirectUrl="/onboarding/welcome" />

          {/* Sign In Link */}
          <p className="text-center mt-8 lg:mt-10 font-sans text-[15px] text-text-secondary">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-[#a07855] hover:text-[#8a6649] font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
