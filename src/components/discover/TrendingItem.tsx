'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { TrendingItem as TrendingItemType } from '@/types/discover';

interface TrendingItemProps {
  item: TrendingItemType;
  index: number;
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

export function TrendingItem({ item, index }: TrendingItemProps) {
  const href = item.type === 'article' 
    ? `/discover/articles/${item.id}` 
    : `/discover/courses/${item.id}`;

  // Format index with leading zero
  const formattedIndex = String(index + 1).padStart(2, '0');

  // Determine badge text and color
  const isArticle = item.type === 'article';
  const badgeLabel = isArticle && item.articleType 
    ? getArticleTypeLabel(item.articleType) 
    : item.type.charAt(0).toUpperCase() + item.type.slice(1);
  const badgeColor = isArticle && item.articleType 
    ? getArticleTypeBadgeColor(item.articleType) 
    : 'bg-earth-500/90';

  return (
    <Link href={href}>
      <div className="bg-white/70 dark:bg-[#171b22] rounded-[20px] w-[180px] flex-shrink-0 hover:shadow-md dark:hover:shadow-none transition-shadow cursor-pointer overflow-hidden">
        {/* Cover Image */}
        <div className="relative h-[100px] w-full bg-earth-100 dark:bg-[#11141b]">
          {item.coverImageUrl ? (
            <Image
              src={item.coverImageUrl}
              alt={item.title}
              fill
              className="object-cover"
              sizes="180px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-8 h-8 text-earth-300 dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          )}
          
          {/* Index badge */}
          <div className="absolute top-2 left-2 bg-white/90 dark:bg-[#1e222a]/90 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center justify-center">
            <span className="font-sans text-xs font-medium text-text-primary dark:text-[#f5f5f8] leading-none">
              {formattedIndex}
            </span>
          </div>
          
          {/* Type badge - shows articleType for articles, "Course" for courses */}
          <div className={`absolute top-2 right-2 ${badgeColor} backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center justify-center`}>
            <span className="font-sans text-[10px] font-medium text-white leading-none">
              {badgeLabel}
            </span>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-3 flex flex-col gap-1.5">
          <h3 className="font-albert font-semibold text-base text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3] line-clamp-2">
            {item.title}
          </h3>
          <p className="font-sans text-xs text-text-secondary dark:text-[#b2b6c2] tracking-[-0.2px] leading-[1.3] line-clamp-2">
            {item.snippet}
          </p>
        </div>
      </div>
    </Link>
  );
}

