'use client';

import { useState, useEffect } from 'react';
import { Users, Heart, Package, Funnel as FunnelIcon, FileText, MessageCircle } from 'lucide-react';
import { ClientActivityTab } from './ClientActivityTab';
import { AnalyticsTab } from '../AnalyticsTab';
import { ProductAnalyticsTab } from './ProductAnalyticsTab';
import { FunnelAnalyticsTab } from './FunnelAnalyticsTab';
import { FeedAnalyticsTab } from './FeedAnalyticsTab';
import { ChatAnalyticsTab } from './ChatAnalyticsTab';
import { GAConnectButton } from './GAConnectButton';

type TabType = 'clients' | 'community' | 'feed' | 'chats' | 'products' | 'funnels';

interface AnalyticsDashboardProps {
  apiBasePath?: string;
  /** Optional sub-tab to restore selection from URL */
  initialSubTab?: string | null;
  /** Callback when sub-tab selection changes (for URL persistence) */
  onSubTabChange?: (subTab: string | null) => void;
  /** Optional squad ID for community health tab */
  initialSquadId?: string | null;
  /** Callback when squad selection changes in community health tab */
  onSquadSelect?: (squadId: string | null) => void;
}

export function AnalyticsDashboard({ apiBasePath = '/api/coach/analytics', initialSubTab, onSubTabChange, initialSquadId, onSquadSelect }: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (initialSubTab && ['clients', 'community', 'feed', 'chats', 'products', 'funnels'].includes(initialSubTab)) {
      return initialSubTab as TabType;
    }
    return 'clients';
  });

  const tabs: { id: TabType; label: string; mobileLabel?: string; icon: React.ReactNode }[] = [
    { id: 'clients', label: 'Client Activity', mobileLabel: 'Client', icon: <Users className="w-4 h-4" /> },
    { id: 'community', label: 'Community Health', mobileLabel: 'Community', icon: <Heart className="w-4 h-4" /> },
    { id: 'feed', label: 'Feed', icon: <FileText className="w-4 h-4" /> },
    { id: 'chats', label: 'Chat', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
    { id: 'funnels', label: 'Funnels', icon: <FunnelIcon className="w-4 h-4" /> },
  ];

  // Notify parent when sub-tab selection changes (for URL persistence)
  useEffect(() => {
    onSubTabChange?.(activeTab);
  }, [activeTab, onSubTabChange]);

  return (
    <div>
      {/* Header with tabs and GA button */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium font-albert flex items-center gap-2 transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
              }`}
            >
              <span className="w-4 h-4">
                {tab.icon}
              </span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.mobileLabel || tab.label}</span>
            </button>
          ))}
        </div>

        <GAConnectButton apiBasePath={apiBasePath} />
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'clients' && <ClientActivityTab apiBasePath={apiBasePath} />}
        {activeTab === 'community' && <AnalyticsTab apiBasePath={apiBasePath} initialSquadId={initialSquadId} onSquadSelect={onSquadSelect} />}
        {activeTab === 'feed' && <FeedAnalyticsTab apiBasePath={apiBasePath} />}
        {activeTab === 'chats' && <ChatAnalyticsTab apiBasePath={apiBasePath} />}
        {activeTab === 'products' && <ProductAnalyticsTab apiBasePath={apiBasePath} />}
        {activeTab === 'funnels' && <FunnelAnalyticsTab apiBasePath={apiBasePath} />}
      </div>
    </div>
  );
}
