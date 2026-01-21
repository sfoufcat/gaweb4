'use client';

import { createContext, useContext, ReactNode } from 'react';

interface AuthHintContextType {
  /**
   * SSR hint that user is authenticated (from middleware header).
   * Use this to prevent flash of unauthenticated content while Clerk hydrates.
   * This is NOT a replacement for Clerk's useUser() - just a hint for initial render.
   */
  isAuthenticatedHint: boolean;
}

const AuthHintContext = createContext<AuthHintContextType>({
  isAuthenticatedHint: false,
});

interface AuthHintProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
}

export function AuthHintProvider({ children, isAuthenticated }: AuthHintProviderProps) {
  return (
    <AuthHintContext.Provider value={{ isAuthenticatedHint: isAuthenticated }}>
      {children}
    </AuthHintContext.Provider>
  );
}

export function useAuthHint() {
  return useContext(AuthHintContext);
}
