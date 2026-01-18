'use client';

import { use, useMemo, useRef, useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCourse } from '@/hooks/useDiscover';
import { useSingleContentProgress } from '@/hooks/useContentProgress';
import { BackButton } from '@/components/discover';
import { CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';
import type { CourseLesson, CourseModule } from '@/types/discover';

interface LessonPageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

// Helper to find lesson and its context within the course
function findLessonContext(
  modules: CourseModule[],
  lessonId: string
): {
  lesson: CourseLesson | null;
  module: CourseModule | null;
  moduleIndex: number;
  lessonIndex: number;
  prevLesson: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
} {
  let prevLesson: { id: string; title: string } | null = null;
  let nextLesson: { id: string; title: string } | null = null;
  let foundLesson: CourseLesson | null = null;
  let foundModule: CourseModule | null = null;
  let foundModuleIndex = -1;
  let foundLessonIndex = -1;

  // Flatten all lessons with their module context
  const allLessons: { lesson: CourseLesson; module: CourseModule; moduleIndex: number; lessonIndex: number }[] = [];

  modules.forEach((module, moduleIndex) => {
    module.lessons.forEach((lesson, lessonIndex) => {
      allLessons.push({ lesson, module, moduleIndex, lessonIndex });
    });
  });

  // Find the target lesson and its neighbors
  const targetIndex = allLessons.findIndex(item => item.lesson.id === lessonId);

  if (targetIndex !== -1) {
    const target = allLessons[targetIndex];
    foundLesson = target.lesson;
    foundModule = target.module;
    foundModuleIndex = target.moduleIndex;
    foundLessonIndex = target.lessonIndex;

    // Find previous lesson (skip locked lessons)
    for (let i = targetIndex - 1; i >= 0; i--) {
      if (!allLessons[i].lesson.isLocked) {
        prevLesson = {
          id: allLessons[i].lesson.id,
          title: allLessons[i].lesson.title,
        };
        break;
      }
    }

    // Find next lesson (skip locked lessons)
    for (let i = targetIndex + 1; i < allLessons.length; i++) {
      if (!allLessons[i].lesson.isLocked) {
        nextLesson = {
          id: allLessons[i].lesson.id,
          title: allLessons[i].lesson.title,
        };
        break;
      }
    }
  }

  return {
    lesson: foundLesson,
    module: foundModule,
    moduleIndex: foundModuleIndex,
    lessonIndex: foundLessonIndex,
    prevLesson,
    nextLesson,
  };
}

export default function LessonDetailPage({ params }: LessonPageProps) {
  const { id: courseId, lessonId } = use(params);
  const { course, loading } = useCourse(courseId);
  const router = useRouter();

  // Progress tracking
  const {
    progress,
    isCompleted,
    watchProgress: savedWatchProgress,
    completionCount,
    markComplete,
    trackWatchProgress,
  } = useSingleContentProgress('course_lesson', courseId, lessonId);

  // Local state for video progress
  const [currentWatchProgress, setCurrentWatchProgress] = useState(0);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedProgress = useRef(0);

  // Find lesson context within the course
  const lessonContext = useMemo(() => {
    if (!course) return null;
    return findLessonContext(course.modules, lessonId);
  }, [course, lessonId]);

  // Track video progress
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const progress = Math.round((video.currentTime / video.duration) * 100);
    setCurrentWatchProgress(progress);

    // Save progress every 10% increment
    if (progress >= lastSavedProgress.current + 10) {
      lastSavedProgress.current = progress;
      trackWatchProgress('course_lesson', courseId, progress, { lessonId }).catch(console.error);
    }
  }, [courseId, lessonId, trackWatchProgress]);

  // Auto-complete at 90% - handled by API
  useEffect(() => {
    if (currentWatchProgress >= 90 && !isCompleted) {
      trackWatchProgress('course_lesson', courseId, currentWatchProgress, { lessonId }).catch(console.error);
    }
  }, [currentWatchProgress, isCompleted, courseId, lessonId, trackWatchProgress]);

  // Mark complete manually
  const handleMarkComplete = async () => {
    setIsMarkingComplete(true);
    try {
      await markComplete({
        contentType: 'course_lesson',
        contentId: courseId,
        lessonId,
        watchProgress: currentWatchProgress,
      });
    } catch (err) {
      console.error('Failed to mark lesson complete:', err);
    } finally {
      setIsMarkingComplete(false);
    }
  };

  // Format duration
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Render notes with paragraph support
  const renderNotes = (notes: string) => {
    return notes.split('\n\n').map((paragraph, index) => (
      <p key={index} className="mb-4 last:mb-0">
        {paragraph.split('\n').map((line, lineIndex) => (
          <span key={lineIndex}>
            {line}
            {lineIndex < paragraph.split('\n').length - 1 && <br />}
          </span>
        ))}
      </p>
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="text-text-secondary">Course not found</div>
      </div>
    );
  }

  if (!lessonContext || !lessonContext.lesson || !lessonContext.module) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="text-text-secondary">Lesson not found</div>
          <Link
            href={`/discover/courses/${courseId}`}
            className="text-earth-600 hover:text-earth-700 font-medium"
          >
            ← Back to course
          </Link>
        </div>
      </div>
    );
  }

  const { lesson, module, moduleIndex, prevLesson, nextLesson } = lessonContext;

  // Check if lesson is locked
  if (lesson.isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-earth-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-earth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="font-albert font-medium text-xl text-text-primary">This lesson is locked</h2>
          <p className="text-text-secondary">Complete previous lessons to unlock this content.</p>
          <Link
            href={`/discover/courses/${courseId}`}
            className="mt-2 px-4 py-2 bg-earth-500 text-white rounded-full font-medium hover:bg-earth-600 transition-colors"
          >
            Back to course
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      {/* Header Section */}
      <section className="px-4 py-5">
        <div className="flex flex-col gap-3">
          {/* Navigation Row */}
          <div className="flex items-center justify-between">
            <BackButton />
            <Link
              href={`/discover/courses/${courseId}`}
              className="text-sm text-earth-600 hover:text-earth-700 font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Course overview
            </Link>
          </div>

          {/* Course Title (small) */}
          <Link
            href={`/discover/courses/${courseId}`}
            className="font-sans text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            {course.title}
          </Link>

          {/* Lesson Title with Completion Badge */}
          <div className="flex items-start gap-3">
            <h1 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3] flex-1">
              {lesson.title}
            </h1>
            {isCompleted && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  {completionCount > 1 ? `Watched ${completionCount}x` : 'Completed'}
                </span>
              </div>
            )}
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-3 text-text-muted text-sm">
            <span>Module {moduleIndex + 1} · {module.title}</span>
            {lesson.durationMinutes && (
              <>
                <span>•</span>
                <span>{formatDuration(lesson.durationMinutes)}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Video Player Section */}
      <section className="px-4 pb-4">
        <div className="relative w-full aspect-video bg-black rounded-[20px] overflow-hidden shadow-lg">
          {lesson.videoUrl ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                controls
                poster={lesson.videoThumbnailUrl}
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
              >
                <source src={lesson.videoUrl} type="video/mp4" />
                <source src={lesson.videoUrl} type="video/webm" />
                Your browser does not support the video tag.
              </video>

              {/* Progress indicator overlay */}
              {currentWatchProgress > 0 && currentWatchProgress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                  <div
                    className="h-full bg-brand-accent transition-all duration-300"
                    style={{ width: `${currentWatchProgress}%` }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gradient-to-br from-earth-600 to-earth-800">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="font-sans text-lg font-medium">Video coming soon</p>
              <p className="font-sans text-sm text-white/70 mt-1">Check back later for video content</p>
            </div>
          )}
        </div>

        {/* Mark Complete Button - shown for all lessons (with or without video) */}
        <div className="flex items-center justify-end mt-3 gap-3">
            {isCompleted ? (
              <button
                onClick={handleMarkComplete}
                disabled={isMarkingComplete}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-earth-600 dark:text-brand-accent hover:bg-earth-100 dark:hover:bg-[#262b35] rounded-lg transition-colors"
              >
                {isMarkingComplete ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Watch Again
              </button>
            ) : (
              <button
                onClick={handleMarkComplete}
                disabled={isMarkingComplete}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-earth-500 dark:bg-brand-accent text-white rounded-lg hover:bg-earth-600 dark:hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
              >
                {isMarkingComplete ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Mark Complete
              </button>
            )}
        </div>
      </section>

      {/* Lesson Content / Notes */}
      {lesson.notes && (
        <section className="px-4 py-4">
          <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-5 shadow-sm dark:shadow-none">
            <h2 className="font-albert font-semibold text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-1px] mb-4">
              Lesson Notes
            </h2>
            <div className="font-sans text-base text-text-secondary dark:text-[#b2b6c2] tracking-[-0.3px] leading-[1.5]">
              {renderNotes(lesson.notes)}
            </div>
          </div>
        </section>
      )}

      {/* Lesson Navigation */}
      <section className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Previous Lesson - Ghost/minimal style */}
          {prevLesson ? (
            <button
              onClick={() => router.push(`/discover/courses/${courseId}/lessons/${prevLesson.id}`)}
              className="flex items-center gap-2 text-earth-600 dark:text-brand-accent hover:text-earth-700 dark:hover:text-[#d4b896] transition-colors group"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-sans text-sm font-medium">Previous</span>
            </button>
          ) : (
            <div />
          )}

          {/* Next Lesson - Compact pill style */}
          {nextLesson ? (
            <button
              onClick={() => router.push(`/discover/courses/${courseId}/lessons/${nextLesson.id}`)}
              className="flex items-center gap-2 px-5 py-2.5 bg-earth-500 dark:bg-brand-accent rounded-full hover:bg-earth-600 dark:hover:bg-brand-accent/90 transition-colors text-white group"
            >
              <span className="font-sans text-sm font-medium">Next</span>
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <Link
              href={`/discover/courses/${courseId}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-earth-500 dark:bg-brand-accent rounded-full hover:bg-earth-600 dark:hover:bg-brand-accent/90 transition-colors text-white group"
            >
              <span className="font-sans text-sm font-medium">Complete</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </Link>
          )}
        </div>
      </section>

      {/* All Lessons in Module */}
      <section className="px-4 pt-2 pb-6">
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] overflow-hidden">
          <div className="p-4 border-b border-earth-100 dark:border-[#262b35]">
            <h3 className="font-albert font-semibold text-base text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
              Module {moduleIndex + 1}: {module.title}
            </h3>
          </div>
          <div className="divide-y divide-earth-50 dark:divide-[#262b35]">
            {module.lessons.map((moduleLesson, idx) => {
              const isCurrentLesson = moduleLesson.id === lesson.id;
              const isLocked = moduleLesson.isLocked;

              return (
                <div
                  key={moduleLesson.id}
                  onClick={() => {
                    if (!isLocked && !isCurrentLesson) {
                      router.push(`/discover/courses/${courseId}/lessons/${moduleLesson.id}`);
                    }
                  }}
                  className={`px-4 py-3 flex items-center justify-between ${
                    isCurrentLesson
                      ? 'bg-earth-50 dark:bg-[#1e222a]'
                      : isLocked
                        ? 'opacity-60'
                        : 'hover:bg-earth-50 dark:hover:bg-[#1e222a] cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Play or Lock icon */}
                    {isLocked ? (
                      <div className="w-8 h-8 rounded-full bg-earth-100 dark:bg-[#262b35] flex items-center justify-center">
                        <svg className="w-4 h-4 text-earth-400 dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    ) : isCurrentLesson ? (
                      <div className="w-8 h-8 rounded-full bg-earth-500 dark:bg-brand-accent flex items-center justify-center">
                        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-earth-100 dark:bg-[#262b35] flex items-center justify-center">
                        <svg className="w-4 h-4 text-earth-500 dark:text-brand-accent ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}

                    {/* Lesson Info */}
                    <div className="flex flex-col">
                      <span className={`font-sans text-sm leading-[1.2] ${
                        isCurrentLesson ? 'text-earth-600 dark:text-brand-accent font-medium' : 'text-text-primary dark:text-[#f5f5f8]'
                      }`}>
                        {idx + 1}. {moduleLesson.title}
                      </span>
                    </div>
                  </div>

                  {/* Duration or Current indicator */}
                  {isCurrentLesson ? (
                    <span className="font-sans text-xs text-earth-600 dark:text-brand-accent font-medium">Playing</span>
                  ) : moduleLesson.durationMinutes ? (
                    <span className="font-sans text-xs text-text-muted dark:text-[#7d8190]">
                      {moduleLesson.durationMinutes} min
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
