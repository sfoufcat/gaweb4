'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Calendar,
  Clock,
  MessageSquare,
  TrendingUp,
  Sparkles,
  AlertCircle,
  ListTodo,
  HelpCircle,
  Wand2,
} from 'lucide-react';
import { FillWeekFromSummaryButton } from '@/components/scheduling/FillWeekFromSummaryButton';
import { useMediaQuery } from '@/hooks/useMediaQuery';
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
  const isDesktop = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render the dialog portal until mounted on client
  if (!isMounted) {
    return null;
  }

  const formatDate = (dateValue: string | { seconds: number; nanoseconds: number } | null | undefined): string => {
    if (!dateValue) return '';

    let date: Date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (typeof dateValue === 'object' && 'seconds' in dateValue) {
      date = new Date(dateValue.seconds * 1000);
    } else {
      return '';
    }

    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number): string => {
    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Header content shared between Dialog and Drawer
  const headerMeta = summary && (
    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
      {summary.callStartedAt && (
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {formatDate(summary.callStartedAt as any)}
        </span>
      )}
      {summary.callDurationSeconds > 0 && (
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {formatDuration(summary.callDurationSeconds)}
        </span>
      )}
    </div>
  );

  // Summary content shared between Dialog and Drawer
  const summaryContent = !summary ? (
    <p className="text-muted-foreground">No summary available</p>
  ) : (
    <div className="space-y-5 pt-2">
            {/* Executive Summary */}
            {summary.summary?.executive && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Overview</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {summary.summary.executive}
                </p>
              </div>
            )}

            {/* Key Discussion Points */}
            {summary.summary?.keyDiscussionPoints?.length > 0 && (
              <div>
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
                  <MessageSquare className="h-4 w-4 text-brand-accent" />
                  Key Discussion Points
                </h4>
                <ul className="space-y-1.5 pl-1">
                  {summary.summary.keyDiscussionPoints.map((point, index) => (
                    <li
                      key={index}
                      className="text-sm text-muted-foreground flex items-baseline gap-2"
                    >
                      <span className="text-brand-accent text-xs leading-none">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Client Progress */}
            {summary.summary?.clientProgress && (
              <div>
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Client Progress
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {summary.summary.clientProgress}
                </p>
              </div>
            )}

            {/* Breakthroughs */}
            {summary.summary?.breakthroughs && summary.summary.breakthroughs.length > 0 && (
              <div>
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
                  <Sparkles className="h-4 w-4 text-green-500" />
                  Breakthroughs
                </h4>
                <ul className="space-y-1.5 pl-1">
                  {summary.summary.breakthroughs.map((breakthrough, index) => (
                    <li
                      key={index}
                      className="text-sm text-green-700 dark:text-green-400 flex items-baseline gap-2"
                    >
                      <span className="text-green-500 text-xs leading-none">•</span>
                      <span>{breakthrough}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Challenges */}
            {summary.summary?.challenges && summary.summary.challenges.length > 0 && (
              <div>
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Challenges
                </h4>
                <ul className="space-y-1.5 pl-1">
                  {summary.summary.challenges.map((challenge, index) => (
                    <li
                      key={index}
                      className="text-sm text-muted-foreground flex items-baseline gap-2"
                    >
                      <span className="text-amber-500 text-xs leading-none">•</span>
                      <span>{challenge}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items */}
            {summary.actionItems?.length > 0 && (
              <div>
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
                  <ListTodo className="h-4 w-4 text-brand-accent" />
                  Action Items ({summary.actionItems.length})
                </h4>
                <ul className="space-y-2">
                  {summary.actionItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-2.5 text-sm px-3 py-2.5 rounded-xl bg-[#f8f7f6] dark:bg-[#1a1d24] border border-[#e8e6e3] dark:border-[#2a2d35]"
                    >
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
                      <span className="flex-1 text-muted-foreground">{item.description}</span>
                      <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                        {item.assignedTo}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Coaching Notes */}
            {summary.summary?.coachingNotes && (
              <div className="p-3 bg-brand-accent/5 border border-brand-accent/20 rounded-lg">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
                  <FileText className="h-4 w-4 text-brand-accent" />
                  Coaching Notes
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {summary.summary.coachingNotes}
                </p>
              </div>
            )}

            {/* Follow-up Questions */}
            {summary.followUpQuestions && summary.followUpQuestions.length > 0 && (
              <div>
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
                  <HelpCircle className="h-4 w-4 text-purple-500" />
                  Follow-up Questions
                </h4>
                <ul className="space-y-1.5 pl-1">
                  {summary.followUpQuestions.map((question, index) => (
                    <li
                      key={index}
                      className="text-sm text-muted-foreground flex items-baseline gap-2"
                    >
                      <span className="text-purple-500 text-xs leading-none w-4 shrink-0">{index + 1}.</span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

  // Fill Week button - rendered in footer
  const fillWeekButton = summary?.eventId && (
    <FillWeekFromSummaryButton
      eventId={summary.eventId}
      summary={summary}
      className="w-full"
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-accent" />
              Call Summary
            </DialogTitle>
            {headerMeta}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {summaryContent}
          </div>
          {fillWeekButton && (
            <DialogFooter>
              {fillWeekButton}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh] flex flex-col">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-accent" />
            Call Summary
          </DrawerTitle>
          {headerMeta}
        </DrawerHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          {summaryContent}
        </div>
        {fillWeekButton && (
          <DrawerFooter>
            {fillWeekButton}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
