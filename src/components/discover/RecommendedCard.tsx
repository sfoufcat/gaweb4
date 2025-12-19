'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { RecommendedItem } from '@/types/discover';

interface RecommendedCardProps {
  item: RecommendedItem;
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

export function RecommendedCard({ item }: RecommendedCardProps) {
  const href = item.type === 'article' 
    ? `/discover/articles/${item.id}` 
    : `/discover/courses/${item.id}`;

  // Determine if we should show article type badge
  const isArticle = item.type === 'article';
  const showArticleTypeBadge = isArticle && item.articleType;
  const badgeLabel = showArticleTypeBadge ? getArticleTypeLabel(item.articleType) : '';
  const badgeColor = showArticleTypeBadge ? getArticleTypeBadgeColor(item.articleType) : '';

  return (
    <Link href={href}>
      <div className="bg-[#f3f1ef] dark:bg-[#171b22] rounded-[20px] p-2 overflow-hidden hover:shadow-md dark:hover:shadow-none transition-shadow cursor-pointer">
        {/* Cover Image */}
        <div className="relative h-[220px] rounded-[20px] overflow-hidden">
          <Image
            src={item.coverImageUrl}
            alt={item.title}
            fill
            className="object-cover"
          />
          
          {/* Article Type Badge - Top Left */}
          {showArticleTypeBadge && (
            <div className={`absolute top-2 left-2 ${badgeColor} backdrop-blur-sm rounded-full px-3 py-1 flex items-center justify-center`}>
              <span className="font-sans text-xs font-medium text-white leading-none">
                {badgeLabel}
              </span>
            </div>
          )}
          
          {/* Course badge - show "Course" for courses */}
          {!isArticle && (
            <div className="absolute top-2 left-2 bg-earth-500/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center justify-center">
              <span className="font-sans text-xs font-medium text-white leading-none">
                Course
              </span>
            </div>
          )}
          
          {/* Year badge */}
          {item.year && (
            <div className="absolute bottom-5 right-5 bg-black/35 px-2 py-1 rounded-[20px]">
              <span className="font-sans text-xs text-text-muted dark:text-[#b2b6c2] leading-[1.2]">
                {item.year}
              </span>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="px-4 py-2 flex flex-col gap-2">
          <h3 className="font-albert font-semibold text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
            {item.title}
          </h3>
          <p className="font-sans text-base text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.2]">
            {item.subtitle}
          </p>
        </div>
      </div>
    </Link>
  );
}

