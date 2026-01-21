'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton, useAuth, useOrganizationList } from '@clerk/nextjs';
import Image from 'next/image';
import { isAdmin, canAccessEditorSection, isSuperAdmin, isOrgCoach } from '@/lib/admin-utils-shared';
import type { UserRole, OrgRole, MenuItemKey } from '@/types';
import { DEFAULT_MENU_ICONS } from '@/types';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';
import { useBranding, useBrandingValues, useFeedEnabled, useEmptyStateBehaviors } from '@/contexts/BrandingContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
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
  const { effectiveBranding } = useBranding();
  const { theme } = useTheme();
  
  // Get organization context for tenant-specific role checking (Firestore-based)
  const { organizations, isLoading: orgLoading } = useOrganization();
  
  // Get Clerk native organization memberships (direct from Clerk)
  const { userMemberships, isLoaded: clerkOrgsLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  
  // Get the appropriate accent color and foreground based on theme
  const currentAccentColor = theme === 'dark' ? colors.accentDark : colors.accentLight;
  const currentAccentIsDark = theme === 'dark' ? accentDarkIsDark : accentLightIsDark;
  
  // Squad and program state for navigation visibility
  const { hasEnrollments } = useMyPrograms();
  const { hasStandaloneSquad } = useSquad();
  const feedEnabled = useFeedEnabled(); // From Edge Config via SSR - instant, no flash
  const { programEmptyStateBehavior, squadEmptyStateBehavior } = useEmptyStateBehaviors();
  
  // Navigation visibility logic:
  // - Program: Show if user has enrollments, OR coach config says show discover page, OR demo mode
  // - Squad: Show if user has standalone squad (not program-attached), OR coach config says show discover page, OR demo mode
  // - Feed: Show if feed is enabled for the org (from SSR for instant rendering), OR demo mode
  const showProgramNav = isDemoSite || hasEnrollments || programEmptyStateBehavior === 'discover';
  const showSquadNav = isDemoSite || hasStandaloneSquad || squadEmptyStateBehavior === 'discover';
  const showFeedNav = isDemoSite || feedEnabled;
  
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
  const showEditorPanel = canAccessEditorSection(role);
  // DEPRECATED: showMyCoach - my-coach page is deprecated, keeping for reference
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const showMyCoach = !isDemoSite && (hasCoaching || isSuperAdmin(role));
  
  // TENANT-SPECIFIC COACH ACCESS CHECK
  // On tenant domains, we need to verify the user has coach/super_coach role IN THIS SPECIFIC TENANT
  // Not just any coach role from another org stored in publicMetadata
  // Note: effectiveBranding.organizationId is 'default' on platform domain
  const currentTenantOrgId = !isDefault && effectiveBranding.organizationId !== 'default' 
    ? effectiveBranding.organizationId 
    : null;
  
  // Find user's membership in the current tenant org (Firestore-based)
  const currentTenantMembership = useMemo(() => {
    if (!currentTenantOrgId || !organizations || organizations.length === 0) {
      return null;
    }
    return organizations.find(org => org.id === currentTenantOrgId);
  }, [currentTenantOrgId, organizations]);
  
  // Find user's Clerk membership in the current tenant org
  const clerkTenantMembership = useMemo(() => {
    if (!currentTenantOrgId || !userMemberships?.data) {
      return null;
    }
    return userMemberships.data.find(m => m.organization.id === currentTenantOrgId);
  }, [currentTenantOrgId, userMemberships?.data]);
  
  // Check if user is admin in Clerk for this tenant (org:admin = super_coach equivalent)
  const isClerkAdmin = clerkTenantMembership?.role === 'org:admin';
  
  // Determine coach dashboard access:
  // - On platform domain (isDefault=true): Use publicMetadata roles (legacy behavior)
  // - On tenant domain: Check BOTH Clerk native memberships AND Firestore memberships
  const showCoachDashboard = useMemo(() => {
    // Demo mode always shows coach dashboard
    if (isDemoSite) return true;
    
    // Platform domain: use publicMetadata roles (admin, super_admin, global coach)
    if (isDefault) {
      // On platform domain, show for global coaches/admins
      return role === 'coach' || role === 'admin' || role === 'super_admin';
    }
    
    // Tenant domain: check actual membership in THIS tenant
    // Super admins can always see coach dashboard (for debugging/support)
    if (role === 'super_admin') return true;
    
    // Check 1: Clerk native membership - org:admin is equivalent to super_coach
    if (isClerkAdmin) {
      console.log('🔍 Clerk org:admin found - granting coach dashboard access');
      return true;
    }
    
    // Check 2: Firestore membership via OrganizationContext
    if (currentTenantMembership) {
      const membershipOrgRole = currentTenantMembership.membership?.orgRole as OrgRole | undefined;
      console.log('🔍 Checking Firestore membership orgRole:', membershipOrgRole, 'isOrgCoach:', isOrgCoach(membershipOrgRole));
      return isOrgCoach(membershipOrgRole);
    }
    
    // Still loading? Wait - don't flash anything
    if (orgLoading || !clerkOrgsLoaded) {
      console.log('🔍 Still loading memberships...');
      return false; // Don't show while loading - prevents flash
    }
    
    // Both systems loaded, no membership found - no access
    console.log('🔍 No coach membership found in tenant');
    return false;
  }, [isDemoSite, isDefault, role, isClerkAdmin, currentTenantMembership, orgLoading, clerkOrgsLoaded]);

  // DEBUG: Log session claims and role
  useEffect(() => {
    console.log('🔍 DEBUG - Sidebar Role Check:');
    console.log('isLoaded:', isLoaded);
    console.log('isSignedIn:', isSignedIn);
    console.log('userId:', userId);
    console.log('publicMetadata role:', role);
    console.log('publicMetadata orgRole:', orgRole);
    console.log('isDefault (platform domain):', isDefault);
    console.log('currentTenantOrgId:', currentTenantOrgId);
    console.log('-- Clerk Memberships --');
    console.log('clerkOrgsLoaded:', clerkOrgsLoaded);
    console.log('clerkTenantMembership:', clerkTenantMembership);
    console.log('isClerkAdmin:', isClerkAdmin);
    console.log('-- Firestore Memberships --');
    console.log('orgLoading:', orgLoading);
    console.log('currentTenantMembership:', currentTenantMembership);
    console.log('currentTenantMembership?.membership?.orgRole:', currentTenantMembership?.membership?.orgRole);
    console.log('-- Result --');
    console.log('showCoachDashboard:', showCoachDashboard);
  }, [isLoaded, isSignedIn, userId, role, orgRole, isDefault, currentTenantOrgId, clerkOrgsLoaded, clerkTenantMembership, isClerkAdmin, orgLoading, currentTenantMembership, showCoachDashboard]);

  // Prefetch pages on mount to reduce loading time
  useEffect(() => {
    router.prefetch('/');  // Home page
    router.prefetch('/chat');
    if (showFeedNav) {
      router.prefetch('/feed');
    }
    // DEPRECATED: my-coach prefetch removed - page deprecated
    if (showCoachDashboard) {
      router.prefetch('/coach');
    }
    if (showAdminPanel) {
      router.prefetch('/admin');
    }
    if (showEditorPanel) {
      router.prefetch('/editor');
    }
  }, [router, showFeedNav, showCoachDashboard, showAdminPanel, showEditorPanel]);
  
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
    // DEPRECATED: my-coach page no longer used for clients - keeping code for reference
    coach: {
      name: menuTitles.coach,
      path: '/my-coach',
      icon: <NavIcon iconKey={menuIcons.coach} />,
      visible: false, // DEPRECATED: was showMyCoach
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

  // Filter nav items for mobile - hide Editor, Coach Dashboard, and Chat
  // Chat is now accessed via ChatIconButton in the header (ChatSheet slide-up)
  const mobileNavItems = navItems.filter(item => {
    // Hide Chat on mobile - accessed via ChatSheet slide-up from header
    if (item.path === '/chat') {
      return false;
    }
    if (showAdminPanel) {
      // Hide Coach Dashboard (/coach) and Editor (/editor) on mobile for admins
      if (item.path === '/coach' || item.path === '/editor') {
        return false;
      }
    }
    return true;
  });

  // Only show sidebar if NOT in onboarding
  if (pathname.startsWith('/onboarding')) {
    console.log('[Sidebar] Hiding: onboarding path');
    return null;
  }

  // Debug logging
  console.log('[Sidebar] Rendering for:', { pathname, userId, isSignedIn, isLoaded, navItemsCount: navItems.length });

  // Collapsed sidebar for chat and coach pages (same layout pattern)
  const isCollapsed = pathname === '/chat' || pathname.startsWith('/chat/') ||
                      pathname === '/coach' || pathname.startsWith('/coach?');

  return (
    <>
      {/* Desktop Sidebar - Apple Liquid Glass Style */}
      {/* Uses CSS variables for branding colors when preview mode or custom branding is active */}
      {/* Collapses to icons only when on /chat (Instagram DM style) */}
      <aside className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-[9999] sidebar-branded backdrop-blur-xl border-r border-[#e1ddd8]/50 dark:border-[#272d38]/50 transition-all duration-300 ease-in-out py-6 pointer-events-auto ${isCollapsed ? 'w-[72px] px-3' : 'w-64 px-6'}`}>
        {/* Logo - Shows horizontal logo if available, otherwise square logo + title */}
        {/* In collapsed mode, only show square logo centered with smooth transition */}
        <Link href="/">
          <div className={`flex items-center cursor-pointer group overflow-hidden transition-all duration-300 ease-in-out mb-8 ${isCollapsed ? '' : 'gap-2.5'}`}>
            {/* Square logo - always visible */}
            <div className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all overflow-hidden relative bg-white dark:bg-white/10">
              <Image
                src={logoUrl}
                alt={`${appTitle} Logo`}
                fill
                className={`object-cover rounded-2xl ${
                  theme === 'dark' && !logoUrlDark ? 'invert' : ''
                }`}
              />
            </div>
            {/* Title or horizontal logo - fades in/out */}
            {horizontalLogoUrl ? (
              <div
                className={`h-10 max-w-[200px] relative overflow-hidden transition-all duration-300 ease-in-out ${
                  isCollapsed ? 'opacity-0 max-w-0 scale-x-0 origin-left' : 'opacity-100 max-w-[200px] scale-x-100 origin-left'
                }`}
              >
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
              <span
                className={`font-albert font-semibold text-xl text-[#1a1a1a] dark:text-[#faf8f6] whitespace-nowrap transition-all duration-300 ease-in-out ${
                  isCollapsed ? 'opacity-0 max-w-0 scale-x-0 origin-left' : 'opacity-100 max-w-[200px] scale-x-100 origin-left'
                }`}
              >
                {appTitle}
              </span>
            )}
          </div>
        </Link>

        {/* Nav - More rounded, glass-like with accent color */}
        {/* In collapsed mode, show only icons centered */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onMouseEnter={() => router.prefetch(item.path)}
              data-tour={(item as { dataTour?: string }).dataTour}
              title={isCollapsed ? item.name : undefined}
              className={`
                flex items-center transition-all duration-300 ease-in-out relative overflow-hidden
                h-12 rounded-2xl px-3
                ${isCollapsed
                  ? 'w-12'
                  : 'w-full gap-3'
                }
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
                className={`relative flex-shrink-0 transition-colors duration-300 ${isActive(item.path) ? 'sidebar-active-icon' : 'text-[#a7a39e] dark:text-[#787470]'}`}
                style={isActive(item.path) && !isDefault ? {
                  color: colors.accentLight,
                } : undefined}
              >
                {item.icon}
                {/* Unread badge for Chat - positioned on icon in collapsed mode */}
                {isCollapsed && item.path === '/chat' && totalUnread > 0 && (
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
              {/* Text labels - always rendered, controlled via opacity for smooth transitions */}
              <span
                className={`font-albert text-[15px] whitespace-nowrap transition-all duration-300 ease-in-out ${
                  isCollapsed
                    ? 'opacity-0 max-w-0 scale-x-0 origin-left'
                    : 'opacity-100 max-w-[200px] scale-x-100 origin-left'
                }`}
              >
                {item.name}
              </span>
              {/* Unread badge for Chat - inline in expanded mode */}
              {item.path === '/chat' && totalUnread > 0 && (
                <span
                  className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-albert font-semibold transition-all duration-300 ease-in-out ${
                    isCollapsed ? 'opacity-0 max-w-0 scale-x-0 origin-left' : 'opacity-100 ml-auto scale-x-100 origin-left'
                  }`}
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
          {/* Organization Switcher - only shows when user has multiple orgs and not collapsed */}
          {!isCollapsed && (
            <div className="px-2">
              <OrganizationSwitcher />
            </div>
          )}
          
          <div 
            onClick={(e) => {
              // Find the UserButton and trigger it
              const button = e.currentTarget.querySelector('button') as HTMLElement;
              if (button) {
                button.click();
              }
            }}
            title={isCollapsed ? 'My Account' : undefined}
            className={`flex items-center h-12 rounded-2xl px-2 hover:bg-[#faf8f6]/60 dark:hover:bg-[#181d28]/60 hover:backdrop-blur-sm transition-all duration-300 ease-in-out cursor-pointer overflow-hidden ${isCollapsed ? 'w-12' : 'w-full gap-3'}`}
          >
            <div className="flex-shrink-0">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "w-8 h-8 rounded-full",
                    userButtonTrigger: "focus:shadow-none"
                  }
                }}
              />
            </div>
            <span
              className={`font-albert text-[15px] text-[#5f5a55] dark:text-[#b5b0ab] whitespace-nowrap transition-all duration-300 ease-in-out ${
                isCollapsed
                    ? 'opacity-0 max-w-0 scale-x-0 origin-left'
                    : 'opacity-100 max-w-[200px] scale-x-100 origin-left'
              }`}
            >
              My Account
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation - Apple Glass + Instagram Simplicity */}
      <div
        className={`
          lg:hidden fixed bottom-0 left-0 right-0 z-[9999] flex justify-center px-5
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] origin-bottom
          pointer-events-none
          ${isCompact ? 'translate-y-[10px] scale-[0.94] opacity-95' : 'translate-y-0 scale-100 opacity-100'}
        `}
      >

        <nav className="mobile-nav-branded pointer-events-auto relative overflow-hidden rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {/* Apple Glass Background - Multi-layer blur effect */}
          <div className="absolute inset-0 bg-[#faf8f6]/85 dark:bg-[#05070b]/85 backdrop-blur-[40px] backdrop-saturate-[180%]" />
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/20 dark:from-white/10 dark:via-transparent dark:to-white/5" />
          {/* Glass edge highlight */}
          <div className="absolute inset-[0.5px] rounded-[27.5px] border border-white/50 dark:border-white/15" />
          
          {/* Tab Bar Content - Icons only */}
          <div className="relative flex items-center justify-center gap-1 px-3 py-2.5">
            {mobileNavItems.map((item) => (
              <Link 
                key={item.path} 
                href={item.path}
                onTouchStart={() => router.prefetch(item.path)}
                data-tour={(item as { dataTour?: string }).dataTour}
                className={`
                  relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200
                  ${isActive(item.path) 
                    ? '' 
                    : 'text-[#8e8e93] dark:text-[#8e8e93] active:scale-90'
                  }
                `}
                style={isActive(item.path) && !isDefault ? {
                  color: colors.accentLight,
                } : isActive(item.path) ? {
                  color: theme === 'dark' ? '#ffffff' : '#1a1a1a',
                } : undefined}
              >
                {/* Active Tab Background - Subtle glass pill */}
                {isActive(item.path) && (
                  <div 
                    className="absolute inset-1 rounded-full bg-black/[0.06] dark:bg-white/[0.12]" 
                  />
                )}
                <span 
                  className="relative z-10 flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6"
                  style={isActive(item.path) && !isDefault ? {
                    color: colors.accentLight,
                  } : isActive(item.path) ? {
                    color: theme === 'dark' ? '#ffffff' : '#1a1a1a',
                  } : undefined}
                >
                  {item.icon}
                  {/* Unread badge for Chat - Mobile */}
                  {item.path === '/chat' && totalUnread > 0 && (
                    <span 
                      className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-albert font-bold shadow-sm"
                      style={{
                        backgroundColor: !isDefault ? currentAccentColor : '#ff3b30',
                        color: '#ffffff',
                      }}
                    >
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </div>

    </>
  );
}
