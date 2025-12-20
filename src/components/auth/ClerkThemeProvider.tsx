'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ga-theme';
const PRIMARY_DOMAIN = 'https://growthaddicts.app';

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
}

export function ClerkThemeProvider({ 
  children, 
  hostname = '',
  logoUrl,
  appTitle,
}: ClerkThemeProviderProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Detect satellite domain (custom domains that aren't growthaddicts.app or localhost)
  const domainWithoutPort = hostname.split(':')[0];
  const isSatellite = Boolean(
    domainWithoutPort && 
    !domainWithoutPort.includes('growthaddicts') && 
    !domainWithoutPort.includes('localhost') &&
    !domainWithoutPort.includes('127.0.0.1')
  );

  useEffect(() => {
    // Initial theme check from localStorage
    const checkTheme = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      setIsDark(stored === 'dark');
    };

    checkTheme();
    setMounted(true);

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
  }, []);

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
  const satelliteProps = isSatellite ? {
    isSatellite: true as const,
    domain: domainWithoutPort,
    signInUrl: `${PRIMARY_DOMAIN}/sign-in`,
    signUpUrl: `${PRIMARY_DOMAIN}/sign-up`,
  } : {};

  return (
    <ClerkProvider 
      appearance={mounted ? appearance : lightAppearance}
      {...satelliteProps}
    >
      {children}
    </ClerkProvider>
  );
}

