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
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DiscardUploadDialogProps {
  isOpen: boolean;
  onStay: () => void;
  onDiscard: () => void;
  isDeleting?: boolean;
  /** Custom title (defaults to "Discard Upload?") */
  title?: string;
  /** Custom description */
  description?: string;
}

/**
 * DiscardUploadDialog
 *
 * Confirmation dialog shown when user tries to close an upload modal
 * before saving. Warns that uploaded content will be deleted.
 */
export function DiscardUploadDialog({
  isOpen,
  onStay,
  onDiscard,
  isDeleting = false,
  title = 'Discard Upload?',
  description = 'You have an uploaded file that hasn\'t been saved. If you leave now, the upload will be deleted and you\'ll need to upload again.',
}: DiscardUploadDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onStay()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="font-albert">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-3 font-albert">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay} disabled={isDeleting} className="font-albert">
            Continue Editing
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onDiscard}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white font-albert"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Discard Upload'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
