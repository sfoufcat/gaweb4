'use client';

import { useState } from 'react';

interface ProfileTabsProps {
  defaultTab?: 'journey' | 'details';
  journeyContent: React.ReactNode;
  detailsContent: React.ReactNode;
  isOwnProfile?: boolean;
}

export function ProfileTabs({ defaultTab = 'journey', journeyContent, detailsContent, isOwnProfile = true }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<'journey' | 'details'>(defaultTab);
  
  // Tab labels change based on whether viewing own profile or someone else's
  const journeyLabel = isOwnProfile ? 'My journey' : 'Their journey';
  const detailsLabel = isOwnProfile ? 'My details' : 'Their details';

  return (
    <div className="flex flex-col w-full">
      {/* Tab Switcher - Full width like Squad */}
      <div className="flex items-center justify-center py-3">
        <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2 w-full">
          {/* My Journey Tab */}
          <button
            onClick={() => setActiveTab('journey')}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[32px] transition-all
              ${activeTab === 'journey' 
                ? 'bg-white dark:bg-[#1e222a] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none' 
                : 'bg-transparent'
              }
            `}
          >
            <svg 
              className={`w-5 h-5 ${activeTab === 'journey' ? 'text-text-secondary dark:text-[#b2b6c2]' : 'text-text-secondary dark:text-[#7d8190]'}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className={`font-albert text-lg font-semibold tracking-[-1px] leading-[1.3] ${
              activeTab === 'journey' ? 'text-text-primary dark:text-[#f5f5f8]' : 'text-text-secondary dark:text-[#7d8190]'
            }`}>
              {journeyLabel}
            </span>
          </button>

          {/* My Details Tab */}
          <button
            onClick={() => setActiveTab('details')}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[32px] transition-all
              ${activeTab === 'details' 
                ? 'bg-white dark:bg-[#1e222a] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none' 
                : 'bg-transparent'
              }
            `}
          >
            <svg 
              className={`w-5 h-5 ${activeTab === 'details' ? 'text-text-primary dark:text-[#f5f5f8]' : 'text-text-secondary dark:text-[#7d8190]'}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className={`font-albert text-lg font-semibold tracking-[-1px] leading-[1.3] ${
              activeTab === 'details' ? 'text-text-primary dark:text-[#f5f5f8]' : 'text-text-secondary dark:text-[#7d8190]'
            }`}>
              {detailsLabel}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'journey' ? journeyContent : detailsContent}
      </div>
    </div>
  );
}

