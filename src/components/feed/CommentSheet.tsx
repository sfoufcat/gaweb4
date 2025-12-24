'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { formatDistanceToNow } from 'date-fns';
import { useComments, type FeedComment } from '@/hooks/useFeed';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { getProfileUrl } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface CommentSheetProps {
  postId: string;
  onClose: () => void;
}

export function CommentSheet({ postId, onClose }: CommentSheetProps) {
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

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      
      // Scroll to bottom to see new comment (comments are ordered oldest first)
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
    const target = e.target as HTMLDivElement;
    const nearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 200;
    
    if (nearBottom && hasMore && !isValidating) {
      loadMore();
    }
  }, [hasMore, isValidating, loadMore]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 md:inset-auto md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-white dark:bg-[#13171f] rounded-t-2xl md:rounded-2xl z-50 max-h-[80vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e8e4df] dark:border-[#262b35]">
          <h2 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Comments
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
          >
            <svg className="w-5 h-5 text-[#8a857f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comments list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={handleScroll}
        >
          {isLoading ? (
            // Loading skeleton
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                  <div className="flex-1 space-y-2">
                    <div className="w-24 h-4 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                    <div className="w-full h-4 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            // Empty state
            <div className="text-center py-8">
              <p className="text-[14px] text-[#8a857f]">
                No comments yet. Be the first to comment!
              </p>
            </div>
          ) : (
            // Comments
            <>
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onProfileClick={() => router.push(getProfileUrl(comment.authorId, user?.id || ''))}
                />
              ))}
              
              {/* Loading more */}
              {isValidating && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 border-2 border-[#a07855] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="px-4 pt-2">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-sans text-[13px] text-red-800 dark:text-red-200 flex-1">
                  {errorMessage}
                </p>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-[#e8e4df] dark:border-[#262b35] flex items-center gap-3"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] flex-shrink-0">
            {user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt="Your avatar"
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-[#5f5a55]">
                {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
              </div>
            )}
          </div>

          {/* Input field */}
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 px-4 py-2 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[14px] text-[#1a1a1a] dark:text-[#faf8f6] placeholder-[#8a857f] focus:outline-none focus:ring-2 focus:ring-opacity-50"
            style={{ focusRing: accentColor } as React.CSSProperties}
          />

          {/* Submit button */}
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="p-2 rounded-full transition-colors disabled:opacity-50"
            style={{ color: newComment.trim() ? accentColor : '#8a857f' }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}

// Individual comment item
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
    <div className="flex gap-3">
      {/* Avatar */}
      <button
        onClick={onProfileClick}
        className="w-8 h-8 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] flex-shrink-0 hover:opacity-80 transition-opacity"
      >
        {authorImage ? (
          <Image
            src={authorImage}
            alt={authorName}
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-[#5f5a55] dark:text-[#b5b0ab]">
            {authorInitials}
          </div>
        )}
      </button>

      {/* Content */}
      <div className="flex-1">
        <div className="bg-[#f5f3f0] dark:bg-[#1a1f2a] rounded-2xl px-3 py-2">
          <button
            onClick={onProfileClick}
            className="font-semibold text-[13px] text-[#1a1a1a] dark:text-[#faf8f6] hover:underline"
          >
            {authorName}
          </button>
          <p className="text-[14px] text-[#1a1a1a] dark:text-[#faf8f6] mt-0.5">
            {comment.text}
          </p>
        </div>
        <p className="text-[11px] text-[#8a857f] mt-1 ml-3">
          {timeAgo}
        </p>
      </div>
    </div>
  );
}

