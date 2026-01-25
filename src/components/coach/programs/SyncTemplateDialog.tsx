'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Users, User, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { BrandedCheckbox, BrandedRadio } from '@/components/ui/checkbox';
import { useMediaQuery } from '@/hooks/useMediaQuery';
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

const FIELD_OPTIONS: { key: keyof SyncFieldOptions; label: string; icon?: string }[] = [
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
// Shared Content Component
// ============================================================================

interface SyncContentProps {
  dialogTitle: string;
  dialogDesc: string;
  syncFields: SyncFieldOptions;
  toggleField: (key: keyof SyncFieldOptions) => void;
  toggleSelectAll: () => void;
  allFieldsSelected: boolean;
  someFieldsSelected: boolean;
  isSingleTargetMode: boolean;
  targetMode: 'all' | 'select';
  handleTargetModeChange: (mode: 'all' | 'select') => void;
  targetLabelPlural: string;
  targets: (EnrollmentWithUser | ProgramCohort)[];
  selectedIds: Set<string>;
  handleToggleTarget: (id: string) => void;
  isLoading: boolean;
  targetType: 'clients' | 'cohorts';
  getClientName: (enrollment: EnrollmentWithUser) => string;
  getCohortName: (cohort: ProgramCohort) => string;
  preserveData: boolean;
  handlePreserveDataChange: () => void;
  targetLabel: string;
  error: string | null;
  success: string | null;
}

function SyncContent({
  dialogTitle,
  dialogDesc,
  syncFields,
  toggleField,
  toggleSelectAll,
  allFieldsSelected,
  someFieldsSelected,
  isSingleTargetMode,
  targetMode,
  handleTargetModeChange,
  targetLabelPlural,
  targets,
  selectedIds,
  handleToggleTarget,
  isLoading,
  targetType,
  getClientName,
  getCohortName,
  preserveData,
  handlePreserveDataChange,
  targetLabel,
  error,
  success,
}: SyncContentProps) {
  return (
    <div className="space-y-6">
      {/* Header with icon */}
      <div className="flex items-center gap-3 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-brand-accent" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
            {dialogTitle}
          </h3>
          <p className="text-sm text-text-muted">{dialogDesc}</p>
        </div>
      </div>

      {/* What to sync */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
            Select what to sync
          </span>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs font-medium text-brand-accent hover:text-brand-accent/80 transition-colors"
          >
            {allFieldsSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="space-y-1">
          {FIELD_OPTIONS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group
                hover:bg-brand-accent/5 dark:hover:bg-brand-accent/10 transition-colors"
            >
              <BrandedCheckbox
                checked={syncFields[key]}
                onChange={() => toggleField(key)}
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
          <span className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 block">
            Apply to
          </span>
          <div className="space-y-1">
            <label className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-brand-accent/5 dark:hover:bg-brand-accent/10 transition-colors">
              <BrandedRadio
                checked={targetMode === 'all'}
                onChange={() => handleTargetModeChange('all')}
                name="targetMode"
              />
              <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                All {targetLabelPlural} ({targets.length})
              </span>
            </label>
            <label className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-brand-accent/5 dark:hover:bg-brand-accent/10 transition-colors">
              <BrandedRadio
                checked={targetMode === 'select'}
                onChange={() => handleTargetModeChange('select')}
                name="targetMode"
              />
              <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                Select specific {targetLabelPlural}
              </span>
            </label>
          </div>

          {targetMode === 'select' && (
            <div className="mt-3 max-h-44 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/50">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                </div>
              ) : targets.length === 0 ? (
                <div className="text-sm text-gray-500 py-6 text-center">
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
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors
                        ${isSelected ? 'bg-brand-accent/10' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                      <BrandedCheckbox
                        checked={isSelected}
                        onChange={() => handleToggleTarget(id)}
                      />
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={name}
                          width={28}
                          height={28}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-brand-accent/10 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-brand-accent" />
                        </div>
                      )}
                      <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
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
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
        <label className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group hover:bg-brand-accent/5 dark:hover:bg-brand-accent/10 transition-colors">
          <BrandedCheckbox
            checked={preserveData}
            onChange={handlePreserveDataChange}
          />
          <div>
            <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] group-hover:text-brand-accent transition-colors block">
              Preserve {targetLabel}-specific data
            </span>
            <span className="text-xs text-text-muted">
              Keep existing notes, recordings, and custom links
            </span>
          </div>
        </label>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{typeof error === 'string' ? error : 'An error occurred'}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{typeof success === 'string' ? success : 'Operation completed'}</span>
        </div>
      )}
    </div>
  );
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
  const isDesktop = useMediaQuery('(min-width: 768px)');

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

  const contentProps: SyncContentProps = {
    dialogTitle,
    dialogDesc,
    syncFields,
    toggleField,
    toggleSelectAll,
    allFieldsSelected,
    someFieldsSelected,
    isSingleTargetMode,
    targetMode,
    handleTargetModeChange,
    targetLabelPlural,
    targets,
    selectedIds,
    handleToggleTarget,
    isLoading,
    targetType,
    getClientName,
    getCohortName,
    preserveData,
    handlePreserveDataChange,
    targetLabel,
    error,
    success,
  };

  const footerButtons = (
    <>
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSyncing}
        className="flex-1 sm:flex-none"
      >
        Cancel
      </Button>
      <Button
        onClick={handleSync}
        disabled={isSyncing || !someFieldsSelected}
        className="flex-1 sm:flex-none bg-brand-accent hover:bg-brand-accent/90 text-white shadow-sm"
      >
        {isSyncing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <Users className="w-4 h-4 mr-2" />
            Sync Changes
          </>
        )}
      </Button>
    </>
  );

  // Desktop: Dialog
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDesc}</DialogDescription>
          </DialogHeader>

          <div className="p-6 max-h-[80vh] overflow-y-auto">
            <SyncContent {...contentProps} />
          </div>

          <DialogFooter className="p-4 pt-0 gap-2 sm:gap-2">
            {footerButtons}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Drawer
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{dialogTitle}</DrawerTitle>
          <DrawerDescription>{dialogDesc}</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2 max-h-[70vh] overflow-y-auto">
          <SyncContent {...contentProps} />
        </div>

        <DrawerFooter className="flex-row gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          {footerButtons}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
