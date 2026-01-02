'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { isDemoSubdomain } from '@/lib/demo-utils';

interface DemoModeContextValue {
  isDemoMode: boolean;
  isDemoSite: boolean; // True when on demo.growthaddicts.com
}

const DemoModeContext = createContext<DemoModeContextValue | undefined>(undefined);

interface DemoModeProviderProps {
  children: ReactNode;
}

/**
 * DemoModeProvider
 * 
 * Demo mode is ONLY active on demo.growthaddicts.com.
 * The toggle has been removed - demo mode is exclusively for the demo subdomain.
 */
export function DemoModeProvider({ children }: DemoModeProviderProps) {
  const [isDemoSite, setIsDemoSite] = useState(false);

  // Check if on demo subdomain
  useEffect(() => {
    const onDemoSite = isDemoSubdomain();
    setIsDemoSite(onDemoSite);
  }, []);

  // Demo mode is only on when on demo site
  const isDemoMode = isDemoSite;

  return (
    <DemoModeContext.Provider value={{ isDemoMode, isDemoSite }}>
      {children}
    </DemoModeContext.Provider>
  );
}

/**
 * Hook to access demo mode state
 * 
 * Note: Demo mode is only active on demo.growthaddicts.com.
 * There is no toggle - it's determined purely by the subdomain.
 */
export function useDemoMode(): DemoModeContextValue {
  const context = useContext(DemoModeContext);
  
  if (context === undefined) {
    // Return default values if used outside provider (graceful fallback)
    return {
      isDemoMode: false,
      isDemoSite: false,
    };
  }
  
  return context;
}

