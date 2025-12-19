'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useDiscoverData } from '@/hooks/useDiscoverData';
import type {
  DiscoverEvent,
  DiscoverArticle,
  DiscoverCourse,
  DiscoverCategory,
  TrendingItem,
  RecommendedItem,
} from '@/types/discover';

interface DiscoverContextType {
  events: DiscoverEvent[];
  upcomingEvents: DiscoverEvent[];
  pastEvents: DiscoverEvent[];
  articles: DiscoverArticle[];
  courses: DiscoverCourse[];
  categories: DiscoverCategory[];
  trending: TrendingItem[];
  recommended: RecommendedItem[];
  loading: boolean;
}

const DiscoverContext = createContext<DiscoverContextType | undefined>(undefined);

export function DiscoverProvider({ children }: { children: ReactNode }) {
  const data = useDiscoverData();

  return (
    <DiscoverContext.Provider value={data}>
      {children}
    </DiscoverContext.Provider>
  );
}

export function useDiscoverContext() {
  const context = useContext(DiscoverContext);
  if (context === undefined) {
    throw new Error('useDiscoverContext must be used within a DiscoverProvider');
  }
  return context;
}
