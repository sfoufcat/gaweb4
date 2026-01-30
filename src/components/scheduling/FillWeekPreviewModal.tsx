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
import {
  Wand2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  StickyNote,
  Target,
} from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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
  const [result, setResult] = useState<{ daysUpdated: number; weeksUpdated: number; notesApplied?: boolean; weeksWithNotes?: number[] }>();
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
      setHasNextCall(null); // Reset to loading state
      setSelectedTarget('current'); // Default to current week while loading
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
          // If there's a next call, select "until next call" as the default
          if (data.hasNextCall) {
            setSelectedTarget('until_call');
          }
        }
      } catch {
        setHasNextCall(false);
      }
    }
    checkNextCall();
  }, [isOpen, eventId]);

  const fillOptions = useMemo(() => {
    // Don't show "until next call" if loading (null) or if no next call (false)
    if (hasNextCall !== true) {
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
        setResult({
          daysUpdated: data.daysUpdated || 0,
          weeksUpdated: data.weeksUpdated || 0,
          notesApplied: data.notesApplied,
          weeksWithNotes: data.weeksWithNotes,
        });
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

  // Priority badge variant
  const getPriorityVariant = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const ActionItemCard = ({ item }: { item: CallSummaryActionItem }) => (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-[#f5f3f0] dark:bg-[#1e222a] border border-[#e5e1dc] dark:border-[#2a2f3a]">
      <Badge variant={getPriorityVariant(item.priority)} className="shrink-0 text-xs font-albert">
        {item.priority}
      </Badge>
      <span className="flex-1 text-sm text-[#3a3a3a] dark:text-[#e0e0e5] font-albert">
        {item.description}
      </span>
    </div>
  );

  const content = (
    <div className="space-y-4">
      {/* Success State */}
      {state === 'success' && result && (
        <div className="p-6 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/20 backdrop-blur-sm border border-emerald-200/60 dark:border-emerald-800/60">
          <div className="flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <div>
              <p className="text-lg font-semibold font-albert text-emerald-700 dark:text-emerald-300">
                Tasks Created!
              </p>
              <p className="text-sm font-albert text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                {result.daysUpdated} day{result.daysUpdated !== 1 ? 's' : ''} updated
                {result.weeksUpdated > 1 ? ` across ${result.weeksUpdated} weeks` : ''}
                {result.notesApplied && result.weeksWithNotes?.length
                  ? ` • Notes added to week${result.weeksWithNotes.length > 1 ? 's' : ''} ${result.weeksWithNotes.join(' & ')}`
                  : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold font-albert transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div className="p-4 rounded-xl bg-red-50/70 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/60 dark:border-red-800/60">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold font-albert text-red-700 dark:text-red-300">
                Failed to create tasks
              </p>
              <p className="text-sm font-albert text-red-600/80 dark:text-red-400/80 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => setState('preview')}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold font-albert text-red-600 dark:text-red-400 bg-white dark:bg-red-900/30 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading State */}
      {state === 'loading' && (
        <div className="py-12 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
          <div className="text-center">
            <p className="text-base font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
              Creating tasks...
            </p>
            <p className="text-sm font-albert text-[#8a857f] dark:text-[#9a969f] mt-1">
              Converting action items to program tasks
            </p>
          </div>
        </div>
      )}

      {/* Preview State */}
      {state === 'preview' && (
        <div className="max-h-[520px] overflow-y-auto space-y-3">
            {/* Client Tasks */}
            {clientItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  Client Tasks ({clientItems.length})
                </h4>
                <div className="space-y-1.5">
                  {clientItems.map((item) => (
                    <ActionItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Coach Tasks */}
            {coachItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500" />
                  Coach Tasks ({coachItems.length})
                </h4>
                <div className="space-y-1.5">
                  {coachItems.map((item) => (
                    <ActionItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* No items */}
            {clientItems.length === 0 && coachItems.length === 0 && !summary?.weekContent && (
              <div className="py-6 text-center">
                <Wand2 className="w-6 h-6 mx-auto mb-2 text-[#c0bbb5] dark:text-[#4a4f5a]" />
                <p className="text-sm font-albert text-[#8c8c8c] dark:text-[#7d8190]">
                  No action items found in this summary
                </p>
              </div>
            )}

          {/* Week Content Preview (Theme, Description, Notes, Goals) */}
          {summary?.weekContent && (summary.weekContent.theme || summary.weekContent.description || summary.weekContent.notes?.length || summary.weekContent.currentFocus?.length) && (
            <div className="space-y-2 p-3 rounded-xl bg-amber-50/40 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-700/30">
              {/* Weekly Theme */}
              {summary.weekContent.theme && (
                <div>
                  <h4 className="text-xs font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-0.5">
                    Weekly Theme
                  </h4>
                  <p className="text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2] italic">
                    {summary.weekContent.theme}
                  </p>
                </div>
              )}

              {/* Description */}
              {summary.weekContent.description && (
                <div>
                  <h4 className="text-xs font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-0.5">
                    Description
                  </h4>
                  <p className="text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2] line-clamp-2">
                    {summary.weekContent.description}
                  </p>
                </div>
              )}

              {/* Week Notes */}
              {summary.weekContent.notes && summary.weekContent.notes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Week Notes
                  </h4>
                  <ul className="space-y-1">
                    {summary.weekContent.notes.map((note, idx) => (
                      <li key={idx} className="text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2] pl-2.5 border-l-2 border-amber-400/60 dark:border-amber-500/40">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Goals */}
              {(summary.weekContent.goals?.length || summary.weekContent.currentFocus?.length) ? (
                <div>
                  <h4 className="text-xs font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Goals
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {(summary.weekContent.goals || summary.weekContent.currentFocus || []).map((goal, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs font-medium font-albert bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md"
                      >
                        {goal}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Fill Target Selection */}
          {(clientItems.length > 0 || coachItems.length > 0 || summary?.weekContent) && (
            <div className="pt-4 border-t border-[#e8e4df] dark:border-[#2a2f3a]">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-[#8a857f] dark:text-[#9a969f]" />
                <h4 className="text-sm font-medium font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                  Add tasks to:
                </h4>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {fillOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedTarget(option.value)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                      selectedTarget === option.value
                        ? "border-brand-accent bg-brand-accent/5"
                        : "border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-semibold font-albert",
                      selectedTarget === option.value
                        ? "text-brand-accent"
                        : "text-[#5f5a55] dark:text-[#b2b6c2]"
                    )}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold font-albert text-[#5f5a55] dark:text-[#b2b6c2] bg-white dark:bg-[#1d222b] border-2 border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleFill}
              disabled={clientItems.length === 0 && coachItems.length === 0 && !summary?.weekContent}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold font-albert transition-colors",
                clientItems.length === 0 && coachItems.length === 0 && !summary?.weekContent
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-2 border-slate-200 dark:border-slate-700"
                  : "bg-brand-accent text-white hover:bg-brand-accent/90 border-2 border-brand-accent"
              )}
            >
              Create Tasks
              <Wand2 className="w-4 h-4" />
            </button>
          </div>
        </div>
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
