'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

/**
 * ProgramEditorContext
 *
 * Manages dirty state for program editing across modules, weeks, and days.
 * Provides a single save mechanism and navigation persistence.
 */

// Entity types that can have pending changes
export type PendingEntityType = 'module' | 'week' | 'day' | 'instanceModule';

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
  instanceId?: string; // For instance-level entities (instanceModule)
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

// Full structure save options
export interface FullStructureSaveOptions {
  programId: string;
  viewContext: PendingViewContext;
  clientContextId?: string; // cohortId or enrollmentId
  instanceId?: string; // for cohort/client views
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

  // Bypass beforeunload warning (e.g., when there's a credits error)
  bypassBeforeUnload: boolean;
  setBypassBeforeUnload: (bypass: boolean) => void;

  // Navigation blocking state (for in-app unsaved changes dialog)
  showUnsavedDialog: boolean;
  requestNavigation: (navFn: () => void) => void;
  confirmNavigation: () => void;
  cancelNavigation: () => void;

  // Full structure save config - when set, saveAllChanges will save entire structure
  fullStructureSaveOptions: FullStructureSaveOptions | null;
  setFullStructureSaveOptions: (options: FullStructureSaveOptions | null) => void;

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

  // Saved states - persists saved data until API refreshes (survives component unmounts)
  getSavedState: (entityType: PendingEntityType, entityId: string, clientContextId?: string) => Record<string, unknown> | undefined;
  clearSavedState: (entityType: PendingEntityType, entityId: string, clientContextId?: string) => void;
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
  const [bypassBeforeUnload, setBypassBeforeUnload] = useState(false);
  // Saved states - stores data that was just saved, until API refreshes week prop
  // This survives component unmounts, unlike refs in individual editors
  const [savedStates, setSavedStates] = useState<Map<string, Record<string, unknown>>>(new Map());

  // Full structure save options - when set, saveAllChanges saves entire program structure
  const [fullStructureSaveOptions, setFullStructureSaveOptions] = useState<FullStructureSaveOptions | null>(null);

  // Navigation blocking state (for in-app unsaved changes dialog)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

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
    setBypassBeforeUnload(false);
  }, [currentProgramId]);

  // Browser beforeunload warning (only for actual page unload, not in-app navigation)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Skip if bypass is enabled (e.g., credits error - user can't proceed anyway)
      if (bypassBeforeUnload) return;

      if (pendingChanges.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingChanges.size, bypassBeforeUnload]);

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

  // Get saved state for an entity (data that was just saved, awaiting API refresh)
  const getSavedState = useCallback((
    entityType: PendingEntityType,
    entityId: string,
    clientContextId?: string
  ): Record<string, unknown> | undefined => {
    const key = generateChangeKey(entityType, entityId, clientContextId);
    return savedStates.get(key);
  }, [savedStates]);

  // Clear saved state when API has refreshed
  const clearSavedState = useCallback((
    entityType: PendingEntityType,
    entityId: string,
    clientContextId?: string
  ) => {
    const key = generateChangeKey(entityType, entityId, clientContextId);
    setSavedStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  }, []);

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

  // Navigation blocking methods for in-app unsaved changes dialog
  const requestNavigation = useCallback((navFn: () => void) => {
    if (pendingChanges.size > 0) {
      pendingNavigationRef.current = navFn;
      setShowUnsavedDialog(true);
    } else {
      navFn();
    }
  }, [pendingChanges.size]);

  const confirmNavigation = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingChanges(new Map());
    setResetVersion(v => v + 1);
    pendingNavigationRef.current?.();
    pendingNavigationRef.current = null;
  }, []);

  const cancelNavigation = useCallback(() => {
    setShowUnsavedDialog(false);
    pendingNavigationRef.current = null;
  }, []);

  // Browser back/forward interception
  useEffect(() => {
    const handlePopState = () => {
      if (pendingChanges.size > 0) {
        // Push current state back to prevent navigation
        window.history.pushState(null, '', window.location.href);
        setShowUnsavedDialog(true);
        pendingNavigationRef.current = () => window.history.back();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [pendingChanges.size]);

  const saveAllChanges = useCallback(async (): Promise<SaveResult> => {
    setIsSaving(true);
    setSaveError(null);

    const result: SaveResult = {
      success: true,
      savedCount: 0,
      errors: [],
    };

    // Clone pending changes so we can add to it
    const allChanges = new Map(pendingChanges);

    // If full structure save is enabled, fetch and register all weeks + modules
    if (fullStructureSaveOptions) {
      const { programId, viewContext, clientContextId, instanceId } = fullStructureSaveOptions;
      console.log('[ProgramEditor] Full structure save enabled', { programId, viewContext, clientContextId, instanceId });

      try {
        if (viewContext === 'template') {
          // Fetch template program with embedded weeks
          const [programResponse, modulesResponse] = await Promise.all([
            fetch(`/api/coach/org-programs/${programId}`),
            fetch(`/api/coach/org-programs/${programId}/modules`),
          ]);

          if (programResponse.ok) {
            const data = await programResponse.json();
            const program = data.program;

            // Register all weeks that aren't already in pending changes
            if (program?.weeks && Array.isArray(program.weeks)) {
              for (const week of program.weeks) {
                const weekKey = generateChangeKey('week', week.id, undefined);
                if (!allChanges.has(weekKey)) {
                  // Check if there's a pending change we should preserve
                  const existingChange = pendingChanges.get(weekKey);
                  if (existingChange) {
                    allChanges.set(weekKey, existingChange);
                  } else {
                    // Register unchanged week for full structure save
                    allChanges.set(weekKey, {
                      entityType: 'week',
                      entityId: week.id,
                      weekNumber: week.weekNumber,
                      viewContext: 'template',
                      clientContextId: undefined,
                      originalData: week,
                      pendingData: week,
                      apiEndpoint: `/api/coach/org-programs/${programId}/weeks/${week.id}`,
                      httpMethod: 'PATCH',
                    });
                  }
                }
              }
            }
          }

          // Register modules from separate endpoint
          if (modulesResponse.ok) {
            const modulesData = await modulesResponse.json();
            if (modulesData.modules && Array.isArray(modulesData.modules)) {
              for (const module of modulesData.modules) {
                const moduleKey = generateChangeKey('module', module.id, undefined);
                if (!allChanges.has(moduleKey)) {
                  const existingChange = pendingChanges.get(moduleKey);
                  if (existingChange) {
                    allChanges.set(moduleKey, existingChange);
                  } else {
                    allChanges.set(moduleKey, {
                      entityType: 'module',
                      entityId: module.id,
                      viewContext: 'template',
                      clientContextId: undefined,
                      originalData: module,
                      pendingData: module,
                      apiEndpoint: `/api/coach/org-programs/${programId}/modules/${module.id}`,
                      httpMethod: 'PATCH',
                    });
                  }
                }
              }
            }
          }
        } else if (instanceId) {
          // Fetch instance with embedded weeks for cohort/client view
          const response = await fetch(`/api/instances/${instanceId}`);
          if (response.ok) {
            const data = await response.json();
            const instance = data.instance;

            // Register all weeks that aren't already in pending changes
            if (instance?.weeks && Array.isArray(instance.weeks)) {
              for (const week of instance.weeks) {
                const weekKey = generateChangeKey('week', week.id || `week-${week.weekNumber}`, clientContextId);
                if (!allChanges.has(weekKey)) {
                  const existingChange = pendingChanges.get(weekKey);
                  if (existingChange) {
                    allChanges.set(weekKey, existingChange);
                  } else {
                    // Register unchanged week for full structure save
                    allChanges.set(weekKey, {
                      entityType: 'week',
                      entityId: week.id || `week-${week.weekNumber}`,
                      weekNumber: week.weekNumber,
                      viewContext,
                      clientContextId,
                      instanceId,
                      originalData: week,
                      pendingData: week,
                      apiEndpoint: `/api/instances/${instanceId}/weeks/${week.weekNumber}`,
                      httpMethod: 'PATCH',
                    });
                  }
                }
              }
            }

            // Register instance modules
            if (instance?.modules && Array.isArray(instance.modules)) {
              for (const module of instance.modules) {
                const moduleKey = generateChangeKey('instanceModule', module.templateModuleId || module.id, clientContextId);
                if (!allChanges.has(moduleKey)) {
                  const existingChange = pendingChanges.get(moduleKey);
                  if (existingChange) {
                    allChanges.set(moduleKey, existingChange);
                  } else {
                    allChanges.set(moduleKey, {
                      entityType: 'instanceModule',
                      entityId: module.templateModuleId || module.id,
                      viewContext,
                      clientContextId,
                      instanceId,
                      originalData: module,
                      pendingData: module,
                      apiEndpoint: `/api/instances/${instanceId}/modules/${module.templateModuleId || module.id}`,
                      httpMethod: 'PATCH',
                    });
                  }
                }
              }
            }
          }
        }
        console.log(`[ProgramEditor] After full structure fetch: ${allChanges.size} total items to save`);
      } catch (err) {
        console.error('[ProgramEditor] Failed to fetch full structure:', err);
        // Continue with existing pending changes
      }
    }

    if (allChanges.size === 0) {
      setIsSaving(false);
      return { success: true, savedCount: 0, errors: [] };
    }

    // Group changes by type for ordered saving
    const moduleChanges: PendingChange[] = [];
    const instanceModuleChanges: PendingChange[] = [];
    const weekChanges: PendingChange[] = [];
    const dayChanges: PendingChange[] = [];

    allChanges.forEach((change) => {
      switch (change.entityType) {
        case 'module':
          moduleChanges.push(change);
          break;
        case 'instanceModule':
          instanceModuleChanges.push(change);
          break;
        case 'week':
          weekChanges.push(change);
          break;
        case 'day':
          dayChanges.push(change);
          break;
      }
    });

    console.log(`[ProgramEditor] Saving ${moduleChanges.length} modules, ${instanceModuleChanges.length} instanceModules, ${weekChanges.length} weeks, ${dayChanges.length} days`);

    // CRITICAL: Filter out template changes if cohort/client change exists for same entity
    // This is a defensive measure to prevent dual saves even if discardChange timing failed
    // Also skip unchanged weeks (dirty-tracking optimization)
    const filteredWeekChanges = weekChanges.filter(change => {
      // Skip unchanged weeks - if originalData and pendingData are the same reference, no edits were made
      if (change.originalData === change.pendingData) {
        console.log(`[ProgramEditor] SKIPPING unchanged week ${change.entityId}`);
        return false;
      }
      if (change.viewContext === 'template') {
        const hasCohortClientChange = weekChanges.some(c =>
          c.viewContext !== 'template' && c.entityId === change.entityId
        );
        if (hasCohortClientChange) {
          console.log(`[ProgramEditor] SKIPPING template change for week ${change.entityId} - cohort/client change exists`);
          return false;
        }
      }
      return true;
    });

    // Also skip unchanged days (dirty-tracking optimization)
    const filteredDayChanges = dayChanges.filter(change => {
      // Skip unchanged days
      if (change.originalData === change.pendingData) {
        console.log(`[ProgramEditor] SKIPPING unchanged day ${change.entityId}`);
        return false;
      }
      if (change.viewContext === 'template') {
        const hasCohortClientChange = dayChanges.some(c =>
          c.viewContext !== 'template' && c.entityId === change.entityId
        );
        if (hasCohortClientChange) {
          console.log(`[ProgramEditor] SKIPPING template change for day ${change.entityId} - cohort/client change exists`);
          return false;
        }
      }
      return true;
    });

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

    // 1b. Save instance modules (can parallelize, separate from template modules)
    if (instanceModuleChanges.length > 0) {
      const instanceModuleResults = await Promise.allSettled(
        instanceModuleChanges.map(async (change) => {
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

      instanceModuleResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          result.savedCount++;
        } else {
          result.success = false;
          result.errors.push({
            entityType: 'instanceModule',
            entityId: instanceModuleChanges[i].entityId,
            error: r.reason?.message || 'Unknown error',
          });
        }
      });
    }

    // 2. Save weeks (parallelized for performance - dirty-tracking ensures only changed weeks are saved)
    if (filteredWeekChanges.length > 0) {
      console.log(`[ProgramEditor] Saving ${filteredWeekChanges.length} changed weeks in parallel`);

      const weekResults = await Promise.allSettled(
        filteredWeekChanges.map(async (change) => {
          // More robust task change detection
          const originalTasks = (change.originalData.weeklyTasks as unknown[]) || [];
          const pendingTasks = (change.pendingData.weeklyTasks as unknown[]) || [];
          const hasTaskChanges = JSON.stringify(originalTasks) !== JSON.stringify(pendingTasks);
          const isNewWeek = change.httpMethod === 'POST';
          const hasTasks = pendingTasks.length > 0;
          const isClientWeek = change.viewContext === 'client';
          const isCohortWeek = change.viewContext === 'cohort';

          // Extract cohort-specific flags
          const createCohortContentAfter = change.pendingData._createCohortContentAfter as boolean;
          const cohortIdForContent = change.pendingData._cohortId as string | undefined;

          // Build the body with proper properties for the API
          const body: Record<string, unknown> = {
            ...change.pendingData,
          };

          // Remove internal flags from body
          delete body._createCohortContentAfter;
          delete body._cohortId;

          // ONLY distribute for cohort/client (instance) week saves, NEVER for templates
          // Template saves should NOT auto-sync to user tasks - only manual sync does that
          const shouldDistribute = (isClientWeek || isCohortWeek) && (hasTaskChanges || (isNewWeek && hasTasks));

          if (shouldDistribute) {
            body.distributeTasksNow = true;
            // Different APIs use different flag names for overwrite
            body.overwriteExisting = true; // Used by client weeks API
            body.overwriteExistingTasks = true; // Used by cohort weeks API
          }

          console.log(`[ProgramEditor] Saving week ${change.entityId} to ${change.apiEndpoint}`, {
            method: change.httpMethod,
            hasTaskChanges,
            isNewWeek,
            hasTasks,
            isClientWeek,
            isCohortWeek,
            shouldDistribute,
            distributeTasksNow: body.distributeTasksNow,
            originalTasksCount: originalTasks.length,
            pendingTasksCount: pendingTasks.length,
            viewContext: change.viewContext,
            createCohortContentAfter,
            // Add task details for debugging - include sourceResourceId to track resource tasks
            weeklyTasks: Array.isArray(body.weeklyTasks)
              ? (body.weeklyTasks as Array<{ id?: string; label?: string; sourceResourceId?: string }>).map(t => ({ id: t.id, label: t.label, sourceResourceId: t.sourceResourceId }))
              : undefined,
          });

          const response = await fetch(change.apiEndpoint, {
            method: change.httpMethod,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
              // Read body as text first, then try to parse as JSON
              const errorText = await response.text();
              try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error || errorData.message || errorMessage;
              } catch {
                if (errorText) errorMessage = errorText;
              }
            } catch {
              // Couldn't read body at all
            }
            throw new Error(errorMessage);
          }

          const responseData = await response.json();
          console.log(`[ProgramEditor] Week ${change.entityId} saved successfully`, responseData);

          // If this was a template week creation that needs cohort content, create it now
          if (createCohortContentAfter && cohortIdForContent && responseData.week?.id) {
            const newWeekId = responseData.week.id;
            console.log(`[ProgramEditor] Creating cohort content for newly created week ${newWeekId}`);

            try {
              // Extract the programId from the API endpoint
              const programIdMatch = change.apiEndpoint.match(/\/org-programs\/([^/]+)\//);
              const programId = programIdMatch ? programIdMatch[1] : null;

              if (programId) {
                const cohortContentEndpoint = `/api/coach/org-programs/${programId}/cohorts/${cohortIdForContent}/week-content/${newWeekId}`;
                const cohortBody = {
                  weeklyTasks: body.weeklyTasks,
                  weeklyHabits: body.weeklyHabits,
                  weeklyPrompt: body.weeklyPrompt,
                  distribution: body.distribution,
                  manualNotes: body.manualNotes,
                  coachRecordingUrl: body.coachRecordingUrl,
                  coachRecordingNotes: body.coachRecordingNotes,
                  linkedSummaryIds: body.linkedSummaryIds,
                  linkedCallEventIds: body.linkedCallEventIds,
                  distributeTasksNow: hasTasks,
                  overwriteExistingTasks: true, // Cohort API uses this flag name
                };

                const cohortResponse = await fetch(cohortContentEndpoint, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(cohortBody),
                });

                if (!cohortResponse.ok) {
                  console.error(`[ProgramEditor] Failed to create cohort content for week ${newWeekId}`);
                } else {
                  console.log(`[ProgramEditor] Cohort content created for week ${newWeekId}`);
                }
              }
            } catch (cohortErr) {
              console.error(`[ProgramEditor] Error creating cohort content:`, cohortErr);
              // Don't fail the whole save - the template week was created successfully
            }
          }

          return change;
        })
      );

      weekResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          result.savedCount++;
        } else {
          console.error(`[ProgramEditor] Failed to save week ${filteredWeekChanges[i].entityId}:`, r.reason);
          result.success = false;
          result.errors.push({
            entityType: 'week',
            entityId: filteredWeekChanges[i].entityId,
            error: r.reason?.message || 'Unknown error',
          });
        }
      });
    }

    // 3. Save days (can parallelize, after weeks complete)
    if (filteredDayChanges.length > 0) {
      console.log(`[ProgramEditor] Saving ${filteredDayChanges.length} day changes`);

      const dayResults = await Promise.allSettled(
        filteredDayChanges.map(async (change) => {
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
              // Read body as text first, then try to parse as JSON
              const errorText = await response.text();
              try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error || errorData.message || errorMessage;
              } catch {
                if (errorText) errorMessage = errorText;
              }
            } catch {
              // Couldn't read body at all
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
          console.error(`[ProgramEditor] Failed to save day ${filteredDayChanges[i].entityId}:`, r.reason);
          result.success = false;
          result.errors.push({
            entityType: 'day',
            entityId: filteredDayChanges[i].entityId,
            error: r.reason?.message || 'Unknown error',
          });
        }
      });
    }

    // Clear successful changes
    if (result.success) {
      // Store saved states before clearing pending changes
      // This allows editors to restore saved data after unmount/remount
      setSavedStates(prev => {
        const newMap = new Map(prev);
        pendingChanges.forEach((change, key) => {
          newMap.set(key, change.pendingData);
        });
        return newMap;
      });
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
  }, [pendingChanges, fullStructureSaveOptions]);

  const value = useMemo<ProgramEditorContextType>(() => ({
    currentProgramId,
    setCurrentProgramId,
    pendingChanges,
    hasUnsavedChanges,
    unsavedCount,
    isSaving,
    saveError,
    resetVersion,
    bypassBeforeUnload,
    setBypassBeforeUnload,
    showUnsavedDialog,
    requestNavigation,
    confirmNavigation,
    cancelNavigation,
    fullStructureSaveOptions,
    setFullStructureSaveOptions,
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
    getSavedState,
    clearSavedState,
  }), [
    currentProgramId,
    pendingChanges,
    hasUnsavedChanges,
    unsavedCount,
    isSaving,
    saveError,
    resetVersion,
    bypassBeforeUnload,
    showUnsavedDialog,
    requestNavigation,
    confirmNavigation,
    cancelNavigation,
    fullStructureSaveOptions,
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
    getSavedState,
    clearSavedState,
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
        // Use PATCH for instance-based endpoints, POST for legacy endpoints
        const isInstanceEndpoint = options.apiEndpoint.includes('/api/instances/');
        context.registerChange({
          entityType: 'day',
          entityId,
          dayIndex,
          viewContext: options.viewContext,
          clientContextId: options.clientContextId,
          originalData: initialData as unknown as Record<string, unknown>,
          pendingData: formData as unknown as Record<string, unknown>,
          apiEndpoint: options.apiEndpoint,
          httpMethod: isInstanceEndpoint ? 'PATCH' : 'POST',
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
