'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useStreamChatClient } from '@/contexts/StreamChatContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import StreamChatComponents from './StreamChatComponents';
import DemoChatComponents from './DemoChatComponents';

// Loading skeleton component - uses app's brown/beige theme
function ChatLoadingSkeleton() {
  return (
    <div 
      className="fixed top-0 left-0 right-0 lg:left-[72px] flex flex-col bg-[#faf8f6] dark:bg-[#05070b] pb-[85px] lg:pb-0"
      style={{ height: '100dvh', minHeight: '-webkit-fill-available' }}
    >
      <div className="flex h-full overflow-hidden">
        {/* Channel List Skeleton */}
        <div className="w-80 border-r border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#05070b] flex-shrink-0 flex flex-col">
          {/* Header - matches our actual Messages header */}
          <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">Messages</h2>
          </div>
          
          {/* Channel list items */}
          <div className="flex-1 overflow-y-auto p-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div 
                key={i} 
                className="px-3 py-3 mb-1 rounded-xl bg-[#f3f1ef] dark:bg-[#11141b]"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full flex-shrink-0 bg-[#e1ddd8] dark:bg-[#262b35] animate-pulse" />
                  <div className="flex-1 min-w-0">
                    {/* Channel name */}
                    <div 
                      className="h-4 rounded bg-[#e1ddd8] dark:bg-[#262b35] animate-pulse mb-1.5"
                      style={{ width: `${55 + (i * 8) % 30}%` }}
                    />
                    {/* Last message */}
                    <div 
                      className="h-3 rounded bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse"
                      style={{ width: `${65 + (i * 5) % 25}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area - Show empty state */}
        <div className="flex-1 flex items-center justify-center bg-[#faf8f6] dark:bg-[#05070b]">
          <div className="text-center px-4 max-w-md">
            {/* Icon placeholder */}
            <div className="mx-auto w-16 h-16 rounded-full bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center mb-4">
              <div className="w-8 h-8 rounded-full bg-brand-accent/20 dark:bg-brand-accent/25 animate-pulse" />
            </div>
            {/* Title */}
            <div className="h-5 rounded-lg bg-[#e1ddd8] dark:bg-[#262b35] animate-pulse mx-auto mb-3" style={{ width: '220px' }} />
            {/* Description */}
            <div className="h-4 rounded-lg bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse mx-auto mb-2" style={{ width: '300px' }} />
            <div className="h-4 rounded-lg bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 animate-pulse mx-auto" style={{ width: '260px' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Chat Page
 * Stream Chat with Clerk authentication
 * 
 * OPTIMIZED: Uses shared Stream client from global context.
 * The client is already connected at app level, so this page loads INSTANTLY.
 * No duplicate connections, no waiting for token fetch or connectUser().
 */
export default function ChatPage() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const { client, isConnected, isConnecting } = useStreamChatClient();
  const { isDemoMode } = useDemoMode();
  
  // Get channel ID from URL params (for direct navigation to a specific channel)
  const initialChannelId = searchParams.get('channel');

  // Demo mode: show mock chat interface
  if (isDemoMode) {
    return <DemoChatComponents />;
  }

  // Show skeleton while:
  // 1. Clerk is loading user
  // 2. Stream client is connecting (should be rare since it starts at app load)
  // 3. User is not authenticated
  if (!isLoaded || !user || !client || (!isConnected && isConnecting)) {
    return <ChatLoadingSkeleton />;
  }

  // If client exists but isn't connected yet (edge case), show skeleton
  if (!isConnected) {
    return <ChatLoadingSkeleton />;
  }

  return <StreamChatComponents client={client} user={user} initialChannelId={initialChannelId} />;
}
