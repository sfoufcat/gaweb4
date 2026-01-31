'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, Loader2 } from 'lucide-react';
import { QuestionRenderer } from './QuestionRenderer';
import type { Questionnaire, QuestionnaireAnswer, QuestionnaireQuestion, SkipLogicRule, SkipLogicCondition } from '@/types/questionnaire';
import { normalizeSkipLogicRule } from '@/types/questionnaire';

interface QuestionnaireFormProps {
  questionnaire: Questionnaire;
  onSubmit: (answers: QuestionnaireAnswer[]) => Promise<void>;
  submitting: boolean;
}

// A page is a group of questions between page breaks
interface Page {
  id: string;
  questions: QuestionnaireQuestion[];
  isPageBreak: boolean;
}

export function QuestionnaireForm({ questionnaire, onSubmit, submitting }: QuestionnaireFormProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, QuestionnaireAnswer>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  // Sort questions by order
  const sortedQuestions = useMemo(() => {
    return [...questionnaire.questions].sort((a, b) => a.order - b.order);
  }, [questionnaire.questions]);

  // Evaluate a single condition against current answers
  const evaluateCondition = useCallback((
    condition: SkipLogicCondition,
    questionId: string
  ): boolean => {
    const targetQuestionId = condition.questionId || questionId;
    const answer = answers.get(targetQuestionId);
    if (!answer) return false;

    const answerValue = String(answer.value);

    switch (condition.conditionType) {
      case 'equals':
        return answerValue === condition.conditionValue;
      case 'not_equals':
        return answerValue !== condition.conditionValue;
      case 'contains':
        return answerValue.includes(condition.conditionValue);
      default:
        return false;
    }
  }, [answers]);

  // Evaluate a skip logic rule (handles both old and new formats)
  // For global rules, questionId can be empty string since conditions have their own questionId
  const evaluateRule = useCallback((
    rule: SkipLogicRule,
    fallbackQuestionId: string = ''
  ): boolean => {
    // Normalize rule to new format
    const normalizedRule = normalizeSkipLogicRule(rule, fallbackQuestionId);

    if (normalizedRule.conditions.length === 0) return false;

    // Apply AND/OR logic
    if (normalizedRule.operator === 'and') {
      return normalizedRule.conditions.every(c => evaluateCondition(c, fallbackQuestionId));
    } else {
      return normalizedRule.conditions.some(c => evaluateCondition(c, fallbackQuestionId));
    }
  }, [evaluateCondition]);

  // Get visible questions based on skip logic (includes page breaks and info steps)
  // Supports both new show/hide model and legacy skip-to model
  const visibleQuestions = useMemo(() => {
    const globalRules = questionnaire.skipLogicRules || [];

    // Step 1: Identify questions that are targets of "show" rules (they start hidden)
    const defaultHiddenQuestionIds = new Set<string>();
    for (const rule of globalRules) {
      if (rule.action === 'show' && rule.targetQuestionIds) {
        for (const targetId of rule.targetQuestionIds) {
          defaultHiddenQuestionIds.add(targetId);
        }
      }
    }

    // Step 2: Evaluate visibility for each question
    const visible: QuestionnaireQuestion[] = [];

    for (const question of sortedQuestions) {
      let isHidden = defaultHiddenQuestionIds.has(question.id);
      let matchedRule = false;

      // Check new show/hide rules (first matching rule wins)
      for (const rule of globalRules) {
        // Skip legacy rules (no action defined)
        if (!rule.action || !rule.targetQuestionIds) continue;

        const conditionMet = evaluateRule(rule, '');
        const isTargeted = rule.targetQuestionIds.includes(question.id);

        if (conditionMet && isTargeted) {
          if (rule.action === 'show') {
            // Show rule matched - question should be visible
            isHidden = false;
          } else if (rule.action === 'hide') {
            // Hide rule matched - question should be hidden
            isHidden = true;
          }
          matchedRule = true;
          break; // First matching rule wins
        }
      }

      // Step 3: Handle legacy skip-to rules (only if no new rules matched)
      if (!matchedRule) {
        for (const rule of globalRules) {
          // Only process legacy rules (has skipToQuestionId, no action)
          if (rule.action || !rule.skipToQuestionId) continue;

          const conditionMet = evaluateRule(rule, '');

          if (conditionMet) {
            // Skip to a specific question - skip everything in between
            const skipToQuestion = sortedQuestions.find(q => q.id === rule.skipToQuestionId);

            if (skipToQuestion) {
              // Find the latest condition question to determine "from" position
              const conditionQuestionOrders = rule.conditions
                .map(c => sortedQuestions.find(q => q.id === c.questionId)?.order ?? -1)
                .filter(o => o >= 0);
              const fromOrder = conditionQuestionOrders.length > 0 ? Math.max(...conditionQuestionOrders) : -1;

              // Skip if current question is after all condition questions and before skip target
              if (fromOrder >= 0 && question.order > fromOrder && question.order < skipToQuestion.order) {
                isHidden = true;
                break;
              }
            }
          }
        }

        // Legacy skip-to-end rules (skipToQuestionId === null)
        for (const rule of globalRules) {
          if (rule.action || rule.skipToQuestionId !== null) continue;

          const conditionMet = evaluateRule(rule, '');
          if (conditionMet) {
            const conditionQuestionOrders = rule.conditions
              .map(c => sortedQuestions.find(q => q.id === c.questionId)?.order ?? -1)
              .filter(o => o >= 0);
            const fromOrder = conditionQuestionOrders.length > 0 ? Math.max(...conditionQuestionOrders) : -1;

            if (fromOrder >= 0 && question.order > fromOrder) {
              isHidden = true;
              break;
            }
          }
        }

        // Also check per-question skip logic (legacy support)
        if (!isHidden) {
          for (const prevQuestion of visible) {
            if (prevQuestion.skipLogic && prevQuestion.skipLogic.length > 0) {
              for (const rule of prevQuestion.skipLogic) {
                const conditionMet = evaluateRule(rule, prevQuestion.id);

                if (conditionMet && rule.skipToQuestionId) {
                  const currentOrder = question.order;
                  const skipToQuestion = sortedQuestions.find(q => q.id === rule.skipToQuestionId);

                  if (skipToQuestion && currentOrder > prevQuestion.order && currentOrder < skipToQuestion.order) {
                    isHidden = true;
                    break;
                  }
                }
              }
            }

            if (isHidden) break;
          }
        }
      }

      if (!isHidden) {
        visible.push(question);
      }
    }

    return visible;
  }, [sortedQuestions, questionnaire.skipLogicRules, evaluateRule]);

  // Group questions into pages (split by page_break)
  // Page breaks simply separate questions - no transition screens
  const pages = useMemo(() => {
    const result: Page[] = [];
    let currentQuestions: QuestionnaireQuestion[] = [];

    for (const question of visibleQuestions) {
      if (question.type === 'page_break') {
        // Save current page if it has questions
        if (currentQuestions.length > 0) {
          result.push({
            id: `page-${result.length}`,
            questions: currentQuestions,
            isPageBreak: false,
          });
          currentQuestions = [];
        }
        // Page breaks don't create their own page - they just separate content
      } else {
        currentQuestions.push(question);
      }
    }

    // Don't forget the last page
    if (currentQuestions.length > 0) {
      result.push({
        id: `page-${result.length}`,
        questions: currentQuestions,
        isPageBreak: false,
      });
    }

    return result;
  }, [visibleQuestions]);

  // Count actual questions (excluding page breaks for display)
  const actualQuestions = useMemo(() => {
    return visibleQuestions.filter(q => q.type !== 'page_break');
  }, [visibleQuestions]);

  // Calculate progress
  const currentPage = pages[currentPageIndex];
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex === pages.length - 1;

  // Calculate which question number we're on for display
  const currentQuestionNumber = useMemo(() => {
    let count = 0;
    for (let i = 0; i < currentPageIndex; i++) {
      const page = pages[i];
      if (!page.isPageBreak) {
        count += page.questions.filter(q => q.type !== 'info').length;
      }
    }
    // Add questions from current page (at least 1 if page has questions)
    if (currentPage && !currentPage.isPageBreak && currentPage.questions.length > 0) {
      count += 1;
    }
    return Math.max(1, count);
  }, [pages, currentPageIndex, currentPage]);

  // Update answer for a question
  const updateAnswer = useCallback((questionId: string, value: QuestionnaireAnswer['value']) => {
    const question = sortedQuestions.find(q => q.id === questionId);
    if (!question) return;

    setAnswers(prev => {
      const newAnswers = new Map(prev);
      newAnswers.set(questionId, {
        questionId,
        questionType: question.type,
        value,
      });
      return newAnswers;
    });

    // Clear error when user provides an answer
    setErrors(prev => {
      const newErrors = new Map(prev);
      newErrors.delete(questionId);
      return newErrors;
    });
  }, [sortedQuestions]);

  // Validate a single question
  const validateQuestion = useCallback((question: QuestionnaireQuestion): boolean => {
    // Info steps don't need validation
    if (question.type === 'info') {
      return true;
    }

    const answer = answers.get(question.id);

    if (question.required) {
      if (!answer || answer.value === undefined || answer.value === null) {
        setErrors(prev => new Map(prev).set(question.id, 'This question is required'));
        return false;
      }

      // Additional validation based on type
      if (typeof answer.value === 'string' && answer.value.trim() === '') {
        setErrors(prev => new Map(prev).set(question.id, 'This question is required'));
        return false;
      }

      if (Array.isArray(answer.value) && answer.value.length === 0) {
        setErrors(prev => new Map(prev).set(question.id, 'Please select at least one option'));
        return false;
      }
    }

    // Validate number range
    if (question.type === 'number' && answer?.value !== undefined) {
      const numValue = Number(answer.value);
      if (question.minValue !== undefined && numValue < question.minValue) {
        setErrors(prev => new Map(prev).set(question.id, `Value must be at least ${question.minValue}`));
        return false;
      }
      if (question.maxValue !== undefined && numValue > question.maxValue) {
        setErrors(prev => new Map(prev).set(question.id, `Value must be at most ${question.maxValue}`));
        return false;
      }
    }

    // Validate scale range
    if (question.type === 'scale' && answer?.value !== undefined) {
      const scaleValue = Number(answer.value);
      const min = question.minValue ?? 1;
      const max = question.maxValue ?? 5;
      if (scaleValue < min || scaleValue > max) {
        setErrors(prev => new Map(prev).set(question.id, `Please select a value between ${min} and ${max}`));
        return false;
      }
    }

    return true;
  }, [answers]);

  // Validate current page
  const validateCurrentPage = useCallback(() => {
    if (!currentPage || currentPage.isPageBreak) return true;

    let allValid = true;
    for (const question of currentPage.questions) {
      if (!validateQuestion(question)) {
        allValid = false;
      }
    }
    return allValid;
  }, [currentPage, validateQuestion]);

  // Handle navigation
  const goToNext = useCallback(() => {
    if (!validateCurrentPage()) return;

    if (isLastPage) {
      // Submit the form
      handleSubmit();
    } else {
      setCurrentPageIndex(prev => Math.min(prev + 1, pages.length - 1));
    }
  }, [isLastPage, validateCurrentPage, pages.length]);

  const goToPrevious = useCallback(() => {
    setCurrentPageIndex(prev => Math.max(prev - 1, 0));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Validate all required questions (skip info steps)
    let hasErrors = false;
    const newErrors = new Map<string, string>();

    for (const question of actualQuestions) {
      if (question.type === 'info') continue;

      const answer = answers.get(question.id);

      if (question.required) {
        if (!answer || answer.value === undefined || answer.value === null) {
          newErrors.set(question.id, 'This question is required');
          hasErrors = true;
        } else if (typeof answer.value === 'string' && answer.value.trim() === '') {
          newErrors.set(question.id, 'This question is required');
          hasErrors = true;
        } else if (Array.isArray(answer.value) && answer.value.length === 0) {
          newErrors.set(question.id, 'Please select at least one option');
          hasErrors = true;
        }
      }
    }

    if (hasErrors) {
      setErrors(newErrors);
      // Find first page with an error and navigate to it
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (!page.isPageBreak) {
          for (const question of page.questions) {
            if (newErrors.has(question.id)) {
              setCurrentPageIndex(i);
              return;
            }
          }
        }
      }
      return;
    }

    // Convert answers map to array
    const answersArray = Array.from(answers.values());
    await onSubmit(answersArray);
  }, [actualQuestions, answers, pages, onSubmit]);

  // Handle keyboard navigation (only for single-question pages)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      // Don't auto-advance on Enter for pages with multiple questions
      if (currentPage && !currentPage.isPageBreak && currentPage.questions.length > 1) {
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, currentPage]);

  // Check if current page is only info steps (no actual questions)
  const isPageOnlyInfoSteps = currentPage && !currentPage.isPageBreak &&
    currentPage.questions.every(q => q.type === 'info');

  // Check if current page has all required questions answered
  const canProceed = useMemo(() => {
    if (!currentPage || currentPage.isPageBreak || isPageOnlyInfoSteps) return true;

    for (const question of currentPage.questions) {
      // Skip info steps - they don't require answers
      if (question.type === 'info') continue;

      if (question.required) {
        const answer = answers.get(question.id);
        if (!answer || answer.value === undefined || answer.value === null) {
          return false;
        }
        if (typeof answer.value === 'string' && answer.value.trim() === '') {
          return false;
        }
        if (Array.isArray(answer.value) && answer.value.length === 0) {
          return false;
        }
      }
    }
    return true;
  }, [currentPage, isPageOnlyInfoSteps, answers]);

  // Button text logic
  const getButtonText = () => {
    if (submitting) return 'Submitting...';
    if (isLastPage) return 'Submit';
    if (currentPage?.isPageBreak || isPageOnlyInfoSteps) return 'Continue';
    return 'Next';
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl px-4 sm:px-6 lg:ml-64 lg:mr-auto">
        {/* Progress bar and counter */}
        <div className="pt-4 pb-2">
          {/* Segmented progress bar */}
          <div className="flex gap-1 mb-4">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="flex-1 h-1 rounded-full overflow-hidden bg-[#e8e4df] dark:bg-[#1e232d]"
              >
                <motion.div
                  className="h-full bg-brand-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: index < currentPageIndex ? '100%' : index === currentPageIndex ? '100%' : '0%' }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
            ))}
          </div>

          {/* Back button and question counter */}
          <div className="flex items-center justify-between">
            {!isFirstPage ? (
              <button
                onClick={goToPrevious}
                disabled={submitting}
                className="flex items-center gap-1 text-xs font-medium text-[#8a857f] dark:text-[#6b7280] hover:text-[#5f5a55] dark:hover:text-[#9ca3af] transition-colors font-albert"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            ) : (
              <div />
            )}
            <p className="text-xs font-medium text-[#8a857f] dark:text-[#6b7280] font-albert tracking-wide uppercase">
              {actualQuestions.length > 0 ? (
                <>Question {Math.min(currentQuestionNumber, actualQuestions.length)} of {actualQuestions.length}</>
              ) : (
                <>Step {currentPageIndex + 1} of {pages.length}</>
              )}
            </p>
          </div>
        </div>

        {/* Main content area */}
        <div className="py-8">
          {/* Title, description, and cover image - shown on first page */}
          {isFirstPage && (questionnaire.title || questionnaire.description || questionnaire.coverImageUrl) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-8 text-center"
            >
              {questionnaire.coverImageUrl && (
                <div className="mb-6 rounded-2xl overflow-hidden">
                  <img
                    src={questionnaire.coverImageUrl}
                    alt=""
                    className="w-full h-40 sm:h-48 object-cover"
                  />
                </div>
              )}
              {questionnaire.title && (
                <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {questionnaire.title}
                </h1>
              )}
              {questionnaire.description && (
                <p className="mt-3 text-sm sm:text-base text-[#6b6560] dark:text-[#9ca3af] font-albert leading-relaxed">
                  {questionnaire.description}
                </p>
              )}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {currentPage && currentPage.questions.length > 0 ? (
              // Page with questions
              <motion.div
                key={currentPage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="space-y-8"
              >
                <AnimatePresence mode="popLayout">
                  {currentPage.questions.map((question, index) => (
                    <motion.div
                      key={question.id}
                      layout
                      initial={{ opacity: 0, y: -12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{
                        duration: 0.3,
                        ease: [0.4, 0, 0.2, 1],
                        delay: index * 0.05, // Stagger effect
                        layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
                      }}
                    >
                      <QuestionRenderer
                        question={question}
                        answer={answers.get(question.id)}
                        error={errors.get(question.id)}
                        onChange={(value) => updateAnswer(question.id, value)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Footer with action button */}
        <div className="pt-4 pb-8">
          <motion.button
            onClick={goToNext}
            disabled={submitting || !canProceed}
            whileHover={{ scale: submitting || !canProceed ? 1 : 1.01 }}
            whileTap={{ scale: submitting || !canProceed ? 1 : 0.98 }}
            className="w-full h-14 bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-albert font-semibold text-base rounded-2xl shadow-lg shadow-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/25 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : isLastPage ? (
              <>
                <Send className="w-4 h-4" />
                <span>Submit</span>
              </>
            ) : (
              <span>{getButtonText()}</span>
            )}
          </motion.button>

          {/* Keyboard hint on desktop */}
          {canProceed && !currentPage?.isPageBreak && currentPage?.questions.length === 1 && (
            <p className="hidden sm:block text-center text-xs text-[#a3a09b] dark:text-[#4b5563] font-albert mt-3">
              Press <kbd className="px-1.5 py-0.5 bg-[#e8e4df] dark:bg-[#1e232d] rounded text-[#5f5a55] dark:text-[#9ca3af]">Enter</kbd> to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
