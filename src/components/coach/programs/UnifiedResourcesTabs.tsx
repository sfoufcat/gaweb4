'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap,
  FileText,
  Download,
  Link2,
  FileQuestion,
  X,
  Calendar,
  ChevronDown,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DayCourseSelector } from './DayCourseSelector';
import { ResourceLinkDropdown } from './ResourceLinkDropdown';
import type { WeekResourceAssignment, ResourceDayTag, DayCourseAssignment } from '@/types';
import type { DiscoverCourse } from '@/types/discover';

// Resource types
type ResourceType = 'courses' | 'articles' | 'downloads' | 'links' | 'questionnaires';

interface ResourceTabConfig {
  id: ResourceType;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  resourceType: WeekResourceAssignment['resourceType'];
}

const TABS: ResourceTabConfig[] = [
  { id: 'courses', label: 'Courses', shortLabel: 'Courses', icon: GraduationCap, resourceType: 'course' },
  { id: 'articles', label: 'Articles', shortLabel: 'Articles', icon: FileText, resourceType: 'article' },
  { id: 'downloads', label: 'Downloads', shortLabel: 'Files', icon: Download, resourceType: 'download' },
  { id: 'links', label: 'Links', shortLabel: 'Links', icon: Link2, resourceType: 'link' },
  { id: 'questionnaires', label: 'Forms', shortLabel: 'Forms', icon: FileQuestion, resourceType: 'questionnaire' },
];

// Day tag options for the dropdown
const DAY_TAG_OPTIONS: { value: ResourceDayTag; label: string }[] = [
  { value: 'week', label: 'Week-level' },
  { value: 'daily', label: 'Daily' },
  { value: 1, label: 'Day 1' },
  { value: 2, label: 'Day 2' },
  { value: 3, label: 'Day 3' },
  { value: 4, label: 'Day 4' },
  { value: 5, label: 'Day 5' },
  { value: 6, label: 'Day 6' },
  { value: 7, label: 'Day 7' },
];

// Generic resource item shape
interface ResourceItem {
  id: string;
  title: string;
  programId?: string;
}

// Content completion data for showing "X/Y completed" badges
export interface ContentCompletionData {
  completedCount: number;
  totalCount: number;
}

interface UnifiedResourcesTabsProps {
  // Unified resource assignments
  resourceAssignments: WeekResourceAssignment[];
  onResourceAssignmentsChange: (assignments: WeekResourceAssignment[]) => void;

  // Available resources for linking
  availableCourses: DiscoverCourse[];
  availableArticles: ResourceItem[];
  availableDownloads: ResourceItem[];
  availableLinks: ResourceItem[];
  availableQuestionnaires: ResourceItem[];

  // Program ID for filtering
  programId?: string;

  // Whether to show weekend days (Day 6, Day 7)
  includeWeekends?: boolean;

  // Content completion data by resourceId (for showing "X/Y completed" badges)
  contentCompletion?: Map<string, ContentCompletionData>;
}

// DayTag selector dropdown - uses portal to escape overflow:hidden containers
function DayTagSelector({
  value,
  onChange,
  includeWeekends = true,
}: {
  value: ResourceDayTag;
  onChange: (value: ResourceDayTag) => void;
  includeWeekends?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const options = includeWeekends
    ? DAY_TAG_OPTIONS
    : DAY_TAG_OPTIONS.filter(opt => opt.value !== 6 && opt.value !== 7);

  const currentOption = options.find(opt => opt.value === value) || options[0];

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#8c8c8c] dark:text-[#7d8190] bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg hover:bg-[#e8e4df] dark:hover:bg-[#262b35] transition-colors"
      >
        <Calendar className="w-3 h-3" />
        <span>{currentOption.label}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-[9999] min-w-[120px] py-1 bg-white dark:bg-[#1e222a] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] shadow-lg max-h-[280px] overflow-y-auto"
            style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
          >
            {options.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-sm font-albert transition-colors',
                  option.value === value
                    ? 'bg-brand-accent/10 text-brand-accent'
                    : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// Linked item display with dayTag selector and optional completion badge
function LinkedResourceItem({
  assignment,
  title,
  icon: Icon,
  onRemove,
  onDayTagChange,
  includeWeekends,
  completion,
}: {
  assignment: WeekResourceAssignment;
  title: string;
  icon: LucideIcon;
  onRemove: () => void;
  onDayTagChange: (dayTag: ResourceDayTag) => void;
  includeWeekends?: boolean;
  completion?: ContentCompletionData;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] group">
      <Icon className="w-4 h-4 text-brand-accent flex-shrink-0" />
      <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
        {title}
      </span>
      {/* Completion badge */}
      {completion && completion.totalCount > 0 && (
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
            completion.completedCount === completion.totalCount
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : completion.completedCount > 0
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#8c8c8c] dark:text-[#7d8190]'
          )}
        >
          {completion.completedCount}/{completion.totalCount}
        </span>
      )}
      <DayTagSelector
        value={assignment.dayTag}
        onChange={onDayTagChange}
        includeWeekends={includeWeekends}
      />
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function UnifiedResourcesTabs({
  resourceAssignments,
  onResourceAssignmentsChange,
  availableCourses,
  availableArticles,
  availableDownloads,
  availableLinks,
  availableQuestionnaires,
  programId,
  includeWeekends = true,
  contentCompletion,
}: UnifiedResourcesTabsProps) {
  const [activeTab, setActiveTab] = useState<ResourceType>('courses');

  // Get assignments by type
  const assignmentsByType = useMemo(() => {
    const byType: Record<WeekResourceAssignment['resourceType'], WeekResourceAssignment[]> = {
      course: [],
      article: [],
      download: [],
      link: [],
      questionnaire: [],
    };

    for (const assignment of resourceAssignments) {
      byType[assignment.resourceType].push(assignment);
    }

    return byType;
  }, [resourceAssignments]);

  // Get count for each resource type
  const counts = useMemo(() => ({
    courses: assignmentsByType.course.length,
    articles: assignmentsByType.article.length,
    downloads: assignmentsByType.download.length,
    links: assignmentsByType.link.length,
    questionnaires: assignmentsByType.questionnaire.length,
  }), [assignmentsByType]);

  // Generate unique ID for new assignment
  const generateId = (type: string, resourceId: string) =>
    `${type.substring(0, 3)}-${resourceId}-${Date.now().toString(36)}`;

  // Add resource
  const addResource = (
    resourceType: WeekResourceAssignment['resourceType'],
    resourceId: string,
    extra?: Partial<WeekResourceAssignment>
  ) => {
    const newAssignment: WeekResourceAssignment = {
      id: generateId(resourceType, resourceId),
      resourceType,
      resourceId,
      dayTag: 'week',
      isRequired: false,
      order: resourceAssignments.length,
      ...extra,
    };

    onResourceAssignmentsChange([...resourceAssignments, newAssignment]);
  };

  // Remove resource
  const removeResource = (assignmentId: string) => {
    onResourceAssignmentsChange(
      resourceAssignments.filter((a) => a.id !== assignmentId)
    );
  };

  // Update dayTag
  const updateDayTag = (assignmentId: string, dayTag: ResourceDayTag) => {
    onResourceAssignmentsChange(
      resourceAssignments.map((a) =>
        a.id === assignmentId ? { ...a, dayTag } : a
      )
    );
  };

  // Convert course assignments to new format and handle changes
  const courseAssignments: DayCourseAssignment[] = useMemo(() => {
    return assignmentsByType.course.map((a) => ({
      courseId: a.resourceId,
      moduleIds: a.moduleIds,
      lessonIds: a.lessonIds,
      order: a.order,
    }));
  }, [assignmentsByType.course]);

  const handleCourseAssignmentsChange = (newCourseAssignments: DayCourseAssignment[]) => {
    // Remove existing course assignments
    const nonCourseAssignments = resourceAssignments.filter(a => a.resourceType !== 'course');

    // Convert new course assignments to resource assignments
    const newCourseResourceAssignments: WeekResourceAssignment[] = newCourseAssignments.map((ca, index) => {
      // Find existing assignment to preserve dayTag
      const existing = assignmentsByType.course.find(a => a.resourceId === ca.courseId);
      return {
        id: existing?.id || generateId('course', ca.courseId),
        resourceType: 'course' as const,
        resourceId: ca.courseId,
        moduleIds: ca.moduleIds,
        lessonIds: ca.lessonIds,
        dayTag: existing?.dayTag || 'week',
        isRequired: existing?.isRequired || false,
        order: index,
      };
    });

    onResourceAssignmentsChange([...nonCourseAssignments, ...newCourseResourceAssignments]);
  };

  // Filter available items
  const getLinkedIds = (type: WeekResourceAssignment['resourceType']) =>
    assignmentsByType[type].map((a) => a.resourceId);

  const availableArticlesToLink = availableArticles.filter(
    (a) => !getLinkedIds('article').includes(a.id)
  );
  const availableDownloadsToLink = availableDownloads.filter(
    (d) => !getLinkedIds('download').includes(d.id)
  );
  const availableLinksToLink = availableLinks.filter(
    (l) => !getLinkedIds('link').includes(l.id)
  );
  const availableQuestionnairesToLink = availableQuestionnaires.filter(
    (q) => !getLinkedIds('questionnaire').includes(q.id)
  );

  // Split into program vs platform content
  const programArticles = availableArticlesToLink.filter((a) => a.programId === programId);
  const platformArticles = availableArticlesToLink.filter((a) => a.programId !== programId);
  const programDownloads = availableDownloadsToLink.filter((d) => d.programId === programId);
  const platformDownloads = availableDownloadsToLink.filter((d) => d.programId !== programId);
  const programLinks = availableLinksToLink.filter((l) => l.programId === programId);
  const platformLinks = availableLinksToLink.filter((l) => l.programId !== programId);

  // Helper to get title for an assignment
  const getTitle = (
    assignment: WeekResourceAssignment,
    availableItems: ResourceItem[] | DiscoverCourse[]
  ) => {
    const item = availableItems.find((i) => i.id === assignment.resourceId);
    return item?.title || `Item ${assignment.resourceId.slice(0, 8)}...`;
  };

  return (
    <div className="space-y-4">
      {/* Tab Bar */}
      <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-2xl p-1.5 flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id];
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-white dark:bg-[#1e222a] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#8c8c8c] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2]'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-brand-accent')} />
              <span className="hidden sm:inline font-albert">{tab.label}</span>
              <span className="sm:hidden font-albert">{tab.shortLabel}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                    isActive
                      ? 'bg-brand-accent/15 text-brand-accent'
                      : 'bg-[#e1ddd8]/60 dark:bg-[#262b35] text-[#8c8c8c] dark:text-[#7d8190]'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[120px]">
        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="space-y-3">
            {/* Show course assignments with dayTag selector */}
            {assignmentsByType.course.length > 0 && (
              <div className="space-y-2 mb-4">
                {assignmentsByType.course.map((assignment) => {
                  const course = availableCourses.find(c => c.id === assignment.resourceId);
                  return (
                    <LinkedResourceItem
                      key={assignment.id}
                      assignment={assignment}
                      title={course?.title || `Course ${assignment.resourceId.slice(0, 8)}...`}
                      icon={GraduationCap}
                      onRemove={() => removeResource(assignment.id)}
                      onDayTagChange={(dayTag) => updateDayTag(assignment.id, dayTag)}
                      includeWeekends={includeWeekends}
                      completion={contentCompletion?.get(assignment.resourceId)}
                    />
                  );
                })}
              </div>
            )}
            <DayCourseSelector
              currentAssignments={courseAssignments}
              onChange={handleCourseAssignmentsChange}
              availableCourses={availableCourses}
            />
          </div>
        )}

        {/* Articles Tab */}
        {activeTab === 'articles' && (
          <div>
            {assignmentsByType.article.length > 0 && (
              <div className="space-y-2 mb-4">
                {assignmentsByType.article.map((assignment) => (
                  <LinkedResourceItem
                    key={assignment.id}
                    assignment={assignment}
                    title={getTitle(assignment, availableArticles)}
                    icon={FileText}
                    onRemove={() => removeResource(assignment.id)}
                    onDayTagChange={(dayTag) => updateDayTag(assignment.id, dayTag)}
                    includeWeekends={includeWeekends}
                    completion={contentCompletion?.get(assignment.resourceId)}
                  />
                ))}
              </div>
            )}
            <ResourceLinkDropdown
              placeholder="Add an article..."
              icon={FileText}
              groups={[
                {
                  label: 'Program Content',
                  items: programArticles.map((a) => ({ id: a.id, title: a.title })),
                  iconClassName: 'text-brand-accent',
                },
                {
                  label: 'Platform Content',
                  items: platformArticles.map((a) => ({ id: a.id, title: a.title })),
                  iconClassName: 'text-[#8c8c8c]',
                },
              ]}
              onSelect={(id) => addResource('article', id)}
              onCreateNew={() => {
                window.location.href = '/coach?tab=discover';
              }}
              createNewLabel="Create new article"
            />
            {assignmentsByType.article.length === 0 && availableArticlesToLink.length === 0 && (
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-3 text-center">
                No articles available
              </p>
            )}
          </div>
        )}

        {/* Downloads Tab */}
        {activeTab === 'downloads' && (
          <div>
            {assignmentsByType.download.length > 0 && (
              <div className="space-y-2 mb-4">
                {assignmentsByType.download.map((assignment) => (
                  <LinkedResourceItem
                    key={assignment.id}
                    assignment={assignment}
                    title={getTitle(assignment, availableDownloads)}
                    icon={Download}
                    onRemove={() => removeResource(assignment.id)}
                    onDayTagChange={(dayTag) => updateDayTag(assignment.id, dayTag)}
                    includeWeekends={includeWeekends}
                  />
                ))}
              </div>
            )}
            <ResourceLinkDropdown
              placeholder="Add a download..."
              icon={Download}
              groups={[
                {
                  label: 'Program Content',
                  items: programDownloads.map((d) => ({ id: d.id, title: d.title })),
                  iconClassName: 'text-brand-accent',
                },
                {
                  label: 'Platform Content',
                  items: platformDownloads.map((d) => ({ id: d.id, title: d.title })),
                  iconClassName: 'text-[#8c8c8c]',
                },
              ]}
              onSelect={(id) => addResource('download', id)}
              onCreateNew={() => {
                window.location.href = '/coach?tab=discover';
              }}
              createNewLabel="Create new download"
            />
            {assignmentsByType.download.length === 0 && availableDownloadsToLink.length === 0 && (
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-3 text-center">
                No downloads available
              </p>
            )}
          </div>
        )}

        {/* Links Tab */}
        {activeTab === 'links' && (
          <div>
            {assignmentsByType.link.length > 0 && (
              <div className="space-y-2 mb-4">
                {assignmentsByType.link.map((assignment) => (
                  <LinkedResourceItem
                    key={assignment.id}
                    assignment={assignment}
                    title={getTitle(assignment, availableLinks)}
                    icon={Link2}
                    onRemove={() => removeResource(assignment.id)}
                    onDayTagChange={(dayTag) => updateDayTag(assignment.id, dayTag)}
                    includeWeekends={includeWeekends}
                  />
                ))}
              </div>
            )}
            <ResourceLinkDropdown
              placeholder="Add a link..."
              icon={Link2}
              groups={[
                {
                  label: 'Program Content',
                  items: programLinks.map((l) => ({ id: l.id, title: l.title })),
                  iconClassName: 'text-brand-accent',
                },
                {
                  label: 'Platform Content',
                  items: platformLinks.map((l) => ({ id: l.id, title: l.title })),
                  iconClassName: 'text-[#8c8c8c]',
                },
              ]}
              onSelect={(id) => addResource('link', id)}
              onCreateNew={() => {
                window.location.href = '/coach?tab=discover';
              }}
              createNewLabel="Create new link"
            />
            {assignmentsByType.link.length === 0 && availableLinksToLink.length === 0 && (
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-3 text-center">
                No links available
              </p>
            )}
          </div>
        )}

        {/* Questionnaires Tab */}
        {activeTab === 'questionnaires' && (
          <div>
            {assignmentsByType.questionnaire.length > 0 && (
              <div className="space-y-2 mb-4">
                {assignmentsByType.questionnaire.map((assignment) => (
                  <LinkedResourceItem
                    key={assignment.id}
                    assignment={assignment}
                    title={getTitle(assignment, availableQuestionnaires)}
                    icon={FileQuestion}
                    onRemove={() => removeResource(assignment.id)}
                    onDayTagChange={(dayTag) => updateDayTag(assignment.id, dayTag)}
                    includeWeekends={includeWeekends}
                  />
                ))}
              </div>
            )}
            <ResourceLinkDropdown
              placeholder="Add a questionnaire..."
              icon={FileQuestion}
              groups={[
                {
                  label: 'Available Forms',
                  items: availableQuestionnairesToLink.map((q) => ({ id: q.id, title: q.title })),
                  iconClassName: 'text-brand-accent',
                },
              ]}
              onSelect={(id) => addResource('questionnaire', id)}
              onCreateNew={() => {
                window.location.href = '/coach?tab=discover';
              }}
              createNewLabel="Create new questionnaire"
            />
            {assignmentsByType.questionnaire.length === 0 && availableQuestionnairesToLink.length === 0 && (
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-3 text-center">
                No questionnaires available
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
