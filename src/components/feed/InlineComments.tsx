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
  /** Callback when a comment is successfully deleted */
  onCommentDeleted?: () => void;
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
  onCommentDeleted,
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
    removeComment: removeCommentFromList,
    updateComment: updateCommentInList,
  } = useComments(postId);
  
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

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

  // Handle delete comment
  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (deletingCommentId) return; // Prevent multiple deletes

    setDeletingCommentId(commentId);

    try {
      const response = await fetch(`/api/feed/${postId}/comment?commentId=${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      // Remove from local list
      removeCommentFromList(commentId);
      
      // Notify parent to update comment count
      onCommentDeleted?.();
    } catch (error) {
      console.error('Delete comment error:', error);
      setErrorMessage('Failed to delete comment. Please try again.');
    } finally {
      setDeletingCommentId(null);
    }
  }, [postId, deletingCommentId, removeCommentFromList, onCommentDeleted]);

  // Handle edit comment
  const handleEditComment = useCallback(async (commentId: string, newText: string) => {
    if (!newText.trim()) return;

    try {
      const response = await fetch(`/api/feed/${postId}/comment?commentId=${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update comment');
      }

      const data = await response.json();
      
      // Update in local list
      updateCommentInList(commentId, data.comment.text, data.comment.updatedAt);
      setEditingCommentId(null);
    } catch (error) {
      console.error('Edit comment error:', error);
      setErrorMessage('Failed to update comment. Please try again.');
    }
  }, [postId, updateCommentInList]);

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
            currentUserId={user?.id}
            isDeleting={deletingCommentId === comment.id}
            isEditing={editingCommentId === comment.id}
            onProfileClick={() => handleProfileClick(comment.authorId)}
            onDelete={() => handleDeleteComment(comment.id)}
            onEdit={() => setEditingCommentId(comment.id)}
            onEditSubmit={(newText) => handleEditComment(comment.id, newText)}
            onEditCancel={() => setEditingCommentId(null)}
            accentColor={accentColor}
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
  currentUserId,
  isDeleting,
  isEditing,
  onProfileClick,
  onDelete,
  onEdit,
  onEditSubmit,
  onEditCancel,
  accentColor,
}: {
  comment: FeedComment;
  currentUserId?: string;
  isDeleting?: boolean;
  isEditing?: boolean;
  onProfileClick: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onEditSubmit: (newText: string) => void;
  onEditCancel: () => void;
  accentColor: string;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const editInputRef = useRef<HTMLInputElement>(null);
  
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
  const wasEdited = !!comment.updatedAt;
  
  // Can modify if user is the comment author
  const canModify = currentUserId === comment.authorId;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) {
      setEditText(comment.text);
      setTimeout(() => editInputRef.current?.focus(), 0);
    }
  }, [isEditing, comment.text]);

  // Handle edit form submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editText.trim() && editText.trim() !== comment.text) {
      onEditSubmit(editText.trim());
    } else {
      onEditCancel();
    }
  };

  // Handle escape key to cancel editing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onEditCancel();
    }
  };

  return (
    <div className={`flex gap-2 group ${isDeleting ? 'opacity-50' : ''}`}>
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
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="flex items-center gap-2">
            <input
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-3 py-1.5 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[13px] text-[#1a1a1a] dark:text-[#faf8f6] placeholder-[#8a857f] focus:outline-none focus:ring-2 focus:ring-inset"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
            <button
              type="submit"
              disabled={!editText.trim()}
              className="p-1.5 rounded-full transition-colors disabled:opacity-50"
              style={{ color: editText.trim() ? accentColor : '#8a857f' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onEditCancel}
              className="p-1.5 rounded-full transition-colors text-[#8a857f] hover:text-[#5f5a55]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </form>
        ) : (
          <>
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
              {timeAgo}{wasEdited && ' · Edited'}
            </p>
          </>
        )}
      </div>

      {/* Menu (only for comment author, not when editing) */}
      {canModify && !isEditing && (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-all"
            disabled={isDeleting}
          >
            <svg className="w-4 h-4 text-[#8a857f]" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-[#1a1f2a] rounded-xl shadow-lg border border-[#e8e4df] dark:border-[#262b35] z-20 overflow-hidden">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-[13px] text-[#1a1a1a] dark:text-[#faf8f6] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

