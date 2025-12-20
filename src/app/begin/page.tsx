import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
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
  
  // On satellite domains (custom domains), redirect to the org's subdomain for sign-up
  // Clerk satellite domains cannot perform sign-up directly, but subdomains can
  if (isSatellite) {
    // Fetch the subdomain associated with this custom domain
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${hostname}`;
    
    try {
      const res = await fetch(`${baseUrl}/api/tenant/resolve?domain=${domainWithoutPort}`, {
        headers: { 'x-internal-request': 'true' },
        cache: 'no-store',
      });
      
      if (res.ok) {
        const data = await res.json();
        const subdomain = data.subdomain;
        
        if (subdomain) {
          const returnUrl = `https://${domainWithoutPort}/`;
          redirect(`https://${subdomain}.growthaddicts.app/begin?redirect_url=${encodeURIComponent(returnUrl)}`);
        }
      }
    } catch (error) {
      console.error('[BEGIN] Error resolving subdomain for custom domain:', error);
    }
    
    // Fallback to main domain if subdomain lookup fails
    const returnUrl = `https://${domainWithoutPort}/`;
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
