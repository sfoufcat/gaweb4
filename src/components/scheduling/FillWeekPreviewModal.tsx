'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import {
  Wand2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ListTodo,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import type { CallSummary, CallSummaryActionItem } from '@/types';

type FillTarget = 'current' | 'next' | 'until_call';

interface FillWeekPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  summary: CallSummary | null;
  onFilled?: (result: { daysUpdated: number; weeksUpdated: number }) => void;
}

const FILL_OPTIONS: { value: FillTarget; label: string; description: string }[] = [
  { value: 'until_call', label: 'Until next call', description: 'Fill days until the next scheduled call' },
  { value: 'current', label: 'Current week', description: 'Fill remaining days of this week' },
  { value: 'next', label: 'Next week', description: 'Fill all days of next week' },
];

/**
 * FillWeekPreviewModal
 *
 * Shows a preview of action items that will be converted to tasks,
 * allows selecting a fill target, and confirms the action.
 */
export function FillWeekPreviewModal({
  isOpen,
  onClose,
  eventId,
  summary,
  onFilled,
}: FillWeekPreviewModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [state, setState] = useState<'preview' | 'loading' | 'success' | 'error'>('preview');
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ daysUpdated: number; weeksUpdated: number }>();
  const [selectedTarget, setSelectedTarget] = useState<FillTarget>('until_call');
  const [hasNextCall, setHasNextCall] = useState<boolean | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setState('preview');
      setError(undefined);
      setResult(undefined);
    }
  }, [isOpen]);

  // Check if there's a next call
  useEffect(() => {
    if (!isOpen || !eventId) return;

    async function checkNextCall() {
      try {
        const response = await fetch(`/api/events/${eventId}/has-next-call`);
        if (response.ok) {
          const data = await response.json();
          setHasNextCall(data.hasNextCall);
          if (!data.hasNextCall && selectedTarget === 'until_call') {
            setSelectedTarget('current');
          }
        }
      } catch {
        setHasNextCall(false);
      }
    }
    checkNextCall();
  }, [isOpen, eventId, selectedTarget]);

  const fillOptions = useMemo(() => {
    if (hasNextCall === false) {
      return FILL_OPTIONS.filter(opt => opt.value !== 'until_call');
    }
    return FILL_OPTIONS;
  }, [hasNextCall]);

  const handleFill = async () => {
    setState('loading');
    setError(undefined);

    try {
      const response = await fetch(`/api/events/${eventId}/fill-week-from-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fillTarget: selectedTarget }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult({ daysUpdated: data.daysUpdated || 0, weeksUpdated: data.weeksUpdated || 0 });
        setState('success');
        onFilled?.(data);
      } else {
        setError(data.error || 'Failed to fill week');
        setState('error');
      }
    } catch {
      setError('Network error. Please try again.');
      setState('error');
    }
  };

  if (!isMounted) return null;

  // Group action items by assignee
  const clientItems = summary?.actionItems?.filter(i => i.assignedTo === 'client' || i.assignedTo === 'both') || [];
  const coachItems = summary?.actionItems?.filter(i => i.assignedTo === 'coach') || [];

  const ActionItemCard = ({ item }: { item: CallSummaryActionItem }) => (
    <div className="flex items-start gap-3 p-3 bg-white/80 dark:bg-[#1a1d24]/80 rounded-xl border border-[#e8e6e3]/50 dark:border-[#2a2d35]/50">
      <Badge
        variant={
          item.priority === 'high'
            ? 'destructive'
            : item.priority === 'medium'
            ? 'default'
            : 'secondary'
        }
        className="text-xs shrink-0 mt-0.5"
      >
        {item.priority}
      </Badge>
      <span className="flex-1 text-sm text-[#3a3a3a] dark:text-[#d5d5d8]">
        {item.description}
      </span>
    </div>
  );

  const content = (
    <div className="space-y-5">
      {/* Success State */}
      {state === 'success' && result && (
        <div className="p-6 bg-green-50/80 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/50 rounded-2xl">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-800/50 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-green-700 dark:text-green-300">
                Tasks Created!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                {result.daysUpdated} day{result.daysUpdated !== 1 ? 's' : ''} updated
                {result.weeksUpdated > 1 ? ` across ${result.weeksUpdated} weeks` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div className="p-4 bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                Failed to create tasks
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => setState('preview')}
            className="mt-3 w-full py-2 bg-white dark:bg-[#262b35] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading State */}
      {state === 'loading' && (
        <div className="py-12 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-accent/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
              Creating tasks...
            </p>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Converting action items to program tasks
            </p>
          </div>
        </div>
      )}

      {/* Preview State */}
      {state === 'preview' && (
        <>
          {/* Action Items Preview */}
          <div className="space-y-4">
            {/* Client Tasks */}
            {clientItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ListTodo className="w-4 h-4 text-brand-accent" />
                  <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Client Tasks ({clientItems.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {clientItems.map((item) => (
                    <ActionItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Coach Tasks */}
            {coachItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ListTodo className="w-4 h-4 text-purple-500" />
                  <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Coach Tasks ({coachItems.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {coachItems.map((item) => (
                    <ActionItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* No items */}
            {clientItems.length === 0 && coachItems.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                  No action items found in this summary
                </p>
              </div>
            )}
          </div>

          {/* Fill Target Selection */}
          {(clientItems.length > 0 || coachItems.length > 0) && (
            <div className="pt-2 border-t border-[#e8e6e3]/50 dark:border-[#2a2d35]/50">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Add tasks to:
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {fillOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedTarget(option.value)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                      selectedTarget === option.value
                        ? "bg-brand-accent text-white"
                        : "bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e8e6e3] dark:hover:bg-[#313746]"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] bg-[#f3f1ef] dark:bg-[#262b35] hover:bg-[#e8e6e3] dark:hover:bg-[#313746] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleFill}
              disabled={clientItems.length === 0 && coachItems.length === 0}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors",
                clientItems.length === 0 && coachItems.length === 0
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-brand-accent text-white hover:opacity-90"
              )}
            >
              <Wand2 className="w-4 h-4" />
              Create Tasks
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-brand-accent" />
              Fill Week from Summary
            </DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-brand-accent" />
            Fill Week from Summary
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-y-auto">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
