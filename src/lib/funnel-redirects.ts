/**
 * Funnel Redirect Utilities
 * 
 * This module provides utilities for redirecting legacy paths (/start, /begin)
 * to the new unified funnel system (/join).
 * 
 * These redirects can be enabled by updating the middleware or the respective pages.
 * 
 * Legacy paths:
 * - /start → Default funnel for the organization's default program
 * - /start/[track] → Funnel for that track's default program
 * - /begin → Signup-first funnel (signup step comes first)
 * 
 * New paths:
 * - /join/[programSlug] → Default funnel for a program
 * - /join/[programSlug]/[funnelSlug] → Specific funnel for a program
 * - /join/[programSlug]/[funnelSlug]?invite=CODE → With invite code
 */

import type { UserTrack } from '@/types';

/**
 * Map legacy track slugs to program slugs
 * This mapping should be updated based on actual program configurations
 */
export const TRACK_TO_PROGRAM_MAP: Record<UserTrack, string> = {
  content_creator: 'content-creator-90',
  saas: 'saas-founder-90',
  coach_consultant: 'coach-consultant-90',
  ecom: 'ecom-90',
  agency: 'agency-90',
  community_builder: 'community-builder-90',
  general: 'starter-90',
};

/**
 * Get the redirect URL for a legacy /start path
 * 
 * @param track - Optional track slug from /start/[track]
 * @param organizationId - Organization ID for tenant-specific programs
 * @returns The new /join URL or null if no redirect is configured
 */
export function getStartRedirect(
  track?: UserTrack | null,
  organizationId?: string | null
): string | null {
  // If no track specified, use general
  const effectiveTrack = track || 'general';
  
  // Get program slug for this track
  const programSlug = TRACK_TO_PROGRAM_MAP[effectiveTrack];
  
  if (!programSlug) {
    return null;
  }
  
  return `/join/${programSlug}`;
}

/**
 * Get the redirect URL for a legacy /begin path
 * 
 * The /begin flow was signup-first, so we redirect to a funnel
 * that has the signup step early in the flow.
 * 
 * @param organizationId - Organization ID for tenant-specific programs
 * @returns The new /join URL or null if no redirect is configured
 */
export function getBeginRedirect(
  organizationId?: string | null
): string | null {
  // For /begin, we want the default signup-first funnel
  // This would typically be configured per-organization
  return `/join/starter-90/signup-first`;
}

/**
 * Check if a path should be redirected to the new funnel system
 * 
 * @param pathname - The current pathname
 * @returns True if this path should be redirected
 */
export function shouldRedirectToFunnel(pathname: string): boolean {
  // List of paths that should redirect to /join
  const redirectPaths = [
    '/start',
    '/begin',
  ];
  
  // Check exact matches
  if (redirectPaths.includes(pathname)) {
    return true;
  }
  
  // Check /start/[track] paths
  if (pathname.startsWith('/start/') && !pathname.includes('/start/analyzing') && !pathname.includes('/start/goal') && !pathname.includes('/start/identity') && !pathname.includes('/start/plan') && !pathname.includes('/start/success') && !pathname.includes('/start/transformation')) {
    // This is a track path like /start/content-creator
    return true;
  }
  
  return false;
}

/**
 * Get the appropriate redirect URL for a legacy path
 * 
 * @param pathname - The current pathname
 * @param searchParams - Query parameters from the URL
 * @param organizationId - Organization ID if on a tenant domain
 * @returns The redirect URL or null if no redirect is needed
 */
export function getFunnelRedirectUrl(
  pathname: string,
  searchParams: URLSearchParams,
  organizationId?: string | null
): string | null {
  if (!shouldRedirectToFunnel(pathname)) {
    return null;
  }
  
  let redirectUrl: string | null = null;
  
  if (pathname === '/begin') {
    redirectUrl = getBeginRedirect(organizationId);
  } else if (pathname === '/start') {
    redirectUrl = getStartRedirect(null, organizationId);
  } else if (pathname.startsWith('/start/')) {
    // Extract track from path
    const track = pathname.split('/')[2] as UserTrack;
    redirectUrl = getStartRedirect(track, organizationId);
  }
  
  if (!redirectUrl) {
    return null;
  }
  
  // Preserve invite code if present
  const inviteCode = searchParams.get('invite') || searchParams.get('code');
  if (inviteCode) {
    redirectUrl += `?invite=${encodeURIComponent(inviteCode)}`;
  }
  
  return redirectUrl;
}

/**
 * Example middleware integration:
 * 
 * ```typescript
 * // In middleware.ts
 * import { getFunnelRedirectUrl, shouldRedirectToFunnel } from '@/lib/funnel-redirects';
 * 
 * export async function middleware(request: NextRequest) {
 *   const pathname = request.nextUrl.pathname;
 *   
 *   // Check for legacy path redirects
 *   if (shouldRedirectToFunnel(pathname)) {
 *     const searchParams = request.nextUrl.searchParams;
 *     const organizationId = await getOrganizationFromRequest(request); // your helper
 *     
 *     const redirectUrl = getFunnelRedirectUrl(pathname, searchParams, organizationId);
 *     
 *     if (redirectUrl) {
 *       return NextResponse.redirect(new URL(redirectUrl, request.url));
 *     }
 *   }
 *   
 *   // ... rest of middleware
 * }
 * ```
 * 
 * Note: Enable these redirects only after:
 * 1. Running the quiz migration script
 * 2. Verifying all funnels are working
 * 3. Testing thoroughly on staging
 */




