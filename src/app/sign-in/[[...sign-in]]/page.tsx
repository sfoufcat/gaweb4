import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignInForm } from '@/components/auth';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';

interface SignInPageProps {
  searchParams: Promise<{ redirect_url?: string }>;
}

/**
 * /sign-in - Sign in page for existing users
 * Server Component that fetches branding based on domain
 * 
 * On satellite domains (custom domains), redirects to primary domain for auth.
 * On primary domain, handles redirect_url to send users back after sign-in.
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  // Fetch branding server-side based on domain
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  
  // Check if this is a satellite domain (custom domain, not growthaddicts.app)
  const domainWithoutPort = hostname.split(':')[0];
  const isSatellite = domainWithoutPort && 
    !domainWithoutPort.includes('growthaddicts') && 
    !domainWithoutPort.includes('localhost') &&
    !domainWithoutPort.includes('127.0.0.1');
  
  // On satellite domains (custom domains), redirect to the org's subdomain for authentication
  // Clerk satellite domains cannot perform sign-in directly, but subdomains can
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
          redirect(`https://${subdomain}.growthaddicts.app/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
        }
      }
    } catch (error) {
      console.error('[SIGN-IN] Error resolving subdomain for custom domain:', error);
    }
    
    // Fallback to main domain if subdomain lookup fails
    const returnUrl = `https://${domainWithoutPort}/`;
    redirect(`https://growthaddicts.app/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
  }
  
  // Get redirect_url from search params (for redirecting back to satellite after sign-in)
  const params = await searchParams;
  const redirectUrl = params.redirect_url || '/';
  
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
