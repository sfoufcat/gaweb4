/**
 * Demo Site Utilities
 * 
 * Provides utilities for detecting demo subdomain and managing demo sessions.
 * Used by demo.coachful.co for showcasing the coach dashboard without authentication.
 */

// Demo subdomains that should trigger demo mode
const DEMO_SUBDOMAINS = ['demo.coachful.co', 'demo.localhost'];

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
  email: 'coach@demo.coachful.co',
  firstName: 'Adam',
  lastName: 'Coach',
  name: 'Coach Adam',
  imageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
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
  imageUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=128&h=128&fit=crop&crop=center',
};

