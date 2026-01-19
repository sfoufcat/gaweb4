'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
} from 'lucide-react';
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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-accent" />
            Call Summary
          </DialogTitle>
          {summary && (
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
          )}
        </DialogHeader>

        {!summary ? (
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
                <ul className="space-y-2">
                  {summary.summary.keyDiscussionPoints.map((point, index) => (
                    <li
                      key={index}
                      className="text-sm text-muted-foreground flex gap-2"
                    >
                      <span className="text-brand-accent mt-1">•</span>
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
                <ul className="space-y-2">
                  {summary.summary.breakthroughs.map((breakthrough, index) => (
                    <li
                      key={index}
                      className="text-sm text-green-700 dark:text-green-400 flex gap-2"
                    >
                      <span className="text-green-500 mt-1">•</span>
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
                <ul className="space-y-2">
                  {summary.summary.challenges.map((challenge, index) => (
                    <li
                      key={index}
                      className="text-sm text-muted-foreground flex gap-2"
                    >
                      <span className="text-amber-500 mt-1">•</span>
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
                      className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/50"
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
                <ul className="space-y-2">
                  {summary.followUpQuestions.map((question, index) => (
                    <li
                      key={index}
                      className="text-sm text-muted-foreground flex gap-2"
                    >
                      <span className="text-purple-500 mt-1">{index + 1}.</span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
