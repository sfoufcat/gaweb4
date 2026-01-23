'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { OrgBranding, OrgBrandingColors, OrgMenuTitles, OrgMenuIcons, OrgDefaultTheme, MenuItemKey, EmptyStateBehavior, OrgFeatureLabels, OrgContentLabels } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_MENU_ORDER, DEFAULT_THEME, DEFAULT_FEATURE_LABELS, DEFAULT_CONTENT_LABELS } from '@/types';
import { 
  DEFAULT_TENANT_COACHING_PROMO, 
  type TenantCoachingPromoData 
} from '@/lib/tenant-edge-config';
import { useTheme } from '@/contexts/ThemeContext';

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
  // Coaching promo settings (separate from branding)
  coachingPromo: TenantCoachingPromoData;
  // Whether social feed is enabled for this org (from Edge Config for instant SSR)
  feedEnabled: boolean;
  // Update feed enabled state (for instant UI feedback after toggle)
  setFeedEnabled: (enabled: boolean) => void;
  // Menu empty state behaviors (from Edge Config for instant SSR)
  programEmptyStateBehavior: EmptyStateBehavior;
  squadEmptyStateBehavior: EmptyStateBehavior;
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
    logoUrlDark: null,
    horizontalLogoUrl: null,
    horizontalLogoUrlDark: null,
    appTitle: DEFAULT_APP_TITLE,
    colors: DEFAULT_BRANDING_COLORS,
    menuTitles: DEFAULT_MENU_TITLES,
    menuIcons: DEFAULT_MENU_ICONS,
    menuOrder: DEFAULT_MENU_ORDER,
    defaultTheme: DEFAULT_THEME,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Calculate appropriate foreground color (white or dark) based on background luminance
 */
function getForegroundColor(bgHex: string): string {
  return isColorDark(bgHex) ? '#ffffff' : '#1a1a1a';
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
  
  // Set foreground colors for text on accent backgrounds (auto-computed for contrast)
  const lightFg = colors.accentLightForeground || getForegroundColor(colors.accentLight);
  const darkFg = colors.accentDarkForeground || getForegroundColor(colors.accentDark);
  root.style.setProperty('--brand-accent-light-foreground', lightFg);
  root.style.setProperty('--brand-accent-dark-foreground', darkFg);
}

/**
 * Remove branding CSS custom properties (revert to defaults)
 */
function removeBrandingCSS(): void {
  const root = document.documentElement;
  
  root.style.removeProperty('--brand-accent-light');
  root.style.removeProperty('--brand-accent-dark');
  root.style.removeProperty('--brand-accent-light-foreground');
  root.style.removeProperty('--brand-accent-dark-foreground');
}

interface BrandingProviderProps {
  children: React.ReactNode;
  /**
   * Initial branding from SSR (set by middleware from KV cache).
   * If provided, skips the initial client-side fetch - eliminates "flash of default branding".
   */
  initialBranding?: OrgBranding | null;
  /**
   * Initial coaching promo from SSR (set by middleware from Edge Config).
   * Prevents flash of coaching promo that should be hidden.
   */
  initialCoachingPromo?: TenantCoachingPromoData | null;
  /**
   * Whether the initial branding is the default (no custom branding).
   * Used to skip unnecessary client-side fetches.
   */
  initialIsDefault?: boolean;
  /**
   * Whether feed is enabled for this org (from Edge Config).
   * Used for instant SSR rendering of feed nav item.
   */
  initialFeedEnabled?: boolean;
  /**
   * Empty state behavior for program menu (from Edge Config).
   * 'hide' = hide menu when user has no programs
   * 'discover' = show discover/find program page
   */
  initialProgramEmptyStateBehavior?: EmptyStateBehavior;
  /**
   * Empty state behavior for squad menu (from Edge Config).
   * 'hide' = hide menu when user has no squads
   * 'discover' = show discover/find squad page
   */
  initialSquadEmptyStateBehavior?: EmptyStateBehavior;
}

export function BrandingProvider({ 
  children, 
  initialBranding,
  initialCoachingPromo,
  initialIsDefault = true,
  initialFeedEnabled = false,
  initialProgramEmptyStateBehavior = 'discover',
  initialSquadEmptyStateBehavior = 'discover',
}: BrandingProviderProps) {
  // Initialize with SSR branding if provided, otherwise default
  const [branding, setBranding] = useState<OrgBranding>(
    initialBranding || getDefaultBranding()
  );
  // Initialize coaching promo from SSR to prevent flash
  const [coachingPromo, setCoachingPromo] = useState<TenantCoachingPromoData>(
    initialCoachingPromo || DEFAULT_TENANT_COACHING_PROMO
  );
  // Initialize feed enabled from SSR for instant nav rendering
  const [feedEnabled, setFeedEnabled] = useState<boolean>(initialFeedEnabled);
  // Initialize empty state behaviors from SSR for instant nav rendering
  const [programEmptyStateBehavior] = useState<EmptyStateBehavior>(initialProgramEmptyStateBehavior);
  const [squadEmptyStateBehavior] = useState<EmptyStateBehavior>(initialSquadEmptyStateBehavior);
  const [isLoading, setIsLoading] = useState(false);
  const [isDefault, setIsDefault] = useState(initialIsDefault);
  const [mounted, setMounted] = useState(false);
  
  // Track if we got SSR branding (skip initial fetch if so)
  const hadInitialBranding = initialBranding !== undefined && initialBranding !== null;
  
  // Preview mode state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewBranding, setPreviewBranding] = useState<OrgBranding | null>(null);

  // Fetch branding from API (fallback for when SSR branding is not available)
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
  // Trust SSR branding from middleware - it handles tenant vs platform domain correctly
  // Only fetch as fallback if no SSR branding was provided
  useEffect(() => {
    setMounted(true);
    
    // If SSR branding was provided (from tenant cookie), use it as-is
    // This covers both tenant domains (custom branding) and platform domain (default branding)
    // The middleware is the source of truth for which branding to show
    if (hadInitialBranding) {
      return;
    }
    
    // No SSR branding - fetch from API as fallback
    // This is rare and only happens if middleware didn't set the cookie
    fetchBranding();
  }, [fetchBranding, hadInitialBranding]);

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

  // Refetch branding - automatically uses forCoach if user is a coach
  // Refetch branding from API
  // Note: This refetches without forCoach - for coach-specific branding, 
  // components like CustomizeBrandingTab have their own fetch logic
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

  // Get theme context to sync organization's default theme
  const { setOrgDefaultTheme } = useTheme();
  
  // Sync organization's default theme to ThemeContext
  // This ensures "system" theme option works correctly
  useEffect(() => {
    if (!mounted) return;
    const orgDefaultTheme = effectiveBranding.defaultTheme || DEFAULT_THEME;
    setOrgDefaultTheme(orgDefaultTheme);
  }, [mounted, effectiveBranding.defaultTheme, setOrgDefaultTheme]);

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return null;
  }

  return (
    <BrandingContext.Provider
      value={{
        branding,
        coachingPromo,
        feedEnabled,
        setFeedEnabled,
        programEmptyStateBehavior,
        squadEmptyStateBehavior,
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
 * Returns theme-aware logos (dark mode logos if available, otherwise falls back to light)
 */
export function useBrandingValues() {
  const { effectiveBranding, isPreviewMode, isDefault } = useBranding();
  
  // Get current theme to select appropriate logo
  // We need to detect theme from document since useTheme creates circular dependency
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    // Check if dark mode is active
    const isDark = document.documentElement.classList.contains('dark');
    setCurrentTheme(isDark ? 'dark' : 'light');
    
    // Listen for theme changes via class mutation
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDarkNow = document.documentElement.classList.contains('dark');
          setCurrentTheme(isDarkNow ? 'dark' : 'light');
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);
  
  // Calculate if accent colors are dark (need light text) or light (need dark text)
  const accentLightIsDark = isColorDark(effectiveBranding.colors.accentLight);
  const accentDarkIsDark = isColorDark(effectiveBranding.colors.accentDark);
  
  // Merge menu titles with defaults to ensure all fields are present
  const menuTitles: OrgMenuTitles = {
    ...DEFAULT_MENU_TITLES,
    ...effectiveBranding.menuTitles,
  };
  
  // Merge menu icons with defaults to ensure all fields are present
  const menuIcons: OrgMenuIcons = {
    ...DEFAULT_MENU_ICONS,
    ...effectiveBranding.menuIcons,
  };
  
  // Use custom menu order if set, otherwise use default
  const menuOrder: MenuItemKey[] = effectiveBranding.menuOrder || DEFAULT_MENU_ORDER;

  // Merge feature labels with defaults to ensure all fields are present
  const featureLabels: OrgFeatureLabels = {
    ...DEFAULT_FEATURE_LABELS,
    ...effectiveBranding.featureLabels,
  };

  // Merge content labels with defaults to ensure all fields are present
  const contentLabels: OrgContentLabels = {
    ...DEFAULT_CONTENT_LABELS,
    ...effectiveBranding.contentLabels,
  };

  // Get theme-aware logos (dark mode logo if available, otherwise fallback to light)
  const logoUrl = currentTheme === 'dark' && effectiveBranding.logoUrlDark
    ? effectiveBranding.logoUrlDark
    : (effectiveBranding.logoUrl || DEFAULT_LOGO_URL);
  
  const horizontalLogoUrl = currentTheme === 'dark' && effectiveBranding.horizontalLogoUrlDark
    ? effectiveBranding.horizontalLogoUrlDark
    : (effectiveBranding.horizontalLogoUrl || null);
  
  return {
    logoUrl,
    horizontalLogoUrl,
    // Also expose raw URLs for settings pages that need to show both variants
    logoUrlLight: effectiveBranding.logoUrl || DEFAULT_LOGO_URL,
    logoUrlDark: effectiveBranding.logoUrlDark || null,
    horizontalLogoUrlLight: effectiveBranding.horizontalLogoUrl || null,
    horizontalLogoUrlDark: effectiveBranding.horizontalLogoUrlDark || null,
    appTitle: effectiveBranding.appTitle || DEFAULT_APP_TITLE,
    colors: effectiveBranding.colors,
    menuTitles,
    menuIcons,
    menuOrder,
    featureLabels,
    contentLabels,
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
    program: menuTitles.program,
    feed: menuTitles.feed,
    learn: menuTitles.learn,
    chat: menuTitles.chat,
    coach: menuTitles.coach,
    // Lowercase variants (for use in sentences like "my squad")
    squadLower: menuTitles.squad.toLowerCase(),
    programLower: menuTitles.program.toLowerCase(),
    feedLower: menuTitles.feed.toLowerCase(),
    // Helper for "My Squad" style usage
    mySquad: `My ${menuTitles.squad}`,
    myProgram: `My ${menuTitles.program}`,
  };
}


/**
 * Hook to get customized feature labels
 * Features: tasks, goals, check-ins, habits
 */
export function useFeatureLabels() {
  const { featureLabels } = useBrandingValues();

  return {
    // Raw labels
    tasks: featureLabels.tasks,
    goals: featureLabels.goals,
    checkIns: featureLabels.checkIns,
    habits: featureLabels.habits,
    // Lowercase variants
    tasksLower: featureLabels.tasks.toLowerCase(),
    goalsLower: featureLabels.goals.toLowerCase(),
    checkInsLower: featureLabels.checkIns.toLowerCase(),
    habitsLower: featureLabels.habits.toLowerCase(),
    // Plural forms (simple 's' append - can be enhanced later)
    tasksPlural: featureLabels.tasks,
    goalsPlural: featureLabels.goals,
    checkInsPlural: featureLabels.checkIns,
    habitsPlural: featureLabels.habits,
  };
}

/**
 * Hook to get customized content type labels
 * Content types: article, course, event, download, link
 */
export function useContentLabels() {
  const { contentLabels } = useBrandingValues();

  return {
    // Raw labels (singular)
    article: contentLabels.article,
    course: contentLabels.course,
    event: contentLabels.event,
    download: contentLabels.download,
    link: contentLabels.link,
    // Lowercase variants
    articleLower: contentLabels.article.toLowerCase(),
    courseLower: contentLabels.course.toLowerCase(),
    eventLower: contentLabels.event.toLowerCase(),
    downloadLower: contentLabels.download.toLowerCase(),
    linkLower: contentLabels.link.toLowerCase(),
    // Plural forms (simple 's' append - can be enhanced later)
    articles: `${contentLabels.article}s`,
    courses: `${contentLabels.course}s`,
    events: `${contentLabels.event}s`,
    downloads: `${contentLabels.download}s`,
    links: `${contentLabels.link}s`,
  };
}

/**
 * Hook to get coaching promo settings
 * Used to render or hide the coaching promo in chat sidebar
 */
export function useCoachingPromo() {
  const { coachingPromo } = useBranding();
  return coachingPromo;
}

/**
 * Hook to check if social feed is enabled for the current org
 * Uses Edge Config value from SSR for instant rendering.
 * On localhost (dev), syncs with API since Edge Config doesn't work locally.
 */
export function useFeedEnabled() {
  const { feedEnabled, setFeedEnabled, isDefault } = useBranding();
  const [hasSynced, setHasSynced] = useState(false);

  // On localhost dev, fetch the actual feedEnabled value from API
  // Edge Config doesn't work locally, so SSR value may be stale
  useEffect(() => {
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Only sync on localhost, only once, and only on tenant domains
    if (hasSynced || isDefault || !isLocalhost) return;

    const syncFeedEnabled = async () => {
      try {
        const response = await fetch('/api/coach/feed-settings');
        if (response.ok) {
          const data = await response.json();
          const apiFeedEnabled = data.feedEnabled === true;
          if (apiFeedEnabled !== feedEnabled) {
            setFeedEnabled(apiFeedEnabled);
          }
        }
      } catch {
        // Ignore errors - keep SSR value
      } finally {
        setHasSynced(true);
      }
    };

    syncFeedEnabled();
  }, [hasSynced, isDefault, feedEnabled, setFeedEnabled]);

  return feedEnabled;
}

/**
 * Hook to get feed enabled state and setter
 * Use this in components that need to update the feed enabled state (e.g., FeedSettingsToggle)
 */
export function useFeedEnabledState() {
  const { feedEnabled, setFeedEnabled } = useBranding();
  return { feedEnabled, setFeedEnabled };
}

/**
 * Hook to get empty state behaviors for program and squad menus
 * Uses Edge Config values from SSR for instant rendering (no flash)
 */
export function useEmptyStateBehaviors() {
  const { programEmptyStateBehavior, squadEmptyStateBehavior } = useBranding();
  return { programEmptyStateBehavior, squadEmptyStateBehavior };
}

/**
 * Hook to get the organization's default theme preference
 * Returns 'light', 'dark', or 'system'
 */
export function useOrgDefaultTheme(): OrgDefaultTheme {
  const { effectiveBranding } = useBranding();
  return effectiveBranding.defaultTheme || DEFAULT_THEME;
}
