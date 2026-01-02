'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  User,
  ChevronRight,
  ChevronDown,
  Calendar,
  MessageSquare,
  Target,
  CheckCircle,
  X,
  ExternalLink
} from 'lucide-react';
import Image from 'next/image';
import type { OnboardingResponse, OnboardingStepType } from '@/types';

interface OnboardingResponsesViewProps {
  flowId: string;
}

interface ResponseWithUser extends OnboardingResponse {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    imageUrl?: string;
  };
}

const STEP_TYPE_ICONS: Record<OnboardingStepType, React.ElementType> = {
  question: MessageSquare,
  goal_setting: Target,
  identity: User,
  explainer: MessageSquare,
  success: CheckCircle,
};

export function OnboardingResponsesView({ flowId }: OnboardingResponsesViewProps) {
  const [responses, setResponses] = useState<ResponseWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<ResponseWithUser | null>(null);

  const fetchResponses = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/coach/org-onboarding-flow/responses?flowId=${flowId}`);
      if (!response.ok) throw new Error('Failed to fetch responses');
      const data = await response.json();
      setResponses(data.responses || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load responses');
    } finally {
      setIsLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatAnswer = (answer: unknown): string => {
    if (typeof answer === 'string') return answer;
    if (Array.isArray(answer)) return answer.join(', ');
    if (typeof answer === 'object' && answer !== null) {
      return JSON.stringify(answer, null, 2);
    }
    return String(answer);
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-8">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
          <span className="text-text-secondary dark:text-[#b2b6c2]">Loading responses...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f5f3f0] dark:bg-[#262b35] flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-text-muted dark:text-[#666d7c]" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8] mb-2">
          No Responses Yet
        </h3>
        <p className="text-text-secondary dark:text-[#b2b6c2] max-w-md mx-auto">
          When users complete your onboarding flow, their responses will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <p className="text-2xl font-bold text-text-primary dark:text-[#f5f5f8]">
            {responses.length}
          </p>
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">Total Responses</p>
        </div>
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {responses.filter(r => r.status === 'completed').length}
          </p>
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">Completed</p>
        </div>
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {responses.filter(r => r.status === 'in_progress').length}
          </p>
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">In Progress</p>
        </div>
      </div>

      {/* Responses list */}
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h3 className="font-medium text-text-primary dark:text-[#f5f5f8]">
            User Responses
          </h3>
        </div>

        <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
          {responses.map((response) => (
            <div key={response.id}>
              {/* Response row */}
              <button
                onClick={() => setExpandedResponseId(
                  expandedResponseId === response.id ? null : response.id
                )}
                className="w-full flex items-center gap-4 p-4 hover:bg-[#faf8f6] dark:hover:bg-[#1a1f27] transition-colors text-left"
              >
                {/* User avatar */}
                <div className="w-10 h-10 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {response.user?.imageUrl ? (
                    <Image
                      src={response.user.imageUrl}
                      alt={`${response.user.firstName} ${response.user.lastName}`}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-text-muted dark:text-[#666d7c]" />
                  )}
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary dark:text-[#f5f5f8] truncate">
                    {response.user 
                      ? `${response.user.firstName} ${response.user.lastName}`.trim() || response.user.email
                      : 'Unknown User'
                    }
                  </p>
                  <div className="flex items-center gap-2 text-xs text-text-secondary dark:text-[#b2b6c2]">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(response.startedAt)}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      response.status === 'completed'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : response.status === 'in_progress'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {response.status === 'completed' ? 'Completed' : 
                       response.status === 'in_progress' ? 'In Progress' : 'Abandoned'}
                    </span>
                  </div>
                </div>

                {/* Expand/collapse */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted dark:text-[#666d7c]">
                    {Object.keys(response.answers).length} answers
                  </span>
                  {expandedResponseId === response.id ? (
                    <ChevronDown className="w-5 h-5 text-text-secondary" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-text-secondary" />
                  )}
                </div>
              </button>

              {/* Expanded answers */}
              <AnimatePresence>
                {expandedResponseId === response.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pl-[4.5rem] space-y-3">
                      {Object.entries(response.answers).map(([stepId, answerData]) => {
                        const Icon = STEP_TYPE_ICONS[answerData.stepType] || MessageSquare;
                        return (
                          <div
                            key={stepId}
                            className="bg-[#faf8f6] dark:bg-[#11141b] rounded-lg p-3"
                          >
                            <div className="flex items-start gap-2">
                              <Icon className="w-4 h-4 text-text-muted dark:text-[#666d7c] mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-text-secondary dark:text-[#b2b6c2] mb-1">
                                  {answerData.question || answerData.stepType}
                                </p>
                                <p className="text-sm text-text-primary dark:text-[#f5f5f8] whitespace-pre-wrap">
                                  {formatAnswer(answerData.answer)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* View user profile link */}
                      {response.user && (
                        <a
                          href={`/coach?tab=clients&userId=${response.userId}`}
                          className="inline-flex items-center gap-1 text-sm text-brand-accent hover:underline"
                        >
                          View user profile
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



