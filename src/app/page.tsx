import { headers } from 'next/headers';
import { CoachLandingPage } from '@/components/lp/CoachLandingPage';
import { HomePageWrapper } from '@/components/dashboard/HomePageWrapper';

/**
 * Homepage - Dynamic based on domain
 *
 * - Marketing domain (coachful.co): Shows CoachLandingPage
 * - Tenant domains (*.coachful.co): Shows HomePageWrapper
 *   - Coach view: CoachHomePage (programs, squads, stats)
 *   - Client view: DashboardPage (daily focus, habits)
 *
 * Uses SSR domain detection to prevent hydration flicker.
 */
export default async function HomePage() {
  const headersList = await headers();
  const hostname = (headersList.get('host') || '').toLowerCase();

  // Only show landing page on actual marketing domain
  // Localhost and tenant subdomains should show dashboard
  const isMarketingDomain =
    hostname === 'coachful.co' ||
    hostname === 'www.coachful.co';

  // Marketing domain: Show landing page
  if (isMarketingDomain) {
    return <CoachLandingPage />;
  }

  // Tenant domain: Show home page wrapper (switches between coach/client view)
  return <HomePageWrapper />;
}
