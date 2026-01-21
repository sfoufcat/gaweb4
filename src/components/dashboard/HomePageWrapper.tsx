'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useViewMode } from '@/contexts/ViewModeContext';
import { DashboardPage } from './DashboardPage';
import { DashboardSkeleton } from './DashboardSkeleton';
import { CoachHomePage } from '@/components/coach/CoachHomePage';

/**
 * HomePageWrapper - Switches between Coach Home and Client Dashboard
 *
 * Based on the user's view mode:
 * - Coach view: Shows CoachHomePage (programs, squads, stats overview)
 * - Client view: Shows DashboardPage (daily focus, habits, alignment)
 *
 * Shows a neutral skeleton during loading to prevent flash of wrong content.
 * Includes smooth fade animation when switching between views.
 *
 * For custom domains with websiteEnabled:
 * - Server-side auth() doesn't work reliably (satellite domain limitation)
 * - We wait for client-side Clerk to confirm auth state
 * - If genuinely unauthenticated, redirect to /website
 */
export function HomePageWrapper() {
  const router = useRouter();
  const { isLoaded: authLoaded, userId } = useAuth();
  const { isCoachView, isLoading } = useViewMode();
  const [displayedView, setDisplayedView] = useState<'coach' | 'client'>(isCoachView ? 'coach' : 'client');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevViewRef = useRef(isCoachView);
  const hasRedirected = useRef(false);

  // Check if this is a custom domain (satellite domain)
  const isCustomDomain = typeof window !== 'undefined' && (() => {
    const hostname = window.location.hostname;
    return !hostname.includes('coachful') &&
           !hostname.includes('localhost') &&
           !hostname.includes('127.0.0.1');
  })();

  // For custom domains: After Clerk confirms user is NOT authenticated,
  // redirect to /website if websiteEnabled is true
  useEffect(() => {
    if (hasRedirected.current) return;
    if (!authLoaded) return; // Wait for Clerk to load

    // Only apply this logic for custom domains
    if (!isCustomDomain) return;

    // If user is authenticated, no redirect needed
    if (userId) return;

    // User is confirmed NOT authenticated on a custom domain
    // Check if website is enabled (we can check branding for tenant info)
    // For now, redirect to /website - that page will handle showing website or sign-in
    console.log('[HomePageWrapper] Unauthenticated user on custom domain, redirecting to /website');
    hasRedirected.current = true;
    router.replace('/website');
  }, [authLoaded, userId, isCustomDomain, router]);

  // Handle view change with fade animation
  useEffect(() => {
    if (isLoading) return;

    const newView = isCoachView ? 'coach' : 'client';

    // Only animate if view actually changed
    if (prevViewRef.current !== isCoachView) {
      setIsTransitioning(true);

      // After fade out, switch view and fade in
      const timer = setTimeout(() => {
        setDisplayedView(newView);
        // Small delay before removing transition class for fade-in
        requestAnimationFrame(() => {
          setIsTransitioning(false);
        });
      }, 150); // Match the CSS transition duration

      prevViewRef.current = isCoachView;
      return () => clearTimeout(timer);
    } else {
      // Initial render - just set the view
      setDisplayedView(newView);
    }
  }, [isCoachView, isLoading]);

  // While loading, show neutral skeleton - prevents flash of wrong content
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div
      className={`transition-opacity duration-150 ease-out ${
        isTransitioning ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {displayedView === 'coach' ? <CoachHomePage /> : <DashboardPage />}
    </div>
  );
}
