'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Users, User, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { BrandedCheckbox, BrandedRadio } from '@/components/ui/checkbox';
import type { ProgramEnrollment, ProgramCohort, TemplateSyncOptions } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    imageUrl?: string;
  };
}

interface SyncTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  weekNumber?: number; // Optional: if not provided, syncs all weeks
  targetType: 'clients' | 'cohorts';
  // Optional: pass pre-loaded data to avoid fetching
  enrollments?: EnrollmentWithUser[];
  cohorts?: ProgramCohort[];
  // For single-target mode (e.g., syncing to one specific cohort)
  singleCohortId?: string;
  singleCohortName?: string;
  onSyncComplete?: () => void;
}

interface SyncFieldOptions {
  syncName: boolean;
  syncTheme: boolean;
  syncPrompt: boolean;
  syncTasks: boolean;
  syncFocus: boolean;
  syncNotes: boolean;
  syncHabits: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SYNC_FIELDS: SyncFieldOptions = {
  syncName: false,
  syncTheme: false,
  syncPrompt: false,
  syncTasks: false,
  syncFocus: false,
  syncNotes: false,
  syncHabits: false,
};

const FIELD_OPTIONS: { key: keyof SyncFieldOptions; label: string }[] = [
  { key: 'syncName', label: 'Week name & description' },
  { key: 'syncTheme', label: 'Week theme' },
  { key: 'syncPrompt', label: 'Weekly prompt' },
  { key: 'syncTasks', label: 'Tasks' },
  { key: 'syncFocus', label: 'Focus items' },
  { key: 'syncNotes', label: 'Notes' },
  { key: 'syncHabits', label: 'Habits' },
];

// ============================================================================
// Helper Functions
// ============================================================================

async function getInstanceForEnrollment(enrollmentId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/instances?enrollmentId=${enrollmentId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.instances?.length > 0) {
      return data.instances[0].id;
    }
    // Create instance if doesn't exist
    const createRes = await fetch('/api/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentId }),
    });
    if (!createRes.ok) return null;
    const created = await createRes.json();
    return created.instance?.id || null;
  } catch {
    return null;
  }
}

async function getInstanceForCohort(cohortId: string, programId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/instances?cohortId=${cohortId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.instances?.length > 0) {
      return data.instances[0].id;
    }
    // Create instance if doesn't exist
    const createRes = await fetch('/api/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cohortId, programId }),
    });
    if (!createRes.ok) return null;
    const created = await createRes.json();
    return created.instance?.id || null;
  } catch {
    return null;
  }
}

// ============================================================================
// Component
// ============================================================================

export function SyncTemplateDialog({
  open,
  onOpenChange,
  programId,
  weekNumber,
  targetType,
  enrollments: providedEnrollments,
  cohorts: providedCohorts,
  singleCohortId,
  singleCohortName,
  onSyncComplete,
}: SyncTemplateDialogProps) {
  // Don't render anything when closed
  if (!open) {
    return null;
  }

  return (
    <SyncTemplateDialogContent
      open={open}
      onOpenChange={onOpenChange}
      programId={programId}
      weekNumber={weekNumber}
      targetType={targetType}
      providedEnrollments={providedEnrollments}
      providedCohorts={providedCohorts}
      singleCohortId={singleCohortId}
      singleCohortName={singleCohortName}
      onSyncComplete={onSyncComplete}
    />
  );
}

// Inner component that only mounts when dialog is open
function SyncTemplateDialogContent({
  open,
  onOpenChange,
  programId,
  weekNumber,
  targetType,
  providedEnrollments,
  providedCohorts,
  singleCohortId,
  singleCohortName,
  onSyncComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  weekNumber?: number;
  targetType: 'clients' | 'cohorts';
  providedEnrollments?: EnrollmentWithUser[];
  providedCohorts?: ProgramCohort[];
  singleCohortId?: string;
  singleCohortName?: string;
  onSyncComplete?: () => void;
}) {
  // Single target mode - syncing to one specific cohort
  const isSingleTargetMode = !!singleCohortId;
  // State
  const [isSyncing, setIsSyncing] = useState(false);
  const [targetMode, setTargetMode] = useState<'all' | 'select'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preserveData, setPreserveData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncFields, setSyncFields] = useState<SyncFieldOptions>(DEFAULT_SYNC_FIELDS);

  // Data loading state
  const [enrollments, setEnrollments] = useState<EnrollmentWithUser[]>(providedEnrollments || []);
  const [cohorts, setCohorts] = useState<ProgramCohort[]>(providedCohorts || []);
  const [isLoading, setIsLoading] = useState(!providedEnrollments && !providedCohorts);

  // Fetch data if not provided
  useEffect(() => {
    if (targetType === 'clients' && !providedEnrollments) {
      setIsLoading(true);
      fetch(`/api/coach/org-programs/${programId}/enrollments`)
        .then(res => res.ok ? res.json() : { enrollments: [] })
        .then(data => {
          setEnrollments(data.enrollments || []);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    } else if (targetType === 'cohorts' && !providedCohorts) {
      setIsLoading(true);
      fetch(`/api/coach/org-programs/${programId}/cohorts`)
        .then(res => res.ok ? res.json() : { cohorts: [] })
        .then(data => {
          setCohorts(data.cohorts || []);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, [targetType, programId, providedEnrollments, providedCohorts]);

  // Helpers
  const allFieldsSelected = Object.values(syncFields).every(v => v);
  const someFieldsSelected = Object.values(syncFields).some(v => v);

  const toggleSelectAll = () => {
    const newValue = !allFieldsSelected;
    setSyncFields({
      syncName: newValue,
      syncTheme: newValue,
      syncPrompt: newValue,
      syncTasks: newValue,
      syncFocus: newValue,
      syncNotes: newValue,
      syncHabits: newValue,
    });
  };

  const toggleField = (key: keyof SyncFieldOptions) => {
    setSyncFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getClientName = (enrollment: EnrollmentWithUser) => {
    if (enrollment.user?.firstName || enrollment.user?.lastName) {
      return `${enrollment.user.firstName || ''} ${enrollment.user.lastName || ''}`.trim();
    }
    return enrollment.user?.email || 'Unknown Client';
  };

  const getCohortName = (cohort: ProgramCohort) => {
    return cohort.name || `Cohort ${cohort.id.slice(-6)}`;
  };

  // Filter to active items
  const activeEnrollments = enrollments.filter(e => e.status === 'active' || e.status === 'upcoming');
  const activeCohorts = cohorts.filter(c => c.status === 'active' || c.status === 'upcoming');

  const targets = targetType === 'clients' ? activeEnrollments : activeCohorts;
  const targetLabel = targetType === 'clients' ? 'client' : 'cohort';
  const targetLabelPlural = targetType === 'clients' ? 'clients' : 'cohorts';

  // Handle sync
  const handleSync = async () => {
    if (!someFieldsSelected) {
      setError('Please select at least one field to sync');
      return;
    }

    // In single target mode, sync directly to the specified cohort
    // In multi-target mode, sync to selected targets
    const targetsToSync = isSingleTargetMode
      ? [{ id: singleCohortId!, name: singleCohortName || 'Cohort' }]
      : targetMode === 'all'
        ? targets
        : targets.filter(t => selectedIds.has(t.id));

    if (targetsToSync.length === 0) {
      setError(`No ${targetLabelPlural} selected`);
      return;
    }

    setIsSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const syncOptions: TemplateSyncOptions = {
        syncName: syncFields.syncName,
        syncTheme: syncFields.syncTheme,
        syncPrompt: syncFields.syncPrompt,
        syncTasks: syncFields.syncTasks,
        syncFocus: syncFields.syncFocus,
        syncNotes: syncFields.syncNotes,
        syncHabits: syncFields.syncHabits,
        preserveClientLinks: preserveData,
        preserveManualNotes: preserveData,
        preserveRecordings: preserveData,
      };

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const target of targetsToSync) {
        try {
          // Get or create instance
          const instanceId = isSingleTargetMode || targetType === 'cohorts'
            ? await getInstanceForCohort(target.id, programId)
            : await getInstanceForEnrollment(target.id);

          if (!instanceId) {
            const name = isSingleTargetMode
              ? (singleCohortName || 'Cohort')
              : targetType === 'clients'
                ? getClientName(target as EnrollmentWithUser)
                : getCohortName(target as ProgramCohort);
            errors.push(`Failed to get instance for ${name}`);
            errorCount++;
            continue;
          }

          // Sync template to instance
          // If weekNumber is specified, sync that week; otherwise sync all weeks (pass undefined)
          const res = await fetch(`/api/instances/${instanceId}/sync-template`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              weekNumbers: weekNumber ? [weekNumber] : undefined,
              syncOptions,
              distributeAfterSync: syncFields.syncTasks,
            }),
          });

          if (res.ok) {
            successCount++;
          } else {
            const data = await res.json().catch(() => ({}));
            const name = isSingleTargetMode
              ? (singleCohortName || 'Cohort')
              : targetType === 'clients'
                ? getClientName(target as EnrollmentWithUser)
                : getCohortName(target as ProgramCohort);
            errors.push(`${name}: ${data.error || 'Sync failed'}`);
            errorCount++;
          }
        } catch (err) {
          const name = isSingleTargetMode
            ? (singleCohortName || 'Cohort')
            : targetType === 'clients'
              ? getClientName(target as EnrollmentWithUser)
              : getCohortName(target as ProgramCohort);
          errors.push(`${name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          errorCount++;
        }
      }

      // Show result
      const weekLabel = weekNumber ? `Week ${weekNumber}` : 'all weeks';
      if (successCount > 0 && errorCount === 0) {
        setSuccess(isSingleTargetMode
          ? `Synced ${weekLabel} to ${singleCohortName || 'cohort'}`
          : `Synced ${weekLabel} to ${successCount} ${successCount > 1 ? targetLabelPlural : targetLabel}`);
      } else if (successCount > 0) {
        setSuccess(`Synced to ${successCount} ${targetLabelPlural}, ${errorCount} failed`);
      } else {
        throw new Error(errors[0] || 'Failed to sync template');
      }

      // Close after showing success
      setTimeout(() => {
        onOpenChange(false);
        onSyncComplete?.();
      }, 1500);
    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync template');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-accent" />
            {isSingleTargetMode
              ? `Sync to ${singleCohortName || 'Cohort'}`
              : `Sync to ${targetType === 'clients' ? 'Clients' : 'Cohorts'}`}
          </DialogTitle>
          <DialogDescription>
            {isSingleTargetMode
              ? `Push ${weekNumber ? `Week ${weekNumber}` : 'template'} changes to ${singleCohortName || 'this cohort'}.`
              : `Push ${weekNumber ? `Week ${weekNumber}` : 'template'} changes to ${targetLabelPlural}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* What to sync */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                Select what to sync:
              </label>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-medium font-albert text-brand-accent hover:text-brand-accent/80 transition-colors"
              >
                {allFieldsSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-2">
              {FIELD_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <BrandedCheckbox
                    checked={syncFields[key]}
                    onChange={() => toggleField(key)}
                  />
                  <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8] group-hover:text-brand-accent transition-colors">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Apply to - hide in single target mode */}
          {!isSingleTargetMode && (
          <div>
            <label className="text-sm font-medium font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 block">
              Apply to:
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <BrandedRadio
                  checked={targetMode === 'all'}
                  onChange={() => setTargetMode('all')}
                  name="targetMode"
                />
                <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  All {targetLabelPlural} ({targets.length})
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <BrandedRadio
                  checked={targetMode === 'select'}
                  onChange={() => setTargetMode('select')}
                  name="targetMode"
                />
                <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Select specific {targetLabelPlural}
                </span>
              </label>
            </div>

            {/* Target list when in select mode */}
            {targetMode === 'select' && (
              <div className="mt-3 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                  </div>
                ) : targets.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                    No {targetLabelPlural} found
                  </div>
                ) : (
                  targets.map(target => {
                    const id = target.id;
                    const isSelected = selectedIds.has(id);
                    const name = targetType === 'clients'
                      ? getClientName(target as EnrollmentWithUser)
                      : getCohortName(target as ProgramCohort);
                    const imageUrl = targetType === 'clients'
                      ? (target as EnrollmentWithUser).user?.imageUrl
                      : undefined;

                    return (
                      <label
                        key={id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        <BrandedCheckbox
                          checked={isSelected}
                          onChange={() => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (isSelected) {
                                next.delete(id);
                              } else {
                                next.add(id);
                              }
                              return next;
                            });
                          }}
                        />
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={name}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-brand-accent/10 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-brand-accent" />
                          </div>
                        )}
                        <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                          {name}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
          )}

          {/* Preserve data option */}
          <label className="flex items-center gap-3 cursor-pointer">
            <BrandedCheckbox
              checked={preserveData}
              onChange={() => setPreserveData(v => !v)}
            />
            <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
              Preserve {targetLabel}-specific data (recordings, notes, linked calls)
            </span>
          </label>

          {/* Error/Success messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSyncing}>
            Cancel
          </Button>
          <Button
            onClick={handleSync}
            disabled={isSyncing || !someFieldsSelected}
            className="bg-brand-accent hover:bg-brand-accent/90"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              'Sync Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
