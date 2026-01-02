/**
 * Demo Site Utilities
 * 
 * Provides utilities for detecting demo subdomain and managing demo sessions.
 * Used by demo.growthaddicts.com for showcasing the coach dashboard without authentication.
 */

// Demo subdomains that should trigger demo mode
const DEMO_SUBDOMAINS = ['demo.growthaddicts.com', 'demo.localhost'];

/**
 * Check if the current hostname is a demo subdomain
 * Works both client-side and server-side
 */
export function isDemoSubdomain(hostname?: string): boolean {
  // Server-side: use provided hostname
  if (hostname) {
    return DEMO_SUBDOMAINS.some(demo => 
      hostname === demo || hostname.endsWith(`.${demo}`)
    );
  }
  
  // Client-side: use window.location
  if (typeof window === 'undefined') return false;
  
  return DEMO_SUBDOMAINS.some(demo => 
    window.location.hostname === demo || 
    window.location.hostname.endsWith(`.${demo}`)
  );
}

/**
 * Generate a unique session ID for demo session isolation
 */
export function generateDemoSessionId(): string {
  return `demo-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get or create a demo session ID from sessionStorage
 * This ensures each browser tab has its own isolated demo session
 */
export function getDemoSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  const STORAGE_KEY = 'demo-session-id';
  let sessionId = sessionStorage.getItem(STORAGE_KEY);
  
  if (!sessionId) {
    sessionId = generateDemoSessionId();
    sessionStorage.setItem(STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Demo user data for simulating an authenticated coach
 */
export const DEMO_USER = {
  id: 'demo-coach-user',
  email: 'coach@demo.growthaddicts.com',
  firstName: 'Demo',
  lastName: 'Coach',
  name: 'Demo Coach',
  imageUrl: 'https://ui-avatars.com/api/?name=Demo+Coach&background=a07855&color=fff&size=128&bold=true',
  role: 'coach' as const,
  orgRole: 'super_coach' as const,
};

/**
 * Demo organization data
 */
export const DEMO_ORGANIZATION = {
  id: 'demo-org',
  name: 'Demo Coaching Business',
  slug: 'demo',
  imageUrl: 'https://ui-avatars.com/api/?name=Demo&background=a07855&color=fff&size=128&bold=true',
};

