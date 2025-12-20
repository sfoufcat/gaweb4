import { headers } from 'next/headers';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { BeginPageClient } from './BeginPageClient';
import { SatelliteSignUp, OAuthSignUpPopupInitiator } from '@/components/auth';

interface BeginPageProps {
  searchParams: Promise<{ 
    redirect_url?: string;
    oauth?: string;      // OAuth provider for popup mode
    popup?: string;      // '1' if opened as popup
    origin?: string;     // Parent window origin for postMessage
  }>;
}

/**
 * /begin - Public entry point for new users (Server Component)
 * 
 * Modes:
 * 1. Normal: Shows sign-up form with redirectUrl handling
 * 2. Satellite: Shows embedded iframe sign-up (URL stays on satellite domain)
 * 3. OAuth Popup: Initiates OAuth flow in popup window
 */
export default async function BeginPage({ searchParams }: BeginPageProps) {
  // Fetch branding server-side based on domain
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  
  // Get search params
  const params = await searchParams;
  const redirectUrl = params.redirect_url || '/onboarding/welcome';
  const oauthProvider = params.oauth as 'oauth_google' | 'oauth_apple' | undefined;
  const isPopup = params.popup === '1';
  const popupOrigin = params.origin || '';
  
  // Check if this is a satellite domain (custom domain, not growthaddicts.app)
  const domainWithoutPort = hostname.split(':')[0];
  const isSatellite = domainWithoutPort && 
    !domainWithoutPort.includes('growthaddicts') && 
    !domainWithoutPort.includes('localhost') &&
    !domainWithoutPort.includes('127.0.0.1');
  
  // Mode 1: OAuth Popup - Initiate OAuth flow in popup window
  if (isPopup && oauthProvider && popupOrigin) {
    return <OAuthSignUpPopupInitiator provider={oauthProvider} origin={popupOrigin} />;
  }
  
  // Mode 2: Satellite domain - Show embedded iframe sign-up
  // URL stays on satellite domain, auth happens in iframe from subdomain
  if (isSatellite) {
    const result = await resolveTenant(hostname, null, null);
    const branding = await getBrandingForDomain(hostname);
    const logoUrl = getBestLogoUrl(branding);
    const appTitle = branding.appTitle;
    
    const subdomain = result.type === 'tenant' ? result.tenant.subdomain : null;
    
    return (
      <SatelliteSignUp
        subdomain={subdomain || ''}
        customDomain={domainWithoutPort}
        logoUrl={logoUrl}
        appTitle={appTitle}
      />
    );
  }
  
  // Mode 3: Normal sign-up on primary/subdomain
  const branding = await getBrandingForDomain(hostname);
  const logoUrl = getBestLogoUrl(branding);
  const appTitle = branding.appTitle;

  return <BeginPageClient logoUrl={logoUrl} appTitle={appTitle} redirectUrl={redirectUrl} />;
}
