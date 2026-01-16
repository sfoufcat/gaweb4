'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  FileText,
  Download,
  Link2,
  FileQuestion,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContentProgress } from '@/hooks/useContentProgress';
import type {
  WeekResourceAssignment,
  ContentProgress,
  ProgramInstanceWeek,
} from '@/types';
import type { DiscoverCourse, DiscoverArticle } from '@/types/discover';
import { getResourcesForDay } from '@/lib/program-utils';

interface ResourceItem {
  id: string;
  title: string;
  description?: string;
  url?: string;
}

interface ProgramDayResourcesProps {
  // Current week data (optional - if not provided, uses standalone mode)
  week?: ProgramInstanceWeek;
  dayOfWeek?: number; // 1-7

  // Standalone mode: direct resource assignments
  resourceAssignments?: WeekResourceAssignment[];

  // Available resources for lookup
  courses?: DiscoverCourse[];
  articles?: DiscoverArticle[];
  downloads?: ResourceItem[];
  links?: ResourceItem[];
  questionnaires?: ResourceItem[];

  // Instance context for progress tracking
  instanceId?: string;

  // UI options
  showTitle?: boolean;
  compact?: boolean;
  className?: string;
}

// Resource type icon mapping
const RESOURCE_ICONS = {
  course: GraduationCap,
  article: FileText,
  download: Download,
  link: Link2,
  questionnaire: FileQuestion,
};

// Resource type colors
const RESOURCE_COLORS = {
  course: 'text-purple-500',
  article: 'text-blue-500',
  download: 'text-green-500',
  link: 'text-orange-500',
  questionnaire: 'text-pink-500',
};

interface ResourceCardProps {
  assignment: WeekResourceAssignment;
  title: string;
  description?: string;
  url?: string;
  progress?: ContentProgress;
  onMarkComplete?: () => void;
  isMarkingComplete?: boolean;
  compact?: boolean;
}

function ResourceCard({
  assignment,
  title,
  description,
  url,
  progress,
  onMarkComplete,
  isMarkingComplete,
  compact,
}: ResourceCardProps) {
  const Icon = RESOURCE_ICONS[assignment.resourceType];
  const iconColor = RESOURCE_COLORS[assignment.resourceType];
  const isCompleted = progress?.status === 'completed';
  const isInProgress = progress?.status === 'in_progress';

  // Build the appropriate link
  const href = useMemo(() => {
    switch (assignment.resourceType) {
      case 'course':
        return `/discover/courses/${assignment.resourceId}`;
      case 'article':
        return `/discover/articles/${assignment.resourceId}`;
      case 'download':
      case 'link':
        return url || '#';
      case 'questionnaire':
        return `/forms/${assignment.resourceId}`;
      default:
        return '#';
    }
  }, [assignment.resourceType, assignment.resourceId, url]);

  const isExternalLink = assignment.resourceType === 'link' || assignment.resourceType === 'download';

  const CardContent = (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-all group',
        isCompleted
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : isInProgress
          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          : 'bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50',
        compact && 'p-2'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
          isCompleted
            ? 'bg-green-100 dark:bg-green-800/30'
            : isInProgress
            ? 'bg-blue-100 dark:bg-blue-800/30'
            : 'bg-[#f3f1ef] dark:bg-[#1e222a]',
          compact && 'w-8 h-8'
        )}
      >
        {isCompleted ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <Icon className={cn('w-5 h-5', iconColor, compact && 'w-4 h-4')} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4
          className={cn(
            'font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate',
            compact ? 'text-sm' : 'text-base',
            isCompleted && 'line-through opacity-70'
          )}
        >
          {title}
        </h4>
        {description && !compact && (
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] line-clamp-1 mt-0.5">
            {description}
          </p>
        )}
        {/* Progress indicator */}
        {isInProgress && progress?.watchProgress !== undefined && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progress.watchProgress}%` }}
              />
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400">
              {progress.watchProgress}%
            </span>
          </div>
        )}
        {/* Re-completion count */}
        {isCompleted && progress?.completionCount && progress.completionCount > 1 && (
          <span className="text-xs text-green-600 dark:text-green-400">
            Completed {progress.completionCount}x
          </span>
        )}
      </div>

      {/* Action button/indicator */}
      <div className="flex-shrink-0">
        {assignment.resourceType === 'article' && !isCompleted && onMarkComplete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkComplete();
            }}
            disabled={isMarkingComplete}
            className="px-2 py-1 text-xs font-medium text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors"
          >
            {isMarkingComplete ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <BookOpen className="w-3 h-3" />
            )}
          </button>
        )}
        {isExternalLink ? (
          <ExternalLink className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190] group-hover:text-brand-accent" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190] group-hover:text-brand-accent" />
        )}
      </div>
    </div>
  );

  if (isExternalLink) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {CardContent}
      </a>
    );
  }

  return (
    <Link href={href} className="block">
      {CardContent}
    </Link>
  );
}

export function ProgramDayResources({
  week,
  dayOfWeek,
  resourceAssignments: directAssignments,
  courses = [],
  articles = [],
  downloads = [],
  links = [],
  questionnaires = [],
  instanceId,
  showTitle = true,
  compact = false,
  className,
}: ProgramDayResourcesProps) {
  // Get content progress
  const { progress, markComplete, isLoading: progressLoading } = useContentProgress(
    instanceId ? { instanceId } : undefined
  );

  // Track which items are being marked complete
  const [markingComplete, setMarkingComplete] = React.useState<Set<string>>(new Set());

  // Get resources for today
  const todaysResources = useMemo(() => {
    if (directAssignments) {
      return directAssignments;
    }
    if (week && dayOfWeek) {
      return getResourcesForDay(week, dayOfWeek);
    }
    return [];
  }, [week, dayOfWeek, directAssignments]);

  // Group resources by type
  const groupedResources = useMemo(() => {
    const groups: Record<string, WeekResourceAssignment[]> = {
      course: [],
      article: [],
      download: [],
      link: [],
      questionnaire: [],
    };

    for (const resource of todaysResources) {
      if (groups[resource.resourceType]) {
        groups[resource.resourceType].push(resource);
      }
    }

    return groups;
  }, [todaysResources]);

  // Get title and description for a resource
  const getResourceInfo = (assignment: WeekResourceAssignment): { title: string; description?: string; url?: string } => {
    switch (assignment.resourceType) {
      case 'course': {
        const course = courses.find((c) => c.id === assignment.resourceId);
        return {
          title: assignment.title || course?.title || 'Course',
          description: assignment.description || course?.shortDescription,
        };
      }
      case 'article': {
        const article = articles.find((a) => a.id === assignment.resourceId);
        return {
          title: assignment.title || article?.title || 'Article',
          description: assignment.description,
        };
      }
      case 'download': {
        const download = downloads.find((d) => d.id === assignment.resourceId);
        return {
          title: assignment.title || download?.title || 'Download',
          description: assignment.description,
          url: download?.url,
        };
      }
      case 'link': {
        const link = links.find((l) => l.id === assignment.resourceId);
        return {
          title: assignment.title || link?.title || 'Link',
          description: assignment.description,
          url: link?.url,
        };
      }
      case 'questionnaire': {
        const form = questionnaires.find((q) => q.id === assignment.resourceId);
        return {
          title: assignment.title || form?.title || 'Form',
          description: assignment.description,
        };
      }
      default:
        return { title: 'Resource' };
    }
  };

  // Get progress for a resource
  const getProgress = (assignment: WeekResourceAssignment): ContentProgress | undefined => {
    if (assignment.resourceType !== 'course' && assignment.resourceType !== 'article') {
      return undefined;
    }

    return progress.find((p) => {
      if (assignment.resourceType === 'course') {
        // For courses, check course-level progress or lesson progress
        return p.contentType === 'course' && p.contentId === assignment.resourceId;
      }
      return p.contentType === 'article' && p.contentId === assignment.resourceId;
    });
  };

  // Handle marking content as complete
  const handleMarkComplete = async (assignment: WeekResourceAssignment) => {
    if (assignment.resourceType !== 'article') return;

    const key = `${assignment.resourceType}-${assignment.resourceId}`;
    setMarkingComplete((prev) => new Set(prev).add(key));

    try {
      await markComplete({
        contentType: 'article',
        contentId: assignment.resourceId,
        instanceId,
      });
    } catch (error) {
      console.error('Failed to mark complete:', error);
    } finally {
      setMarkingComplete((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Check if we have any resources
  const hasResources = todaysResources.length > 0;

  if (!hasResources) {
    return null;
  }

  // Order of resource types to display
  const resourceOrder: Array<keyof typeof groupedResources> = [
    'course',
    'article',
    'download',
    'link',
    'questionnaire',
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {showTitle && (
        <h3 className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8]">
          Today&apos;s Content
        </h3>
      )}

      {progressLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
        </div>
      ) : (
        <div className="space-y-2">
          {resourceOrder.map((type) => {
            const resources = groupedResources[type];
            if (resources.length === 0) return null;

            return resources.map((assignment) => {
              const info = getResourceInfo(assignment);
              const resourceProgress = getProgress(assignment);
              const key = `${assignment.resourceType}-${assignment.resourceId}`;

              return (
                <ResourceCard
                  key={assignment.id}
                  assignment={assignment}
                  title={info.title}
                  description={info.description}
                  url={info.url}
                  progress={resourceProgress}
                  onMarkComplete={
                    assignment.resourceType === 'article'
                      ? () => handleMarkComplete(assignment)
                      : undefined
                  }
                  isMarkingComplete={markingComplete.has(key)}
                  compact={compact}
                />
              );
            });
          })}
        </div>
      )}
    </div>
  );
}
