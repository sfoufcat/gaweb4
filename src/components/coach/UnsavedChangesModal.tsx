'use client';

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
import { AlertTriangle } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
  unsavedCount?: number;
}

/**
 * UnsavedChangesModal
 *
 * A beautiful in-app modal that replaces the native browser dialog
 * when users try to navigate away with unsaved changes.
 */
export function UnsavedChangesModal({
  isOpen,
  onStay,
  onLeave,
  unsavedCount = 1,
}: UnsavedChangesModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onStay()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-3">
            You have {unsavedCount === 1 ? 'an unsaved change' : `${unsavedCount} unsaved changes`} that will be lost if you leave this page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>
            Stay on Page
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onLeave}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Leave Page
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
