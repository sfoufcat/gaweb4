'use client';

import Image from 'next/image';
import { useChannelStateContext } from 'stream-chat-react';

/**
 * SquadChatHeader Component
 * 
 * Custom header for squad group chats featuring:
 * - Back button (mobile)
 * - Squad title
 * - Phone icon (placeholder)
 * - Horizontal scrollable member list
 */

interface SquadChatHeaderProps {
  onBack?: () => void;
  showBackButton?: boolean;
}

export function SquadChatHeader({ onBack, showBackButton = false }: SquadChatHeaderProps) {
  const { channel, members } = useChannelStateContext();
  
  // Cast channel.data to access custom properties
  const channelData = channel?.data as Record<string, unknown> | undefined;
  const channelName = (channelData?.name as string) || 'My Squad';
  const channelMembers = Object.values(members || {}).filter(m => m.user);

  return (
    <div className="bg-white border-b border-[#e1ddd8]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Back Button (Mobile) */}
          {showBackButton && (
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center text-[#1a1a1a] hover:bg-[#f3f1ef] rounded-full transition-colors lg:hidden"
              aria-label="Go back"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          {/* Title */}
          <h2 className="font-albert text-[18px] font-semibold text-[#1a1a1a]">
            {channelName}
          </h2>
        </div>

        {/* Phone Icon (placeholder for future video call) */}
        <button
          className="w-10 h-10 flex items-center justify-center text-[#5f5a55] hover:bg-[#f3f1ef] rounded-full transition-colors"
          aria-label="Start call"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </button>
      </div>

      {/* Member Strip - Horizontal Scrollable */}
      {channelMembers.length > 0 && (
        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex gap-4">
            {channelMembers.slice(0, 10).map((member) => {
              const user = member.user;
              if (!user) return null;
              
              const name = user.name || 'User';
              const firstName = name.split(' ')[0];
              const displayName = firstName.length > 8 ? `${firstName.substring(0, 7)}...` : firstName;
              const initial = name.charAt(0).toUpperCase();
              const avatar = user.image;
              
              return (
                <div key={user.id} className="flex flex-col items-center flex-shrink-0">
                  {/* Avatar */}
                  <div className="relative">
                    {avatar ? (
                      <Image 
                        src={avatar} 
                        alt={name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#a07855] to-[#7d5c3e] flex items-center justify-center text-white font-albert font-semibold">
                        {initial}
                      </div>
                    )}
                    {/* Online indicator (placeholder) */}
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                  </div>
                  {/* Name */}
                  <span className="font-albert text-[11px] text-[#5f5a55] mt-1 text-center">
                    {displayName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SquadChatHeader;
