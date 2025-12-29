'use client';

import useSWR from 'swr';
import type { DiscoverArticle, DiscoverCourse } from '@/types/discover';

export interface DiscoverRecommendation {
  id: string;
  type: 'article' | 'course';
  title: string;
  description: string;
  coverImageUrl: string;
  category?: string;
}

interface UseDiscoverRecommendationReturn {
  /** The recommended content item */
  recommendation: DiscoverRecommendation | null;
  /** Whether the recommendation is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: string | null;
}

/**
 * Hook for getting a recommended Discover content item for the home page card
 * 
 * Fetches articles and courses and returns a random featured one
 * Uses SWR for caching and background revalidation
 */
export function useDiscoverRecommendation(): UseDiscoverRecommendationReturn {
  const { data, error, isLoading } = useSWR<DiscoverRecommendation | null>(
    '/api/discover/recommendation',
    async () => {
      // Fetch both articles and courses in parallel
      const [articlesRes, coursesRes] = await Promise.all([
        fetch('/api/discover/articles'),
        fetch('/api/discover/courses'),
      ]);

      const articles: DiscoverArticle[] = articlesRes.ok ? await articlesRes.json() : [];
      const courses: DiscoverCourse[] = coursesRes.ok ? await coursesRes.json() : [];

      // Combine featured content, prioritize featured items
      const featuredArticles = articles.filter(a => a.featured);
      const featuredCourses = courses.filter(c => c.featured);
      
      // If no featured content, use any content
      const availableArticles = featuredArticles.length > 0 ? featuredArticles : articles;
      const availableCourses = featuredCourses.length > 0 ? featuredCourses : courses;

      // Combine all available content
      const allContent: DiscoverRecommendation[] = [
        ...availableArticles.map(a => ({
          id: a.id,
          type: 'article' as const,
          title: a.title,
          description: a.content?.slice(0, 120)?.replace(/<[^>]*>/g, '') + '...' || 'Read this article',
          coverImageUrl: a.coverImageUrl,
          category: a.category || a.articleType,
        })),
        ...availableCourses.map(c => ({
          id: c.id,
          type: 'course' as const,
          title: c.title,
          description: c.shortDescription || 'Start learning',
          coverImageUrl: c.coverImageUrl,
          category: c.category,
        })),
      ];

      if (allContent.length === 0) {
        return null;
      }

      // Return a random item (seeded by day for consistency throughout the day)
      const now = new Date();
      const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const index = dayOfYear % allContent.length;
      
      return allContent[index];
    },
    {
      // Cache for 1 hour, content doesn't change frequently
      dedupingInterval: 60 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  return {
    recommendation: data ?? null,
    isLoading: isLoading && !data,
    error: error?.message ?? null,
  };
}








