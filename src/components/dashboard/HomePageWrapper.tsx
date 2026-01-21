'use client';

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
 */
export function HomePageWrapper() {
  const { isCoachView, isLoading } = useViewMode();

  // While loading, show neutral skeleton - prevents flash of wrong content
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Coach view: Show coach-focused home
  if (isCoachView) {
    return <CoachHomePage />;
  }

  // Client view: Show client dashboard
  return <DashboardPage />;
}
