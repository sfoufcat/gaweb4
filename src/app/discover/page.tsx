'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useDiscover } from '@/hooks/useDiscover';
import { useMyContent } from '@/hooks/useDiscoverData';
import { 
  EventCard, 
  CourseCard, 
  ProgramCard,
  CategoryPills, 
  ProgramTypePills,
  BrowseMyContentPills,
  MyContentTypePills,
  TrendingItem, 
  RecommendedCard,
  SectionHeader,
  ArticleCard,
  SquadCard,
} from '@/components/discover';
import type { ProgramType, DiscoverViewMode, MyContentFilter } from '@/components/discover';
import { FileText, BookOpen, Calendar, Download, Link as LinkIcon, Users, Layers } from 'lucide-react';
import { useMenuTitles } from '@/contexts/BrandingContext';

export default function DiscoverPage() {
  const { upcomingEvents, pastEvents, courses, articles, categories, trending, recommended, groupPrograms, individualPrograms, enrollmentConstraints, publicSquads, loading } = useDiscover();
  const { myContent, totalCount: myContentCount, counts: myContentCounts, loading: myContentLoading } = useMyContent();
  const { program: programTitle, squad: squadTitle } = useMenuTitles();
  const [viewMode, setViewMode] = useState<DiscoverViewMode>('browse');
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProgramType, setSelectedProgramType] = useState<ProgramType>('group');
  const [myContentFilter, setMyContentFilter] = useState<MyContentFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [myContentFilter]);

  // Filter out programs where user is already enrolled
  const availableGroupPrograms = useMemo(() => {
    return groupPrograms.filter(p => !p.userEnrollment);
  }, [groupPrograms]);

  const availableIndividualPrograms = useMemo(() => {
    return individualPrograms.filter(p => !p.userEnrollment);
  }, [individualPrograms]);

  // Build sets of owned article, course, and event IDs for filtering
  const ownedContentIds = useMemo(() => {
    const articleIds = new Set<string>();
    const courseIds = new Set<string>();
    const eventIds = new Set<string>();
    
    myContent.forEach((item) => {
      if (item.contentType === 'article') {
        articleIds.add(item.contentId);
      } else if (item.contentType === 'course') {
        courseIds.add(item.contentId);
      } else if (item.contentType === 'event') {
        eventIds.add(item.contentId);
      }
    });
    
    return { articleIds, courseIds, eventIds };
  }, [myContent]);

  // Filter out owned articles from browse view
  const availableArticles = useMemo(() => {
    return articles.filter(a => !ownedContentIds.articleIds.has(a.id));
  }, [articles, ownedContentIds.articleIds]);

  // Filter out owned courses from browse view
  const availableCourses = useMemo(() => {
    return courses.filter(c => !ownedContentIds.courseIds.has(c.id));
  }, [courses, ownedContentIds.courseIds]);

  // Filter out owned events from browse view
  const availableUpcomingEvents = useMemo(() => {
    return upcomingEvents.filter(e => !ownedContentIds.eventIds.has(e.id));
  }, [upcomingEvents, ownedContentIds.eventIds]);

  const availablePastEvents = useMemo(() => {
    return pastEvents.filter(e => !ownedContentIds.eventIds.has(e.id));
  }, [pastEvents, ownedContentIds.eventIds]);

  // Get selected category name for filtering
  const selectedCategoryName = useMemo(() => {
    if (!selectedCategory) return null;
    return categories.find(c => c.id === selectedCategory)?.name || null;
  }, [selectedCategory, categories]);

  // Filter events based on showing past/upcoming (using available/non-owned events)
  const filteredEvents = useMemo(() => {
    return showPastEvents ? availablePastEvents : availableUpcomingEvents;
  }, [availableUpcomingEvents, availablePastEvents, showPastEvents]);

  // Filter courses based on selected category (using available/non-owned courses)
  const filteredCourses = useMemo(() => {
    if (!selectedCategoryName) return availableCourses;
    return availableCourses.filter(c => c.category === selectedCategoryName);
  }, [availableCourses, selectedCategoryName]);

  // Filter articles based on selected category (using available/non-owned articles)
  const filteredArticles = useMemo(() => {
    if (!selectedCategoryName) return availableArticles;
    return availableArticles.filter(a => a.category === selectedCategoryName);
  }, [availableArticles, selectedCategoryName]);

  // Limit articles display to 10 for the main section
  const articlesDisplay = useMemo(() => {
    return filteredArticles.slice(0, 10);
  }, [filteredArticles]);

  // Paginated My Content
  const filteredMyContent = useMemo(() => {
    return myContent.filter(item => 
      myContentFilter === 'all' || item.contentType === myContentFilter
    );
  }, [myContent, myContentFilter]);

  const totalPages = Math.ceil(filteredMyContent.length / ITEMS_PER_PAGE);
  
  const paginatedContent = useMemo(() => {
    return filteredMyContent.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredMyContent, currentPage, ITEMS_PER_PAGE]);

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

  // Get content type icon
  const getContentIcon = (type: string) => {
    switch (type) {
      case 'article': return FileText;
      case 'course': return BookOpen;
      case 'event': return Calendar;
      case 'download': return Download;
      case 'link': return LinkIcon;
      case 'program': return Layers;
      case 'squad': return Users;
      default: return FileText;
    }
  };

  // Get content type link
  const getContentLink = (type: string, id: string) => {
    switch (type) {
      case 'article': return `/discover/articles/${id}`;
      case 'course': return `/discover/courses/${id}`;
      case 'event': return `/discover/events/${id}`;
      case 'download': return `/discover/downloads/${id}`;
      case 'link': return `/discover/links/${id}`;
      case 'program': return `/program`;
      case 'squad': return `/squad`;
      default: return `/discover`;
    }
  };

  // Strip HTML tags from description
  const stripHtml = (html: string | undefined) => html?.replace(/<[^>]*>/g, '') || '';

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      {/* Header */}
      <section className="px-4 pt-5 pb-2">
        <h1 className="font-albert font-normal text-4xl text-text-primary tracking-[-2px] leading-[1.2]">
          {viewMode === 'my-content' ? 'My Content' : (selectedCategoryName || 'Discover')}
        </h1>
      </section>

      {/* Browse / My Content Toggle */}
      <section className="px-4 py-3">
        <BrowseMyContentPills
          selectedMode={viewMode}
          onSelect={setViewMode}
          myContentCount={myContentCount}
        />
      </section>

      {/* MY CONTENT VIEW */}
      {viewMode === 'my-content' && (
        <section className="px-4 py-4">
          {/* Content Type Filter Pills */}
          {!myContentLoading && myContent.length > 0 && (
            <div className="mb-4">
              <MyContentTypePills
                selectedFilter={myContentFilter}
                onSelect={setMyContentFilter}
                counts={myContentCounts}
                totalCount={myContentCount}
              />
            </div>
          )}

          {myContentLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/70 dark:bg-[#171b22] rounded-[20px] p-4 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl bg-[#e1ddd8]/50 dark:bg-[#262b35]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg" />
                      <div className="h-4 w-1/2 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : myContent.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#e1ddd8]/30 dark:bg-[#262b35] flex items-center justify-center">
                <Layers className="w-8 h-8 text-text-muted" />
              </div>
              <h3 className="font-albert font-medium text-lg text-text-primary mb-2">
                No content yet
              </h3>
              <p className="font-sans text-sm text-text-muted max-w-xs mx-auto">
                Purchased content, programs, and squad memberships will appear here.
              </p>
              <button
                onClick={() => setViewMode('browse')}
                className="mt-4 px-4 py-2 bg-earth-500 text-white rounded-full font-sans text-sm hover:bg-earth-600 transition-colors"
              >
                Browse Content
              </button>
            </div>
          ) : filteredMyContent.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-muted font-sans text-sm">
                No {myContentFilter}s in your content library yet.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {paginatedContent.map((item) => {
                const Icon = getContentIcon(item.contentType);
                return (
                  <Link
                    key={`${item.contentType}-${item.contentId}`}
                    href={getContentLink(item.contentType, item.contentId)}
                    className="block"
                  >
                    <div className="bg-white/70 dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35] rounded-[20px] p-4 hover:shadow-md transition-shadow">
                      <div className="flex gap-4">
                        {/* Cover Image or Icon */}
                        {item.coverImageUrl || item.thumbnailUrl ? (
                          <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-earth-100 dark:bg-[#262b35]">
                            <Image
                              src={item.thumbnailUrl || item.coverImageUrl || ''}
                              alt={item.title}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 flex-shrink-0 rounded-xl bg-earth-100 dark:bg-[#262b35] flex items-center justify-center">
                            <Icon className="w-6 h-6 text-earth-500 dark:text-brand-accent" />
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-earth-100 dark:bg-[#262b35] text-earth-600 dark:text-brand-accent capitalize">
                              {item.contentType}
                            </span>
                            {item.includedInProgramName && (
                              <span className="text-xs text-text-muted">
                                via {item.includedInProgramName}
                              </span>
                            )}
                          </div>
                          <h3 className="font-albert font-semibold text-base text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3] line-clamp-1">
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="font-sans text-sm text-text-muted line-clamp-1 mt-0.5">
                              {stripHtml(item.description)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-[#e1ddd8]/30 dark:border-[#262b35]/50">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-full bg-earth-100 dark:bg-[#222631] text-text-primary dark:text-[#f5f5f8] font-sans text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-earth-200 dark:hover:bg-[#2a303d] transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-text-secondary dark:text-[#b2b6c2] font-sans px-3">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-full bg-earth-100 dark:bg-[#222631] text-text-primary dark:text-[#f5f5f8] font-sans text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-earth-200 dark:hover:bg-[#2a303d] transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* BROWSE VIEW */}
      {viewMode === 'browse' && (
        <>
          {/* 1. Programs Section with Pill Tabs - Only show when no category is selected */}
      {!selectedCategory && (availableGroupPrograms.length > 0 || availableIndividualPrograms.length > 0) && (
        <section className="px-4 py-5 overflow-hidden">
          <div className="flex flex-col gap-4">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <SectionHeader title={`${programTitle}s`} />
              {selectedProgramType === 'group' && !enrollmentConstraints.canEnrollInGroup && (
                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                  Active {programTitle.toLowerCase()} in progress
                </span>
              )}
              {selectedProgramType === 'individual' && !enrollmentConstraints.canEnrollInIndividual && (
                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                  Active coaching in progress
                </span>
              )}
            </div>

            {/* Pill Tabs */}
            <ProgramTypePills
              selectedType={selectedProgramType}
              onSelect={setSelectedProgramType}
              groupCount={availableGroupPrograms.length}
              individualCount={availableIndividualPrograms.length}
            />
            
            {/* Horizontal scrollable list based on selected type */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {selectedProgramType === 'group' ? (
                availableGroupPrograms.length > 0 ? (
                  availableGroupPrograms.map((program) => (
                    <ProgramCard key={program.id} program={program} fullWidth={false} />
                  ))
                ) : (
                  <p className="text-text-muted text-sm font-sans py-4">
                    No group {programTitle.toLowerCase()}s available at this time.
                  </p>
                )
              ) : (
                availableIndividualPrograms.length > 0 ? (
                  availableIndividualPrograms.map((program) => (
                    <ProgramCard key={program.id} program={program} fullWidth={false} />
                  ))
                ) : (
                  <p className="text-text-muted text-sm font-sans py-4">
                    No 1:1 coaching {programTitle.toLowerCase()}s available at this time.
                  </p>
                )
              )}
            </div>
          </div>
        </section>
      )}

      {/* 2. Public Squads Section - Only show when no category is selected */}
      {!selectedCategory && publicSquads.length > 0 && (
        <section className="px-4 py-5 overflow-hidden">
          <div className="flex flex-col gap-4">
            <SectionHeader title={`Public ${squadTitle}s`} />
            
            {/* Horizontal scrollable list */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {publicSquads.map((squad) => (
                <SquadCard key={squad.id} squad={squad} fullWidth={false} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. Content (Browse by Category) */}
      <section className="px-4 py-5">
        <div className="flex flex-col gap-4">
          <SectionHeader title="Content" />
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
              {availablePastEvents.length > 0 && (
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
      {!selectedCategory && (trending.length > 0 || recommended.length > 0 || availableArticles.length > 0) && (
        <section className="px-4 py-5">
          <div className="flex flex-col gap-6">
            {/* Articles Header with View More */}
            <div className="flex items-center justify-between">
              <h2 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
                Articles
              </h2>
              {articlesDisplay.length > 0 && (
                <Link 
                  href="/articles"
                  className="font-sans text-sm text-earth-600 hover:text-earth-700 font-medium transition-colors"
                >
                  View More →
                </Link>
              )}
            </div>

            {/* Articles List */}
            {articlesDisplay.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {articlesDisplay.map((article) => (
                  <ArticleCard key={article.id} article={article} variant="horizontal" />
                ))}
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
        </>
      )}
    </div>
  );
}
