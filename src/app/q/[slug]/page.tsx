'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { QuestionnaireForm } from '@/components/questionnaire/QuestionnaireForm';
import { Loader2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-accent mx-auto" />
          <p className="mt-4 text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Loading questionnaire...
          </p>
        </div>
      </div>
    );
  }

  // Auth required state
  if (pageState === 'auth_required') {
    return (
      <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 p-8 text-center">
          <div className="w-16 h-16 bg-brand-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-brand-accent" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            Sign in Required
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6">
            Please sign in to complete this questionnaire. Your response will be linked to your account.
          </p>
          <Button
            onClick={() => router.push(`/sign-in?redirect_url=/q/${slug}`)}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert font-medium w-full"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Already submitted state
  if (pageState === 'already_submitted') {
    return (
      <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            Already Submitted
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6">
            You have already submitted a response to this questionnaire. Thank you for your participation!
          </p>
          <Button
            onClick={() => router.push('/dashboard')}
            variant="outline"
            className="font-albert"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            Oops!
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6">
            {error || 'Something went wrong. Please try again later.'}
          </p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="font-albert"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Submitted state
  if (pageState === 'submitted') {
    return (
      <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            Thank You!
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6">
            Your response has been submitted successfully.
          </p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert font-medium"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b]">
      {questionnaire && (
        <QuestionnaireForm
          questionnaire={questionnaire}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}
