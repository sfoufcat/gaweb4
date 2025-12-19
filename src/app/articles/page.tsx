'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useDiscover } from '@/hooks/useDiscover';
import { ArticleCard } from '@/components/discover';
import type { ArticleType } from '@/types/discover';

export default function ArticlesPage() {
  const searchParams = useSearchParams();
  const { articles, loading } = useDiscover();
  
  // Get initial type from URL query param
  const initialType = (searchParams.get('type') as ArticleType | 'all') || 'all';
  const [selectedArticleType, setSelectedArticleType] = useState<ArticleType | 'all'>(initialType);

  // Update state when URL param changes
  useEffect(() => {
    const typeParam = searchParams.get('type') as ArticleType | 'all';
    if (typeParam && ['playbook', 'trend', 'caseStudy'].includes(typeParam)) {
      setSelectedArticleType(typeParam);
    } else {
      setSelectedArticleType('all');
    }
  }, [searchParams]);

  // Filter articles by type
  const filteredArticles = useMemo(() => {
    if (selectedArticleType === 'all') return articles;
    return articles.filter(a => a.articleType === selectedArticleType);
  }, [articles, selectedArticleType]);

  // Article type filter options
  const articleTypeOptions: { value: ArticleType | 'all'; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'playbook', label: 'Playbooks' },
    { value: 'trend', label: 'Trends' },
    { value: 'caseStudy', label: 'Case Studies' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
        {/* Header Skeleton */}
        <section className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#e1ddd8]/50 rounded-full animate-pulse" />
            <div className="h-10 w-40 bg-[#e1ddd8]/50 rounded-lg animate-pulse" />
          </div>
        </section>

        {/* Filters Skeleton */}
        <section className="px-4 py-4">
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-10 w-24 bg-[#e1ddd8]/40 rounded-full animate-pulse"
              />
            ))}
          </div>
        </section>

        {/* Grid Skeleton */}
        <section className="px-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="bg-white/60 rounded-[20px] overflow-hidden animate-pulse"
              >
                <div className="h-[140px] bg-[#e1ddd8]/40" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-full bg-[#e1ddd8]/50 rounded-lg" />
                  <div className="h-4 w-2/3 bg-[#e1ddd8]/50 rounded-lg" />
                  <div className="h-3 w-24 bg-[#e1ddd8]/30 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      {/* Header */}
      <section className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/discover" className="flex-shrink-0">
            <div className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-earth-100 transition-colors">
              <svg 
                className="w-5 h-5 text-text-primary" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
          <h1 className="font-albert font-normal text-4xl text-text-primary tracking-[-2px] leading-[1.2]">
            All Articles
          </h1>
        </div>
      </section>

      {/* Filters */}
      <section className="px-4 py-4 sticky top-0 bg-app-bg z-10">
        <div className="flex flex-col gap-2">
          <span className="font-sans text-sm text-text-secondary">Filter by Type</span>
          <div className="flex gap-2 flex-wrap">
            {articleTypeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedArticleType(option.value)}
                className={`px-4 py-2 rounded-full text-sm font-sans transition-all ${
                  selectedArticleType === option.value
                    ? 'bg-earth-600 text-white'
                    : 'bg-white/70 text-text-secondary hover:bg-white hover:text-text-primary border border-[#e1ddd8]/50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Results Count */}
      <section className="px-4 pb-2">
        <p className="font-sans text-sm text-text-muted">
          {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'} found
        </p>
      </section>

      {/* Articles Grid */}
      <section className="px-4 py-4">
        {filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredArticles.map((article) => (
              <ArticleCard key={article.id} article={article} variant="grid" />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-earth-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-earth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h3 className="font-albert font-medium text-lg text-text-primary mb-2">
              No articles found
            </h3>
            <p className="font-sans text-sm text-text-muted max-w-sm mx-auto">
              {selectedArticleType !== 'all' 
                ? `There are no ${articleTypeOptions.find(o => o.value === selectedArticleType)?.label.toLowerCase()} available yet.`
                : 'There are no articles available yet.'
              }
            </p>
            {selectedArticleType !== 'all' && (
              <button
                onClick={() => setSelectedArticleType('all')}
                className="mt-4 px-4 py-2 rounded-full text-sm font-sans bg-earth-600 text-white hover:bg-earth-700 transition-colors"
              >
                View all articles
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}









