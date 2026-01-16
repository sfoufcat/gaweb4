'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CallSummary, ProgramTaskTemplate } from '@/types';

interface CallSummaryViewModalProps {
  summary: CallSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onFetchTasks?: (tasks: ProgramTaskTemplate[]) => void;
  onSummaryUpdated?: (summary: CallSummary) => void;
  entityName?: string;
}

export function CallSummaryViewModal({
  summary,
  isOpen,
  onClose,
}: CallSummaryViewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Call Summary</DialogTitle>
        </DialogHeader>
        <div>
          {summary ? (
            <p>{summary.summary?.executive || 'No summary content'}</p>
          ) : (
            <p>No summary</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
