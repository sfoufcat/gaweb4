'use client';

import { cn } from '@/lib/utils';

// Tab types from coach page
export type CoachTab = 'clients' | 'squads' | 'programs' | 'referrals' | 'analytics' | 'discounts' | 'discover' | 'upgrade-forms' | 'coaching-forms' | 'funnels' | 'website' | 'checkins' | 'onboarding' | 'channels' | 'scheduling' | 'integrations' | 'customize' | 'plan' | 'support';

export interface NavItem {
  value: CoachTab;
  label: string;
}

export interface NavGroup {
  name: string;
  items: NavItem[];
}

// Full navigation groups
export const FULL_NAV_GROUPS: NavGroup[] = [
  {
    name: 'Core',
    items: [
      { value: 'clients', label: 'Clients' },
      { value: 'scheduling', label: 'Schedule' },
      { value: 'programs', label: 'Programs' },
      // HIDDEN: Standalone squads disabled - squads now managed via Program > Community
      // { value: 'squads', label: 'Squads' },
      { value: 'discover', label: 'Resources' },
    ],
  },
  {
    name: 'Marketing',
    items: [
      { value: 'website', label: 'Website' },
      { value: 'funnels', label: 'Funnels' },
      { value: 'analytics', label: 'Analytics' },
    ],
  },
  {
    name: 'Engagement',
    items: [
      { value: 'channels', label: 'Chats' },
      { value: 'checkins', label: 'Check-ins' },
      { value: 'onboarding', label: 'Onboarding' },
    ],
  },
  {
    name: 'Business',
    items: [
      { value: 'referrals', label: 'Referrals' },
      { value: 'discounts', label: 'Discounts' },
      { value: 'integrations', label: 'Integrations' },
    ],
  },
  {
    name: 'Settings',
    items: [
      { value: 'customize', label: 'Customize' },
      { value: 'plan', label: 'Plan' },
      { value: 'support', label: 'Support' },
    ],
  },
];

// Limited navigation groups (for org coaches with limited access)
export const LIMITED_NAV_GROUPS: NavGroup[] = [
  {
    name: 'Core',
    items: [
      { value: 'clients', label: 'Clients' },
      // HIDDEN: Standalone squads disabled - squads now managed via Program > Community
      // { value: 'squads', label: 'Squads' },
      { value: 'discover', label: 'Resources' },
    ],
  },
];

interface CoachSidebarProps {
  activeTab: CoachTab;
  onTabChange: (tab: CoachTab) => void;
  isLimitedOrgCoach?: boolean;
}

export function CoachSidebar({ activeTab, onTabChange, isLimitedOrgCoach = false }: CoachSidebarProps) {
  const navGroups = isLimitedOrgCoach ? LIMITED_NAV_GROUPS : FULL_NAV_GROUPS;

  return (
    <nav className="flex-1 p-3 space-y-1">
      {navGroups.map((group, groupIndex) => (
        <div key={group.name}>
          {/* Group Header */}
          <div
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wider",
              "text-[#a09a94] dark:text-[#6b7280]",
              "px-3 py-2",
              groupIndex > 0 && "mt-4"
            )}
          >
            {group.name}
          </div>

          {/* Group Items */}
          {group.items.map((item) => {
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.value}
                data-tour-tab={item.value}
                onClick={() => onTabChange(item.value)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm font-medium font-albert",
                  "transition-colors duration-200",
                  isActive
                    ? "bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-white shadow-sm font-semibold"
                    : "text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
