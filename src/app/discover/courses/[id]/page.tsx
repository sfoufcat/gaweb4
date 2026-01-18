'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { BackButton, CopyLinkButton, AddToContentButton, RichContent, ContentLandingPage, ContentPurchaseSheet } from '@/components/discover';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, CheckCircle2 } from 'lucide-react';
import { useContentProgress } from '@/hooks/useContentProgress';
import type { DiscoverCourse } from '@/types/discover';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { CoachQuizModal } from '@/components/lp/CoachQuizModal';

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

interface CourseDetailData {
  course: DiscoverCourse & { coachName?: string; coachImageUrl?: string };
  isOwned: boolean;
  includedInProgramName?: string;
}

export default function CourseDetailPage({ params }: CoursePageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  const { isDemoMode } = useDemoMode();
  
  const [data, setData] = useState<CourseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);
  const [showCoachQuizModal, setShowCoachQuizModal] = useState(false);
  
  const justPurchased = searchParams.get('purchased') === 'true';

  // Fetch course data
  const fetchCourse = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/discover/courses/${id}`);
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Course not found');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching course:', err);
      setError(err instanceof Error ? err.message : 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

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

            {/* Course Info Skeleton */}
            <div className="flex flex-col gap-2">
              {/* Tags */}
              <div className="flex items-center gap-2">
                <div className="h-6 w-20 rounded-full bg-[#e1ddd8]/40 dark:bg-[#222631] animate-pulse" />
                <div className="h-6 w-16 rounded-full bg-[#e1ddd8]/40 dark:bg-[#222631] animate-pulse" />
              </div>
              {/* Title */}
              <div className="h-8 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
              {/* Description */}
              <div className="h-4 w-full bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-4 w-5/6 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
            </div>
          </div>
        </section>

        {/* Overview Section Skeleton */}
        <section className="px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="h-4 w-24 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
            <div className="h-4 w-20 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
            <div className="h-4 w-16 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
          </div>
        </section>

        {/* Modules Section Skeleton */}
        <section className="px-4 pt-3 pb-6">
          <div className="flex flex-col gap-4">
            <div className="h-7 w-36 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
            
            {/* Module Cards Skeleton */}
            {[1, 2].map((i) => (
              <div key={i} className="bg-white/60 dark:bg-[#171b22] rounded-[20px] overflow-hidden">
                <div className="p-4 border-b border-earth-100 dark:border-[#262b35]">
                  <div className="flex items-start gap-3">
                    <div className="h-4 w-6 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded animate-pulse" />
                    <div className="h-5 w-40 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
                  </div>
                </div>
                <div className="divide-y divide-earth-50 dark:divide-[#262b35]">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
                        <div className="h-4 w-32 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
                      </div>
                      <div className="h-4 w-12 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
            {error || 'Course not found'}
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

  const { course, isOwned, includedInProgramName } = data;

  // Calculate total lessons and duration
  const totalLessons = course.modules?.reduce((acc, module) => acc + module.lessons.length, 0) || 0;
  const totalDuration = course.modules?.reduce((acc, module) => 
    acc + module.lessons.reduce((lessonAcc, lesson) => lessonAcc + (lesson.durationMinutes || 0), 0), 
  0) || 0;

  // Format duration
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // If user owns this content or it's free, show full course content
  if (isOwned || justPurchased || !course.priceInCents || course.priceInCents === 0) {
    return (
      <CourseContent
        course={course}
        totalLessons={totalLessons}
        totalDuration={totalDuration}
        formatDuration={formatDuration}
        justPurchased={justPurchased}
        includedInProgramName={includedInProgramName}
        id={id}
        router={router}
      />
    );
  }

  // Show landing page for paid content
  if (course.purchaseType === 'landing_page') {
    return (
      <ContentLandingPage
        content={{
          id: course.id,
          type: 'course',
          title: course.title,
          description: course.shortDescription || course.longDescription,
          coverImageUrl: course.coverImageUrl,
          priceInCents: course.priceInCents || 0,
          currency: course.currency,
          coachName: course.coachName,
          coachImageUrl: course.coachImageUrl,
          keyOutcomes: course.keyOutcomes,
          features: course.features,
          testimonials: course.testimonials,
          faqs: course.faqs,
        }}
        isOwned={isOwned}
        includedInProgramName={includedInProgramName}
        onAccessContent={() => fetchCourse()}
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

      {/* Course Preview */}
      <section className="px-4">
        <div className="bg-white dark:bg-[#171b22] rounded-3xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
          {/* Cover Image */}
          {course.coverImageUrl && (
            <div className="relative h-[180px] rounded-2xl overflow-hidden mb-4">
              <Image
                src={course.coverImageUrl}
                alt={course.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          <h1 className="font-albert text-[24px] font-semibold text-text-primary tracking-[-1px] mb-2">
            {course.title}
          </h1>
          
          {/* Tags */}
          <div className="flex items-center gap-2 mb-3">
            {course.category && (
              <span className="px-3 py-1 bg-earth-100 dark:bg-[#222631] rounded-full font-sans text-xs text-earth-600 dark:text-brand-accent">
                {course.category}
              </span>
            )}
            {course.level && (
              <span className="px-3 py-1 bg-earth-100 dark:bg-[#222631] rounded-full font-sans text-xs text-earth-600 dark:text-brand-accent">
                {course.level}
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-text-secondary text-sm mb-4">
            {course.modules?.length > 0 && (
              <span>{course.modules.length} modules</span>
            )}
            {totalLessons > 0 && <span>{totalLessons} lessons</span>}
            {totalDuration > 0 && <span>{formatDuration(totalDuration)}</span>}
          </div>

          {/* Preview description */}
          {course.shortDescription && (
            <RichContent 
              content={course.shortDescription}
              className="font-albert text-[15px] text-text-secondary leading-[1.6] mb-4"
            />
          )}

          <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold text-text-primary">
                ${((course.priceInCents || 0) / 100).toFixed(2)}
              </span>
              <span className="text-sm text-text-secondary">one-time</span>
            </div>

            <Button
              onClick={() => {
                // In demo mode, open coach signup modal instead
                if (isDemoMode) {
                  setShowCoachQuizModal(true);
                  return;
                }
                if (!isSignedIn) {
                  router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname)}`);
                  return;
                }
                setShowPurchaseSheet(true);
              }}
              className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold rounded-xl"
            >
              {isDemoMode 
                ? `Enroll ($${((course.priceInCents || 0) / 100).toFixed(0)})`
                : !isSignedIn ? 'Sign in to purchase' : 'Purchase Course'}
            </Button>
          </div>
        </div>
      </section>

      {/* Purchase Sheet */}
      <ContentPurchaseSheet
        open={showPurchaseSheet}
        onOpenChange={setShowPurchaseSheet}
        content={{
          id: course.id,
          type: 'course',
          title: course.title,
          description: course.shortDescription || course.longDescription,
          coverImageUrl: course.coverImageUrl,
          priceInCents: course.priceInCents || 0,
          currency: course.currency,
          coachName: course.coachName,
          coachImageUrl: course.coachImageUrl,
        }}
        onPurchaseComplete={() => {
          // Refetch to get updated access
          fetchCourse();
        }}
      />

      {/* Coach Signup Modal for Demo Mode */}
      <CoachQuizModal
        isOpen={showCoachQuizModal}
        onClose={() => setShowCoachQuizModal(false)}
      />
    </div>
  );
}

// Extracted component for full course content (when user has access)
function CourseContent({
  course,
  totalLessons,
  totalDuration,
  formatDuration,
  justPurchased,
  includedInProgramName,
  id,
  router,
}: {
  course: DiscoverCourse & { coachName?: string; coachImageUrl?: string };
  totalLessons: number;
  totalDuration: number;
  formatDuration: (minutes: number) => string;
  justPurchased: boolean;
  includedInProgramName?: string;
  id: string;
  router: ReturnType<typeof useRouter>;
}) {
  // Fetch completion progress for all lessons in this course
  const { progress, isContentCompleted, getCourseCompletionPercent } = useContentProgress({
    contentType: 'course_lesson',
    contentId: id,
  });

  // Calculate course completion percentage
  const completionPercent = getCourseCompletionPercent(id);
  const completedLessons = progress.filter((p) => p.status === 'completed').length;

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      {/* Success message if just purchased */}
      {justPurchased && (
        <section className="px-4 pt-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold font-albert text-[14px]">
                Purchase successful! Enjoy your course.
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
              <AddToContentButton
                contentType="course"
                contentId={id}
                priceInCents={course.priceInCents}
              />
              <CopyLinkButton />
            </div>
          </div>

          {/* Cover Image */}
          {course.coverImageUrl && (
            <div className="relative h-[220px] rounded-[20px] overflow-hidden">
              <Image
                src={course.coverImageUrl}
                alt={course.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Course Info */}
          <div className="flex flex-col gap-2">
            {/* Tags */}
            <div className="flex items-center gap-2">
              {course.category && (
                <span className="px-3 py-1 bg-earth-100 dark:bg-[#222631] rounded-full font-sans text-xs text-earth-600 dark:text-brand-accent">
                  {course.category}
                </span>
              )}
              {course.level && (
                <span className="px-3 py-1 bg-earth-100 dark:bg-[#222631] rounded-full font-sans text-xs text-earth-600 dark:text-brand-accent">
                  {course.level}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
              {course.title}
            </h1>
            
            {/* Description */}
            {course.shortDescription && (
              <RichContent 
                content={course.shortDescription} 
                className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]"
              />
            )}

            {includedInProgramName && (
              <p className="text-sm text-text-muted">
                Included in {includedInProgramName}
              </p>
            )}

            {/* Course Completion Progress */}
            {totalLessons > 0 && (
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-2 bg-earth-100 dark:bg-[#262b35] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 dark:bg-green-400 transition-all duration-300"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <span className="text-sm text-text-secondary whitespace-nowrap">
                  {completedLessons}/{totalLessons} completed
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section className="px-4 py-3">
        <div className="flex items-center gap-4 text-text-secondary text-sm">
          {course.modules?.length > 0 && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>{course.modules.length} modules</span>
            </div>
          )}
          {totalLessons > 0 && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{totalLessons} lessons</span>
            </div>
          )}
          {totalDuration > 0 && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatDuration(totalDuration)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Modules & Lessons Section */}
      {course.modules && course.modules.length > 0 && (
        <section className="px-4 pt-3 pb-6">
          <div className="flex flex-col gap-4">
            <h2 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
              Course Content
            </h2>

            {/* Module List */}
            <div className="flex flex-col gap-4">
              {course.modules.map((module, moduleIndex) => (
                <div key={module.id} className="bg-white dark:bg-[#171b22] rounded-[20px] overflow-hidden">
                  {/* Module Header */}
                  <div className="p-4 border-b border-earth-100 dark:border-[#262b35]">
                    <div className="flex items-start gap-3">
                      <span className="font-sans text-xs text-text-muted dark:text-[#7d8190] leading-[1.2] mt-1">
                        {String(moduleIndex + 1).padStart(2, '0')}
                      </span>
                      <div className="flex flex-col gap-1">
                        <h3 className="font-albert font-semibold text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3]">
                          {module.title}
                        </h3>
                        {module.description && (
                          <RichContent 
                            content={module.description} 
                            className="font-sans text-sm text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.2]"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lessons List */}
                  <div className="divide-y divide-earth-50 dark:divide-[#262b35]">
                    {module.lessons.map((lesson, lessonIndex) => {
                      const handleLessonClick = () => {
                        // All lessons unlocked for owners
                        router.push(`/discover/courses/${id}/lessons/${lesson.id}`);
                      };

                      // Check if this lesson is completed
                      const lessonCompleted = isContentCompleted('course_lesson', id, lesson.id);

                      return (
                        <div
                          key={lesson.id}
                          onClick={handleLessonClick}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleLessonClick();
                            }
                          }}
                          className="px-4 py-3 flex items-center justify-between transition-colors hover:bg-earth-50 dark:hover:bg-[#1e222a] cursor-pointer active:bg-earth-100 dark:active:bg-[#262b35]"
                        >
                          <div className="flex items-center gap-3">
                            {/* Show checkmark for completed, play icon otherwise */}
                            {lessonCompleted ? (
                              <div className="w-8 h-8 rounded-full bg-green-500 dark:bg-green-500 flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-white" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-earth-500 dark:bg-brand-accent flex items-center justify-center group-hover:bg-earth-600 transition-colors">
                                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            )}

                            {/* Lesson Info */}
                            <div className="flex flex-col">
                              <span className={`font-sans text-sm leading-[1.2] ${
                                lessonCompleted
                                  ? 'text-text-secondary dark:text-[#b2b6c2]'
                                  : 'text-text-primary dark:text-[#f5f5f8]'
                              }`}>
                                {lessonIndex + 1}. {lesson.title}
                              </span>
                              {lessonCompleted ? (
                                <span className="font-sans text-xs text-green-600 dark:text-green-400 mt-0.5">
                                  Completed
                                </span>
                              ) : lesson.videoUrl ? (
                                <span className="font-sans text-xs text-text-muted dark:text-[#7d8190] mt-0.5">
                                  Video lesson
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Duration & Arrow */}
                          <div className="flex items-center gap-2">
                            {lesson.durationMinutes && (
                              <span className="font-sans text-xs text-text-muted">
                                {lesson.durationMinutes} min
                              </span>
                            )}
                            <svg className="w-4 h-4 text-earth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

