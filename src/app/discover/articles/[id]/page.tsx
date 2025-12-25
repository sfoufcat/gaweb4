'use client';

import { use, useState, useEffect } from 'react';
import Image from 'next/image';
import { useArticle } from '@/hooks/useDiscover';
import { BackButton, ShareButton, RichContent } from '@/components/discover';
import { User } from 'lucide-react';

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

export default function ArticleDetailPage({ params }: ArticlePageProps) {
  const { id } = use(params);
  const { article, loading } = useArticle(id);
  const [authorProfile, setAuthorProfile] = useState<AuthorProfile | null>(null);
  const [authorLoading, setAuthorLoading] = useState(false);

  // Fetch author profile dynamically if authorId is available
  useEffect(() => {
    if (article?.authorId) {
      setAuthorLoading(true);
      fetch(`/api/user/${article.authorId}`)
        .then(res => res.json())
        .then(data => {
          if (data.exists && data.user) {
            setAuthorProfile(data.user);
          }
        })
        .catch(err => {
          console.error('Failed to fetch author profile:', err);
        })
        .finally(() => {
          setAuthorLoading(false);
        });
    }
  }, [article?.authorId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="text-text-secondary">Article not found</div>
      </div>
    );
  }

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
      {/* Header Section */}
      <section className="px-4 py-5">
        <div className="flex flex-col gap-3">
          {/* Navigation Row */}
          <div className="flex items-center justify-between">
            <BackButton />
            <ShareButton title={article.title} />
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
              <div className="w-12 h-12 rounded-full bg-[#a07855] flex items-center justify-center">
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
        </div>
      </section>
    </div>
  );
}

