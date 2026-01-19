'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  weekNumber?: number;
  targetType: 'clients' | 'cohorts';
  enrollments?: EnrollmentWithUser[];
  cohorts?: ProgramCohort[];
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncFields, setSyncFields] = useState<SyncFieldOptions>(DEFAULT_SYNC_FIELDS);
  const [preserveData, setPreserveData] = useState(true);

  // Data for multi-target mode
  const [enrollments, setEnrollments] = useState<EnrollmentWithUser[]>([]);
  const [cohorts, setCohorts] = useState<ProgramCohort[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [targetMode, setTargetMode] = useState<'all' | 'select'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSingleTargetMode = !!singleCohortId;

  // Set provided data - only if there's actual data (length > 0)
  // Using length check prevents infinite loops when parent passes new [] reference each render
  useEffect(() => {
    if (providedEnrollments && providedEnrollments.length > 0) {
      setEnrollments(providedEnrollments);
    }
  }, [providedEnrollments]);

  useEffect(() => {
    if (providedCohorts && providedCohorts.length > 0) {
      setCohorts(providedCohorts);
    }
  }, [providedCohorts]);

  // Fetch data when dialog opens (if not provided)
  useEffect(() => {
    if (!open || isSingleTargetMode) return;

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
  }, [open, targetType, programId, providedEnrollments, providedCohorts, isSingleTargetMode]);

  // Track previous open state to detect close transitions
  const prevOpenRef = useRef(open);

  // Reset state only when dialog transitions from open to closed
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      // Dialog just closed - reset state
      setError(null);
      setSuccess(null);
      setSyncFields(DEFAULT_SYNC_FIELDS);
      setSelectedIds(new Set());
      setTargetMode('all');
    }
    prevOpenRef.current = open;
  }, [open]);

  const allFieldsSelected = Object.values(syncFields).every(v => v);
  const someFieldsSelected = Object.values(syncFields).some(v => v);

  const toggleSelectAll = useCallback(() => {
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
  }, [allFieldsSelected]);

  const toggleField = useCallback((key: keyof SyncFieldOptions) => {
    setSyncFields(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const getClientName = (enrollment: EnrollmentWithUser) => {
    if (enrollment.user?.firstName || enrollment.user?.lastName) {
      return `${enrollment.user.firstName || ''} ${enrollment.user.lastName || ''}`.trim();
    }
    return enrollment.user?.email || 'Unknown Client';
  };

  const getCohortName = (cohort: ProgramCohort) => {
    return cohort.name || `Cohort ${cohort.id.slice(-6)}`;
  };

  const activeEnrollments = enrollments.filter(e => e.status === 'active' || e.status === 'upcoming');
  const activeCohorts = cohorts.filter(c => c.status === 'active' || c.status === 'upcoming');
  const targets = targetType === 'clients' ? activeEnrollments : activeCohorts;
  const targetLabel = targetType === 'clients' ? 'client' : 'cohort';
  const targetLabelPlural = targetType === 'clients' ? 'clients' : 'cohorts';

  const handleSync = async () => {
    if (!someFieldsSelected) {
      setError('Please select at least one field to sync');
      return;
    }

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

      for (const target of targetsToSync) {
        try {
          const instanceId = isSingleTargetMode || targetType === 'cohorts'
            ? await getInstanceForCohort(target.id, programId)
            : await getInstanceForEnrollment(target.id);

          if (!instanceId) {
            errorCount++;
            continue;
          }

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
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      const weekLabel = weekNumber ? `Week ${weekNumber}` : 'all weeks';
      if (successCount > 0 && errorCount === 0) {
        setSuccess(`Synced ${weekLabel} successfully`);
      } else if (successCount > 0) {
        setSuccess(`Synced to ${successCount}, ${errorCount} failed`);
      } else {
        throw new Error('Failed to sync template');
      }

      setTimeout(() => {
        onOpenChange(false);
        onSyncComplete?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync template');
    } finally {
      setIsSyncing(false);
    }
  };

  const dialogTitle = isSingleTargetMode
    ? `Sync to ${singleCohortName || 'Cohort'}`
    : `Sync to ${targetType === 'clients' ? 'Clients' : 'Cohorts'}`;

  const dialogDesc = isSingleTargetMode
    ? `Push ${weekNumber ? `Week ${weekNumber}` : 'template'} changes.`
    : `Push ${weekNumber ? `Week ${weekNumber}` : 'template'} changes to ${targetLabelPlural}.`;

  const handleTargetModeChange = useCallback((mode: 'all' | 'select') => {
    setTargetMode(mode);
  }, []);

  const handleToggleTarget = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handlePreserveDataChange = useCallback(() => {
    setPreserveData(p => !p);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-accent" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDesc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* What to sync */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                Select what to sync:
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-medium text-brand-accent hover:text-brand-accent/80"
              >
                {allFieldsSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-2">
              {FIELD_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={syncFields[key]}
                    onChange={() => toggleField(key)}
                    className="w-4 h-4 accent-[var(--brand-accent)] cursor-pointer"
                  />
                  <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] group-hover:text-brand-accent transition-colors">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Apply to - only show in multi-target mode */}
          {!isSingleTargetMode && (
            <div>
              <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 block">
                Apply to:
              </span>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="targetMode"
                    checked={targetMode === 'all'}
                    onChange={() => handleTargetModeChange('all')}
                    className="w-4 h-4 accent-[var(--brand-accent)]"
                  />
                  <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                    All {targetLabelPlural} ({targets.length})
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="targetMode"
                    checked={targetMode === 'select'}
                    onChange={() => handleTargetModeChange('select')}
                    className="w-4 h-4 accent-[var(--brand-accent)]"
                  />
                  <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Select specific {targetLabelPlural}
                  </span>
                </label>
              </div>

              {targetMode === 'select' && (
                <div className="mt-3 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                    </div>
                  ) : targets.length === 0 ? (
                    <div className="text-sm text-gray-500 py-4 text-center">
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
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleTarget(id)}
                            className="w-4 h-4 accent-[var(--brand-accent)]"
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
                          <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
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
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={preserveData}
              onChange={handlePreserveDataChange}
              className="w-4 h-4 accent-[var(--brand-accent)] cursor-pointer"
            />
            <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] group-hover:text-brand-accent transition-colors">
              Preserve {targetLabel}-specific data
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
            className="bg-brand-accent hover:bg-brand-accent/90 text-white"
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
