'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, MessageSquare, ListTodo, Plus, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import type { CallSummary, ProgramTaskTemplate } from '@/types';

interface CallSummaryViewModalProps {
  summary: CallSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onFetchTasks?: (tasks: ProgramTaskTemplate[]) => void;
  onSummaryUpdated?: (summary: CallSummary) => void; // Callback when summary is regenerated
  entityName?: string; // Client or cohort name
}

// Timeout threshold in minutes - summaries stuck longer than this can be regenerated
const STUCK_TIMEOUT_MINUTES = 5;

/**
 * CallSummaryViewModal
 *
 * Displays a call summary in a dialog (desktop) or drawer (mobile).
 * Includes a "Fetch Tasks" button to extract action items as tasks.
 */
export function CallSummaryViewModal({
  summary,
  isOpen,
  onClose,
  onFetchTasks,
  onSummaryUpdated,
  entityName,
}: CallSummaryViewModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [fetchingTasks, setFetchingTasks] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate if summary is stuck in processing
  const getAgeMinutes = useCallback((createdAt: unknown): number => {
    if (!createdAt) return 0;
    let createdTime: number;
    if (typeof createdAt === 'object' && createdAt !== null && 'seconds' in createdAt) {
      createdTime = (createdAt as { seconds: number }).seconds * 1000;
    } else if (typeof createdAt === 'string') {
      createdTime = new Date(createdAt).getTime();
    } else {
      return 0;
    }
    return (Date.now() - createdTime) / (1000 * 60);
  }, []);

  const isStuck = summary?.status === 'processing' && getAgeMinutes(summary.createdAt) > STUCK_TIMEOUT_MINUTES;
  const canRegenerate = summary?.status === 'failed' || isStuck;

  // Handle regenerate
  const handleRegenerate = async () => {
    if (!summary?.id || regenerating) return;

    setRegenerating(true);
    setRegenerateError(null);

    try {
      const response = await fetch(`/api/coach/call-summaries/${summary.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate summary');
      }

      if (data.summary && onSummaryUpdated) {
        onSummaryUpdated(data.summary);
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
      setRegenerateError(error instanceof Error ? error.message : 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  const handleFetchTasks = async () => {
    if (!summary || !onFetchTasks) return;

    setFetchingTasks(true);
    try {
      // Extract action items from summary and convert to tasks
      const tasks: ProgramTaskTemplate[] = [];

      // Get action items assigned to client (max 3)
      const clientActionItems = summary.actionItems?.filter(
        item => item.assignedTo === 'client' || item.assignedTo === 'both'
      ).slice(0, 3) || [];

      for (const item of clientActionItems) {
        tasks.push({
          id: crypto.randomUUID(),
          label: item.description,
          isPrimary: item.priority === 'high',
          type: 'task',
        });
      }

      // If no action items, try to extract from key discussion points
      if (tasks.length === 0 && summary.summary?.keyDiscussionPoints?.length) {
        // Take up to 2 key points as potential tasks
        const points = summary.summary.keyDiscussionPoints.slice(0, 2);
        for (const point of points) {
          // Only use points that sound actionable (contain action verbs)
          const actionVerbs = ['work on', 'focus', 'practice', 'complete', 'finish', 'start', 'continue', 'develop', 'improve', 'implement', 'create', 'build'];
          const isActionable = actionVerbs.some(verb => point.toLowerCase().includes(verb));
          if (isActionable) {
            tasks.push({
              id: crypto.randomUUID(),
              label: point.length > 80 ? point.slice(0, 77) + '...' : point,
              isPrimary: false,
              type: 'task',
            });
          }
        }
      }

      onFetchTasks(tasks);
      onClose();
    } catch (error) {
      console.error('Error fetching tasks from summary:', error);
    } finally {
      setFetchingTasks(false);
    }
  };

  // Handle both ISO string and Firestore Timestamp objects
  const formatDate = (dateValue: string | { seconds: number; nanoseconds: number } | Date | null | undefined): string => {
    if (!dateValue) return '';

    let date: Date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'object' && 'seconds' in dateValue) {
      // Firestore Timestamp
      date = new Date(dateValue.seconds * 1000);
    } else {
      return '';
    }

    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdAtValue = summary?.createdAt as any;
  const formattedDate = formatDate(createdAtValue);

  const summaryTitle = entityName
    ? `${entityName}${formattedDate ? ` - ${formattedDate}` : ''}`
    : formattedDate
    ? `Summary from ${formattedDate}`
    : 'Call Summary';

  const showFetchButton = onFetchTasks && summary?.status === 'completed' && summary.actionItems?.length > 0;

  // Render the summary content (inline, not as a separate component)
  const renderSummaryContent = () => (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      {summary?.status === 'completed' && summary.summary ? (
        <>
          {/* Executive Summary */}
          {summary.summary.executive && (
            <div>
              <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Summary
              </h4>
              <p className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2] leading-relaxed">
                {summary.summary.executive}
              </p>
            </div>
          )}

          {/* Key Discussion Points */}
          {summary.summary.keyDiscussionPoints?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Key Discussion Points
              </h4>
              <ul className="space-y-1.5">
                {summary.summary.keyDiscussionPoints.map((point, index) => (
                  <li
                    key={index}
                    className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2] flex gap-2"
                  >
                    <span className="text-[#8c8c8c] dark:text-[#7d8190]">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Client Progress */}
          {summary.summary.clientProgress && (
            <div>
              <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Client Progress
              </h4>
              <p className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2]">
                {summary.summary.clientProgress}
              </p>
            </div>
          )}

          {/* Challenges */}
          {summary.summary.challenges && summary.summary.challenges.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Challenges
              </h4>
              <ul className="space-y-1">
                {summary.summary.challenges.map((challenge, index) => (
                  <li
                    key={index}
                    className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2] flex gap-2"
                  >
                    <span className="text-[#8c8c8c] dark:text-[#7d8190]">•</span>
                    <span>{challenge}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Breakthroughs */}
          {summary.summary.breakthroughs && summary.summary.breakthroughs.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Breakthroughs
              </h4>
              <ul className="space-y-1">
                {summary.summary.breakthroughs.map((breakthrough, index) => (
                  <li
                    key={index}
                    className="text-sm text-green-600 dark:text-green-400 flex gap-2"
                  >
                    <span className="text-green-500/50">•</span>
                    <span>{breakthrough}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {summary.actionItems?.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                <ListTodo className="h-4 w-4" />
                Action Items ({summary.actionItems.length})
              </h4>
              <ul className="space-y-2">
                {summary.actionItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Badge
                      variant={
                        item.priority === 'high'
                          ? 'destructive'
                          : item.priority === 'medium'
                          ? 'default'
                          : 'secondary'
                      }
                      className="text-xs shrink-0"
                    >
                      {item.priority}
                    </Badge>
                    <span className="flex-1 text-[#5c5c5c] dark:text-[#b2b6c2]">
                      {item.description}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {item.assignedTo}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Coaching Notes */}
          {summary.summary.coachingNotes && (
            <div className="p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg">
              <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                Coaching Notes
              </h4>
              <p className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2]">
                {summary.summary.coachingNotes}
              </p>
            </div>
          )}

          {/* Follow-up Questions */}
          {summary.followUpQuestions && summary.followUpQuestions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Follow-up Questions
              </h4>
              <ul className="space-y-1">
                {summary.followUpQuestions.map((question, index) => (
                  <li
                    key={index}
                    className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2]"
                  >
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : summary?.status === 'processing' ? (
        <div className="flex flex-col items-center gap-3 text-sm text-[#8c8c8c] dark:text-[#7d8190] py-4">
          {isStuck ? (
            <>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">Summary generation appears to be stuck</span>
              <span className="text-xs text-center">
                The summary has been processing for over {STUCK_TIMEOUT_MINUTES} minutes.
                You can try regenerating it.
              </span>
              <Button
                onClick={handleRegenerate}
                disabled={regenerating}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                {regenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Regenerate Summary
              </Button>
              {regenerateError && (
                <p className="text-xs text-red-500 mt-1">{regenerateError}</p>
              )}
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Summary is being generated...</span>
              <span className="text-xs">This usually takes 30-60 seconds. Please check back shortly.</span>
            </>
          )}
        </div>
      ) : summary?.status === 'failed' ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg w-full">
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {summary.processingError || 'Failed to generate summary'}
            </p>
          </div>
          <Button
            onClick={handleRegenerate}
            disabled={regenerating}
            variant="outline"
            size="sm"
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Try Again
          </Button>
          {regenerateError && (
            <p className="text-xs text-red-500">{regenerateError}</p>
          )}
        </div>
      ) : null}

      {/* Fetch Tasks Button - shown in content for mobile drawer */}
      {isMobile && showFetchButton && (
        <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <Button
            onClick={handleFetchTasks}
            disabled={fetchingTasks}
            className="w-full"
          >
            {fetchingTasks ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add Tasks to Week
          </Button>
        </div>
      )}
    </div>
  );

  // Mobile: use Drawer (slide up)
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-brand-accent" />
                {summaryTitle}
              </DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
            <DrawerDescription className="sr-only">
              View call summary details and action items
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 overflow-y-auto">
            {renderSummaryContent()}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: use Dialog
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-brand-accent" />
            {summaryTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View call summary details and action items
          </DialogDescription>
        </DialogHeader>
        {renderSummaryContent()}
        {/* Fetch Tasks Button - shown in footer for desktop dialog */}
        {showFetchButton && (
          <div className="flex justify-end pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <Button
              onClick={handleFetchTasks}
              disabled={fetchingTasks}
            >
              {fetchingTasks ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Tasks to Week
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
