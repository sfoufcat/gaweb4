'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Send, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuestionRenderer } from './QuestionRenderer';
import type { Questionnaire, QuestionnaireAnswer, QuestionnaireQuestion } from '@/types/questionnaire';

interface QuestionnaireFormProps {
  questionnaire: Questionnaire;
  onSubmit: (answers: QuestionnaireAnswer[]) => Promise<void>;
  submitting: boolean;
}

// A page is a group of questions between page breaks
interface Page {
  id: string;
  questions: QuestionnaireQuestion[];
  isPageBreak: boolean; // If true, this is a page break transition screen
  pageBreakQuestion?: QuestionnaireQuestion; // The page break question for transition screens
}

export function QuestionnaireForm({ questionnaire, onSubmit, submitting }: QuestionnaireFormProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, QuestionnaireAnswer>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  // Sort questions by order
  const sortedQuestions = useMemo(() => {
    return [...questionnaire.questions].sort((a, b) => a.order - b.order);
  }, [questionnaire.questions]);

  // Get visible questions based on skip logic (includes page breaks and info steps)
  const visibleQuestions = useMemo(() => {
    const visible: QuestionnaireQuestion[] = [];

    for (const question of sortedQuestions) {
      // Check if any previous question's skip logic skips this question
      let isSkipped = false;

      for (const prevQuestion of visible) {
        if (prevQuestion.skipLogic && prevQuestion.skipLogic.length > 0) {
          const answer = answers.get(prevQuestion.id);

          for (const rule of prevQuestion.skipLogic) {
            // Check if rule condition is met
            let conditionMet = false;

            if (answer) {
              const answerValue = String(answer.value);

              switch (rule.conditionType) {
                case 'equals':
                  conditionMet = answerValue === rule.conditionValue;
                  break;
                case 'not_equals':
                  conditionMet = answerValue !== rule.conditionValue;
                  break;
                case 'contains':
                  conditionMet = answerValue.includes(rule.conditionValue);
                  break;
              }
            }

            // If condition is met and this question should be skipped
            if (conditionMet && rule.skipToQuestionId) {
              // Check if current question is between this question and skip target
              const currentOrder = question.order;
              const skipToQuestion = sortedQuestions.find(q => q.id === rule.skipToQuestionId);

              if (skipToQuestion && currentOrder > prevQuestion.order && currentOrder < skipToQuestion.order) {
                isSkipped = true;
                break;
              }
            }
          }
        }

        if (isSkipped) break;
      }

      if (!isSkipped) {
        visible.push(question);
      }
    }

    return visible;
  }, [sortedQuestions, answers]);

  // Group questions into pages (split by page_break)
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
        // Add page break transition screen
        result.push({
          id: `pagebreak-${question.id}`,
          questions: [],
          isPageBreak: true,
          pageBreakQuestion: question,
        });
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
  const progress = pages.length > 0 ? ((currentPageIndex + 1) / pages.length) * 100 : 0;

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
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't auto-advance on Enter for pages with multiple questions
    if (currentPage && !currentPage.isPageBreak && currentPage.questions.length > 1) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      goToNext();
    }
  }, [goToNext, currentPage]);

  // Check if current page is only info steps (no actual questions)
  const isPageOnlyInfoSteps = currentPage && !currentPage.isPageBreak &&
    currentPage.questions.every(q => q.type === 'info');

  return (
    <div className="min-h-screen flex flex-col" onKeyDown={handleKeyDown}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f9f8f6]/95 dark:bg-[#11141b]/95 backdrop-blur-sm border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {questionnaire.title}
          </h1>
          {questionnaire.description && (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
              {questionnaire.description}
            </p>
          )}

          {/* Progress bar */}
          <div className="mt-4 h-1.5 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-2">
            {actualQuestions.length > 0 ? (
              <>Question {Math.min(currentQuestionNumber, actualQuestions.length)} of {actualQuestions.length}</>
            ) : (
              <>Step {currentPageIndex + 1} of {pages.length}</>
            )}
          </p>
        </div>
      </header>

      {/* Question area */}
      <main className="flex-1 px-6 py-8">
        <div className="w-full max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {currentPage?.isPageBreak ? (
              // Page Break Transition Screen
              <motion.div
                key={currentPage.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="text-center py-16"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="space-y-6"
                >
                  {currentPage.pageBreakQuestion?.title && (
                    <h2 className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      {currentPage.pageBreakQuestion.title}
                    </h2>
                  )}
                  {currentPage.pageBreakQuestion?.description && (
                    <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] font-albert max-w-md mx-auto">
                      {currentPage.pageBreakQuestion.description}
                    </p>
                  )}
                  {!currentPage.pageBreakQuestion?.title && !currentPage.pageBreakQuestion?.description && (
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-brand-accent/10 flex items-center justify-center">
                        <ArrowRight className="w-8 h-8 text-brand-accent" />
                      </div>
                      <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        Ready for the next section?
                      </p>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            ) : currentPage && currentPage.questions.length > 0 ? (
              // Page with questions - render all questions on this page
              <motion.div
                key={currentPage.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {currentPage.questions.map((question, index) => (
                  <div key={question.id}>
                    <QuestionRenderer
                      question={question}
                      answer={answers.get(question.id)}
                      error={errors.get(question.id)}
                      onChange={(value) => updateAnswer(question.id, value)}
                    />
                  </div>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer navigation */}
      <footer className="sticky bottom-0 bg-[#f9f8f6]/95 dark:bg-[#11141b]/95 backdrop-blur-sm border-t border-[#e1ddd8] dark:border-[#262b35]/50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={isFirstPage || submitting}
            className="font-albert"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <Button
            onClick={goToNext}
            disabled={submitting}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert font-medium"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : isLastPage ? (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit
              </>
            ) : currentPage?.isPageBreak || isPageOnlyInfoSteps ? (
              <>
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
