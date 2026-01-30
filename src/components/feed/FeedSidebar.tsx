'use client';

import Image from 'next/image';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { AnimatePresence, motion } from 'framer-motion';

export interface CompactPostPreview {
  id: string;
  authorId: string;
  text?: string;
  images?: string[];
  likeCount: number;
  commentCount?: number;
  author?: {
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
  };
}

interface FeedSidebarProps {
  onSelectPost?: (postId: string) => void;
}

// SWR fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

// SWR cache keys - exported so they can be used for revalidation
export const SIDEBAR_BOOKMARKS_KEY = '/api/feed/bookmarks?limit=5';
export const SIDEBAR_TRENDING_KEY = '/api/feed/trending?limit=5';
export const SIDEBAR_PINNED_KEY = '/api/feed/pinned?limit=5';

// Shared mutate reference - will be set by FeedSidebar component
let sharedMutate: ReturnType<typeof useSWRConfig>['mutate'] | null = null;

export function setSharedMutate(mutate: ReturnType<typeof useSWRConfig>['mutate']) {
  sharedMutate = mutate;
}

// Optimistic update helpers for instant sidebar updates
export function optimisticallyAddBookmark(post: CompactPostPreview) {
  if (!sharedMutate) {
    console.warn('[Sidebar] sharedMutate not set, cannot update optimistically');
    return;
  }
  sharedMutate(SIDEBAR_BOOKMARKS_KEY, (data: { posts: CompactPostPreview[] } | undefined) => {
    if (!data) return { posts: [post] };
    // Avoid duplicates, add to front, limit to 5
    const filtered = data.posts.filter(p => p.id !== post.id);
    return { posts: [post, ...filtered].slice(0, 5) };
  }, { revalidate: false });
}

export function optimisticallyRemoveBookmark(postId: string) {
  if (!sharedMutate) {
    console.warn('[Sidebar] sharedMutate not set, cannot update optimistically');
    return;
  }
  sharedMutate(SIDEBAR_BOOKMARKS_KEY, (data: { posts: CompactPostPreview[] } | undefined) => {
    if (!data) return data;
    return { posts: data.posts.filter(p => p.id !== postId) };
  }, { revalidate: false });
}

/**
 * FeedSidebar - Desktop right sidebar showing pinned, bookmarks and trending posts
 * 
 * Hidden on mobile, visible on lg: breakpoints
 * Uses SWR for caching - bookmarks auto-refresh when feed bookmarks change
 * 
 * Sections:
 * - Pinned: Only shows if there are pinned posts
 * - Saved: Always shows (with empty state)
 * - Trending: Only shows if there are trending posts from the past week
 */
export function FeedSidebar({ onSelectPost }: FeedSidebarProps) {
  // Set shared mutate for optimistic updates from other components
  const { mutate } = useSWRConfig();
  setSharedMutate(mutate);

  // Use SWR for pinned posts
  const { data: pinnedData, isLoading: isLoadingPinned } = useSWR<{ posts: CompactPostPreview[] }>(
    SIDEBAR_PINNED_KEY,
    fetcher,
    { 
      revalidateOnFocus: false, 
      dedupingInterval: 10000,
      errorRetryCount: 0,
      shouldRetryOnError: false,
    }
  );
  
  // Use SWR for bookmarks - will auto-revalidate
  const { data: bookmarksData, isLoading: isLoadingBookmarks } = useSWR<{ posts: CompactPostPreview[] }>(
    SIDEBAR_BOOKMARKS_KEY,
    fetcher,
    { 
      revalidateOnFocus: false, 
      dedupingInterval: 5000,
      errorRetryCount: 0, // Prevent constant retries on error
      shouldRetryOnError: false,
    }
  );
  
  // Use SWR for trending
  const { data: trendingData, isLoading: isLoadingTrending } = useSWR<{ posts: CompactPostPreview[] }>(
    SIDEBAR_TRENDING_KEY,
    fetcher,
    { 
      revalidateOnFocus: false, 
      dedupingInterval: 30000,
      errorRetryCount: 0, // Prevent constant retries on error
      shouldRetryOnError: false,
    }
  );

  const pinnedPosts = pinnedData?.posts || [];
  const bookmarkedPosts = bookmarksData?.posts || [];
  const trendingPosts = trendingData?.posts || [];
  
  // Only show pinned section if there are pinned posts (after loading)
  const showPinnedSection = !isLoadingPinned && pinnedPosts.length > 0;
  
  // Only show trending section if there are trending posts (after loading)
  const showTrendingSection = !isLoadingTrending && trendingPosts.length > 0;

  return (
    <aside className="hidden lg:block w-full space-y-6">
      {/* Pinned Posts Section - Only shows if there are pinned posts */}
      {showPinnedSection && (
        <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e8e4df] dark:border-[#262b35]">
            <h3 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6] flex items-center gap-2.5">
              <svg className="w-5 h-5 text-brand-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 12V4h1V2H7v2h1v8l-3 5v2h6v5l1 1 1-1v-5h6v-2l-3-5z" />
              </svg>
              Pinned
            </h3>
          </div>

          <div className="p-3">
            <div className="space-y-1">
              {pinnedPosts.map((post) => (
                <CompactPostItem key={post.id} post={post} onSelect={onSelectPost} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bookmarked Posts Section */}
      <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e8e4df] dark:border-[#262b35]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6] flex items-center gap-2.5">
              <svg className="w-5 h-5 text-brand-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Saved
            </h3>
            {bookmarkedPosts.length > 0 && (
              <Link 
                href="/feed/bookmarks" 
                className="text-[14px] text-brand-accent hover:underline"
              >
                See all
              </Link>
            )}
          </div>
        </div>

        <div className="p-3">
          {isLoadingBookmarks ? (
            // Loading skeleton
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-2 rounded-xl animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                    <div className="flex-1 space-y-2">
                      <div className="w-24 h-3.5 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                      <div className="w-full h-3.5 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Posts list with animations
            <AnimatePresence mode="popLayout">
              {bookmarkedPosts.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-8 text-center"
                >
                  <p className="text-[14px] text-[#8a857f]">
                    No saved posts yet
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-1">
                  {bookmarkedPosts.map((post) => (
                    <motion.div
                      key={post.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, x: -20 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                        opacity: { duration: 0.2 }
                      }}
                    >
                      <CompactPostItem post={post} onSelect={onSelectPost} />
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Trending Posts Section - Only shows if there are trending posts */}
      {showTrendingSection && (
        <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e8e4df] dark:border-[#262b35]">
            <h3 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6] flex items-center gap-2.5">
              <svg className="w-5 h-5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Trending
            </h3>
            <p className="text-[12px] text-[#8a857f] mt-1">Popular this week</p>
          </div>

          <div className="p-3">
            <div className="space-y-1">
              {trendingPosts.map((post, index) => (
                <CompactPostItem key={post.id} post={post} rank={index + 1} onSelect={onSelectPost} />
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

// Compact post preview item
function CompactPostItem({ post, rank, onSelect }: { post: CompactPostPreview; rank?: number; onSelect?: (postId: string) => void }) {
  const authorName = post.author 
    ? `${post.author.firstName || ''} ${post.author.lastName || ''}`.trim() || 'User'
    : 'User';
  const authorInitials = authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Truncate text to ~60 chars
  const textPreview = post.text 
    ? post.text.length > 60 
      ? post.text.substring(0, 60) + '...' 
      : post.text
    : post.images?.length 
      ? '📷 Photo' 
      : '';

  return (
    <button
      onClick={() => onSelect?.(post.id)}
      className="w-full text-left flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a] transition-colors"
    >
      {/* Rank number for trending */}
      {rank && (
        <div className="w-6 h-6 rounded-full bg-[#f5f3f0] dark:bg-[#262b35] flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[11px] font-bold text-[#8a857f]">{rank}</span>
        </div>
      )}

      {/* Author avatar */}
      <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] flex-shrink-0">
        {post.author?.imageUrl ? (
          <Image
            src={post.author.imageUrl}
            alt={authorName}
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[11px] font-semibold text-[#5f5a55] dark:text-[#b5b0ab]">
            {authorInitials}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-[#1a1a1a] dark:text-[#faf8f6] truncate">
          {authorName}
        </p>
        <p className="text-[13px] text-[#8a857f] line-clamp-2 leading-snug">
          {textPreview}
        </p>
        {post.likeCount > 0 && (
          <p className="text-[11px] text-[#8a857f] mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {post.likeCount}
          </p>
        )}
      </div>

      {/* Thumbnail if has image */}
      {post.images && post.images.length > 0 && (
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={post.images[0]}
            alt="Post thumbnail"
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </button>
  );
}

