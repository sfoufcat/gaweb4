'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, MessageSquare, ListTodo, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DrawerClose,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CallSummary, ProgramTaskTemplate } from '@/types';

interface CallSummaryViewModalProps {
  summary: CallSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onFetchTasks?: (tasks: ProgramTaskTemplate[]) => void;
  entityName?: string; // Client or cohort name
}

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
  entityName,
}: CallSummaryViewModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [fetchingTasks, setFetchingTasks] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const SummaryContent = () => (
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
        <div className="flex items-center gap-2 text-sm text-[#8c8c8c] dark:text-[#7d8190] py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating summary...</span>
        </div>
      ) : summary?.status === 'failed' ? (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            {summary.processingError || 'Failed to generate summary'}
          </p>
        </div>
      ) : null}

      {/* Fetch Tasks Button - shown in content for mobile drawer */}
      {isMobile && onFetchTasks && summary?.status === 'completed' && summary.actionItems?.length > 0 && (
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

  const summaryTitle = entityName
    ? `${entityName} - ${summary?.createdAt ? formatDate(summary.createdAt) : 'Summary'}`
    : summary?.createdAt
    ? `Summary from ${formatDate(summary.createdAt)}`
    : 'Call Summary';

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
          </DrawerHeader>
          <div className="p-4 overflow-y-auto">
            <SummaryContent />
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
        </DialogHeader>
        <SummaryContent />
        {/* Fetch Tasks Button - shown in footer for desktop dialog */}
        {onFetchTasks && summary?.status === 'completed' && summary.actionItems?.length > 0 && (
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
