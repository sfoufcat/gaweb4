'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useBrandingValues } from '@/contexts/BrandingContext';
import type { FeedPost } from '@/hooks/useFeed';

interface CompactPostPreview {
  id: string;
  authorId: string;
  text?: string;
  images?: string[];
  likeCount: number;
  author?: {
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
  };
}

/**
 * FeedSidebar - Desktop right sidebar showing bookmarks and trending posts
 * 
 * Hidden on mobile, visible on lg: breakpoints
 */
export function FeedSidebar() {
  const { colors, isDefault } = useBrandingValues();
  const [bookmarkedPosts, setBookmarkedPosts] = useState<CompactPostPreview[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<CompactPostPreview[]>([]);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(true);
  const [isLoadingTrending, setIsLoadingTrending] = useState(true);

  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  // Fetch bookmarked posts
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const response = await fetch('/api/feed/bookmarks?limit=5');
        if (response.ok) {
          const data = await response.json();
          setBookmarkedPosts(data.posts || []);
        }
      } catch (error) {
        console.error('Failed to fetch bookmarks:', error);
      } finally {
        setIsLoadingBookmarks(false);
      }
    };

    fetchBookmarks();
  }, []);

  // Fetch trending posts
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await fetch('/api/feed/trending?limit=5');
        if (response.ok) {
          const data = await response.json();
          setTrendingPosts(data.posts || []);
        }
      } catch (error) {
        console.error('Failed to fetch trending:', error);
      } finally {
        setIsLoadingTrending(false);
      }
    };

    fetchTrending();
  }, []);

  return (
    <aside className="hidden lg:block w-80 flex-shrink-0 space-y-6">
      {/* Bookmarked Posts Section */}
      <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e8e4df] dark:border-[#262b35]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6] flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: accentColor }}>
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Saved
            </h3>
            {bookmarkedPosts.length > 0 && (
              <Link 
                href="/feed/bookmarks" 
                className="text-[13px] hover:underline"
                style={{ color: accentColor }}
              >
                See all
              </Link>
            )}
          </div>
        </div>

        <div className="p-2">
          {isLoadingBookmarks ? (
            // Loading skeleton
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-2 rounded-xl animate-pulse">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="w-20 h-3 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                      <div className="w-full h-3 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : bookmarkedPosts.length === 0 ? (
            // Empty state
            <div className="py-6 text-center">
              <p className="text-[13px] text-[#8a857f]">
                No saved posts yet
              </p>
            </div>
          ) : (
            // Posts list
            <div className="space-y-1">
              {bookmarkedPosts.map((post) => (
                <CompactPostItem key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trending Posts Section */}
      <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e8e4df] dark:border-[#262b35]">
          <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6] flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: accentColor }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Trending
          </h3>
          <p className="text-[11px] text-[#8a857f] mt-0.5">Popular this week</p>
        </div>

        <div className="p-2">
          {isLoadingTrending ? (
            // Loading skeleton
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-2 rounded-xl animate-pulse">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="w-20 h-3 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                      <div className="w-full h-3 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : trendingPosts.length === 0 ? (
            // Empty state
            <div className="py-6 text-center">
              <p className="text-[13px] text-[#8a857f]">
                No trending posts yet
              </p>
            </div>
          ) : (
            // Posts list
            <div className="space-y-1">
              {trendingPosts.map((post, index) => (
                <CompactPostItem key={post.id} post={post} rank={index + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// Compact post preview item
function CompactPostItem({ post, rank }: { post: CompactPostPreview; rank?: number }) {
  const authorName = post.author 
    ? `${post.author.firstName || ''} ${post.author.lastName || ''}`.trim() || 'User'
    : 'User';
  const authorInitials = authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Truncate text to ~50 chars
  const textPreview = post.text 
    ? post.text.length > 50 
      ? post.text.substring(0, 50) + '...' 
      : post.text
    : post.images?.length 
      ? '📷 Photo' 
      : '';

  return (
    <Link
      href={`/feed?post=${post.id}`}
      className="flex items-start gap-2 p-2 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a] transition-colors"
    >
      {/* Rank number for trending */}
      {rank && (
        <div className="w-5 h-5 rounded-full bg-[#f5f3f0] dark:bg-[#262b35] flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-[10px] font-bold text-[#8a857f]">{rank}</span>
        </div>
      )}

      {/* Author avatar */}
      <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] flex-shrink-0">
        {post.author?.imageUrl ? (
          <Image
            src={post.author.imageUrl}
            alt={authorName}
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-[#5f5a55] dark:text-[#b5b0ab]">
            {authorInitials}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#1a1a1a] dark:text-[#faf8f6] truncate">
          {authorName}
        </p>
        <p className="text-[12px] text-[#8a857f] line-clamp-2 leading-tight">
          {textPreview}
        </p>
        {post.likeCount > 0 && (
          <p className="text-[10px] text-[#8a857f] mt-0.5 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {post.likeCount}
          </p>
        )}
      </div>

      {/* Thumbnail if has image */}
      {post.images && post.images.length > 0 && (
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={post.images[0]}
            alt="Post thumbnail"
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </Link>
  );
}

