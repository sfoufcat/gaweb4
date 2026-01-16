'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { BackButton, CopyLinkButton, AddToContentButton, RichContent, ContentLandingPage, ContentPurchaseSheet } from '@/components/discover';
import { Button } from '@/components/ui/button';
import { User, AlertCircle, CheckCircle, BookOpen, RotateCcw } from 'lucide-react';
import type { DiscoverArticle } from '@/types/discover';
import { useSingleContentProgress } from '@/hooks/useContentProgress';

interface ArticlePageProps {
  params: Promise<{ id: string }>;
}

interface AuthorProfile {
  name?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  avatarUrl?: string;
  bio?: string;
  profession?: string;
}

interface ArticleDetailData {
  article: DiscoverArticle & { coachName?: string; coachImageUrl?: string };
  isOwned: boolean;
  includedInProgramName?: string;
}

export default function ArticleDetailPage({ params }: ArticlePageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  
  const [data, setData] = useState<ArticleDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorProfile, setAuthorProfile] = useState<AuthorProfile | null>(null);
  const [authorLoading, setAuthorLoading] = useState(false);
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);
  
  const justPurchased = searchParams.get('purchased') === 'true';

  // Fetch article data
  const fetchArticle = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/discover/articles/${id}`);
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Article not found');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching article:', err);
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  // Fetch author profile dynamically if authorId is available
  useEffect(() => {
    if (data?.article?.authorId) {
      setAuthorLoading(true);
      fetch(`/api/user/${data.article.authorId}`)
        .then(res => res.json())
        .then(result => {
          if (result.exists && result.user) {
            setAuthorProfile(result.user);
          }
        })
        .catch(err => {
          console.error('Failed to fetch author profile:', err);
        })
        .finally(() => {
          setAuthorLoading(false);
        });
    }
  }, [data?.article?.authorId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] pb-24 lg:pb-8">
        {/* Header Section Skeleton */}
        <section className="px-4 py-5">
          <div className="flex flex-col gap-3">
            {/* Navigation Row */}
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
                <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
              </div>
            </div>

            {/* Cover Image Skeleton */}
            <div className="h-[220px] rounded-[20px] bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
          </div>
        </section>

        {/* Content Section Skeleton */}
        <section className="px-4 pt-3 pb-6">
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="h-8 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
            
            {/* Meta info */}
            <div className="flex items-center gap-3">
              <div className="h-4 w-20 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-4 w-16 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
            </div>

            {/* Article Content Skeleton */}
            <div className="space-y-3">
              <div className="h-4 w-full bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-4 w-full bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-4 w-5/6 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-4 w-full bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-4 w-4/6 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
            </div>

            {/* Author Section Skeleton */}
            <div className="flex flex-col gap-3 pt-4 border-t border-earth-200 dark:border-[#262b35]">
              <div className="h-7 w-20 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
              <div className="w-12 h-12 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
              <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
              <div className="h-4 w-24 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen px-4 py-8 bg-[#faf8f6] dark:bg-[#05070b]">
        <BackButton />
        <div className="text-center mt-12">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary font-albert mb-2">
            {error || 'Article not found'}
          </h2>
          <Button
            onClick={() => router.push('/discover')}
            className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white"
          >
            Back to Discover
          </Button>
        </div>
      </div>
    );
  }

  const { article, isOwned, includedInProgramName } = data;

  // If user owns this content or it's free, show full article content
  if (isOwned || justPurchased || !article.priceInCents || article.priceInCents === 0) {
    return (
      <ArticleContent 
        article={article}
        authorProfile={authorProfile}
        authorLoading={authorLoading}
        justPurchased={justPurchased}
        includedInProgramName={includedInProgramName}
        id={id}
      />
    );
  }

  // Show landing page for paid content
  if (article.purchaseType === 'landing_page') {
    return (
      <ContentLandingPage
        content={{
          id: article.id,
          type: 'article',
          title: article.title,
          description: article.content?.substring(0, 200) + '...',
          coverImageUrl: article.coverImageUrl,
          priceInCents: article.priceInCents || 0,
          currency: article.currency,
          coachName: article.coachName || article.authorName,
          coachImageUrl: article.coachImageUrl || article.authorAvatarUrl,
          coachBio: article.authorBio,
          keyOutcomes: article.keyOutcomes,
          features: article.features,
          testimonials: article.testimonials,
          faqs: article.faqs,
        }}
        isOwned={isOwned}
        includedInProgramName={includedInProgramName}
        onAccessContent={() => window.location.reload()}
      />
    );
  }

  // Default: Show simple purchase view (popup style)
  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] pb-24 lg:pb-8">
      {/* Header */}
      <section className="px-4 py-5">
        <BackButton />
      </section>

      {/* Article Preview */}
      <section className="px-4">
        <div className="bg-white dark:bg-[#171b22] rounded-3xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
          {/* Cover Image */}
          {article.coverImageUrl && (
            <div className="relative h-[180px] rounded-2xl overflow-hidden mb-4">
              <Image
                src={article.coverImageUrl}
                alt={article.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          <h1 className="font-albert text-[24px] font-semibold text-text-primary tracking-[-1px] mb-2">
            {article.title}
          </h1>
          
          {/* Meta info */}
          {(article.readingTimeMinutes || article.category) && (
            <div className="flex items-center gap-3 text-text-muted text-sm mb-4">
              {article.readingTimeMinutes && (
                <span>{article.readingTimeMinutes} min read</span>
              )}
              {article.readingTimeMinutes && article.category && (
                <span>•</span>
              )}
              {article.category && (
                <span>{article.category}</span>
              )}
            </div>
          )}

          {/* Preview of content */}
          <p className="font-albert text-[15px] text-text-secondary leading-[1.6] mb-4 line-clamp-3">
            {article.content?.replace(/<[^>]*>/g, '').substring(0, 200)}...
          </p>

          {article.authorName && (
            <p className="text-sm text-text-muted mb-4">
              By {article.authorName}
            </p>
          )}

          <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold text-text-primary">
                ${((article.priceInCents || 0) / 100).toFixed(2)}
              </span>
              <span className="text-sm text-text-secondary">one-time</span>
            </div>

            <Button
              onClick={() => {
                if (!isSignedIn) {
                  router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname)}`);
                  return;
                }
                setShowPurchaseSheet(true);
              }}
              className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold rounded-xl"
            >
              {!isSignedIn ? 'Sign in to purchase' : 'Purchase Article'}
            </Button>
          </div>
        </div>
      </section>

      {/* Purchase Sheet */}
      <ContentPurchaseSheet
        open={showPurchaseSheet}
        onOpenChange={setShowPurchaseSheet}
        content={{
          id: article.id,
          type: 'article',
          title: article.title,
          description: article.content,
          coverImageUrl: article.coverImageUrl,
          priceInCents: article.priceInCents || 0,
          currency: article.currency,
          coachName: article.coachName || article.authorName,
          coachImageUrl: article.coachImageUrl || article.authorAvatarUrl,
        }}
        onPurchaseComplete={() => {
          // Refetch to get updated access
          fetchArticle();
        }}
      />
    </div>
  );
}

// Extracted component for full article content (when user has access)
function ArticleContent({
  article,
  authorProfile,
  authorLoading,
  justPurchased,
  includedInProgramName,
  id,
}: {
  article: DiscoverArticle & { coachName?: string; coachImageUrl?: string };
  authorProfile: AuthorProfile | null;
  authorLoading: boolean;
  justPurchased: boolean;
  includedInProgramName?: string;
  id: string;
}) {
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  // Content progress tracking
  const {
    isCompleted,
    completionCount,
    markComplete,
  } = useSingleContentProgress('article', id);

  // Handle marking article as read
  const handleMarkAsRead = async () => {
    setIsMarkingRead(true);
    try {
      await markComplete({
        contentType: 'article',
        contentId: id,
      });
    } catch (err) {
      console.error('Failed to mark article as read:', err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  // Format publication date
  const formatPublishedDate = () => {
    const date = new Date(article.publishedAt);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Use dynamic author data if available, otherwise fall back to static fields
  const authorAvatarUrl = authorProfile?.avatarUrl || authorProfile?.imageUrl || article.authorAvatarUrl;
  const authorBio = authorProfile?.bio || article.authorBio;
  const authorName = article.authorName; // Keep using the stored name for consistency

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      {/* Success message if just purchased */}
      {justPurchased && (
        <section className="px-4 pt-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold font-albert text-[14px]">
                Purchase successful! Enjoy your article.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Header Section */}
      <section className="px-4 py-5">
        <div className="flex flex-col gap-3">
          {/* Navigation Row */}
          <div className="flex items-center justify-between">
            <BackButton />
            <div className="flex items-center gap-2">
              {/* Completion badge */}
              {isCompleted && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  <span>{completionCount > 1 ? `Read ${completionCount}x` : 'Read'}</span>
                </div>
              )}
              <AddToContentButton
                contentType="article"
                contentId={id}
                priceInCents={article.priceInCents}
              />
              <CopyLinkButton />
            </div>
          </div>

          {/* Cover Image */}
          <div className="relative h-[220px] rounded-[20px] overflow-hidden">
            <Image
              src={article.coverImageUrl}
              alt={article.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="px-4 pt-3 pb-6">
        <div className="flex flex-col gap-4">
          {/* Title */}
          <h1 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
            {article.title}
          </h1>

          {/* Meta info */}
          {(article.readingTimeMinutes || article.category) && (
            <div className="flex items-center gap-3 text-text-muted text-sm">
              {article.readingTimeMinutes && (
                <span>{article.readingTimeMinutes} min read</span>
              )}
              {article.readingTimeMinutes && article.category && (
                <span>•</span>
              )}
              {article.category && (
                <span>{article.category}</span>
              )}
            </div>
          )}

          {includedInProgramName && (
            <p className="text-sm text-text-muted">
              Included in {includedInProgramName}
            </p>
          )}

          {/* Article Content */}
          <RichContent 
            content={article.content} 
            className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.5]"
          />

          {/* Author Section */}
          <div className="flex flex-col gap-3 pt-4 border-t border-earth-200">
            <h2 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
              Author
            </h2>
            
            {/* Author Avatar - Dynamic or fallback */}
            {authorLoading ? (
              <div className="w-12 h-12 rounded-full bg-earth-100 dark:bg-[#262b35] animate-pulse" />
            ) : authorAvatarUrl ? (
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image
                  src={authorAvatarUrl}
                  alt={authorName}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
            
            {/* Author Name & Title */}
            <h3 className="font-albert font-semibold text-lg text-text-primary tracking-[-1px] leading-[1.3]">
              {authorName}{article.authorTitle ? `, ${article.authorTitle}` : ''}
            </h3>
            
            {/* Author Bio - Dynamic */}
            {authorLoading ? (
              <div className="h-12 bg-earth-100 dark:bg-[#262b35] rounded animate-pulse" />
            ) : authorBio ? (
              <p className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]">
                {authorBio}
              </p>
            ) : null}
            
            {/* Published Date */}
            <p className="font-sans text-sm text-text-muted leading-[1.2]">
              Published {formatPublishedDate()}
            </p>
          </div>

          {/* Mark as Read Section */}
          <div className="pt-6 border-t border-earth-200 dark:border-[#262b35]">
            {isCompleted ? (
              <Button
                onClick={handleMarkAsRead}
                disabled={isMarkingRead}
                variant="outline"
                className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border-earth-300 dark:border-[#3a4150] text-text-secondary hover:bg-earth-50 dark:hover:bg-[#1d222b]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isMarkingRead ? 'Marking...' : 'Read Again'}</span>
              </Button>
            ) : (
              <Button
                onClick={handleMarkAsRead}
                disabled={isMarkingRead}
                className="w-full py-3 flex items-center justify-center gap-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl"
              >
                <BookOpen className="w-4 h-4" />
                <span>{isMarkingRead ? 'Marking...' : 'Mark as Read'}</span>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
