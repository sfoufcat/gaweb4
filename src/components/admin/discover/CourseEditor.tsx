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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ArrowLeft, Layers, BookOpen, Clock, ChevronDown, ChevronUp, Trash2, Play, Plus, Settings2, GripVertical, Folder } from 'lucide-react';

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

// Module colors for visual distinction
const MODULE_COLORS = [
  { bg: 'bg-blue-50/50 dark:bg-blue-900/15', icon: 'bg-blue-100/70 dark:bg-blue-900/25', iconText: 'text-blue-500 dark:text-blue-400' },
  { bg: 'bg-purple-50/50 dark:bg-purple-900/15', icon: 'bg-purple-100/70 dark:bg-purple-900/25', iconText: 'text-purple-500 dark:text-purple-400' },
  { bg: 'bg-emerald-50/50 dark:bg-emerald-900/15', icon: 'bg-emerald-100/70 dark:bg-emerald-900/25', iconText: 'text-emerald-500 dark:text-emerald-400' },
  { bg: 'bg-amber-50/50 dark:bg-amber-900/15', icon: 'bg-amber-100/70 dark:bg-amber-900/25', iconText: 'text-amber-500 dark:text-amber-400' },
  { bg: 'bg-rose-50/50 dark:bg-rose-900/15', icon: 'bg-rose-100/70 dark:bg-rose-900/25', iconText: 'text-rose-500 dark:text-rose-400' },
];

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
  const [basicInfoOpen, setBasicInfoOpen] = useState(false);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number | null>(null);
  const [selectedLessonIndex, setSelectedLessonIndex] = useState<number | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set([0]));
  const [fetchingDuration, setFetchingDuration] = useState(false);

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
      // Expand first module by default
      if (course.modules?.length > 0) {
        setExpandedModules(new Set([0]));
      }
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
      // Open basic info for new courses
      setBasicInfoOpen(true);
    }
  }, [course]);

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }
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
      const url = isEditing ? `${apiEndpoint}/${course.id}` : apiEndpoint;

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

  // Module operations
  const addModule = () => {
    const newModule: CourseModule = {
      id: generateId(),
      title: `Module ${formData.modules.length + 1}`,
      order: formData.modules.length + 1,
      lessons: [],
    };
    setFormData(prev => ({ ...prev, modules: [...prev.modules, newModule] }));
    setExpandedModules(prev => new Set([...prev, formData.modules.length]));
    setSelectedModuleIndex(formData.modules.length);
    setSelectedLessonIndex(null);
  };

  const updateModule = (index: number, module: CourseModule) => {
    const newModules = [...formData.modules];
    newModules[index] = module;
    setFormData(prev => ({ ...prev, modules: newModules }));
  };

  const deleteModule = (index: number) => {
    if (!confirm('Delete this module and all its lessons?')) return;
    setFormData(prev => ({ ...prev, modules: prev.modules.filter((_, i) => i !== index) }));
    if (selectedModuleIndex === index) {
      setSelectedModuleIndex(null);
      setSelectedLessonIndex(null);
    }
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

  // Lesson operations
  const addLesson = (moduleIndex: number) => {
    const module = formData.modules[moduleIndex];
    const newLesson: CourseLesson = {
      id: generateId(),
      title: `Lesson ${module.lessons.length + 1}`,
      order: module.lessons.length + 1,
    };
    const newModule = { ...module, lessons: [...module.lessons, newLesson] };
    updateModule(moduleIndex, newModule);
    setSelectedModuleIndex(moduleIndex);
    setSelectedLessonIndex(module.lessons.length);
  };

  const updateLesson = (moduleIndex: number, lessonIndex: number, lesson: CourseLesson) => {
    const module = formData.modules[moduleIndex];
    const newLessons = [...module.lessons];
    newLessons[lessonIndex] = lesson;
    updateModule(moduleIndex, { ...module, lessons: newLessons });
  };

  const deleteLesson = (moduleIndex: number, lessonIndex: number) => {
    if (!confirm('Delete this lesson?')) return;
    const module = formData.modules[moduleIndex];
    updateModule(moduleIndex, { ...module, lessons: module.lessons.filter((_, i) => i !== lessonIndex) });
    if (selectedLessonIndex === lessonIndex) {
      setSelectedLessonIndex(null);
    }
  };

  const moveLessonUp = (moduleIndex: number, lessonIndex: number) => {
    if (lessonIndex === 0) return;
    const module = formData.modules[moduleIndex];
    const newLessons = [...module.lessons];
    [newLessons[lessonIndex - 1], newLessons[lessonIndex]] = [newLessons[lessonIndex], newLessons[lessonIndex - 1]];
    updateModule(moduleIndex, { ...module, lessons: newLessons });
  };

  const moveLessonDown = (moduleIndex: number, lessonIndex: number) => {
    const module = formData.modules[moduleIndex];
    if (lessonIndex === module.lessons.length - 1) return;
    const newLessons = [...module.lessons];
    [newLessons[lessonIndex], newLessons[lessonIndex + 1]] = [newLessons[lessonIndex + 1], newLessons[lessonIndex]];
    updateModule(moduleIndex, { ...module, lessons: newLessons });
  };

  const toggleModule = (index: number) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Calculate totals
  const totalLessons = formData.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalDuration = formData.modules.reduce((sum, m) =>
    sum + m.lessons.reduce((lSum, l) => lSum + (l.durationMinutes || 0), 0), 0
  );

  // Get selected lesson
  const selectedLesson = selectedModuleIndex !== null && selectedLessonIndex !== null
    ? formData.modules[selectedModuleIndex]?.lessons[selectedLessonIndex]
    : null;

  const handleFetchDuration = async () => {
    if (!selectedLesson?.videoUrl || selectedModuleIndex === null || selectedLessonIndex === null) return;
    setFetchingDuration(true);
    const duration = await fetchVideoDuration(selectedLesson.videoUrl);
    setFetchingDuration(false);
    if (duration) {
      updateLesson(selectedModuleIndex, selectedLessonIndex, { ...selectedLesson, durationMinutes: duration });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate max-w-[300px]">
              {formData.title || 'New Course'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4 mr-4 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              {formData.modules.length}
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              {totalLessons}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {totalDuration} min
            </span>
          </div>

          {/* Basic Info Button */}
          <button
            type="button"
            onClick={() => setBasicInfoOpen(true)}
            className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            title="Course Settings"
          >
            <Settings2 className="w-5 h-5" />
          </button>

          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-[#262b35] font-albert"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !formData.title.trim()}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
          >
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Module/Lesson Tree */}
        <div className="w-80 flex-shrink-0 border-r border-[#e1ddd8] dark:border-[#262b35] flex flex-col bg-[#faf8f6] dark:bg-[#0d0f14]">
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-[#e1ddd8] dark:border-[#262b35] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Structure</span>
            </div>
          </div>

          {/* Module List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {formData.modules.map((module, moduleIndex) => {
              const moduleColor = MODULE_COLORS[moduleIndex % MODULE_COLORS.length];
              const isExpanded = expandedModules.has(moduleIndex);
              const isModuleSelected = selectedModuleIndex === moduleIndex && selectedLessonIndex === null;

              return (
                <div key={module.id} className={`rounded-xl overflow-hidden border border-[#e1ddd8] dark:border-[#262b35] ${moduleColor.bg}`}>
                  {/* Module Header */}
                  <div
                    className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer transition-colors ${
                      isModuleSelected ? 'bg-brand-accent/10 dark:bg-brand-accent/15' : 'hover:bg-[#f5f3f0] dark:hover:bg-[#1e222a]'
                    }`}
                    onClick={() => {
                      setSelectedModuleIndex(moduleIndex);
                      setSelectedLessonIndex(null);
                      toggleModule(moduleIndex);
                    }}
                  >
                    <div className="flex items-center gap-1 opacity-50 hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveModuleUp(moduleIndex); }}
                        disabled={moduleIndex === 0}
                        className="p-0.5 disabled:opacity-30"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveModuleDown(moduleIndex); }}
                        disabled={moduleIndex === formData.modules.length - 1}
                        className="p-0.5 disabled:opacity-30"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${moduleColor.icon}`}>
                      <Folder className={`w-5 h-5 ${moduleColor.iconText}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={module.title}
                        onChange={(e) => { e.stopPropagation(); updateModule(moduleIndex, { ...module, title: e.target.value }); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-transparent border-none p-0 font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none font-albert"
                        placeholder="Module name"
                      />
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        {module.lessons.length} lesson{module.lessons.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); deleteModule(moduleIndex); }}
                      className="p-1.5 text-[#9ca3af] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <ChevronDown className={`w-4 h-4 text-[#9ca3af] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Lessons */}
                  {isExpanded && (
                    <div className="border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                      {module.lessons.map((lesson, lessonIndex) => {
                        const isLessonSelected = selectedModuleIndex === moduleIndex && selectedLessonIndex === lessonIndex;

                        return (
                          <div
                            key={lesson.id}
                            className={`group/lesson px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors border-b border-[#e1ddd8]/30 dark:border-[#262b35]/30 last:border-b-0 ${
                              isLessonSelected ? 'bg-brand-accent/10 dark:bg-brand-accent/15' : 'hover:bg-[#f5f3f0] dark:hover:bg-[#1e222a]'
                            }`}
                            onClick={() => {
                              setSelectedModuleIndex(moduleIndex);
                              setSelectedLessonIndex(lessonIndex);
                            }}
                          >
                            <div className="flex items-center gap-1 opacity-0 group-hover/lesson:opacity-50 hover:!opacity-100">
                              <button
                                onClick={(e) => { e.stopPropagation(); moveLessonUp(moduleIndex, lessonIndex); }}
                                disabled={lessonIndex === 0}
                                className="p-0.5 disabled:opacity-30"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); moveLessonDown(moduleIndex, lessonIndex); }}
                                disabled={lessonIndex === module.lessons.length - 1}
                                className="p-0.5 disabled:opacity-30"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100/70 dark:bg-gray-900/25">
                              <Play className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                                {lesson.title || 'Untitled Lesson'}
                              </p>
                              {lesson.durationMinutes && (
                                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                                  {lesson.durationMinutes} min
                                </p>
                              )}
                            </div>

                            <button
                              onClick={(e) => { e.stopPropagation(); deleteLesson(moduleIndex, lessonIndex); }}
                              className="p-1 text-[#9ca3af] hover:text-red-500 opacity-0 group-hover/lesson:opacity-100 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      {/* Add Lesson Button */}
                      <button
                        onClick={() => addLesson(moduleIndex)}
                        className="w-full px-3 py-2 flex items-center gap-2 text-sm text-brand-accent hover:bg-brand-accent/5 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Lesson
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Module Button */}
            <button
              onClick={addModule}
              className="w-full py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-sm text-brand-accent hover:border-brand-accent hover:bg-brand-accent/5 transition-colors font-albert font-medium flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4" />
              Add Module
            </button>
          </div>
        </div>

        {/* Content Area - Lesson Editor */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#171b22]">
          {selectedLesson && selectedModuleIndex !== null && selectedLessonIndex !== null ? (
            <div className="max-w-3xl mx-auto p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Lesson Title
                </label>
                <input
                  type="text"
                  value={selectedLesson.title}
                  onChange={(e) => updateLesson(selectedModuleIndex, selectedLessonIndex, { ...selectedLesson, title: e.target.value })}
                  placeholder="Enter lesson title..."
                  className="w-full px-4 py-3 text-lg border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert bg-white dark:bg-[#0d0f14]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                    Video
                  </label>
                  <MediaUpload
                    value={selectedLesson.videoUrl || ''}
                    onChange={(url) => {
                      updateLesson(selectedModuleIndex, selectedLessonIndex, { ...selectedLesson, videoUrl: url });
                    }}
                    folder="courses/lessons"
                    type="video"
                    uploadEndpoint={uploadEndpoint}
                    hideLabel
                  />
                  {selectedLesson.videoUrl && (
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
                    value={selectedLesson.videoThumbnailUrl || ''}
                    onChange={(url) => updateLesson(selectedModuleIndex, selectedLessonIndex, { ...selectedLesson, videoThumbnailUrl: url })}
                    folder="courses/lessons"
                    type="image"
                    uploadEndpoint={uploadEndpoint}
                    hideLabel
                    previewSize="thumbnail"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={selectedLesson.durationMinutes || ''}
                    onChange={(e) => updateLesson(selectedModuleIndex, selectedLessonIndex, { ...selectedLesson, durationMinutes: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="0"
                    className="w-24 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert bg-white dark:bg-[#0d0f14]"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <BrandedCheckbox
                    checked={selectedLesson.isLocked || false}
                    onChange={(checked) => updateLesson(selectedModuleIndex, selectedLessonIndex, { ...selectedLesson, isLocked: checked })}
                  />
                  <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Locked (Premium)
                  </span>
                </div>
              </div>

              <div>
                <RichTextEditor
                  value={selectedLesson.notes || ''}
                  onChange={(notes) => updateLesson(selectedModuleIndex, selectedLessonIndex, { ...selectedLesson, notes })}
                  label="Lesson Notes"
                  placeholder="Summary, key points, or additional resources..."
                  rows={6}
                  showMediaToolbar={true}
                  mediaFolder="courses/lessons"
                  uploadEndpoint={uploadEndpoint}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[#5f5a55] dark:text-[#b2b6c2]">
              <div className="text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-albert">Select a lesson to edit</p>
                <p className="text-sm mt-1">Or add a new module to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Basic Info Sheet */}
      <Sheet open={basicInfoOpen} onOpenChange={setBasicInfoOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-albert">Course Settings</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
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
                className="w-full px-4 py-3 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert bg-white dark:bg-[#0d0f14]"
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
                showMediaToolbar={false}
                uploadEndpoint={uploadEndpoint}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Category
                </label>
                <CategorySelector
                  value={formData.category}
                  onChange={(category) => setFormData(prev => ({ ...prev, category }))}
                  placeholder="Select..."
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
                  <SelectTrigger className="w-full px-3 py-2 h-auto border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert bg-white dark:bg-[#0d0f14]">
                    <SelectValue placeholder="Select..." />
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

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                Programs
              </label>
              <ProgramSelector
                value={formData.programIds}
                onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
                placeholder="Link to programs..."
                programsApiEndpoint={programsApiEndpoint}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                Pricing & Access
              </label>
              <ContentPricingFields
                value={formData.pricing}
                onChange={(pricing) => setFormData(prev => ({ ...prev, pricing }))}
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Visibility
              </label>

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
        </SheetContent>
      </Sheet>
    </div>
  );
}
