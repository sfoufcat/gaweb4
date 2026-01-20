import { headers } from 'next/headers';
import { CoachLandingPage } from '@/components/lp/CoachLandingPage';
import { DashboardPage } from '@/components/dashboard/DashboardPage';

/**
 * Homepage - Dynamic based on domain
 *
 * - Marketing domain (coachful.co): Shows CoachLandingPage
 * - Tenant domains (*.coachful.co): Shows Dashboard
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

  // Tenant domain: Show dashboard
  return <DashboardPage />;
}
