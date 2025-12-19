'use client';

import { useDiscoverContext } from '@/contexts/DiscoverContext';

// Re-export everything from the data hook file
export * from './useDiscoverData';

// Override the useDiscover hook to use the context
export function useDiscover() {
  return useDiscoverContext();
}
