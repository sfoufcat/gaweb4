'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import {
  useMessageContext,
  useChannelStateContext,
  Attachment,
} from 'stream-chat-react';
import { format } from 'date-fns';
import { getProfileUrl } from '@/lib/utils';
import { VoiceMessageAttachment } from './VoiceRecorder';
import { PollMessageCard } from './PollMessageCard';
import { PollResultsSheet } from './PollResultsSheet';
import { PostPreviewAttachment } from './PostPreviewAttachment';
import type { ChatPollState } from '@/types/poll';

/**
 * CustomMessage Component
 * 
 * Custom message renderer for Coachful chat:
 * - Message bubble with proper alignment (my messages right, others left)
 * - Avatar for others only
 * - Timestamp inside bubble (time only, e.g., "6:02 PM")
 * - Comments row for threaded messages
 * - 3-dot menu appears on hover, dropdown ONLY on click
 */

export function CustomMessage() {
  const {
    message,
    isMyMessage,
    handleOpenThread,
    handleDelete,
    threadList,
    readBy,
  } = useMessageContext();
  
  const { channel } = useChannelStateContext();
  const router = useRouter();
  const { user: clerkUser } = useUser();
  
  const [showOptionsIcon, setShowOptionsIcon] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showReactionSelector, setShowReactionSelector] = useState(false);
  const [animatingReaction, setAnimatingReaction] = useState<string | null>(null);
  const [pollData, setPollData] = useState<ChatPollState | null>(null);
  const [showPollResults, setShowPollResults] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  
  // Check if this is a poll message (using ga_ prefix to avoid Stream's native polls)
  // Using type assertion for custom poll fields not in Stream's type definitions
  const messageWithPoll = message as typeof message & { ga_poll_id?: string; ga_poll_data?: unknown; extraData?: { ga_poll_id?: string } };
  const isPollMessage = !!(
    messageWithPoll.ga_poll_id || 
    messageWithPoll.ga_poll_data ||
    messageWithPoll.extraData?.ga_poll_id
  );
  
  // Get poll ID
  const pollId = messageWithPoll.ga_poll_id || messageWithPoll.extraData?.ga_poll_id;
  
  const isMine = isMyMessage();
  const hasReplies = (message.reply_count || 0) > 0;
  const hasAttachments = (message.attachments?.length || 0) > 0;
  const hasReactions = (message.reaction_counts && Object.keys(message.reaction_counts).length > 0);
  
  // Format timestamp (time only)
  const timestamp = message.created_at 
    ? format(new Date(message.created_at), 'h:mm a')
    : '';
  
  // Get sender info
  const sender = message.user;
  const senderName = sender?.name || sender?.id || 'Unknown';
  const senderAvatar = sender?.image;
  
  // Thread participants (for comments row)
  const threadUsers = message.thread_participants || [];
  
  // Map emoji to Stream reaction types
  const emojiToReactionType: Record<string, string> = {
    '👍': 'like',
    '❤️': 'love',
    '😂': 'haha',
    '😮': 'wow',
    '😢': 'sad',
    '🙏': 'thanks',
  };
  
  const reactionTypeToEmoji: Record<string, string> = {
    'like': '👍',
    'love': '❤️',
    'haha': '😂',
    'wow': '😮',
    'sad': '😢',
    'thanks': '🙏',
  };

  // Navigate to user profile
  const handleProfileClick = (userId?: string) => {
    if (!userId) return;
    const profileUrl = getProfileUrl(userId, clerkUser?.id || '');
    router.push(profileUrl);
  };

  // Handle opening thread - use handleOpenThread from message context
  const handleOpenThreadClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMenuOpen(false);
    setShowReactionSelector(false);
    
    // Use Stream's built-in handleOpenThread
    if (handleOpenThread) {
      handleOpenThread(e as React.BaseSyntheticEvent);
    }
  };
  
  // Handle clicking 3-dot button to toggle menu
  const handleOptionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
    setShowReactionSelector(false);
  };
  
  // Handle clicking reaction button in menu
  const handleReactionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowReactionSelector(!showReactionSelector);
    setIsMenuOpen(false);
  };
  
  // Handle selecting a reaction - toggle: add if not present, remove if already reacted
  const handleReactionSelect = async (emoji: string) => {
    setShowReactionSelector(false);
    setIsMenuOpen(false);
    
    const reactionType = emojiToReactionType[emoji] || emoji;
    
    // Trigger animation
    setAnimatingReaction(reactionType);
    setTimeout(() => setAnimatingReaction(null), 400);
    
    try {
      if (channel && message.id) {
        // Check if user already reacted with this type
        const hasOwnReaction = message.own_reactions?.some(r => r.type === reactionType);
        
        if (hasOwnReaction) {
          // Remove the reaction
          await channel.deleteReaction(message.id, reactionType);
        } else {
          // Add the reaction
          await channel.sendReaction(message.id, { type: reactionType });
        }
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };
  
  // Handle edit - use Stream's channel.state to trigger edit mode
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    
    // Dispatch custom event that the input component can listen to
    const editEvent = new CustomEvent('stream-edit-message', { 
      detail: { message },
      bubbles: true 
    });
    messageRef.current?.dispatchEvent(editEvent);
  };
  
  // Handle delete
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (handleDelete) {
      handleDelete(e);
    }
  };
  
  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (messageRef.current && !messageRef.current.contains(event.target as Node)) {
        setShowReactionSelector(false);
        setIsMenuOpen(false);
      }
    };
    
    if (showReactionSelector || isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReactionSelector, isMenuOpen]);

  // Fetch poll data from API (includes userVotes for current user)
  useEffect(() => {
    if (!isPollMessage || !pollId) return;
    
    // Always fetch from API to get accurate userVotes
    fetch(`/api/polls?id=${pollId}`)
      .then(res => res.json())
      .then(data => {
        if (data.poll) {
          setPollData(data.poll);
        }
      })
      .catch(err => {
        console.error('Failed to fetch poll:', err);
        // Fall back to embedded data if API fails
        const embeddedPollData = messageWithPoll.ga_poll_data as ChatPollState | undefined;
        if (embeddedPollData) {
          setPollData(embeddedPollData);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPollMessage, pollId, message]); // messageWithPoll.ga_poll_data is derived from message

  // Handle poll vote
  const handlePollVote = useCallback(async (pollId: string, optionIds: string[]) => {
    try {
      const response = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId, optionIds }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to vote');
      }
      
      // Refresh poll data
      const pollResponse = await fetch(`/api/polls?id=${pollId}`);
      const pollData = await pollResponse.json();
      if (pollData.poll) {
        setPollData(pollData.poll);
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      throw error;
    }
  }, []);

  // Handle adding option to poll
  const handleAddPollOption = useCallback(async (pollId: string, optionText: string) => {
    try {
      const response = await fetch('/api/polls/add-option', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId, optionText }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add option');
      }
      
      // Refresh poll data
      const pollResponse = await fetch(`/api/polls?id=${pollId}`);
      const pollData = await pollResponse.json();
      if (pollData.poll) {
        setPollData(pollData.poll);
      }
    } catch (error) {
      console.error('Failed to add option:', error);
      throw error;
    }
  }, []);
  
  // Don't render deleted messages
  if (message.type === 'deleted') {
    return (
      <div className={`flex w-full py-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className="text-[13px] text-[#a7a39e] italic">
          Message deleted
        </div>
      </div>
    );
  }
  
  // System messages
  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-2">
        <div className="text-[12px] text-[#a7a39e] dark:text-[#7d8190] bg-[#f3f1ef] dark:bg-[#1e222a] px-3 py-1 rounded-full">
          {message.text}
        </div>
      </div>
    );
  }

  // Check-in notification messages (from Coachful Bot)
  // These are special messages posted when users complete their morning check-in
  const isCheckinNotification = !!(message as typeof message & { checkin_notification?: boolean }).checkin_notification || sender?.id === 'coachful-bot';
  
  if (isCheckinNotification) {
    return (
      <div className="flex w-full py-2 justify-center">
        <div className="max-w-[85%] bg-gradient-to-r from-[#f9f7f5] to-[#f5f2ef] dark:from-[#1e222a] dark:to-[#1a1e26] border border-[#e8e4df] dark:border-[#262b35] rounded-2xl px-4 py-3 shadow-sm">
          {/* Header with bot icon and label */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-brand-accent uppercase tracking-wide font-['Albert_Sans']">
              Check-in Update
            </span>
          </div>
          
          {/* Message content with proper formatting */}
          <div className="font-['Geist'] text-[14px] leading-[1.5] text-[#3d3933] dark:text-[#e5e5e8] whitespace-pre-wrap">
            {message.text}
          </div>
          
          {/* Timestamp */}
          <div className="mt-2 text-right">
            <span className="text-[10px] text-[#a7a39e] font-['Geist']">
              {timestamp}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Call ended messages - Display a nice indicator when a call happened
  const messageWithCall = message as typeof message & { call_ended?: boolean; call_timestamp?: string };
  const isCallMessage = !!messageWithCall.call_ended;
  
  if (isCallMessage) {
    const callTimestamp = messageWithCall.call_timestamp;
    
    // Format the call timestamp
    const callTime = callTimestamp 
      ? format(new Date(callTimestamp), 'h:mm a')
      : timestamp;
    
    return (
      <div className="flex w-full py-3 justify-center">
        <div className="flex items-center gap-2 px-4 py-2 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-full">
          {/* Call icon - always brown */}
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-accent/10 dark:bg-brand-accent/20">
            <svg className="w-3.5 h-3.5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          
          {/* Call text - generic */}
          <span className="font-['Albert_Sans'] text-[13px] font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
            Call
          </span>
          
          {/* Separator dot */}
          <span className="text-[#a7a39e] dark:text-[#7d8190]">•</span>
          
          {/* Timestamp */}
          <span className="font-['Geist'] text-[12px] text-[#a7a39e] dark:text-[#7d8190]">
            {callTime}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={messageRef}
      className={`group flex w-full py-0.5 ${isMine ? 'justify-end' : 'justify-start'} items-end gap-1`}
      onMouseEnter={() => setShowOptionsIcon(true)}
      onMouseLeave={() => {
        if (!isMenuOpen && !showReactionSelector) {
          setShowOptionsIcon(false);
        }
      }}
    >
      {/* Avatar - Only for others (LEFT side) - Simple avatar, clicks to profile */}
      {!isMine && sender?.id && (
        <div className="flex-shrink-0 self-end mb-0.5">
          <button
            onClick={() => router.push(getProfileUrl(sender.id, clerkUser?.id || ''))}
            className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
            aria-label={`View ${senderName}'s profile`}
          >
            {senderAvatar ? (
              <Image src={senderAvatar} alt={senderName} width={32} height={32} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-brand-accent to-[#7d5c3e] flex items-center justify-center text-white font-albert font-semibold text-xs">
                {senderName?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </button>
        </div>
      )}
      
      {/* 3-Dot Options Button - LEFT of my messages */}
      {isMine && (
        <div className={`flex-shrink-0 self-center ${showOptionsIcon || isMenuOpen || showReactionSelector ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
          <div className="relative">
            <button
              onClick={handleOptionsClick}
              className="w-7 h-7 flex items-center justify-center text-[#a7a39e] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] hover:bg-[#e8e4e0] dark:hover:bg-[#262b35] rounded-full transition-all"
              aria-label="Message options"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="6" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="18" cy="12" r="2" />
              </svg>
            </button>
            
            {/* Dropdown Menu - Positioned relative to the button */}
            {isMenuOpen && (
              <div 
                className="absolute z-50 bg-white dark:bg-[#1e222a] rounded-xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] py-1 min-w-[140px] left-0"
                style={{ top: 'calc(100% + 4px)' }}
              >
                <button
                  onClick={handleOpenThreadClick}
                  className="w-full px-3 py-2 text-left text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] flex items-center gap-2 font-['Geist']"
                >
                  <svg className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Reply
                </button>
                
                <button
                  onClick={handleReactionClick}
                  className="w-full px-3 py-2 text-left text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] flex items-center gap-2 font-['Geist']"
                >
                  <span className="text-[16px]">🙂</span>
                  React
                </button>
                
                <button
                  onClick={handleEditClick}
                  className="w-full px-3 py-2 text-left text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] flex items-center gap-2 font-['Geist']"
                >
                  <svg className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                
                <button
                  onClick={handleDeleteClick}
                  className="w-full px-3 py-2 text-left text-[14px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2 font-['Geist']"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
            
            {/* Reaction Selector Popup */}
            {showReactionSelector && (
              <div 
                className="absolute z-50 bg-white dark:bg-[#1e222a] rounded-3xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] px-3 py-2 flex gap-1 left-0"
                style={{ top: 'calc(100% + 4px)' }}
              >
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReactionSelect(emoji)}
                    className="text-[22px] hover:scale-125 transition-transform p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Message Content Container */}
      <div className={`relative flex flex-col max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
        {/* Message Bubble - Contains EVERYTHING: sender name, text, reactions, replies, timestamp */}
        <div
          className={`relative px-3 py-2 ${
            isMine
              ? 'bg-[#7e6c5b] text-[#f1ece6] rounded-[16px_16px_4px_16px]'
              : 'bg-white dark:bg-[#1e222a] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-[16px_16px_16px_4px]'
          }`}
        >
          {/* Sender name - Only for others in group chats (INSIDE bubble) - Clickable to profile */}
          {!isMine && !threadList && (
            <button
              type="button"
              onClick={() => handleProfileClick(sender?.id)}
              className={`block text-[12px] font-semibold mb-1 font-['Albert_Sans'] tracking-[-0.5px] hover:opacity-70 transition-opacity cursor-pointer ${
                isMine ? 'text-[#d4cbc3]' : 'text-brand-accent'
              }`}
            >
              {senderName}
            </button>
          )}
          
          {/* Poll Content */}
          {isPollMessage ? (
            pollData ? (
              <PollMessageCard
                poll={pollData}
                currentUserId={clerkUser?.id || ''}
                onVote={handlePollVote}
                onAddOption={pollData.settings.participantsCanAddOptions ? handleAddPollOption : undefined}
                onViewResults={() => setShowPollResults(true)}
                timestamp={timestamp}
                senderName={senderName}
                isOwnMessage={isMine}
              />
            ) : (
              /* Poll loading state */
              <div className="flex flex-col gap-2 w-full min-w-[200px] animate-pulse">
                <div className={`h-5 rounded ${isMine ? 'bg-[#b8a999]/30' : 'bg-[#e1ddd8]'} w-3/4`} />
                <div className={`h-3 rounded ${isMine ? 'bg-[#b8a999]/20' : 'bg-[#e1ddd8]/70'} w-1/3`} />
                <div className={`h-8 rounded ${isMine ? 'bg-[#b8a999]/20' : 'bg-[#e1ddd8]/70'} w-full mt-2`} />
                <div className={`h-8 rounded ${isMine ? 'bg-[#b8a999]/20' : 'bg-[#e1ddd8]/70'} w-full`} />
              </div>
            )
          ) : (
            <>
              {/* Attachments */}
              {hasAttachments && (
                <div className="mb-2">
                  {/* Separate different attachment types */}
                  {(() => {
                    const attachments = message.attachments || [];
                    const audioAttachments = attachments.filter(
                      (att) => att.type === 'audio' || att.mime_type?.startsWith('audio/')
                    );
                    const postPreviewAttachments = attachments.filter(
                      (att) => att.type === 'post_preview'
                    );
                    const otherAttachments = attachments.filter(
                      (att) => att.type !== 'audio' && !att.mime_type?.startsWith('audio/') && att.type !== 'post_preview'
                    );
                    
                    return (
                      <>
                        {/* Render audio attachments with custom player */}
                        {audioAttachments.map((att, index) => (
                          <VoiceMessageAttachment
                            key={`audio-${index}`}
                            audioUrl={(att as typeof att & { asset_url?: string; image_url?: string; file_url?: string }).asset_url || (att as typeof att & { image_url?: string }).image_url || (att as typeof att & { file_url?: string }).file_url || ''}
                            isMine={isMine}
                          />
                        ))}
                        
                        {/* Render post preview attachments */}
                        {postPreviewAttachments.map((att, index) => {
                          const postAtt = att as typeof att & { 
                            title?: string; 
                            text?: string; 
                            image_url?: string; 
                            title_link?: string;
                            author_name?: string;
                            author_icon?: string;
                            post_id?: string;
                          };
                          return (
                            <PostPreviewAttachment
                              key={`post-preview-${index}`}
                              title={postAtt.title || 'Shared post'}
                              text={postAtt.text}
                              imageUrl={postAtt.image_url}
                              linkUrl={postAtt.title_link || ''}
                              authorName={postAtt.author_name}
                              authorIcon={postAtt.author_icon}
                              isMine={isMine}
                            />
                          );
                        })}
                        
                        {/* Render other attachments with default renderer */}
                        {otherAttachments.length > 0 && (
                          <Attachment attachments={otherAttachments} />
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              
              {/* Message Text */}
              {message.text && (
                <p className="font-['Geist'] text-[15px] leading-[1.4] tracking-[-0.3px] whitespace-pre-wrap break-words">
                  {message.text}
                </p>
              )}
            </>
          )}
          
          {/* Reactions + Timestamp Row - Same line (skip for poll messages, handled by PollMessageCard) */}
          {!isPollMessage && (
            <div className={`flex items-end justify-between gap-2 mt-1 flex-wrap`}>
              {/* Reactions */}
              {hasReactions && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(message.reaction_counts || {}).map(([type, count]) => (
                    <button
                      key={type}
                      onClick={() => handleReactionSelect(reactionTypeToEmoji[type] || type)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] transition-all ${
                        isMine
                          ? message.own_reactions?.some(r => r.type === type)
                            ? 'bg-white/20'
                            : 'bg-white/10'
                          : message.own_reactions?.some(r => r.type === type)
                            ? 'bg-brand-accent/15 dark:bg-brand-accent/20'
                            : 'bg-[#f3f1ef] dark:bg-[#262b35]'
                      } ${animatingReaction === type ? 'reaction-pop' : ''}`}
                    >
                      <span className={animatingReaction === type ? 'reaction-bounce' : ''}>{reactionTypeToEmoji[type] || type}</span>
                      <span className={`font-semibold font-['Albert_Sans'] ${isMine ? 'text-[#f1ece6]' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Timestamp - aligned right */}
              <div className={`flex items-center gap-1.5 ${!hasReactions ? 'ml-auto' : ''}`}>
                <span className={`text-[10px] ${isMine ? 'text-[#d4cbc3]' : 'text-[#a7a39e]'} font-['Geist']`}>
                  {timestamp}
                </span>
              </div>
            </div>
          )}
          
          {/* Comments/Replies Row - INSIDE bubble, with single divider */}
          {hasReplies && !threadList && (
            <button
              onClick={handleOpenThreadClick}
              className={`flex items-center gap-2 mt-2 pt-2 w-full ${
                isMine 
                  ? 'border-t border-white/10 text-[#f1ece6]/80 hover:text-[#f1ece6]' 
                  : 'border-t border-[#e1ddd8] text-brand-accent hover:text-[#7d5c3e]'
              } transition-colors`}
            >
              {/* Thread participant avatars */}
              <div className="flex -space-x-1">
                {threadUsers.slice(0, 3).map((user, index) => (
                  <div
                    key={user.id || index}
                    className={`w-4 h-4 rounded-full overflow-hidden ${isMine ? 'border border-[#7e6c5b]' : 'border border-white'}`}
                  >
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name || ''}
                        width={16}
                        height={16}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-brand-accent to-[#7d5c3e] flex items-center justify-center text-white text-[6px] font-semibold">
                        {(user.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <span className="text-[11px] font-medium font-['Geist']">
                {message.reply_count} {message.reply_count === 1 ? 'comment' : 'comments'}
              </span>
              
              <svg className="w-3 h-3 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Read Receipts - Below message bubble, only for my messages */}
        {isMine && (() => {
          // readBy comes from useMessageContext - it's an array of users who have read this message
          // Filter out the message sender (current user)
          const readByUsers = (readBy || []).filter(
            (u) => u.id !== message.user?.id
          );
          
          const displayedUsers = readByUsers.slice(0, 3);
          const remainingCount = readByUsers.length - 3;
          
          if (readByUsers.length === 0) return null;
          
          return (
            <div className="mt-1 flex justify-end items-center gap-1">
              <div className="flex -space-x-1.5">
                {displayedUsers.map((user, index) => (
                  <div
                    key={user.id || index}
                    className="w-4 h-4 rounded-full overflow-hidden border border-[#faf8f6] flex-shrink-0"
                  >
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name || ''}
                        width={16}
                        height={16}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-brand-accent to-[#7d5c3e] flex items-center justify-center text-white text-[6px] font-semibold">
                        {(user.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {remainingCount > 0 && (
                <span className="text-[10px] text-[#a7a39e] font-['Geist']">
                  +{remainingCount}
                </span>
              )}
            </div>
          );
        })()}
      </div>
      
      {/* 3-Dot Options Button - RIGHT of others' messages */}
      {!isMine && (
        <div className={`flex-shrink-0 self-center ${showOptionsIcon || isMenuOpen || showReactionSelector ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
          <div className="relative">
            <button
              onClick={handleOptionsClick}
              className="w-7 h-7 flex items-center justify-center text-[#a7a39e] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] hover:bg-[#e8e4e0] dark:hover:bg-[#262b35] rounded-full transition-all"
              aria-label="Message options"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="6" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="18" cy="12" r="2" />
              </svg>
            </button>
            
            {/* Dropdown Menu - Positioned relative to the button */}
            {isMenuOpen && (
              <div 
                className="absolute z-50 bg-white dark:bg-[#1e222a] rounded-xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] py-1 min-w-[140px] right-0"
                style={{ top: 'calc(100% + 4px)' }}
              >
                <button
                  onClick={handleOpenThreadClick}
                  className="w-full px-3 py-2 text-left text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] flex items-center gap-2 font-['Geist']"
                >
                  <svg className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Reply
                </button>
                
                <button
                  onClick={handleReactionClick}
                  className="w-full px-3 py-2 text-left text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] flex items-center gap-2 font-['Geist']"
                >
                  <span className="text-[16px]">🙂</span>
                  React
                </button>
              </div>
            )}
            
            {/* Reaction Selector Popup */}
            {showReactionSelector && (
              <div 
                className="absolute z-50 bg-white dark:bg-[#1e222a] rounded-3xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] px-3 py-2 flex gap-1 right-0"
                style={{ top: 'calc(100% + 4px)' }}
              >
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReactionSelect(emoji)}
                    className="text-[22px] hover:scale-125 transition-transform p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Poll Results Sheet */}
      {isPollMessage && pollData && (
        <PollResultsSheet
          isOpen={showPollResults}
          onClose={() => setShowPollResults(false)}
          poll={pollData}
        />
      )}
    </div>
  );
}

export default CustomMessage;
