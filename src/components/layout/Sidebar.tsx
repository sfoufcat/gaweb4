'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { isAdmin, canAccessCoachDashboard, canAccessEditorSection, isSuperAdmin } from '@/lib/admin-utils-shared';
import type { UserRole, OrgRole } from '@/types';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';
import { useBrandingValues } from '@/contexts/BrandingContext';

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
  const { sessionClaims, isLoaded, isSignedIn, userId } = useAuth();
  const { totalUnread } = useChatUnreadCounts();
  const { scrollDirection, isAtTop } = useScrollDirection();
  const { logoUrl, horizontalLogoUrl, appTitle, colors, menuTitles, isDefault, accentLightIsDark, accentDarkIsDark: _accentDarkIsDark } = useBrandingValues();
  
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
  }, [router, showMyCoach, showCoachDashboard, showAdminPanel, showEditorPanel]);
  
  const baseNavItems = [
    { name: menuTitles.home, path: '/', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { name: menuTitles.squad, path: '/squad', dataTour: 'squad-nav', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )},
    { name: menuTitles.learn, path: '/discover', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )},
    { name: menuTitles.chat, path: '/chat', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )},
  ];

  // My Coach item - visible for coaching subscribers and super_admin
  const myCoachNavItem = { 
    name: menuTitles.coach, 
    path: '/my-coach', 
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  };

  // Coach item - visible for coach, admin, super_admin (coach dashboard for managing clients/squads)
  const coachNavItem = { 
    name: menuTitles.coach, 
    path: '/coach', 
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )
  };

  // Editor item - visible for editor and super_admin
  const editorNavItem = { 
    name: 'Editor', 
    path: '/editor', 
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )
  };

  // Add Admin item if user has admin access
  const adminNavItem = { 
    name: 'Admin', 
    path: '/admin', 
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  };

  // Build nav items: base + my-coach (if coaching subscriber) + editor + coach dashboard + admin
  let navItems = [...baseNavItems];
  if (showMyCoach) {
    navItems = [...navItems, myCoachNavItem];
  }
  if (showEditorPanel) {
    navItems = [...navItems, editorNavItem];
  }
  if (showCoachDashboard) {
    navItems = [...navItems, coachNavItem];
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
                  className="object-contain h-full w-auto"
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
                    className="object-cover rounded-2xl"
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
                color: accentLightIsDark ? '#1a1a1a' : '#1a1a1a',
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
                    backgroundColor: !isDefault ? colors.accentLight : '#a07855',
                    color: accentLightIsDark ? '#ffffff' : '#1a1a1a',
                  }}
                >
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Account with Clerk UserButton - Rounded glass style */}
        <div className="mt-auto pt-6 border-t border-[#e1ddd8]/50 dark:border-[#272d38]/50">
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
                        backgroundColor: !isDefault ? colors.accentLight : '#a07855',
                        color: accentLightIsDark ? '#ffffff' : '#1a1a1a',
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
