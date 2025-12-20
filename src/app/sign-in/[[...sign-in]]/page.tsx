import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { SignInForm } from '@/components/auth';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { OAuthPopupInitiator } from '@/components/auth/OAuthPopupInitiator';
import { OAuthRedirectInitiator } from '@/components/auth/OAuthRedirectInitiator';
import { SatelliteSignIn } from '@/components/auth/SatelliteSignIn';

interface SignInPageProps {
  searchParams: Promise<{ 
    redirect_url?: string;
    oauth?: string;      // OAuth provider for redirect/popup mode
    popup?: string;      // '1' if opened as popup
    origin?: string;     // Parent window origin for postMessage (popup mode only)
  }>;
}

/**
 * /sign-in - Sign in page for existing users
 * Server Component that fetches branding based on domain
 * 
 * Modes:
 * 1. Normal: Shows sign-in form with redirectUrl handling
 * 2. Satellite: Shows embedded iframe sign-in (URL stays on satellite domain)
 * 3. OAuth Popup: Initiates OAuth flow in popup window
 * 4. OAuth Redirect: Initiates OAuth flow via redirect (from satellite)
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  // Fetch branding server-side based on domain
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  
  // Get search params
  const params = await searchParams;
  const redirectUrl = params.redirect_url || '/';
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
    return <OAuthPopupInitiator provider={oauthProvider} origin={popupOrigin} />;
  }
  
  // Mode 2: OAuth Redirect - Initiate OAuth flow via redirect (from satellite domain)
  // When subdomain receives ?oauth=provider&redirect_url=..., start OAuth immediately
  if (oauthProvider && redirectUrl && !isSatellite) {
    return <OAuthRedirectInitiator provider={oauthProvider} redirectUrl={redirectUrl} />;
  }
  
  // Mode 3: Satellite domain - Show embedded iframe sign-in
  // URL stays on satellite domain, auth happens in iframe from subdomain
  if (isSatellite) {
    const result = await resolveTenant(hostname, null, null);
    const branding = await getBrandingForDomain(hostname);
    const logoUrl = getBestLogoUrl(branding);
    const appTitle = branding.appTitle;
    
    const subdomain = result.type === 'tenant' ? result.tenant.subdomain : null;
    
    return (
      <SatelliteSignIn
        subdomain={subdomain || ''}
        customDomain={domainWithoutPort}
        logoUrl={logoUrl}
        appTitle={appTitle}
      />
    );
  }
  
  // Mode 3: Normal sign-in on primary/subdomain
  const branding = await getBrandingForDomain(hostname);
  const logoUrl = getBestLogoUrl(branding);
  const appTitle = branding.appTitle;

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 lg:py-16">
        <div className="w-full max-w-xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10 lg:mb-12">
            {/* Logo */}
            <Image 
              src={logoUrl} 
              alt={appTitle} 
              width={80}
              height={80}
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-6 shadow-lg"
              unoptimized={logoUrl.startsWith('http')}
            />
            <h1 className="font-albert text-[38px] sm:text-[46px] lg:text-[56px] text-text-primary tracking-[-2px] leading-[1.1] mb-5 lg:mb-6">
              Welcome back
            </h1>
            <p className="font-sans text-[16px] lg:text-[18px] text-text-secondary leading-[1.6] max-w-md mx-auto">
              Sign in to continue your growth journey.
            </p>
          </div>

          {/* Custom Sign In Form */}
          <SignInForm redirectUrl={redirectUrl} />

          {/* Sign Up Link */}
          <p className="text-center mt-8 lg:mt-10 font-sans text-[15px] text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/begin" className="text-[#a07855] hover:text-[#8a6649] font-medium">
              Start your journey
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
