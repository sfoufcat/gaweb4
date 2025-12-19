'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { DiscoverArticle } from '@/types/discover';

interface ArticleCardProps {
  article: DiscoverArticle;
  variant?: 'horizontal' | 'grid';
}

// Helper to get badge label for article type
function getArticleTypeLabel(articleType?: string): string {
  if (!articleType) return '';
  switch (articleType) {
    case 'playbook': return 'Playbook';
    case 'trend': return 'Trend';
    case 'caseStudy': return 'Case Study';
    default: return '';
  }
}

// Helper to get badge color for article type
function getArticleTypeBadgeColor(articleType?: string): string {
  switch (articleType) {
    case 'playbook': return 'bg-emerald-500/90';
    case 'trend': return 'bg-purple-500/90';
    case 'caseStudy': return 'bg-orange-500/90';
    default: return 'bg-earth-500/90';
  }
}

export function ArticleCard({ article, variant = 'horizontal' }: ArticleCardProps) {
  const badgeLabel = getArticleTypeLabel(article.articleType);
  const badgeColor = getArticleTypeBadgeColor(article.articleType);

  if (variant === 'grid') {
    return (
      <Link href={`/discover/articles/${article.id}`}>
        <div className="bg-white/70 dark:bg-[#171b22] rounded-[20px] overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer h-full flex flex-col">
          {/* Cover Image */}
          <div className="relative h-[140px] w-full bg-earth-100 dark:bg-[#262b35] flex-shrink-0">
            {article.coverImageUrl ? (
              <Image
                src={article.coverImageUrl}
                alt={article.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-10 h-10 text-earth-300 dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
            )}
            
            {/* Type badge */}
            {badgeLabel && (
              <div className={`absolute top-3 left-3 ${badgeColor} backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center justify-center`}>
                <span className="font-sans text-[11px] font-medium text-white leading-none">
                  {badgeLabel}
                </span>
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="p-4 flex flex-col gap-2 flex-1">
            <h3 className="font-albert font-semibold text-base text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3] line-clamp-2">
              {article.title}
            </h3>
            <p className="font-sans text-sm text-text-muted dark:text-[#7d8190] mt-auto">
              {article.authorName}
              {article.readingTimeMinutes && ` · ${article.readingTimeMinutes} min`}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  // Horizontal scroll variant
  return (
    <Link href={`/discover/articles/${article.id}`}>
      <div className="bg-white/70 dark:bg-[#171b22] rounded-[20px] w-[220px] flex-shrink-0 overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer">
        {/* Cover Image */}
        <div className="relative h-[120px] w-full bg-earth-100 dark:bg-[#262b35]">
          {article.coverImageUrl ? (
            <Image
              src={article.coverImageUrl}
              alt={article.title}
              fill
              className="object-cover"
              sizes="220px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-8 h-8 text-earth-300 dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
          )}
          
          {/* Type badge */}
          {badgeLabel && (
            <div className={`absolute top-2 left-2 ${badgeColor} backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center justify-center`}>
              <span className="font-sans text-[10px] font-medium text-white leading-none">
                {badgeLabel}
              </span>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-3 flex flex-col gap-1.5">
          <h3 className="font-albert font-semibold text-sm text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px] leading-[1.3] line-clamp-2">
            {article.title}
          </h3>
          <p className="font-sans text-xs text-text-muted dark:text-[#7d8190]">
            {article.authorName}
            {article.readingTimeMinutes && ` · ${article.readingTimeMinutes} min`}
          </p>
        </div>
      </div>
    </Link>
  );
}

