'use client';

import { useState, useCallback, useEffect } from 'react';
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
  images?: string[];
  videoUrl?: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  bookmarkCount: number;
  hasLiked?: boolean;
  hasBookmarked?: boolean;
  hasReposted?: boolean;
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
  author?: FeedPostAuthor;
}

// =============================================================================
// FEED HOOK
// =============================================================================

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      dedupingInterval: 10000, // 10 seconds
    }
  );

  // Flatten posts from all pages
  const posts = data ? data.flatMap((page) => page.posts) : [];
  const hasMore = data ? data[data.length - 1]?.hasMore : false;
  const isEmpty = data?.[0]?.posts.length === 0;

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
        posts: page.posts.map((post) =>
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
        posts: page.posts.map((post) =>
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

  // Add new post to feed (optimistic)
  const addPost = useCallback((post: FeedPost) => {
    mutate((currentData) => {
      if (!currentData) return currentData;
      
      const [firstPage, ...restPages] = currentData;
      return [
        {
          ...firstPage,
          posts: [post, ...firstPage.posts],
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
        posts: page.posts.filter((post) => post.id !== postId),
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

  const comments = data ? data.flatMap((page) => page.comments) : [];
  const hasMore = data ? data[data.length - 1]?.hasMore : false;

  const loadMore = useCallback(() => {
    if (!isValidating && hasMore) {
      setSize(size + 1);
    }
  }, [isValidating, hasMore, setSize, size]);

  const addComment = useCallback((comment: FeedComment) => {
    mutate((currentData) => {
      if (!currentData) return currentData;
      
      const [firstPage, ...restPages] = currentData;
      return [
        {
          ...firstPage,
          comments: [comment, ...firstPage.comments],
        },
        ...restPages,
      ];
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

  const posts = data ? data.flatMap((page) => page.posts) : [];
  const hasMore = data ? data[data.length - 1]?.hasMore : false;

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

export function useFeedEnabled() {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkFeedEnabled = async () => {
      try {
        const response = await fetch('/api/feed?limit=1');
        if (response.status === 403) {
          setIsEnabled(false);
        } else {
          setIsEnabled(true);
        }
      } catch {
        setIsEnabled(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkFeedEnabled();
  }, []);

  return { isEnabled, isLoading };
}

