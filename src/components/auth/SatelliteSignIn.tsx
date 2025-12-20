'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface SatelliteSignInProps {
  subdomain: string;
  customDomain: string;
  logoUrl: string;
  appTitle: string;
}

/**
 * Satellite Sign-In Component
 * 
 * Used on custom domains (satellite domains) to show sign-in in an iframe.
 * The iframe loads from the subdomain, preserving coach branding.
 * OAuth buttons in the iframe open popups on the subdomain.
 * 
 * After successful auth, receives postMessage and redirects to /?from_auth=1
 * to let ClerkProvider sync the session.
 */
export function SatelliteSignIn({ subdomain, customDomain, logoUrl, appTitle }: SatelliteSignInProps) {
  // Construct the iframe URL
  const currentOrigin = typeof window !== 'undefined' ? `https://${customDomain}` : '';
  const iframeSrc = subdomain 
    ? `https://${subdomain}.growthaddicts.app/sign-in/embedded?origin=${encodeURIComponent(currentOrigin)}`
    : `https://growthaddicts.app/sign-in/embedded?origin=${encodeURIComponent(currentOrigin)}`;
  
  // Expected origin for postMessage validation
  const expectedOrigin = subdomain 
    ? `https://${subdomain}.growthaddicts.app`
    : 'https://growthaddicts.app';

  useEffect(() => {
    // Listen for postMessage from iframe or popup
    const handleMessage = (event: MessageEvent) => {
      // Validate origin - must be from subdomain or primary domain
      if (!event.origin.includes('growthaddicts.app')) {
        return;
      }
      
      if (event.data.type === 'auth-success') {
        // Redirect to home with from_auth=1 to let ClerkProvider sync session
        window.location.href = '/?from_auth=1';
      } else if (event.data.type === 'auth-error') {
        console.error('Auth error:', event.data.error);
        // Could show an error toast here
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [expectedOrigin]);

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

          {/* Embedded Sign-In Form in iframe */}
          <div className="w-full">
            <iframe
              src={iframeSrc}
              className="w-full border-0 rounded-3xl bg-white/80"
              style={{ height: '500px' }}
              allow="clipboard-write"
              title="Sign In"
            />
          </div>

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
