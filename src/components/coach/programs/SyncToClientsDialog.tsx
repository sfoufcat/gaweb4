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
import type { ProgramEnrollment, TemplateSyncOptions } from '@/types';

interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    imageUrl?: string;
  };
}

interface SyncToClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  weekNumber: number;
  enrollments: EnrollmentWithUser[];
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

export function SyncToClientsDialog({
  open,
  onOpenChange,
  programId,
  weekNumber,
  enrollments,
  editedFields,
  onSyncComplete,
}: SyncToClientsDialogProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [targetMode, setTargetMode] = useState<'all' | 'select'>('all');
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<Set<string>>(new Set());
  const [preserveClientData, setPreserveClientData] = useState(true);
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

  // Reset syncFields when dialog opens with new editedFields
  useEffect(() => {
    if (open) {
      setSyncFields(getInitialSyncFields());
      setError(null);
      setSuccess(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editedFields]);

  // Get display name for a client
  const getClientName = (enrollment: EnrollmentWithUser) => {
    if (enrollment.user?.firstName || enrollment.user?.lastName) {
      return `${enrollment.user.firstName || ''} ${enrollment.user.lastName || ''}`.trim();
    }
    return enrollment.user?.email || 'Unknown Client';
  };

  // Filter to active/upcoming enrollments only
  const activeEnrollments = enrollments.filter(
    e => e.status === 'active' || e.status === 'upcoming'
  );

  const toggleEnrollment = (enrollmentId: string) => {
    const next = new Set(selectedEnrollmentIds);
    if (next.has(enrollmentId)) {
      next.delete(enrollmentId);
    } else {
      next.add(enrollmentId);
    }
    setSelectedEnrollmentIds(next);
  };

  const toggleField = (field: keyof SyncFieldOptions) => {
    setSyncFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSync = async () => {
    setError(null);
    setSuccess(null);

    // Validate
    if (targetMode === 'select' && selectedEnrollmentIds.size === 0) {
      setError('Please select at least one client');
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
        preserveClientLinks: preserveClientData,
        preserveManualNotes: preserveClientData,
        preserveRecordings: preserveClientData,
      };

      const response = await fetch(`/api/coach/org-programs/${programId}/sync-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentIds: targetMode === 'all' ? 'all' : Array.from(selectedEnrollmentIds),
          weekNumbers: [weekNumber],
          syncOptions,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sync template');
      }

      const result = await response.json();
      setSuccess(result.message || 'Template synced to clients');

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
            Push Template Changes
          </DialogTitle>
          <DialogDescription>
            Sync Week {weekNumber} template content to enrolled clients.
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
                  All enrolled clients ({activeEnrollments.length})
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <BrandedRadio
                  name="targetMode"
                  checked={targetMode === 'select'}
                  onChange={() => setTargetMode('select')}
                />
                <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Select specific clients...
                </span>
              </label>
            </div>

            {/* Client list when "select" is chosen */}
            {targetMode === 'select' && (
              <div className="mt-3 max-h-40 overflow-y-auto border border-[#e1ddd8] dark:border-[#262b35] rounded-lg">
                {activeEnrollments.length === 0 ? (
                  <div className="p-3 text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2] text-center">
                    No active clients
                  </div>
                ) : (
                  activeEnrollments.map(enrollment => (
                    <label
                      key={enrollment.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer"
                    >
                      <BrandedCheckbox
                        checked={selectedEnrollmentIds.has(enrollment.id)}
                        onChange={() => toggleEnrollment(enrollment.id)}
                      />
                      {enrollment.user?.imageUrl ? (
                        <Image
                          src={enrollment.user.imageUrl}
                          alt={getClientName(enrollment)}
                          width={24}
                          height={24}
                          className="rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                          <User className="h-3 w-3 text-[#5f5a55] dark:text-[#7d8190]" />
                        </div>
                      )}
                      <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {getClientName(enrollment)}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Preserve option */}
          <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <label className="flex items-center gap-3 cursor-pointer">
              <BrandedCheckbox
                checked={preserveClientData}
                onChange={() => setPreserveClientData(!preserveClientData)}
              />
              <div>
                <span className="text-sm font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Preserve client-specific data
                </span>
                <p className="text-xs font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                  Keep each client&apos;s recordings, notes, and linked calls
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
                Push Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
