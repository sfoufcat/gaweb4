'use client';

import { use } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCourse } from '@/hooks/useDiscover';
import { BackButton, ShareButton, RichContent } from '@/components/discover';

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default function CourseDetailPage({ params }: CoursePageProps) {
  const { id } = use(params);
  const { course, loading } = useCourse(id);
  const router = useRouter();

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

  // Calculate total lessons and duration
  const totalLessons = course.modules.reduce((acc, module) => acc + module.lessons.length, 0);
  const totalDuration = course.modules.reduce((acc, module) => 
    acc + module.lessons.reduce((lessonAcc, lesson) => lessonAcc + (lesson.durationMinutes || 0), 0), 
  0);

  // Format duration
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      {/* Header Section */}
      <section className="px-4 py-5">
        <div className="flex flex-col gap-3">
          {/* Navigation Row */}
          <div className="flex items-center justify-between">
            <BackButton />
            <ShareButton title={course.title} />
          </div>

          {/* Cover Image */}
          <div className="relative h-[220px] rounded-[20px] overflow-hidden">
            <Image
              src={course.coverImageUrl}
              alt={course.title}
              fill
              className="object-cover"
              priority
            />
          </div>

          {/* Course Info */}
          <div className="flex flex-col gap-2">
            {/* Tags */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-earth-100 dark:bg-[#222631] rounded-full font-sans text-xs text-earth-600 dark:text-[#b8896a]">
                {course.category}
              </span>
              <span className="px-3 py-1 bg-earth-100 dark:bg-[#222631] rounded-full font-sans text-xs text-earth-600 dark:text-[#b8896a]">
                {course.level}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-albert font-medium text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
              {course.title}
            </h1>
            
            {/* Description */}
            <RichContent 
              content={course.shortDescription} 
              className="font-sans text-base text-text-secondary tracking-[-0.3px] leading-[1.2]"
            />
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section className="px-4 py-3">
        <div className="flex items-center gap-4 text-text-secondary text-sm">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>{course.modules.length} modules</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{totalLessons} lessons</span>
          </div>
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
                      if (!lesson.isLocked) {
                        router.push(`/discover/courses/${id}/lessons/${lesson.id}`);
                      }
                    };

                    return (
                      <div 
                        key={lesson.id}
                        onClick={handleLessonClick}
                        role={lesson.isLocked ? undefined : 'button'}
                        tabIndex={lesson.isLocked ? undefined : 0}
                        onKeyDown={(e) => {
                          if (!lesson.isLocked && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            handleLessonClick();
                          }
                        }}
                        className={`px-4 py-3 flex items-center justify-between transition-colors ${
                          lesson.isLocked 
                            ? 'opacity-60 cursor-not-allowed' 
                            : 'hover:bg-earth-50 dark:hover:bg-[#1e222a] cursor-pointer active:bg-earth-100 dark:active:bg-[#262b35]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
{/* Play or Lock icon */}
                                          {lesson.isLocked ? (
                                            <div className="w-8 h-8 rounded-full bg-earth-100 dark:bg-[#1e222a] flex items-center justify-center">
                                              <svg className="w-4 h-4 text-earth-400 dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                              </svg>
                                            </div>
                                          ) : (
                                            <div className="w-8 h-8 rounded-full bg-earth-500 dark:bg-[#b8896a] flex items-center justify-center group-hover:bg-earth-600 transition-colors">
                                              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M8 5v14l11-7z" />
                                              </svg>
                                            </div>
                                          )}

{/* Lesson Info */}
                                          <div className="flex flex-col">
                                            <span className="font-sans text-sm text-text-primary dark:text-[#f5f5f8] leading-[1.2]">
                                              {lessonIndex + 1}. {lesson.title}
                                            </span>
                                            {lesson.videoUrl && !lesson.isLocked && (
                                              <span className="font-sans text-xs text-text-muted dark:text-[#7d8190] mt-0.5">
                                                Video lesson
                                              </span>
                                            )}
                                          </div>
                        </div>

                        {/* Duration & Arrow */}
                        <div className="flex items-center gap-2">
                          {lesson.durationMinutes && (
                            <span className="font-sans text-xs text-text-muted">
                              {lesson.durationMinutes} min
                            </span>
                          )}
                          {!lesson.isLocked && (
                            <svg className="w-4 h-4 text-earth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
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
    </div>
  );
}

