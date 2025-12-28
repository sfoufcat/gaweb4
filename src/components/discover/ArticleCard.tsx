'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { DiscoverArticle } from '@/types/discover';
import { AddToContentButton } from './AddToContentButton';
import { ContentPurchaseSheet } from './ContentPurchaseSheet';

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
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);
  
  const badgeLabel = getArticleTypeLabel(article.articleType);
  const badgeColor = getArticleTypeBadgeColor(article.articleType);
  // Use thumbnail for cards if available, fallback to cover image
  const cardImageUrl = article.thumbnailUrl || article.coverImageUrl;
  const isFree = !article.priceInCents || article.priceInCents === 0;

  // Card content component to avoid duplication
  const CardContent = ({ isGrid }: { isGrid: boolean }) => (
    <>
      {/* Cover Image */}
      <div className={`relative ${isGrid ? 'h-[140px]' : 'h-[120px]'} w-full bg-earth-100 dark:bg-[#262b35]`}>
        {cardImageUrl ? (
          <Image
            src={cardImageUrl}
            alt={article.title}
            fill
            className="object-cover"
            sizes={isGrid ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" : "220px"}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className={`${isGrid ? 'w-10 h-10' : 'w-8 h-8'} text-earth-300 dark:text-[#7d8190]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
        )}
        
        {/* Type badge */}
        {badgeLabel && (
          <div className={`absolute ${isGrid ? 'top-3 left-3' : 'top-2 left-2'} ${badgeColor} backdrop-blur-sm rounded-full ${isGrid ? 'px-2.5 py-1' : 'px-2 py-0.5'} flex items-center justify-center`}>
            <span className={`font-sans ${isGrid ? 'text-[11px]' : 'text-[10px]'} font-medium text-white leading-none`}>
              {badgeLabel}
            </span>
          </div>
        )}

        {/* Add to Content button - only for free content */}
        {isFree && (
          <AddToContentButton
            contentType="article"
            contentId={article.id}
            priceInCents={article.priceInCents}
            compact
            className={`absolute ${isGrid ? 'top-3 right-3' : 'top-2 right-2'}`}
          />
        )}
      </div>
      
      {/* Content */}
      <div className={isGrid ? 'p-4 flex flex-col gap-2 flex-1' : 'p-3 flex flex-col gap-1.5'}>
        <h3 className={`font-albert font-semibold ${isGrid ? 'text-base' : 'text-sm'} text-text-primary dark:text-[#f5f5f8] ${isGrid ? 'tracking-[-0.5px]' : 'tracking-[-0.3px]'} leading-[1.3] line-clamp-2`}>
          {article.title}
        </h3>
        <p className={`font-sans ${isGrid ? 'text-sm mt-auto' : 'text-xs'} text-text-muted dark:text-[#7d8190]`}>
          {article.authorName}
          {article.readingTimeMinutes && ` · ${article.readingTimeMinutes} min`}
        </p>
      </div>
    </>
  );

  // For paid content, render a clickable div that opens the purchase sheet
  if (!isFree) {
    if (variant === 'grid') {
      return (
        <>
          <div 
            onClick={() => setShowPurchaseSheet(true)}
            className="bg-white/70 dark:bg-[#171b22] rounded-[20px] overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer h-full flex flex-col"
          >
            <CardContent isGrid={true} />
          </div>
          
          <ContentPurchaseSheet
            open={showPurchaseSheet}
            onOpenChange={setShowPurchaseSheet}
            content={{
              id: article.id,
              type: 'article',
              title: article.title,
              description: article.content?.replace(/<[^>]*>/g, '').substring(0, 200),
              coverImageUrl: article.coverImageUrl,
              priceInCents: article.priceInCents || 0,
              currency: article.currency,
              coachName: article.authorName,
            }}
          />
        </>
      );
    }

    // Horizontal scroll variant
    return (
      <>
        <div 
          onClick={() => setShowPurchaseSheet(true)}
          className="bg-white/70 dark:bg-[#171b22] rounded-[20px] w-[220px] flex-shrink-0 overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer"
        >
          <CardContent isGrid={false} />
        </div>
        
        <ContentPurchaseSheet
          open={showPurchaseSheet}
          onOpenChange={setShowPurchaseSheet}
          content={{
            id: article.id,
            type: 'article',
            title: article.title,
            description: article.content?.replace(/<[^>]*>/g, '').substring(0, 200),
            coverImageUrl: article.coverImageUrl,
            priceInCents: article.priceInCents || 0,
            currency: article.currency,
            coachName: article.authorName,
          }}
        />
      </>
    );
  }

  // For free content, use Link for direct navigation
  if (variant === 'grid') {
    return (
      <Link href={`/discover/articles/${article.id}`}>
        <div className="bg-white/70 dark:bg-[#171b22] rounded-[20px] overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer h-full flex flex-col">
          <CardContent isGrid={true} />
        </div>
      </Link>
    );
  }

  // Horizontal scroll variant for free content
  return (
    <Link href={`/discover/articles/${article.id}`}>
      <div className="bg-white/70 dark:bg-[#171b22] rounded-[20px] w-[220px] flex-shrink-0 overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer">
        <CardContent isGrid={false} />
      </div>
    </Link>
  );
}
