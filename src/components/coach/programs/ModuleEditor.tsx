'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ProgramModule, ProgramInstanceModule, ProgramWeek, ProgramHabitTemplate, ProgramEnrollment, ProgramCohort } from '@/types';
import { Calendar, AlertTriangle, Info, Plus, X, Users, Save, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProgramEditorOptional } from '@/contexts/ProgramEditorContext';
import { SyncTemplateDialog } from './SyncTemplateDialog';
import { DaysOfWeekSelector } from '@/components/habits/DaysOfWeekSelector';

interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    imageUrl?: string;
  };
}

interface ModuleEditorProps {
  module: ProgramModule | ProgramInstanceModule;
  weeks: ProgramWeek[];
  /** @deprecated Use ProgramEditorContext instead */
  onSave?: (updates: Partial<ProgramModule>) => Promise<void>;
  onDelete?: () => Promise<void>;
  isSaving?: boolean;
  readOnly?: boolean;
  /** Program ID for context registration */
  programId?: string;
  /** Instance ID when editing instance-level module */
  instanceId?: string | null;
  /** Whether to show sync button (requires programId) */
  showSyncHabits?: boolean;
  /** View context: 'template' | 'client' | 'cohort' */
  viewContext?: 'template' | 'client' | 'cohort';
  /** Client context ID (enrollmentId or cohortId) for tracking */
  clientContextId?: string;
  /** Program type for showing appropriate sync button */
  programType?: 'individual' | 'group';
  /** Callback after successful save (for refreshing data) */
  onSaveSuccess?: () => Promise<void>;
  /** Enrollments for sync dialog (individual programs) */
  enrollments?: EnrollmentWithUser[];
  /** Cohorts for sync dialog (group programs) */
  cohorts?: ProgramCohort[];
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
  instanceId,
  showSyncHabits = false,
  viewContext = 'template',
  clientContextId,
  programType,
  onSaveSuccess,
  enrollments,
  cohorts,
}: ModuleEditorProps) {
  // Program editor context for centralized save
  const editorContext = useProgramEditorOptional();

  // Determine if we're in instance mode
  const isInstanceMode = !!instanceId && viewContext !== 'template';
  const entityType = isInstanceMode ? 'instanceModule' : 'module';

  // Check for pending data from context
  const pendingData = editorContext?.getPendingData(entityType, module.id);

  // Track last reset version to detect discard/save
  const lastResetVersion = React.useRef(editorContext?.resetVersion ?? 0);

  // Track if we were saving when reset version changes (to distinguish save vs discard)
  const wasSavingWhenResetVersionChanged = React.useRef(false);

  // Track isSaving changes to know if we WERE saving when resetVersion changes
  // This runs synchronously before the main effect
  if (editorContext?.isSaving && !wasSavingWhenResetVersionChanged.current) {
    wasSavingWhenResetVersionChanged.current = true;
  }

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
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  // Build API endpoint - instance vs template
  const getApiEndpoint = useCallback(() => {
    if (isInstanceMode && instanceId) {
      // Instance-level module endpoint - use templateModuleId (API looks up by this)
      const lookupId = 'templateModuleId' in module ? module.templateModuleId : module.id;
      return `/api/instances/${instanceId}/modules/${lookupId}`;
    }
    if (!programId) return '';
    // Template-level module endpoint
    return `/api/coach/org-programs/${programId}/modules/${module.id}`;
  }, [programId, module, instanceId, isInstanceMode]);

  // Reset form when module changes - but check for pending data or saved state first
  useEffect(() => {
    const contextPendingData = editorContext?.getPendingData(entityType, module.id);
    const contextSavedState = editorContext?.getSavedState?.(entityType, module.id);

    // Restore from pending data (unsaved edits) or saved state (just saved, awaiting API refresh)
    const dataToRestore = contextPendingData || contextSavedState;

    if (dataToRestore) {
      setFormData({
        name: (dataToRestore.name as string) || module.name,
        description: (dataToRestore.description as string) || module.description || '',
        habits: (dataToRestore.habits as ProgramHabitTemplate[]) || module.habits || [],
      });
      setHasChanges(!!contextPendingData); // Only mark changes if pending (not saved)
    } else {
      setFormData(getDefaultFormData());
      setHasChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.id, entityType]);

  // Watch for reset version changes (discard/save from global buttons)
  useEffect(() => {
    if (editorContext && editorContext.resetVersion !== lastResetVersion.current) {
      const wasSave = wasSavingWhenResetVersionChanged.current;

      lastResetVersion.current = editorContext.resetVersion;
      wasSavingWhenResetVersionChanged.current = false; // Reset for next time

      if (wasSave) {
        // SAVE: Keep current formData - it already has the saved values
        // Just clear hasChanges since we saved successfully
        setHasChanges(false);
      } else {
        // DISCARD: Reset to saved state from context or fall back to module prop
        const savedState = editorContext.getSavedState?.(entityType, module.id);
        if (savedState) {
          setFormData({
            name: (savedState.name as string) || module.name,
            description: (savedState.description as string) || module.description || '',
            habits: (savedState.habits as ProgramHabitTemplate[]) || module.habits || [],
          });
        } else {
          setFormData(getDefaultFormData());
        }
        setHasChanges(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorContext?.resetVersion, entityType, module.id]);

  // Extract stable context functions to avoid infinite loops
  // (context object changes on every pendingChanges update)
  const registerChange = editorContext?.registerChange;
  const discardChange = editorContext?.discardChange;
  const getChangeKey = editorContext?.getChangeKey;

  // Check for changes and register with context
  useEffect(() => {
    const habitsChanged = JSON.stringify(formData.habits) !== JSON.stringify(module.habits || []);
    const changed =
      formData.name !== module.name ||
      formData.description !== (module.description || '') ||
      habitsChanged;
    setHasChanges(changed);

    // Register changes with context if available
    // Always require programId, then guard instance mode separately (matches WeekEditor pattern)
    if (registerChange && changed && programId) {
      // Guard for instance mode: must have instanceId
      if (isInstanceMode && !instanceId) {
        console.warn('[ModuleEditor] Instance mode but no instanceId - cannot register');
        return;
      }
      registerChange({
        entityType,
        entityId: module.id,
        viewContext,
        clientContextId,
        instanceId: instanceId || undefined,
        originalData: {
          name: module.name,
          description: module.description,
          habits: module.habits,
        },
        pendingData: formData,
        apiEndpoint: getApiEndpoint(),
        httpMethod: 'PATCH',
      });
    } else if (discardChange && getChangeKey && !changed) {
      // Remove from pending changes if no longer changed
      const changeKey = getChangeKey(entityType, module.id, clientContextId);
      discardChange(changeKey);
    }
  }, [formData, module, registerChange, discardChange, getChangeKey, programId, getApiEndpoint, entityType, viewContext, clientContextId, instanceId, isInstanceMode]);

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
      const changeKey = editorContext.getChangeKey(entityType, module.id);
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
  // For instance modules, match on templateModuleId since weeks reference the template module
  const moduleIdToMatch = (module as ProgramInstanceModule).templateModuleId || module.id;
  const moduleWeeks = weeks.filter(w => w.moduleId === moduleIdToMatch).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">

      {/* Read-only info banner */}
      {readOnly && !isInstanceMode && (
        <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300 font-albert">
            Module settings are managed at the template level. Switch to template view to edit.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 min-h-[36px]">
        <h3 className="text-lg sm:text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {module.name || `Module ${module.order}`}
        </h3>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Save/Discard buttons - show when there are unsaved changes */}
          <AnimatePresence>
            {editorContext?.hasUnsavedChanges && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <button
                  onClick={() => editorContext.discardAllChanges()}
                  disabled={editorContext.isSaving}
                  className="flex items-center justify-center h-8 sm:h-9 w-8 sm:w-auto sm:px-3 text-xs sm:text-sm text-[#5f5a55] hover:text-red-500 dark:text-[#b2b6c2] dark:hover:text-red-400 transition-colors disabled:opacity-50 rounded-xl bg-[#f3f1ef] hover:bg-red-50 dark:bg-[#262b35] dark:hover:bg-red-900/20"
                  title="Discard all changes"
                >
                  <X className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Discard</span>
                </button>
                <Button
                  onClick={async () => {
                    const result = await editorContext.saveAllChanges();
                    if (result.success && onSaveSuccess) {
                      await onSaveSuccess();
                    }
                  }}
                  disabled={editorContext.isSaving}
                  className="flex items-center gap-1.5 h-8 sm:h-9 px-4 sm:px-6 bg-brand-accent hover:bg-brand-accent/90 text-white text-xs sm:text-sm font-medium"
                >
                  {editorContext.isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sync Button - only in template mode */}
          {!readOnly && showSyncHabits && programId && !isInstanceMode && (
            <Button
              variant="outline"
              onClick={() => setShowSyncDialog(true)}
              className="flex items-center gap-1.5 border-brand-accent text-brand-accent hover:bg-brand-accent/10 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Sync to {programType === 'group' ? 'Cohorts' : 'Clients'}</span>
              <span className="sm:hidden">Sync</span>
            </Button>
          )}
        </div>
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
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="min-w-0">
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
              className="text-xs shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Habit
            </Button>
          )}
        </div>

        {formData.habits.length === 0 ? (
          <div className="p-4 bg-[#faf9f7] dark:bg-[#1a1e25] rounded-xl border border-[#eae6e1] dark:border-[#252a34] text-center">
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
          <div className="space-y-2.5">
            {formData.habits.map((habit, index) => (
              <div
                key={index}
                className="group relative p-3 bg-[#faf9f7] dark:bg-[#1a1e25] rounded-xl border border-[#eae6e1] dark:border-[#252a34]"
              >
                {/* Delete button - always visible */}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeHabit(index)}
                    className="absolute -top-2 -right-2 z-10 h-5 w-5 flex items-center justify-center rounded-full bg-white dark:bg-[#11141b] border border-[#e5e1dc] dark:border-[#2a2f3a] text-[#8c8c8c] dark:text-[#7d8190] hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 shadow-sm transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                <div className="space-y-2">
                  {/* Row 1: Title + Frequency side by side */}
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={habit.title}
                      onChange={(e) => updateHabit(index, { title: e.target.value })}
                      placeholder="Habit name"
                      disabled={readOnly}
                      className={`flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#5a5f6d] focus:outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-all ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                    <Select
                      value={habit.frequency}
                      onValueChange={(value) => updateHabit(index, { frequency: value as 'daily' | 'weekday' | 'custom' })}
                      disabled={readOnly}
                    >
                      <SelectTrigger className={`w-[100px] px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-all ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        <SelectValue>
                          {habit.frequency === 'daily' && 'Daily'}
                          {habit.frequency === 'weekday' && 'Weekdays'}
                          {habit.frequency === 'custom' && 'Custom'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Every day</SelectItem>
                        <SelectItem value="weekday">Weekdays only</SelectItem>
                        <SelectItem value="custom">Custom days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Row 2: Custom days selector (when frequency is 'custom') */}
                  {habit.frequency === 'custom' && (
                    <div className="pt-1">
                      <DaysOfWeekSelector
                        selected={habit.customDays || []}
                        onChange={(days) => updateHabit(index, { customDays: days })}
                      />
                    </div>
                  )}

                  {/* Row 3: Linked routine */}
                  <input
                    type="text"
                    value={habit.linkedRoutine || ''}
                    onChange={(e) => updateHabit(index, { linkedRoutine: e.target.value })}
                    placeholder="Linked routine (e.g., after breakfast)"
                    disabled={readOnly}
                    className={`w-full px-3 py-2 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#5a5f6d] focus:outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-all ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
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
                className="flex items-center gap-3 p-3 bg-[#faf9f7] dark:bg-[#1a1e25] rounded-xl border border-[#eae6e1] dark:border-[#252a34]"
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
      {(module.startDayIndex !== undefined && module.endDayIndex !== undefined) && (
        <div className="p-3 bg-[#faf9f7] dark:bg-[#1a1e25] rounded-xl border border-[#eae6e1] dark:border-[#252a34]">
          <p className="text-sm text-[#6b6560] dark:text-[#9a9fac] font-albert">
            <span className="font-medium">Day range:</span> {module.startDayIndex} - {module.endDayIndex}
          </p>
        </div>
      )}

      {/* Instance mode info banner */}
      {isInstanceMode && (
        <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300 font-albert">
            You are editing this {viewContext === 'cohort' ? 'cohort' : 'client'}. Changes will not affect the template or other {viewContext === 'cohort' ? 'cohorts' : 'clients'}.
          </p>
        </div>
      )}

      {/* Template mode sync notice */}
      {!isInstanceMode && programId && (cohorts?.length || enrollments?.length) && (
        <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300 font-albert">
            Changes here won&apos;t auto-sync. Use &quot;Sync to {programType === 'group' ? 'Cohorts' : 'Clients'}&quot; to push updates.
          </p>
        </div>
      )}

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

      {/* Sync Template Dialog */}
      {programId && (
        <SyncTemplateDialog
          open={showSyncDialog}
          onOpenChange={setShowSyncDialog}
          programId={programId}
          targetType={programType === 'group' ? 'cohorts' : 'clients'}
          enrollments={enrollments}
          cohorts={cohorts}
        />
      )}
    </div>
  );
}
