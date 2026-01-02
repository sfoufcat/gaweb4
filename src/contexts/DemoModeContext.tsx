'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { isDemoSubdomain } from '@/lib/demo-utils';

interface DemoModeContextValue {
  isDemoMode: boolean;
  isLocked: boolean;  // True when on demo subdomain (can't be toggled off)
  isDemoSite: boolean; // True when on demo.growthaddicts.com
  toggleDemoMode: () => void;
  setDemoMode: (value: boolean) => void;
}

const DemoModeContext = createContext<DemoModeContextValue | undefined>(undefined);

const DEMO_MODE_STORAGE_KEY = 'coach-demo-mode';

interface DemoModeProviderProps {
  children: ReactNode;
}

/**
 * DemoModeProvider
 * 
 * Provides demo mode state management for the coach dashboard.
 * Persists preference in localStorage.
 * 
 * On demo.growthaddicts.com, demo mode is always on and locked.
 */
export function DemoModeProvider({ children }: DemoModeProviderProps) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDemoSite, setIsDemoSite] = useState(false);

  // Check if on demo subdomain and load saved preference
  useEffect(() => {
    const onDemoSite = isDemoSubdomain();
    setIsDemoSite(onDemoSite);
    
    if (onDemoSite) {
      // On demo site, demo mode is always on
      setIsDemoMode(true);
    } else {
      // Load saved preference from localStorage
      try {
        const saved = localStorage.getItem(DEMO_MODE_STORAGE_KEY);
        if (saved === 'true') {
          setIsDemoMode(true);
        }
      } catch {
        // localStorage not available (SSR or privacy mode)
      }
    }
    setIsInitialized(true);
  }, []);

  // Save preference to localStorage when it changes (only if not on demo site)
  useEffect(() => {
    if (!isInitialized || isDemoSite) return;
    
    try {
      localStorage.setItem(DEMO_MODE_STORAGE_KEY, isDemoMode ? 'true' : 'false');
    } catch {
      // localStorage not available
    }
  }, [isDemoMode, isInitialized, isDemoSite]);

  const toggleDemoMode = useCallback(() => {
    // Can't toggle off on demo site
    if (isDemoSite) return;
    setIsDemoMode(prev => !prev);
  }, [isDemoSite]);

  const setDemoMode = useCallback((value: boolean) => {
    // Can't turn off on demo site
    if (isDemoSite && !value) return;
    setIsDemoMode(value);
  }, [isDemoSite]);

  // Locked when on demo site
  const isLocked = isDemoSite;

  return (
    <DemoModeContext.Provider value={{ isDemoMode, isLocked, isDemoSite, toggleDemoMode, setDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

/**
 * Hook to access demo mode state and controls
 */
export function useDemoMode(): DemoModeContextValue {
  const context = useContext(DemoModeContext);
  
  if (context === undefined) {
    // Return default values if used outside provider (graceful fallback)
    return {
      isDemoMode: false,
      isLocked: false,
      isDemoSite: false,
      toggleDemoMode: () => {},
      setDemoMode: () => {},
    };
  }
  
  return context;
}

