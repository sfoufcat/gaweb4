'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Lazy load ChatSheet - it's heavy (imports stream-chat-react) and only needed when opened
const ChatSheet = dynamic(
  () => import('@/components/chat/ChatSheet').then(mod => ({ default: mod.ChatSheet })),
  { ssr: false }
);

interface ChatSheetContextValue {
  /** Whether the chat sheet is currently open */
  isOpen: boolean;
  /** Channel ID to auto-select when sheet opens (optional) */
  initialChannelId: string | null;
  /** Open the chat sheet, optionally with a specific channel */
  openChatSheet: (channelId?: string) => void;
  /** Close the chat sheet */
  closeChatSheet: () => void;
}

const ChatSheetContext = createContext<ChatSheetContextValue>({
  isOpen: false,
  initialChannelId: null,
  openChatSheet: () => {},
  closeChatSheet: () => {},
});

interface ChatSheetProviderProps {
  children: ReactNode;
}

/**
 * ChatSheetProvider
 * 
 * Provides global access to open/close the ChatSheet slideup from anywhere in the app.
 * This enables components like squad chat buttons to open the chat slideup on mobile
 * instead of navigating to the full chat page.
 * 
 * Usage:
 * ```tsx
 * const { openChatSheet } = useChatSheet();
 * openChatSheet('squad-123'); // Opens sheet with squad channel selected
 * openChatSheet(); // Opens sheet with channel list
 * ```
 */
export function ChatSheetProvider({ children }: ChatSheetProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialChannelId, setInitialChannelId] = useState<string | null>(null);

  const openChatSheet = useCallback((channelId?: string) => {
    setInitialChannelId(channelId || null);
    setIsOpen(true);
  }, []);

  const closeChatSheet = useCallback(() => {
    setIsOpen(false);
    // Clear the initial channel after a delay to allow animation to complete
    setTimeout(() => {
      setInitialChannelId(null);
    }, 300);
  }, []);

  return (
    <ChatSheetContext.Provider
      value={{
        isOpen,
        initialChannelId,
        openChatSheet,
        closeChatSheet,
      }}
    >
      {children}
      
      {/* Render the ChatSheet at the provider level */}
      <ChatSheet
        isOpen={isOpen}
        onClose={closeChatSheet}
        initialChannelId={initialChannelId}
      />
    </ChatSheetContext.Provider>
  );
}

/**
 * Hook to access the chat sheet controls
 * 
 * @example
 * ```tsx
 * const { openChatSheet, closeChatSheet } = useChatSheet();
 * 
 * // Open with specific channel
 * openChatSheet('squad-abc123');
 * 
 * // Open to channel list
 * openChatSheet();
 * ```
 */
export function useChatSheet() {
  const context = useContext(ChatSheetContext);
  if (!context) {
    throw new Error('useChatSheet must be used within a ChatSheetProvider');
  }
  return context;
}

