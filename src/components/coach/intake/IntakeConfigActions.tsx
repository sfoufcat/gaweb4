'use client';

import React, { useState } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { IntakeCallConfig } from '@/types';
import { IntakeConfigEditor } from './IntakeConfigEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface IntakeConfigActionsProps {
  config: IntakeCallConfig;
  onUpdate?: (config: IntakeCallConfig) => void;
  onDelete?: (configId: string) => void;
  /** Prevent click from propagating (useful when inside a selectable card) */
  stopPropagation?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

export function IntakeConfigActions({
  config,
  onUpdate,
  onDelete,
  stopPropagation = true,
  size = 'md',
}: IntakeConfigActionsProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      const response = await fetch(`/api/coach/intake-configs/${config.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      setShowDeleteConfirm(false);
      onDelete?.(config.id);
    } catch (err) {
      console.error('Error deleting config:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = (updatedConfig: IntakeCallConfig) => {
    setShowEditor(false);
    onUpdate?.(updatedConfig);
  };

  const iconSize = size === 'sm' ? 'h-5 w-5' : 'h-5 w-5';

  return (
    <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#262b35] rounded-lg transition-colors"
          >
            <MoreVertical className={iconSize} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowEditor(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-600 dark:text-red-400"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <IntakeConfigEditor
            config={config}
            onSave={handleSave}
            onCancel={() => setShowEditor(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Intake Call?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{config.name}".
              {error ? (
                <span className="block mt-2 text-red-600 dark:text-red-400">{error}</span>
              ) : (
                ' Existing bookings will not be affected, but the booking link will stop working.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
