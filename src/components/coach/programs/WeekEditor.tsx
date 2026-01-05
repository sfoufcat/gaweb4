'use client';

import React, { useState, useEffect } from 'react';
import type { ProgramWeek, ProgramDay, ProgramTaskTemplate, ProgramOrientation, CallSummary, WeeklyTaskDistribution, UnifiedEvent } from '@/types';
import { Trash2, Save, Plus, X, Sparkles, GripVertical, Target, FileText, MessageSquare, StickyNote, Repeat, ArrowRight, Upload, Mic, Phone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaUpload } from '@/components/admin/MediaUpload';

interface WeekEditorProps {
  week: ProgramWeek;
  days: ProgramDay[];
  orientation: ProgramOrientation;
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
}

/**
 * Editor for program week content
 * Supports both daily and weekly orientation modes
 */
export function WeekEditor({
  week,
  days,
  orientation,
  onSave,
  onDaySelect,
  onFillWithAI,
  isSaving = false,
  availableCallSummaries = [],
  availableEvents = [],
  isClientView = false,
  clientName,
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
    distribution: (week.distribution || 'repeat-daily') as WeeklyTaskDistribution,
    coachRecordingUrl: week.coachRecordingUrl || '',
    coachRecordingNotes: week.coachRecordingNotes || '',
    linkedSummaryIds: week.linkedSummaryIds || [] as string[],
    linkedCallEventIds: week.linkedCallEventIds || [] as string[],
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [newFocus, setNewFocus] = useState('');
  const [newNote, setNewNote] = useState('');

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
      distribution: (week.distribution || 'repeat-daily') as WeeklyTaskDistribution,
      coachRecordingUrl: week.coachRecordingUrl || '',
      coachRecordingNotes: week.coachRecordingNotes || '',
      linkedSummaryIds: week.linkedSummaryIds || [],
      linkedCallEventIds: week.linkedCallEventIds || [],
    });
    setHasChanges(false);
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
  };

  const removeTask = (index: number) => {
    setFormData({
      ...formData,
      weeklyTasks: formData.weeklyTasks.filter((_, i) => i !== index),
    });
  };

  const toggleTaskPrimary = (index: number) => {
    const updated = [...formData.weeklyTasks];
    updated[index] = { ...updated[index], isPrimary: !updated[index].isPrimary };
    setFormData({ ...formData, weeklyTasks: updated });
  };

  // Focus management (max 3)
  const addFocus = () => {
    if (!newFocus.trim() || formData.currentFocus.length >= 3) return;
    setFormData({ ...formData, currentFocus: [...formData.currentFocus, newFocus.trim()] });
    setNewFocus('');
  };

  const removeFocus = (index: number) => {
    setFormData({
      ...formData,
      currentFocus: formData.currentFocus.filter((_, i) => i !== index),
    });
  };

  // Notes management (max 3)
  const addNote = () => {
    if (!newNote.trim() || formData.notes.length >= 3) return;
    setFormData({ ...formData, notes: [...formData.notes, newNote.trim()] });
    setNewNote('');
  };

  const removeNote = (index: number) => {
    setFormData({
      ...formData,
      notes: formData.notes.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Week {week.weekNumber}
          </h3>
          {/* Client/Template mode badge */}
          {isClientView ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              {clientName || 'Client'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              <FileText className="w-3 h-3" />
              Template
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onFillWithAI && (
            <Button
              variant="outline"
              onClick={onFillWithAI}
              className="flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              Fill with AI
            </Button>
          )}
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
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

      {/* Week Name */}
      <div>
        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
          Week Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
          onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
          placeholder="e.g., Building Foundations"
          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
        />
      </div>

      {/* Task Distribution Mode (Weekly mode only) */}
      {orientation === 'weekly' && (
        <div>
          <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            <Repeat className="w-4 h-4 inline mr-1.5" />
            Task Distribution
          </label>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
            How should this week&apos;s tasks be distributed to days?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, distribution: 'repeat-daily' })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                formData.distribution === 'repeat-daily'
                  ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                  : 'border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent/50'
              }`}
            >
              <Repeat className="w-4 h-4" />
              <div className="text-left">
                <p className="font-medium font-albert">Repeat Daily</p>
                <p className="text-xs opacity-70">All tasks every day</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, distribution: 'spread' })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                formData.distribution === 'spread'
                  ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                  : 'border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent/50'
              }`}
            >
              <ArrowRight className="w-4 h-4" />
              <div className="text-left">
                <p className="font-medium font-albert">Spread</p>
                <p className="text-xs opacity-70">Distribute across week</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Week Description */}
      <div>
        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="What clients will accomplish this week..."
          rows={2}
          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
        />
      </div>

      {/* Weekly Content (only in weekly orientation) */}
      {orientation === 'weekly' && (
        <>
          {/* Weekly Prompt */}
          <div>
            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
              Weekly Prompt
            </label>
            <textarea
              value={formData.weeklyPrompt}
              onChange={(e) => setFormData({ ...formData, weeklyPrompt: e.target.value })}
              placeholder="Motivational message or guidance for this week..."
              rows={2}
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
            />
          </div>

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
        </>
      )}

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

      {/* Coach's Manual Notes */}
      <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
        <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          <StickyNote className="w-4 h-4 inline mr-1.5" />
          Coach Notes
        </label>
        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
          Private notes for this week (not visible to clients)
        </p>
        <textarea
          value={formData.manualNotes}
          onChange={(e) => setFormData({ ...formData, manualNotes: e.target.value })}
          placeholder="Add your notes from calls, observations, or planning..."
          rows={4}
          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
        />
      </div>

      {/* Coach Recording Upload */}
      <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
        <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          <Mic className="w-4 h-4 inline mr-1.5" />
          Coach Recording
        </label>
        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
          Upload a recording or audio note for this week
        </p>
        
        {formData.coachRecordingUrl ? (
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
                onClick={() => setFormData({ ...formData, coachRecordingUrl: '' })}
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
        ) : (
          <div className="relative border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 text-[#a7a39e] dark:text-[#7d8190] mx-auto mb-2" />
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
              Drag & drop or click to upload
            </p>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
              MP3, MP4, WAV, or M4A up to 50MB
            </p>
            <input
              type="file"
              accept="audio/*,video/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // For now, just use a placeholder - actual upload would go through an API
                  const reader = new FileReader();
                  reader.onload = () => {
                    // In a real implementation, upload to storage and get URL
                    setFormData({ ...formData, coachRecordingUrl: URL.createObjectURL(file) });
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Linked Call Summaries */}
      <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
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

      {/* Linked Call Events */}
      <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
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

      {/* Days in Week (daily orientation or as reference) */}
      <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
        <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Days in this Week
        </h4>
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
      </div>

      {/* Day Range Info */}
      <div className="p-3 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg">
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          <span className="font-medium">Day range:</span> {week.startDayIndex} - {week.endDayIndex}
        </p>
      </div>
    </div>
  );
}
