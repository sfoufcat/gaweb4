'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { QuestionnaireForm } from '@/components/questionnaire/QuestionnaireForm';
import { Loader2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import type { Questionnaire, QuestionnaireAnswer } from '@/types/questionnaire';

type PageState = 'loading' | 'form' | 'submitted' | 'error' | 'already_submitted' | 'auth_required';

export default function QuestionnairePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { isSignedIn, isLoaded } = useAuth();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  // Fetch questionnaire
  const fetchQuestionnaire = useCallback(async () => {
    if (!slug) return;

    try {
      const response = await fetch(`/api/questionnaires/${slug}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setPageState('auth_required');
          return;
        }
        if (data.alreadySubmitted) {
          setPageState('already_submitted');
          return;
        }
        throw new Error(data.error || 'Failed to load questionnaire');
      }

      setQuestionnaire(data);
      setPageState('form');
    } catch (err) {
      console.error('Error fetching questionnaire:', err);
      setError(err instanceof Error ? err.message : 'Failed to load questionnaire');
      setPageState('error');
    }
  }, [slug]);

  // Wait for auth to load, then fetch
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setPageState('auth_required');
      return;
    }

    fetchQuestionnaire();
  }, [isLoaded, isSignedIn, fetchQuestionnaire]);

  // Handle submit
  const handleSubmit = async (answers: QuestionnaireAnswer[]) => {
    if (!questionnaire) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/questionnaires/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionnaireId: questionnaire.id,
          answers,
          completionTimeMs: Date.now() - startTime,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit response');
      }

      setPageState('submitted');
    } catch (err) {
      console.error('Error submitting:', err);
      alert(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#faf9f7] to-[#f5f3f0] dark:from-[#0f1218] dark:to-[#0a0c10] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
            </div>
          </div>
          <p className="mt-4 text-[#8a857f] dark:text-[#6b7280] font-albert text-sm">
            Loading questionnaire...
          </p>
        </motion.div>
      </div>
    );
  }

  // Auth required state
  if (pageState === 'auth_required') {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#faf9f7] to-[#f5f3f0] dark:from-[#0f1218] dark:to-[#0a0c10] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-brand-accent/20 to-brand-accent/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-7 h-7 text-brand-accent" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            Sign in Required
          </h1>
          <p className="text-[#6b6560] dark:text-[#9ca3af] font-albert mb-8 leading-relaxed">
            Please sign in to complete this questionnaire. Your response will be linked to your account.
          </p>
          <motion.button
            onClick={() => router.push(`/sign-in?redirect_url=/q/${slug}`)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-14 bg-brand-accent hover:bg-brand-accent/90 text-white font-albert font-semibold text-base rounded-2xl shadow-lg shadow-brand-accent/20 transition-all"
          >
            Sign In
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Already submitted state
  if (pageState === 'already_submitted') {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#faf9f7] to-[#f5f3f0] dark:from-[#0f1218] dark:to-[#0a0c10] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-7 h-7 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            Already Submitted
          </h1>
          <p className="text-[#6b6560] dark:text-[#9ca3af] font-albert mb-8 leading-relaxed">
            You have already submitted a response to this questionnaire. Thank you for your participation!
          </p>
          <motion.button
            onClick={() => window.location.href = '/'}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-14 bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-semibold text-base rounded-2xl border border-[#e8e4df] dark:border-[#262b35] hover:border-[#d1cdc8] dark:hover:border-[#363c48] shadow-sm transition-all"
          >
            Go to Dashboard
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (pageState === 'error') {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#faf9f7] to-[#f5f3f0] dark:from-[#0f1218] dark:to-[#0a0c10] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            Oops!
          </h1>
          <p className="text-[#6b6560] dark:text-[#9ca3af] font-albert mb-8 leading-relaxed">
            {error || 'Something went wrong. Please try again later.'}
          </p>
          <motion.button
            onClick={() => window.location.reload()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-14 bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-semibold text-base rounded-2xl border border-[#e8e4df] dark:border-[#262b35] hover:border-[#d1cdc8] dark:hover:border-[#363c48] shadow-sm transition-all"
          >
            Try Again
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Submitted state
  if (pageState === 'submitted') {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#faf9f7] to-[#f5f3f0] dark:from-[#0f1218] dark:to-[#0a0c10] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="max-w-sm w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-3xl flex items-center justify-center mx-auto mb-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
            >
              <CheckCircle2 className="w-9 h-9 text-green-500" />
            </motion.div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3"
          >
            Thank You!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-[#6b6560] dark:text-[#9ca3af] font-albert mb-8 leading-relaxed"
          >
            Your response has been submitted successfully. We appreciate your time.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={() => window.location.href = '/'}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-14 bg-brand-accent hover:bg-brand-accent/90 text-white font-albert font-semibold text-base rounded-2xl shadow-lg shadow-brand-accent/20 transition-all"
          >
            Go to Dashboard
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Form state - full screen questionnaire
  if (questionnaire) {
    return (
      <QuestionnaireForm
        questionnaire={questionnaire}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    );
  }

  return null;
}
