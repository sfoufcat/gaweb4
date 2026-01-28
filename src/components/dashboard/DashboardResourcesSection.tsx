'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import {
  BookOpen,
  GraduationCap,
  Download,
  Link2,
  ClipboardList,
  PlayCircle,
} from 'lucide-react';
import type { ProgramEnrollmentWithDetails } from '@/hooks/useDashboard';
import type { WeeklyContentResponse } from '@/hooks/useProgramWeeklyContent';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface DashboardResourcesSectionProps {
  enrollments: ProgramEnrollmentWithDetails[];
  isLoading?: boolean;
}

interface ResolvedResource {
  id: string;
  type: 'course' | 'article' | 'download' | 'link' | 'questionnaire' | 'video';
  title: string;
  subtitle?: string;
  href: string;
  external?: boolean;
  programId: string;
  imageUrl?: string;
}

const RESOURCE_ICONS = {
  course: GraduationCap,
  article: BookOpen,
  download: Download,
  link: Link2,
  questionnaire: ClipboardList,
  video: PlayCircle,
} as const;

const RESOURCE_COLORS = {
  course: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
  article: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  download: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  link: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  questionnaire: 'text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30',
  video: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
} as const;

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

/**
 * Hook to fetch resources for a single program
 */
function useProgramResources(enrollment: ProgramEnrollmentWithDetails | null) {
  const { isDemoMode } = useDemoMode();

  const { data, isLoading } = useSWR<WeeklyContentResponse>(
    enrollment && !isDemoMode
      ? `/api/programs/${enrollment.programId}/weekly-content`
      : null,
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  return useMemo(() => {
    if (!data || !enrollment) return { resources: [], isLoading };

    const { courses, articles, downloads, links, questionnaires, videos } = data;

    // Directly use all week resources (same as ProgramDetailView)
    // This ensures dashboard shows same resources as program page
    const resolvedResources: ResolvedResource[] = [];

    // Add courses
    courses?.forEach((course) => {
      resolvedResources.push({
        id: course.id,
        type: 'course',
        title: course.title,
        subtitle: course.category,
        href: `/discover/courses/${course.id}?enrollmentId=${enrollment.id}`,
        programId: enrollment.programId,
        imageUrl: course.coverImageUrl,
      });
    });

    // Add articles
    articles?.forEach((article) => {
      resolvedResources.push({
        id: article.id,
        type: 'article',
        title: article.title,
        subtitle: article.readingTimeMinutes
          ? `${article.readingTimeMinutes} min read`
          : undefined,
        href: `/discover/articles/${article.id}`,
        programId: enrollment.programId,
        imageUrl: article.coverImageUrl,
      });
    });

    // Add questionnaires
    questionnaires?.forEach((questionnaire) => {
      resolvedResources.push({
        id: questionnaire.id,
        type: 'questionnaire',
        title: questionnaire.title,
        href: `/q/${questionnaire.slug || questionnaire.id}`,
        programId: enrollment.programId,
      });
    });

    // Add videos
    videos?.forEach((video) => {
      resolvedResources.push({
        id: video.id,
        type: 'video',
        title: video.title,
        href: `/discover/videos/${video.id}`,
        programId: enrollment.programId,
        imageUrl: video.thumbnailUrl,
      });
    });

    // Add downloads
    downloads?.forEach((download) => {
      resolvedResources.push({
        id: download.id,
        type: 'download',
        title: download.title,
        subtitle: download.fileType?.toUpperCase(),
        href: download.fileUrl,
        external: true,
        programId: enrollment.programId,
      });
    });

    // Add links
    links?.forEach((link) => {
      resolvedResources.push({
        id: link.id,
        type: 'link',
        title: link.title,
        href: link.url,
        external: true,
        programId: enrollment.programId,
      });
    });

    return { resources: resolvedResources, isLoading };
  }, [data, enrollment, isLoading]);
}

export function DashboardResourcesSection({
  enrollments,
  isLoading: enrollmentsLoading,
}: DashboardResourcesSectionProps) {
  // Show active and upcoming enrollments (both can have resources to show)
  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === 'active' || e.status === 'upcoming'),
    [enrollments]
  );

  // Fetch resources for each active enrollment (max 3 to avoid too many requests)
  const enrollment0 = activeEnrollments[0] || null;
  const enrollment1 = activeEnrollments[1] || null;
  const enrollment2 = activeEnrollments[2] || null;

  const result0 = useProgramResources(enrollment0);
  const result1 = useProgramResources(enrollment1);
  const result2 = useProgramResources(enrollment2);

  const isLoadingResources = result0.isLoading || result1.isLoading || result2.isLoading;

  // Combine and dedupe resources
  const allResources = useMemo(() => {
    const resourcesMap = new Map<string, ResolvedResource>();

    [...result0.resources, ...result1.resources, ...result2.resources].forEach((r) => {
      if (!resourcesMap.has(r.id)) {
        resourcesMap.set(r.id, r);
      }
    });

    return Array.from(resourcesMap.values()).slice(0, 4);
  }, [result0.resources, result1.resources, result2.resources]);

  // Loading state
  if (enrollmentsLoading || (activeEnrollments.length > 0 && isLoadingResources && allResources.length === 0)) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
            Your resources
          </h2>
        </div>
        <div className="bg-white dark:bg-surface rounded-[20px] p-5 space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-text-primary/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-text-primary/10 rounded" />
                <div className="h-3 w-1/2 bg-text-primary/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No programs enrolled or no resources
  if (activeEnrollments.length === 0 || allResources.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
            Your resources
          </h2>
        </div>
        <div className="bg-white dark:bg-surface rounded-[20px] py-12 px-6 text-center min-h-[180px] flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4">
            <BookOpen className="w-6 h-6 text-blue-500 dark:text-blue-400" />
          </div>
          <p className="font-albert text-[15px] text-text-secondary leading-[1.4]">
            No resources for today
          </p>
          <p className="font-sans text-[13px] text-text-muted mt-1">
            Check your program schedule
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-albert text-[24px] text-text-primary leading-[1.3] tracking-[-1.5px]">
          Your resources
        </h2>
        <Link
          href="/program"
          className="font-sans text-[12px] text-brand-accent hover:opacity-80 transition-opacity leading-[1.2]"
        >
          All
        </Link>
      </div>

      <div className="bg-white dark:bg-surface rounded-[20px] p-2">
        {allResources.map((resource, index) => {
          const Icon = RESOURCE_ICONS[resource.type];
          const colorClass = RESOURCE_COLORS[resource.type];

          const content = (
            <div className={`flex items-center gap-3 p-3 rounded-2xl hover:bg-[#f3f1ef] dark:hover:bg-[#181d28] transition-colors ${
              index < allResources.length - 1 ? 'border-b border-[#f3f1ef] dark:border-[#262b35]' : ''
            }`}>
              {resource.imageUrl ? (
                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={resource.imageUrl}
                    alt={resource.title}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-albert text-[16px] font-medium text-text-primary tracking-[-0.3px] truncate">
                  {resource.title}
                </p>
                {resource.subtitle && (
                  <p className="font-sans text-[12px] text-text-secondary leading-[1.2] truncate mt-0.5">
                    {resource.subtitle}
                  </p>
                )}
              </div>
            </div>
          );

          if (resource.external) {
            return (
              <a
                key={resource.id}
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {content}
              </a>
            );
          }

          return (
            <Link key={resource.id} href={resource.href} className="block">
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardResourcesSection;
