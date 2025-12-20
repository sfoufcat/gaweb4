import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantBySubdomain, getTenantByCustomDomain, type TenantConfigData, DEFAULT_TENANT_BRANDING } from '@/lib/tenant-edge-config';

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
  // Multi-org support
  primaryOrganizationId?: string;  // Last active / default org
  organizationId?: string;         // @deprecated - use primaryOrganizationId
  // Coaching (separate from membership tier)
  coaching?: boolean; // Legacy flag - true if has active coaching
  coachingStatus?: CoachingStatus; // New: detailed coaching status
  coachingPlan?: 'monthly' | 'quarterly'; // New: coaching plan type
}

// =============================================================================
// DOMAIN CONFIGURATION (Inline for Edge Runtime compatibility)
// =============================================================================

// Base domain - change this to switch to growthaddicts.com in the future
const BASE_DOMAIN = 'growthaddicts.app';
const PLATFORM_ADMIN_DOMAIN = `app.${BASE_DOMAIN}`;
const MARKETING_DOMAIN = BASE_DOMAIN;

// Platform domains that are NOT tenant-scoped
const PLATFORM_DOMAINS = [
  BASE_DOMAIN,                        // Marketing domain
  `www.${BASE_DOMAIN}`,              // www variant
  PLATFORM_ADMIN_DOMAIN,             // Platform admin domain
  'pro.growthaddicts.com',           // Legacy domain
  'www.pro.growthaddicts.com',       // Legacy www variant
];

// Development hosts treated as platform mode
const DEV_HOSTS = ['localhost', '127.0.0.1'];

// Helper to check if hostname is platform admin domain
function isPlatformAdminDomain(hostname: string): boolean {
  return hostname.toLowerCase().split(':')[0] === PLATFORM_ADMIN_DOMAIN;
}

// Helper to check if hostname is marketing domain
function isMarketingDomain(hostname: string): boolean {
  const normalized = hostname.toLowerCase().split(':')[0];
  return normalized === MARKETING_DOMAIN || normalized === `www.${MARKETING_DOMAIN}`;
}

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
  
  // Check for subdomain of the base domain
  const subdomainPattern = new RegExp(`^([a-z0-9-]+)\\.${BASE_DOMAIN.replace('.', '\\.')}$`);
  const subdomainMatch = normalizedHost.match(subdomainPattern);
  if (subdomainMatch) {
    const subdomain = subdomainMatch[1];
    // www and app are platform domains, not tenant subdomains
    if (subdomain === 'www' || subdomain === 'app') {
      return { type: 'platform', hostname: normalizedHost };
    }
    return { type: 'subdomain', hostname: normalizedHost, subdomain };
  }
  
  // Check for subdomain of pro.growthaddicts.com (legacy)
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
  '/api/org/branding',  // Branding API - needs to work for SSR before auth is established
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
// TENANT RESOLUTION (via Vercel Edge Config)
// =============================================================================

interface ResolvedTenant {
  orgId: string;
  subdomain: string;
  verifiedCustomDomain?: string;  // Present when subdomain should redirect to custom domain
  configData?: TenantConfigData;      // Full Edge Config data for branding cookie
}

/**
 * Resolve tenant from Vercel Edge Config
 * Ultra-fast Edge-compatible lookup - no HTTP calls needed
 */
async function resolveTenantFromEdgeConfig(
  subdomain?: string,
  customDomain?: string
): Promise<ResolvedTenant | null> {
  try {
    let configData: TenantConfigData | null = null;
    
    if (subdomain) {
      configData = await getTenantBySubdomain(subdomain);
    } else if (customDomain) {
      configData = await getTenantByCustomDomain(customDomain);
    }
    
    if (configData) {
      return {
        orgId: configData.organizationId,
        subdomain: configData.subdomain,
        verifiedCustomDomain: configData.verifiedCustomDomain,
        configData,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[MIDDLEWARE] Edge Config tenant resolution error:', error);
    return null;
  }
}

/**
 * Fallback: Resolve tenant via API when Edge Config is empty/not available
 * This ensures new tenants work before Edge Config is populated
 */
async function resolveTenantFromApi(
  subdomain?: string,
  customDomain?: string
): Promise<ResolvedTenant | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const params = new URLSearchParams();
    if (subdomain) params.set('subdomain', subdomain);
    if (customDomain) params.set('domain', customDomain);
    
    const response = await fetch(`${baseUrl}/api/tenant/resolve?${params}`, {
      method: 'GET',
      headers: { 'x-internal-request': 'true' },
      signal: AbortSignal.timeout(3000),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    if (data.organizationId) {
      return { 
        orgId: data.organizationId, 
        subdomain: data.subdomain || subdomain || '',
        verifiedCustomDomain: data.verifiedCustomDomain || undefined,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[MIDDLEWARE] API tenant resolution fallback error:', error);
    return null;
  }
}

/**
 * Resolve tenant - tries Edge Config first, falls back to API
 */
async function resolveTenant(
  subdomain?: string,
  customDomain?: string
): Promise<ResolvedTenant | null> {
  // Try Edge Config first (ultra-fast, ~0ms)
  const edgeResult = await resolveTenantFromEdgeConfig(subdomain, customDomain);
  if (edgeResult) {
    return edgeResult;
  }
  
  // Fallback to API (slower but ensures new tenants work)
  console.log(`[MIDDLEWARE] Edge Config miss for ${subdomain || customDomain}, falling back to API`);
  return resolveTenantFromApi(subdomain, customDomain);
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

export default clerkMiddleware(async (auth, request) => {
  const hostname = request.headers.get('host') || 'localhost:3000';
  const pathname = request.nextUrl.pathname;
  
  // ==========================================================================
  // CORS PREFLIGHT HANDLING
  // ==========================================================================
  
  // Handle OPTIONS preflight requests immediately
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,DELETE,PATCH,POST,PUT,OPTIONS',
        'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-tenant-org-id, x-internal-request',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  // ==========================================================================
  // TENANT RESOLUTION
  // ==========================================================================
  
  let tenantOrgId: string | null = null;
  let tenantSubdomain: string | null = null;
  let isCustomDomain = false;
  let isTenantMode = false;
  let tenantConfigData: TenantConfigData | null = null;  // Store branding data for cookie
  
  // Check for dev override first
  const devOverride = getDevTenantOverride(request);
  if (devOverride) {
    const resolved = await resolveTenant(devOverride);
    if (resolved) {
      tenantOrgId = resolved.orgId;
      tenantSubdomain = resolved.subdomain;
      tenantConfigData = resolved.configData || null;
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
      const resolved = await resolveTenant(parsed.subdomain);
      if (resolved) {
        // If this org has a verified custom domain, redirect subdomain to custom domain
        // EXCEPT for auth routes - those need to stay on subdomain for Clerk to work
        const isAuthRoute = pathname === '/sign-in' || pathname.startsWith('/sign-in/') ||
                           pathname === '/sign-up' || pathname.startsWith('/sign-up/') ||
                           pathname.startsWith('/begin') || 
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
        tenantConfigData = resolved.configData || null;
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
      const resolved = await resolveTenant(undefined, parsed.hostname);
      if (resolved) {
        tenantOrgId = resolved.orgId;
        tenantSubdomain = resolved.subdomain;
        tenantConfigData = resolved.configData || null;
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
  // DOMAIN-SPECIFIC ROUTING
  // ==========================================================================
  
  // Marketing domain: Only allow public/marketing routes
  // The main domain is reserved for marketing, users should go to tenant domains
  if (isMarketingDomain(hostname)) {
    // Allow marketing-related routes
    const isMarketingRoute = 
      pathname === '/' || 
      pathname.startsWith('/begin') ||
      pathname.startsWith('/start') ||  // Guest checkout flow
      pathname.startsWith('/sign-in') ||
      pathname.startsWith('/sign-up') ||
      pathname.startsWith('/terms') ||
      pathname.startsWith('/privacy') ||
      pathname.startsWith('/refund-policy') ||
      pathname.startsWith('/subscription-policy') ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/sso-callback');
    
    // If user is authenticated and tries to access app routes on marketing domain,
    // they should be on a tenant domain or app.growthaddicts.app
    // For now, allow this but in the future could redirect to their primary org
  }
  
  // Platform admin domain: Restrict to super_admins only for admin routes
  if (isPlatformAdminDomain(hostname)) {
    // On platform admin domain, admin routes require super_admin role
    // This is handled later in the admin route checks with the auth state
  }
  
  // ==========================================================================
  // SET TENANT HEADERS AND COOKIES
  // ==========================================================================
  
  // Create modified request headers to pass tenant info to API routes
  const requestHeaders = new Headers(request.headers);
  
  if (isTenantMode && tenantOrgId) {
    // Set headers on REQUEST so API routes can read them
    requestHeaders.set('x-tenant-org-id', tenantOrgId);
    requestHeaders.set('x-tenant-subdomain', tenantSubdomain || '');
    requestHeaders.set('x-tenant-is-custom-domain', isCustomDomain ? 'true' : 'false');
    requestHeaders.set('x-tenant-hostname', hostname);
  }
  
  // Create response with modified request headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  if (isTenantMode && tenantOrgId) {
    // Also set headers on response for client-side access if needed
    response.headers.set('x-tenant-org-id', tenantOrgId);
    response.headers.set('x-tenant-subdomain', tenantSubdomain || '');
    response.headers.set('x-tenant-is-custom-domain', isCustomDomain ? 'true' : 'false');
    response.headers.set('x-tenant-hostname', hostname);
    
    // Set branding cookie for SSR access (JSON-encoded, httpOnly for security)
    // This allows Server Components to read branding without additional API calls
    const brandingData = tenantConfigData?.branding || DEFAULT_TENANT_BRANDING;
    const tenantCookieData = {
      orgId: tenantOrgId,
      subdomain: tenantSubdomain,
      branding: brandingData,
    };
    
    response.cookies.set('ga_tenant_context', JSON.stringify(tenantCookieData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours - will be refreshed on each request
    });
  } else {
    // Platform mode - clear tenant cookie if exists
    response.cookies.delete('ga_tenant_context');
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
  // TENANT MEMBERSHIP ENFORCEMENT (Multi-Org Support)
  // ==========================================================================
  
  // If in tenant mode and user is signed in, verify they belong to this org
  // Uses Clerk session claims only - no HTTP calls needed
  if (isTenantMode && userId && tenantOrgId) {
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    
    // Check membership using session claims only (fast, no HTTP):
    // 1. Clerk's native organization context
    const { orgId: clerkOrgId } = await auth();
    
    // 2. publicMetadata.primaryOrganizationId (new multi-org field)
    const primaryOrgId = publicMetadata?.primaryOrganizationId;
    
    // 3. publicMetadata.organizationId (legacy field)
    const legacyOrgId = publicMetadata?.organizationId;
    
    // Check if any metadata matches the tenant org
    // Note: For multi-org, org_memberships is checked server-side in protected routes
    // Middleware just does fast session-based check
    const isMember = 
      clerkOrgId === tenantOrgId || 
      primaryOrgId === tenantOrgId || 
      legacyOrgId === tenantOrgId;
    
    if (!isMember) {
      // User's session doesn't indicate membership in this org
      // Allow public routes - they might be signing up for this org
      // Protected routes will do deeper membership checks server-side
      console.log(`[MIDDLEWARE] User ${userId} session doesn't match tenant org ${tenantOrgId}`);
      
      // Only block non-public routes
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
    // For API routes, return JSON 401 instead of redirecting to sign-in HTML
    if (pathname.startsWith('/api/') && !userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }
    // For non-API routes, use Clerk's standard protection (redirect to sign-in)
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
