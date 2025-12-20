import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { BeginPageClient } from './BeginPageClient';

interface BeginPageProps {
  searchParams: Promise<{ redirect_url?: string }>;
}

/**
 * /begin - Public entry point for new users (Server Component)
 * 
 * Fetches branding server-side and passes to client component.
 * On satellite domains (custom domains), redirects to the org's subdomain for sign-up.
 */
export default async function BeginPage({ searchParams }: BeginPageProps) {
  // Fetch branding server-side based on domain
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  
  // Check if this is a satellite domain (custom domain, not growthaddicts.app)
  const domainWithoutPort = hostname.split(':')[0];
  const isSatellite = domainWithoutPort && 
    !domainWithoutPort.includes('growthaddicts') && 
    !domainWithoutPort.includes('localhost') &&
    !domainWithoutPort.includes('127.0.0.1');
  
  // On satellite domains (custom domains), redirect to the org's SUBDOMAIN for sign-up
  // This preserves coach branding during sign-up
  // The from_auth=1 param tells middleware to skip auth redirect and let ClerkProvider sync
  if (isSatellite) {
    const result = await resolveTenant(hostname, null, null);
    
    if (result.type === 'tenant' && result.tenant.subdomain) {
      // Add from_auth=1 so middleware knows to let the user through for session sync
      const returnUrl = `https://${domainWithoutPort}/?from_auth=1`;
      redirect(`https://${result.tenant.subdomain}.growthaddicts.app/begin?redirect_url=${encodeURIComponent(returnUrl)}`);
    }
    
    // Fallback to primary domain if no subdomain found
    const returnUrl = `https://${domainWithoutPort}/?from_auth=1`;
    redirect(`https://growthaddicts.app/begin?redirect_url=${encodeURIComponent(returnUrl)}`);
  }
  
  // Get redirect_url from search params (for redirecting back to satellite after sign-up)
  const params = await searchParams;
  const redirectUrl = params.redirect_url || '/onboarding/welcome';
  
  const branding = await getBrandingForDomain(hostname);
  
  const logoUrl = getBestLogoUrl(branding);
  const appTitle = branding.appTitle;

  return <BeginPageClient logoUrl={logoUrl} appTitle={appTitle} redirectUrl={redirectUrl} />;
}
