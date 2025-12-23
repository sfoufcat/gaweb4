'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { OAuthButton } from './OAuthButton';

interface SatelliteSignInProps {
  subdomain: string;
  customDomain: string;
  logoUrl: string;
  appTitle: string;
}

/**
 * Satellite Sign-In Component
 * 
 * Used on custom domains (satellite domains) to show sign-in.
 * - OAuth buttons are on this parent page (redirect flow)
 * - Email/password form is in an iframe from the subdomain
 * 
 * After successful auth, receives postMessage and redirects to /?from_auth=1
 * to let ClerkProvider sync the session.
 */
export function SatelliteSignIn({ subdomain, customDomain, logoUrl, appTitle }: SatelliteSignInProps) {
  const [mounted, setMounted] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  
  // Only render iframe on client side to avoid SSR issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Construct URLs
  const currentOrigin = `https://${customDomain}`;
  const subdomainBase = subdomain 
    ? `https://${subdomain}.growthaddicts.com`
    : 'https://growthaddicts.com';
  const iframeSrc = `${subdomainBase}/sign-in/embedded?origin=${encodeURIComponent(currentOrigin)}`;

  // Handle OAuth - redirect to subdomain which handles Clerk OAuth
  const handleOAuth = (provider: 'oauth_google' | 'oauth_apple') => {
    setOauthLoading(true);
    // Redirect to subdomain with oauth param - subdomain will initiate Clerk OAuth
    // After OAuth, user will be redirected back to this domain with from_auth=1
    const returnUrl = `${currentOrigin}/?from_auth=1`;
    window.location.href = `${subdomainBase}/sign-in?oauth=${provider}&redirect_url=${encodeURIComponent(returnUrl)}`;
  };

  useEffect(() => {
    // Listen for postMessage from iframe (email/password auth success)
    const handleMessage = (event: MessageEvent) => {
      // Validate origin - must be from subdomain or primary domain
      if (!event.origin.includes('growthaddicts.com') && !event.origin.includes('growthaddicts.app')) {
        return;
      }
      
      if (event.data.type === 'auth-success') {
        // Redirect to home with from_auth=1 to let ClerkProvider sync session
        window.location.href = '/?from_auth=1';
      } else if (event.data.type === 'auth-error') {
        console.error('Auth error:', event.data.error);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 lg:py-16">
        <div className="w-full max-w-xl mx-auto">
          {/* Header with Coach Branding */}
          <div className="text-center mb-10 lg:mb-12">
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

          {/* Auth Container */}
          <div className="w-full max-w-lg mx-auto">
            <div className="bg-white/80 backdrop-blur-sm border border-[#e1ddd8]/60 rounded-3xl p-8 shadow-lg">
              {/* OAuth Button - on parent page, uses redirect flow */}
              <div className="space-y-3">
                <OAuthButton
                  provider="google"
                  onClick={() => handleOAuth('oauth_google')}
                  disabled={false}
                  loading={oauthLoading}
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-[#e1ddd8]" />
                <span className="font-sans text-sm text-text-secondary">or</span>
                <div className="flex-1 h-px bg-[#e1ddd8]" />
              </div>

              {/* Email/Password Form in iframe */}
              {mounted && (
                <iframe
                  src={iframeSrc}
                  className="w-full border-0 outline-none"
                  style={{ height: '340px' }}
                  scrolling="no"
                  allow="clipboard-write"
                  title="Sign In"
                />
              )}
            </div>
          </div>

          {/* Sign Up Link */}
          <p className="text-center mt-8 lg:mt-10 font-sans text-[15px] text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/join/starter-90" className="text-[#a07855] hover:text-[#8a6649] font-medium">
              Start your journey
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

