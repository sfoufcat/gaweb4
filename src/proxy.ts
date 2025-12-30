import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantBySubdomain, getTenantByCustomDomain, type TenantConfigData, DEFAULT_TENANT_BRANDING } from '@/lib/tenant-edge-config';
import { shouldRedirectToFunnel, getFunnelRedirectUrl } from '@/lib/funnel-redirects';

// Billing status types (must match admin-utils-clerk.ts)
type BillingStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
// @deprecated UserTier is deprecated - access controlled by program/squad membership
type UserTier = 'free' | 'standard' | 'premium';
type UserRole = 'user' | 'editor' | 'coach' | 'admin' | 'super_admin';
// Coaching status - separate from membership
type CoachingStatus = 'none' | 'active' | 'canceled' | 'past_due';
// Coach platform tier
type CoachTier = 'starter' | 'pro' | 'scale';
type CoachSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

interface ClerkPublicMetadata {
  role?: UserRole;
  billingStatus?: BillingStatus;
  billingPeriodEnd?: string;
  /** @deprecated UserTier is deprecated - access controlled by program/squad membership */
  tier?: UserTier;
  // Multi-org support
  primaryOrganizationId?: string;  // Last active / default org
  /** @deprecated Use primaryOrganizationId instead */
  organizationId?: string;
  // Coaching (separate from membership tier)
  coaching?: boolean; // Legacy flag - true if has active coaching
  coachingStatus?: CoachingStatus; // New: detailed coaching status
  coachingPlan?: 'monthly' | 'quarterly'; // New: coaching plan type
}

/**
 * Clerk Organization publicMetadata for coach billing
 * Synced from Stripe webhooks for fast middleware access
 */
interface ClerkOrgPublicMetadata {
  plan?: CoachTier;
  subscriptionStatus?: CoachSubscriptionStatus;
  currentPeriodEnd?: string;
  trialEnd?: string;
  cancelAtPeriodEnd?: boolean;
  graceEndsAt?: string;
  onboardingState?: 'needs_profile' | 'needs_plan' | 'active';
}

/**
 * Check if org subscription is active for coach dashboard access
 * Includes grace period support for payment failures
 */
function hasActiveOrgSubscription(
  status?: CoachSubscriptionStatus,
  currentPeriodEnd?: string,
  cancelAtPeriodEnd?: boolean,
  graceEndsAt?: string
): boolean {
  // Active or trialing = full access
  if (status === 'active' || status === 'trialing') {
    return true;
  }
  
  // Past due but within grace period = allow access with warning
  if (status === 'past_due' && graceEndsAt) {
    const graceEnd = new Date(graceEndsAt);
    const now = new Date();
    if (graceEnd > now) {
      return true; // Still within grace period
    }
  }
  
  // Canceled but still in paid period
  if ((status === 'canceled' || cancelAtPeriodEnd) && currentPeriodEnd) {
    const endDate = new Date(currentPeriodEnd);
    const now = new Date();
    return endDate > now;
  }
  
  return false;
}

// =============================================================================
// DOMAIN CONFIGURATION (Inline for Edge Runtime compatibility)
// =============================================================================

// Base domain - migrated to growthaddicts.com
const BASE_DOMAIN = 'growthaddicts.com';
const PLATFORM_ADMIN_DOMAIN = `app.${BASE_DOMAIN}`;
const MARKETING_DOMAIN = BASE_DOMAIN;

// Platform domains that are NOT tenant-scoped
const PLATFORM_DOMAINS = [
  BASE_DOMAIN,                        // Marketing domain
  `www.${BASE_DOMAIN}`,              // www variant
  PLATFORM_ADMIN_DOMAIN,             // Platform admin domain
  'pro.growthaddicts.com',           // Legacy domain
  'www.pro.growthaddicts.com',       // Legacy www variant
  'growthaddicts.app',               // Legacy domain after .com migration
  'www.growthaddicts.app',           // Legacy www variant
  'app.growthaddicts.app',           // Legacy platform admin domain
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
  
  // Check for subdomain of growthaddicts.app (legacy after .com migration)
  // This is a fallback - redirects should happen before this, but this ensures tenant resolution works
  const legacyAppSubdomainMatch = normalizedHost.match(/^([a-z0-9-]+)\.growthaddicts\.app$/);
  if (legacyAppSubdomainMatch) {
    const subdomain = legacyAppSubdomainMatch[1];
    if (subdomain === 'www' || subdomain === 'app') {
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
  '/join(.*)',     // Unified funnel system (replaces /begin)
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/start(.*)',  // Guest checkout flow - auth happens after payment
  '/invite(.*)',  // Smart invite links - page handles auth flow
  '/auth/sync(.*)',  // Session handoff for custom domains - handles its own auth
  '/tenant-not-found',  // Tenant not found page
  '/access-denied',     // Access denied page
  '/marketplace(.*)',   // Public marketplace - coach discovery
  '/coach/complete-signup',  // Coach OAuth completion - handles org creation
  '/coach/onboarding(.*)',   // Coach onboarding - pages verify auth via API
  '/api/webhooks(.*)',
  '/api/notifications/cron(.*)',  // Cron jobs - auth via CRON_SECRET header
  '/api/squad/validate-invite',  // Allow validating invite tokens without auth
  '/api/funnel(.*)',  // Funnel data for funnel flow - no auth required
  '/api/checkout/check-existing-member',  // Check if email is already a member
  '/api/identity/validate',  // Mission validation - used by funnel flow
  '/api/goal/validate',  // Goal validation - used by funnel flow
  '/api/goal/save',      // Goal save - used during onboarding (has own auth check)
  '/api/tenant/resolve',  // Tenant resolution API - no auth required
  '/api/org/branding',  // Branding API - needs to work for SSR before auth is established
  '/api/marketplace/listings',  // Public marketplace listings API
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
  '/feed(.*)',       // Social feed - requires active billing, feature-gated by feedEnabled
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

// Routes that are only available on platform domain (not tenant domains)
const isPlatformOnlyRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
  '/editor(.*)',
]);

// =============================================================================
// PLAN-GATED ROUTES (Coach Dashboard)
// =============================================================================

// Routes that require Pro+ plan
const requiresProPlan = createRouteMatcher([
  '/coach/domain(.*)',        // Custom domain settings
  '/coach/email-settings(.*)', // Email whitelabel settings
]);

// Routes that require Scale plan
const requiresScalePlan = createRouteMatcher([
  '/coach/team(.*)',          // Team management
  '/coach/roles(.*)',         // Role/permission settings
  '/coach/ai(.*)',            // AI helper routes
]);

// Coach dashboard routes that require active subscription
const isCoachDashboardRoute = createRouteMatcher([
  '/coach',
  '/coach/(.*)',
]);

// Coach plan page (always accessible for upgrade)
const isCoachPlanPage = createRouteMatcher([
  '/coach/plan',
  '/coach/plan/(.*)',
]);

// Coach reactivate page (accessible without active subscription)
const isCoachReactivatePage = createRouteMatcher([
  '/coach/reactivate',
  '/coach/reactivate/(.*)',
]);

// Platform deactivated page (shown to members when subscription is inactive)
const isPlatformDeactivatedPage = createRouteMatcher([
  '/platform-deactivated',
]);

// Routes that should NEVER be blocked by subscription status
// These are essential for auth flow and lockout pages
const isAlwaysAllowedRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/signup(.*)',
  '/sso-callback(.*)',
  '/platform-deactivated',
  '/access-denied',
  '/tenant-not-found',
  '/api/auth(.*)',
  '/api/webhooks(.*)',
  '/api/tenant/resolve',
  '/api/org/branding',
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
 * 
 * The API now returns branding data, which we use to build configData
 * for the middleware to set the correct branding cookie.
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
      // Build configData from API response for branding cookie
      const configData: TenantConfigData | undefined = data.branding ? {
        organizationId: data.organizationId,
        subdomain: data.subdomain || subdomain || '',
        branding: data.branding,
        coachingPromo: data.coachingPromo,
        verifiedCustomDomain: data.verifiedCustomDomain,
        updatedAt: new Date().toISOString(),
      } : undefined;
      
      return { 
        orgId: data.organizationId, 
        subdomain: data.subdomain || subdomain || '',
        verifiedCustomDomain: data.verifiedCustomDomain || undefined,
        configData,
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

export const proxy = clerkMiddleware(async (auth, request) => {
  const hostname = request.headers.get('host') || 'localhost:3000';
  const pathname = request.nextUrl.pathname;
  
  // ==========================================================================
  // STATIC FILE BYPASS (Safety check - should already be excluded by matcher)
  // ==========================================================================
  
  // Explicitly skip static files to prevent any processing issues
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') && (
      pathname.endsWith('.css') ||
      pathname.endsWith('.js') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.gif') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.ico') ||
      pathname.endsWith('.woff') ||
      pathname.endsWith('.woff2') ||
      pathname.endsWith('.ttf')
    )
  ) {
    return NextResponse.next();
  }
  
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
  // LEGACY DOMAIN REDIRECT (growthaddicts.app -> growthaddicts.com)
  // ==========================================================================
  
  // Redirect legacy .app subdomains to .com subdomains (permanent redirect for SEO)
  const normalizedHostname = hostname.toLowerCase().split(':')[0];
  const legacySubdomainMatch = normalizedHostname.match(/^([a-z0-9-]+)\.growthaddicts\.app$/);
  if (legacySubdomainMatch) {
    const subdomain = legacySubdomainMatch[1];
    // Skip www/app as these are handled by vercel.json redirects
    if (subdomain !== 'www' && subdomain !== 'app') {
      const newUrl = new URL(request.url);
      newUrl.host = `${subdomain}.growthaddicts.com`;
      newUrl.port = '';
      console.log(`[MIDDLEWARE] Redirecting legacy subdomain ${subdomain}.growthaddicts.app to ${subdomain}.growthaddicts.com`);
      return NextResponse.redirect(newUrl, 301);
    }
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
                           pathname.startsWith('/join') ||  // Funnel system needs subdomain for auth iframes
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
        // Redirect to platform domain to avoid infinite loop
        // (redirecting to /tenant-not-found on the same unknown subdomain would cause a loop)
        return NextResponse.redirect(`https://${BASE_DOMAIN}/tenant-not-found`);
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
        // Redirect to platform domain to avoid infinite loop
        // (redirecting to /tenant-not-found on the same unknown custom domain would cause a loop)
        return NextResponse.redirect(`https://${BASE_DOMAIN}/tenant-not-found`);
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
  // LEGACY PATH REDIRECTS (/start, /begin -> /join)
  // ==========================================================================
  
  // Redirect legacy quiz paths to the new unified funnel system
  if (shouldRedirectToFunnel(pathname)) {
    const searchParams = request.nextUrl.searchParams;
    const redirectUrl = getFunnelRedirectUrl(pathname, searchParams, tenantOrgId);
    
    if (redirectUrl) {
      console.log(`[MIDDLEWARE] Legacy funnel redirect: ${pathname} -> ${redirectUrl}`);
      return NextResponse.redirect(new URL(redirectUrl, request.url), 302);
    }
  }
  
  // ==========================================================================
  // DOMAIN-SPECIFIC ROUTING
  // ==========================================================================
  
  // Marketing domain: Show marketplace as landing page
  // The main domain is reserved for marketing only - no app features
  // Users must go to tenant domains or app.growthaddicts.com for the app
  if (isMarketingDomain(hostname)) {
    // Redirect /marketplace to / (canonical URL - avoid duplicate content)
    if (pathname === '/marketplace') {
      return NextResponse.redirect(new URL('/', request.url), 301);
    }
    
    // Rewrite / to /marketplace (show marketplace content at root URL)
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/marketplace';
      const response = NextResponse.rewrite(url);
      // Set fullscreen layout mode to hide sidebar (rewrite returns early before normal header setting)
      response.headers.set('x-layout-mode', 'fullscreen');
      return response;
    }
    
    // Only allow public/marketing routes on marketing domain
    const isAllowedRoute = 
      pathname.startsWith('/join') ||           // Funnel system
      pathname.startsWith('/sign-in') ||        // Auth
      pathname.startsWith('/sign-up') ||        // Auth
      pathname.startsWith('/signup') ||         // Auth (alt)
      pathname.startsWith('/sso-callback') ||   // Auth callback
      pathname.startsWith('/terms') ||          // Legal
      pathname.startsWith('/privacy') ||        // Legal
      pathname.startsWith('/refund-policy') ||  // Legal
      pathname.startsWith('/subscription-policy') || // Legal
      pathname.startsWith('/api/') ||           // API routes
      pathname.startsWith('/_next/') ||         // Next.js assets
      pathname.startsWith('/static/');          // Static assets
    
    // Redirect any non-allowed routes to platform domain
    if (!isAllowedRoute) {
      console.log(`[PROXY] Marketing domain blocking app route: ${pathname}, redirecting to app.growthaddicts.com`);
      return NextResponse.redirect(`https://app.growthaddicts.com${pathname}`, 302);
    }
  }
  
  // Platform admin domain: Restrict to super_admins only
  // Regular users and coaches should use their tenant subdomains, not app.growthaddicts.com
  if (isPlatformAdminDomain(hostname)) {
    // Allow public routes (auth, api, static assets, access-denied page)
    const isPlatformPublicRoute = 
      pathname.startsWith('/sign-in') ||
      pathname.startsWith('/sign-up') ||
      pathname.startsWith('/sso-callback') ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/static/') ||
      pathname === '/access-denied' ||
      pathname === '/favicon.ico';
    
    if (!isPlatformPublicRoute) {
      // Check if user is super_admin
      const { userId, sessionClaims } = await auth();
      const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
      
      if (!userId || role !== 'super_admin') {
        console.log(`[PROXY] Platform domain access denied for user ${userId}, role: ${role}`);
        return NextResponse.redirect(new URL('/access-denied', request.url));
      }
    }
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
  
  // ==========================================================================
  // LAYOUT MODE HEADER (for SSR layout shift prevention)
  // ==========================================================================
  
  // Determine if this is a fullscreen page (no sidebar) during SSR
  // This prevents layout shift by letting the layout know the mode before hydration
  const searchParams = request.nextUrl.searchParams;
  const isProfileEditOnboarding = pathname === '/profile' && 
    searchParams.get('edit') === 'true' && 
    searchParams.get('fromOnboarding') === 'true';
  
  const isFullscreenPage = 
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/start') ||
    pathname.startsWith('/checkin') ||
    pathname.startsWith('/join') ||
    pathname.startsWith('/sign-in') ||
    pathname === '/upgrade-premium/form' ||
    pathname === '/get-coach/form' ||
    pathname.startsWith('/invite') ||
    isProfileEditOnboarding;
  
  requestHeaders.set('x-layout-mode', isFullscreenPage ? 'fullscreen' : 'with-sidebar');
  
  // Create response with modified request headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // ==========================================================================
  // TENANT COOKIE MANAGEMENT (with proper isolation)
  // ==========================================================================
  
  // Check if existing cookie matches current context to prevent branding leakage
  // between different tenants or from tenant to platform domain
  const existingCookie = request.cookies.get('ga_tenant_context');
  let existingOrgId: string | null = null;
  
  if (existingCookie) {
    try {
      const existing = JSON.parse(existingCookie.value);
      existingOrgId = existing.orgId || null;
    } catch {
      // Invalid cookie, will be replaced
    }
  }
  
  if (isTenantMode && tenantOrgId) {
    // Also set headers on response for client-side access if needed
    response.headers.set('x-tenant-org-id', tenantOrgId);
    response.headers.set('x-tenant-subdomain', tenantSubdomain || '');
    response.headers.set('x-tenant-is-custom-domain', isCustomDomain ? 'true' : 'false');
    response.headers.set('x-tenant-hostname', hostname);
    
    // Set branding cookie for SSR access (JSON-encoded, httpOnly for security)
    // This allows Server Components to read branding without additional API calls
    // Always set the cookie to ensure correct tenant context (handles switching between tenants)
    const brandingData = tenantConfigData?.branding || DEFAULT_TENANT_BRANDING;
    const coachingPromoData = tenantConfigData?.coachingPromo; // May be undefined
    const feedEnabledData = tenantConfigData?.feedEnabled === true; // Feed enabled flag for instant SSR
    const programEmptyStateData = tenantConfigData?.programEmptyStateBehavior || 'discover';
    const squadEmptyStateData = tenantConfigData?.squadEmptyStateBehavior || 'discover';
    const tenantCookieData = {
      orgId: tenantOrgId,
      subdomain: tenantSubdomain,
      branding: brandingData,
      feedEnabled: feedEnabledData,
      coachingPromo: coachingPromoData,
      programEmptyStateBehavior: programEmptyStateData,
      squadEmptyStateBehavior: squadEmptyStateData,
    };
    
    // Log when replacing a different tenant's cookie (for debugging)
    if (existingOrgId && existingOrgId !== tenantOrgId) {
      console.log(`[MIDDLEWARE] Replacing tenant cookie: ${existingOrgId} -> ${tenantOrgId}`);
    }
    
    response.cookies.set('ga_tenant_context', JSON.stringify(tenantCookieData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours - will be refreshed on each request
    });
  } else {
    // Platform mode - force-clear tenant cookie by setting to empty with immediate expiration
    // This is more reliable than cookies.delete() which may not work across subdomains
    if (existingCookie) {
      console.log(`[MIDDLEWARE] Clearing tenant cookie on platform domain (was: ${existingOrgId})`);
    }
    response.cookies.set('ga_tenant_context', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Immediate expiration - forces browser to delete
    });
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
  
  // REDIRECT SIGNED-IN USERS AWAY FROM /sign-in
  if (userId && pathname.startsWith('/sign-in')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Protect non-public routes (require authentication)
  if (!isPublicRoute(request) && !userId) {
    // For API routes, return JSON 401 instead of redirecting to sign-in HTML
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }
    // For non-API routes, redirect to custom /sign-in page with return URL
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', request.url);
    return NextResponse.redirect(signInUrl);
  }

  // Get role from JWT for access control
  const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
  const role = publicMetadata?.role;

  // ==========================================================================
  // USER ACCESS CHECK (Multi-Tenant)
  // ==========================================================================
  
  // In tenant mode, users need "active access" to use the app.
  // Active access is granted by:
  // 1. Active program enrollment
  // 2. Active squad membership
  // 3. Coach-assigned access
  // 4. Staff roles (coach, super_coach, admin)
  //
  // The hasActiveAccess field is stored in org_memberships and should be
  // synced to a fast-access store (cookie/session) when it changes.
  // For now, API routes/pages do the actual check against Firestore.
  //
  // When user doesn't have access, redirect to org's default funnel.
  
  if (isTenantMode && userId && requiresBilling(request)) {
    if (!isStaffRole(role)) {
      // In tenant mode, the billing check is different - we check org-level access
      // The actual hasActiveAccess check happens in API routes since it requires Firestore
      // Middleware just does a fast pre-check using session claims
      
      // TODO: Add fast-access check when hasActiveAccess is synced to session claims
      // For now, let the request through and let the API/page do the full check
      
      // SECURITY NOTE: When implementing hasActiveAccess checks, ALWAYS use safe patterns:
      //   SAFE:   if (hasOrgAccess !== true) { deny }  // undefined = denied
      //   SAFE:   if (!hasOrgAccess) { deny }          // undefined is falsy = denied
      //   UNSAFE: if (hasOrgAccess !== false) { allow } // undefined !== false = allowed!
      //
      // The hasActiveAccess field is optional and may be undefined on older records.
      // Always treat undefined as "no access" (deny by default).
      
      // Example future implementation:
      // const hasOrgAccess = publicMetadata?.orgAccessMap?.[tenantOrgId]?.hasActiveAccess;
      // if (hasOrgAccess !== true) {  // SAFE: undefined or false = denied
      //   // Redirect to org's default funnel
      //   const funnelUrl = await getOrgDefaultFunnelUrl(tenantOrgId);
      //   return NextResponse.redirect(new URL(funnelUrl || '/sign-in?access=required', request.url));
      // }
    }
  } else if (userId && requiresBilling(request)) {
    // PLATFORM MODE BILLING CHECK: For authenticated users on protected app routes
    if (!isStaffRole(role)) {
      // Skip billing check for coaches in coach onboarding flow
      // Coaches with an organizationId but no billing yet need to complete their onboarding
      const isCoachOnboarding = pathname?.startsWith('/coach/onboarding');
      const isCoachWelcome = pathname?.startsWith('/coach/welcome');
      const hasOrganization = !!publicMetadata?.organizationId || !!publicMetadata?.primaryOrganizationId;
      
      if (hasOrganization && (isCoachOnboarding || isCoachWelcome)) {
        // Coach in onboarding - let them through to complete their setup
        console.log(`[MIDDLEWARE] Coach ${userId} on onboarding route, allowing access`);
        return response;
      }
      
      // For coaches without billing, redirect to coach onboarding instead of user onboarding
      if (hasOrganization) {
        const billingStatus = publicMetadata?.billingStatus;
        const billingPeriodEnd = publicMetadata?.billingPeriodEnd;
        
        if (!hasActiveBilling(billingStatus, billingPeriodEnd)) {
          console.log(`[MIDDLEWARE] Coach ${userId} blocked: no billing, redirecting to coach onboarding`);
          return NextResponse.redirect(new URL('/coach/onboarding/plans', request.url));
        }
      }
      
      // Non-coach users need active billing
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
  
  // ==========================================================================
  // TENANT SUBSCRIPTION LOCKOUT (Coach + Members)
  // ==========================================================================
  
  // When coach's subscription is inactive, lock the entire platform:
  // - Coach: redirect to /coach/reactivate (existing behavior)
  // - Members: redirect to /platform-deactivated
  // - Data is preserved, only access is restricted
  
  if (isTenantMode && userId && !isAlwaysAllowedRoute(request)) {
    // Get org billing state from Clerk org public metadata (primary source - synced by Stripe webhooks)
    // Falls back to tenantConfigData.subscription (Edge Config) if Clerk metadata not available
    const orgMetadata = sessionClaims?.orgPublicMetadata as ClerkOrgPublicMetadata | undefined;
    const edgeConfigSubscription = tenantConfigData?.subscription;
    
    // Priority: Clerk org metadata > Edge Config subscription > defaults
    const orgPlan: CoachTier = orgMetadata?.plan || edgeConfigSubscription?.plan || 'starter';
    const orgStatus: CoachSubscriptionStatus = orgMetadata?.subscriptionStatus || edgeConfigSubscription?.subscriptionStatus || 'none';
    const orgPeriodEnd = orgMetadata?.currentPeriodEnd || edgeConfigSubscription?.currentPeriodEnd;
    const orgCancelAtPeriodEnd = orgMetadata?.cancelAtPeriodEnd || edgeConfigSubscription?.cancelAtPeriodEnd;
    const orgGraceEndsAt = orgMetadata?.graceEndsAt || edgeConfigSubscription?.graceEndsAt;
    
    // Check subscription is active (includes grace period for payment failures)
    const isSubscriptionActive = hasActiveOrgSubscription(orgStatus, orgPeriodEnd, orgCancelAtPeriodEnd, orgGraceEndsAt);
    
    if (!isSubscriptionActive) {
      // COACH: Allow access to plan/reactivate pages, block everything else
      if (isStaffRole(role)) {
        if (isCoachPlanPage(request) || isCoachReactivatePage(request)) {
          // Allow access to plan/reactivate pages without subscription check
        } else {
          // Block ALL routes for coach when subscription is inactive
          console.log(`[MIDDLEWARE] Coach ${userId} blocked: org subscription not active (status=${orgStatus}), redirecting to /coach/reactivate`);
          if (pathname.startsWith('/api/')) {
            return NextResponse.json(
              { error: 'Subscription inactive', code: 'SUBSCRIPTION_INACTIVE' },
              { status: 503 }
            );
          }
          return NextResponse.redirect(new URL('/coach/reactivate', request.url));
        }
      }
      
      // MEMBERS: Block ALL routes except always-allowed and platform-deactivated
      if (!isStaffRole(role)) {
        // Already on platform-deactivated page - allow
        if (isPlatformDeactivatedPage(request)) {
          // Allow - they're already seeing the lockout page
        } else {
          // Block and redirect to platform-deactivated
          console.log(`[MIDDLEWARE] Member ${userId} blocked: org subscription not active (status=${orgStatus}), redirecting to /platform-deactivated`);
          if (pathname.startsWith('/api/')) {
            return NextResponse.json(
              { error: 'Platform temporarily unavailable', code: 'SUBSCRIPTION_INACTIVE' },
              { status: 503 }
            );
          }
          return NextResponse.redirect(new URL('/platform-deactivated', request.url));
        }
      }
    }
    
    // ==========================================================================
    // COACH DASHBOARD PLAN TIER GATING (only when subscription IS active)
    // ==========================================================================
    
    if (isSubscriptionActive && isStaffRole(role) && isCoachDashboardRoute(request)) {
      // Check Pro+ routes
      if (requiresProPlan(request) && orgPlan === 'starter') {
        console.log(`[MIDDLEWARE] Coach ${userId} blocked: Pro+ feature on starter plan`);
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'This feature requires the Pro plan or higher', code: 'PLAN_FEATURE_LOCKED' },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL('/coach/plan?upgrade=pro', request.url));
      }
      
      // Check Scale routes
      if (requiresScalePlan(request) && (orgPlan === 'starter' || orgPlan === 'pro')) {
        console.log(`[MIDDLEWARE] Coach ${userId} blocked: Scale feature on ${orgPlan} plan`);
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'This feature requires the Scale plan', code: 'PLAN_FEATURE_LOCKED' },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL('/coach/plan?upgrade=scale', request.url));
      }
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

