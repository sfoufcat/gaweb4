'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { formatDistanceToNow } from 'date-fns';
import { useComments, type FeedComment } from '@/hooks/useFeed';
import { getProfileUrl } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CommentSheetProps {
  postId: string;
  onClose: () => void;
}

export function CommentSheet({ postId, onClose }: CommentSheetProps) {
  const router = useRouter();
  const { user } = useUser();
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

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);


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

  // Handle delete comment
  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (deletingCommentId) return;

    setDeletingCommentId(commentId);

    try {
      const response = await fetch(`/api/feed/${postId}/comment?commentId=${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      removeCommentFromList(commentId);
    } catch (error) {
      console.error('Delete comment error:', error);
      setErrorMessage('Failed to delete comment. Please try again.');
    } finally {
      setDeletingCommentId(null);
    }
  }, [postId, deletingCommentId, removeCommentFromList]);

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
      updateCommentInList(commentId, data.comment.text, data.comment.updatedAt);
      setEditingCommentId(null);
    } catch (error) {
      console.error('Edit comment error:', error);
      setErrorMessage('Failed to update comment. Please try again.');
    }
  }, [postId, updateCommentInList]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 md:inset-auto md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-white dark:bg-[#13171f] rounded-t-2xl md:rounded-2xl z-50 max-h-[80dvh] flex flex-col overflow-hidden shadow-xl">
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
                  currentUserId={user?.id}
                  isDeleting={deletingCommentId === comment.id}
                  isEditing={editingCommentId === comment.id}
                  onProfileClick={() => router.push(getProfileUrl(comment.authorId, user?.id || ''))}
                  onDelete={() => handleDeleteComment(comment.id)}
                  onEdit={() => setEditingCommentId(comment.id)}
                  onEditSubmit={(newText) => handleEditComment(comment.id, newText)}
                  onEditCancel={() => setEditingCommentId(null)}
                />
              ))}
              
              {/* Loading more */}
              {isValidating && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
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
                unoptimized
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
            className="flex-1 px-4 py-2 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[14px] text-[#1a1a1a] dark:text-[#faf8f6] placeholder-[#8a857f] focus:outline-none focus:ring-2 focus:ring-opacity-50 focus:ring-brand-accent"
          />

          {/* Submit button */}
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className={`p-2 rounded-full transition-colors disabled:opacity-50 ${newComment.trim() ? 'text-brand-accent' : 'text-[#8a857f]'}`}
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
  currentUserId,
  isDeleting,
  isEditing,
  onProfileClick,
  onDelete,
  onEdit,
  onEditSubmit,
  onEditCancel,
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
}) {
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
    <div className={`flex gap-3 group ${isDeleting ? 'opacity-50' : ''}`}>
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
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-[#5f5a55] dark:text-[#b5b0ab]">
            {authorInitials}
          </div>
        )}
      </button>

      {/* Content */}
      <div className="flex-1">
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="flex items-center gap-2">
            <input
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-3 py-1.5 rounded-full bg-[#f5f3f0] dark:bg-[#262b35] text-[13px] text-[#1a1a1a] dark:text-[#faf8f6] placeholder-[#8a857f] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-accent"
            />
            <button
              type="submit"
              disabled={!editText.trim()}
              className={`p-1.5 rounded-full transition-colors disabled:opacity-50 ${editText.trim() ? 'text-brand-accent' : 'text-[#8a857f]'}`}
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
              {timeAgo}{wasEdited && ' · Edited'}
            </p>
          </>
        )}
      </div>

      {/* Menu (only for comment author, not when editing) */}
      {canModify && !isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-all"
              disabled={isDeleting}
            >
              <svg className="w-4 h-4 text-[#8a857f]" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32 rounded-xl border-[#e8e4df] dark:border-[#262b35] dark:bg-[#1a1f2a]">
            <DropdownMenuItem
              onClick={onEdit}
              className="flex items-center gap-2 text-[13px] cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="flex items-center gap-2 text-[13px] text-red-500 focus:text-red-500 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

