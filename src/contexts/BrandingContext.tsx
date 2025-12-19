'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { OrgBranding, OrgBrandingColors } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL } from '@/types';

/**
 * BrandingContext
 * 
 * Provides organization branding (colors, logo, title) throughout the app.
 * Supports preview mode for coaches to see their branding before saving.
 * 
 * Resolution logic (for future multi-tenant support):
 * 1. Check hostname for custom domain → lookup org
 * 2. Check subdomain → lookup org
 * 3. Use current user's org (if coach/admin)
 * 4. Fall back to default branding
 * 
 * For now: Always uses default branding unless preview mode is active.
 */

interface BrandingContextType {
  // Current active branding (either from org or default)
  branding: OrgBranding;
  // Whether branding is loading
  isLoading: boolean;
  // Whether using default branding (no custom branding loaded)
  isDefault: boolean;
  // Preview mode state
  isPreviewMode: boolean;
  previewBranding: OrgBranding | null;
  // Enable/disable preview mode with optional branding to preview
  setPreviewMode: (enabled: boolean, branding?: OrgBranding) => void;
  // Force refetch branding from server
  refetch: () => Promise<void>;
  // Get the effective branding (preview if enabled, otherwise actual)
  effectiveBranding: OrgBranding;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

/**
 * Get default branding object
 */
function getDefaultBranding(): OrgBranding {
  const now = new Date().toISOString();
  return {
    id: 'default',
    organizationId: 'default',
    logoUrl: DEFAULT_LOGO_URL,
    appTitle: DEFAULT_APP_TITLE,
    colors: DEFAULT_BRANDING_COLORS,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Apply branding colors as CSS custom properties
 */
function applyBrandingCSS(colors: OrgBrandingColors): void {
  const root = document.documentElement;
  
  // Set CSS custom properties for light mode
  root.style.setProperty('--brand-menu-light', colors.menuLight);
  root.style.setProperty('--brand-bg-light', colors.bgLight);
  root.style.setProperty('--brand-accent-light', colors.accentLight);
  
  // Set CSS custom properties for dark mode
  root.style.setProperty('--brand-menu-dark', colors.menuDark);
  root.style.setProperty('--brand-bg-dark', colors.bgDark);
  root.style.setProperty('--brand-accent-dark', colors.accentDark);
}

/**
 * Remove branding CSS custom properties (revert to defaults)
 */
function removeBrandingCSS(): void {
  const root = document.documentElement;
  
  root.style.removeProperty('--brand-menu-light');
  root.style.removeProperty('--brand-bg-light');
  root.style.removeProperty('--brand-accent-light');
  root.style.removeProperty('--brand-menu-dark');
  root.style.removeProperty('--brand-bg-dark');
  root.style.removeProperty('--brand-accent-dark');
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<OrgBranding>(getDefaultBranding());
  const [isLoading, setIsLoading] = useState(false);
  const [isDefault, setIsDefault] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Preview mode state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewBranding, setPreviewBranding] = useState<OrgBranding | null>(null);

  // Fetch branding from API
  const fetchBranding = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/org/branding');
      
      if (!response.ok) {
        console.error('[BrandingContext] Failed to fetch branding:', response.status);
        return;
      }
      
      const data = await response.json();
      
      if (data.branding) {
        setBranding(data.branding);
        setIsDefault(data.isDefault ?? false);
      }
    } catch (error) {
      console.error('[BrandingContext] Error fetching branding:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    setMounted(true);
    // For now, we always use default branding
    // In the future, this will resolve based on hostname/subdomain
    // fetchBranding();
  }, []);

  // Apply CSS when effective branding changes
  useEffect(() => {
    if (!mounted) return;
    
    const effectiveColors = isPreviewMode && previewBranding 
      ? previewBranding.colors 
      : branding.colors;
    
    // Only apply custom CSS if in preview mode or using non-default branding
    if (isPreviewMode && previewBranding) {
      applyBrandingCSS(effectiveColors);
    } else if (!isDefault) {
      applyBrandingCSS(effectiveColors);
    } else {
      removeBrandingCSS();
    }
    
    return () => {
      // Cleanup on unmount
      if (isPreviewMode) {
        removeBrandingCSS();
      }
    };
  }, [mounted, isPreviewMode, previewBranding, branding, isDefault]);

  // Set preview mode
  const setPreviewMode = useCallback((enabled: boolean, brandingToPreview?: OrgBranding) => {
    setIsPreviewMode(enabled);
    if (enabled && brandingToPreview) {
      setPreviewBranding(brandingToPreview);
    } else if (!enabled) {
      setPreviewBranding(null);
    }
  }, []);

  // Refetch branding
  const refetch = useCallback(async () => {
    await fetchBranding();
  }, [fetchBranding]);

  // Calculate effective branding
  const effectiveBranding = useMemo(() => {
    if (isPreviewMode && previewBranding) {
      return previewBranding;
    }
    return branding;
  }, [isPreviewMode, previewBranding, branding]);

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return null;
  }

  return (
    <BrandingContext.Provider
      value={{
        branding,
        isLoading,
        isDefault,
        isPreviewMode,
        previewBranding,
        setPreviewMode,
        refetch,
        effectiveBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}

/**
 * Hook to get just the effective branding values (for components that only need to read)
 */
export function useBrandingValues() {
  const { effectiveBranding, isPreviewMode } = useBranding();
  return {
    logoUrl: effectiveBranding.logoUrl || DEFAULT_LOGO_URL,
    appTitle: effectiveBranding.appTitle || DEFAULT_APP_TITLE,
    colors: effectiveBranding.colors,
    isPreviewMode,
  };
}
