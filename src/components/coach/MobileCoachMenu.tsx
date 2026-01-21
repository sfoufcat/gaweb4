'use client';

import { cn } from '@/lib/utils';
import {
  FULL_NAV_GROUPS,
  LIMITED_NAV_GROUPS,
  type CoachTab,
} from './CoachSidebar';

interface MobileCoachMenuProps {
  activeTab: CoachTab;
  onTabSelect: (tab: CoachTab) => void;
  isLimitedOrgCoach?: boolean;
}

/**
 * Full-screen mobile menu for the coach dashboard.
 * Displays navigation groups in a vertical list format.
 */
export function MobileCoachMenu({
  activeTab,
  onTabSelect,
  isLimitedOrgCoach = false,
}: MobileCoachMenuProps) {
  const navGroups = isLimitedOrgCoach ? LIMITED_NAV_GROUPS : FULL_NAV_GROUPS;

  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] px-4 py-6 animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-1px]">
          Coach Dashboard
        </h1>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-2">
          {isLimitedOrgCoach
            ? 'View your assigned squads and coaching clients'
            : 'Manage your squads and 1:1 coaching clients'}
        </p>
      </div>

      {/* Navigation Groups */}
      <nav className="space-y-6">
        {navGroups.map((group) => (
          <div key={group.name}>
            {/* Group Header */}
            <div
              className={cn(
                'text-[11px] font-semibold uppercase tracking-wider',
                'text-[#a09a94] dark:text-[#6b7280]',
                'px-1 mb-2'
              )}
            >
              {group.name}
            </div>

            {/* Group Items */}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = activeTab === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => onTabSelect(item.value)}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-xl text-base font-medium font-albert',
                      'transition-colors duration-200',
                      isActive
                        ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-white shadow-sm font-semibold'
                        : 'text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white active:bg-[#e1ddd8] dark:active:bg-[#2d333d]'
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
