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

export function QuestionnaireForm({ questionnaire, onSubmit, submitting }: QuestionnaireFormProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
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

  // Count actual questions (excluding page breaks and info steps for display)
  const actualQuestions = useMemo(() => {
    return visibleQuestions.filter(q => q.type !== 'page_break' && q.type !== 'info');
  }, [visibleQuestions]);

  // Calculate current "question number" for progress display
  const currentQuestionNumber = useMemo(() => {
    let count = 0;
    for (let i = 0; i <= currentIndex && i < visibleQuestions.length; i++) {
      const q = visibleQuestions[i];
      if (q.type !== 'page_break' && q.type !== 'info') {
        count++;
      }
    }
    return count;
  }, [currentIndex, visibleQuestions]);

  const currentQuestion = visibleQuestions[currentIndex];
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === visibleQuestions.length - 1;
  const progress = ((currentIndex + 1) / visibleQuestions.length) * 100;

  // Check if current item is a page break
  const isPageBreak = currentQuestion?.type === 'page_break';
  const isInfoStep = currentQuestion?.type === 'info';

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

  // Validate current question
  const validateCurrentQuestion = useCallback(() => {
    if (!currentQuestion) return true;

    // Page breaks and info steps don't need validation
    if (currentQuestion.type === 'page_break' || currentQuestion.type === 'info') {
      return true;
    }

    const answer = answers.get(currentQuestion.id);

    if (currentQuestion.required) {
      if (!answer || answer.value === undefined || answer.value === null) {
        setErrors(prev => new Map(prev).set(currentQuestion.id, 'This question is required'));
        return false;
      }

      // Additional validation based on type
      if (typeof answer.value === 'string' && answer.value.trim() === '') {
        setErrors(prev => new Map(prev).set(currentQuestion.id, 'This question is required'));
        return false;
      }

      if (Array.isArray(answer.value) && answer.value.length === 0) {
        setErrors(prev => new Map(prev).set(currentQuestion.id, 'Please select at least one option'));
        return false;
      }
    }

    // Validate number range
    if (currentQuestion.type === 'number' && answer?.value !== undefined) {
      const numValue = Number(answer.value);
      if (currentQuestion.minValue !== undefined && numValue < currentQuestion.minValue) {
        setErrors(prev => new Map(prev).set(currentQuestion.id, `Value must be at least ${currentQuestion.minValue}`));
        return false;
      }
      if (currentQuestion.maxValue !== undefined && numValue > currentQuestion.maxValue) {
        setErrors(prev => new Map(prev).set(currentQuestion.id, `Value must be at most ${currentQuestion.maxValue}`));
        return false;
      }
    }

    // Validate scale range
    if (currentQuestion.type === 'scale' && answer?.value !== undefined) {
      const scaleValue = Number(answer.value);
      const min = currentQuestion.minValue ?? 1;
      const max = currentQuestion.maxValue ?? 5;
      if (scaleValue < min || scaleValue > max) {
        setErrors(prev => new Map(prev).set(currentQuestion.id, `Please select a value between ${min} and ${max}`));
        return false;
      }
    }

    return true;
  }, [currentQuestion, answers]);

  // Handle navigation
  const goToNext = useCallback(() => {
    if (!validateCurrentQuestion()) return;

    if (isLastQuestion) {
      // Submit the form
      handleSubmit();
    } else {
      setCurrentIndex(prev => Math.min(prev + 1, visibleQuestions.length - 1));
    }
  }, [isLastQuestion, validateCurrentQuestion, visibleQuestions.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Validate all required questions (skip page breaks and info steps)
    let hasErrors = false;

    for (const question of visibleQuestions) {
      if (question.type === 'page_break' || question.type === 'info') continue;

      const answer = answers.get(question.id);

      if (question.required) {
        if (!answer || answer.value === undefined || answer.value === null) {
          setErrors(prev => new Map(prev).set(question.id, 'This question is required'));
          hasErrors = true;
        } else if (typeof answer.value === 'string' && answer.value.trim() === '') {
          setErrors(prev => new Map(prev).set(question.id, 'This question is required'));
          hasErrors = true;
        } else if (Array.isArray(answer.value) && answer.value.length === 0) {
          setErrors(prev => new Map(prev).set(question.id, 'Please select at least one option'));
          hasErrors = true;
        }
      }
    }

    if (hasErrors) {
      // Find first question with error and navigate to it
      for (let i = 0; i < visibleQuestions.length; i++) {
        if (errors.has(visibleQuestions[i].id)) {
          setCurrentIndex(i);
          break;
        }
      }
      return;
    }

    // Convert answers map to array (only include actual answers, not page breaks)
    const answersArray = Array.from(answers.values());
    await onSubmit(answersArray);
  }, [visibleQuestions, answers, errors, onSubmit]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      goToNext();
    }
  }, [goToNext]);

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
              <>Step {currentIndex + 1} of {visibleQuestions.length}</>
            )}
          </p>
        </div>
      </header>

      {/* Question area */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {isPageBreak ? (
              // Page Break Transition Screen
              <motion.div
                key={`page-break-${currentQuestion.id}`}
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
                  {currentQuestion.title && (
                    <h2 className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      {currentQuestion.title}
                    </h2>
                  )}
                  {currentQuestion.description && (
                    <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] font-albert max-w-md mx-auto">
                      {currentQuestion.description}
                    </p>
                  )}
                  {!currentQuestion.title && !currentQuestion.description && (
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
            ) : currentQuestion ? (
              // Regular Question or Info Step
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <QuestionRenderer
                  question={currentQuestion}
                  answer={answers.get(currentQuestion.id)}
                  error={errors.get(currentQuestion.id)}
                  onChange={(value) => updateAnswer(currentQuestion.id, value)}
                />
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
            disabled={isFirstQuestion || submitting}
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
            ) : isLastQuestion ? (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit
              </>
            ) : isPageBreak || isInfoStep ? (
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
