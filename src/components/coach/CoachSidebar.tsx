'use client';

import { cn } from '@/lib/utils';

// Tab types from coach page
type CoachTab = 'clients' | 'squads' | 'programs' | 'referrals' | 'analytics' | 'discounts' | 'discover' | 'upgrade-forms' | 'coaching-forms' | 'funnels' | 'checkins' | 'onboarding' | 'channels' | 'scheduling' | 'integrations' | 'customize' | 'plan' | 'support';

interface NavItem {
  value: CoachTab;
  label: string;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

// Full navigation groups
const FULL_NAV_GROUPS: NavGroup[] = [
  {
    name: 'Core',
    items: [
      { value: 'clients', label: 'Clients' },
      { value: 'squads', label: 'Squads' },
      { value: 'programs', label: 'Programs' },
    ],
  },
  {
    name: 'Content',
    items: [
      { value: 'discover', label: 'Content' },
      { value: 'onboarding', label: 'Onboarding' },
    ],
  },
  {
    name: 'Engagement',
    items: [
      { value: 'channels', label: 'Chats' },
      { value: 'checkins', label: 'Check-ins' },
      { value: 'referrals', label: 'Referrals' },
    ],
  },
  {
    name: 'Analytics',
    items: [
      { value: 'analytics', label: 'Analytics' },
      { value: 'funnels', label: 'Funnels' },
    ],
  },
  {
    name: 'Business',
    items: [
      { value: 'scheduling', label: 'Scheduling' },
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
const LIMITED_NAV_GROUPS: NavGroup[] = [
  {
    name: 'Core',
    items: [
      { value: 'clients', label: 'Clients' },
      { value: 'squads', label: 'Squads' },
    ],
  },
  {
    name: 'Content',
    items: [
      { value: 'discover', label: 'Content' },
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
