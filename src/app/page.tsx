import { headers } from 'next/headers';
import { CoachLandingPage } from '@/components/lp/CoachLandingPage';
import { HomePageWrapper } from '@/components/dashboard/HomePageWrapper';

/**
 * Force dynamic rendering to prevent caching issues with auth-dependent content.
 * This is critical because:
 * 1. The same URL (/) can show different content based on auth state
 * 2. Tenant domains with websiteEnabled redirect to /website by middleware
 * 3. Without force-dynamic, Next.js might cache the wrong content and show
 *    the /website content to authenticated users (the bug we're fixing)
 */
export const dynamic = 'force-dynamic';

/**
 * Disable fetch caching for this route to ensure fresh auth state on every request.
 */
export const fetchCache = 'force-no-store';

/**
 * Homepage - Dynamic based on domain and auth state
 *
 * - Marketing domain (coachful.co): Shows CoachLandingPage
 * - Tenant domains (*.coachful.co):
 *   - Unauthenticated + websiteEnabled: Middleware rewrites to /website
 *   - Authenticated: Shows HomePageWrapper
 *     - Coach view: CoachHomePage (programs, squads, stats)
 *     - Client view: DashboardPage (daily focus, habits)
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
  // Note: Unauthenticated users with websiteEnabled are rewritten to /website by middleware
  return <HomePageWrapper />;
}
