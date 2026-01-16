'use client';

import React, { useState, useCallback } from 'react';
import { Loader2, MessageSquare, ListTodo, Plus, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { CallSummary, ProgramTaskTemplate } from '@/types';

interface CallSummaryViewModalProps {
  summary: CallSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onFetchTasks?: (tasks: ProgramTaskTemplate[]) => void;
  onSummaryUpdated?: (summary: CallSummary) => void;
  entityName?: string;
}

const STUCK_TIMEOUT_MINUTES = 5;

export function CallSummaryViewModal({
  summary,
  isOpen,
  onClose,
  onFetchTasks,
  onSummaryUpdated,
  entityName,
}: CallSummaryViewModalProps) {
  const [fetchingTasks, setFetchingTasks] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const getAgeMinutes = (createdAt: unknown): number => {
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
  };

  const isStuck = summary?.status === 'processing' && summary?.createdAt && getAgeMinutes(summary.createdAt) > STUCK_TIMEOUT_MINUTES;

  const handleRegenerate = useCallback(async () => {
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
  }, [summary?.id, regenerating, onSummaryUpdated]);

  const handleFetchTasks = useCallback(async () => {
    if (!summary || !onFetchTasks) return;

    setFetchingTasks(true);
    try {
      const tasks: ProgramTaskTemplate[] = [];

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

      if (tasks.length === 0 && summary.summary?.keyDiscussionPoints?.length) {
        const points = summary.summary.keyDiscussionPoints.slice(0, 2);
        const actionVerbs = ['work on', 'focus', 'practice', 'complete', 'finish', 'start', 'continue', 'develop', 'improve', 'implement', 'create', 'build'];
        for (const point of points) {
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
  }, [summary, onFetchTasks, onClose]);

  const formatDate = (dateValue: unknown): string => {
    if (!dateValue) return '';

    let date: Date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'object' && dateValue !== null && 'seconds' in dateValue) {
      date = new Date((dateValue as { seconds: number }).seconds * 1000);
    } else {
      return '';
    }

    if (isNaN(date.getTime())) return '';

    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const daySuffix = (d: number) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${month} ${day}${daySuffix(day)} at ${hours}:${minutes}`;
  };

  const formattedDate = formatDate(summary?.createdAt);

  const summaryTitle = entityName
    ? `${entityName}${formattedDate ? `, ${formattedDate}` : ''}`
    : formattedDate
    ? `Summary from ${formattedDate}`
    : 'Call Summary';

  const showFetchButton = onFetchTasks && summary?.status === 'completed' && Array.isArray(summary.actionItems) && summary.actionItems.length > 0;

  const renderContent = () => {
    if (!summary) {
      return (
        <div className="flex items-center justify-center py-8 text-sm text-[#8c8c8c] dark:text-[#7d8190]">
          No summary data available
        </div>
      );
    }

    if (summary.status === 'processing') {
      return (
        <div className="flex flex-col items-center gap-3 text-sm text-[#8c8c8c] dark:text-[#7d8190] py-4">
          {isStuck ? (
            <>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">Summary generation appears to be stuck</span>
              <span className="text-xs text-center">
                The summary has been processing for over {STUCK_TIMEOUT_MINUTES} minutes.
              </span>
              <Button onClick={handleRegenerate} disabled={regenerating} variant="outline" size="sm" className="mt-2">
                {regenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Regenerate Summary
              </Button>
              {regenerateError && <p className="text-xs text-red-500 mt-1">{regenerateError}</p>}
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Summary is being generated...</span>
              <span className="text-xs">This usually takes 30-60 seconds.</span>
            </>
          )}
        </div>
      );
    }

    if (summary.status === 'failed') {
      return (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg w-full">
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {summary.processingError || 'Failed to generate summary'}
            </p>
          </div>
          <Button onClick={handleRegenerate} disabled={regenerating} variant="outline" size="sm">
            {regenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Try Again
          </Button>
          {regenerateError && <p className="text-xs text-red-500">{regenerateError}</p>}
        </div>
      );
    }

    if (summary.status !== 'completed' || !summary.summary) {
      return null;
    }

    return (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {summary.summary.executive && (
          <div>
            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Summary</h4>
            <p className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2] leading-relaxed">{summary.summary.executive}</p>
          </div>
        )}

        {summary.summary.keyDiscussionPoints && summary.summary.keyDiscussionPoints.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Key Discussion Points</h4>
            <ul className="space-y-1.5">
              {summary.summary.keyDiscussionPoints.map((point, index) => (
                <li key={index} className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2] flex gap-2">
                  <span className="text-[#8c8c8c] dark:text-[#7d8190]">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.summary.clientProgress && (
          <div>
            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Client Progress</h4>
            <p className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2]">{summary.summary.clientProgress}</p>
          </div>
        )}

        {summary.summary.challenges && summary.summary.challenges.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Challenges</h4>
            <ul className="space-y-1">
              {summary.summary.challenges.map((challenge, index) => (
                <li key={index} className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2] flex gap-2">
                  <span className="text-[#8c8c8c] dark:text-[#7d8190]">•</span>
                  <span>{challenge}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.summary.breakthroughs && summary.summary.breakthroughs.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Breakthroughs</h4>
            <ul className="space-y-1">
              {summary.summary.breakthroughs.map((breakthrough, index) => (
                <li key={index} className="text-sm text-green-600 dark:text-green-400 flex gap-2">
                  <span className="text-green-500/50">•</span>
                  <span>{breakthrough}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(summary.actionItems) && summary.actionItems.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              <ListTodo className="h-4 w-4" />
              Action Items ({summary.actionItems.length})
            </h4>
            <ul className="space-y-2">
              {summary.actionItems.map((item, index) => (
                <li key={item?.id || index} className="flex items-start gap-2 text-sm">
                  <Badge
                    variant={item?.priority === 'high' ? 'destructive' : item?.priority === 'medium' ? 'default' : 'secondary'}
                    className="text-xs shrink-0"
                  >
                    {item?.priority || 'medium'}
                  </Badge>
                  <span className="flex-1 text-[#5c5c5c] dark:text-[#b2b6c2]">{item?.description || 'No description'}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{item?.assignedTo || 'client'}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.summary.coachingNotes && (
          <div className="p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg">
            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">Coaching Notes</h4>
            <p className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2]">{summary.summary.coachingNotes}</p>
          </div>
        )}

        {Array.isArray(summary.followUpQuestions) && summary.followUpQuestions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Follow-up Questions</h4>
            <ul className="space-y-1">
              {summary.followUpQuestions.map((question, index) => (
                <li key={index} className="text-sm text-[#5c5c5c] dark:text-[#b2b6c2]">{question}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
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
        {renderContent()}
        {showFetchButton && (
          <div className="flex justify-end pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <Button onClick={handleFetchTasks} disabled={fetchingTasks}>
              {fetchingTasks ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Tasks to Week
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
