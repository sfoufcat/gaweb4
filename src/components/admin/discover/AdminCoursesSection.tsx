'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DiscoverCourse } from '@/types/discover';
import type { UserTrack } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

// Track options for dropdown
const TRACK_OPTIONS: { value: UserTrack | ''; label: string }[] = [
  { value: '', label: 'All Tracks (No specific track)' },
  { value: 'content_creator', label: 'Creator' },
  { value: 'saas', label: 'SaaS' },
  { value: 'coach_consultant', label: 'Coach/Consultant' },
  { value: 'ecom', label: 'Ecom' },
  { value: 'agency', label: 'Agency' },
  { value: 'community_builder', label: 'Community Builder' },
  { value: 'general', label: 'General' },
];

// Helper to get track display name
const getTrackDisplayName = (track: UserTrack | null | undefined): string => {
  if (!track) return '—';
  const option = TRACK_OPTIONS.find(t => t.value === track);
  return option?.label || track;
};

interface AdminCoursesSectionProps {
  apiEndpoint?: string;
  /** Initial course ID for URL persistence */
  initialCourseId?: string | null;
  /** Callback when course selection changes (for URL persistence) */
  onCourseSelect?: (courseId: string | null) => void;
}

export function AdminCoursesSection({
  apiEndpoint = '/api/admin/discover/courses',
  initialCourseId,
  onCourseSelect,
}: AdminCoursesSectionProps) {
  const [courses, setCourses] = useState<DiscoverCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [courseToDelete, setCourseToDelete] = useState<DiscoverCourse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // View mode state: 'list' or 'editor'
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [selectedCourse, setSelectedCourse] = useState<DiscoverCourse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  // Handle initial course ID from URL
  useEffect(() => {
    if (initialCourseId && courses.length > 0 && viewMode === 'list') {
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
    
    if (trackFilter) {
      if (trackFilter === 'none') {
        filtered = filtered.filter(course => !course.track);
      } else {
        filtered = filtered.filter(course => course.track === trackFilter);
      }
    }
    
    return filtered;
  }, [courses, searchQuery, categoryFilter, levelFilter, trackFilter]);

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
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Courses</h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-48 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border border-transparent focus:border-[#e1ddd8] dark:focus:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9ca3af] focus:outline-none font-albert"
                />
              </div>

              {/* Category Filter */}
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

              {/* Level Filter */}
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

              {/* Track Filter */}
              <Select
                value={trackFilter || 'all'}
                onValueChange={(value) => setTrackFilter(value === 'all' ? '' : value)}
              >
                <SelectTrigger className="h-auto px-3 py-1.5 w-auto bg-transparent border-0 shadow-none text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] focus:ring-0 ring-offset-0 font-albert text-sm gap-1.5 !justify-start">
                  <SelectValue placeholder="All Tracks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tracks</SelectItem>
                  <SelectItem value="none">No Track</SelectItem>
                  {TRACK_OPTIONS.filter(t => t.value).map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                onClick={handleCreateCourse}
                className="flex items-center gap-2 px-2.5 py-1.5 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white rounded-lg font-albert font-medium text-[15px] transition-colors duration-200 whitespace-nowrap"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Course
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-albert">Title</TableHead>
                <TableHead className="font-albert">Category</TableHead>
                <TableHead className="font-albert">Level</TableHead>
                <TableHead className="font-albert">Track</TableHead>
                <TableHead className="font-albert">Modules</TableHead>
                <TableHead className="font-albert">Lessons</TableHead>
                <TableHead className="font-albert">Featured</TableHead>
                <TableHead className="font-albert">Trending</TableHead>
                <TableHead className="font-albert text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCourses.map(course => (
                <TableRow key={course.id}>
                  <TableCell className="font-albert font-medium max-w-[200px] truncate">
                    {course.title}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {course.category}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {course.level}
                  </TableCell>
                  <TableCell>
                    {course.track ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 font-albert">
                        {getTrackDisplayName(course.track)}
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-albert">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {course.totalModules || course.modules?.length || 0}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {course.totalLessons || course.modules?.reduce((sum, m) => sum + m.lessons.length, 0) || 0}
                  </TableCell>
                  <TableCell>
                    {course.featured ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 font-albert">
                        Yes
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-albert">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {course.trending ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 font-albert">
                        Yes
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-albert">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCourse(course)}
                        className="text-brand-accent hover:text-brand-accent/90 hover:bg-brand-accent/10 font-albert"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCourseToDelete(course)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 font-albert"
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredCourses.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No courses found</p>
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

