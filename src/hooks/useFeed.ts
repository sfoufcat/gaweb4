'use client';

import { useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';

// =============================================================================
// TYPES
// =============================================================================

export interface FeedPostAuthor {
  id: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  name?: string;
  profileImage?: string;
}

export interface FeedPost {
  id: string;
  authorId: string;
  text?: string;
  content?: object; // TipTap JSON content
  contentHtml?: string; // Pre-rendered HTML
  images?: string[];
  videoUrl?: string;
  pollId?: string; // Poll attachment
  pollData?: import('@/types/poll').ChatPollState; // Embedded poll data
  createdAt: string;
  updatedAt?: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  bookmarkCount: number;
  hasLiked?: boolean;
  hasBookmarked?: boolean;
  hasReposted?: boolean;
  isRepost?: boolean;
  author?: FeedPostAuthor;
  // For reposts
  originalPostId?: string;
  originalAuthorId?: string;
  originalText?: string;
  originalImages?: string[];
  originalVideoUrl?: string;
  quote?: string;
}

export interface FeedComment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  parentCommentId?: string;
  createdAt: string;
  updatedAt?: string;
  author?: FeedPostAuthor;
}

// =============================================================================
// FEED HOOK
// =============================================================================

// Fetcher that throws on error responses so SWR can handle them properly
const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  
  // If the API returns an error (e.g., feed disabled), throw so SWR treats it as error
  if (!res.ok || data.error) {
    const error = new Error(data.error || 'Failed to fetch feed');
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  
  return data;
};

const getKey = (pageIndex: number, previousPageData: { posts: FeedPost[]; nextCursor: string | null } | null) => {
  // First page
  if (pageIndex === 0) return '/api/feed?limit=20';
  
  // No more pages
  if (!previousPageData?.nextCursor) return null;
  
  // Next page
  return `/api/feed?limit=20&cursor=${previousPageData.nextCursor}`;
};

export function useFeed() {
  const {
    data,
    error,
    isLoading,
    isValidating,
    size,
    setSize,
    mutate,
  } = useSWRInfinite<{ posts: FeedPost[]; nextCursor: string | null; hasMore: boolean }>(
    getKey,
    fetcher,
    {
      revalidateFirstPage: true, // Always fetch fresh first page to get updated author info
      revalidateOnFocus: false,
      dedupingInterval: 5000, // 5 seconds - reduced to get fresher author data
    }
  );

  // Flatten posts from all pages (with null safety for error responses)
  const posts = data ? data.flatMap((page) => page.posts || []) : [];
  const hasMore = data ? data[data.length - 1]?.hasMore ?? false : false;
  const isEmpty = !posts.length && !isLoading && !error;

  // Load more
  const loadMore = useCallback(() => {
    if (!isValidating && hasMore) {
      setSize(size + 1);
    }
  }, [isValidating, hasMore, setSize, size]);

  // Refresh feed
  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  // Optimistic update for like
  const optimisticLike = useCallback((postId: string, isLiked: boolean) => {
    mutate((currentData) => {
      if (!currentData) return currentData;
      
      return currentData.map((page) => ({
        ...page,
        posts: (page.posts || []).map((post) =>
          post.id === postId
            ? {
                ...post,
                hasLiked: isLiked,
                likeCount: post.likeCount + (isLiked ? 1 : -1),
              }
            : post
        ),
      }));
    }, false);
  }, [mutate]);

  // Optimistic update for bookmark
  const optimisticBookmark = useCallback((postId: string, isBookmarked: boolean) => {
    mutate((currentData) => {
      if (!currentData) return currentData;
      
      return currentData.map((page) => ({
        ...page,
        posts: (page.posts || []).map((post) =>
          post.id === postId
            ? {
                ...post,
                hasBookmarked: isBookmarked,
                bookmarkCount: post.bookmarkCount + (isBookmarked ? 1 : -1),
              }
            : post
        ),
      }));
    }, false);
  }, [mutate]);

  // Optimistic update for comment count
  const incrementCommentCount = useCallback((postId: string) => {
    mutate((currentData) => {
      if (!currentData) return currentData;
      
      return currentData.map((page) => ({
        ...page,
        posts: (page.posts || []).map((post) =>
          post.id === postId
            ? { ...post, commentCount: post.commentCount + 1 }
            : post
        ),
      }));
    }, false);
  }, [mutate]);

  // Optimistic update to decrement comment count
  const decrementCommentCount = useCallback((postId: string) => {
    mutate((currentData) => {
      if (!currentData) return currentData;
      
      return currentData.map((page) => ({
        ...page,
        posts: (page.posts || []).map((post) =>
          post.id === postId
            ? { ...post, commentCount: Math.max(0, post.commentCount - 1) }
            : post
        ),
      }));
    }, false);
  }, [mutate]);

  // Add new post to feed (optimistic)
  const addPost = useCallback((post: FeedPost) => {
    mutate((currentData) => {
      if (!currentData || currentData.length === 0) return currentData;
      
      const [firstPage, ...restPages] = currentData;
      if (!firstPage) return currentData;
      
      return [
        {
          ...firstPage,
          posts: [post, ...(firstPage.posts || [])],
        },
        ...restPages,
      ];
    }, false);
  }, [mutate]);

  // Remove post from feed (optimistic)
  const removePost = useCallback((postId: string) => {
    mutate((currentData) => {
      if (!currentData) return currentData;
      
      return currentData.map((page) => ({
        ...page,
        posts: (page.posts || []).filter((post) => post.id !== postId),
      }));
    }, false);
  }, [mutate]);

  return {
    posts,
    isLoading,
    isValidating,
    error,
    hasMore,
    isEmpty,
    loadMore,
    refresh,
    optimisticLike,
    optimisticBookmark,
    incrementCommentCount,
    decrementCommentCount,
    addPost,
    removePost,
  };
}

// =============================================================================
// SINGLE POST HOOK
// =============================================================================

export function usePost(postId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ post: FeedPost }>(
    postId ? `/api/feed/${postId}` : null,
    fetcher
  );

  return {
    post: data?.post,
    isLoading,
    error,
    refresh: mutate,
  };
}

// =============================================================================
// COMMENTS HOOK
// =============================================================================

const getCommentsKey = (postId: string) => (
  pageIndex: number,
  previousPageData: { comments: FeedComment[]; nextCursor: string | null } | null
) => {
  if (pageIndex === 0) return `/api/feed/${postId}/comment?limit=20`;
  if (!previousPageData?.nextCursor) return null;
  return `/api/feed/${postId}/comment?limit=20&cursor=${previousPageData.nextCursor}`;
};

export function useComments(postId: string | null) {
  const {
    data,
    error,
    isLoading,
    isValidating,
    size,
    setSize,
    mutate,
  } = useSWRInfinite<{ comments: FeedComment[]; nextCursor: string | null; hasMore: boolean }>(
    postId ? getCommentsKey(postId) : () => null,
    fetcher,
    {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
    }
  );

  const comments = data ? data.flatMap((page) => page.comments || []) : [];
  const hasMore = data ? data[data.length - 1]?.hasMore ?? false : false;

  const loadMore = useCallback(() => {
    if (!isValidating && hasMore) {
      setSize(size + 1);
    }
  }, [isValidating, hasMore, setSize, size]);

  const addComment = useCallback((comment: FeedComment) => {
    mutate((currentData) => {
      if (!currentData || !currentData.length) {
        // If no existing data, create initial page with the comment
        return [{ comments: [comment], nextCursor: null, hasMore: false }];
      }
      
      // Add to the END of the last page (comments are sorted asc by createdAt)
      const lastIndex = currentData.length - 1;
      return currentData.map((page, index) => {
        if (index === lastIndex) {
          return {
            ...page,
            comments: [...(page.comments || []), comment],
          };
        }
        return page;
      });
    }, false);
  }, [mutate]);

  const removeComment = useCallback((commentId: string) => {
    mutate((currentData) => {
      if (!currentData) return currentData;
      
      return currentData.map((page) => ({
        ...page,
        comments: (page.comments || []).filter((c) => c.id !== commentId),
      }));
    }, false);
  }, [mutate]);

  const updateComment = useCallback((commentId: string, newText: string, updatedAt: string) => {
    mutate((currentData) => {
      if (!currentData) return currentData;
      
      return currentData.map((page) => ({
        ...page,
        comments: (page.comments || []).map((c) => 
          c.id === commentId ? { ...c, text: newText, updatedAt } : c
        ),
      }));
    }, false);
  }, [mutate]);

  return {
    comments,
    isLoading,
    isValidating,
    error,
    hasMore,
    loadMore,
    addComment,
    removeComment,
    updateComment,
    refresh: mutate,
  };
}

// =============================================================================
// BOOKMARKS HOOK
// =============================================================================

const getBookmarksKey = (pageIndex: number, previousPageData: { posts: FeedPost[]; nextCursor: string | null } | null) => {
  if (pageIndex === 0) return '/api/feed/bookmarks?limit=20';
  if (!previousPageData?.nextCursor) return null;
  return `/api/feed/bookmarks?limit=20&cursor=${previousPageData.nextCursor}`;
};

export function useBookmarks() {
  const {
    data,
    error,
    isLoading,
    isValidating,
    size,
    setSize,
    mutate,
  } = useSWRInfinite<{ posts: FeedPost[]; nextCursor: string | null; hasMore: boolean }>(
    getBookmarksKey,
    fetcher,
    {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
    }
  );

  const posts = data ? data.flatMap((page) => page.posts || []) : [];
  const hasMore = data ? data[data.length - 1]?.hasMore ?? false : false;

  const loadMore = useCallback(() => {
    if (!isValidating && hasMore) {
      setSize(size + 1);
    }
  }, [isValidating, hasMore, setSize, size]);

  return {
    posts,
    isLoading,
    isValidating,
    error,
    hasMore,
    loadMore,
    refresh: mutate,
  };
}

// =============================================================================
// SEARCH HOOK
// =============================================================================

export function useFeedSearch(query: string) {
  const { data, error, isLoading, mutate } = useSWR<{ posts: FeedPost[]; query: string }>(
    query.trim() ? `/api/feed/search?q=${encodeURIComponent(query.trim())}&limit=20` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    posts: data?.posts || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

// =============================================================================
// FEED ENABLED CHECK
// =============================================================================
// NOTE: Use useFeedEnabled from @/contexts/BrandingContext instead!
// That hook uses Edge Config values from SSR for instant rendering without flash.
// This legacy hook is kept for backward compatibility but should not be used.

