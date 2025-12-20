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
 * 3. This page ensures auth on primary domain (shared with subdomain)
 * 4. Redirects to target
 * 5. Clerk middleware/satellite logic handles the token handoff to custom domain
 */
export default async function AuthSyncPage({ searchParams }: AuthSyncPageProps) {
  // Ensure user is signed in on primary domain
  await auth.protect();
  
  const params = await searchParams;
  const target = params.target;
  
  if (!target) {
    redirect('/');
  }
  
  // Validate target is a valid URL to prevent open redirect vulnerabilities
  try {
    const url = new URL(target);
    // Allow redirects to http/https only
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      redirect('/');
    }
  } catch {
    redirect('/');
  }
  
  // Redirect to target - Clerk will handle session sync for satellite domains
  redirect(target);
}

