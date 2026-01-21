'use client';

import { useEffect, useState, useRef } from 'react';
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
 */
export function HomePageWrapper() {
  const { isCoachView, isLoading } = useViewMode();
  const [displayedView, setDisplayedView] = useState<'coach' | 'client'>(isCoachView ? 'coach' : 'client');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevViewRef = useRef(isCoachView);

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
