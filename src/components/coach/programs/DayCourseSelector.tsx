'use client';

import React, { useState } from 'react';
import { GraduationCap, X, ChevronDown, ChevronRight, Play, Clock, Layers } from 'lucide-react';
import type { DayCourseAssignment } from '@/types';
import type { DiscoverCourse, CourseModule } from '@/types/discover';
import { ResourceLinkDropdown } from './ResourceLinkDropdown';
import { BrandedCheckbox } from '@/components/ui/checkbox';

// Strip HTML tags from text
function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

interface DayCourseSelectorProps {
  currentAssignments: DayCourseAssignment[];
  onChange: (assignments: DayCourseAssignment[]) => void;
  availableCourses?: DiscoverCourse[];
}

export function DayCourseSelector({ currentAssignments, onChange, availableCourses = [] }: DayCourseSelectorProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Track selected modules/lessons for the currently selected course
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());

  // Get course by ID
  const getCourse = (courseId: string) => availableCourses.find(c => c.id === courseId);

  // Filter out already assigned courses
  const unassignedCourses = availableCourses.filter(
    c => !currentAssignments.some(a => a.courseId === c.id)
  );

  // Toggle module expansion
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

  // Toggle module selection
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

  // Toggle lesson selection
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

  // Handle course selection from dropdown
  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedModules(new Set());
    setSelectedLessons(new Set());
    setExpandedModules(new Set());
  };

  // Add the selected course as an assignment
  const handleAddCourse = () => {
    if (!selectedCourseId) return;

    // Check if course is already assigned
    if (currentAssignments.some(a => a.courseId === selectedCourseId)) {
      return;
    }

    const newAssignment: DayCourseAssignment = {
      courseId: selectedCourseId,
      moduleIds: selectedModules.size > 0 ? Array.from(selectedModules) : undefined,
      lessonIds: selectedLessons.size > 0 ? Array.from(selectedLessons) : undefined,
    };

    onChange([...currentAssignments, newAssignment]);

    // Reset selection state
    setSelectedCourseId(null);
    setSelectedModules(new Set());
    setSelectedLessons(new Set());
    setExpandedModules(new Set());
  };

  // Remove an assignment
  const handleRemove = (courseId: string) => {
    onChange(currentAssignments.filter(a => a.courseId !== courseId));
  };

  // Get display info for an assignment
  const getAssignmentDisplay = (assignment: DayCourseAssignment) => {
    const course = getCourse(assignment.courseId);
    if (!course) return null;

    // Get selected module/lesson names for display
    let selectedContent: string[] = [];

    if (assignment.moduleIds && assignment.moduleIds.length > 0 && course.modules) {
      const moduleNames = assignment.moduleIds
        .map(id => course.modules?.find(m => m.id === id)?.title)
        .filter(Boolean) as string[];
      selectedContent = moduleNames;
    } else if (assignment.lessonIds && assignment.lessonIds.length > 0 && course.modules) {
      // Find lesson names across all modules
      const lessonNames: string[] = [];
      for (const module of course.modules) {
        if (module.lessons) {
          for (const lesson of module.lessons) {
            if (assignment.lessonIds.includes(lesson.id)) {
              lessonNames.push(lesson.title);
            }
          }
        }
      }
      selectedContent = lessonNames;
    }

    let subtext = '';
    if (selectedContent.length > 0) {
      if (selectedContent.length <= 2) {
        subtext = selectedContent.join(', ');
      } else {
        subtext = `${selectedContent.slice(0, 2).join(', ')} +${selectedContent.length - 2} more`;
      }
    } else {
      subtext = 'Full course';
    }

    return { course, subtext };
  };

  const selectedCourse = selectedCourseId ? getCourse(selectedCourseId) : null;

  return (
    <div className="space-y-4">
      {/* Current assignments */}
      {currentAssignments.length > 0 && (
        <div className="space-y-2">
          {currentAssignments.map(assignment => {
            const display = getAssignmentDisplay(assignment);
            if (!display) return null;

            return (
              <div
                key={assignment.courseId}
                className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#1d222b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]"
              >
                {display.course.coverImageUrl && (
                  <img
                    src={display.course.coverImageUrl}
                    alt={display.course.title}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate font-albert">
                    {display.course.title}
                  </p>
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                    {display.subtext}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(assignment.courseId)}
                  className="p-1.5 text-[#a7a39e] dark:text-[#7d8190] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Course dropdown using ResourceLinkDropdown */}
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
        onCreateNew={() => { window.location.href = '/coach?tab=discover'; }}
        createNewLabel="Create new course"
      />

      {/* Course preview with module/lesson selection - shows when course selected */}
      {selectedCourse && (
        <div className="p-4 bg-[#faf8f6] dark:bg-[#1d222b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35] space-y-4">
          {/* Course card preview */}
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]">
            {selectedCourse.coverImageUrl && (
              <img
                src={selectedCourse.coverImageUrl}
                alt={selectedCourse.title}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {selectedCourse.title}
              </h4>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] line-clamp-2 font-albert mt-1">
                {stripHtml(selectedCourse.shortDescription || '')}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-[#a7a39e] dark:text-[#7d8190]">
                {selectedCourse.totalModules && (
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {selectedCourse.totalModules} modules
                  </span>
                )}
                {selectedCourse.totalLessons && (
                  <span className="flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    {selectedCourse.totalLessons} lessons
                  </span>
                )}
                {selectedCourse.totalDurationMinutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {Math.round(selectedCourse.totalDurationMinutes / 60)}h
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Module/lesson tree */}
          {selectedCourse.modules && selectedCourse.modules.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Select specific content (optional - leave empty for full course)
              </p>
              <div className="max-h-64 overflow-y-auto space-y-1 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-2 bg-white dark:bg-[#11141b]">
                {selectedCourse.modules.map((module) => (
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
                          onChange={() => toggleModuleSelection(module)}
                        />
                        <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                          {module.title}
                        </span>
                        <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                          ({module.lessons?.length || 0} lessons)
                        </span>
                      </div>
                    </div>

                    {/* Lessons */}
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
                              onChange={() => toggleLessonSelection(lesson.id, module.id, module)}
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
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCourseId(null);
                setSelectedModules(new Set());
                setSelectedLessons(new Set());
                setExpandedModules(new Set());
              }}
              className="px-3 py-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors font-albert"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddCourse}
              disabled={!selectedCourseId}
              className="px-3 py-1.5 text-sm bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-albert"
            >
              Add Course
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
