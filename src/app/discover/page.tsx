'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useDiscover } from '@/hooks/useDiscover';
import { 
  EventCard, 
  CourseCard, 
  ProgramCard,
  CategoryPills, 
  TrendingItem, 
  RecommendedCard,
  SectionHeader,
  ArticleCard,
} from '@/components/discover';
import type { ArticleType } from '@/types/discover';

export default function DiscoverPage() {
  const { upcomingEvents, pastEvents, courses, articles, categories, trending, recommended, groupPrograms, individualPrograms, enrollmentConstraints, loading } = useDiscover();
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticleType, setSelectedArticleType] = useState<ArticleType | 'all'>('all');

  // Filter out programs where user is already enrolled
  const availableGroupPrograms = useMemo(() => {
    return groupPrograms.filter(p => !p.userEnrollment);
  }, [groupPrograms]);

  const availableIndividualPrograms = useMemo(() => {
    return individualPrograms.filter(p => !p.userEnrollment);
  }, [individualPrograms]);

  // Get selected category name for filtering
  const selectedCategoryName = useMemo(() => {
    if (!selectedCategory) return null;
    return categories.find(c => c.id === selectedCategory)?.name || null;
  }, [selectedCategory, categories]);

  // Filter events based on showing past/upcoming
  const filteredEvents = useMemo(() => {
    return showPastEvents ? pastEvents : upcomingEvents;
  }, [upcomingEvents, pastEvents, showPastEvents]);

  // Filter courses based on selected category
  const filteredCourses = useMemo(() => {
    if (!selectedCategoryName) return courses;
    return courses.filter(c => c.category === selectedCategoryName);
  }, [courses, selectedCategoryName]);

  // Filter articles based on selected category
  const filteredArticles = useMemo(() => {
    if (!selectedCategoryName) return articles;
    return articles.filter(a => a.category === selectedCategoryName);
  }, [articles, selectedCategoryName]);

  // Filter "All Articles" section by article type (only this section is affected)
  const allArticlesFiltered = useMemo(() => {
    let result = filteredArticles;
    if (selectedArticleType !== 'all') {
      result = result.filter(a => a.articleType === selectedArticleType);
    }
    return result;
  }, [filteredArticles, selectedArticleType]);

  // Limit to 10 articles for the "All Articles" section
  const allArticlesDisplay = useMemo(() => {
    return allArticlesFiltered.slice(0, 10);
  }, [allArticlesFiltered]);

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
        <section className="px-4 pt-5 pb-8">
          <div className="h-10 w-32 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
        </section>

        {/* Events Section Skeleton */}
        <section className="px-4 py-5 overflow-hidden">
          <div className="flex flex-col gap-4">
            <div className="h-6 w-40 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-[280px] h-[160px] flex-shrink-0 bg-white/60 dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35] rounded-[20px] animate-pulse"
                >
                  <div className="h-full p-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-20 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg" />
                      <div className="h-5 w-full bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg" />
                    </div>
                    <div className="h-4 w-24 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Categories Skeleton */}
        <section className="px-4 py-5">
          <div className="flex flex-col gap-4">
            <div className="h-6 w-44 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-9 w-24 bg-[#e1ddd8]/40 dark:bg-[#222631] rounded-full animate-pulse"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Courses Skeleton */}
        <section className="px-4 py-5 overflow-hidden">
          <div className="flex flex-col gap-4">
            <div className="h-6 w-24 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-[160px] flex-shrink-0 animate-pulse"
                >
                  <div className="h-[120px] bg-[#e1ddd8]/40 dark:bg-[#222631] rounded-[20px] mb-2" />
                  <div className="h-4 w-full bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg mb-1" />
                  <div className="h-3 w-20 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trending Skeleton */}
        <section className="px-4 py-5 overflow-hidden">
          <div className="flex flex-col gap-4">
            <div className="h-6 w-28 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white/60 dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35] rounded-[20px] p-3 w-[260px] flex-shrink-0 animate-pulse"
                >
                  <div className="w-8 h-8 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-full bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg" />
                    <div className="h-3 w-16 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      {/* Header */}
      <section className="px-4 pt-5 pb-4">
        <h1 className="font-albert font-normal text-4xl text-text-primary tracking-[-2px] leading-[1.2]">
          {selectedCategoryName || 'Discover'}
        </h1>
      </section>

      {/* 1. Group Programs - TOP PRIORITY - Only show when no category is selected */}
      {!selectedCategory && availableGroupPrograms.length > 0 && (
        <section className="px-4 py-5 overflow-hidden">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionHeader title="Group Programs" />
              {!enrollmentConstraints.canEnrollInGroup && (
                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                  Active program in progress
                </span>
              )}
            </div>
            
            {/* Horizontal scrollable list */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {availableGroupPrograms.map((program) => (
                <ProgramCard key={program.id} program={program} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. 1:1 Programs - Only show when no category is selected */}
      {!selectedCategory && availableIndividualPrograms.length > 0 && (
        <section className="px-4 py-5 overflow-hidden">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionHeader title="1:1 Coaching Programs" />
              {!enrollmentConstraints.canEnrollInIndividual && (
                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                  Active coaching in progress
                </span>
              )}
            </div>
            
            {/* Horizontal scrollable list */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {availableIndividualPrograms.map((program) => (
                <ProgramCard key={program.id} program={program} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. Browse by Category */}
      <section className="px-4 py-5">
        <div className="flex flex-col gap-4">
          <SectionHeader title="Browse by category" />
          <CategoryPills 
            categories={categories} 
            selectedCategory={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
      </section>

      {/* 4. Events Section - Only show when no category is selected */}
      {!selectedCategory && (
        <section className="px-4 py-5 overflow-hidden">
          <div className="flex flex-col gap-4">
            {/* Header with toggle */}
            <div className="flex items-center gap-2">
              <SectionHeader title={showPastEvents ? "Past events" : "Upcoming events"} />
              {pastEvents.length > 0 && (
                <button
                  onClick={() => setShowPastEvents(!showPastEvents)}
                  className="text-xs text-earth-500 hover:text-earth-600 font-normal font-sans transition-colors whitespace-nowrap"
                >
                  {showPastEvents ? "view upcoming" : "view past"}
                </button>
              )}
            </div>
            
            {/* Horizontal scrollable list */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((event) => (
                  <EventCard key={event.id} event={event} isPast={showPastEvents} />
                ))
              ) : (
                <p className="text-text-muted text-sm font-sans">
                  No events available
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 5. Courses */}
      {filteredCourses.length > 0 && (
        <section className="px-4 py-5 overflow-hidden">
          <div className="flex flex-col gap-4">
            <SectionHeader title="Courses" />
            
            {/* Grid when category selected, horizontal scroll otherwise */}
            {selectedCategory ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {filteredCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Articles - Only show when category is selected (filtered list view) */}
      {selectedCategory && filteredArticles.length > 0 && (
        <section className="px-4 py-5">
          <div className="flex flex-col gap-4">
            <SectionHeader title="Articles" />
            
            <div className="flex flex-col gap-3">
              {filteredArticles.map((article) => (
                <Link 
                  key={article.id}
                  href={`/discover/articles/${article.id}`}
                  className="block"
                >
                  <div className="bg-white/70 rounded-[20px] p-4 hover:shadow-md transition-shadow">
                    <div className="flex gap-4">
                      {/* Cover Image */}
                      {article.coverImageUrl && (
                        <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-earth-100">
                          <Image 
                            src={article.coverImageUrl} 
                            alt={article.title}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-albert font-semibold text-lg text-text-primary tracking-[-0.5px] leading-[1.3] line-clamp-2 mb-1">
                          {article.title}
                        </h3>
                        <p className="font-sans text-sm text-text-muted">
                          {article.authorName}
                          {article.readingTimeMinutes && ` · ${article.readingTimeMinutes} min read`}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state when category selected but no content */}
      {selectedCategory && filteredCourses.length === 0 && filteredArticles.length === 0 && (
        <section className="px-4 py-12">
          <div className="text-center">
            <p className="text-text-muted font-sans">
              No content available in this category yet.
            </p>
          </div>
        </section>
      )}

      {/* ARTICLES SECTION - Only when no category selected */}
      {!selectedCategory && (trending.length > 0 || recommended.length > 0 || articles.length > 0) && (
        <section className="px-4 py-5">
          <div className="flex flex-col gap-6">
            {/* Articles Header */}
            <h2 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
              Articles
            </h2>

            {/* Browse by Type Filter */}
            <div className="flex flex-col gap-2">
              <span className="font-sans text-sm text-text-secondary dark:text-[#b2b6c2]">Browse by Type</span>
              <div className="flex gap-2 flex-wrap">
                {articleTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedArticleType(option.value)}
                    className={`px-4 py-2 rounded-full text-sm font-sans transition-all ${
                      selectedArticleType === option.value
                        ? 'bg-earth-600 dark:bg-[#b8896a] text-white'
                        : 'bg-white/70 dark:bg-[#1e222a] text-text-secondary dark:text-[#b2b6c2] hover:bg-white dark:hover:bg-[#262b35] hover:text-text-primary dark:hover:text-[#f5f5f8] border border-[#e1ddd8]/50 dark:border-[#262b35]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* All Articles Section (Filtered by Type) */}
            {filteredArticles.length > 0 && (
              <div className="flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h3 className="font-albert font-medium text-lg text-text-primary tracking-[-0.5px] leading-[1.3]">
                    All Articles
                  </h3>
                  <Link 
                    href={`/articles${selectedArticleType !== 'all' ? `?type=${selectedArticleType}` : ''}`}
                    className="font-sans text-sm text-earth-600 hover:text-earth-700 font-medium transition-colors"
                  >
                    View More →
                  </Link>
                </div>
                
                {/* Horizontal scrollable list */}
                {allArticlesDisplay.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {allArticlesDisplay.map((article) => (
                      <ArticleCard key={article.id} article={article} variant="horizontal" />
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted text-sm font-sans py-2">
                    No articles found for this type.
                  </p>
                )}
              </div>
            )}

            {/* Trending Subheading */}
            {trending.length > 0 && (
              <div className="flex flex-col gap-3 overflow-hidden">
                <h3 className="font-albert font-medium text-lg text-text-primary tracking-[-0.5px] leading-[1.3]">
                  Trending
                </h3>
                
                {/* Horizontal scrollable list */}
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                  {trending.map((item, index) => (
                    <TrendingItem key={item.id} item={item} index={index} />
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Subheading */}
            {recommended.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="font-albert font-medium text-lg text-text-primary tracking-[-0.5px] leading-[1.3]">
                  Recommended
                </h3>
                
                {/* Vertical list of recommended cards */}
                <div className="flex flex-col gap-3">
                  {recommended.map((item) => (
                    <RecommendedCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
