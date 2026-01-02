'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { isDemoSubdomain } from '@/lib/demo-utils';
import dynamic from 'next/dynamic';

// Dynamically import CoachQuizModal to avoid SSR issues
const CoachQuizModal = dynamic(
  () => import('@/components/lp/CoachQuizModal').then(mod => ({ default: mod.CoachQuizModal })),
  { ssr: false }
);

interface DemoModeContextValue {
  isDemoMode: boolean;
  isDemoSite: boolean; // True when on demo.growthaddicts.com
  // Signup modal for demo fallback actions
  isSignupModalOpen: boolean;
  openSignupModal: () => void;
  closeSignupModal: () => void;
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
 * 
 * Also provides a signup modal that can be triggered from anywhere in the app
 * when a user tries to perform an action that requires authentication.
 */
export function DemoModeProvider({ children }: DemoModeProviderProps) {
  const [isDemoSite, setIsDemoSite] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  // Check if on demo subdomain
  useEffect(() => {
    const onDemoSite = isDemoSubdomain();
    setIsDemoSite(onDemoSite);
  }, []);

  // Demo mode is only on when on demo site
  const isDemoMode = isDemoSite;

  // Signup modal controls
  const openSignupModal = useCallback(() => {
    setIsSignupModalOpen(true);
  }, []);

  const closeSignupModal = useCallback(() => {
    setIsSignupModalOpen(false);
  }, []);

  return (
    <DemoModeContext.Provider value={{ 
      isDemoMode, 
      isDemoSite, 
      isSignupModalOpen, 
      openSignupModal, 
      closeSignupModal 
    }}>
      {children}
      {/* Render CoachQuizModal at the root level for demo signup prompts */}
      {isDemoMode && (
        <CoachQuizModal 
          isOpen={isSignupModalOpen} 
          onClose={closeSignupModal} 
        />
      )}
    </DemoModeContext.Provider>
  );
}

/**
 * Hook to access demo mode state
 * 
 * Note: Demo mode is only active on demo.growthaddicts.com.
 * There is no toggle - it's determined purely by the subdomain.
 * 
 * Also provides openSignupModal() to trigger the coach signup modal
 * for demo users trying to perform authenticated actions.
 */
export function useDemoMode(): DemoModeContextValue {
  const context = useContext(DemoModeContext);
  
  if (context === undefined) {
    // Return default values if used outside provider (graceful fallback)
    return {
      isDemoMode: false,
      isDemoSite: false,
      isSignupModalOpen: false,
      openSignupModal: () => {},
      closeSignupModal: () => {},
    };
  }
  
  return context;
}

