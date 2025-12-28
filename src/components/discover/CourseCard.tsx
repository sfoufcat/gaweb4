'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { DiscoverCourse } from '@/types/discover';
import { AddToContentButton } from './AddToContentButton';
import { ContentPurchaseSheet } from './ContentPurchaseSheet';

interface CourseCardProps {
  course: DiscoverCourse;
}

export function CourseCard({ course }: CourseCardProps) {
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);
  const isFree = !course.priceInCents || course.priceInCents === 0;

  // Card content component to avoid duplication
  const CardContent = () => (
    <>
      {/* Cover Image */}
      <div className="relative h-[100px] w-full bg-earth-100 dark:bg-[#262b35]">
        {course.coverImageUrl ? (
          <Image
            src={course.coverImageUrl}
            alt={course.title}
            fill
            className="object-cover"
            sizes="180px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-earth-300 dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}
        
        {/* Featured badge */}
        {course.featured && (
          <div className="absolute top-2 left-2 bg-white/90 dark:bg-[#171b22]/90 backdrop-blur-sm rounded-full p-1">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )}

        {/* Add to Content button - only for free content */}
        {isFree && (
          <AddToContentButton
            contentType="course"
            contentId={course.id}
            priceInCents={course.priceInCents}
            compact
            className="absolute top-2 right-2"
          />
        )}
      </div>
      
      {/* Content */}
      <div className="p-3 flex flex-col gap-1.5">
        {/* Category badge */}
        <span className="font-sans text-xs text-text-muted dark:text-[#7d8190] leading-[1.2]">
          {course.category}
        </span>
        
        {/* Title */}
        <h3 className="font-albert font-semibold text-base text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3] line-clamp-2">
          {course.title}
        </h3>
      </div>
    </>
  );

  // For paid content, render a clickable div that opens the purchase sheet
  if (!isFree) {
    return (
      <>
        <div 
          onClick={() => setShowPurchaseSheet(true)}
          className="bg-white/70 dark:bg-[#171b22] rounded-[20px] w-[180px] flex-shrink-0 hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer overflow-hidden"
        >
          <CardContent />
        </div>
        
        <ContentPurchaseSheet
          open={showPurchaseSheet}
          onOpenChange={setShowPurchaseSheet}
          content={{
            id: course.id,
            type: 'course',
            title: course.title,
            description: course.shortDescription,
            coverImageUrl: course.coverImageUrl,
            priceInCents: course.priceInCents || 0,
            currency: course.currency,
          }}
        />
      </>
    );
  }

  // For free content, use Link for direct navigation
  return (
    <Link href={`/discover/courses/${course.id}`}>
      <div className="bg-white/70 dark:bg-[#171b22] rounded-[20px] w-[180px] flex-shrink-0 hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer overflow-hidden">
        <CardContent />
      </div>
    </Link>
  );
}
