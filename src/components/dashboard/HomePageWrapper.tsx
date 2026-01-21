'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import { DashboardPage } from './DashboardPage';
import { CoachHomePage } from '@/components/coach/CoachHomePage';

/**
 * HomePageWrapper - Switches between Coach Home and Client Dashboard
 *
 * Based on the user's view mode:
 * - Coach view: Shows CoachHomePage (programs, squads, stats overview)
 * - Client view: Shows DashboardPage (daily focus, habits, alignment)
 */
export function HomePageWrapper() {
  const { isCoachView, isLoading } = useViewMode();

  // While loading, show the client dashboard (default)
  // This prevents a flash of wrong content
  if (isLoading) {
    return <DashboardPage />;
  }

  // Coach view: Show coach-focused home
  if (isCoachView) {
    return <CoachHomePage />;
  }

  // Client view: Show client dashboard
  return <DashboardPage />;
}
