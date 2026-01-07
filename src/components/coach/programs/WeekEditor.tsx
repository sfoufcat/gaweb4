'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ProgramWeek, ProgramDay, ProgramTaskTemplate, CallSummary, TaskDistribution, UnifiedEvent, ProgramEnrollment } from '@/types';
import { Save, Plus, X, Sparkles, GripVertical, Target, FileText, MessageSquare, StickyNote, Upload, Mic, Phone, Calendar, Check, Loader2, Users, EyeOff, Info, ListTodo, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { SyncToClientsDialog } from './SyncToClientsDialog';
import { motion, AnimatePresence } from 'framer-motion';

interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    imageUrl?: string;
  };
}

interface WeekEditorProps {
  week: ProgramWeek;
  days: ProgramDay[];
  onSave: (updates: Partial<ProgramWeek>) => Promise<void>;
  onDaySelect?: (dayIndex: number) => void;
  onFillWithAI?: () => void;
  isSaving?: boolean;
  // Available items for manual linking
  availableCallSummaries?: CallSummary[];
  availableEvents?: UnifiedEvent[];
  // Client view mode (for 1:1 programs)
  isClientView?: boolean;
  clientName?: string;
  clientUserId?: string;
  enrollmentId?: string;
  // Cohort view mode (for group programs)
  cohortId?: string;
  cohortName?: string;
  // For sync functionality (1:1 programs)
  programId?: string;
  programType?: 'individual' | 'group';
  enrollments?: EnrollmentWithUser[];
  // Callback when a new summary is generated
  onSummaryGenerated?: (summaryId: string) => void;
}

/**
 * Editor for program week content
 * Manages tasks, focus areas, notes, recordings, and AI content
 */
export function WeekEditor({
  week,
  days,
  onSave,
  onDaySelect,
  onFillWithAI,
  isSaving = false,
  availableCallSummaries = [],
  availableEvents = [],
  isClientView = false,
  clientName,
  clientUserId,
  enrollmentId,
  cohortId,
  cohortName,
  programId,
  programType,
  enrollments = [],
  onSummaryGenerated,
}: WeekEditorProps) {
  const [formData, setFormData] = useState({
    name: week.name || '',
    theme: week.theme || '',
    description: week.description || '',
    weeklyPrompt: week.weeklyPrompt || '',
    weeklyTasks: week.weeklyTasks || [],
    currentFocus: week.currentFocus || [],
    notes: week.notes || [],
    manualNotes: week.manualNotes || '',
    distribution: (week.distribution || 'repeat-daily') as TaskDistribution,
    coachRecordingUrl: week.coachRecordingUrl || '',
    coachRecordingNotes: week.coachRecordingNotes || '',
    linkedSummaryIds: week.linkedSummaryIds || [] as string[],
    linkedCallEventIds: week.linkedCallEventIds || [] as string[],
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [newFocus, setNewFocus] = useState('');
  const [newNote, setNewNote] = useState('');

  // Save animation and sync state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSyncButton, setShowSyncButton] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  
  // Track which fields have been edited (for smart sync pre-selection)
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  // Recording upload and summary generation state
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'uploading' | 'processing' | 'generating' | 'completed' | 'error'>('idle');
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // Helper to track field edits
  const trackFieldEdit = useCallback((syncFieldKey: string) => {
    setEditedFields(prev => new Set(prev).add(syncFieldKey));
  }, []);

  // Get days in this week
  const weekDays = days.filter(
    d => d.dayIndex >= week.startDayIndex && d.dayIndex <= week.endDayIndex
  ).sort((a, b) => a.dayIndex - b.dayIndex);

  // Reset form when week changes
  useEffect(() => {
    setFormData({
      name: week.name || '',
      theme: week.theme || '',
      description: week.description || '',
      weeklyPrompt: week.weeklyPrompt || '',
      weeklyTasks: week.weeklyTasks || [],
      currentFocus: week.currentFocus || [],
      notes: week.notes || [],
      manualNotes: week.manualNotes || '',
      distribution: (week.distribution || 'repeat-daily') as TaskDistribution,
      coachRecordingUrl: week.coachRecordingUrl || '',
      coachRecordingNotes: week.coachRecordingNotes || '',
      linkedSummaryIds: week.linkedSummaryIds || [],
      linkedCallEventIds: week.linkedCallEventIds || [],
    });
    setHasChanges(false);
    setShowSyncButton(false);
    setSaveStatus('idle');
    setEditedFields(new Set());
  }, [week.id, week.name, week.theme, week.description, week.weeklyPrompt, week.weeklyTasks, week.currentFocus, week.notes, week.manualNotes, week.distribution, week.coachRecordingUrl, week.coachRecordingNotes, week.linkedSummaryIds, week.linkedCallEventIds]);

  // Check for changes
  useEffect(() => {
    const changed =
      formData.name !== (week.name || '') ||
      formData.theme !== (week.theme || '') ||
      formData.description !== (week.description || '') ||
      formData.weeklyPrompt !== (week.weeklyPrompt || '') ||
      formData.manualNotes !== (week.manualNotes || '') ||
      formData.distribution !== (week.distribution || 'repeat-daily') ||
      formData.coachRecordingUrl !== (week.coachRecordingUrl || '') ||
      formData.coachRecordingNotes !== (week.coachRecordingNotes || '') ||
      JSON.stringify(formData.weeklyTasks) !== JSON.stringify(week.weeklyTasks || []) ||
      JSON.stringify(formData.currentFocus) !== JSON.stringify(week.currentFocus || []) ||
      JSON.stringify(formData.notes) !== JSON.stringify(week.notes || []) ||
      JSON.stringify(formData.linkedSummaryIds) !== JSON.stringify(week.linkedSummaryIds || []) ||
      JSON.stringify(formData.linkedCallEventIds) !== JSON.stringify(week.linkedCallEventIds || []);
    setHasChanges(changed);
  }, [formData, week]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await onSave({
        name: formData.name || undefined,
        theme: formData.theme || undefined,
        description: formData.description || undefined,
        weeklyPrompt: formData.weeklyPrompt || undefined,
        weeklyTasks: formData.weeklyTasks.length > 0 ? formData.weeklyTasks : undefined,
        currentFocus: formData.currentFocus.length > 0 ? formData.currentFocus : undefined,
        notes: formData.notes.length > 0 ? formData.notes : undefined,
        manualNotes: formData.manualNotes || undefined,
        distribution: formData.distribution,
        coachRecordingUrl: formData.coachRecordingUrl || undefined,
        coachRecordingNotes: formData.coachRecordingNotes || undefined,
        linkedSummaryIds: formData.linkedSummaryIds.length > 0 ? formData.linkedSummaryIds : undefined,
        linkedCallEventIds: formData.linkedCallEventIds.length > 0 ? formData.linkedCallEventIds : undefined,
      });
      setHasChanges(false);
      setSaveStatus('saved');

      // After animation, show sync button for individual programs in template mode
      setTimeout(() => {
        setSaveStatus('idle');
        if (programType === 'individual' && !isClientView) {
          setShowSyncButton(true);
        }
      }, 1500);
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('idle');
    }
  };

  // Link management for call summaries
  const addSummaryLink = (summaryId: string) => {
    if (!formData.linkedSummaryIds.includes(summaryId)) {
      setFormData({
        ...formData,
        linkedSummaryIds: [...formData.linkedSummaryIds, summaryId],
      });
    }
  };

  const removeSummaryLink = (summaryId: string) => {
    setFormData({
      ...formData,
      linkedSummaryIds: formData.linkedSummaryIds.filter(id => id !== summaryId),
    });
  };

  // Link management for call events
  const addEventLink = (eventId: string) => {
    if (!formData.linkedCallEventIds.includes(eventId)) {
      setFormData({
        ...formData,
        linkedCallEventIds: [...formData.linkedCallEventIds, eventId],
      });
    }
  };

  const removeEventLink = (eventId: string) => {
    setFormData({
      ...formData,
      linkedCallEventIds: formData.linkedCallEventIds.filter(id => id !== eventId),
    });
  };

  // Filter available items to exclude already linked ones
  const availableSummariesToLink = availableCallSummaries.filter(
    s => !formData.linkedSummaryIds.includes(s.id)
  );
  const availableEventsToLink = availableEvents.filter(
    e => !formData.linkedCallEventIds.includes(e.id)
  );

  // Task management
  const addTask = () => {
    if (!newTask.trim()) return;
    const task: ProgramTaskTemplate = {
      label: newTask.trim(),
      isPrimary: true,
      type: 'task',
    };
    setFormData({ ...formData, weeklyTasks: [...formData.weeklyTasks, task] });
    setNewTask('');
    trackFieldEdit('syncTasks');
  };

  const removeTask = (index: number) => {
    setFormData({
      ...formData,
      weeklyTasks: formData.weeklyTasks.filter((_, i) => i !== index),
    });
    trackFieldEdit('syncTasks');
  };

  const toggleTaskPrimary = (index: number) => {
    const updated = [...formData.weeklyTasks];
    updated[index] = { ...updated[index], isPrimary: !updated[index].isPrimary };
    setFormData({ ...formData, weeklyTasks: updated });
    trackFieldEdit('syncTasks');
  };

  // Focus management (max 3)
  const addFocus = () => {
    if (!newFocus.trim() || formData.currentFocus.length >= 3) return;
    setFormData({ ...formData, currentFocus: [...formData.currentFocus, newFocus.trim()] });
    setNewFocus('');
    trackFieldEdit('syncFocus');
  };

  const removeFocus = (index: number) => {
    setFormData({
      ...formData,
      currentFocus: formData.currentFocus.filter((_, i) => i !== index),
    });
    trackFieldEdit('syncFocus');
  };

  // Notes management (max 3)
  const addNote = () => {
    if (!newNote.trim() || formData.notes.length >= 3) return;
    setFormData({ ...formData, notes: [...formData.notes, newNote.trim()] });
    setNewNote('');
    trackFieldEdit('syncNotes');
  };

  const removeNote = (index: number) => {
    setFormData({
      ...formData,
      notes: formData.notes.filter((_, i) => i !== index),
    });
    trackFieldEdit('syncNotes');
  };

  // Handle recording file selection
  const handleRecordingSelect = (file: File) => {
    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm'];
    if (!validTypes.some(t => file.type.includes(t.split('/')[1]))) {
      setRecordingError('Invalid file type. Please upload an audio or video file.');
      return;
    }
    // Validate file size (500MB max)
    if (file.size > 500 * 1024 * 1024) {
      setRecordingError('File too large. Maximum size is 500MB.');
      return;
    }
    setRecordingFile(file);
    setRecordingError(null);
    setRecordingStatus('idle');
  };

  // Check if we're in cohort mode (group program with cohort selected)
  const isCohortMode = programType === 'group' && !!cohortId;

  // Upload recording and optionally generate summary
  const handleUploadAndGenerateSummary = async () => {
    if (!recordingFile) return;

    // For summary generation, we need either a client context (individual) or cohort context (group)
    if (!clientUserId && !cohortId) {
      setRecordingError(programType === 'group' 
        ? 'Please select a cohort to upload recordings' 
        : 'Please select a client view to generate summaries');
      return;
    }

    try {
      setRecordingStatus('uploading');
      setUploadProgress(0);
      setRecordingError(null);

      const formDataUpload = new FormData();
      formDataUpload.append('file', recordingFile);
      // For individual programs, use clientUserId; for group programs, use cohortId
      if (clientUserId) {
        formDataUpload.append('clientUserId', clientUserId);
      }
      if (cohortId) {
        formDataUpload.append('cohortId', cohortId);
      }
      if (enrollmentId) {
        formDataUpload.append('programEnrollmentId', enrollmentId);
      }
      // For cohort mode, also send programId and weekId for cohort_week_content storage
      if (cohortId && programId) {
        formDataUpload.append('programId', programId);
        formDataUpload.append('weekId', week.id);
      }

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise<{ success: boolean; recordingId?: string; error?: string }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
      });

      xhr.open('POST', '/api/coach/recordings/upload');
      xhr.send(formDataUpload);

      setRecordingStatus('processing');
      const result = await uploadPromise;

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setRecordingStatus('generating');

      // Poll for summary completion
      if (result.recordingId) {
        const summaryId = await pollForSummary(result.recordingId);
        if (summaryId) {
          // Auto-link the summary to this week
          setFormData(prev => ({
            ...prev,
            linkedSummaryIds: [...prev.linkedSummaryIds, summaryId],
          }));
          onSummaryGenerated?.(summaryId);
        }
      }

      setRecordingStatus('completed');
      setRecordingFile(null);

      // Reset after showing success
      setTimeout(() => {
        setRecordingStatus('idle');
      }, 3000);
    } catch (err) {
      console.error('Error uploading recording:', err);
      setRecordingError(err instanceof Error ? err.message : 'Upload failed');
      setRecordingStatus('error');
    }
  };

  // Poll for summary completion
  const pollForSummary = async (recordingId: string): Promise<string | null> => {
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`/api/coach/recordings/${recordingId}/status`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'completed' && data.callSummaryId) {
            return data.callSummaryId;
          }
          if (data.status === 'failed') {
            throw new Error(data.error || 'Processing failed');
          }
        }
      } catch (err) {
        console.error('Error polling for summary:', err);
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    return null;
  };

  // Simple upload without summary (for template mode)
  const handleSimpleUpload = async (file: File) => {
    try {
      setRecordingStatus('uploading');
      setUploadProgress(0);

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setFormData(prev => ({ ...prev, coachRecordingUrl: data.url }));
      setRecordingStatus('completed');
      setRecordingFile(null);

      setTimeout(() => {
        setRecordingStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Error uploading:', err);
      setRecordingError(err instanceof Error ? err.message : 'Upload failed');
      setRecordingStatus('error');
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <h3 className="text-lg sm:text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Week {week.weekNumber}
          </h3>
          {/* Client/Cohort/Template mode badge */}
          {isClientView ? (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              {clientName || 'Client'}
            </span>
          ) : isCohortMode ? (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <Users className="w-3 h-3" />
              {cohortName || 'Cohort'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-[#f3f1ef] text-[#5f5a55] dark:bg-[#262b35] dark:text-[#b2b6c2]">
              <FileText className="w-3 h-3" />
              Template
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {onFillWithAI && (
            <Button
              variant="outline"
              onClick={onFillWithAI}
              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Fill with</span> AI
            </Button>
          )}

          {/* Save/Sync Button with Morph Animation - only render when there's something to show */}
          {(saveStatus !== 'idle' || hasChanges || showSyncButton) && (
            <div className="relative min-w-[100px] sm:min-w-[140px]">
              <AnimatePresence mode="wait">
                {saveStatus === 'saving' && (
                  <motion.div
                    key="saving"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button disabled className="flex items-center gap-1.5 w-full justify-center h-8 sm:h-9 text-xs sm:text-sm">
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                      <span className="hidden sm:inline">Saving...</span>
                    </Button>
                  </motion.div>
                )}

                {saveStatus === 'saved' && (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      className="flex items-center gap-1.5 w-full justify-center bg-green-600 hover:bg-green-600 text-white h-8 sm:h-9 text-xs sm:text-sm"
                      disabled
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </motion.div>
                      <span className="hidden sm:inline">Saved!</span>
                    </Button>
                  </motion.div>
                )}

                {saveStatus === 'idle' && hasChanges && !showSyncButton && (
                  <motion.div
                    key="save"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 w-full justify-center h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Save
                    </Button>
                  </motion.div>
                )}

                {saveStatus === 'idle' && showSyncButton && (
                  <motion.div
                    key="sync"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      variant="outline"
                      onClick={() => setSyncDialogOpen(true)}
                      className="flex items-center gap-1.5 w-full justify-center border-brand-accent text-brand-accent hover:bg-brand-accent/10 h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Sync to Clients</span>
                      <span className="sm:hidden">Sync</span>
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Fill source indicator */}
      {week.fillSource && (
        <div className="flex items-center gap-2 p-2 bg-brand-accent/10 rounded-lg">
          <Sparkles className="w-4 h-4 text-brand-accent" />
          <span className="text-sm text-brand-accent font-albert">
            Generated from {week.fillSource.type === 'call_summary' ? 'call summary' : week.fillSource.type}
            {week.fillSource.sourceName && `: ${week.fillSource.sourceName}`}
          </span>
        </div>
      )}

      {/* Basic Info Section - collapsed by default */}
      <CollapsibleSection
        title="Basic Info"
        icon={Info}
        defaultOpen={false}
      >
        {/* Week Name */}
        <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Week Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); trackFieldEdit('syncName'); }}
            placeholder={`Week ${week.weekNumber}`}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
          />
        </div>

        {/* Week Theme */}
        <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Theme
          </label>
          <input
            type="text"
            value={formData.theme}
            onChange={(e) => { setFormData({ ...formData, theme: e.target.value }); trackFieldEdit('syncTheme'); }}
            placeholder="e.g., Building Foundations"
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
          />
        </div>

        {/* Week Description */}
        <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => { setFormData({ ...formData, description: e.target.value }); trackFieldEdit('syncName'); }}
            placeholder="What clients will accomplish this week..."
            rows={2}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
          />
        </div>
      </CollapsibleSection>

      {/* Tasks & Focus Section */}
      <CollapsibleSection
          title="Tasks & Focus"
          icon={ListTodo}
          defaultOpen={true}
        >
          {/* Weekly Tasks */}
          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
              Weekly Tasks
            </label>
            <div className="space-y-2 mb-3">
              {formData.weeklyTasks.map((task, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                >
                  <GripVertical className="w-4 h-4 text-[#a7a39e] dark:text-[#7d8190] cursor-grab" />
                  <button
                    onClick={() => toggleTaskPrimary(index)}
                    className={`p-1 rounded ${
                      task.isPrimary
                        ? 'bg-brand-accent/20 text-brand-accent'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                    }`}
                    title={task.isPrimary ? 'Primary (Daily Focus)' : 'Secondary (Backlog)'}
                  >
                    <Target className="w-3 h-3" />
                  </button>
                  <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {task.label}
                  </span>
                  <button
                    onClick={() => removeTask(index)}
                    className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a task..."
                className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
              />
              <Button onClick={addTask} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Current Focus (max 3) */}
          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              <Target className="w-4 h-4 inline mr-1.5" />
              Current Focus <span className="text-xs text-[#a7a39e] font-normal">(max 3)</span>
            </label>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
              Key priorities shown to the client for this week
            </p>
            <div className="space-y-2 mb-3">
              {formData.currentFocus.map((focus, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                >
                  <span className="w-2 h-2 rounded-full bg-brand-accent" />
                  <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {focus}
                  </span>
                  <button
                    onClick={() => removeFocus(index)}
                    className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            {formData.currentFocus.length < 3 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFocus}
                  onChange={(e) => setNewFocus(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addFocus()}
                  placeholder="Add focus area..."
                  className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                />
                <Button onClick={addFocus} variant="outline" size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CollapsibleSection>

      {/* Client Notes Section - collapsed by default */}
      <CollapsibleSection
        title="Client Notes"
        icon={ClipboardList}
        defaultOpen={false}
      >
        {/* Weekly Prompt */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Weekly Prompt
          </label>
          <textarea
            value={formData.weeklyPrompt}
            onChange={(e) => { setFormData({ ...formData, weeklyPrompt: e.target.value }); trackFieldEdit('syncPrompt'); }}
            placeholder="Motivational message or guidance for this week..."
            rows={2}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
          />
        </div>

        {/* Current Focus (max 3) */}
        <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              <Target className="w-4 h-4 inline mr-1.5" />
              Current Focus <span className="text-xs text-[#a7a39e] font-normal">(max 3)</span>
            </label>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
              Key priorities shown to the client for this week
            </p>
            <div className="space-y-2 mb-3">
              {formData.currentFocus.map((focus, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                >
                  <span className="w-2 h-2 rounded-full bg-brand-accent" />
                  <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {focus}
                  </span>
                  <button
                    onClick={() => removeFocus(index)}
                    className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            {formData.currentFocus.length < 3 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFocus}
                  onChange={(e) => setNewFocus(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addFocus()}
                  placeholder="Add focus area..."
                  className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                />
                <Button onClick={addFocus} variant="outline" size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

        {/* Notes (max 3) */}
        <div>
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <FileText className="w-4 h-4 inline mr-1.5" />
            Notes <span className="text-xs text-[#a7a39e] font-normal">(max 3)</span>
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Reminders or context for the client
          </p>
          <div className="space-y-2 mb-3">
            {formData.notes.map((note, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
              >
                <span className="w-2 h-2 rounded-full bg-[#a7a39e]" />
                <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {note}
                </span>
                <button
                  onClick={() => removeNote(index)}
                  className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {formData.notes.length < 3 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Add note..."
                className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
              />
              <Button onClick={addNote} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Linked Call Summaries */}
        <div>
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <MessageSquare className="w-4 h-4 inline mr-1.5" />
            Linked Call Summaries
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Call summaries linked to this week for context and action items
          </p>

          {/* Currently linked summaries */}
          {formData.linkedSummaryIds.length > 0 && (
            <div className="space-y-2 mb-3">
              {formData.linkedSummaryIds.map((summaryId) => {
                const summary = availableCallSummaries.find(s => s.id === summaryId);
                const summaryLabel = summary?.summary?.executive
                  ? summary.summary.executive.slice(0, 50) + (summary.summary.executive.length > 50 ? '...' : '')
                  : `Summary ${summaryId.slice(0, 8)}...`;
                return (
                  <div
                    key={summaryId}
                    className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                  >
                    <MessageSquare className="w-4 h-4 text-brand-accent" />
                    <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {summaryLabel}
                    </span>
                    {summary?.createdAt && (
                      <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                        {new Date(summary.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    <button
                      onClick={() => removeSummaryLink(summaryId)}
                      className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add summary dropdown */}
          {availableSummariesToLink.length > 0 && (
            <select
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addSummaryLink(e.target.value);
                }
              }}
            >
              <option value="">Add a call summary...</option>
              {availableSummariesToLink.map((summary) => {
                const label = summary.summary?.executive
                  ? summary.summary.executive.slice(0, 40) + (summary.summary.executive.length > 40 ? '...' : '')
                  : `Summary from ${new Date(summary.createdAt).toLocaleDateString()}`;
                return (
                  <option key={summary.id} value={summary.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          )}

          {formData.linkedSummaryIds.length === 0 && availableSummariesToLink.length === 0 && (
            <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic">
              No call summaries available to link
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* Coach Private Section */}
      <CollapsibleSection
        title="Coach Private"
        icon={EyeOff}
        description="Not visible to clients"
        defaultOpen={false}
      >
        {/* Coach's Manual Notes */}
        <div>
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <StickyNote className="w-4 h-4 inline mr-1.5" />
            Coach Notes
          </label>
          <textarea
            value={formData.manualNotes}
            onChange={(e) => setFormData({ ...formData, manualNotes: e.target.value })}
            placeholder="Add your notes from calls, observations, or planning..."
            rows={4}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
          />
        </div>

        {/* Coach Recording Upload */}
        <div>
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <Mic className="w-4 h-4 inline mr-1.5" />
            Coach Recording
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            Upload a recording to generate an AI summary
            {(isClientView && clientUserId) || isCohortMode ? (
              <span className="text-brand-accent ml-1">(Summary will be linked to this week)</span>
            ) : null}
          </p>

          {/* Already has a recording URL */}
          {formData.coachRecordingUrl && !recordingFile && recordingStatus === 'idle' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg">
                <Mic className="w-4 h-4 text-brand-accent" />
                <a
                  href={formData.coachRecordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-accent hover:underline truncate flex-1"
                >
                  {formData.coachRecordingUrl.split('/').pop() || 'Recording'}
                </a>
                <button
                  onClick={() => setFormData({ ...formData, coachRecordingUrl: '', coachRecordingNotes: '' })}
                  className="p-1 text-[#a7a39e] hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={formData.coachRecordingNotes}
                onChange={(e) => setFormData({ ...formData, coachRecordingNotes: e.target.value })}
                placeholder="Add notes or transcript from this recording..."
                rows={3}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none text-sm"
              />
            </div>
          ) : recordingFile && recordingStatus === 'idle' ? (
            /* File selected, ready to upload */
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg">
                <Mic className="w-4 h-4 text-brand-accent" />
                <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate flex-1">
                  {recordingFile.name}
                </span>
                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                  {(recordingFile.size / (1024 * 1024)).toFixed(1)} MB
                </span>
                <button
                  onClick={() => { setRecordingFile(null); setRecordingError(null); }}
                  className="p-1 text-[#a7a39e] hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                {(isClientView && clientUserId) || isCohortMode ? (
                  <Button
                    onClick={handleUploadAndGenerateSummary}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Summary
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSimpleUpload(recordingFile)}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Recording
                  </Button>
                )}
              </div>
              {/* Guidance message for template mode */}
              {!isClientView && !isCohortMode && (
                <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] italic">
                  {programType === 'group'
                    ? 'Select a cohort to upload recordings and generate AI summaries'
                    : 'Switch to a client view to generate AI summaries'}
                </p>
              )}
            </div>
          ) : recordingStatus === 'uploading' ? (
            /* Uploading state */
            <div className="p-4 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Uploading... {uploadProgress}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-accent transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : recordingStatus === 'processing' || recordingStatus === 'generating' ? (
            /* Processing/Generating state */
            <div className="p-4 border border-brand-accent/30 bg-brand-accent/5 rounded-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                <div>
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {recordingStatus === 'processing' ? 'Transcribing audio...' : 'Generating AI summary...'}
                  </p>
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                    This may take a few minutes
                  </p>
                </div>
              </div>
            </div>
          ) : recordingStatus === 'completed' ? (
            /* Completed state */
            <div className="p-4 border border-green-500/30 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    Summary generated successfully!
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Linked to this week&apos;s call summaries
                  </p>
                </div>
              </div>
            </div>
          ) : recordingStatus === 'error' ? (
            /* Error state */
            <div className="space-y-3">
              <div className="p-4 border border-red-500/30 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <X className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      {recordingError?.includes('Insufficient credits') ? 'Insufficient credits' : 'Upload failed'}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {recordingError?.includes('Insufficient credits') ? (
                        <a href="/coach/plan" className="underline hover:text-red-700 dark:hover:text-red-300">
                          Upgrade your plan or buy extra credits
                        </a>
                      ) : (
                        recordingError || 'An error occurred'
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => { setRecordingStatus('idle'); setRecordingError(null); }}
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          ) : !isClientView && !isCohortMode ? (
            /* Template mode: Show disabled overlay */
            <div className="relative border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-6 text-center bg-[#faf8f6] dark:bg-[#1e222a]/50">
              <Upload className="w-8 h-8 text-[#c9c5c0] dark:text-[#4a4f5c] mx-auto mb-2" />
              <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-1">
                Recording uploads are not available for templates
              </p>
              <p className="text-xs text-[#a7a39e] dark:text-[#5f6470] font-albert">
                {programType === 'group'
                  ? 'Select a cohort above to upload recordings and generate AI summaries'
                  : 'Select a client above to upload recordings and generate AI summaries'}
              </p>
            </div>
          ) : (
            /* Default: File selector */
            <div className="relative border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-6 text-center hover:border-brand-accent/50 transition-colors">
              <Upload className="w-8 h-8 text-[#a7a39e] dark:text-[#7d8190] mx-auto mb-2" />
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                Drag & drop or click to upload
              </p>
              <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                MP3, MP4, WAV, M4A, or WebM up to 500MB
              </p>
              <input
                type="file"
                accept="audio/*,video/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleRecordingSelect(file);
                  }
                }}
              />
            </div>
          )}

          {/* Error message */}
          {recordingError && recordingStatus === 'idle' && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{recordingError}</p>
          )}
        </div>

        {/* Linked Call Events */}
        <div>
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <Phone className="w-4 h-4 inline mr-1.5" />
            Linked Calls
          </label>
        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
          Scheduled or completed calls associated with this week
        </p>

        {/* Currently linked events */}
        {formData.linkedCallEventIds.length > 0 && (
          <div className="space-y-2 mb-3">
            {formData.linkedCallEventIds.map((eventId) => {
              const event = availableEvents.find(e => e.id === eventId);
              return (
                <div
                  key={eventId}
                  className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg group"
                >
                  <Calendar className="w-4 h-4 text-brand-accent" />
                  <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                    {event?.title || `Event ${eventId.slice(0, 8)}...`}
                  </span>
                  {event?.startDateTime && (
                    <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                      {new Date(event.startDateTime).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    onClick={() => removeEventLink(eventId)}
                    className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add event dropdown */}
        {availableEventsToLink.length > 0 && (
          <select
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                addEventLink(e.target.value);
              }
            }}
          >
            <option value="">Add a call event...</option>
            {availableEventsToLink.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title || 'Call'} - {event.startDateTime ? new Date(event.startDateTime).toLocaleDateString() : 'No date'}
              </option>
            ))}
          </select>
        )}

        {formData.linkedCallEventIds.length === 0 && availableEventsToLink.length === 0 && (
          <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic">
            No call events available to link
          </p>
        )}
        </div>
      </CollapsibleSection>

      {/* Days in Week (Reference Section) */}
      <CollapsibleSection
        title="Days in this Week"
        icon={Calendar}
        defaultOpen={false}
      >
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: week.endDayIndex - week.startDayIndex + 1 }, (_, i) => {
            const dayIndex = week.startDayIndex + i;
            const day = weekDays.find(d => d.dayIndex === dayIndex);
            const hasContent = day && (day.tasks?.length > 0 || day.title);

            return (
              <button
                key={dayIndex}
                onClick={() => onDaySelect?.(dayIndex)}
                className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors text-left"
              >
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Day {dayIndex}
                </span>
                {hasContent && <span className="text-green-500 text-xs">✓</span>}
                {day?.title && (
                  <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] truncate">
                    {day.title}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Day Range Info */}
        <div className="p-3 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg">
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            <span className="font-medium">Day range:</span> {week.startDayIndex} - {week.endDayIndex}
          </p>
        </div>
      </CollapsibleSection>

      {/* Sync to Clients Dialog */}
      {programId && (
        <SyncToClientsDialog
          open={syncDialogOpen}
          onOpenChange={setSyncDialogOpen}
          programId={programId}
          weekNumber={week.weekNumber}
          enrollments={enrollments}
          editedFields={editedFields}
          onSyncComplete={() => {
            setShowSyncButton(false);
            setEditedFields(new Set());
          }}
        />
      )}
    </div>
  );
}
