import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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
  // Coaching (separate from membership tier)
  coaching?: boolean; // Legacy flag - true if has active coaching
  coachingStatus?: CoachingStatus; // New: detailed coaching status
  coachingPlan?: 'monthly' | 'quarterly'; // New: coaching plan type
}

// Helper to check if user has active billing
function hasActiveBilling(status?: BillingStatus, periodEnd?: string): boolean {
  // Active or trialing = full access
  if (status === 'active' || status === 'trialing') {
    return true;
  }
  
  // Canceled but still in paid period = grace access
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

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/begin(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/start(.*)',  // Guest checkout flow - auth happens after payment
  '/invite(.*)',  // Smart invite links - page handles auth flow
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
// This is everything EXCEPT: public routes, onboarding, API routes (APIs check themselves)
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
]);

export default clerkMiddleware(async (auth, request) => {
  // Allow seed route in development without auth
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev && isSeedRoute(request)) {
    return NextResponse.next();
  }

  // Get auth state
  const { userId, sessionClaims } = await auth();
  
  // GUEST SESSION REDIRECT LOGIC
  // For signed-out users, check if they have an active guest session
  if (!userId) {
    const pathname = request.nextUrl.pathname;
    const guestSessionId = request.cookies.get('ga_guest_session_id')?.value;
    const guestStep = request.cookies.get('ga_guest_step')?.value;
    
    // If user has a guest session and is NOT on an exempt route, redirect to their step
    if (guestSessionId && !isGuestFlowExemptRoute(request)) {
      // Handle legacy 'welcome' step and 'start' step - both map to '/start'
      const targetStep = (guestStep === 'welcome' || guestStep === 'start') ? null : guestStep;
      const redirectPath = targetStep ? `/start/${targetStep}` : '/start';
      console.log(`[MIDDLEWARE] Guest session found, redirecting to ${redirectPath}`);
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    
    // If user has NO guest session and is visiting root, redirect to /begin
    if (!guestSessionId && pathname === '/') {
      const isReturningUser = request.cookies.get('ga_returning_user')?.value === 'true';
      const redirectUrl = isReturningUser ? '/sign-in' : '/begin';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    
    // Note: /start is now the welcome page itself - no redirect needed
    // Only redirect if user has a saved step that's NOT the welcome page
    if (pathname === '/start' && guestStep && guestStep !== 'welcome' && guestStep !== 'start') {
      return NextResponse.redirect(new URL(`/start/${guestStep}`, request.url));
    }
  }

  // REDIRECT SIGNED-IN USERS AWAY FROM /start (guest checkout flow)
  // Exception: Allow access to /start/profile and /start/complete for post-payment setup
  if (userId && request.nextUrl.pathname.startsWith('/start')) {
    const allowedPostPaymentPaths = ['/start/profile', '/start/complete'];
    const isPostPaymentPath = allowedPostPaymentPaths.some(path => 
      request.nextUrl.pathname.startsWith(path)
    );
    
    if (!isPostPaymentPath) {
      return NextResponse.redirect('https://pro.growthaddicts.com');
    }
  }

  // REDIRECT SIGNED-IN USERS AWAY FROM /sign-in
  if (userId && request.nextUrl.pathname.startsWith('/sign-in')) {
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
  // Staff roles (editor, coach, admin, super_admin) bypass billing checks
  if (userId && requiresBilling(request)) {
    // Staff roles bypass billing
    if (!isStaffRole(role)) {
      const billingStatus = publicMetadata?.billingStatus;
      const billingPeriodEnd = publicMetadata?.billingPeriodEnd;
      
      if (!hasActiveBilling(billingStatus, billingPeriodEnd)) {
        // No active billing - redirect to plan page
        console.log(`[MIDDLEWARE] User ${userId} blocked: billingStatus=${billingStatus}, redirecting to /onboarding/plan`);
        return NextResponse.redirect(new URL('/onboarding/plan', request.url));
      }
    }
  }

  // Check editor access for editor routes (editor or super_admin only)
  if (isEditorRoute(request)) {
    // Must be authenticated
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    if (!canAccessEditorSection(role)) {
      // Redirect to home if not editor or super_admin
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Check editor API access (editors can manage discover content via /api/admin/discover/*)
  if (isEditorApiRoute(request)) {
    // Must be authenticated
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canAccessEditorSection(role)) {
      // Return 403 for API routes instead of redirect
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Editor API routes pass through here - skip the admin route check below
  }
  // Check admin access for admin routes (admin or super_admin only)
  else if (isAdminRoute(request)) {
    // Must be authenticated
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    if (!canAccessAdminSection(role)) {
      // Redirect to home if not admin
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Redirect authenticated users from homepage to dashboard or plan page based on billing
  if (userId && request.nextUrl.pathname === '/') {
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const billingStatus = publicMetadata?.billingStatus;
    const billingPeriodEnd = publicMetadata?.billingPeriodEnd;
    
    // If they have billing, let them through to the dashboard (page.tsx handles further checks)
    // If no billing, the dashboard will redirect them appropriately
    const response = NextResponse.next();
    response.cookies.set('ga_returning_user', 'true', {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }

  // Set returning user cookie for authenticated users (so they go to sign-in next time)
  if (userId) {
    const response = NextResponse.next();
    response.cookies.set('ga_returning_user', 'true', {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

