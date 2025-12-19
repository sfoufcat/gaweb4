'use client';

import { useState } from 'react';
import { AdminEventsSection } from './AdminEventsSection';
import { AdminArticlesSection } from './AdminArticlesSection';
import { AdminCoursesSection } from './AdminCoursesSection';

type DiscoverSubTab = 'events' | 'articles' | 'courses';

export function AdminDiscoverTab() {
  const [activeSubTab, setActiveSubTab] = useState<DiscoverSubTab>('events');

  const tabs: { id: DiscoverSubTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'events',
      label: 'Events',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'articles',
      label: 'Articles',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      ),
    },
    {
      id: 'courses',
      label: 'Courses',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Discover Content</h2>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mt-1">
            Manage events, articles, and courses for the Discover section
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 pb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors font-albert ${
              activeSubTab === tab.id
                ? 'bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 border-b-white dark:border-b-[#171b22] -mb-px text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]'
                : 'text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:text-[#f5f5f8] dark:hover:text-[#f5f5f8] hover:bg-white/50 dark:hover:bg-[#171b22]/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeSubTab === 'events' && <AdminEventsSection />}
        {activeSubTab === 'articles' && <AdminArticlesSection />}
        {activeSubTab === 'courses' && <AdminCoursesSection />}
      </div>
    </div>
  );
}




