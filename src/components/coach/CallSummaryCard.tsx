'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  MessageSquare,
  ListTodo,
  User,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CallSummary } from '@/types';

interface CallSummaryCardProps {
  summary: CallSummary;
  clientName?: string;
  onMarkReviewed?: () => Promise<void>;
  onPlayRecording?: () => void;
  compact?: boolean;
}

/**
 * CallSummaryCard
 *
 * Displays an AI-generated call summary with key points and action items.
 * Used in coach dashboard and client detail views.
 */
export function CallSummaryCard({
  summary,
  clientName,
  onMarkReviewed,
  onPlayRecording,
  compact = false,
}: CallSummaryCardProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [markingReviewed, setMarkingReviewed] = useState(false);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleMarkReviewed = async () => {
    if (!onMarkReviewed) return;
    setMarkingReviewed(true);
    try {
      await onMarkReviewed();
    } finally {
      setMarkingReviewed(false);
    }
  };

  const statusIcon = {
    processing: <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <AlertCircle className="h-4 w-4 text-red-500" />,
  };

  const statusLabel = {
    processing: 'Processing',
    completed: 'Ready',
    failed: 'Failed',
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {clientName && (
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{clientName}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(summary.callStartedAt)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(summary.callDurationSeconds)}</span>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="gap-1">
              {statusIcon[summary.status]}
              {statusLabel[summary.status]}
            </Badge>
            {summary.reviewedByCoach && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Reviewed
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {summary.recordingUrl && onPlayRecording && (
            <Button variant="outline" size="sm" onClick={onPlayRecording}>
              <Play className="h-4 w-4 mr-1" />
              Play
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Executive Summary (always visible when completed) */}
      {summary.status === 'completed' && summary.summary.executive && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
          {summary.summary.executive}
        </p>
      )}

      {/* Expanded Content */}
      {expanded && summary.status === 'completed' && (
        <div className="mt-4 space-y-4">
          {/* Key Discussion Points */}
          {summary.summary.keyDiscussionPoints?.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-medium mb-2">
                <MessageSquare className="h-4 w-4" />
                Key Discussion Points
              </h4>
              <ul className="space-y-1.5">
                {summary.summary.keyDiscussionPoints.map((point, index) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground flex gap-2"
                  >
                    <span className="text-muted-foreground/50">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Client Progress */}
          {summary.summary.clientProgress && (
            <div>
              <h4 className="text-sm font-medium mb-1">Client Progress</h4>
              <p className="text-sm text-muted-foreground">
                {summary.summary.clientProgress}
              </p>
            </div>
          )}

          {/* Challenges */}
          {summary.summary.challenges && summary.summary.challenges.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Challenges</h4>
              <ul className="space-y-1">
                {summary.summary.challenges.map((challenge, index) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground flex gap-2"
                  >
                    <span className="text-muted-foreground/50">•</span>
                    <span>{challenge}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Breakthroughs */}
          {summary.summary.breakthroughs && summary.summary.breakthroughs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Breakthroughs</h4>
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
              <h4 className="flex items-center gap-1.5 text-sm font-medium mb-2">
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
                    <span className="flex-1">{item.description}</span>
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
            <div className="p-3 bg-muted/50 rounded-md">
              <h4 className="text-sm font-medium mb-1">Coaching Notes</h4>
              <p className="text-sm text-muted-foreground">
                {summary.summary.coachingNotes}
              </p>
            </div>
          )}

          {/* Follow-up Questions */}
          {summary.followUpQuestions && summary.followUpQuestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Follow-up Questions</h4>
              <ul className="space-y-1">
                {summary.followUpQuestions.map((question, index) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground"
                  >
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mark Reviewed Button */}
          {!summary.reviewedByCoach && onMarkReviewed && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkReviewed}
                disabled={markingReviewed}
              >
                {markingReviewed ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                Mark as Reviewed
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Processing state */}
      {summary.status === 'processing' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating summary...</span>
        </div>
      )}

      {/* Failed state */}
      {summary.status === 'failed' && (
        <div className="mt-4 p-3 bg-destructive/10 rounded-md">
          <p className="text-sm text-destructive">
            {summary.processingError || 'Failed to generate summary'}
          </p>
        </div>
      )}
    </div>
  );
}
