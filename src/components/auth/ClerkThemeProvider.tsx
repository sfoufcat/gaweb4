'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useEffect, useState, useMemo } from 'react';

const STORAGE_KEY = 'ga-theme';
const PLATFORM_DOMAIN = 'https://growthaddicts.com';

// Custom dark theme variables to match app design
const darkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#b8896a',
    colorBackground: '#171b22',
    colorInputBackground: '#11141b',
    colorInputText: '#f5f5f8',
    colorText: '#f5f5f8',
    colorTextSecondary: '#b2b6c2',
    colorDanger: '#ef4444',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    borderRadius: '12px',
  },
  elements: {
    card: {
      backgroundColor: '#171b22',
      borderColor: '#262b35',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    },
    userButtonPopoverCard: {
      backgroundColor: '#171b22',
      borderColor: '#262b35',
    },
    userButtonPopoverActionButton: {
      color: '#f5f5f8',
      '&:hover': {
        backgroundColor: '#262b35',
      },
    },
    userButtonPopoverActionButtonText: {
      color: '#f5f5f8',
    },
    userButtonPopoverActionButtonIcon: {
      color: '#b2b6c2',
    },
    userButtonPopoverFooter: {
      backgroundColor: '#11141b',
      borderTopColor: '#262b35',
    },
    userPreviewMainIdentifier: {
      color: '#f5f5f8',
    },
    userPreviewSecondaryIdentifier: {
      color: '#b2b6c2',
    },
    formButtonPrimary: {
      backgroundColor: '#b8896a',
      '&:hover': {
        backgroundColor: '#a07855',
      },
    },
    footerActionLink: {
      color: '#b8896a',
    },
    headerTitle: {
      color: '#f5f5f8',
    },
    headerSubtitle: {
      color: '#b2b6c2',
    },
    dividerLine: {
      backgroundColor: '#262b35',
    },
    dividerText: {
      color: '#7d8190',
    },
    formFieldLabel: {
      color: '#f5f5f8',
    },
    formFieldInput: {
      backgroundColor: '#11141b',
      borderColor: '#262b35',
      color: '#f5f5f8',
      '&:focus': {
        borderColor: '#b8896a',
      },
    },
    identityPreviewText: {
      color: '#f5f5f8',
    },
    identityPreviewEditButton: {
      color: '#b8896a',
    },
  },
};

// Light theme - use defaults with brand colors
const lightAppearance = {
  variables: {
    colorPrimary: '#a07855',
    borderRadius: '12px',
  },
  elements: {
    formButtonPrimary: {
      backgroundColor: '#a07855',
      '&:hover': {
        backgroundColor: '#8c6245',
      },
    },
    footerActionLink: {
      color: '#a07855',
    },
  },
};

interface ClerkThemeProviderProps {
  children: React.ReactNode;
  hostname?: string;
  logoUrl?: string;
  appTitle?: string;
  subdomain?: string | null;  // Tenant subdomain for satellite domain session sync
}

export function ClerkThemeProvider({ 
  children, 
  hostname = '',
  logoUrl,
  appTitle,
  subdomain,
}: ClerkThemeProviderProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Detect satellite domain (custom domains that aren't growthaddicts.com/app or localhost)
  const domainWithoutPort = hostname.split(':')[0];
  const isSatellite = Boolean(
    domainWithoutPort && 
    !domainWithoutPort.includes('growthaddicts') && 
    !domainWithoutPort.includes('localhost') &&
    !domainWithoutPort.includes('127.0.0.1')
  );
  
  // Track current URL for redirect after sign-in (client-side only)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  useEffect(() => {
    // Initial theme check from localStorage
    const checkTheme = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      setIsDark(stored === 'dark');
    };

    checkTheme();
    setMounted(true);
    
    // Capture current URL for satellite domain redirect
    if (isSatellite && typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }

    // Listen for storage changes (when theme is changed in another tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setIsDark(e.newValue === 'dark');
      }
    };

    // Use MutationObserver to watch for class changes on html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const htmlElement = document.documentElement;
          setIsDark(htmlElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    window.addEventListener('storage', handleStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', handleStorage);
    };
  }, [isSatellite]);

  // Use the appropriate appearance based on theme
  const baseAppearance = isDark ? darkAppearance : lightAppearance;
  
  // Add custom logo to appearance if provided (for whitelabel domains)
  const appearance = logoUrl ? {
    ...baseAppearance,
    layout: {
      logoImageUrl: logoUrl,
      logoPlacement: 'inside' as const,
    },
  } : baseAppearance;

  // Don't render until mounted to avoid hydration mismatch
  // However, ClerkProvider needs to be rendered for auth to work
  // So we'll always render it but only apply appearance after mount
  
  // Build satellite props conditionally to satisfy TypeScript's strict union types
  // When isSatellite is true, we pass all satellite config together
  // When false, we spread an empty object (no satellite props)
  // 
  // For satellite domains (custom domains), Clerk session lives on the primary domain.
  // The primary domain should be the tenant's SUBDOMAIN (not the platform domain),
  // because each tenant has their own Clerk organization on their subdomain.
  const satelliteProps = useMemo(() => {
    if (!isSatellite) return {};
    
    // Use tenant's subdomain as primary domain if available, otherwise fall back to platform
    // This is critical: custom domain sessions sync FROM the subdomain, not the platform
    const primaryDomain = subdomain 
      ? `https://${subdomain}.growthaddicts.com`
      : PLATFORM_DOMAIN;
    
    // Build redirect URL - after sign-in, return to the original custom domain
    const redirectParam = currentUrl ? `?redirect_url=${encodeURIComponent(currentUrl)}` : '';
    
    return {
      isSatellite: true as const,
      domain: domainWithoutPort,
      signInUrl: `${primaryDomain}/sign-in${redirectParam}`,
      signUpUrl: `${primaryDomain}/join/starter-90${redirectParam}`,
    };
  }, [isSatellite, domainWithoutPort, currentUrl, subdomain]);

  return (
    <ClerkProvider 
      appearance={mounted ? appearance : lightAppearance}
      {...satelliteProps}
    >
      {children}
    </ClerkProvider>
  );
}

