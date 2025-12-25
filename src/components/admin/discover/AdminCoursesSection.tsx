'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DiscoverCourse, CourseModule, CourseLesson } from '@/types/discover';
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
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { ProgramSelector } from '@/components/admin/ProgramSelector';

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

// Generate unique ID for new modules/lessons
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper function to fetch video duration from URL
async function fetchVideoDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        const durationMinutes = Math.ceil(video.duration / 60);
        resolve(durationMinutes);
        video.remove();
      };
      
      video.onerror = () => {
        resolve(null);
        video.remove();
      };
      
      // Timeout after 10 seconds
      setTimeout(() => {
        resolve(null);
        video.remove();
      }, 10000);
      
      video.src = url;
    } catch {
      resolve(null);
    }
  });
}

// Lesson Editor Component
function LessonEditor({
  lesson,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  uploadEndpoint,
}: {
  lesson: CourseLesson;
  index: number;
  onUpdate: (lesson: CourseLesson) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  uploadEndpoint: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fetchingDuration, setFetchingDuration] = useState(false);

  // Auto-fetch duration when video URL is added/changed
  const handleVideoUrlBlur = async (url: string) => {
    if (!url || lesson.durationMinutes) return; // Don't override existing duration
    
    setFetchingDuration(true);
    const duration = await fetchVideoDuration(url);
    setFetchingDuration(false);
    
    if (duration) {
      onUpdate({ ...lesson, durationMinutes: duration });
    }
  };

  // Manual fetch duration button handler
  const handleFetchDuration = async () => {
    if (!lesson.videoUrl) return;
    
    setFetchingDuration(true);
    const duration = await fetchVideoDuration(lesson.videoUrl);
    setFetchingDuration(false);
    
    if (duration) {
      onUpdate({ ...lesson, durationMinutes: duration });
    } else {
      alert('Could not fetch video duration. The video might be from a source that blocks cross-origin requests.');
    }
  };

  return (
    <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22]">
      {/* Collapsed Header */}
      <div className="p-3 flex items-center gap-3">
        <span className="w-6 h-6 flex items-center justify-center bg-[#a07855]/10 rounded text-xs font-medium text-[#a07855] font-albert">
          {index + 1}
        </span>
        <input
          type="text"
          value={lesson.title}
          onChange={e => onUpdate({ ...lesson, title: e.target.value })}
          placeholder="Lesson title"
          className="flex-1 px-2 py-1 border border-transparent hover:border-[#e1ddd8] dark:border-[#262b35] rounded focus:outline-none focus:border-[#a07855] font-albert text-sm"
        />
        <input
          type="number"
          value={lesson.durationMinutes || ''}
          onChange={e => onUpdate({ ...lesson, durationMinutes: e.target.value ? parseInt(e.target.value) : undefined })}
          placeholder="Min"
          className="w-16 px-2 py-1 border border-[#e1ddd8] dark:border-[#262b35] rounded focus:outline-none focus:ring-1 focus:ring-[#a07855] font-albert text-sm text-center"
        />
        <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">min</span>
        
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:text-[#f5f5f8] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:text-[#f5f5f8] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="px-2 py-1 text-xs text-[#a07855] hover:text-[#8c6245] hover:bg-[#a07855]/10 rounded font-albert font-medium flex items-center gap-1"
          >
            {expanded ? 'Hide' : 'Details'}
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-red-500 hover:text-red-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-3 pt-0 space-y-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <div>
            <MediaUpload
              value={lesson.videoUrl || ''}
              onChange={(url) => {
                onUpdate({ ...lesson, videoUrl: url });
                if (url) handleVideoUrlBlur(url);
              }}
              folder="courses/lessons"
              type="video"
              label="Lesson Video"
              uploadEndpoint={uploadEndpoint}
            />
            {lesson.videoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFetchDuration}
                  disabled={fetchingDuration}
                  className="px-3 py-1.5 text-xs bg-[#a07855]/10 text-[#a07855] hover:bg-[#a07855]/20 rounded font-albert font-medium disabled:opacity-50 whitespace-nowrap"
                  title="Fetch video duration automatically"
                >
                  {fetchingDuration ? (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Fetching...
                    </span>
                  ) : (
                    'Get Duration'
                  )}
                </button>
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]/70 font-albert">
                  Duration will auto-fetch when you add a video
                </span>
              </div>
            )}
          </div>
          <div>
            <MediaUpload
              value={lesson.videoThumbnailUrl || ''}
              onChange={(url) => onUpdate({ ...lesson, videoThumbnailUrl: url })}
              folder="courses/lessons"
              type="image"
              label="Video Thumbnail (optional)"
              uploadEndpoint={uploadEndpoint}
            />
          </div>
          <div>
            <RichTextEditor
              value={lesson.notes || ''}
              onChange={(notes) => onUpdate({ ...lesson, notes })}
              label="Lesson Notes"
              placeholder="Summary, key points, or additional resources..."
              rows={4}
              showMediaToolbar={true}
              mediaFolder="courses/lessons"
              uploadEndpoint={uploadEndpoint}
            />
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lesson.isLocked || false}
                onChange={e => onUpdate({ ...lesson, isLocked: e.target.checked })}
                className="w-4 h-4 text-[#a07855] border-[#e1ddd8] dark:border-[#262b35] rounded focus:ring-[#a07855]"
              />
              <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Locked (Premium)</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// Module Editor Component
function ModuleEditor({
  module,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  uploadEndpoint,
}: {
  module: CourseModule;
  index: number;
  onUpdate: (module: CourseModule) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  uploadEndpoint: string;
}) {
  const [expanded, setExpanded] = useState(true);

  const addLesson = () => {
    const newLesson: CourseLesson = {
      id: generateId(),
      title: '',
      order: module.lessons.length + 1,
    };
    onUpdate({ ...module, lessons: [...module.lessons, newLesson] });
  };

  const updateLesson = (lessonIndex: number, lesson: CourseLesson) => {
    const newLessons = [...module.lessons];
    newLessons[lessonIndex] = lesson;
    onUpdate({ ...module, lessons: newLessons });
  };

  const deleteLesson = (lessonIndex: number) => {
    onUpdate({ ...module, lessons: module.lessons.filter((_, i) => i !== lessonIndex) });
  };

  const moveLessonUp = (lessonIndex: number) => {
    if (lessonIndex === 0) return;
    const newLessons = [...module.lessons];
    [newLessons[lessonIndex - 1], newLessons[lessonIndex]] = [newLessons[lessonIndex], newLessons[lessonIndex - 1]];
    onUpdate({ ...module, lessons: newLessons });
  };

  const moveLessonDown = (lessonIndex: number) => {
    if (lessonIndex === module.lessons.length - 1) return;
    const newLessons = [...module.lessons];
    [newLessons[lessonIndex], newLessons[lessonIndex + 1]] = [newLessons[lessonIndex + 1], newLessons[lessonIndex]];
    onUpdate({ ...module, lessons: newLessons });
  };

  return (
    <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl bg-[#faf8f6] dark:bg-[#0d0f14] overflow-hidden">
      {/* Module Header */}
      <div className="p-4 bg-white dark:bg-[#171b22] border-b border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 flex items-center justify-center bg-[#a07855] rounded-lg text-sm font-bold text-white font-albert flex-shrink-0">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={module.title}
              onChange={e => onUpdate({ ...module, title: e.target.value })}
              placeholder="Module title"
              className="w-full px-2 py-1 border border-transparent hover:border-[#e1ddd8] dark:border-[#262b35] rounded focus:outline-none focus:border-[#a07855] font-albert font-semibold"
            />
            <input
              type="text"
              value={module.subtitle || ''}
              onChange={e => onUpdate({ ...module, subtitle: e.target.value })}
              placeholder="Subtitle (optional)"
              className="w-full px-2 py-1 border border-transparent hover:border-[#e1ddd8] dark:border-[#262b35] rounded focus:outline-none focus:border-[#a07855] font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]"
            />
            <RichTextEditor
              value={module.description || ''}
              onChange={(description) => onUpdate({ ...module, description })}
              placeholder="Module description (optional)..."
              rows={3}
              showMediaToolbar={true}
              mediaFolder="courses"
              uploadEndpoint={uploadEndpoint}
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e1ddd8]/50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move up"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e1ddd8]/50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move down"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e1ddd8]/50 rounded"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
              title="Delete module"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Lessons */}
      {expanded && (
        <div className="p-4 space-y-2">
          {module.lessons.map((lesson, lessonIndex) => (
            <LessonEditor
              key={lesson.id}
              lesson={lesson}
              index={lessonIndex}
              onUpdate={l => updateLesson(lessonIndex, l)}
              onDelete={() => deleteLesson(lessonIndex)}
              onMoveUp={() => moveLessonUp(lessonIndex)}
              onMoveDown={() => moveLessonDown(lessonIndex)}
              isFirst={lessonIndex === 0}
              isLast={lessonIndex === module.lessons.length - 1}
              uploadEndpoint={uploadEndpoint}
            />
          ))}
          <button
            type="button"
            onClick={addLesson}
            className="w-full py-2 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-[#a07855] hover:border-[#a07855] hover:bg-[#a07855]/5 transition-colors font-albert"
          >
            + Add Lesson
          </button>
        </div>
      )}
    </div>
  );
}

// Course Form Dialog
function CourseFormDialog({
  course,
  isOpen,
  onClose,
  onSave,
  uploadEndpoint,
}: {
  course: DiscoverCourse | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  uploadEndpoint: string;
}) {
  const isEditing = !!course;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    coverImageUrl: '',
    shortDescription: '',
    category: '',
    level: 'Beginner',
    track: '' as UserTrack | '',
    programIds: [] as string[],
    featured: false,
    trending: false,
    modules: [] as CourseModule[],
  });

  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title || '',
        coverImageUrl: course.coverImageUrl || '',
        shortDescription: course.shortDescription || '',
        category: course.category || '',
        level: course.level || 'Beginner',
        track: course.track || '',
        programIds: course.programIds || [],
        featured: course.featured || false,
        trending: course.trending || false,
        modules: course.modules || [],
      });
    } else {
      setFormData({
        title: '',
        coverImageUrl: '',
        shortDescription: '',
        category: '',
        level: 'Beginner',
        track: '',
        programIds: [],
        featured: false,
        trending: false,
        modules: [],
      });
    }
  }, [course, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = isEditing 
        ? `/api/admin/discover/courses/${course.id}`
        : '/api/admin/discover/courses';
      
      const payload = {
        ...formData,
        track: formData.track || null, // Convert empty string to null (deprecated)
        programIds: formData.programIds, // New program association
      };
      
      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save course');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving course:', err);
      alert(err instanceof Error ? err.message : 'Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  const addModule = () => {
    const newModule: CourseModule = {
      id: generateId(),
      title: '',
      order: formData.modules.length + 1,
      lessons: [],
    };
    setFormData(prev => ({ ...prev, modules: [...prev.modules, newModule] }));
  };

  const updateModule = (index: number, module: CourseModule) => {
    const newModules = [...formData.modules];
    newModules[index] = module;
    setFormData(prev => ({ ...prev, modules: newModules }));
  };

  const deleteModule = (index: number) => {
    setFormData(prev => ({ ...prev, modules: prev.modules.filter((_, i) => i !== index) }));
  };

  const moveModuleUp = (index: number) => {
    if (index === 0) return;
    const newModules = [...formData.modules];
    [newModules[index - 1], newModules[index]] = [newModules[index], newModules[index - 1]];
    setFormData(prev => ({ ...prev, modules: newModules }));
  };

  const moveModuleDown = (index: number) => {
    if (index === formData.modules.length - 1) return;
    const newModules = [...formData.modules];
    [newModules[index], newModules[index + 1]] = [newModules[index + 1], newModules[index]];
    setFormData(prev => ({ ...prev, modules: newModules }));
  };

  // Calculate totals
  const totalLessons = formData.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalDuration = formData.modules.reduce((sum, m) => 
    sum + m.lessons.reduce((lSum, l) => lSum + (l.durationMinutes || 0), 0), 0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full max-w-4xl mx-4 shadow-2xl shadow-black/10 dark:shadow-black/30 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35] flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {isEditing ? 'Edit Course' : 'Create Course'}
              </h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                {formData.modules.length} modules · {totalLessons} lessons · {totalDuration} min
              </p>
            </div>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Basic Info Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert flex items-center gap-2">
                <span className="w-6 h-6 flex items-center justify-center bg-[#a07855]/10 rounded text-xs font-bold text-[#a07855]">1</span>
                Basic Information
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                    Cover Image <span className="text-text-muted text-xs font-normal">(1200 x 675px)</span> *
                  </label>
                  <MediaUpload
                    value={formData.coverImageUrl}
                    onChange={(url) => setFormData(prev => ({ ...prev, coverImageUrl: url }))}
                    folder="courses"
                    type="image"
                    required
                    uploadEndpoint={uploadEndpoint}
                    hideLabel
                  />
                </div>
                
                <div className="col-span-2">
                  <RichTextEditor
                    value={formData.shortDescription}
                    onChange={(shortDescription) => setFormData(prev => ({ ...prev, shortDescription }))}
                    label="Short Description"
                    required
                    rows={3}
                    placeholder="Brief course overview..."
                    showMediaToolbar={true}
                    mediaFolder="courses"
                    uploadEndpoint={uploadEndpoint}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Category *</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert"
                    placeholder="e.g., Direction, Productivity"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Level *</label>
                  <select
                    value={formData.level}
                    onChange={e => setFormData(prev => ({ ...prev, level: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                
                {/* Programs (replaces Track) */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                    Programs
                  </label>
                  <ProgramSelector
                    value={formData.programIds}
                    onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
                    placeholder="Select programs for this course..."
                  />
                </div>
                
              </div>
              
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <BrandedCheckbox
                    checked={formData.featured}
                    onChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
                  />
                  <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, featured: !prev.featured }))}>Featured</span>
                </div>
                <div className="flex items-center gap-2">
                  <BrandedCheckbox
                    checked={formData.trending}
                    onChange={(checked) => setFormData(prev => ({ ...prev, trending: checked }))}
                  />
                  <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, trending: !prev.trending }))}>Trending</span>
                </div>
              </div>
            </div>

            {/* Modules & Lessons Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert flex items-center gap-2">
                <span className="w-6 h-6 flex items-center justify-center bg-[#a07855]/10 rounded text-xs font-bold text-[#a07855]">2</span>
                Modules & Lessons
              </h3>
              
              <div className="space-y-4">
                {formData.modules.map((module, index) => (
                  <ModuleEditor
                    key={module.id}
                    module={module}
                    index={index}
                    onUpdate={m => updateModule(index, m)}
                    onDelete={() => deleteModule(index)}
                    onMoveUp={() => moveModuleUp(index)}
                    onMoveDown={() => moveModuleDown(index)}
                    isFirst={index === 0}
                    isLast={index === formData.modules.length - 1}
                    uploadEndpoint={uploadEndpoint}
                  />
                ))}
                
                <button
                  type="button"
                  onClick={addModule}
                  className="w-full py-3 border-2 border-dashed border-[#a07855] rounded-xl text-[#a07855] hover:bg-[#a07855]/5 transition-colors font-albert font-medium"
                >
                  + Add Module
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-[#e1ddd8] dark:border-[#262b35] flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5 font-albert"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#a07855] hover:bg-[#8c6245] text-white font-albert"
            >
              {saving ? 'Saving...' : isEditing ? 'Update Course' : 'Create Course'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AdminCoursesSectionProps {
  apiEndpoint?: string;
}

export function AdminCoursesSection({ apiEndpoint = '/api/admin/discover/courses' }: AdminCoursesSectionProps) {
  const [courses, setCourses] = useState<DiscoverCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [courseToEdit, setCourseToEdit] = useState<DiscoverCourse | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<DiscoverCourse | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derive upload endpoint from API endpoint - use coach upload for coach routes
  const uploadEndpoint = apiEndpoint.includes('/coach/') 
    ? '/api/coach/org-upload-media' 
    : '/api/admin/upload-media';

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
      const response = await fetch(`/api/admin/discover/courses/${courseToDelete.id}`, {
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
          <Button onClick={fetchCourses} className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Courses</h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-48 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-sm"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Category Filter */}
              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-sm"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}
              
              {/* Level Filter */}
              {levels.length > 0 && (
                <select
                  value={levelFilter}
                  onChange={e => setLevelFilter(e.target.value)}
                  className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-sm"
                >
                  <option value="">All Levels</option>
                  {levels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              )}
              
              {/* Track Filter */}
              <select
                value={trackFilter}
                onChange={e => setTrackFilter(e.target.value)}
                className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-sm"
              >
                <option value="">All Tracks</option>
                <option value="none">No Track</option>
                {TRACK_OPTIONS.filter(t => t.value).map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              
              <Button
                onClick={() => { setCourseToEdit(null); setIsFormOpen(true); }}
                className="bg-[#a07855] hover:bg-[#8c6245] text-white font-albert"
              >
                + Create Course
              </Button>
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
                        onClick={() => { setCourseToEdit(course); setIsFormOpen(true); }}
                        className="text-[#a07855] hover:text-[#8c6245] hover:bg-[#a07855]/10 font-albert"
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

      {/* Course Form Dialog */}
      <CourseFormDialog
        course={courseToEdit}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setCourseToEdit(null); }}
        onSave={fetchCourses}
        uploadEndpoint={uploadEndpoint}
      />

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
    </>
  );
}

