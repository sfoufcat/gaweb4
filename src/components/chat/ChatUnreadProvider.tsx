'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';

interface ChatUnreadContextValue {
  totalUnread: number;
  mainUnread: number;
  directUnread: number;
  isConnected: boolean;
  refresh: () => void;
}

const ChatUnreadContext = createContext<ChatUnreadContextValue>({
  totalUnread: 0,
  mainUnread: 0,
  directUnread: 0,
  isConnected: false,
  refresh: () => {},
});

/**
 * Provider component that wraps the app and provides chat unread counts
 * to any component that needs them (Sidebar, ChatTabs, etc.)
 */
export function ChatUnreadProvider({ children }: { children: ReactNode }) {
  const counts = useChatUnreadCounts();

  return (
    <ChatUnreadContext.Provider value={counts}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

/**
 * Hook to access chat unread counts from any component
 */
export function useChatUnread() {
  return useContext(ChatUnreadContext);
}

