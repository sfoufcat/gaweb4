'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

/**
 * ProgramEditorContext
 *
 * Manages dirty state for program editing across modules, weeks, and days.
 * Provides a single save mechanism and navigation persistence.
 */

// Entity types that can have pending changes
export type PendingEntityType = 'module' | 'week' | 'day';

// View context types
export type PendingViewContext = 'template' | 'client' | 'cohort';

// A pending change represents unsaved edits to an entity
export interface PendingChange {
  entityType: PendingEntityType;
  entityId: string;
  weekNumber?: number; // For weeks
  dayIndex?: number; // For days
  viewContext: PendingViewContext;
  clientContextId?: string; // enrollmentId or cohortId
  originalData: Record<string, unknown>;
  pendingData: Record<string, unknown>;
  apiEndpoint: string;
  httpMethod: 'PATCH' | 'POST' | 'PUT';
  // Track which fields were actually edited (for smart sync)
  editedFields?: string[];
}

// Result of a save operation
export interface SaveResult {
  success: boolean;
  savedCount: number;
  errors: Array<{
    entityType: PendingEntityType;
    entityId: string;
    error: string;
  }>;
}

interface ProgramEditorContextType {
  // Current program being edited (for scoping changes)
  currentProgramId: string | null;
  setCurrentProgramId: (programId: string | null) => void;

  // Pending changes map
  pendingChanges: Map<string, PendingChange>;

  // Computed state
  hasUnsavedChanges: boolean;
  unsavedCount: number;

  // Saving state
  isSaving: boolean;
  saveError: string | null;

  // Version counter - increments on discard/save to signal editors to reset
  resetVersion: number;

  // Actions
  registerChange: (change: PendingChange) => void;
  updateChange: (key: string, data: Record<string, unknown>, editedFields?: string[]) => void;
  discardChange: (key: string) => void;
  discardAllChanges: () => void;
  saveAllChanges: () => Promise<SaveResult>;

  // Helpers
  getChangeKey: (entityType: PendingEntityType, entityId: string, clientContextId?: string) => string;
  hasChangeForEntity: (entityType: PendingEntityType, entityId: string, clientContextId?: string) => boolean;
  getChangeForEntity: (entityType: PendingEntityType, entityId: string, clientContextId?: string) => PendingChange | undefined;

  // Get all pending data for an entity (for restoring on navigation)
  getPendingData: (entityType: PendingEntityType, entityId: string, clientContextId?: string) => Record<string, unknown> | undefined;

  // Get original data for an entity (for resetting on discard)
  getOriginalData: (entityType: PendingEntityType, entityId: string, clientContextId?: string) => Record<string, unknown> | undefined;
}

const ProgramEditorContext = createContext<ProgramEditorContextType | null>(null);

// Helper to generate unique keys for changes
function generateChangeKey(entityType: PendingEntityType, entityId: string, clientContextId?: string): string {
  return clientContextId
    ? `${entityType}:${entityId}:${clientContextId}`
    : `${entityType}:${entityId}`;
}

// Helper to detect if weekly tasks changed
function weeklyTasksChanged(original: Record<string, unknown>, pending: Record<string, unknown>): boolean {
  const originalTasks = JSON.stringify(original.weeklyTasks || []);
  const pendingTasks = JSON.stringify(pending.weeklyTasks || []);
  return originalTasks !== pendingTasks;
}

interface ProgramEditorProviderProps {
  children: React.ReactNode;
  programId?: string;
}

export function ProgramEditorProvider({ children, programId }: ProgramEditorProviderProps) {
  const [currentProgramId, setCurrentProgramId] = useState<string | null>(programId || null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetVersion, setResetVersion] = useState(0);

  // Update programId when prop changes
  useEffect(() => {
    if (programId !== undefined) {
      setCurrentProgramId(programId);
    }
  }, [programId]);

  // Clear changes when program changes
  useEffect(() => {
    setPendingChanges(new Map());
    setSaveError(null);
  }, [currentProgramId]);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingChanges.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingChanges.size]);

  const hasUnsavedChanges = pendingChanges.size > 0;
  const unsavedCount = pendingChanges.size;

  const getChangeKey = useCallback((
    entityType: PendingEntityType,
    entityId: string,
    clientContextId?: string
  ): string => {
    return generateChangeKey(entityType, entityId, clientContextId);
  }, []);

  const hasChangeForEntity = useCallback((
    entityType: PendingEntityType,
    entityId: string,
    clientContextId?: string
  ): boolean => {
    const key = generateChangeKey(entityType, entityId, clientContextId);
    return pendingChanges.has(key);
  }, [pendingChanges]);

  const getChangeForEntity = useCallback((
    entityType: PendingEntityType,
    entityId: string,
    clientContextId?: string
  ): PendingChange | undefined => {
    const key = generateChangeKey(entityType, entityId, clientContextId);
    return pendingChanges.get(key);
  }, [pendingChanges]);

  const getPendingData = useCallback((
    entityType: PendingEntityType,
    entityId: string,
    clientContextId?: string
  ): Record<string, unknown> | undefined => {
    const change = getChangeForEntity(entityType, entityId, clientContextId);
    return change?.pendingData;
  }, [getChangeForEntity]);

  const getOriginalData = useCallback((
    entityType: PendingEntityType,
    entityId: string,
    clientContextId?: string
  ): Record<string, unknown> | undefined => {
    const change = getChangeForEntity(entityType, entityId, clientContextId);
    return change?.originalData;
  }, [getChangeForEntity]);

  const registerChange = useCallback((change: PendingChange) => {
    const key = generateChangeKey(change.entityType, change.entityId, change.clientContextId);
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      newMap.set(key, change);
      return newMap;
    });
    setSaveError(null);
  }, []);

  const updateChange = useCallback((
    key: string,
    data: Record<string, unknown>,
    editedFields?: string[]
  ) => {
    setPendingChanges(prev => {
      const existing = prev.get(key);
      if (!existing) {
        console.warn(`[ProgramEditor] Attempted to update non-existent change: ${key}`);
        return prev;
      }

      const newMap = new Map(prev);
      newMap.set(key, {
        ...existing,
        pendingData: { ...existing.pendingData, ...data },
        editedFields: editedFields || existing.editedFields,
      });
      return newMap;
    });
  }, []);

  const discardChange = useCallback((key: string) => {
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  }, []);

  const discardAllChanges = useCallback(() => {
    setPendingChanges(new Map());
    setSaveError(null);
    // Increment reset version to signal editors to reset their local state
    setResetVersion(v => v + 1);
  }, []);

  const saveAllChanges = useCallback(async (): Promise<SaveResult> => {
    if (pendingChanges.size === 0) {
      return { success: true, savedCount: 0, errors: [] };
    }

    setIsSaving(true);
    setSaveError(null);

    const result: SaveResult = {
      success: true,
      savedCount: 0,
      errors: [],
    };

    // Group changes by type for ordered saving
    const moduleChanges: PendingChange[] = [];
    const weekChanges: PendingChange[] = [];
    const dayChanges: PendingChange[] = [];

    pendingChanges.forEach((change) => {
      switch (change.entityType) {
        case 'module':
          moduleChanges.push(change);
          break;
        case 'week':
          weekChanges.push(change);
          break;
        case 'day':
          dayChanges.push(change);
          break;
      }
    });

    console.log(`[ProgramEditor] Saving ${moduleChanges.length} modules, ${weekChanges.length} weeks, ${dayChanges.length} days`);

    // 1. Save modules first (can parallelize)
    if (moduleChanges.length > 0) {
      const moduleResults = await Promise.allSettled(
        moduleChanges.map(async (change) => {
          const response = await fetch(change.apiEndpoint, {
            method: change.httpMethod,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(change.pendingData),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}`);
          }

          return change;
        })
      );

      moduleResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          result.savedCount++;
        } else {
          result.success = false;
          result.errors.push({
            entityType: 'module',
            entityId: moduleChanges[i].entityId,
            error: r.reason?.message || 'Unknown error',
          });
        }
      });
    }

    // 2. Save weeks (sequential to avoid race conditions with task distribution)
    for (const change of weekChanges) {
      try {
        const hasTaskChanges = weeklyTasksChanged(change.originalData, change.pendingData);
        
        // Build the body with proper properties for the API
        const body: Record<string, unknown> = {
          ...change.pendingData,
        };
        
        // Only include distribution flags if weekly tasks actually changed
        if (hasTaskChanges) {
          body.distributeTasksNow = true;
          body.overwriteExisting = true; // Overwrite for user-initiated saves
        }

        console.log(`[ProgramEditor] Saving week ${change.entityId} to ${change.apiEndpoint}`, {
          method: change.httpMethod,
          hasTaskChanges,
          viewContext: change.viewContext,
        });

        const response = await fetch(change.apiEndpoint, {
          method: change.httpMethod,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            const errorText = await response.text();
            if (errorText) errorMessage = errorText;
          }
          throw new Error(errorMessage);
        }

        const responseData = await response.json();
        console.log(`[ProgramEditor] Week ${change.entityId} saved successfully`, responseData);
        result.savedCount++;
      } catch (err) {
        console.error(`[ProgramEditor] Failed to save week ${change.entityId}:`, err);
        result.success = false;
        result.errors.push({
          entityType: 'week',
          entityId: change.entityId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // 3. Save days (can parallelize, after weeks complete)
    if (dayChanges.length > 0) {
      console.log(`[ProgramEditor] Saving ${dayChanges.length} day changes`);
      
      const dayResults = await Promise.allSettled(
        dayChanges.map(async (change) => {
          console.log(`[ProgramEditor] Saving day ${change.entityId} to ${change.apiEndpoint}`, {
            method: change.httpMethod,
            viewContext: change.viewContext,
            dayIndex: change.dayIndex,
          });

          const response = await fetch(change.apiEndpoint, {
            method: change.httpMethod,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(change.pendingData),
          });

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorData.message || errorMessage;
            } catch {
              const errorText = await response.text();
              if (errorText) errorMessage = errorText;
            }
            throw new Error(errorMessage);
          }

          const responseData = await response.json();
          console.log(`[ProgramEditor] Day ${change.entityId} saved successfully`, responseData);
          return change;
        })
      );

      dayResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          result.savedCount++;
        } else {
          console.error(`[ProgramEditor] Failed to save day ${dayChanges[i].entityId}:`, r.reason);
          result.success = false;
          result.errors.push({
            entityType: 'day',
            entityId: dayChanges[i].entityId,
            error: r.reason?.message || 'Unknown error',
          });
        }
      });
    }

    // Clear successful changes
    if (result.success) {
      setPendingChanges(new Map());
      // Increment reset version to signal editors they can reset to saved state
      setResetVersion(v => v + 1);
    } else {
      // Keep only failed changes
      const failedKeys = new Set(
        result.errors.map(e => generateChangeKey(e.entityType, e.entityId))
      );
      setPendingChanges(prev => {
        const newMap = new Map();
        prev.forEach((change, key) => {
          if (failedKeys.has(key)) {
            newMap.set(key, change);
          }
        });
        return newMap;
      });
      setSaveError(`Failed to save ${result.errors.length} item(s)`);
    }

    setIsSaving(false);

    console.log(`[ProgramEditor] Save complete: ${result.savedCount} saved, ${result.errors.length} errors`);
    return result;
  }, [pendingChanges]);

  const value = useMemo<ProgramEditorContextType>(() => ({
    currentProgramId,
    setCurrentProgramId,
    pendingChanges,
    hasUnsavedChanges,
    unsavedCount,
    isSaving,
    saveError,
    resetVersion,
    registerChange,
    updateChange,
    discardChange,
    discardAllChanges,
    saveAllChanges,
    getChangeKey,
    hasChangeForEntity,
    getChangeForEntity,
    getPendingData,
    getOriginalData,
  }), [
    currentProgramId,
    pendingChanges,
    hasUnsavedChanges,
    unsavedCount,
    isSaving,
    saveError,
    resetVersion,
    registerChange,
    updateChange,
    discardChange,
    discardAllChanges,
    saveAllChanges,
    getChangeKey,
    hasChangeForEntity,
    getChangeForEntity,
    getPendingData,
    getOriginalData,
  ]);

  return (
    <ProgramEditorContext.Provider value={value}>
      {children}
    </ProgramEditorContext.Provider>
  );
}

// Hook to use the context
export function useProgramEditor(): ProgramEditorContextType {
  const context = useContext(ProgramEditorContext);
  if (!context) {
    throw new Error('useProgramEditor must be used within a ProgramEditorProvider');
  }
  return context;
}

// Optional hook that returns null if not in provider (for optional usage)
export function useProgramEditorOptional(): ProgramEditorContextType | null {
  return useContext(ProgramEditorContext);
}

// Day editor state type
export interface DayEditorState {
  title: string;
  summary: string;
  dailyPrompt: string;
  tasks: Array<{
    label: string;
    type?: string;
    isPrimary: boolean;
    estimatedMinutes?: number;
    notes?: string;
    completed?: boolean;
  }>;
  habits: Array<{
    title: string;
    description?: string;
    frequency: 'daily' | 'weekday' | 'custom';
  }>;
  courseAssignments: Array<{
    courseId: string;
    moduleIds?: string[];
    lessonIds?: string[];
  }>;
}

// Custom hook for day editing that integrates with the context
export function useDayEditorWithContext(
  dayIndex: number,
  initialData: DayEditorState,
  options: {
    programId?: string;
    viewContext: PendingViewContext;
    clientContextId?: string; // enrollmentId or cohortId
    apiEndpoint: string;
  }
) {
  const context = useProgramEditorOptional();
  const [formData, setFormDataInternal] = useState<DayEditorState>(initialData);
  const [hasChanges, setHasChanges] = useState(false);
  const lastResetVersion = useRef(context?.resetVersion ?? 0);
  const lastDayIndex = useRef(dayIndex);

  // Check for pending data from context on mount
  useEffect(() => {
    const entityId = `day-${dayIndex}`;
    const pendingData = context?.getPendingData('day', entityId, options.clientContextId);
    if (pendingData) {
      setFormDataInternal(pendingData as unknown as DayEditorState);
      setHasChanges(true);
    }
  }, [dayIndex, context, options.clientContextId]);

  // Reset when resetVersion changes (discard/save)
  useEffect(() => {
    if (context && context.resetVersion !== lastResetVersion.current) {
      lastResetVersion.current = context.resetVersion;
      // Reset to initial data
      setFormDataInternal(initialData);
      setHasChanges(false);
    }
  }, [context?.resetVersion, initialData, context]);

  // Reset when day index changes
  useEffect(() => {
    if (dayIndex !== lastDayIndex.current) {
      lastDayIndex.current = dayIndex;
      // Check for pending data for the new day
      const entityId = `day-${dayIndex}`;
      const pendingData = context?.getPendingData('day', entityId, options.clientContextId);
      if (pendingData) {
        setFormDataInternal(pendingData as unknown as DayEditorState);
        setHasChanges(true);
      } else {
        setFormDataInternal(initialData);
        setHasChanges(false);
      }
    }
  }, [dayIndex, initialData, context, options.clientContextId]);

  // Check for changes and register with context
  useEffect(() => {
    const changed = JSON.stringify(formData) !== JSON.stringify(initialData);
    setHasChanges(changed);

    if (context && options.programId) {
      const entityId = `day-${dayIndex}`;

      if (changed) {
        context.registerChange({
          entityType: 'day',
          entityId,
          dayIndex,
          viewContext: options.viewContext,
          clientContextId: options.clientContextId,
          originalData: initialData as unknown as Record<string, unknown>,
          pendingData: formData as unknown as Record<string, unknown>,
          apiEndpoint: options.apiEndpoint,
          httpMethod: 'POST',
        });
      } else {
        // Remove from pending changes if no longer changed
        const changeKey = context.getChangeKey('day', entityId, options.clientContextId);
        context.discardChange(changeKey);
      }
    }
  }, [formData, initialData, context, options.programId, options.viewContext, options.clientContextId, options.apiEndpoint, dayIndex]);

  // Wrapper to update form data
  const setFormData = useCallback((updater: DayEditorState | ((prev: DayEditorState) => DayEditorState)) => {
    setFormDataInternal(updater);
  }, []);

  return {
    formData,
    setFormData,
    hasChanges,
  };
}
