'use client';

import { useState } from 'react';
import { Users, Heart, Package, Funnel as FunnelIcon } from 'lucide-react';
import { ClientActivityTab } from './ClientActivityTab';
import { AnalyticsTab } from '../AnalyticsTab';
import { ProductAnalyticsTab } from './ProductAnalyticsTab';
import { FunnelAnalyticsTab } from './FunnelAnalyticsTab';
import { GAConnectButton } from './GAConnectButton';

type TabType = 'clients' | 'community' | 'products' | 'funnels';

interface AnalyticsDashboardProps {
  apiBasePath?: string;
}

export function AnalyticsDashboard({ apiBasePath = '/api/coach/analytics' }: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('clients');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'clients', label: 'Client Activity', icon: <Users className="w-4 h-4" /> },
    { id: 'community', label: 'Community Health', icon: <Heart className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
    { id: 'funnels', label: 'Funnels', icon: <FunnelIcon className="w-4 h-4" /> },
  ];

  return (
    <div>
      {/* Header with tabs and GA button */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#a07855] text-white'
                  : 'bg-[#e1ddd8]/50 text-[#5f5a55] hover:bg-[#e1ddd8] dark:bg-[#272d38]/50 dark:text-[#b2b6c2] dark:hover:bg-[#272d38]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        
        <GAConnectButton apiBasePath={apiBasePath} />
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'clients' && <ClientActivityTab apiBasePath={apiBasePath} />}
        {activeTab === 'community' && <AnalyticsTab apiBasePath={apiBasePath} />}
        {activeTab === 'products' && <ProductAnalyticsTab apiBasePath={apiBasePath} />}
        {activeTab === 'funnels' && <FunnelAnalyticsTab apiBasePath={apiBasePath} />}
      </div>
    </div>
  );
}

