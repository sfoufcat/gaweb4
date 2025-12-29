'use client';

import React, { useState } from 'react';
import { AdminStarterProgramsTab } from './AdminStarterProgramsTab';
import { AdminDynamicPromptsTab } from './AdminDynamicPromptsTab';

type SubTab = 'programs' | 'prompts';

interface AdminTracksAndProgramsTabProps {
  /** Base path for starter programs API calls */
  programsApiBasePath?: string;
  /** Base path for dynamic prompts API calls */
  promptsApiBasePath?: string;
}

export function AdminTracksAndProgramsTab({
  programsApiBasePath = '/api/admin/starter-programs',
  promptsApiBasePath = '/api/admin/dynamic-prompts',
}: AdminTracksAndProgramsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('programs');

  return (
    <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Programs CMS
        </h2>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
          Manage starter programs and dynamic prompts
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <div className="flex px-6">
          <button
            onClick={() => setActiveSubTab('programs')}
            className={`px-4 py-3 font-albert text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === 'programs'
                ? 'border-brand-accent text-brand-accent'
                : 'border-transparent text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
            }`}
          >
            Starter Programs
          </button>
          <button
            onClick={() => setActiveSubTab('prompts')}
            className={`px-4 py-3 font-albert text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === 'prompts'
                ? 'border-brand-accent text-brand-accent'
                : 'border-transparent text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
            }`}
          >
            Dynamic Prompts
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeSubTab === 'programs' && <AdminStarterProgramsTab apiBasePath={programsApiBasePath} />}
        {activeSubTab === 'prompts' && <AdminDynamicPromptsTab apiBasePath={promptsApiBasePath} />}
      </div>
    </div>
  );
}
