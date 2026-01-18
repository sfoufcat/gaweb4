'use client';

import { useState, useEffect } from 'react';
import type { DiscoverCourse, CourseModule, CourseLesson } from '@/types/discover';
import type { UserTrack } from '@/types';
import { Button } from '@/components/ui/button';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { ContentPricingFields, getDefaultPricingData, type ContentPricingData } from '@/components/admin/ContentPricingFields';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, BookOpen, Clock, Layers, ChevronDown, ChevronUp, Trash2, GripVertical, Play, Image, FileText, Lock } from 'lucide-react';

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

// Lesson Editor Component - Accordion style
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

  const handleVideoUrlChange = async (url: string) => {
    onUpdate({ ...lesson, videoUrl: url });
    if (url && !lesson.durationMinutes) {
      setFetchingDuration(true);
      const duration = await fetchVideoDuration(url);
      setFetchingDuration(false);
      if (duration) {
        onUpdate({ ...lesson, videoUrl: url, durationMinutes: duration });
      }
    }
  };

  const handleFetchDuration = async () => {
    if (!lesson.videoUrl) return;
    setFetchingDuration(true);
    const duration = await fetchVideoDuration(lesson.videoUrl);
    setFetchingDuration(false);
    if (duration) {
      onUpdate({ ...lesson, durationMinutes: duration });
    }
  };

  return (
    <div className="group border border-[#e1ddd8] dark:border-[#262b35] rounded-xl bg-white dark:bg-[#171b22] overflow-hidden transition-shadow hover:shadow-sm">
      {/* Collapsed Header */}
      <div
        className="p-4 flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={isFirst}
            className="p-1 text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={isLast}
            className="p-1 text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-brand-accent/20 to-brand-accent/10 rounded-lg">
          <Play className="w-4 h-4 text-brand-accent" />
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={lesson.title}
            onChange={e => { e.stopPropagation(); onUpdate({ ...lesson, title: e.target.value }); }}
            onClick={e => e.stopPropagation()}
            placeholder="Lesson title"
            className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35] rounded focus:outline-none focus:border-brand-accent font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]"
          />
        </div>

        <div className="flex items-center gap-3">
          {lesson.isLocked && (
            <Lock className="w-4 h-4 text-amber-500" />
          )}
          <div className="flex items-center gap-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            <Clock className="w-3.5 h-3.5" />
            <input
              type="number"
              value={lesson.durationMinutes || ''}
              onChange={e => { e.stopPropagation(); onUpdate({ ...lesson, durationMinutes: e.target.value ? parseInt(e.target.value) : undefined }); }}
              onClick={e => e.stopPropagation()}
              placeholder="0"
              className="w-12 px-1.5 py-0.5 text-center bg-[#f3f1ef] dark:bg-[#1e222a] border border-transparent focus:border-brand-accent rounded font-albert text-sm"
            />
            <span>min</span>
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-[#9ca3af] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <ChevronDown className={`w-5 h-5 text-[#9ca3af] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          {/* Video Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                Video
              </label>
              <MediaUpload
                value={lesson.videoUrl || ''}
                onChange={handleVideoUrlChange}
                folder="courses/lessons"
                type="video"
                uploadEndpoint={uploadEndpoint}
                hideLabel
              />
              {lesson.videoUrl && (
                <button
                  type="button"
                  onClick={handleFetchDuration}
                  disabled={fetchingDuration}
                  className="mt-2 px-3 py-1.5 text-xs bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 rounded-lg font-albert font-medium disabled:opacity-50 flex items-center gap-1.5"
                >
                  {fetchingDuration ? (
                    <>
                      <div className="w-3 h-3 border-2 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3" />
                      Auto-detect duration
                    </>
                  )}
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                Thumbnail (optional)
              </label>
              <MediaUpload
                value={lesson.videoThumbnailUrl || ''}
                onChange={(url) => onUpdate({ ...lesson, videoThumbnailUrl: url })}
                folder="courses/lessons"
                type="image"
                uploadEndpoint={uploadEndpoint}
                hideLabel
                previewSize="thumbnail"
              />
            </div>
          </div>

          {/* Notes */}
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

          {/* Lock toggle */}
          <div className="flex items-center gap-3 pt-2">
            <BrandedCheckbox
              checked={lesson.isLocked || false}
              onChange={(checked) => onUpdate({ ...lesson, isLocked: checked })}
            />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Locked (Premium content)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Module Editor Component - Accordion style
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
  const [expanded, setExpanded] = useState(false);

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

  const totalDuration = module.lessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);

  return (
    <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl bg-white dark:bg-[#171b22] overflow-hidden shadow-sm">
      {/* Module Header */}
      <div
        className="p-5 flex items-start gap-4 cursor-pointer hover:bg-[#faf8f6]/50 dark:hover:bg-[#1e222a]/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={isFirst}
            className="p-1 text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={isLast}
            className="p-1 text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-brand-accent to-brand-accent/80 rounded-xl text-white font-bold font-albert text-lg flex-shrink-0">
          {String(index + 1).padStart(2, '0')}
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={module.title}
            onChange={e => { e.stopPropagation(); onUpdate({ ...module, title: e.target.value }); }}
            onClick={e => e.stopPropagation()}
            placeholder="Module title"
            className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35] rounded focus:outline-none focus:border-brand-accent font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8]"
          />
          <div className="flex items-center gap-4 mt-1 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            <span className="flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5" />
              {module.lessons.length} lesson{module.lessons.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {totalDuration} min
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-[#9ca3af] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <ChevronDown className={`w-5 h-5 text-[#9ca3af] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          {/* Module description */}
          <div className="pt-4">
            <RichTextEditor
              value={module.description || ''}
              onChange={(description) => onUpdate({ ...module, description })}
              placeholder="Module description (optional)..."
              rows={2}
              showMediaToolbar={false}
              uploadEndpoint={uploadEndpoint}
            />
          </div>

          {/* Lessons */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-[#5f5a55] dark:text-[#b2b6c2] font-albert uppercase tracking-wide">
              Lessons
            </h4>
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
              className="w-full py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-sm text-brand-accent hover:border-brand-accent hover:bg-brand-accent/5 transition-colors font-albert font-medium flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Add Lesson
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface CourseEditorProps {
  course: DiscoverCourse | null;
  onClose: () => void;
  onSave: () => void;
  uploadEndpoint: string;
  programsApiEndpoint: string;
  apiEndpoint: string;
}

export function CourseEditor({
  course,
  onClose,
  onSave,
  uploadEndpoint,
  programsApiEndpoint,
  apiEndpoint,
}: CourseEditorProps) {
  const isEditing = !!course;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    coverImageUrl: '',
    shortDescription: '',
    category: '',
    level: '',
    track: '' as UserTrack | '',
    programIds: [] as string[],
    featured: false,
    trending: false,
    modules: [] as CourseModule[],
    pricing: getDefaultPricingData() as ContentPricingData,
  });

  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title || '',
        coverImageUrl: course.coverImageUrl || '',
        shortDescription: course.shortDescription || '',
        category: course.category || '',
        level: course.level || '',
        track: course.track || '',
        programIds: course.programIds || [],
        featured: course.featured || false,
        trending: course.trending || false,
        modules: course.modules || [],
        pricing: {
          priceInCents: course.priceInCents ?? null,
          currency: course.currency || 'USD',
          purchaseType: course.purchaseType || 'popup',
          isPublic: course.isPublic !== false,
        },
      });
    } else {
      setFormData({
        title: '',
        coverImageUrl: '',
        shortDescription: '',
        category: '',
        level: '',
        track: '',
        programIds: [],
        featured: false,
        trending: false,
        modules: [],
        pricing: getDefaultPricingData(),
      });
    }
  }, [course]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.shortDescription.trim()) {
      alert('Short description is required');
      return;
    }

    if (!formData.coverImageUrl.trim()) {
      alert('Cover image is required');
      return;
    }

    setSaving(true);

    try {
      const url = isEditing
        ? `${apiEndpoint}/${course.id}`
        : apiEndpoint;

      const payload = {
        ...formData,
        category: formData.category || null,
        level: formData.level || null,
        track: formData.track || null,
        programIds: formData.programIds,
        priceInCents: formData.pricing.priceInCents,
        currency: formData.pricing.currency,
        purchaseType: formData.pricing.purchaseType,
        isPublic: formData.pricing.isPublic,
      };
      delete (payload as Record<string, unknown>).pricing;

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

  return (
    <form onSubmit={handleSubmit} className="min-h-screen flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border-b border-[#e1ddd8] dark:border-[#262b35]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                <span>Content</span>
                <span>/</span>
                <span>Courses</span>
                <span>/</span>
                <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {isEditing ? 'Edit' : 'Create'}
                </span>
              </div>
              <h1 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mt-0.5">
                {formData.title || (isEditing ? 'Edit Course' : 'New Course')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-[#262b35] font-albert"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !formData.title.trim() || !formData.shortDescription.trim() || !formData.coverImageUrl.trim()}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
            >
              {saving ? 'Saving...' : isEditing ? 'Update Course' : 'Create Course'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gradient-to-b from-[#faf8f6] to-white dark:from-[#0d0f14] dark:to-[#171b22]">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* Stats Bar */}
          <div className="flex items-center gap-6 p-4 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-brand-accent/10 rounded-xl">
                <Layers className="w-5 h-5 text-brand-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{formData.modules.length}</p>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Modules</p>
              </div>
            </div>
            <div className="w-px h-12 bg-[#e1ddd8] dark:bg-[#262b35]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/10 rounded-xl">
                <BookOpen className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{totalLessons}</p>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Lessons</p>
              </div>
            </div>
            <div className="w-px h-12 bg-[#e1ddd8] dark:bg-[#262b35]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-blue-500/10 rounded-xl">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{totalDuration}</p>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Minutes</p>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Basic Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cover Image & Title Card */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
                <div className="p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert flex items-center gap-2">
                    <span className="w-7 h-7 flex items-center justify-center bg-brand-accent text-white rounded-lg text-sm font-bold">1</span>
                    Basic Information
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter course title..."
                      className="w-full px-4 py-3 text-lg border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert bg-white dark:bg-[#0d0f14]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                      Cover Image <span className="text-[#9ca3af] font-normal">(1200 x 675px)</span> *
                    </label>
                    <MediaUpload
                      value={formData.coverImageUrl}
                      onChange={(url) => setFormData(prev => ({ ...prev, coverImageUrl: url }))}
                      folder="courses"
                      type="image"
                      required
                      uploadEndpoint={uploadEndpoint}
                      hideLabel
                      previewSize="full"
                    />
                  </div>

                  <div>
                    <RichTextEditor
                      value={formData.shortDescription}
                      onChange={(shortDescription) => setFormData(prev => ({ ...prev, shortDescription }))}
                      label="Description *"
                      required
                      rows={4}
                      placeholder="What will students learn in this course?"
                      showMediaToolbar={true}
                      mediaFolder="courses"
                      uploadEndpoint={uploadEndpoint}
                    />
                  </div>
                </div>
              </div>

              {/* Modules Section */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
                <div className="p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert flex items-center gap-2">
                    <span className="w-7 h-7 flex items-center justify-center bg-brand-accent text-white rounded-lg text-sm font-bold">2</span>
                    Course Content
                  </h2>

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
                      className="w-full py-4 border-2 border-dashed border-brand-accent/50 rounded-2xl text-brand-accent hover:border-brand-accent hover:bg-brand-accent/5 transition-colors font-albert font-semibold flex items-center justify-center gap-2"
                    >
                      <Layers className="w-5 h-5" />
                      Add Module
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Metadata */}
            <div className="space-y-6">
              {/* Category & Level */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6 space-y-5">
                <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Classification
                </h3>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                    Category
                  </label>
                  <CategorySelector
                    value={formData.category}
                    onChange={(category) => setFormData(prev => ({ ...prev, category }))}
                    placeholder="Select or create category..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                    Level
                  </label>
                  <Select
                    value={formData.level || 'none'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, level: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger className="w-full px-4 py-3 h-auto border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent ring-offset-0 dark:ring-brand-accent font-albert bg-white dark:bg-[#0d0f14] text-[#1a1a1a] dark:text-[#f5f5f8]">
                      <SelectValue placeholder="Select level..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Programs */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6 space-y-5">
                <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Programs
                </h3>
                <ProgramSelector
                  value={formData.programIds}
                  onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
                  placeholder="Link to programs..."
                  programsApiEndpoint={programsApiEndpoint}
                />
              </div>

              {/* Pricing */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6 space-y-5">
                <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Pricing & Access
                </h3>
                <ContentPricingFields
                  value={formData.pricing}
                  onChange={(pricing) => setFormData(prev => ({ ...prev, pricing }))}
                />
              </div>

              {/* Visibility */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6 space-y-4">
                <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Visibility
                </h3>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#faf8f6] dark:hover:bg-[#0d0f14] cursor-pointer transition-colors">
                    <BrandedCheckbox
                      checked={formData.featured}
                      onChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
                    />
                    <div>
                      <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Featured</span>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Show in featured section</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#faf8f6] dark:hover:bg-[#0d0f14] cursor-pointer transition-colors">
                    <BrandedCheckbox
                      checked={formData.trending}
                      onChange={(checked) => setFormData(prev => ({ ...prev, trending: checked }))}
                    />
                    <div>
                      <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Trending</span>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Show in trending section</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
