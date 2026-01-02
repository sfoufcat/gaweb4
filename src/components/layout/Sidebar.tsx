'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { isAdmin, canAccessCoachDashboard, canAccessEditorSection, isSuperAdmin } from '@/lib/admin-utils-shared';
import type { UserRole, OrgRole, MenuItemKey } from '@/types';
import { DEFAULT_MENU_ICONS } from '@/types';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';
import { useBrandingValues, useFeedEnabled, useEmptyStateBehaviors } from '@/contexts/BrandingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { useSquad } from '@/hooks/useSquad';
import { MenuIcon } from '@/lib/menu-icons';

// Alias for backward compatibility within this file
const NavIcon = MenuIcon;

// Custom hook for scroll direction detection
function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const direction = scrollY > lastScrollY ? 'down' : 'up';
      
      if (direction !== scrollDirection && (scrollY - lastScrollY > 5 || scrollY - lastScrollY < -5)) {
        setScrollDirection(direction);
      }
      
      setIsAtTop(scrollY < 10);
      lastScrollY = scrollY > 0 ? scrollY : 0;
    };

    window.addEventListener('scroll', updateScrollDirection, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateScrollDirection);
    };
  }, [scrollDirection]);

  return { scrollDirection, isAtTop };
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionClaims: authClaims, isLoaded: authLoaded, isSignedIn: authSignedIn, userId: authUserId } = useAuth();
  const { isDemoSite } = useDemoMode();

  // Override auth state if in demo mode
  const isSignedIn = isDemoSite || authSignedIn;
  const isLoaded = isDemoSite || authLoaded;
  const userId = isDemoSite ? 'demo-user-1' : authUserId;

  // Mock session claims for demo user to simulate coach/admin access
  const sessionClaims = isDemoSite ? {
    publicMetadata: {
      role: 'coach',
      orgRole: 'super_coach',
      coachingStatus: 'active',
      coaching: true
    }
  } : authClaims;

  const { totalUnread } = useChatUnreadCounts();
  const { scrollDirection, isAtTop } = useScrollDirection();
  const { logoUrl, horizontalLogoUrl, logoUrlDark, horizontalLogoUrlDark, appTitle, colors, menuTitles, menuIcons, menuOrder, isDefault, accentLightIsDark, accentDarkIsDark } = useBrandingValues();
  const { theme } = useTheme();
  
  // Get the appropriate accent color and foreground based on theme
  const currentAccentColor = theme === 'dark' ? colors.accentDark : colors.accentLight;
  const currentAccentIsDark = theme === 'dark' ? accentDarkIsDark : accentLightIsDark;
  
  // Squad and program state for navigation visibility
  const { hasEnrollments } = useMyPrograms();
  const { hasStandaloneSquad } = useSquad();
  const feedEnabled = useFeedEnabled(); // From Edge Config via SSR - instant, no flash
  const { programEmptyStateBehavior, squadEmptyStateBehavior } = useEmptyStateBehaviors();
  
  // Navigation visibility logic:
  // - Program: Show if user has enrollments, OR coach config says show discover page
  // - Squad: Show if user has standalone squad (not program-attached), OR coach config says show discover page
  // - Feed: Show if feed is enabled for the org (from SSR for instant rendering)
  const showProgramNav = hasEnrollments || programEmptyStateBehavior === 'discover';
  const showSquadNav = hasStandaloneSquad || squadEmptyStateBehavior === 'discover';
  const showFeedNav = feedEnabled;
  
  const isActive = (path: string) => pathname === path;
  
  // Determine if mobile nav should be in compact mode (scrolling down and not at top)
  const isCompact = scrollDirection === 'down' && !isAtTop;
  
  // Get role and coaching status from Clerk session (from JWT, no API call!)
  const publicMetadata = sessionClaims?.publicMetadata as { 
    role?: UserRole; 
    orgRole?: OrgRole; // Organization-level role
    coaching?: boolean; // Legacy flag
    coachingStatus?: 'none' | 'active' | 'canceled' | 'past_due'; // New field
  } | undefined;
  const role = publicMetadata?.role;
  const orgRole = publicMetadata?.orgRole;
  // Check both new coachingStatus and legacy coaching flag for backward compatibility
  const hasCoaching = publicMetadata?.coachingStatus === 'active' || publicMetadata?.coaching === true;
  const showAdminPanel = isAdmin(role);
  const showCoachDashboard = canAccessCoachDashboard(role, orgRole);
  const showEditorPanel = canAccessEditorSection(role);
  const showMyCoach = hasCoaching || isSuperAdmin(role);

  // DEBUG: Log session claims and role
  useEffect(() => {
    console.log('🔍 DEBUG - Sidebar Role Check:');
    console.log('isLoaded:', isLoaded);
    console.log('isSignedIn:', isSignedIn);
    console.log('userId:', userId);
    console.log('sessionClaims:', sessionClaims);
    console.log('publicMetadata:', sessionClaims?.publicMetadata);
    console.log('role:', role);
    console.log('orgRole:', orgRole);
    console.log('hasCoaching:', hasCoaching);
    console.log('showMyCoach:', showMyCoach);
    console.log('showCoachDashboard:', showCoachDashboard);
    console.log('showAdminPanel:', showAdminPanel);
    console.log('showEditorPanel:', showEditorPanel);
  }, [isLoaded, isSignedIn, userId, sessionClaims, role, orgRole, hasCoaching, showMyCoach, showCoachDashboard, showAdminPanel, showEditorPanel]);

  // Prefetch pages on mount to reduce loading time
  useEffect(() => {
    router.prefetch('/chat');
    if (showFeedNav) {
      router.prefetch('/feed');
    }
    if (showMyCoach) {
      router.prefetch('/my-coach');
    }
    if (showCoachDashboard) {
      router.prefetch('/coach');
    }
    if (showAdminPanel) {
      router.prefetch('/admin');
    }
    if (showEditorPanel) {
      router.prefetch('/editor');
    }
  }, [router, showFeedNav, showMyCoach, showCoachDashboard, showAdminPanel, showEditorPanel]);
  
  // Define all nav items as a map for easy lookup by key
  const navItemsMap: Record<MenuItemKey, { name: string; path: string; dataTour?: string; icon: React.ReactNode; visible: boolean }> = {
    home: { 
      name: menuTitles.home, 
      path: '/', 
      icon: <NavIcon iconKey={menuIcons.home} />,
      visible: true, // Always visible
    },
    program: { 
      name: menuTitles.program, 
      path: '/program', 
      dataTour: 'program-nav',
      icon: <NavIcon iconKey={menuIcons.program} />,
      visible: showProgramNav, // Visible if has enrollments OR no standard squad
    },
    squad: { 
      name: menuTitles.squad, 
      path: '/squad', 
      icon: <NavIcon iconKey={menuIcons.squad} />,
      visible: showSquadNav, // Visible ONLY if user has a standard squad
    },
    feed: { 
      name: menuTitles.feed, 
      path: '/feed', 
      icon: <NavIcon iconKey={menuIcons.feed} />,
      visible: showFeedNav, // Visible if feed is enabled for the org
    },
    learn: { 
      name: menuTitles.learn, 
      path: '/discover', 
      icon: <NavIcon iconKey={menuIcons.learn} />,
      visible: true, // Always visible
    },
    chat: { 
      name: menuTitles.chat, 
      path: '/chat', 
      icon: <NavIcon iconKey={menuIcons.chat} />,
      visible: true, // Always visible
    },
    coach: { 
      name: menuTitles.coach, 
      path: '/my-coach', 
      icon: <NavIcon iconKey={menuIcons.coach} />,
      visible: showMyCoach, // Visible for coaching subscribers and super_admin
    },
  };

  // Build base nav items according to menuOrder, filtering by visibility
  const baseNavItems = menuOrder
    .filter((key) => navItemsMap[key].visible)
    .map((key) => {
      const item = navItemsMap[key];
      return {
        name: item.name,
        path: item.path,
        dataTour: item.dataTour,
        icon: item.icon,
      };
    });

  // Coach Dashboard item - visible for coach, admin, super_admin (coach dashboard for managing clients/squads)
  // Note: This is separate from "My Coach" (for users who have coaching) - this is for coaches to manage their org
  const coachDashboardNavItem = { 
    name: 'Coach', 
    path: '/coach', 
    dataTour: undefined as string | undefined,
    icon: (
      <NavIcon iconKey="shield" />
    )
  };

  // Editor item - visible for editor and super_admin
  const editorNavItem = { 
    name: 'Editor', 
    path: '/editor', 
    dataTour: undefined as string | undefined,
    icon: (
      <NavIcon iconKey="edit" />
    )
  };

  // Admin item - visible for admin and super_admin
  const adminNavItem = { 
    name: 'Admin', 
    path: '/admin', 
    dataTour: undefined as string | undefined,
    icon: (
      <NavIcon iconKey="settings" />
    )
  };

  // Build nav items: base (includes my-coach via menuOrder) + editor + coach dashboard + admin
  // Note: my-coach is now included in baseNavItems through the menuOrder system
  let navItems = [...baseNavItems];
  if (showEditorPanel) {
    navItems = [...navItems, editorNavItem];
  }
  if (showCoachDashboard) {
    navItems = [...navItems, coachDashboardNavItem];
  }
  if (showAdminPanel) {
    navItems = [...navItems, adminNavItem];
  }

  // Filter nav items for mobile - hide Editor and Coach Dashboard for admins/superadmins
  const mobileNavItems = navItems.filter(item => {
    if (showAdminPanel) {
      // Hide Coach Dashboard (/coach) and Editor (/editor) on mobile for admins
      if (item.path === '/coach' || item.path === '/editor') {
        return false;
      }
    }
    return true;
  });

  // Only show sidebar if NOT in onboarding
  if (pathname.startsWith('/onboarding')) return null;

  return (
    <>
      {/* Desktop Sidebar - Apple Liquid Glass Style */}
      {/* Uses CSS variables for branding colors when preview mode or custom branding is active */}
      <aside className="hidden lg:flex flex-col w-64 fixed left-0 top-0 bottom-0 z-40 sidebar-branded backdrop-blur-xl border-r border-[#e1ddd8]/50 dark:border-[#272d38]/50 px-6 py-8">
        {/* Logo - Shows horizontal logo if available, otherwise square logo + title */}
        <Link href="/">
          <div className="flex items-center gap-2.5 mb-12 cursor-pointer group">
            {horizontalLogoUrl ? (
              /* Horizontal logo - replaces square logo + title */
              <div className="h-10 max-w-[200px] relative overflow-hidden">
                <Image 
                  src={horizontalLogoUrl}
                  alt={`${appTitle} Logo`}
                  width={200}
                  height={40}
                  className={`object-contain h-full w-auto ${
                    theme === 'dark' && !horizontalLogoUrlDark ? 'invert' : ''
                  }`}
                />
              </div>
            ) : (
              /* Default: Square logo + title */
              <>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all overflow-hidden relative bg-white dark:bg-white/10">
                  <Image 
                    src={logoUrl}
                    alt={`${appTitle} Logo`}
                    fill
                    className={`object-cover rounded-2xl ${
                      theme === 'dark' && !logoUrlDark ? 'invert' : ''
                    }`}
                  />
                </div>
                <span className="font-albert font-semibold text-xl text-[#1a1a1a] dark:text-[#faf8f6]">{appTitle}</span>
              </>
            )}
          </div>
        </Link>

        {/* Nav - More rounded, glass-like with accent color */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => (
            <Link 
              key={item.path}
              href={item.path}
              onMouseEnter={() => router.prefetch(item.path)}
              data-tour={(item as { dataTour?: string }).dataTour}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative
                ${isActive(item.path) 
                  ? 'sidebar-active-item backdrop-blur-sm font-semibold shadow-sm' 
                  : 'text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#faf8f6]/60 dark:hover:bg-[#181d28]/60 hover:backdrop-blur-sm hover:text-[#1a1a1a] dark:hover:text-[#faf8f6]'
                }
              `}
              style={isActive(item.path) ? {
                color: theme === 'dark' ? '#f5f5f8' : '#1a1a1a',
              } : undefined}
            >
              <span 
                className={`transition-colors ${isActive(item.path) ? 'sidebar-active-icon' : 'text-[#a7a39e] dark:text-[#787470]'}`}
                style={isActive(item.path) && !isDefault ? {
                  color: colors.accentLight,
                } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-albert text-[15px]">{item.name}</span>
              {/* Unread badge for Chat */}
              {item.path === '/chat' && totalUnread > 0 && (
                <span 
                  className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-albert font-semibold"
                  style={{
                    backgroundColor: !isDefault ? currentAccentColor : (theme === 'dark' ? '#b8896a' : '#a07855'),
                    color: currentAccentIsDark ? '#ffffff' : '#1a1a1a',
                  }}
                >
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Account with Clerk UserButton - Rounded glass style */}
        <div className="mt-auto pt-6 border-t border-[#e1ddd8]/50 dark:border-[#272d38]/50 space-y-2">
          {/* Organization Switcher - only shows when user has multiple orgs */}
          <div className="px-2">
            <OrganizationSwitcher />
          </div>
          
          <div 
            onClick={(e) => {
              // Find the UserButton and trigger it
              const button = e.currentTarget.querySelector('button') as HTMLElement;
              if (button) {
                button.click();
              }
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[#faf8f6]/60 dark:hover:bg-[#181d28]/60 hover:backdrop-blur-sm transition-all duration-300 cursor-pointer"
          >
            <UserButton 
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-8 h-8 rounded-full",
                  userButtonTrigger: "focus:shadow-none"
                }
              }}
            />
            <span className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b5b0ab]">My Account</span>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation - Apple Liquid Glass Floating Pill with Safari-like scroll behavior */}
      <div 
        className={`
          lg:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-2 pb-safe
          transition-all duration-300 ease-in-out origin-bottom
          ${isCompact ? 'translate-y-[12px] scale-[0.92] opacity-90' : 'translate-y-0 scale-100 opacity-100'}
        `}
      >
        <nav className="mobile-nav-branded relative w-full max-w-md overflow-hidden rounded-[50px] shadow-lg shadow-black/5 dark:shadow-black/20">
          {/* Liquid Glass Background Layers */}
          <div className="absolute inset-0 bg-white/50 dark:bg-[#101520]/80 backdrop-blur-[24px] backdrop-saturate-150" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-white/10 dark:from-white/5 dark:to-transparent" />
          <div className="absolute inset-[0.5px] rounded-[50px] border border-white/40 dark:border-white/10" />
          
          {/* Tab Bar Content */}
          <div className="relative flex items-center justify-around px-2 py-2">
            {mobileNavItems.map((item) => (
              <Link 
                key={item.path} 
                href={item.path}
                onTouchStart={() => router.prefetch(item.path)}
                data-tour={(item as { dataTour?: string }).dataTour}
                className={`
                  relative flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-full transition-all
                  ${isActive(item.path) ? '' : 'text-[#5f5a55] dark:text-[#b5b0ab]'}
                `}
                style={isActive(item.path) && !isDefault ? {
                  color: colors.accentLight,
                } : isActive(item.path) ? {
                  color: '#a07855',
                } : undefined}
              >
                {/* Active Tab Background */}
                {isActive(item.path) && (
                  <div 
                    className="absolute inset-0 mobile-nav-active rounded-full" 
                  />
                )}
                <span 
                  className="relative z-10"
                  style={isActive(item.path) && !isDefault ? {
                    color: colors.accentLight,
                  } : isActive(item.path) ? {
                    color: '#a07855',
                  } : undefined}
                >
                  {item.icon}
                  {/* Unread badge for Chat - Mobile */}
                  {item.path === '/chat' && totalUnread > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-albert font-semibold"
                      style={{
                        backgroundColor: !isDefault ? currentAccentColor : (theme === 'dark' ? '#b8896a' : '#a07855'),
                        color: currentAccentIsDark ? '#ffffff' : '#1a1a1a',
                      }}
                    >
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </span>
                <span className={`relative z-10 text-[10px] font-albert ${isActive(item.path) ? 'font-semibold' : 'font-medium'}`}>
                  {item.name}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
