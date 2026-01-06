'use client';

/**
 * WeekFillModal
 *
 * Modal for filling a program week using AI from various sources:
 * - Call Summary: Select from existing call summaries
 * - PDF: Paste extracted PDF text
 * - Prompt: Custom instructions for generating content
 */

import React, { useState, useEffect, Fragment, useCallback } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  MessageSquare,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Target,
  StickyNote,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  ProgramWeek,
  ProgramTaskTemplate,
  CallSummary,
  WeekFillSource,
} from '@/types';

interface WeekFillResult {
  tasks: Array<{
    label: string;
    type: 'task' | 'reflection' | 'habit';
    isPrimary: boolean;
    estimatedMinutes?: number;
    notes?: string;
    tag?: string;
  }>;
  currentFocus: string[];
  notes?: string[];
  weekTheme?: string;
  weekDescription?: string;
}

interface WeekFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  week: ProgramWeek;
  onApply: (updates: Partial<ProgramWeek>) => Promise<void>;
  // Client context for 1:1 programs - when provided, filters call summaries by client
  enrollmentId?: string;
  clientUserId?: string;
}

type FillSourceType = 'call_summary' | 'pdf' | 'prompt';

export function WeekFillModal({
  isOpen,
  onClose,
  programId,
  week,
  onApply,
  enrollmentId,
  clientUserId,
}: WeekFillModalProps) {
  // Source selection
  const [sourceType, setSourceType] = useState<FillSourceType>('call_summary');
  const [selectedSummaryId, setSelectedSummaryId] = useState<string>('');
  const [promptText, setPromptText] = useState('');
  const [pdfText, setPdfText] = useState('');

  // Available summaries
  const [summaries, setSummaries] = useState<CallSummary[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [result, setResult] = useState<WeekFillResult | null>(null);

  // Apply state
  const [isApplying, setIsApplying] = useState(false);

  // Fetch call summaries for this program (filtered by enrollment if in client mode)
  const fetchSummaries = useCallback(async () => {
    setLoadingSummaries(true);
    try {
      const params = new URLSearchParams({
        programId,
        status: 'completed',
        limit: '20',
      });
      // Filter by enrollment when in client mode for 1:1 programs
      if (enrollmentId) {
        params.set('programEnrollmentId', enrollmentId);
      }
      const res = await fetch(`/api/coach/call-summaries?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSummaries(data.summaries || []);
      }
    } catch (error) {
      console.error('Failed to fetch call summaries:', error);
    } finally {
      setLoadingSummaries(false);
    }
  }, [programId, enrollmentId]);

  // Load summaries when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSummaries();
      // Reset state
      setResult(null);
      setGenerationError(null);
      setPromptText('');
      setPdfText('');
      setSelectedSummaryId('');
    }
  }, [isOpen, fetchSummaries]);

  // Check if can generate
  const canGenerate = () => {
    if (sourceType === 'call_summary') {
      return !!selectedSummaryId;
    }
    if (sourceType === 'prompt') {
      return promptText.trim().length >= 50;
    }
    if (sourceType === 'pdf') {
      return pdfText.trim().length >= 50;
    }
    return false;
  };

  // Generate content
  const handleGenerate = async () => {
    if (!canGenerate()) return;

    setIsGenerating(true);
    setGenerationError(null);
    setResult(null);

    try {
      const source: {
        type: FillSourceType;
        summaryId?: string;
        prompt?: string;
        pdfText?: string;
      } = { type: sourceType };

      if (sourceType === 'call_summary') {
        source.summaryId = selectedSummaryId;
      } else if (sourceType === 'prompt') {
        source.prompt = promptText;
      } else if (sourceType === 'pdf') {
        source.pdfText = pdfText;
      }

      const res = await fetch('/api/ai/fill-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId,
          weekId: week.id,
          source,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate content');
      }

      setResult(data.result);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply result to week
  const handleApply = async () => {
    if (!result) return;

    setIsApplying(true);
    try {
      // Convert result to ProgramWeek updates
      const tasks: ProgramTaskTemplate[] = result.tasks.map((t) => ({
        label: t.label,
        type: t.type === 'reflection' ? 'task' : t.type, // Map reflection to task for ProgramTaskTemplate
        isPrimary: t.isPrimary,
        estimatedMinutes: t.estimatedMinutes,
        notes: t.notes,
        tag: t.tag,
      }));

      const fillSource: WeekFillSource = {
        type: sourceType === 'call_summary' ? 'call_summary' : sourceType === 'pdf' ? 'pdf' : 'ai_prompt',
        sourceId: sourceType === 'call_summary' ? selectedSummaryId : undefined,
        sourceName: getSourceName(),
        generatedAt: new Date().toISOString(),
      };

      const updates: Partial<ProgramWeek> = {
        weeklyTasks: tasks,
        currentFocus: result.currentFocus,
        notes: result.notes,
        theme: result.weekTheme || week.theme,
        description: result.weekDescription || week.description,
        fillSource,
      };

      await onApply(updates);
      onClose();
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to apply content');
    } finally {
      setIsApplying(false);
    }
  };

  // Get source name for tracking
  const getSourceName = (): string => {
    if (sourceType === 'call_summary') {
      const summary = summaries.find((s) => s.id === selectedSummaryId);
      if (summary) {
        const date = new Date(summary.callStartedAt).toLocaleDateString();
        return `Call - ${date}`;
      }
      return 'Call Summary';
    }
    if (sourceType === 'pdf') {
      return 'PDF Extract';
    }
    return 'Custom Prompt';
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] shadow-2xl transition-all">
                {/* Header */}
                <div className="relative px-6 pt-6 pb-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-brand-accent" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Fill Week {week.weekNumber} with AI
                      </Dialog.Title>
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        Generate tasks, focus areas, and notes from a source
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[calc(100vh-300px)] overflow-y-auto">
                  <AnimatePresence mode="wait">
                    {!result ? (
                      <motion.div
                        key="source-selection"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        {/* Source Tabs */}
                        <Tab.Group
                          selectedIndex={
                            sourceType === 'call_summary'
                              ? 0
                              : sourceType === 'prompt'
                              ? 1
                              : 2
                          }
                          onChange={(index) =>
                            setSourceType(
                              index === 0
                                ? 'call_summary'
                                : index === 1
                                ? 'prompt'
                                : 'pdf'
                            )
                          }
                        >
                          <Tab.List className="flex gap-1 p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl">
                            <Tab
                              className={({ selected }) =>
                                `flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                  selected
                                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                                    : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                                }`
                              }
                            >
                              <MessageSquare className="w-4 h-4" />
                              Call Summary
                            </Tab>
                            <Tab
                              className={({ selected }) =>
                                `flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                  selected
                                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                                    : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                                }`
                              }
                            >
                              <Sparkles className="w-4 h-4" />
                              Prompt
                            </Tab>
                            <Tab
                              className={({ selected }) =>
                                `flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                  selected
                                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                                    : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                                }`
                              }
                            >
                              <FileText className="w-4 h-4" />
                              PDF Text
                            </Tab>
                          </Tab.List>

                          <Tab.Panels className="mt-4">
                            {/* Call Summary Panel */}
                            <Tab.Panel className="space-y-4">
                              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                Select a call summary to extract tasks and focus
                                areas from your coaching conversation.
                              </p>

                              {loadingSummaries ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
                                </div>
                              ) : summaries.length === 0 ? (
                                <div className="text-center py-8 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
                                  <MessageSquare className="w-8 h-8 mx-auto text-[#a7a39e] dark:text-[#7d8190] mb-2" />
                                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                    No call summaries found for this program
                                  </p>
                                  <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1">
                                    Record a call to generate summaries
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {summaries.map((summary) => (
                                    <button
                                      key={summary.id}
                                      onClick={() =>
                                        setSelectedSummaryId(summary.id)
                                      }
                                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                                        selectedSummaryId === summary.id
                                          ? 'border-brand-accent bg-brand-accent/5'
                                          : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d4cfc9] dark:hover:border-[#3a4150]'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                                            {formatDate(summary.callStartedAt)}
                                          </p>
                                          {summary.summary?.executive && (
                                            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5 line-clamp-1">
                                              {summary.summary.executive}
                                            </p>
                                          )}
                                        </div>
                                        {selectedSummaryId === summary.id && (
                                          <CheckCircle2 className="w-5 h-5 text-brand-accent" />
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </Tab.Panel>

                            {/* Prompt Panel */}
                            <Tab.Panel className="space-y-4">
                              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                Describe what you want for this week. Include
                                goals, themes, and specific areas to focus on.
                              </p>
                              <textarea
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                placeholder="E.g., This week the client should focus on setting up their morning routine. They mentioned wanting to wake up at 6am and exercise before work. Key challenges include managing energy levels and building consistency..."
                                rows={6}
                                className="w-full px-4 py-3 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm resize-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
                              />
                              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                                Minimum 50 characters required.{' '}
                                {promptText.length}/50
                              </p>
                            </Tab.Panel>

                            {/* PDF Panel */}
                            <Tab.Panel className="space-y-4">
                              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                Paste the extracted text from a PDF document
                                (intake form, notes, etc.)
                              </p>
                              <textarea
                                value={pdfText}
                                onChange={(e) => setPdfText(e.target.value)}
                                placeholder="Paste the extracted PDF text here..."
                                rows={6}
                                className="w-full px-4 py-3 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm resize-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
                              />
                              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                                Minimum 50 characters required. {pdfText.length}
                                /50
                              </p>
                            </Tab.Panel>
                          </Tab.Panels>
                        </Tab.Group>

                        {/* Error */}
                        {generationError && (
                          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">{generationError}</span>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="result-preview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        {/* Result Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                              Content Generated
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResult(null)}
                            className="text-[#5f5a55] hover:text-[#1a1a1a]"
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Regenerate
                          </Button>
                        </div>

                        {/* Theme & Description */}
                        {(result.weekTheme || result.weekDescription) && (
                          <div className="p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl space-y-2">
                            {result.weekTheme && (
                              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                                Theme: {result.weekTheme}
                              </p>
                            )}
                            {result.weekDescription && (
                              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                {result.weekDescription}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Tasks */}
                        <div>
                          <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Tasks ({result.tasks.length})
                          </h4>
                          <div className="space-y-2">
                            {result.tasks.map((task, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg"
                              >
                                <div
                                  className={`mt-0.5 w-2 h-2 rounded-full ${
                                    task.isPrimary
                                      ? 'bg-brand-accent'
                                      : 'bg-[#d4cfc9] dark:bg-[#4a5261]'
                                  }`}
                                />
                                <div className="flex-1">
                                  <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                                    {task.label}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs px-2 py-0.5 bg-[#e8e4df] dark:bg-[#262b35] rounded text-[#5f5a55] dark:text-[#b2b6c2]">
                                      {task.type}
                                    </span>
                                    {task.isPrimary && (
                                      <span className="text-xs px-2 py-0.5 bg-brand-accent/10 text-brand-accent rounded">
                                        Primary
                                      </span>
                                    )}
                                    {task.estimatedMinutes && (
                                      <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                                        {task.estimatedMinutes}min
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Current Focus */}
                        <div>
                          <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Current Focus ({result.currentFocus.length})
                          </h4>
                          <div className="space-y-2">
                            {result.currentFocus.map((focus, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg"
                              >
                                <ChevronRight className="w-4 h-4 text-brand-accent" />
                                <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                                  {focus}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Notes */}
                        {result.notes && result.notes.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 flex items-center gap-2">
                              <StickyNote className="w-4 h-4" />
                              Notes ({result.notes.length})
                            </h4>
                            <div className="space-y-2">
                              {result.notes.map((note, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg"
                                >
                                  <span className="w-2 h-2 rounded-full bg-[#a7a39e]" />
                                  <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                    {note}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Apply Error */}
                        {generationError && (
                          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">{generationError}</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-end gap-3">
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>

                  {!result ? (
                    <Button
                      onClick={handleGenerate}
                      disabled={!canGenerate() || isGenerating}
                      className="flex items-center gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate Content
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleApply}
                      disabled={isApplying}
                      className="flex items-center gap-2"
                    >
                      {isApplying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Apply to Week
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
