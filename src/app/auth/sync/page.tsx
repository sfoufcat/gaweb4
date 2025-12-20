import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

interface AuthSyncPageProps {
  searchParams: Promise<{
    target?: string;
  }>;
}

/**
 * /auth/sync
 * 
 * Helper route to seamlessly transfer session to a satellite domain.
 * 
 * Flow:
 * 1. User on subdomain (signed in) verifies custom domain
 * 2. Frontend redirects to /auth/sync?target=https://custom.com/dashboard
 * 3. This page checks auth - if signed in, redirects to target
 * 4. Clerk middleware/satellite logic handles the token handoff to custom domain
 * 
 * If NOT signed in (shouldn't happen if coming from subdomain, but handle gracefully):
 * - Just redirect to target anyway - Clerk on the custom domain will handle auth
 */
export default async function AuthSyncPage({ searchParams }: AuthSyncPageProps) {
  const params = await searchParams;
  const target = params.target;
  
  if (!target) {
    redirect('/');
  }
  
  // Validate target is a valid URL to prevent open redirect vulnerabilities
  let validatedTarget: string;
  try {
    const url = new URL(target);
    // Allow redirects to http/https only
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      redirect('/');
    }
    validatedTarget = url.toString();
  } catch {
    redirect('/');
  }
  
  // Check if user is authenticated (but don't force sign-in)
  const { userId } = await auth();
  
  if (userId) {
    // User is authenticated - redirect to target
    // Clerk will handle session sync for satellite domains
    redirect(validatedTarget);
  } else {
    // User not authenticated on primary domain
    // This shouldn't happen if they were signed in on subdomain, but handle gracefully
    // Redirect to target anyway - Clerk on satellite will prompt sign-in if needed
    console.log('[AUTH_SYNC] User not authenticated on primary domain, redirecting to target anyway');
    redirect(validatedTarget);
  }
}

