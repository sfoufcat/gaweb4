'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { formatDistanceToNow, format } from 'date-fns';
import { useSWRConfig } from 'swr';
import { DeleteConfirmationModal } from './ConfirmationModal';
import { InlineComments } from './InlineComments';
import { SIDEBAR_BOOKMARKS_KEY, optimisticallyAddBookmark, optimisticallyRemoveBookmark } from './FeedSidebar';
import { RichTextPreview } from '@/components/editor';
import { PollMessageCard } from '@/components/chat/PollMessageCard';
import type { FeedPost } from '@/hooks/useFeed';
import type { ChatPollState } from '@/types/poll';
import { getProfileUrl } from '@/lib/utils';

interface PostCardProps {
  post: FeedPost;
  variant?: 'card' | 'embedded';
  stickyActionBar?: boolean;
  isCoach?: boolean; // Whether current user can access post settings
  onLike?: (postId: string, isLiked: boolean) => void;
  onBookmark?: (postId: string, isBookmarked: boolean) => void;
  onShare?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (post: FeedPost) => void;
  onReport?: (postId: string) => void;
  onCommentAdded?: (postId: string) => void;
  onCommentDeleted?: (postId: string) => void;
  onOpenSettings?: (post: FeedPost) => void;
}

export function PostCard({
  post,
  variant = 'card',
  stickyActionBar = false,
  isCoach = false,
  onLike,
  onBookmark,
  onShare,
  onDelete,
  onEdit,
  onReport,
  onCommentAdded,
  onCommentDeleted,
  onOpenSettings,
}: PostCardProps) {
  const router = useRouter();
  const { user } = useUser();
  const { mutate } = useSWRConfig();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageError, setImageError] = useState<Record<string, boolean>>({});
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [bookmarkAnimating, setBookmarkAnimating] = useState(false);
  const [pollData, setPollData] = useState<ChatPollState | null>(post.pollData || null);

  const isOwnPost = user?.id === post.authorId;

  // Get author display info
  const authorName = post.author 
    ? `${post.author.firstName || ''} ${post.author.lastName || ''}`.trim() || post.author.name || 'User'
    : 'User';
  const authorImage = post.author?.imageUrl || post.author?.profileImage || null;
  const authorInitials = authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Format timestamp
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  
  // Check if post was actually edited (updatedAt is significantly different from createdAt)
  const wasEdited = post.updatedAt && post.createdAt && 
    new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 60000; // More than 1 minute difference

  // Handle like
  const handleLike = useCallback(async () => {
    if (isLiking) return;
    
    setIsLiking(true);
    const newLikedState = !post.hasLiked;
    
    // Trigger animation
    if (newLikedState) {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 400);
    }
    
    // Optimistic update
    onLike?.(post.id, newLikedState);

    try {
      const method = newLikedState ? 'POST' : 'DELETE';
      const response = await fetch(`/api/feed/${post.id}/like`, { method });
      
      if (!response.ok) {
        // Revert on error
        onLike?.(post.id, !newLikedState);
      }
    } catch {
      // Revert on error
      onLike?.(post.id, !newLikedState);
    } finally {
      setIsLiking(false);
    }
  }, [post.id, post.hasLiked, isLiking, onLike]);

  // Handle bookmark
  const handleBookmark = useCallback(async () => {
    if (isBookmarking) return;

    setIsBookmarking(true);
    const newBookmarkState = !post.hasBookmarked;

    // Trigger animation
    if (newBookmarkState) {
      setBookmarkAnimating(true);
      setTimeout(() => setBookmarkAnimating(false), 500);
    }

    // Optimistic update for main feed
    onBookmark?.(post.id, newBookmarkState);

    // Optimistic update for sidebar - instant appear/disappear
    if (newBookmarkState) {
      optimisticallyAddBookmark({
        id: post.id,
        authorId: post.authorId,
        text: post.text,
        images: post.images,
        likeCount: post.likeCount,
        author: post.author,
      });
    } else {
      optimisticallyRemoveBookmark(post.id);
    }

    try {
      const method = newBookmarkState ? 'POST' : 'DELETE';
      const response = await fetch(`/api/feed/${post.id}/bookmark`, { method });

      if (!response.ok) {
        // Revert on error
        onBookmark?.(post.id, !newBookmarkState);
        // Revert sidebar
        if (newBookmarkState) {
          optimisticallyRemoveBookmark(post.id);
        } else {
          optimisticallyAddBookmark({
            id: post.id,
            authorId: post.authorId,
            text: post.text,
            images: post.images,
            likeCount: post.likeCount,
            author: post.author,
          });
        }
      } else {
        // Revalidate sidebar to ensure sync with server
        mutate(SIDEBAR_BOOKMARKS_KEY);
      }
    } catch {
      // Revert on error
      onBookmark?.(post.id, !newBookmarkState);
      // Revert sidebar
      if (newBookmarkState) {
        optimisticallyRemoveBookmark(post.id);
      } else {
        optimisticallyAddBookmark({
          id: post.id,
          authorId: post.authorId,
          text: post.text,
          images: post.images,
          likeCount: post.likeCount,
          author: post.author,
        });
      }
    } finally {
      setIsBookmarking(false);
    }
  }, [post.id, post.authorId, post.text, post.images, post.likeCount, post.author, post.hasBookmarked, isBookmarking, onBookmark]);

  // Handle edit
  const handleEditClick = useCallback(() => {
    setShowMenu(false);
    onEdit?.(post);
  }, [post, onEdit]);

  // Handle delete - show modal
  const handleDeleteClick = useCallback(() => {
    setShowMenu(false);
    setShowDeleteModal(true);
  }, []);

  // Confirm delete
  const handleConfirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/feed/${post.id}`, { method: 'DELETE' });
      if (response.ok) {
        onDelete?.(post.id);
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }, [post.id, onDelete]);

  // Handle report
  const handleReport = useCallback(() => {
    onReport?.(post.id);
    setShowMenu(false);
  }, [post.id, onReport]);

  // Handle settings (coach only)
  const handleSettingsClick = useCallback(() => {
    setShowMenu(false);
    onOpenSettings?.(post);
  }, [post, onOpenSettings]);

  // Navigate to profile
  const handleProfileClick = () => {
    router.push(getProfileUrl(post.authorId, user?.id || ''));
  };

  // Note: We use text-brand-accent Tailwind class instead of inline styles for accent colors

  // Poll handlers
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
      const data = await pollResponse.json();
      if (data.poll) {
        setPollData(data.poll);
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      throw error;
    }
  }, []);

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
      const data = await pollResponse.json();
      if (data.poll) {
        setPollData(data.poll);
      }
    } catch (error) {
      console.error('Failed to add option:', error);
      throw error;
    }
  }, []);

  const handleViewPollResults = useCallback((poll: ChatPollState) => {
    // For now, just log - could open a modal with detailed results
    console.log('View poll results:', poll);
  }, []);

  // Card vs embedded styling
  const isEmbedded = variant === 'embedded';
  
  return (
    <article className={isEmbedded ? '' : 'bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] transition-shadow duration-200 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]'}>
      {/* Pinned indicator + Menu (combined row when hideMetadata is true) */}
      {post.pinnedToFeed && post.hideMetadata && (
        <div className={`flex items-center justify-between ${isEmbedded ? 'pb-2' : 'px-4 pt-3 pb-0'}`}>
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-brand-accent">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 12V4h1V2H7v2h1v8l-3 5v2h6v5l1 1 1-1v-5h6v-2l-3-5z" />
            </svg>
            Pinned
          </div>
          <div className="relative overflow-visible">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              <svg className="w-5 h-5 text-[#8a857f]" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-50"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#1a1f2a] rounded-xl shadow-lg border border-[#e8e4df] dark:border-[#262b35] z-[100] overflow-hidden">
                  {isCoach && (
                    <button
                      onClick={handleSettingsClick}
                      className="w-full px-4 py-3 text-left text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Post Settings
                    </button>
                  )}
                  {isOwnPost ? (
                    <>
                      {!post.isRepost && (
                        <button
                          onClick={handleEditClick}
                          className="w-full px-4 py-3 text-left text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit post
                        </button>
                      )}
                      <button
                        onClick={handleDeleteClick}
                        className="w-full px-4 py-3 text-left text-[14px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete post
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleReport}
                      className="w-full px-4 py-3 text-left text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                      Report post
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pinned indicator only (when metadata is visible) */}
      {post.pinnedToFeed && !post.hideMetadata && (
        <div className={`flex items-center gap-1.5 text-[12px] font-medium text-brand-accent ${isEmbedded ? 'pb-2' : 'px-4 pt-3 pb-0'}`}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 12V4h1V2H7v2h1v8l-3 5v2h6v5l1 1 1-1v-5h6v-2l-3-5z" />
          </svg>
          Pinned
        </div>
      )}

      {/* Header - Hidden when hideMetadata is true */}
      {!post.hideMetadata && (
        <div className={`flex items-center justify-between ${isEmbedded ? 'pb-3' : 'p-4 pb-3'}`}>
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <button
              onClick={handleProfileClick}
              className="w-10 h-10 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] flex-shrink-0 hover:opacity-80 transition-opacity"
            >
              {authorImage ? (
                <Image
                  src={authorImage}
                  alt={authorName}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-[#5f5a55] dark:text-[#b5b0ab]">
                  {authorInitials}
                </div>
              )}
            </button>
            
            {/* Name and time */}
            <div>
              <button
                onClick={handleProfileClick}
                className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6] hover:underline"
              >
                {authorName}
              </button>
              <p className="text-[13px] text-[#8a857f] dark:text-[#787470]">
                {timeAgo}
                {wasEdited && (
                  <span className="ml-1 italic"> • edited</span>
                )}
              </p>
            </div>
          </div>

          {/* Menu button */}
          <div className="relative overflow-visible">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
          >
            <svg className="w-5 h-5 text-[#8a857f]" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-50"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#1a1f2a] rounded-xl shadow-lg border border-[#e8e4df] dark:border-[#262b35] z-[100] overflow-hidden">
                {/* Post Settings - Coach/Admin only */}
                {isCoach && (
                  <button
                    onClick={handleSettingsClick}
                    className="w-full px-4 py-3 text-left text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Post Settings
                  </button>
                )}
                {isOwnPost ? (
                  <>
                    {/* Edit button - only for own posts that aren't reposts */}
                    {!post.isRepost && (
                      <button
                        onClick={handleEditClick}
                        className="w-full px-4 py-3 text-left text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit post
                      </button>
                    )}
                    <button
                      onClick={handleDeleteClick}
                      className="w-full px-4 py-3 text-left text-[14px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete post
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleReport}
                    className="w-full px-4 py-3 text-left text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                    Report post
                  </button>
                )}
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* Menu button when metadata is hidden but NOT pinned (pinned+hidden case handled above) */}
      {post.hideMetadata && !post.pinnedToFeed && (
        <div className={`flex justify-end ${isEmbedded ? 'pb-2' : 'px-4 pt-3 pb-0'}`}>
          <div className="relative overflow-visible">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              <svg className="w-5 h-5 text-[#8a857f]" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>

            {/* Dropdown menu (duplicate for hidden metadata case) */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-50"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#1a1f2a] rounded-xl shadow-lg border border-[#e8e4df] dark:border-[#262b35] z-[100] overflow-hidden">
                  {/* Post Settings - Coach/Admin only */}
                  {isCoach && (
                    <button
                      onClick={handleSettingsClick}
                      className="w-full px-4 py-3 text-left text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Post Settings
                    </button>
                  )}
                  {isOwnPost ? (
                    <>
                      {!post.isRepost && (
                        <button
                          onClick={handleEditClick}
                          className="w-full px-4 py-3 text-left text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit post
                        </button>
                      )}
                      <button
                        onClick={handleDeleteClick}
                        className="w-full px-4 py-3 text-left text-[14px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete post
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleReport}
                      className="w-full px-4 py-3 text-left text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                      Report post
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {(post.contentHtml || post.text) && (
        <div className={isEmbedded ? 'pb-3' : 'px-4 pb-3'}>
          {post.contentHtml ? (
            <RichTextPreview 
              content={post.contentHtml}
              className="text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]"
            />
          ) : (
            // Only show text fallback in card mode to prevent flash in embedded mode
            !isEmbedded && (
              <p className="text-[15px] text-[#1a1a1a] dark:text-[#faf8f6] whitespace-pre-wrap break-words leading-relaxed">
                {post.text}
              </p>
            )
          )}
        </div>
      )}

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <div className={`grid gap-0.5 ${
          post.images.length === 1 ? 'grid-cols-1' :
          post.images.length === 2 ? 'grid-cols-2' :
          post.images.length === 3 ? 'grid-cols-2' :
          'grid-cols-2'
        }`}>
          {post.images.slice(0, 4).map((image, index) => (
            <div
              key={index}
              className={`relative aspect-square ${
                post.images!.length === 3 && index === 0 ? 'row-span-2' : ''
              }`}
            >
              {!imageError[image] ? (
                <Image
                  src={image}
                  alt={`Post image ${index + 1}`}
                  fill
                  className="object-cover"
                  onError={() => setImageError((prev) => ({ ...prev, [image]: true }))}
                />
              ) : (
                <div className="w-full h-full bg-[#f5f3f0] dark:bg-[#262b35] flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#8a857f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              {/* Show "+X" overlay for more than 4 images */}
              {post.images!.length > 4 && index === 3 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">
                    +{post.images!.length - 4}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video */}
      {post.videoUrl && (
        <div className="relative aspect-video bg-black">
          <video
            src={post.videoUrl}
            controls
            className="w-full h-full object-contain"
            playsInline
          />
        </div>
      )}

      {/* Poll */}
      {pollData && (
        <div className={`${isEmbedded ? 'pb-3' : 'px-4 pb-3'}`}>
          <div className="p-4 bg-[#f5f3f0] dark:bg-[#1a1f2a] rounded-xl">
            <PollMessageCard
              poll={pollData}
              currentUserId={user?.id || ''}
              onVote={handlePollVote}
              onAddOption={pollData.settings.participantsCanAddOptions ? handleAddPollOption : undefined}
              onViewResults={handleViewPollResults}
              timestamp={format(new Date(post.createdAt), 'h:mm a')}
              senderName={authorName}
              isOwnMessage={false}
            />
          </div>
        </div>
      )}

      {/* Action bar - Hidden when interactions are disabled */}
      {!post.disableInteractions && (
        <div className={`flex items-center justify-between py-3 border-t border-[#e8e4df] dark:border-[#262b35] ${
          isEmbedded ? '' : 'px-4'
        } ${
          stickyActionBar ? 'sticky bottom-0 bg-white dark:bg-[#171b22] z-10' : ''
        }`}>
          <div className="flex items-center gap-1">
            {/* Like - Modern rounded heart */}
            <button
              onClick={handleLike}
              disabled={isLiking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-all"
            >
              <svg
                className={`w-[22px] h-[22px] transition-all ${likeAnimating ? 'animate-heart-pop' : ''} ${post.hasLiked ? 'text-brand-accent' : 'text-[#8a857f]'}`}
                viewBox="0 0 24 24"
                fill={post.hasLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={post.hasLiked ? 0 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {post.likeCount > 0 && (
                <span className={`text-[13px] font-medium ${post.hasLiked ? 'text-brand-accent' : 'text-[#8a857f]'}`}>
                  {post.likeCount}
                </span>
              )}
            </button>

            {/* Comment - Modern rounded bubble */}
            <button
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-all ${showComments ? 'text-brand-accent' : 'text-[#8a857f]'}`}
            >
              <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill={showComments ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={showComments ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              {post.commentCount > 0 && (
                <span className="text-[13px] font-medium">
                  {post.commentCount}
                </span>
              )}
            </button>

            {/* Share */}
            <button
              onClick={() => onShare?.(post.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors text-[#8a857f]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          </div>

          {/* Bookmark */}
          <button
            onClick={handleBookmark}
            disabled={isBookmarking}
            className="p-1.5 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-colors ${bookmarkAnimating ? 'animate-bookmark-bounce' : ''} ${post.hasBookmarked ? 'text-brand-accent fill-brand-accent' : ''}`}
              fill={post.hasBookmarked ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      )}

      {/* Inline comments - Hidden when interactions are disabled */}
      {showComments && !post.disableInteractions && (
        <div className="animate-slide-down">
          <InlineComments
            postId={post.id}
            commentCount={post.commentCount}
            expanded={commentsExpanded}
            onExpandChange={setCommentsExpanded}
            onCommentAdded={() => onCommentAdded?.(post.id)}
            onCommentDeleted={() => onCommentDeleted?.(post.id)}
          />
        </div>
      )}

      {/* Delete confirmation modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        itemName="post"
        isLoading={isDeleting}
      />
    </article>
  );
}

