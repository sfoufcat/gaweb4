import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Billing status types (must match admin-utils-clerk.ts)
type BillingStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
// Membership tier - does NOT include coaching (coaching is separate)
type UserTier = 'free' | 'standard' | 'premium';
type UserRole = 'user' | 'editor' | 'coach' | 'admin' | 'super_admin';
// Coaching status - separate from membership
type CoachingStatus = 'none' | 'active' | 'canceled' | 'past_due';

interface ClerkPublicMetadata {
  role?: UserRole;
  billingStatus?: BillingStatus;
  billingPeriodEnd?: string;
  tier?: UserTier;
  organizationId?: string;
  // Coaching (separate from membership tier)
  coaching?: boolean; // Legacy flag - true if has active coaching
  coachingStatus?: CoachingStatus; // New: detailed coaching status
  coachingPlan?: 'monthly' | 'quarterly'; // New: coaching plan type
}

// =============================================================================
// TENANT RESOLUTION (Inline for Edge Runtime compatibility)
// =============================================================================

// Platform domains that are NOT tenant-scoped
const PLATFORM_DOMAINS = [
  'growthaddicts.app',
  'www.growthaddicts.app',
  'pro.growthaddicts.com',
  'www.pro.growthaddicts.com',
];

// Development hosts treated as platform mode
const DEV_HOSTS = ['localhost', '127.0.0.1'];

interface ParsedHost {
  type: 'platform' | 'subdomain' | 'custom_domain';
  hostname: string;
  subdomain?: string;
}

function parseHost(hostname: string): ParsedHost {
  const normalizedHost = hostname.toLowerCase().split(':')[0];
  
  if (PLATFORM_DOMAINS.includes(normalizedHost)) {
    return { type: 'platform', hostname: normalizedHost };
  }
  
  const isDevHost = DEV_HOSTS.some(dev => normalizedHost.startsWith(dev));
  if (isDevHost) {
    return { type: 'platform', hostname: normalizedHost };
  }
  
  // Check for subdomain of growthaddicts.app
  const subdomainMatch = normalizedHost.match(/^([a-z0-9-]+)\.growthaddicts\.app$/);
  if (subdomainMatch) {
    const subdomain = subdomainMatch[1];
    if (subdomain === 'www') {
      return { type: 'platform', hostname: normalizedHost };
    }
    return { type: 'subdomain', hostname: normalizedHost, subdomain };
  }
  
  // Check for subdomain of pro.growthaddicts.com
  const proSubdomainMatch = normalizedHost.match(/^([a-z0-9-]+)\.pro\.growthaddicts\.com$/);
  if (proSubdomainMatch) {
    const subdomain = proSubdomainMatch[1];
    if (subdomain === 'www') {
      return { type: 'platform', hostname: normalizedHost };
    }
    return { type: 'subdomain', hostname: normalizedHost, subdomain };
  }
  
  // Custom domain
  return { type: 'custom_domain', hostname: normalizedHost };
}

function getDevTenantOverride(request: NextRequest): string | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const tenantParam = request.nextUrl.searchParams.get('tenant');
  if (tenantParam) {
    return tenantParam.toLowerCase();
  }
  
  const tenantHeader = request.headers.get('x-dev-tenant');
  if (tenantHeader) {
    return tenantHeader.toLowerCase();
  }
  
  return null;
}

// =============================================================================
// HELPERS
// =============================================================================

// Helper to check if user has active billing
function hasActiveBilling(status?: BillingStatus, periodEnd?: string): boolean {
  if (status === 'active' || status === 'trialing') {
    return true;
  }
  
  if (status === 'canceled' && periodEnd) {
    const endDate = new Date(periodEnd);
    const now = new Date();
    return endDate > now;
  }
  
  return false;
}

// Helper to check if role is a staff role (bypasses billing)
function isStaffRole(role?: UserRole): boolean {
  return role === 'editor' || role === 'coach' || role === 'admin' || role === 'super_admin';
}

// Helper to check if role can access editor section
function canAccessEditorSection(role?: UserRole): boolean {
  return role === 'editor' || role === 'super_admin';
}

// Helper to check if role can access admin section
function canAccessAdminSection(role?: UserRole): boolean {
  return role === 'admin' || role === 'super_admin';
}

// =============================================================================
// ROUTE MATCHERS
// =============================================================================

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/begin(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/start(.*)',  // Guest checkout flow - auth happens after payment
  '/invite(.*)',  // Smart invite links - page handles auth flow
  '/tenant-not-found',  // Tenant not found page
  '/access-denied',     // Access denied page
  '/api/webhooks(.*)',
  '/api/notifications/cron(.*)',  // Cron jobs - auth via CRON_SECRET header
  '/api/squad/validate-invite',  // Allow validating invite tokens without auth
  '/api/guest(.*)',  // Guest session APIs - no auth required
  '/api/quizzes(.*)',  // Quiz data for guest checkout flow - no auth required
  '/api/checkout/guest',  // Guest checkout - no auth required
  '/api/checkout/create-subscription',  // Guest subscription creation - no auth required
  '/api/checkout/check-existing-member',  // Check if email is already a member - used by guest flow
  '/api/guest/verify-payment-intent',  // Verify embedded checkout payment - no auth required
  '/api/identity/validate',  // Mission validation - used by guest flow
  '/api/goal/validate',  // Goal validation - used by guest flow
  '/api/tenant/resolve',  // Tenant resolution API - no auth required
  '/terms(.*)',
  '/privacy(.*)',
  '/refund-policy(.*)',
  '/subscription-policy(.*)',
]);

// Define admin routes that require admin role
const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
]);

// Define editor routes that require editor or super_admin role
const isEditorRoute = createRouteMatcher([
  '/editor(.*)',
]);

// Define editor API routes (discover content management + media upload + CMS)
const isEditorApiRoute = createRouteMatcher([
  '/api/admin/discover(.*)',
  '/api/admin/upload-media(.*)',
  '/api/admin/tracks(.*)',
  '/api/admin/starter-programs(.*)',
  '/api/admin/dynamic-prompts(.*)',
  '/api/admin/quizzes(.*)',
]);

// Define seed route that can bypass auth in development
const isSeedRoute = createRouteMatcher([
  '/api/admin/seed-discover',
]);

// Define routes that require active billing (protected app routes)
const requiresBilling = createRouteMatcher([
  '/habits(.*)',
  '/goal(.*)',
  '/checkin(.*)',
  '/chat(.*)',
  '/squad(.*)',
  '/profile(.*)',
  '/discover(.*)',
  '/coach(.*)',
  '/my-coach(.*)',
  '/call(.*)',
  '/get-coach(.*)',
  '/upgrade-premium(.*)',
  '/upgrade-squad(.*)',
  '/guided-monthly(.*)',
  '/guided-halfyear(.*)',
]);

// Routes that should never trigger guest session redirects
const isGuestFlowExemptRoute = createRouteMatcher([
  '/start(.*)',      // Already in guest flow
  '/sign-in(.*)',    // Auth pages
  '/sign-up(.*)',    // Auth pages
  '/api(.*)',        // API routes
  '/terms(.*)',      // Policy pages
  '/privacy(.*)',
  '/refund-policy(.*)',
  '/subscription-policy(.*)',
  '/invite(.*)',     // Invite links
  '/onboarding(.*)', // Original onboarding flow
  '/tenant-not-found',
  '/access-denied',
]);

// Routes that are only available on platform domain (not tenant domains)
const isPlatformOnlyRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
  '/editor(.*)',
]);

// =============================================================================
// TENANT RESOLUTION CACHE (simple in-memory for edge runtime)
// =============================================================================

// Note: This is a simple cache that will be per-instance.
// For production, you might want to use Vercel KV or similar.
interface TenantCacheEntry {
  orgId: string;
  subdomain: string;
  verifiedCustomDomain?: string;  // Custom domain to redirect subdomain requests to
  expiresAt: number;
}
const tenantCache = new Map<string, TenantCacheEntry | null>();
const CACHE_TTL = 60 * 1000; // 1 minute

interface ResolvedTenant {
  orgId: string;
  subdomain: string;
  verifiedCustomDomain?: string;  // Present when subdomain should redirect to custom domain
}

async function resolveTenantFromDb(
  subdomain?: string,
  customDomain?: string
): Promise<ResolvedTenant | null> {
  // Check cache first
  const cacheKey = subdomain ? `sub:${subdomain}` : `domain:${customDomain}`;
  const cached = tenantCache.get(cacheKey);
  if (cached !== undefined && (cached === null || cached.expiresAt > Date.now())) {
    return cached ? { orgId: cached.orgId, subdomain: cached.subdomain, verifiedCustomDomain: cached.verifiedCustomDomain } : null;
  }
  
  try {
    // Call internal API to resolve tenant (API has access to Firebase Admin)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const params = new URLSearchParams();
    if (subdomain) params.set('subdomain', subdomain);
    if (customDomain) params.set('domain', customDomain);
    
    const response = await fetch(`${baseUrl}/api/tenant/resolve?${params}`, {
      method: 'GET',
      headers: { 'x-internal-request': 'true' },
      // Short timeout to avoid blocking
      signal: AbortSignal.timeout(3000),
    });
    
    if (!response.ok) {
      tenantCache.set(cacheKey, null);
      return null;
    }
    
    const data = await response.json();
    if (data.organizationId) {
      const result: ResolvedTenant = { 
        orgId: data.organizationId, 
        subdomain: data.subdomain || subdomain || '',
        verifiedCustomDomain: data.verifiedCustomDomain || undefined,
      };
      tenantCache.set(cacheKey, { ...result, expiresAt: Date.now() + CACHE_TTL });
      return result;
    }
    
    tenantCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error('[MIDDLEWARE] Tenant resolution error:', error);
    // Don't cache errors - allow retry
    return null;
  }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

export default clerkMiddleware(async (auth, request) => {
  const hostname = request.headers.get('host') || 'localhost:3000';
  const pathname = request.nextUrl.pathname;
  
  // ==========================================================================
  // TENANT RESOLUTION
  // ==========================================================================
  
  let tenantOrgId: string | null = null;
  let tenantSubdomain: string | null = null;
  let isCustomDomain = false;
  let isTenantMode = false;
  
  // Check for dev override first
  const devOverride = getDevTenantOverride(request);
  if (devOverride) {
    const resolved = await resolveTenantFromDb(devOverride);
    if (resolved) {
      tenantOrgId = resolved.orgId;
      tenantSubdomain = resolved.subdomain;
      isTenantMode = true;
    } else {
      // Dev override specified but not found - redirect to not found
      console.warn(`[MIDDLEWARE] Dev tenant override "${devOverride}" not found`);
      return NextResponse.redirect(new URL('/tenant-not-found', request.url));
    }
  } else {
    // Parse hostname
    const parsed = parseHost(hostname);
    
    if (parsed.type === 'subdomain' && parsed.subdomain) {
      const resolved = await resolveTenantFromDb(parsed.subdomain);
      if (resolved) {
        // If this org has a verified custom domain, redirect subdomain to custom domain
        // EXCEPT for auth routes - those need to stay on subdomain for Clerk to work
        const isAuthRoute = pathname === '/sign-in' || pathname.startsWith('/sign-in/') ||
                           pathname === '/sign-up' || pathname.startsWith('/sign-up/') ||
                           pathname === '/begin' || 
                           pathname === '/sso-callback' || pathname.startsWith('/sso-callback/');
        
        if (resolved.verifiedCustomDomain && !isAuthRoute) {
          const redirectUrl = new URL(request.url);
          redirectUrl.host = resolved.verifiedCustomDomain;
          redirectUrl.port = '';
          console.log(`[MIDDLEWARE] Redirecting subdomain ${parsed.subdomain} to custom domain ${resolved.verifiedCustomDomain}`);
          return NextResponse.redirect(redirectUrl, 301);
        }
        
        tenantOrgId = resolved.orgId;
        tenantSubdomain = resolved.subdomain;
        isTenantMode = true;
      } else {
        // Unknown subdomain - show not found page
        console.log(`[MIDDLEWARE] Unknown subdomain: ${parsed.subdomain}`);
        // Don't redirect API routes - return 404 JSON
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }
        return NextResponse.redirect(new URL('/tenant-not-found', request.url));
      }
    } else if (parsed.type === 'custom_domain') {
      const resolved = await resolveTenantFromDb(undefined, parsed.hostname);
      if (resolved) {
        tenantOrgId = resolved.orgId;
        tenantSubdomain = resolved.subdomain;
        isCustomDomain = true;
        isTenantMode = true;
      } else {
        // Unknown custom domain - show not found page
        console.log(`[MIDDLEWARE] Unknown custom domain: ${parsed.hostname}`);
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }
        return NextResponse.redirect(new URL('/tenant-not-found', request.url));
      }
    }
    // platform mode - no tenant headers needed
  }
  
  // ==========================================================================
  // PLATFORM-ONLY ROUTES CHECK
  // ==========================================================================
  
  // Block admin/editor routes on tenant domains
  if (isTenantMode && isPlatformOnlyRoute(request)) {
    console.log(`[MIDDLEWARE] Platform-only route accessed on tenant domain: ${pathname}`);
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not available on tenant domains' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // ==========================================================================
  // SET TENANT HEADERS
  // ==========================================================================
  
  // Create response with tenant headers for downstream use
  const response = NextResponse.next();
  
  if (isTenantMode && tenantOrgId) {
    response.headers.set('x-tenant-org-id', tenantOrgId);
    response.headers.set('x-tenant-subdomain', tenantSubdomain || '');
    response.headers.set('x-tenant-is-custom-domain', isCustomDomain ? 'true' : 'false');
    response.headers.set('x-tenant-hostname', hostname);
  }
  
  // ==========================================================================
  // EXISTING MIDDLEWARE LOGIC
  // ==========================================================================
  
  // Allow seed route in development without auth
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev && isSeedRoute(request)) {
    return response;
  }

  // Get auth state
  const { userId, sessionClaims } = await auth();
  
  // ==========================================================================
  // TENANT MEMBERSHIP ENFORCEMENT
  // ==========================================================================
  
  // If in tenant mode and user is signed in, verify they belong to this org
  if (isTenantMode && userId && tenantOrgId) {
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userOrgId = publicMetadata?.organizationId;
    const userRole = publicMetadata?.role;
    
    // Platform admins can only bypass on platform domain, not tenant domains
    // On tenant domains, even admins must be org members
    if (userOrgId !== tenantOrgId) {
      // User is not a member of this tenant's organization
      console.log(`[MIDDLEWARE] User ${userId} not member of tenant org ${tenantOrgId} (user org: ${userOrgId})`);
      
      // Allow public routes even if not a member
      if (!isPublicRoute(request)) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Access denied: Not a member of this organization' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/access-denied', request.url));
      }
    }
  }
  
  // ==========================================================================
  // GUEST SESSION REDIRECT LOGIC
  // ==========================================================================
  
  if (!userId) {
    const guestSessionId = request.cookies.get('ga_guest_session_id')?.value;
    const guestStep = request.cookies.get('ga_guest_step')?.value;
    
    // If user has a guest session and is NOT on an exempt route, redirect to their step
    if (guestSessionId && !isGuestFlowExemptRoute(request)) {
      const targetStep = (guestStep === 'welcome' || guestStep === 'start') ? null : guestStep;
      const redirectPath = targetStep ? `/start/${targetStep}` : '/start';
      console.log(`[MIDDLEWARE] Guest session found, redirecting to ${redirectPath}`);
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    
    // If user has NO guest session and is visiting root, redirect to /begin
    // EXCEPTION: If from_auth=1 is present on a custom domain, skip redirect to let ClerkProvider sync
    if (!guestSessionId && pathname === '/') {
      const fromAuth = request.nextUrl.searchParams.get('from_auth') === '1';
      
      // On custom domains coming from auth, let the page load so ClerkProvider can sync the session
      if (isCustomDomain && fromAuth) {
        console.log('[MIDDLEWARE] Skipping auth redirect for satellite session sync');
        // Continue to page - ClerkProvider will sync session client-side
      } else {
        const isReturningUser = request.cookies.get('ga_returning_user')?.value === 'true';
        const redirectUrl = isReturningUser ? '/sign-in' : '/begin';
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    }
    
    // Redirect if user has a saved step that's NOT the welcome page
    if (pathname === '/start' && guestStep && guestStep !== 'welcome' && guestStep !== 'start') {
      return NextResponse.redirect(new URL(`/start/${guestStep}`, request.url));
    }
  }

  // REDIRECT SIGNED-IN USERS AWAY FROM /start (guest checkout flow)
  // Exception: Allow access to /start/profile and /start/complete for post-payment setup
  if (userId && pathname.startsWith('/start')) {
    const allowedPostPaymentPaths = ['/start/profile', '/start/complete'];
    const isPostPaymentPath = allowedPostPaymentPaths.some(path => pathname.startsWith(path));
    
    if (!isPostPaymentPath) {
      return NextResponse.redirect('https://pro.growthaddicts.com');
    }
  }

  // REDIRECT SIGNED-IN USERS AWAY FROM /sign-in
  if (userId && pathname.startsWith('/sign-in')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Protect non-public routes (require authentication)
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  // Get role from JWT for access control
  const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
  const role = publicMetadata?.role;

  // BILLING CHECK: For authenticated users on protected app routes
  if (userId && requiresBilling(request)) {
    if (!isStaffRole(role)) {
      const billingStatus = publicMetadata?.billingStatus;
      const billingPeriodEnd = publicMetadata?.billingPeriodEnd;
      
      if (!hasActiveBilling(billingStatus, billingPeriodEnd)) {
        console.log(`[MIDDLEWARE] User ${userId} blocked: billingStatus=${billingStatus}, redirecting to /onboarding/plan`);
        return NextResponse.redirect(new URL('/onboarding/plan', request.url));
      }
    }
  }

  // Check editor access for editor routes (editor or super_admin only)
  if (isEditorRoute(request)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    if (!canAccessEditorSection(role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Check editor API access
  if (isEditorApiRoute(request)) {
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  // Check admin access for admin routes (admin or super_admin only)
  else if (isAdminRoute(request)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    if (!canAccessAdminSection(role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Redirect authenticated users from homepage to dashboard or plan page based on billing
  if (userId && pathname === '/') {
    response.cookies.set('ga_returning_user', 'true', {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }

  // Set returning user cookie for authenticated users
  if (userId) {
    response.cookies.set('ga_returning_user', 'true', {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }
  
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
