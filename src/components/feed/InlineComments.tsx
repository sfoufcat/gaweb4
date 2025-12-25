'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useComments, type FeedComment } from '@/hooks/useFeed';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { getProfileUrl } from '@/lib/utils';

interface InlineCommentsProps {
  postId: string;
  commentCount: number;
  /** Whether to show expanded view with all comments */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandChange?: (expanded: boolean) => void;
  /** Callback when a comment is successfully added */
  onCommentAdded?: () => void;
}

/**
 * InlineComments - Displays comments directly below a post
 * 
 * - Collapsed: Shows 2 recent comments + "View all X comments" link
 * - Expanded: Shows all comments with infinite scroll + input field
 */
export function InlineComments({ 
  postId, 
  commentCount,
  expanded = false,
  onExpandChange,
  onCommentAdded,
}: InlineCommentsProps) {
  const router = useRouter();
  const { user } = useUser();
  const { colors, isDefault } = useBrandingValues();
  const {
    comments,
    isLoading,
    isValidating,
    hasMore,
    loadMore,
    addComment: addCommentToList,
  } = useComments(postId);

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  // Focus input when expanded
  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus();
    }
  }, [expanded]);

  // Handle submit comment
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/feed/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newComment.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      const data = await response.json();
      
      // Add to list optimistically
      addCommentToList(data.comment);
      setNewComment('');
      
      // Notify parent to update comment count
      onCommentAdded?.();
      
      // Scroll to bottom to see new comment
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    } catch (error) {
      console.error('Comment error:', error);
      setErrorMessage('Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [postId, newComment, isSubmitting, addCommentToList]);

  // Handle scroll for infinite load
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!expanded) return;
    
    const target = e.target as HTMLDivElement;
    const nearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 200;
    
    if (nearBottom && hasMore && !isValidating) {
      loadMore();
    }
  }, [expanded, hasMore, isValidating, loadMore]);

  // Navigate to profile
  const handleProfileClick = (authorId: string) => {
    router.push(getProfileUrl(authorId, user?.id || ''));
  };

  // Determine which comments to show
  const visibleComments = expanded ? comments : comments.slice(-2);
  const hasMoreToShow = !expanded && commentCount > 2;

  // Loading state
  if (isLoading && comments.length === 0) {
    return (
      <div className="px-4 pb-3 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-2 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
            <div className="flex-1 space-y-1">
              <div className="w-20 h-3 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
              <div className="w-full h-3 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // No comments yet - show input directly
  if (comments.length === 0 && !isLoading) {
    return (
      <div className="px-4 pt-1 pb-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] flex-shrink-0">
            {user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt="Your avatar"
                width={28}
                height={28}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-[#5f5a55]">
                {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 px-3 py-1.5 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[13px] text-[#1a1a1a] dark:text-[#faf8f6] placeholder-[#8a857f] focus:outline-none focus:ring-2 focus:ring-inset"
            style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="p-1.5 rounded-full transition-colors disabled:opacity-50"
            style={{ color: newComment.trim() ? accentColor : '#8a857f' }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        {errorMessage && (
          <p className="text-[11px] text-red-500 mt-1 ml-9">{errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pt-1 pb-3">
      {/* View all comments link */}
      {hasMoreToShow && (
        <button
          onClick={() => onExpandChange?.(true)}
          className="text-[13px] text-[#8a857f] hover:text-[#5f5a55] dark:hover:text-[#b5b0ab] mb-2 transition-colors"
        >
          View all {commentCount} comments
        </button>
      )}

      {/* Comments list */}
      <div 
        ref={listRef}
        className={`space-y-2.5 ${expanded ? 'max-h-[300px] overflow-y-auto pr-1' : ''}`}
        onScroll={handleScroll}
      >
        {visibleComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onProfileClick={() => handleProfileClick(comment.authorId)}
          />
        ))}
        
        {/* Loading more indicator */}
        {isValidating && expanded && (
          <div className="flex justify-center py-1">
            <div className="w-4 h-4 border-2 border-[#a07855] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Comment input (always shown when expanded, or when there are some comments) */}
      {(expanded || comments.length > 0) && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-3">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] flex-shrink-0">
            {user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt="Your avatar"
                width={28}
                height={28}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-[#5f5a55]">
                {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 px-3 py-1.5 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[13px] text-[#1a1a1a] dark:text-[#faf8f6] placeholder-[#8a857f] focus:outline-none focus:ring-2 focus:ring-inset"
            style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="p-1.5 rounded-full transition-colors disabled:opacity-50"
            style={{ color: newComment.trim() ? accentColor : '#8a857f' }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      )}
      
      {/* Error message */}
      {errorMessage && (
        <p className="text-[11px] text-red-500 mt-1 ml-9">{errorMessage}</p>
      )}

      {/* Collapse button when expanded */}
      {expanded && comments.length > 2 && (
        <button
          onClick={() => onExpandChange?.(false)}
          className="text-[13px] text-[#8a857f] hover:text-[#5f5a55] dark:hover:text-[#b5b0ab] mt-2 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

// Individual comment item (compact version for inline)
function CommentItem({
  comment,
  onProfileClick,
}: {
  comment: FeedComment;
  onProfileClick: () => void;
}) {
  const authorName = comment.author
    ? `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || 'User'
    : 'User';
  const authorImage = comment.author?.imageUrl || null;
  const authorInitials = authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  return (
    <div className="flex gap-2">
      {/* Avatar */}
      <button
        onClick={onProfileClick}
        className="w-7 h-7 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] flex-shrink-0 hover:opacity-80 transition-opacity"
      >
        {authorImage ? (
          <Image
            src={authorImage}
            alt={authorName}
            width={28}
            height={28}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-[#5f5a55] dark:text-[#b5b0ab]">
            {authorInitials}
          </div>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="inline">
          <button
            onClick={onProfileClick}
            className="font-semibold text-[13px] text-[#1a1a1a] dark:text-[#faf8f6] hover:underline"
          >
            {authorName}
          </button>
          <span className="text-[13px] text-[#1a1a1a] dark:text-[#faf8f6] ml-1.5">
            {comment.text}
          </span>
        </div>
        <p className="text-[11px] text-[#8a857f] mt-0.5">
          {timeAgo}
        </p>
      </div>
    </div>
  );
}

