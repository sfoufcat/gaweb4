'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { OrgDefaultTheme } from '@/types';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  orgDefaultTheme: OrgDefaultTheme;
  setOrgDefaultTheme: (theme: OrgDefaultTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'ga-theme';

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Organization's default theme preference (from branding) */
  initialOrgDefaultTheme?: OrgDefaultTheme;
}

export function ThemeProvider({ children, initialOrgDefaultTheme = 'light' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);
  const [orgDefaultTheme, setOrgDefaultThemeState] = useState<OrgDefaultTheme>(initialOrgDefaultTheme);

  // Initialize theme from localStorage, falling back to org default, then system preference
  useEffect(() => {
    setMounted(true);
    
    // Check localStorage for user's saved preference
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      setThemeState(stored);
      document.documentElement.classList.toggle('dark', stored === 'dark');
      return;
    }
    
    // No user preference stored - use organization default
    if (orgDefaultTheme === 'system') {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme: Theme = prefersDark ? 'dark' : 'light';
      setThemeState(systemTheme);
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      // Use organization's default theme (light or dark)
      setThemeState(orgDefaultTheme);
      document.documentElement.classList.toggle('dark', orgDefaultTheme === 'dark');
    }
  }, [orgDefaultTheme]);

  // Update org default theme when it changes (e.g., from branding context)
  const setOrgDefaultTheme = useCallback((newOrgDefault: OrgDefaultTheme) => {
    setOrgDefaultThemeState(newOrgDefault);
    
    // Only apply if user hasn't set their own preference
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      if (newOrgDefault === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const systemTheme: Theme = prefersDark ? 'dark' : 'light';
        setThemeState(systemTheme);
        document.documentElement.classList.toggle('dark', prefersDark);
      } else {
        setThemeState(newOrgDefault);
        document.documentElement.classList.toggle('dark', newOrgDefault === 'dark');
      }
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);

  // Prevent flash by not rendering until mounted
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, orgDefaultTheme, setOrgDefaultTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

