/**
 * useDemoUser Hook
 * 
 * Provides consistent demo user data when in demo mode.
 * Use this instead of useUser() from Clerk in components that need to show user avatars.
 */

import { useUser } from '@clerk/nextjs';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { DEMO_USER } from '@/lib/demo-utils';
import { useMemo } from 'react';

export interface DemoUserData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  imageUrl: string;
  emailAddresses: { emailAddress: string }[];
}

/**
 * Hook that returns demo user data when in demo mode, otherwise returns Clerk user
 */
export function useDemoUser() {
  const { user: clerkUser, isLoaded: clerkIsLoaded, isSignedIn: clerkIsSignedIn } = useUser();
  const { isDemoMode } = useDemoMode();

  const user = useMemo(() => {
    if (isDemoMode) {
      return {
        id: DEMO_USER.id,
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
        fullName: DEMO_USER.name,
        imageUrl: DEMO_USER.imageUrl,
        emailAddresses: [{ emailAddress: DEMO_USER.email }],
      } as DemoUserData;
    }
    return clerkUser;
  }, [isDemoMode, clerkUser]);

  return {
    user,
    isLoaded: isDemoMode ? true : clerkIsLoaded,
    isSignedIn: isDemoMode ? true : clerkIsSignedIn,
    isDemoMode,
  };
}

/**
 * Get avatar URL for a demo client/user by name
 */
export function getDemoAvatarUrl(name: string): string {
  // Use real-looking avatars from unsplash for demo users
  const avatars: Record<string, string> = {
    'Sarah Miller': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    'Michael Chen': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    'Emma Thompson': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    'James Wilson': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    'Lisa Park': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face',
    'Luke Anderson': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    'Caleb King': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face',
    'Avery Allen': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
    'Coach Adam': DEMO_USER.imageUrl,
  };
  
  // Return specific avatar if found, otherwise generate from UI Avatars
  if (avatars[name]) {
    return avatars[name];
  }
  
  // Generate a consistent avatar URL using UI Avatars
  const colors = ['a07855', '7c9885', '6b7db3', 'b36b6b', '9b6bb3', '6bb3a0'];
  const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  const color = colors[colorIndex];
  const encodedName = encodeURIComponent(name);
  return `https://ui-avatars.com/api/?name=${encodedName}&background=${color}&color=fff&size=128&bold=true`;
}

export default useDemoUser;

