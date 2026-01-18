'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { BrandedCheckbox } from '@/components/ui/checkbox';
import type { TemplateSyncOptions } from '@/types';

interface SyncToCohortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  cohortId: string;
  cohortName?: string;
  weekNumber?: number; // Optional: sync specific week only
  editedFields?: Set<string>;
  onSyncComplete?: () => void | Promise<void>;
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

// Default sync fields - all selected for cohort sync (since cohort content is empty initially)
const DEFAULT_SYNC_FIELDS: SyncFieldOptions = {
  syncName: true,
  syncTheme: true,
  syncPrompt: true,
  syncTasks: true,
  syncFocus: true,
  syncNotes: true,
  syncHabits: true,
};

export function SyncToCohortDialog({
  open,
  onOpenChange,
  programId,
  cohortId,
  cohortName,
  weekNumber,
  editedFields,
  onSyncComplete,
}: SyncToCohortDialogProps) {
  // Store editedFields in a ref to avoid re-render loops from Set reference changes
  const editedFieldsRef = useRef<Set<string> | undefined>(editedFields);

  // Update ref when editedFields changes (without triggering re-render)
  useEffect(() => {
    editedFieldsRef.current = editedFields;
  }, [editedFields]);

  // Memoized function to compute initial sync fields from ref
  const getInitialSyncFields = useCallback((): SyncFieldOptions => {
    const fields = editedFieldsRef.current;
    if (fields && fields.size > 0) {
      return {
        syncName: fields.has('syncName'),
        syncTheme: fields.has('syncTheme'),
        syncPrompt: fields.has('syncPrompt'),
        syncTasks: fields.has('syncTasks'),
        syncFocus: fields.has('syncFocus'),
        syncNotes: fields.has('syncNotes'),
        syncHabits: fields.has('syncHabits'),
      };
    }
    // Default: all selected for cohort sync (since cohort content is empty initially)
    return DEFAULT_SYNC_FIELDS;
  }, []);

  // All useState hooks grouped together (React Rules of Hooks)
  const [isMounted, setIsMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [preserveCohortData, setPreserveCohortData] = useState(true);
  const [distributeAfterSync, setDistributeAfterSync] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncFields, setSyncFields] = useState<SyncFieldOptions>(DEFAULT_SYNC_FIELDS);

  // useRef hooks
  const wasOpenRef = useRef(false);

  // useEffect hooks - client-side only rendering to avoid hydration issues with portals
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      // Dialog just opened - initialize fields from ref (stable reference)
      setSyncFields(getInitialSyncFields());
      setError(null);
      setSuccess(null);
    }
    wasOpenRef.current = open;
  }, [open, getInitialSyncFields]);

  const toggleField = (field: keyof SyncFieldOptions) => {
    setSyncFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSync = async () => {
    setError(null);
    setSuccess(null);

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

      const response = await fetch(
        `/api/coach/org-programs/${programId}/cohorts/${cohortId}/sync-template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weekNumbers: weekNumber ? [weekNumber] : undefined,
            syncOptions,
            distributeAfterSync,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sync template');
      }

      const result = await response.json();
      const msg = weekNumber
        ? `Week ${weekNumber} synced to cohort`
        : `${result.weeksUpdated} weeks synced to cohort`;
      setSuccess(result.message || msg);

      // Close after a short delay to show success
      setTimeout(async () => {
        onOpenChange(false);
        await onSyncComplete?.();
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

  // Don't render the dialog portal until mounted on client
  if (!isMounted) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-accent" />
            Sync Template to Cohort
          </DialogTitle>
          <DialogDescription>
            {weekNumber
              ? `Sync Week ${weekNumber} template content to ${cohortName || 'this cohort'}.`
              : `Sync all template weeks to ${cohortName || 'this cohort'}.`}
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
                  Keep cohort&apos;s recordings, notes, and linked calls
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
                Sync to Cohort
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
