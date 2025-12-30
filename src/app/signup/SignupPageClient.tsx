'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { OAuthButton } from '@/components/auth/OAuthButton';

interface SignupPageClientProps {
  publicSignupEnabled: boolean;
  logoUrl: string;
  appTitle: string;
  coachName: string;
  coachEmail: string;
  coachImageUrl?: string;
  hostname: string;
  isSatellite: boolean;
  tenantSubdomain?: string | null;
}

/**
 * SignupPageClient - Handles the signup page UI
 * 
 * Two modes:
 * 1. Enabled: Shows full signup form (OAuth + email/password)
 * 2. Disabled: Shows "contact coach" page with coach info
 */
export default function SignupPageClient({
  publicSignupEnabled,
  logoUrl,
  appTitle,
  coachName,
  coachEmail,
  coachImageUrl,
  hostname,
  isSatellite,
  tenantSubdomain,
}: SignupPageClientProps) {
  const [mounted, setMounted] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // For satellite domains (custom domains), we need to handle OAuth differently
  const customDomain = hostname.split(':')[0];
  const currentOrigin = `https://${customDomain}`;
  const subdomainBase = tenantSubdomain 
    ? `https://${tenantSubdomain}.growthaddicts.com`
    : 'https://growthaddicts.com';
  const iframeSrc = `${subdomainBase}/join/embedded?origin=${encodeURIComponent(currentOrigin)}`;

  // Handle OAuth for satellite domains
  const handleSatelliteOAuth = (provider: 'oauth_google' | 'oauth_apple') => {
    setOauthLoading(true);
    const returnUrl = `${currentOrigin}/?from_auth=1`;
    window.location.href = `${subdomainBase}/join/oauth?provider=${provider}&returnUrl=${encodeURIComponent(returnUrl)}`;
  };

  // Listen for postMessage from iframe (email/password auth success) for satellite domains
  useEffect(() => {
    if (!isSatellite) return;
    
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('growthaddicts.com') && !event.origin.includes('growthaddicts.app')) {
        return;
      }
      
      if (event.data.type === 'auth-success') {
        window.location.href = '/?from_auth=1';
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isSatellite]);

  // If public signup is disabled, show contact coach page
  if (!publicSignupEnabled) {
    return (
      <div className="fixed inset-0 bg-app-bg overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 lg:py-16">
          <div className="w-full max-w-xl mx-auto">
            {/* Header with Logo */}
            <div className="text-center mb-10 lg:mb-12">
              <Image 
                src={logoUrl} 
                alt={appTitle} 
                width={80}
                height={80}
                className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-6 shadow-lg"
                unoptimized={logoUrl.startsWith('http')}
              />
              <h1 className="font-albert text-[32px] sm:text-[40px] lg:text-[48px] text-text-primary tracking-[-2px] leading-[1.1] mb-5 lg:mb-6">
                Join {appTitle}
              </h1>
              <p className="font-sans text-[16px] lg:text-[18px] text-text-secondary leading-[1.6] max-w-md mx-auto">
                Registration is by invitation only. Please contact the coach to get started.
              </p>
            </div>

            {/* Contact Coach Card */}
            <div className="w-full max-w-lg mx-auto">
              <div className="bg-white/80 backdrop-blur-sm border border-[#e1ddd8]/60 rounded-3xl p-8 shadow-lg">
                {/* Coach Info */}
                <div className="flex items-center gap-4 mb-6">
                  {coachImageUrl ? (
                    <Image
                      src={coachImageUrl}
                      alt={coachName}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#f3f1ef] flex items-center justify-center">
                      <span className="text-2xl font-albert text-text-secondary">
                        {coachName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <h2 className="font-albert text-xl text-text-primary tracking-[-0.5px]">
                      {coachName}
                    </h2>
                    <p className="font-sans text-sm text-text-secondary">
                      Coach
                    </p>
                  </div>
                </div>

                {/* Contact Button */}
                {coachEmail && (
                  <a
                    href={`mailto:${coachEmail}?subject=Request%20to%20Join%20${encodeURIComponent(appTitle)}`}
                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] dark:bg-none dark:bg-[#b8896a] dark:hover:bg-[#a07855] dark:text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#e8b923]/20 dark:shadow-[#b8896a]/20"
                  >
                    <Mail className="w-5 h-5" />
                    Contact {coachName}
                  </a>
                )}

                {!coachEmail && (
                  <p className="text-center font-sans text-sm text-text-secondary">
                    Please reach out to the coach directly to request access.
                  </p>
                )}
              </div>
            </div>

            {/* Sign In Link */}
            <p className="text-center mt-8 lg:mt-10 font-sans text-[15px] text-text-secondary">
              Already have an account?{' '}
              <Link href="/sign-in" className="text-brand-accent hover:text-[#8a6649] font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Public signup is enabled - show the signup form
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
            <h1 className="font-albert text-[38px] sm:text-[46px] lg:text-[56px] text-text-primary tracking-[-2px] leading-[1.1] mb-5 lg:mb-6 lg:whitespace-nowrap">
              Begin your growth journey
            </h1>
            <p className="font-sans text-[16px] lg:text-[18px] text-text-secondary leading-[1.6] max-w-md mx-auto">
              Create your account to set your mission, define your goal, and start building momentum.
            </p>
          </div>

          {/* Auth Container */}
          <div className="w-full max-w-lg mx-auto">
            {isSatellite ? (
              // Satellite domain: OAuth on parent + iframe for email/password
              <div className="bg-white/80 backdrop-blur-sm border border-[#e1ddd8]/60 rounded-3xl p-8 shadow-lg">
                {/* OAuth Button - on parent page, uses redirect flow */}
                <div className="space-y-3">
                  <OAuthButton
                    provider="google"
                    onClick={() => handleSatelliteOAuth('oauth_google')}
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
                    style={{ height: '420px' }}
                    scrolling="no"
                    allow="clipboard-write"
                    title="Sign Up"
                  />
                )}
              </div>
            ) : (
              // Regular domain: Use SignUpForm directly
              <SignUpForm redirectUrl="/" />
            )}
          </div>

          {/* Sign In Link */}
          <p className="text-center mt-8 lg:mt-10 font-sans text-[15px] text-text-secondary">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-brand-accent hover:text-[#8a6649] font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}



