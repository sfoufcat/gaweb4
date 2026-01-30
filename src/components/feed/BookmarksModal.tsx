'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { PostCard } from './PostCard';
import type { FeedPost } from '@/hooks/useFeed';

interface BookmarkedPost {
  id: string;
  authorId: string;
  text?: string;
  contentHtml?: string;
  images?: string[];
  videoUrl?: string;
  createdAt: string;
  bookmarkedAt: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  bookmarkCount: number;
  hasLiked: boolean;
  hasBookmarked: boolean;
  hasReposted: boolean;
  author?: {
    id: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
    name?: string;
  };
}

interface BookmarksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLike?: (postId: string, isLiked: boolean) => void;
  onBookmark?: (postId: string, isBookmarked: boolean) => void;
  onShare?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onReport?: (postId: string) => void;
}

export function BookmarksModal({
  open,
  onOpenChange,
  onLike,
  onBookmark,
  onShare,
  onDelete,
  onReport,
}: BookmarksModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [posts, setPosts] = useState<BookmarkedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<BookmarkedPost | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch bookmarks
  const fetchBookmarks = useCallback(async (cursor?: string) => {
    try {
      const url = cursor
        ? `/api/feed/bookmarks?limit=20&cursor=${cursor}`
        : '/api/feed/bookmarks?limit=20';

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();

      if (cursor) {
        setPosts(prev => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }

      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load bookmarks when modal opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setSelectedPost(null);
      fetchBookmarks();
    }
  }, [open, fetchBookmarks]);

  // Infinite scroll
  useEffect(() => {
    if (!open || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && nextCursor) {
          fetchBookmarks(nextCursor);
        }
      },
      { rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [open, hasMore, nextCursor, isLoading, fetchBookmarks]);

  // Handle like action
  const handleLike = useCallback((postId: string, isLiked: boolean) => {
    setPosts(prev => prev.map(post =>
      post.id === postId
        ? {
            ...post,
            hasLiked: !isLiked,
            likeCount: isLiked ? post.likeCount - 1 : post.likeCount + 1
          }
        : post
    ));
    onLike?.(postId, isLiked);
  }, [onLike]);

  // Handle bookmark removal
  const handleBookmark = useCallback((postId: string, isBookmarked: boolean) => {
    if (isBookmarked) {
      // Remove from list when unbookmarking
      setPosts(prev => prev.filter(post => post.id !== postId));
    }
    onBookmark?.(postId, isBookmarked);
  }, [onBookmark]);

  // Convert to FeedPost format for PostCard
  const toFeedPost = (post: BookmarkedPost): FeedPost => ({
    id: post.id,
    authorId: post.authorId,
    text: post.text,
    contentHtml: post.contentHtml,
    images: post.images,
    videoUrl: post.videoUrl,
    createdAt: post.createdAt,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    repostCount: post.repostCount,
    bookmarkCount: post.bookmarkCount,
    hasLiked: post.hasLiked,
    hasBookmarked: true,
    hasReposted: post.hasReposted,
    author: post.author,
  });

  // Post list content
  const postListContent = (
    <div className="space-y-1">
      {posts.map((post) => (
        <button
          key={post.id}
          onClick={() => setSelectedPost(post)}
          className="w-full text-left group"
        >
          <div className="flex items-start gap-3 p-3.5 rounded-2xl hover:bg-[#faf7f4] dark:hover:bg-[#1a1f2a] transition-colors active:bg-[#f5f2ef] dark:active:bg-[#262b35]">
            {/* Author avatar */}
            <div className="w-11 h-11 rounded-full overflow-hidden bg-[#faf7f4] dark:bg-[#262b35] flex-shrink-0 ring-2 ring-white/50 dark:ring-transparent">
              {post.author?.imageUrl ? (
                <Image
                  src={post.author.imageUrl}
                  alt={post.author.name || 'User'}
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-[#5f5a55] dark:text-[#b5b0ab]">
                  {(post.author?.firstName?.[0] || '')}{(post.author?.lastName?.[0] || '')}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
                  {post.author?.name || 'User'}
                </span>
              </div>
              {post.text && (
                <p className="text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] line-clamp-2 leading-relaxed">
                  {post.text}
                </p>
              )}
              {!post.text && post.images && post.images.length > 0 && (
                <p className="text-[14px] text-[#8a857f]">
                  Shared a photo
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-[12px] text-[#9a958f]">
                {post.likeCount > 0 && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    {post.likeCount}
                  </span>
                )}
                {post.commentCount > 0 && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    {post.commentCount}
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail if has image */}
            {post.images && post.images.length > 0 && (
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                <Image
                  src={post.images[0]}
                  alt="Post thumbnail"
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Chevron with smooth transition */}
            <svg className="w-5 h-5 text-brand-accent/40 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-4" />

      {/* Loading more - smooth pulse */}
      {isLoading && posts.length > 0 && (
        <div className="flex justify-center py-6">
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-accent/60 animate-[pulse_1s_ease-in-out_infinite]" />
            <div className="w-2 h-2 rounded-full bg-brand-accent/60 animate-[pulse_1s_ease-in-out_infinite_0.2s]" />
            <div className="w-2 h-2 rounded-full bg-brand-accent/60 animate-[pulse_1s_ease-in-out_infinite_0.4s]" />
          </div>
        </div>
      )}
    </div>
  );

  // Post detail view content
  const postDetailContent = selectedPost && (
    <motion.div
      key="detail"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="relative"
    >
      {/* Back button */}
      <button
        onClick={() => setSelectedPost(null)}
        className="sticky top-0 z-10 flex items-center gap-2 px-4 py-4 pt-5 bg-white dark:bg-[#171b22] border-b border-[#f0ebe5] dark:border-[#262b35] w-full text-left group transition-colors hover:bg-[#faf7f4] dark:hover:bg-[#1a1f2a]"
      >
        <svg className="w-5 h-5 text-amber-500 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-[14px] font-medium text-[#5f5a55] dark:text-[#b5b0ab]">Back to saved posts</span>
      </button>

      {/* Post card */}
      <div className="p-4">
        <PostCard
          post={toFeedPost(selectedPost)}
          variant="embedded"
          onLike={handleLike}
          onBookmark={handleBookmark}
          onShare={onShare}
          onDelete={onDelete}
          onReport={onReport}
        />
      </div>
    </motion.div>
  );

  // Loading state - simple skeleton
  const loadingContent = (
    <div className="space-y-1 p-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 p-3.5 rounded-2xl">
          <div className="w-11 h-11 rounded-full bg-[#f5f2ef] dark:bg-[#262b35] animate-pulse" />
          <div className="flex-1 space-y-2.5">
            <div className="w-28 h-4 bg-[#f5f2ef] dark:bg-[#262b35] rounded animate-pulse" />
            <div className="w-full h-4 bg-[#faf7f4] dark:bg-[#262b35] rounded animate-pulse" />
            <div className="w-2/3 h-3 bg-[#faf7f4] dark:bg-[#262b35] rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );

  // Empty state with elegant animation
  const emptyContent = (
    <div className="flex flex-col items-center justify-center py-20 px-4 animate-modal-content">
      <div className="relative mb-5">
        {/* Subtle glow ring */}
        <div className="absolute inset-0 w-20 h-20 rounded-full bg-brand-accent/10 animate-[pulse_3s_ease-in-out_infinite] blur-sm" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-brand-accent/15 to-brand-accent/5 flex items-center justify-center border border-brand-accent/10">
          <svg className="w-9 h-9 text-brand-accent/70" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
      </div>
      <h3 className="font-semibold text-[18px] text-[#1a1a1a] dark:text-[#faf8f6] mb-2">
        No saved posts yet
      </h3>
      <p className="text-[14px] text-[#9a958f] text-center max-w-[260px] leading-relaxed">
        Tap the bookmark icon on posts you want to save for later.
      </p>
    </div>
  );

  // Main content wrapper - takes showCloseButton param
  const mainContent = (showCloseButton: boolean) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      {!selectedPost && (
        <div className={`flex-shrink-0 flex items-center ${showCloseButton ? 'justify-between' : 'justify-center'} px-5 py-4 border-b border-[#f0ebe5] dark:border-[#262b35]`}>
          <h2 className="font-semibold text-[17px] text-[#1a1a1a] dark:text-[#faf8f6] flex items-center gap-2">
            <svg className="w-[18px] h-[18px] text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Saved Posts
          </h2>
          {showCloseButton && (
            <button
              onClick={() => onOpenChange(false)}
              className="p-2.5 -mr-2 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              <svg className="w-5 h-5 text-[#9a958f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          {selectedPost ? (
            postDetailContent
          ) : isLoading && posts.length === 0 ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {loadingContent}
            </motion.div>
          ) : posts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {emptyContent}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="p-2"
            >
              {postListContent}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[80vh] rounded-3xl" hideCloseButton>
          {mainContent(true)}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <div className="h-full overflow-hidden">
          {mainContent(false)}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
