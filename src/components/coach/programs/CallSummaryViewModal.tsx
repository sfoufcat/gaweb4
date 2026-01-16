'use client';

import { useState, useEffect } from 'react';
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
  // Client-side only rendering to avoid hydration issues with portals
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render the dialog portal until mounted on client
  if (!isMounted) {
    return null;
  }

  // Safe access to summary content with defensive coding
  const getSummaryContent = () => {
    if (!summary) return 'No summary';
    if (!summary.summary) return 'No summary content';
    return summary.summary.executive || 'No summary content';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Call Summary</DialogTitle>
        </DialogHeader>
        <div>
          <p>{getSummaryContent()}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
