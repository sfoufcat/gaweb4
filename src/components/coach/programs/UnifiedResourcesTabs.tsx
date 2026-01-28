'use client';

import { useState, useMemo, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap,
  FileText,
  Download,
  Link2,
  ClipboardList,
  Video,
  X,
  Calendar,
  ChevronDown,
  ChevronRight,
  Pencil,
  MoreVertical,
  Trash2,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResourceLinkDropdown } from './ResourceLinkDropdown';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CourseModule } from '@/types/discover';
import { ResourceCadenceModal, getResourceCadenceLabel } from './ResourceCadenceModal';
import type { WeekResourceAssignment, ResourceDayTag } from '@/types';
import type { DiscoverCourse, DiscoverVideo } from '@/types/discover';

// Resource types
type ResourceType = 'courses' | 'articles' | 'downloads' | 'links' | 'questionnaires' | 'videos';

interface ResourceTabConfig {
  id: ResourceType;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  resourceType: WeekResourceAssignment['resourceType'];
}

const TABS: ResourceTabConfig[] = [
  { id: 'courses', label: 'Courses', shortLabel: 'Courses', icon: GraduationCap, resourceType: 'course' },
  { id: 'videos', label: 'Videos', shortLabel: 'Videos', icon: Video, resourceType: 'video' },
  { id: 'articles', label: 'Articles', shortLabel: 'Articles', icon: FileText, resourceType: 'article' },
  { id: 'questionnaires', label: 'Forms', shortLabel: 'Forms', icon: ClipboardList, resourceType: 'questionnaire' },
  { id: 'downloads', label: 'Downloads', shortLabel: 'Files', icon: Download, resourceType: 'download' },
  { id: 'links', label: 'Links', shortLabel: 'Links', icon: Link2, resourceType: 'link' },
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
  availableVideos?: DiscoverVideo[];
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

  // Calendar start date for displaying weekday names in cadence modal
  calendarStartDate?: string;
}

// Cadence trigger button - opens the cadence modal
function CadenceTriggerButton({
  value,
  onClick,
  calendarStartDate,
}: {
  value: ResourceDayTag;
  onClick: () => void;
  calendarStartDate?: string;
}) {
  const label = getResourceCadenceLabel(value, calendarStartDate);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#8c8c8c] dark:text-[#7d8190] bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg hover:bg-[#e8e4df] dark:hover:bg-[#262b35] transition-colors"
    >
      <Calendar className="w-3 h-3" />
      <span className="max-w-[80px] truncate">{label}</span>
      <ChevronDown className="w-3 h-3" />
    </button>
  );
}

// Linked item display with cadence modal trigger and optional completion badge
function LinkedResourceItem({
  assignment,
  title,
  icon: Icon,
  onRemove,
  onDayTagChange,
  includeWeekends,
  completion,
  courseInfo,
  calendarStartDate,
  coverImageUrl,
  subtext,
  onEdit,
  isEditing,
  // Course edit panel props
  editPanelContent,
}: {
  assignment: WeekResourceAssignment;
  title: string;
  icon: LucideIcon;
  onRemove: () => void;
  onDayTagChange: (dayTag: ResourceDayTag) => void;
  includeWeekends?: boolean;
  completion?: ContentCompletionData;
  courseInfo?: { totalLessons: number; title?: string };
  calendarStartDate?: string;
  coverImageUrl?: string;
  subtext?: string;
  onEdit?: () => void;
  isEditing?: boolean;
  editPanelContent?: React.ReactNode;
}) {
  const [cadenceModalOpen, setCadenceModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 640px)');

  return (
    <>
      <div className={cn(
        "bg-white dark:bg-[#11141b] rounded-xl border overflow-hidden transition-all duration-300 ease-out",
        isEditing
          ? "border-brand-accent shadow-lg shadow-brand-accent/10"
          : "border-[#e1ddd8] dark:border-[#262b35]"
      )}>
        {/* Header row - always visible */}
        <div className="flex items-center gap-3 p-3 group">
          {/* Cover image for courses */}
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={title}
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <Icon className="w-4 h-4 text-brand-accent flex-shrink-0" />
          )}
          {/* Title and subtext */}
          <div className="flex-1 min-w-0">
            <span className="block text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
              {title}
            </span>
            {subtext && (
              <span className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                {subtext}
              </span>
            )}
          </div>
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

          {/* Desktop: individual buttons */}
          {isDesktop ? (
            <>
              <button
                type="button"
                onClick={() => setCadenceModalOpen(true)}
                className={cn(
                  "flex items-center gap-1 rounded-lg transition-all px-2 py-1",
                  assignment.dayTag === 'week'
                    ? "text-[#a7a39e] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-[#1e222a]"
                    : "text-brand-accent bg-brand-accent/10 hover:bg-brand-accent/20"
                )}
                title="Change cadence"
              >
                <Calendar className="w-4 h-4" />
                {assignment.dayTag !== 'week' && (
                  <span className="text-xs font-medium">
                    {getResourceCadenceLabel(assignment.dayTag, calendarStartDate)}
                  </span>
                )}
              </button>
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className={cn(
                    "p-1.5 transition-colors rounded-lg",
                    isEditing
                      ? "text-brand-accent bg-brand-accent/10"
                      : "text-[#a7a39e] dark:text-[#7d8190] hover:text-brand-accent"
                  )}
                  title={isEditing ? 'Cancel editing' : 'Edit selection'}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onRemove}
                className="p-1.5 text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            /* Mobile: 3-dot menu */
            <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-[#5f5a55] dark:text-[#7d8190] hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-all"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setCadenceModalOpen(true);
                  }}
                  className="gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>
                    Cadence
                    {assignment.dayTag !== 'week' && (
                      <span className="ml-1 text-brand-accent">
                        ({getResourceCadenceLabel(assignment.dayTag, calendarStartDate)})
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem
                    onClick={() => {
                      onEdit();
                      setMobileMenuOpen(false);
                    }}
                    className="gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>{isEditing ? 'Cancel editing' : 'Edit selection'}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    onRemove();
                    setMobileMenuOpen(false);
                  }}
                  className="gap-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Expandable edit panel */}
        {isEditing && editPanelContent && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            {editPanelContent}
          </div>
        )}
      </div>

      <ResourceCadenceModal
        open={cadenceModalOpen}
        onOpenChange={setCadenceModalOpen}
        value={assignment.dayTag}
        onChange={onDayTagChange}
        includeWeekends={includeWeekends}
        courseInfo={courseInfo}
        calendarStartDate={calendarStartDate}
        resourceType={assignment.resourceType}
      />
    </>
  );
}

// Course edit panel - module/lesson selection tree (inline within card)
function CourseEditPanel({
  modules,
  selectedModules,
  selectedLessons,
  expandedModules,
  onToggleModuleExpand,
  onToggleModuleSelection,
  onToggleLessonSelection,
  onSave,
  onCancel,
}: {
  modules: CourseModule[];
  selectedModules: Set<string>;
  selectedLessons: Set<string>;
  expandedModules: Set<string>;
  onToggleModuleExpand: (moduleId: string) => void;
  onToggleModuleSelection: (module: CourseModule) => void;
  onToggleLessonSelection: (lessonId: string, moduleId: string, module: CourseModule) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border-t border-brand-accent/20 bg-gradient-to-b from-brand-accent/5 to-transparent">
      <div className="px-4 pt-3 pb-4 space-y-3">
        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          Select specific content (leave empty for full course)
        </p>
        {modules.length > 0 && (
          <div className="max-h-56 overflow-y-auto space-y-0.5 rounded-lg bg-[#faf8f6] dark:bg-[#1d222b] p-2">
            {modules.map((module) => (
              <div key={module.id}>
                <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-[#262b35]/60 transition-colors">
                  <button
                    type="button"
                    onClick={() => onToggleModuleExpand(module.id)}
                    className="p-0.5 hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] rounded transition-colors"
                  >
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] transition-transform duration-200",
                        expandedModules.has(module.id) && "rotate-90"
                      )}
                    />
                  </button>
                  <div
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                    onClick={() => onToggleModuleSelection(module)}
                  >
                    <BrandedCheckbox
                      checked={selectedModules.has(module.id)}
                      onChange={() => {}}
                    />
                    <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-medium">
                      {module.title}
                    </span>
                    <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                      ({module.lessons?.length || 0} lessons)
                    </span>
                  </div>
                </div>

                {/* Lessons - animated expand */}
                <div
                  className={cn(
                    "ml-7 overflow-hidden transition-all duration-200 ease-out",
                    expandedModules.has(module.id) ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  {module.lessons && (
                    <div className="py-1 space-y-0.5">
                      {module.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-white/60 dark:hover:bg-[#262b35]/60 transition-colors"
                          onClick={() => onToggleLessonSelection(lesson.id, module.id, module)}
                        >
                          <BrandedCheckbox
                            checked={selectedLessons.has(lesson.id)}
                            onChange={() => {}}
                          />
                          <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert flex-1">
                            {lesson.title}
                          </span>
                          {lesson.durationMinutes && (
                            <span className="text-xs text-[#a7a39e] dark:text-[#7d8190] tabular-nums">
                              {lesson.durationMinutes}min
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors font-albert font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 text-sm bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors font-albert font-medium shadow-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function UnifiedResourcesTabs({
  resourceAssignments,
  onResourceAssignmentsChange,
  availableCourses,
  availableVideos = [],
  availableArticles,
  availableDownloads,
  availableLinks,
  availableQuestionnaires,
  programId,
  includeWeekends = true,
  contentCompletion,
  calendarStartDate,
}: UnifiedResourcesTabsProps) {
  const [activeTab, setActiveTab] = useState<ResourceType>('courses');
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  // Course editing state
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Get course by ID
  const getCourse = (courseId: string) => availableCourses.find(c => c.id === courseId);

  // Close mobile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target as Node)) {
        setMobileDropdownOpen(false);
      }
    };
    if (mobileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileDropdownOpen]);

  // Get assignments by type
  const assignmentsByType = useMemo(() => {
    const byType: Record<WeekResourceAssignment['resourceType'], WeekResourceAssignment[]> = {
      course: [],
      video: [],
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
    videos: assignmentsByType.video.length,
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

  // Generate lesson-to-day mapping for multi-day course assignments
  const generateLessonDayMapping = (
    courseId: string,
    days: number[]
  ): Record<string, number> | undefined => {
    if (days.length < 1) return undefined;

    const course = availableCourses.find(c => c.id === courseId);
    if (!course?.modules) return undefined;

    // Collect all lesson IDs in order
    const lessonIds: string[] = [];
    course.modules.forEach(mod => {
      mod.lessons?.forEach(lesson => {
        lessonIds.push(lesson.id);
      });
    });

    if (lessonIds.length === 0) return undefined;

    // Distribute lessons across selected days
    const mapping: Record<string, number> = {};
    const lessonsPerDay = Math.ceil(lessonIds.length / days.length);

    lessonIds.forEach((lessonId, index) => {
      const dayIndex = Math.min(Math.floor(index / lessonsPerDay), days.length - 1);
      mapping[lessonId] = days[dayIndex];
    });

    return mapping;
  };

  // Update dayTag (and generate lesson mapping for multi-day courses)
  const updateDayTag = (assignmentId: string, dayTag: ResourceDayTag) => {
    const daysInWeek = includeWeekends ? 7 : 5;

    onResourceAssignmentsChange(
      resourceAssignments.map((a) => {
        if (a.id !== assignmentId) return a;

        // Generate lesson mapping if this is a course
        let lessonDayMapping: Record<string, number> | undefined;
        if (a.resourceType === 'course') {
          if (dayTag === 'spread') {
            // Auto-spread: distribute lessons across all weekdays
            const allDays = Array.from({ length: daysInWeek }, (_, i) => i + 1);
            lessonDayMapping = generateLessonDayMapping(a.resourceId, allDays);
          } else if (Array.isArray(dayTag) && dayTag.length >= 1) {
            // Multiple specific days selected
            lessonDayMapping = generateLessonDayMapping(a.resourceId, dayTag);
          } else if (typeof dayTag === 'number') {
            // Single day selected - wrap in array for mapping generation
            lessonDayMapping = generateLessonDayMapping(a.resourceId, [dayTag]);
          }
          // For 'week' or 'daily', no lesson mapping (entire course available)
        }

        return { ...a, dayTag, lessonDayMapping };
      })
    );
  };

  // Course editing handlers
  const toggleModuleExpand = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const toggleModuleSelection = (module: CourseModule) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(module.id)) {
        next.delete(module.id);
        // Also deselect all lessons in this module
        const lessonIds = (module.lessons || []).map(l => l.id);
        setSelectedLessons(prevLessons => {
          const nextLessons = new Set(prevLessons);
          lessonIds.forEach(id => nextLessons.delete(id));
          return nextLessons;
        });
      } else {
        next.add(module.id);
        // Also select all lessons in this module
        const lessonIds = (module.lessons || []).map(l => l.id);
        setSelectedLessons(prevLessons => {
          const nextLessons = new Set(prevLessons);
          lessonIds.forEach(id => nextLessons.add(id));
          return nextLessons;
        });
      }
      return next;
    });
  };

  const toggleLessonSelection = (lessonId: string, moduleId: string, module: CourseModule) => {
    setSelectedLessons(prev => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }

      // Check if all lessons in module are now selected
      const moduleLessonIds = (module.lessons || []).map(l => l.id);
      const allSelected = moduleLessonIds.length > 0 && moduleLessonIds.every(id => next.has(id));
      const noneSelected = moduleLessonIds.every(id => !next.has(id));

      // Update module selection state
      setSelectedModules(prevModules => {
        const nextModules = new Set(prevModules);
        if (allSelected) {
          nextModules.add(moduleId);
        } else if (noneSelected) {
          nextModules.delete(moduleId);
        }
        return nextModules;
      });

      return next;
    });
  };

  // Start editing an existing course assignment
  const handleEditCourse = (assignment: WeekResourceAssignment) => {
    setEditingCourseId(assignment.resourceId);
    setSelectedModules(new Set(assignment.moduleIds || []));
    setSelectedLessons(new Set(assignment.lessonIds || []));
    // Expand modules that have selected lessons
    const course = getCourse(assignment.resourceId);
    if (course?.modules && assignment.lessonIds?.length) {
      const modulesToExpand = new Set<string>();
      for (const module of course.modules) {
        if (module.lessons?.some(l => assignment.lessonIds?.includes(l.id))) {
          modulesToExpand.add(module.id);
        }
      }
      setExpandedModules(modulesToExpand);
    } else {
      setExpandedModules(new Set());
    }
  };

  // Save course edit
  const handleSaveCourseEdit = () => {
    if (!editingCourseId) return;

    onResourceAssignmentsChange(
      resourceAssignments.map(a => {
        if (a.resourceType !== 'course' || a.resourceId !== editingCourseId) return a;
        return {
          ...a,
          moduleIds: selectedModules.size > 0 ? Array.from(selectedModules) : undefined,
          lessonIds: selectedLessons.size > 0 ? Array.from(selectedLessons) : undefined,
        };
      })
    );

    // Reset edit state
    setEditingCourseId(null);
    setSelectedModules(new Set());
    setSelectedLessons(new Set());
    setExpandedModules(new Set());
  };

  // Cancel course edit
  const handleCancelCourseEdit = () => {
    setEditingCourseId(null);
    setSelectedModules(new Set());
    setSelectedLessons(new Set());
    setExpandedModules(new Set());
  };

  // Handle new course selection from dropdown
  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedModules(new Set());
    setSelectedLessons(new Set());
    setExpandedModules(new Set());
  };

  // Add newly selected course
  const handleAddCourse = () => {
    if (!selectedCourseId) return;
    if (assignmentsByType.course.some(a => a.resourceId === selectedCourseId)) return;

    addResource('course', selectedCourseId, {
      moduleIds: selectedModules.size > 0 ? Array.from(selectedModules) : undefined,
      lessonIds: selectedLessons.size > 0 ? Array.from(selectedLessons) : undefined,
    });

    // Reset selection state
    setSelectedCourseId(null);
    setSelectedModules(new Set());
    setSelectedLessons(new Set());
    setExpandedModules(new Set());
  };

  // Cancel new course selection
  const handleCancelCourseSelect = () => {
    setSelectedCourseId(null);
    setSelectedModules(new Set());
    setSelectedLessons(new Set());
    setExpandedModules(new Set());
  };

  // Get course assignment subtext
  const getCourseSubtext = (assignment: WeekResourceAssignment) => {
    const moduleCount = assignment.moduleIds?.length || 0;
    const lessonCount = assignment.lessonIds?.length || 0;
    if (moduleCount === 0 && lessonCount === 0) return 'Full course';
    const parts: string[] = [];
    if (moduleCount > 0) parts.push(`${moduleCount} module${moduleCount !== 1 ? 's' : ''}`);
    if (lessonCount > 0) parts.push(`${lessonCount} lesson${lessonCount !== 1 ? 's' : ''}`);
    return parts.join(', ');
  };

  // Filter out already assigned courses for the dropdown
  const unassignedCourses = availableCourses.filter(
    c => !assignmentsByType.course.some(a => a.resourceId === c.id)
  );

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
  const availableVideosToLink = availableVideos.filter(
    (v) => !getLinkedIds('video').includes(v.id)
  );

  // Split into program vs platform content
  const programArticles = availableArticlesToLink.filter((a) => a.programId === programId);
  const platformArticles = availableArticlesToLink.filter((a) => a.programId !== programId);
  const programDownloads = availableDownloadsToLink.filter((d) => d.programId === programId);
  const platformDownloads = availableDownloadsToLink.filter((d) => d.programId !== programId);
  const programLinks = availableLinksToLink.filter((l) => l.programId === programId);
  const platformLinks = availableLinksToLink.filter((l) => l.programId !== programId);
  // Videos use programIds array instead of single programId
  const programVideos = availableVideosToLink.filter((v) => v.programIds?.includes(programId || ''));
  const platformVideos = availableVideosToLink.filter((v) => !v.programIds?.includes(programId || ''));

  // Helper to get title for an assignment
  const getTitle = (
    assignment: WeekResourceAssignment,
    availableItems: ResourceItem[] | DiscoverCourse[]
  ) => {
    const item = availableItems.find((i) => i.id === assignment.resourceId);
    return item?.title || `Item ${assignment.resourceId.slice(0, 8)}...`;
  };

  // Get active tab config
  const activeTabConfig = TABS.find((t) => t.id === activeTab) || TABS[0];
  const ActiveIcon = activeTabConfig.icon;

  // Track dropdown button position for portal
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate position and open dropdown
  const handleOpenDropdown = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = TABS.length * 44 + 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      setDropdownPosition({
        top: openUp ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
      setMobileDropdownOpen(true);
    }
  };

  const handleCloseDropdown = () => {
    setMobileDropdownOpen(false);
    setDropdownPosition(null);
  };

  return (
    <div className="space-y-4">
      {/* Mobile Dropdown */}
      <div className="sm:hidden" ref={mobileDropdownRef}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => mobileDropdownOpen ? handleCloseDropdown() : handleOpenDropdown()}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[#f3f1ef] dark:bg-[#11141b] rounded-2xl text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]"
        >
          <div className="flex items-center gap-2">
            <ActiveIcon className="w-4 h-4 text-brand-accent" />
            <span className="font-albert">{activeTabConfig.label}</span>
            {counts[activeTab] > 0 && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-brand-accent/15 text-brand-accent">
                {counts[activeTab]}
              </span>
            )}
          </div>
          <ChevronDown className={cn('w-4 h-4 text-[#8c8c8c] transition-transform', mobileDropdownOpen && 'rotate-180')} />
        </button>
        {mobileDropdownOpen && dropdownPosition && typeof document !== 'undefined' && createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={handleCloseDropdown}
            />
            <div
              className="fixed z-[9999] bg-white dark:bg-[#1e222a] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100"
              style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width }}
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const count = counts[tab.id];
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      handleCloseDropdown();
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-4 py-2.5 text-sm font-albert transition-colors',
                      isActive
                        ? 'bg-brand-accent/10 text-brand-accent'
                        : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', isActive && 'text-brand-accent')} />
                    <span className="flex-1 text-left">{tab.label}</span>
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
          </>,
          document.body
        )}
      </div>

      {/* Desktop Tab Bar */}
      <div className="hidden sm:flex bg-[#f3f1ef] dark:bg-[#11141b] rounded-2xl p-1.5 gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
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
              <span className="font-albert">{tab.label}</span>
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
      <div key={activeTab} className="min-h-[120px] animate-fadeIn">
        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="space-y-3">
            {/* Course assignments - unified card with edit panel */}
            {assignmentsByType.course.length > 0 && (
              <div className="space-y-2 mb-4">
                {assignmentsByType.course.map((assignment) => {
                  const course = getCourse(assignment.resourceId);
                  const isEditing = editingCourseId === assignment.resourceId;
                  const totalLessons = course?.modules?.reduce(
                    (sum, mod) => sum + (mod.lessons?.length || 0),
                    0
                  ) || 0;

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
                      courseInfo={{ totalLessons, title: course?.title }}
                      calendarStartDate={calendarStartDate}
                      coverImageUrl={course?.coverImageUrl}
                      subtext={getCourseSubtext(assignment)}
                      onEdit={() => isEditing ? handleCancelCourseEdit() : handleEditCourse(assignment)}
                      isEditing={isEditing}
                      editPanelContent={course?.modules && (
                        <CourseEditPanel
                          modules={course.modules}
                          selectedModules={selectedModules}
                          selectedLessons={selectedLessons}
                          expandedModules={expandedModules}
                          onToggleModuleExpand={toggleModuleExpand}
                          onToggleModuleSelection={toggleModuleSelection}
                          onToggleLessonSelection={toggleLessonSelection}
                          onSave={handleSaveCourseEdit}
                          onCancel={handleCancelCourseEdit}
                        />
                      )}
                    />
                  );
                })}
              </div>
            )}

            {/* Course selection dropdown */}
            <ResourceLinkDropdown
              placeholder="Add a course..."
              icon={GraduationCap}
              groups={[
                {
                  label: 'Available Courses',
                  items: unassignedCourses.map(c => ({ id: c.id, title: c.title })),
                  iconClassName: 'text-brand-accent',
                },
              ]}
              onSelect={handleCourseSelect}
            />

            {/* New course selection panel */}
            {selectedCourseId && (() => {
              const course = getCourse(selectedCourseId);
              if (!course) return null;
              return (
                <div className="p-4 bg-[#faf8f6] dark:bg-[#1d222b] rounded-2xl shadow-sm border border-[#e1ddd8] dark:border-[#262b35] space-y-4">
                  {/* Course preview */}
                  <div className="flex items-start gap-3 p-3 bg-white dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
                    {course.coverImageUrl && (
                      <img
                        src={course.coverImageUrl}
                        alt={course.title}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {course.title}
                      </h4>
                      {course.shortDescription && (
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] line-clamp-2 font-albert mt-1">
                          {course.shortDescription.replace(/<[^>]*>/g, '')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Module/lesson selection */}
                  {course.modules && course.modules.length > 0 && (
                    <>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        Select specific content (leave empty for full course)
                      </p>
                      <div className="max-h-64 overflow-y-auto space-y-1 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-2 bg-white dark:bg-[#11141b]">
                        {course.modules.map((module) => (
                          <div key={module.id}>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleModuleExpand(module.id)}
                                className="p-1 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded"
                              >
                                {expandedModules.has(module.id) ? (
                                  <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                                )}
                              </button>
                              <div
                                className="flex items-center gap-2 flex-1 cursor-pointer"
                                onClick={() => toggleModuleSelection(module)}
                              >
                                <BrandedCheckbox
                                  checked={selectedModules.has(module.id)}
                                  onChange={() => {}}
                                />
                                <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                                  {module.title}
                                </span>
                                <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                                  ({module.lessons?.length || 0} lessons)
                                </span>
                              </div>
                            </div>
                            {expandedModules.has(module.id) && module.lessons && (
                              <div className="ml-8 mt-1 space-y-1">
                                {module.lessons.map((lesson) => (
                                  <div
                                    key={lesson.id}
                                    className="flex items-center gap-2 py-1 cursor-pointer"
                                    onClick={() => toggleLessonSelection(lesson.id, module.id, module)}
                                  >
                                    <BrandedCheckbox
                                      checked={selectedLessons.has(lesson.id)}
                                      onChange={() => {}}
                                    />
                                    <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                                      {lesson.title}
                                    </span>
                                    {lesson.durationMinutes && (
                                      <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                                        {lesson.durationMinutes}min
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Add/Cancel buttons */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancelCourseSelect}
                      className="px-3 py-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors font-albert"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCourse}
                      className="px-3 py-1.5 text-sm bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors font-albert"
                    >
                      Add Course
                    </button>
                  </div>
                </div>
              );
            })()}

            {assignmentsByType.course.length === 0 && unassignedCourses.length === 0 && !selectedCourseId && (
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-3 text-center">
                No courses available
              </p>
            )}
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <div>
            {assignmentsByType.video.length > 0 && (
              <div className="space-y-2 mb-4">
                {assignmentsByType.video.map((assignment) => {
                  const video = availableVideos.find(v => v.id === assignment.resourceId);
                  return (
                    <LinkedResourceItem
                      key={assignment.id}
                      assignment={assignment}
                      title={video?.title || `Video ${assignment.resourceId.slice(0, 8)}...`}
                      icon={Video}
                      onRemove={() => removeResource(assignment.id)}
                      onDayTagChange={(dayTag) => updateDayTag(assignment.id, dayTag)}
                      includeWeekends={includeWeekends}
                      completion={contentCompletion?.get(assignment.resourceId)}
                      calendarStartDate={calendarStartDate}
                    />
                  );
                })}
              </div>
            )}
            <ResourceLinkDropdown
              placeholder="Add a video..."
              icon={Video}
              groups={[
                {
                  label: 'Program Content',
                  items: programVideos.map((v) => ({ id: v.id, title: v.title })),
                  iconClassName: 'text-brand-accent',
                },
                {
                  label: 'Platform Content',
                  items: platformVideos.map((v) => ({ id: v.id, title: v.title })),
                  iconClassName: 'text-[#8c8c8c]',
                },
              ]}
              onSelect={(id) => addResource('video', id)}
              onCreateNew={() => {
                window.location.href = '/coach?tab=discover';
              }}
              createNewLabel="Create new video"
            />
            {assignmentsByType.video.length === 0 && availableVideosToLink.length === 0 && (
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic mt-3 text-center">
                No videos available
              </p>
            )}
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
                    calendarStartDate={calendarStartDate}
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
                    calendarStartDate={calendarStartDate}
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
                    calendarStartDate={calendarStartDate}
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
                    icon={ClipboardList}
                    onRemove={() => removeResource(assignment.id)}
                    onDayTagChange={(dayTag) => updateDayTag(assignment.id, dayTag)}
                    includeWeekends={includeWeekends}
                    calendarStartDate={calendarStartDate}
                  />
                ))}
              </div>
            )}
            <ResourceLinkDropdown
              placeholder="Add a questionnaire..."
              icon={ClipboardList}
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
