'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ProgramModule, ProgramWeek, ProgramHabitTemplate } from '@/types';
import { Trash2, Calendar, AlertTriangle, Info, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { useProgramEditorOptional } from '@/contexts/ProgramEditorContext';

interface ModuleEditorProps {
  module: ProgramModule;
  weeks: ProgramWeek[];
  /** @deprecated Use ProgramEditorContext instead */
  onSave?: (updates: Partial<ProgramModule>) => Promise<void>;
  onDelete?: () => Promise<void>;
  isSaving?: boolean;
  readOnly?: boolean;
  /** Program ID for context registration */
  programId?: string;
}

/**
 * Editor for program module metadata
 * Allows editing name, description, and preview content
 */
export function ModuleEditor({
  module,
  weeks,
  onSave,
  onDelete,
  isSaving = false,
  readOnly = false,
  programId,
}: ModuleEditorProps) {
  // Program editor context for centralized save
  const editorContext = useProgramEditorOptional();

  // Check for pending data from context
  const pendingData = editorContext?.getPendingData('module', module.id);

  // Track last reset version to detect discard/save
  const lastResetVersion = React.useRef(editorContext?.resetVersion ?? 0);

  // Form data type
  type ModuleFormData = {
    name: string;
    description: string;
    habits: ProgramHabitTemplate[];
  };

  const getDefaultFormData = useCallback((): ModuleFormData => ({
    name: module.name,
    description: module.description || '',
    habits: module.habits || [],
  }), [module.name, module.description, module.habits]);

  const [formData, setFormData] = useState<ModuleFormData>(() => {
    if (pendingData) {
      return pendingData as ModuleFormData;
    }
    return getDefaultFormData();
  });
  const [hasChanges, setHasChanges] = useState(!!pendingData);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Build API endpoint
  const getApiEndpoint = useCallback(() => {
    if (!programId) return '';
    return `/api/coach/org-programs/${programId}/modules/${module.id}`;
  }, [programId, module.id]);

  // Reset form when module changes - but check for pending data first
  useEffect(() => {
    const contextPendingData = editorContext?.getPendingData('module', module.id);

    if (contextPendingData) {
      setFormData(contextPendingData as ModuleFormData);
      setHasChanges(true);
    } else {
      setFormData(getDefaultFormData());
      setHasChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.id]);

  // Watch for reset version changes (discard/save from global buttons)
  useEffect(() => {
    if (editorContext && editorContext.resetVersion !== lastResetVersion.current) {
      lastResetVersion.current = editorContext.resetVersion;
      // Reset to original module data
      setFormData(getDefaultFormData());
      setHasChanges(false);
    }
  }, [editorContext?.resetVersion, getDefaultFormData]);

  // Check for changes and register with context
  useEffect(() => {
    const habitsChanged = JSON.stringify(formData.habits) !== JSON.stringify(module.habits || []);
    const changed =
      formData.name !== module.name ||
      formData.description !== (module.description || '') ||
      habitsChanged;
    setHasChanges(changed);

    // Register changes with context if available
    if (editorContext && changed && programId) {
      editorContext.registerChange({
        entityType: 'module',
        entityId: module.id,
        viewContext: 'template', // Modules are always template-level
        originalData: {
          name: module.name,
          description: module.description,
          habits: module.habits,
        },
        pendingData: formData,
        apiEndpoint: getApiEndpoint(),
        httpMethod: 'PATCH',
      });
    } else if (editorContext && !changed) {
      // Remove from pending changes if no longer changed
      const changeKey = editorContext.getChangeKey('module', module.id);
      editorContext.discardChange(changeKey);
    }
  }, [formData, module, editorContext, programId, getApiEndpoint]);

  // handleSave is kept for backwards compatibility but rarely used now
  const handleSave = async () => {
    if (!onSave) {
      console.warn('ModuleEditor: onSave prop not provided');
      return;
    }
    await onSave({
      name: formData.name,
      description: formData.description || undefined,
      habits: formData.habits,
    });
    setHasChanges(false);

    // Clear from context after successful save
    if (editorContext) {
      const changeKey = editorContext.getChangeKey('module', module.id);
      editorContext.discardChange(changeKey);
    }
  };

  // Habit management helpers
  const addHabit = () => {
    if (formData.habits.length >= 3) return;
    const newHabit: ProgramHabitTemplate = {
      title: '',
      description: '',
      frequency: 'daily',
    };
    setFormData({ ...formData, habits: [...formData.habits, newHabit] });
  };

  const updateHabit = (index: number, updates: Partial<ProgramHabitTemplate>) => {
    const newHabits = [...formData.habits];
    newHabits[index] = { ...newHabits[index], ...updates };
    setFormData({ ...formData, habits: newHabits });
  };

  const removeHabit = (index: number) => {
    const newHabits = formData.habits.filter((_, i) => i !== index);
    setFormData({ ...formData, habits: newHabits });
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Get weeks in this module
  const moduleWeeks = weeks.filter(w => w.moduleId === module.id).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Read-only info banner */}
      {readOnly && (
        <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300 font-albert">
            Module settings are managed at the template level. Switch to template view to edit.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {module.name || `Module ${module.order}`}
        </h3>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {onDelete && (
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Module Name */}
      <div>
        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
          Module Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Foundation Phase"
          disabled={readOnly}
          className={`w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* Module Description */}
      <div>
        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
          Description <span className="text-xs text-[#a7a39e]">(shown to clients)</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="What clients will learn in this module..."
          rows={3}
          disabled={readOnly}
          className={`w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* Module Habits Section */}
      <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Module Habits
            </h4>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mt-1">
              Habits active while users are in this module (max 3)
            </p>
          </div>
          {!readOnly && formData.habits.length < 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addHabit}
              className="text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Habit
            </Button>
          )}
        </div>

        {formData.habits.length === 0 ? (
          <div className="p-4 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg text-center">
            <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert">
              No habits defined for this module
            </p>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addHabit}
                className="mt-2 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add your first habit
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {formData.habits.map((habit, index) => (
              <div
                key={index}
                className="p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    {/* Habit Title */}
                    <input
                      type="text"
                      value={habit.title}
                      onChange={(e) => updateHabit(index, { title: e.target.value })}
                      placeholder="Habit title (e.g., Morning journaling)"
                      disabled={readOnly}
                      className={`w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />

                    {/* Habit Description */}
                    <input
                      type="text"
                      value={habit.description || ''}
                      onChange={(e) => updateHabit(index, { description: e.target.value })}
                      placeholder="Description (optional)"
                      disabled={readOnly}
                      className={`w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />

                    {/* Frequency Select */}
                    <select
                      value={habit.frequency}
                      onChange={(e) => updateHabit(index, { frequency: e.target.value as 'daily' | 'weekday' | 'custom' })}
                      disabled={readOnly}
                      className={`w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekday">Weekdays only (Mon-Fri)</option>
                      <option value="custom">Custom (Mon, Wed, Fri)</option>
                    </select>
                  </div>

                  {/* Remove Button */}
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeHabit(index)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 p-1"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {formData.habits.length >= 3 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-albert">
                Maximum 3 habits per module reached
              </p>
            )}
          </div>
        )}
      </div>

      {/* Weeks Overview - Collapsible */}
      <CollapsibleSection
        title={`Weeks in this Module (${moduleWeeks.length})`}
        icon={Calendar}
        defaultOpen={false}
      >
        {moduleWeeks.length > 0 ? (
          <div className="space-y-2">
            {moduleWeeks.map((week) => (
              <div
                key={week.id}
                className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg"
              >
                <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {week.name || `Week ${week.weekNumber}`}
                  </p>
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                    Days {week.startDayIndex}-{week.endDayIndex}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert">
            No weeks in this module yet
          </p>
        )}
      </CollapsibleSection>

      {/* Day Range Info */}
      <div className="p-3 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg">
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          <span className="font-medium">Day range:</span> {module.startDayIndex} - {module.endDayIndex}
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-[#171b22] rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-950/30 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Delete Module
                </h3>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                  Are you sure you want to delete &quot;{module.name}&quot;? This will also remove all weeks
                  and day content within this module. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? 'Deleting...' : 'Delete Module'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
