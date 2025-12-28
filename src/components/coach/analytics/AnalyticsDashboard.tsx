'use client';

import { useState, useEffect, useRef } from 'react';
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
}

export function AnalyticsDashboard({ apiBasePath = '/api/coach/analytics' }: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('clients');
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayedTab, setDisplayedTab] = useState<TabType>('clients');
  const prevTabRef = useRef<TabType>('clients');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'clients', label: 'Client Activity', icon: <Users className="w-4 h-4" /> },
    { id: 'community', label: 'Community Health', icon: <Heart className="w-4 h-4" /> },
    { id: 'feed', label: 'Feed', icon: <FileText className="w-4 h-4" /> },
    { id: 'chats', label: 'Chat', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
    { id: 'funnels', label: 'Funnels', icon: <FunnelIcon className="w-4 h-4" /> },
  ];

  // Get tab index for direction calculation
  const getTabIndex = (tab: TabType) => tabs.findIndex(t => t.id === tab);

  useEffect(() => {
    if (activeTab !== displayedTab) {
      setIsAnimating(true);
      
      // Wait for exit animation, then switch content
      const timer = setTimeout(() => {
        prevTabRef.current = displayedTab;
        setDisplayedTab(activeTab);
        
        // Allow enter animation
        setTimeout(() => {
          setIsAnimating(false);
        }, 50);
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [activeTab, displayedTab]);

  const getAnimationClass = () => {
    if (!isAnimating) {
      return 'opacity-100 translate-x-0';
    }
    
    const prevIndex = getTabIndex(prevTabRef.current);
    const nextIndex = getTabIndex(activeTab);
    const direction = nextIndex > prevIndex ? 1 : -1;
    
    if (displayedTab === activeTab) {
      // Entering - come from the direction we're moving
      return `opacity-0 ${direction > 0 ? 'translate-x-8' : '-translate-x-8'}`;
    } else {
      // Exiting - go in the opposite direction
      return `opacity-0 ${direction > 0 ? '-translate-x-8' : 'translate-x-8'}`;
    }
  };

  return (
    <div>
      {/* Header with tabs and GA button */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-[#a07855] dark:bg-[#b8896a] text-white shadow-md scale-[1.02]'
                  : 'bg-[#e1ddd8]/50 text-[#5f5a55] hover:bg-[#e1ddd8] dark:bg-[#272d38]/50 dark:text-[#b2b6c2] dark:hover:bg-[#272d38] hover:scale-[1.01]'
              }`}
            >
              <span className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : ''}`}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>
        
        <GAConnectButton apiBasePath={apiBasePath} />
      </div>

      {/* Tab Content with Animation */}
      <div className="relative overflow-hidden">
        <div 
          className={`transition-all duration-200 ease-out ${getAnimationClass()}`}
        >
          {displayedTab === 'clients' && <ClientActivityTab apiBasePath={apiBasePath} />}
          {displayedTab === 'community' && <AnalyticsTab apiBasePath={apiBasePath} />}
          {displayedTab === 'feed' && <FeedAnalyticsTab apiBasePath={apiBasePath} />}
          {displayedTab === 'chats' && <ChatAnalyticsTab apiBasePath={apiBasePath} />}
          {displayedTab === 'products' && <ProductAnalyticsTab apiBasePath={apiBasePath} />}
          {displayedTab === 'funnels' && <FunnelAnalyticsTab apiBasePath={apiBasePath} />}
        </div>
      </div>
    </div>
  );
}
