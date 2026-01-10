'use client';

import { useState, useEffect, useRef } from 'react';
import { Users, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
import type { ProgramCohort, TemplateSyncOptions } from '@/types';

interface SyncToCohortsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  weekNumber: number;
  cohorts: ProgramCohort[];
  editedFields?: Set<string>;
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

export function SyncToCohortsDialog({
  open,
  onOpenChange,
  programId,
  weekNumber,
  cohorts,
  editedFields,
  onSyncComplete,
}: SyncToCohortsDialogProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [targetMode, setTargetMode] = useState<'all' | 'select'>('all');
  const [selectedCohortIds, setSelectedCohortIds] = useState<Set<string>>(new Set());
  const [preserveCohortData, setPreserveCohortData] = useState(true);
  const [distributeAfterSync, setDistributeAfterSync] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initialize sync fields based on editedFields (if provided) or default to none selected
  const getInitialSyncFields = (): SyncFieldOptions => {
    if (editedFields && editedFields.size > 0) {
      return {
        syncName: editedFields.has('syncName'),
        syncTheme: editedFields.has('syncTheme'),
        syncPrompt: editedFields.has('syncPrompt'),
        syncTasks: editedFields.has('syncTasks'),
        syncFocus: editedFields.has('syncFocus'),
        syncNotes: editedFields.has('syncNotes'),
        syncHabits: editedFields.has('syncHabits'),
      };
    }
    // Default: nothing selected, user must choose what to sync
    return {
      syncName: false,
      syncTheme: false,
      syncPrompt: false,
      syncTasks: false,
      syncFocus: false,
      syncNotes: false,
      syncHabits: false,
    };
  };

  const [syncFields, setSyncFields] = useState<SyncFieldOptions>(getInitialSyncFields);

  // Track if dialog was previously open to detect open transitions
  const wasOpenRef = useRef(false);

  // Select all / deselect all helper
  const allFieldsSelected = Object.values(syncFields).every(v => v);
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

  // Reset syncFields only when dialog opens (transitions from closed to open)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // Dialog just opened - initialize fields
      setSyncFields(getInitialSyncFields());
      setError(null);
      setSuccess(null);
    }
    wasOpenRef.current = open;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Filter to active/upcoming cohorts only
  const activeCohorts = cohorts.filter(
    c => c.status === 'active' || c.status === 'upcoming'
  );

  const toggleCohort = (cohortId: string) => {
    const next = new Set(selectedCohortIds);
    if (next.has(cohortId)) {
      next.delete(cohortId);
    } else {
      next.add(cohortId);
    }
    setSelectedCohortIds(next);
  };

  const toggleField = (field: keyof SyncFieldOptions) => {
    setSyncFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSync = async () => {
    setError(null);
    setSuccess(null);

    // Validate
    if (targetMode === 'select' && selectedCohortIds.size === 0) {
      setError('Please select at least one cohort');
      return;
    }

    const anyFieldSelected = Object.values(syncFields).some(v => v);
    if (!anyFieldSelected) {
      setError('Please select at least one field to sync');
      return;
    }

    setIsSyncing(true);

    try {
      const syncOptions: TemplateSyncOptions = {
        syncName: syncFields.syncName,
        syncTheme: syncFields.syncTheme,
        syncPrompt: syncFields.syncPrompt,
        syncTasks: syncFields.syncTasks,
        syncFocus: syncFields.syncFocus,
        syncNotes: syncFields.syncNotes,
        syncHabits: syncFields.syncHabits,
        preserveClientLinks: preserveCohortData,
        preserveManualNotes: preserveCohortData,
        preserveRecordings: preserveCohortData,
      };

      // Get cohorts to sync
      const cohortsToSync = targetMode === 'all'
        ? activeCohorts
        : activeCohorts.filter(c => selectedCohortIds.has(c.id));

      let totalWeeksUpdated = 0;
      let cohortsProcessed = 0;
      const errors: string[] = [];

      // Sync to each cohort
      for (const cohort of cohortsToSync) {
        try {
          const response = await fetch(
            `/api/coach/org-programs/${programId}/cohorts/${cohort.id}/sync-template`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                weekNumbers: [weekNumber],
                syncOptions,
                distributeAfterSync,
              }),
            }
          );

          if (!response.ok) {
            const data = await response.json();
            errors.push(`${cohort.name}: ${data.error || 'Failed'}`);
            continue;
          }

          const result = await response.json();
          totalWeeksUpdated += result.weeksUpdated || 0;
          cohortsProcessed++;
        } catch (err) {
          errors.push(`${cohort.name}: ${err instanceof Error ? err.message : 'Failed'}`);
        }
      }

      if (errors.length > 0 && cohortsProcessed === 0) {
        throw new Error(errors.join(', '));
      }

      const msg = `Week ${weekNumber} synced to ${cohortsProcessed} cohort${cohortsProcessed !== 1 ? 's' : ''}`;
      setSuccess(errors.length > 0 ? `${msg} (${errors.length} failed)` : msg);

      // Close after a short delay to show success
      setTimeout(() => {
        onOpenChange(false);
        onSyncComplete?.();
        setSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync template');
    } finally {
      setIsSyncing(false);
    }
  };

  const fieldOptions: { key: keyof SyncFieldOptions; label: string }[] = [
    { key: 'syncName', label: 'Week name & description' },
    { key: 'syncTheme', label: 'Week theme' },
    { key: 'syncPrompt', label: 'Weekly prompt' },
    { key: 'syncTasks', label: 'Tasks' },
    { key: 'syncFocus', label: 'Focus items' },
    { key: 'syncNotes', label: 'Notes' },
    { key: 'syncHabits', label: 'Habits' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-accent" />
            Push Template to Cohorts
          </DialogTitle>
          <DialogDescription>
            Sync Week {weekNumber} template content to cohorts.
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
              {fieldOptions.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 cursor-pointer group"
                >
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

          {/* Apply to */}
          <div>
            <label className="text-sm font-medium font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 block">
              Apply to:
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <BrandedRadio
                  name="targetMode"
                  checked={targetMode === 'all'}
                  onChange={() => setTargetMode('all')}
                />
                <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  All active cohorts ({activeCohorts.length})
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <BrandedRadio
                  name="targetMode"
                  checked={targetMode === 'select'}
                  onChange={() => setTargetMode('select')}
                />
                <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Select specific cohorts...
                </span>
              </label>
            </div>

            {/* Cohort list when "select" is chosen */}
            {targetMode === 'select' && (
              <div className="mt-3 max-h-40 overflow-y-auto border border-[#e1ddd8] dark:border-[#262b35] rounded-lg">
                {activeCohorts.length === 0 ? (
                  <div className="p-3 text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2] text-center">
                    No active cohorts
                  </div>
                ) : (
                  activeCohorts.map(cohort => (
                    <label
                      key={cohort.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer"
                    >
                      <BrandedCheckbox
                        checked={selectedCohortIds.has(cohort.id)}
                        onChange={() => toggleCohort(cohort.id)}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                          {cohort.name}
                        </span>
                        {cohort.startDate && (
                          <span className="text-xs font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                            Starts {new Date(cohort.startDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <label className="flex items-center gap-3 cursor-pointer">
              <BrandedCheckbox
                checked={preserveCohortData}
                onChange={() => setPreserveCohortData(!preserveCohortData)}
              />
              <div>
                <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Preserve cohort-specific data
                </span>
                <p className="text-xs font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                  Keep each cohort&apos;s recordings, notes, and linked calls
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <BrandedCheckbox
                checked={distributeAfterSync}
                onChange={() => setDistributeAfterSync(!distributeAfterSync)}
              />
              <div>
                <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Distribute to days after sync
                </span>
                <p className="text-xs font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                  Automatically create cohort day content from synced weeks
                </p>
              </div>
            </label>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm font-albert text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-sm font-albert text-green-600 dark:text-green-400">{success}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                Push to Cohorts
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
