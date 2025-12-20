'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { OrgBranding, OrgBrandingColors, OrgMenuTitles } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES } from '@/types';

/**
 * Calculate relative luminance of a hex color
 * Returns value between 0 (darkest) and 1 (lightest)
 */
function getLuminance(hex: string): number {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  
  // Apply sRGB gamma correction
  const rLinear = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gLinear = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bLinear = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  
  // Calculate luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Determine if a color is "dark" (needs light text) or "light" (needs dark text)
 */
function isColorDark(hex: string): boolean {
  return getLuminance(hex) < 0.5;
}

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
    horizontalLogoUrl: null,
    appTitle: DEFAULT_APP_TITLE,
    colors: DEFAULT_BRANDING_COLORS,
    menuTitles: DEFAULT_MENU_TITLES,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Apply branding colors as CSS custom properties
 * Only accent colors are customizable - menu/page backgrounds use theme defaults
 */
function applyBrandingCSS(colors: OrgBrandingColors): void {
  const root = document.documentElement;
  
  // Set CSS custom properties for accent colors only
  root.style.setProperty('--brand-accent-light', colors.accentLight);
  root.style.setProperty('--brand-accent-dark', colors.accentDark);
}

/**
 * Remove branding CSS custom properties (revert to defaults)
 */
function removeBrandingCSS(): void {
  const root = document.documentElement;
  
  root.style.removeProperty('--brand-accent-light');
  root.style.removeProperty('--brand-accent-dark');
}

interface BrandingProviderProps {
  children: React.ReactNode;
  /**
   * Initial branding from SSR (set by middleware from KV cache).
   * If provided, skips the initial client-side fetch - eliminates "flash of default branding".
   */
  initialBranding?: OrgBranding | null;
  /**
   * Whether the initial branding is the default (no custom branding).
   * Used to skip unnecessary client-side fetches.
   */
  initialIsDefault?: boolean;
}

export function BrandingProvider({ 
  children, 
  initialBranding,
  initialIsDefault = true,
}: BrandingProviderProps) {
  // Initialize with SSR branding if provided, otherwise default
  const [branding, setBranding] = useState<OrgBranding>(
    initialBranding || getDefaultBranding()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDefault, setIsDefault] = useState(initialIsDefault);
  const [mounted, setMounted] = useState(false);
  
  // Track if we got SSR branding (skip initial fetch if so)
  const hadInitialBranding = initialBranding !== undefined && initialBranding !== null;
  
  // Preview mode state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewBranding, setPreviewBranding] = useState<OrgBranding | null>(null);

  // Fetch branding from API
  const fetchBranding = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/org/branding');
      
      // Check content type to avoid parsing HTML as JSON
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      if (!response.ok) {
        // Log the actual response for debugging
        if (!isJson) {
          const text = await response.text();
          console.error('[BrandingContext] Non-JSON error response:', response.status, text.substring(0, 200));
        } else {
          console.error('[BrandingContext] Failed to fetch branding:', response.status);
        }
        return;
      }
      
      // Ensure response is JSON before parsing
      if (!isJson) {
        console.error('[BrandingContext] Expected JSON but got:', contentType);
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
    // Fetch from API if:
    // 1. No initial branding provided (platform mode, no cookie), OR
    // 2. Initial branding is default (tenant mode but Edge Config didn't have custom branding)
    // This ensures custom branding loads even when Edge Config isn't populated
    if (!hadInitialBranding || initialIsDefault) {
      fetchBranding();
    }
  }, [fetchBranding, hadInitialBranding, initialIsDefault]);

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
  const { effectiveBranding, isPreviewMode, isDefault } = useBranding();
  
  // Calculate if accent colors are dark (need light text) or light (need dark text)
  const accentLightIsDark = isColorDark(effectiveBranding.colors.accentLight);
  const accentDarkIsDark = isColorDark(effectiveBranding.colors.accentDark);
  
  // Merge menu titles with defaults to ensure all fields are present
  const menuTitles: OrgMenuTitles = {
    ...DEFAULT_MENU_TITLES,
    ...effectiveBranding.menuTitles,
  };
  
  return {
    logoUrl: effectiveBranding.logoUrl || DEFAULT_LOGO_URL,
    horizontalLogoUrl: effectiveBranding.horizontalLogoUrl || null,
    appTitle: effectiveBranding.appTitle || DEFAULT_APP_TITLE,
    colors: effectiveBranding.colors,
    menuTitles,
    isPreviewMode,
    isDefault,
    // Smart contrast helpers
    accentLightIsDark,
    accentDarkIsDark,
  };
}

/**
 * Hook to get just the customizable menu titles
 * Provides all menu titles and helper functions for lowercase/uppercase variants
 */
export function useMenuTitles() {
  const { menuTitles } = useBrandingValues();
  
  return {
    // Raw titles
    home: menuTitles.home,
    squad: menuTitles.squad,
    learn: menuTitles.learn,
    chat: menuTitles.chat,
    coach: menuTitles.coach,
    // Lowercase variants (for use in sentences like "my squad")
    squadLower: menuTitles.squad.toLowerCase(),
    // Helper for "My Squad" style usage
    mySquad: `My ${menuTitles.squad}`,
  };
}
