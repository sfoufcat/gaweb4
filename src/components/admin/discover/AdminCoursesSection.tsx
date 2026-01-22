'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Pencil, Trash2, ChevronLeft, ChevronRight, Search, X, Plus } from 'lucide-react';
import type { DiscoverCourse } from '@/types/discover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CourseEditor } from './CourseEditor';
import { CreateCourseModal } from './CreateCourseModal';

interface AdminCoursesSectionProps {
  apiEndpoint?: string;
  /** Initial course ID for URL persistence */
  initialCourseId?: string | null;
  /** Callback when course selection changes (for URL persistence) */
  onCourseSelect?: (courseId: string | null) => void;
  /** Callback when editor mode changes (for hiding parent UI) */
  onEditorModeChange?: (isEditing: boolean) => void;
}

export function AdminCoursesSection({
  apiEndpoint = '/api/admin/discover/courses',
  initialCourseId,
  onCourseSelect,
  onEditorModeChange,
}: AdminCoursesSectionProps) {
  const [courses, setCourses] = useState<DiscoverCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [filtersWidth, setFiltersWidth] = useState(200);
  const filtersRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [courseToDelete, setCourseToDelete] = useState<DiscoverCourse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // View mode state: 'list' or 'editor'
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [selectedCourse, setSelectedCourse] = useState<DiscoverCourse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Track last processed course ID to prevent re-opening after close
  const lastProcessedCourseId = useRef<string | null>(null);

  // Derive endpoints from API endpoint - use coach endpoints for coach routes
  const isCoachContext = apiEndpoint.includes('/coach/');
  const uploadEndpoint = isCoachContext 
    ? '/api/coach/org-upload-media' 
    : '/api/admin/upload-media';
  const programsApiEndpoint = isCoachContext 
    ? '/api/coach/org-programs' 
    : '/api/admin/programs';

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch courses');
      }
      const data = await response.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify parent when editor mode changes
  useEffect(() => {
    onEditorModeChange?.(viewMode === 'editor');
  }, [viewMode, onEditorModeChange]);

  // Handle initial course ID from URL
  useEffect(() => {
    // Skip if we've already processed this courseId (prevents re-opening after close)
    if (initialCourseId === lastProcessedCourseId.current) return;

    if (initialCourseId && courses.length > 0 && viewMode === 'list') {
      lastProcessedCourseId.current = initialCourseId;
      if (initialCourseId === 'new') {
        // Creating new course - open the modal
        setShowCreateModal(true);
      } else {
        // Editing existing course
        const course = courses.find(c => c.id === initialCourseId);
        if (course) {
          setSelectedCourse(course);
          setIsCreating(false);
          setViewMode('editor');
        }
      }
    } else if (!initialCourseId) {
      // Reset when courseId is cleared from URL
      lastProcessedCourseId.current = null;
    }
  }, [initialCourseId, courses, viewMode]);

  // Handle opening course editor
  const handleEditCourse = (course: DiscoverCourse) => {
    setSelectedCourse(course);
    setIsCreating(false);
    setViewMode('editor');
    onCourseSelect?.(course.id);
  };

  // Handle creating new course - open the modal
  const handleCreateCourse = () => {
    setShowCreateModal(true);
  };

  // Handle course created from modal - navigate to editor
  const handleCourseCreated = async (courseId: string) => {
    setShowCreateModal(false);
    await fetchCourses();
    // Find the newly created course and open editor
    const response = await fetch(`${apiEndpoint}/${courseId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.course) {
        setSelectedCourse(data.course);
        setIsCreating(false);
        setViewMode('editor');
        onCourseSelect?.(courseId);
      }
    }
  };

  // Handle closing editor
  const handleCloseEditor = () => {
    setViewMode('list');
    setSelectedCourse(null);
    setIsCreating(false);
    onCourseSelect?.(null);
  };

  // Handle save success
  const handleSaveSuccess = async () => {
    await fetchCourses();
    handleCloseEditor();
  };

  // Get unique categories and levels
  const categories = useMemo(() => {
    const cats = new Set(courses.map(c => c.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [courses]);

  const levels = useMemo(() => {
    const lvls = new Set(courses.map(c => c.level).filter(Boolean));
    return Array.from(lvls).sort();
  }, [courses]);

  // Measure filters width for animated search expansion
  useEffect(() => {
    if (filtersRef.current && !isSearchExpanded) {
      setFiltersWidth(filtersRef.current.offsetWidth);
    }
  }, [categories, levels, isSearchExpanded]);

  const handleSearchExpand = useCallback(() => {
    setIsSearchExpanded(true);
    // Focus after animation starts
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSearchCollapse = useCallback(() => {
    setIsSearchExpanded(false);
    setSearchQuery('');
  }, []);

  const filteredCourses = useMemo(() => {
    let filtered = courses;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(query)
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(course => course.category === categoryFilter);
    }

    if (levelFilter) {
      filtered = filtered.filter(course => course.level === levelFilter);
    }

    return filtered;
  }, [courses, searchQuery, categoryFilter, levelFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, levelFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);
  const paginatedCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCourses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCourses, currentPage, ITEMS_PER_PAGE]);

  const handleDelete = async () => {
    if (!courseToDelete) return;
    
    try {
      setDeleteLoading(true);
      // Use dynamic apiEndpoint instead of hardcoded admin route
      const response = await fetch(`${apiEndpoint}/${courseToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete course');
      }
      
      await fetchCourses();
      setCourseToDelete(null);
    } catch (err) {
      console.error('Error deleting course:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete course');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          <div className="h-10 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#faf8f6] dark:bg-[#11141b] rounded-xl overflow-hidden">
              <div className="h-40 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-4 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                  <div className="h-5 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center text-red-600">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button onClick={fetchCourses} className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Show full-page editor when in editor mode
  if (viewMode === 'editor') {
    return (
      <CourseEditor
        course={isCreating ? null : selectedCourse}
        onClose={handleCloseEditor}
        onSave={handleSaveSuccess}
        uploadEndpoint={uploadEndpoint}
        programsApiEndpoint={programsApiEndpoint}
        apiEndpoint={apiEndpoint}
      />
    );
  }

  return (
    <>
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
          <div className="flex items-center justify-between gap-3">
            {/* Title with inline count */}
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Courses ({filteredCourses.length})
            </h2>

            <div className="flex items-center gap-2 ml-auto relative">
              {/* Animated search input - expands over filters */}
              <div
                className={cn(
                  "flex items-center overflow-hidden transition-all duration-300 ease-out",
                  isSearchExpanded ? "opacity-100" : "w-0 opacity-0"
                )}
                style={{ width: isSearchExpanded ? `${filtersWidth}px` : 0 }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-brand-accent/20 font-albert"
                />
              </div>

              {/* Filters container - hidden when search expanded */}
              <div
                ref={filtersRef}
                className={cn(
                  "flex items-center gap-2 transition-all duration-300 ease-out",
                  isSearchExpanded && "opacity-0 pointer-events-none absolute right-16 w-0 overflow-hidden"
                )}
              >
                {categories.length > 0 && (
                  <Select
                    value={categoryFilter || 'all'}
                    onValueChange={(value) => setCategoryFilter(value === 'all' ? '' : value)}
                  >
                    <SelectTrigger className="h-auto px-3 py-1.5 w-auto bg-transparent border-0 shadow-none text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] focus:ring-0 ring-offset-0 font-albert text-sm gap-1.5 !justify-start">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {levels.length > 0 && (
                  <Select
                    value={levelFilter || 'all'}
                    onValueChange={(value) => setLevelFilter(value === 'all' ? '' : value)}
                  >
                    <SelectTrigger className="h-auto px-3 py-1.5 w-auto bg-transparent border-0 shadow-none text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] focus:ring-0 ring-offset-0 font-albert text-sm gap-1.5 !justify-start">
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      {levels.map(level => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Search toggle button */}
              <button
                onClick={isSearchExpanded ? handleSearchCollapse : handleSearchExpand}
                className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              >
                {isSearchExpanded ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>

              {/* Plus button - always visible */}
              <button
                onClick={handleCreateCourse}
                className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Course Cards */}
        <div className="divide-y divide-[#e8e4df] dark:divide-[#262b35]">
          {paginatedCourses.map(course => (
            <div
              key={course.id}
              onClick={() => handleEditCourse(course)}
              className="flex items-center gap-4 p-3 bg-white dark:bg-[#171b22] hover:bg-[#faf8f6] dark:hover:bg-[#1c2028] cursor-pointer transition-all group first:rounded-t-xl last:rounded-b-xl"
            >
              {/* Cover Image */}
              <div className="relative w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                {course.coverImageUrl ? (
                  <Image
                    src={course.coverImageUrl}
                    alt={course.title}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6470]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Course Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate group-hover:text-brand-accent transition-colors">
                  {course.title}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  <span>{course.category}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{course.level}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{course.totalModules || course.modules?.length || 0} modules</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{course.totalLessons || course.modules?.reduce((sum, m) => sum + m.lessons.length, 0) || 0} lessons</span>
                </div>
              </div>

              {/* Badges */}
              <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                {course.featured && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-albert">
                    Featured
                  </span>
                )}
                {course.trending && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-albert">
                    Trending
                  </span>
                )}
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditCourse(course);
                  }}
                  className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCourseToDelete(course);
                  }}
                  className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredCourses.length === 0 && (
          <div className="px-3 pb-3">
            <div className="p-12 text-center">
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No courses found</p>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[#e1ddd8] dark:border-[#262b35]/50 flex items-center justify-between">
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredCourses.length)} of {filteredCourses.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium font-albert transition-colors ${
                    currentPage === page
                      ? 'bg-brand-accent text-white'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!courseToDelete} onOpenChange={open => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Delete Course</AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              Are you sure you want to delete &quot;<strong>{courseToDelete?.title}</strong>&quot;? This will also delete all modules and lessons. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} className="font-albert">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 font-albert"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Course Modal */}
      <CreateCourseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCourseCreated={handleCourseCreated}
        apiEndpoint={apiEndpoint}
        programsApiEndpoint={programsApiEndpoint}
        uploadEndpoint={uploadEndpoint}
      />
    </>
  );
}

