'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Pencil, Trash2, ChevronLeft, ChevronRight, Search, X, Plus, Layers, PlayCircle } from 'lucide-react';
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

// Strip HTML tags for plain text display
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

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
  const [courseToDelete, setCourseToDelete] = useState<DiscoverCourse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  // View mode state: 'list' or 'editor'
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [selectedCourse, setSelectedCourse] = useState<DiscoverCourse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Track last processed course ID to prevent re-opening after close
  const lastProcessedCourseId = useRef<string | null>(null);

  // Track if we're closing - prevents race condition with async URL update
  const isClosingRef = useRef(false);

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
    // Never process while in editor mode - prevents accidental re-opening
    if (viewMode === 'editor') return;

    // Skip if we're in the process of closing (URL update is async)
    if (isClosingRef.current) {
      // Reset the flag once URL has caught up (initialCourseId is now null)
      if (!initialCourseId) {
        isClosingRef.current = false;
        lastProcessedCourseId.current = null;
      }
      return;
    }

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
    // Mark that we're closing - prevents useEffect from re-opening before URL updates
    isClosingRef.current = true;
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

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(courses.map(c => c.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [courses]);

  // Measure filters width for animated search expansion
  useEffect(() => {
    if (filtersRef.current && !isSearchExpanded) {
      setFiltersWidth(filtersRef.current.offsetWidth);
    }
  }, [categories, isSearchExpanded]);

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

    return filtered;
  }, [courses, searchQuery, categoryFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter]);

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
            <div key={i} className="bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
              <div className="aspect-video bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-4 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="flex items-center justify-between">
                  <div className="flex gap-3">
                    <div className="h-4 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                    <div className="h-4 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                  </div>
                  <div className="flex gap-1">
                    <div className="w-8 h-8 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
                    <div className="w-8 h-8 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
                  </div>
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
                className="flex items-center gap-2 px-2.5 py-1.5 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline text-[15px] font-medium">New Course</span>
              </button>
            </div>
          </div>
        </div>

        {/* Course Cards */}
        <div className="p-4 sm:p-6">
          {filteredCourses.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f3f1ef] dark:bg-[#1e222a] flex items-center justify-center">
                <svg className="w-8 h-8 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {searchQuery
                  ? 'No courses found'
                  : 'No courses yet. Create your first course to get started.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedCourses.map(course => (
                <div
                  key={course.id}
                  onClick={() => handleEditCourse(course)}
                  className="group bg-[#faf8f6] dark:bg-[#11141b] rounded-xl overflow-hidden border border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50 transition-colors cursor-pointer"
                >
                  {/* Cover Image */}
                  <div className="relative aspect-video bg-gradient-to-br from-blue-500 to-indigo-600 overflow-hidden">
                    {course.coverImageUrl ? (
                      <Image
                        src={course.coverImageUrl}
                        alt={course.title}
                        fill
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                        <svg className="w-12 h-12 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
                  </div>

                  {/* Course Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {course.title}
                    </h3>
                    {course.shortDescription && (
                      <p className="mt-1 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert line-clamp-2">
                        {stripHtml(course.shortDescription)}
                      </p>
                    )}

                    {/* Metadata + Actions row */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        <span className="inline-flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          {course.totalModules || course.modules?.length || 0} modules
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <PlayCircle className="w-3.5 h-3.5" />
                          {course.totalLessons || course.modules?.reduce((sum, m) => sum + m.lessons.length, 0) || 0} lessons
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCourse(course);
                          }}
                          className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors"
                          title="Edit course"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseToDelete(course);
                          }}
                          className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete course"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

