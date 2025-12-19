'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QuizWithSteps, QuizStepWithOptions, QuizStepType, QuizOptionCreateRequest } from '@/types';

interface QuizStepsEditorProps {
  quizId: string;
  onBack: () => void;
  apiBasePath?: string;
}

const STEP_TYPE_LABELS: Record<QuizStepType, string> = {
  'single_choice_list': 'Single Choice (List)',
  'single_choice_list_image': 'Single Choice (List with Images)',
  'single_choice_cards': 'Single Choice (Cards)',
  'single_choice_grid': 'Single Choice (Grid with Images)',
  'multi_select_list': 'Multi-Select (List)',
  'multi_select_list_image': 'Multi-Select (List with Images)',
  'multi_select_grid': 'Multi-Select (Grid with Images)',
  'likert_3': 'Likert Scale (3 options)',
  'like_dislike_neutral': 'Like/Dislike/Neutral',
  'swipe_cards': 'Swipe Cards',
  'statement_cards': 'Statement Cards (Agree/Disagree)',
  'info_prompt': 'Info Prompt (No question)',
};

const STEP_TYPES = Object.keys(STEP_TYPE_LABELS) as QuizStepType[];

export function QuizStepsEditor({ quizId, onBack, apiBasePath = '/api/admin/quizzes' }: QuizStepsEditorProps) {
  const [quiz, setQuiz] = useState<QuizWithSteps | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<QuizStepWithOptions | null>(null);
  const [showAddStep, setShowAddStep] = useState(false);
  // Batch reordering state
  const [localSteps, setLocalSteps] = useState<QuizStepWithOptions[]>([]);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const fetchQuiz = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiBasePath}/${quizId}`);
      if (!response.ok) throw new Error('Failed to fetch quiz');
      const data = await response.json();
      setQuiz(data);
      setLocalSteps(data.steps || []);
      setHasOrderChanges(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz');
    } finally {
      setIsLoading(false);
    }
  }, [quizId, apiBasePath]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Are you sure you want to delete this step?')) return;
    
    try {
      const response = await fetch(`${apiBasePath}/${quizId}/steps/${stepId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete step');
      await fetchQuiz();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete step');
    }
  };

  // Local reorder without API call
  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    const stepIndex = localSteps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    if (direction === 'up' && stepIndex === 0) return;
    if (direction === 'down' && stepIndex === localSteps.length - 1) return;
    
    const newSteps = [...localSteps];
    const otherIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    
    // Swap in array
    [newSteps[stepIndex], newSteps[otherIndex]] = [newSteps[otherIndex], newSteps[stepIndex]];
    
    // Update order values
    newSteps.forEach((step, index) => {
      step.order = index + 1;
    });
    
    setLocalSteps(newSteps);
    setHasOrderChanges(true);
  };

  // Save all order changes to the server
  const handleSaveOrder = async () => {
    if (!hasOrderChanges) return;
    
    setIsSavingOrder(true);
    try {
      // Update all steps with their new order values
      await Promise.all(
        localSteps.map((step, index) =>
          fetch(`${apiBasePath}/${quizId}/steps/${step.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: index + 1 }),
          })
        )
      );
      setHasOrderChanges(false);
      // Refresh to ensure sync with server
      await fetchQuiz();
    } catch (_err) {
      alert('Failed to save order changes');
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Reset order changes
  const handleCancelOrderChanges = () => {
    if (quiz) {
      setLocalSteps(quiz.steps);
      setHasOrderChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#a07855] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400">{error || 'Quiz not found'}</p>
        <button onClick={onBack} className="mt-2 text-sm underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {quiz.title}
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-mono">
            /{quiz.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasOrderChanges && (
            <>
              <button
                onClick={handleCancelOrderChanges}
                disabled={isSavingOrder}
                className="px-3 py-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded-lg font-albert text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-albert text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingOrder && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Save Order
              </button>
            </>
          )}
          <button
            onClick={() => setShowAddStep(true)}
            className="px-4 py-2 bg-[#a07855] text-white rounded-lg font-albert text-sm font-medium hover:bg-[#8c6245] transition-colors"
          >
            + Add Step
          </button>
        </div>
      </div>

      {/* Order changes banner */}
      {hasOrderChanges && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-amber-800 dark:text-amber-200 font-albert">
            You have unsaved order changes. Click &quot;Save Order&quot; when done reorganizing.
          </p>
        </div>
      )}

      {/* Steps list */}
      <div className="space-y-2">
        {localSteps.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No steps yet.</p>
            <button
              onClick={() => setShowAddStep(true)}
              className="mt-2 text-[#a07855] text-sm font-albert underline"
            >
              Add your first step
            </button>
          </div>
        ) : (
          localSteps.map((step, index) => (
            <div
              key={step.id}
              className={`bg-white dark:bg-[#171b22] border rounded-lg p-4 ${
                hasOrderChanges ? 'border-amber-300 dark:border-amber-700' : 'border-[#e1ddd8] dark:border-[#262b35]'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Reorder buttons */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMoveStep(step.id, 'up')}
                    disabled={index === 0}
                    className="p-1 hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 text-[#5f5a55]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveStep(step.id, 'down')}
                    disabled={index === localSteps.length - 1}
                    className="p-1 hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 text-[#5f5a55]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono bg-[#f5f2ed] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] px-2 py-0.5 rounded">
                      #{step.order}
                    </span>
                    <span className="text-xs bg-[#a07855]/10 text-[#a07855] px-2 py-0.5 rounded">
                      {STEP_TYPE_LABELS[step.type] || step.type}
                    </span>
                    {step.isGoalQuestion && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded font-medium">
                        🎯 Goal
                      </span>
                    )}
                    {step.isStartingPointQuestion && (
                      <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded font-medium">
                        📍 Starting Point
                      </span>
                    )}
                    {step.showConfirmation && (
                      <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                        Confirmation
                      </span>
                    )}
                    {step.dataKey && (
                      <span className="text-xs font-mono text-[#5f5a55] dark:text-[#b2b6c2]">
                        → {step.dataKey}
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                    {step.title}
                  </h4>
                  {step.subtitle && (
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                      {step.subtitle}
                    </p>
                  )}
                  {step.options.length > 0 && (
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                      {step.options.length} option{step.options.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingStep(step)}
                    className="px-3 py-1.5 text-sm text-[#a07855] hover:bg-[#a07855]/10 rounded-lg transition-colors font-albert"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteStep(step.id)}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-albert"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Step Editor Modal */}
      {(editingStep || showAddStep) && (
        <StepEditorModal
          quizId={quizId}
          step={editingStep}
          nextOrder={localSteps.length + 1}
          onClose={() => {
            setEditingStep(null);
            setShowAddStep(false);
          }}
          onSaved={() => {
            setEditingStep(null);
            setShowAddStep(false);
            fetchQuiz();
          }}
          apiBasePath={apiBasePath}
        />
      )}
    </div>
  );
}

// =============================================================================
// Step Editor Modal
// =============================================================================

interface StepEditorModalProps {
  quizId: string;
  step: QuizStepWithOptions | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
  apiBasePath?: string;
}

function StepEditorModal({ quizId, step, nextOrder, onClose, onSaved, apiBasePath = '/api/admin/quizzes' }: StepEditorModalProps) {
  const [mounted, setMounted] = useState(false);
  const isEditing = !!step;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Ensure portal only renders on client
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle image upload with compression
  const handleImageUpload = async (
    file: File, 
    fieldName: 'imageUrl' | 'statementImageUrl' | `option_${number}`
  ) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setUploadingField(fieldName);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'images');

      const response = await fetch('/api/admin/upload-media', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update the appropriate field
      if (fieldName === 'imageUrl') {
        setFormData(prev => ({ ...prev, imageUrl: result.url }));
      } else if (fieldName === 'statementImageUrl') {
        setFormData(prev => ({ ...prev, statementImageUrl: result.url }));
      } else if (fieldName.startsWith('option_')) {
        const index = parseInt(fieldName.split('_')[1], 10);
        handleOptionChange(index, 'imageUrl', result.url);
      }

      // Log compression stats
      if (result.originalSize && result.compressedSize) {
        const savings = ((1 - result.compressedSize / result.originalSize) * 100).toFixed(1);
        console.log(`Image compressed: ${savings}% smaller`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingField(null);
    }
  };

  const [formData, setFormData] = useState({
    type: step?.type || 'single_choice_list' as QuizStepType,
    title: step?.title || '',
    subtitle: step?.subtitle || '',
    description: step?.description || '',
    imageUrl: step?.imageUrl || '',
    statement: step?.statement || '',
    statementImageUrl: step?.statementImageUrl || '',
    dataKey: step?.dataKey || '',
    isRequired: step?.isRequired ?? true,
    isSkippable: step?.isSkippable ?? false,
    ctaLabel: step?.ctaLabel || '',
    illustrationKey: step?.illustrationKey || '',
    chartLabel1: step?.chartLabel1 || '',
    chartLabel2: step?.chartLabel2 || '',
    chartEmoji1: step?.chartEmoji1 || '',
    chartEmoji2: step?.chartEmoji2 || '',
    // Goal question and confirmation fields
    isGoalQuestion: step?.isGoalQuestion ?? false,
    isStartingPointQuestion: step?.isStartingPointQuestion ?? false,
    showConfirmation: step?.showConfirmation ?? false,
    confirmationTitle: step?.confirmationTitle || '',
    confirmationSubtitle: step?.confirmationSubtitle || '',
  });

  const [options, setOptions] = useState<QuizOptionCreateRequest[]>(
    step?.options.map(o => ({
      order: o.order,
      label: o.label,
      emoji: o.emoji || '',
      value: o.value,
      helperText: o.helperText || '',
      imageUrl: o.imageUrl || '',
      isDefault: o.isDefault || false,
      confirmationTitle: o.confirmationTitle || '',
      confirmationSubtitle: o.confirmationSubtitle || '',
    })) || []
  );

  const isInfoPrompt = formData.type === 'info_prompt';
  const isStatementCards = formData.type === 'statement_cards';
  const needsOptions = !isInfoPrompt;

  const handleAddOption = () => {
    setOptions(prev => [
      ...prev,
      {
        order: prev.length + 1,
        label: '',
        emoji: '',
        value: '',
        helperText: '',
        imageUrl: '',
        isDefault: false,
        confirmationTitle: '',
        confirmationSubtitle: '',
      },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(prev => prev.filter((_, i) => i !== index).map((o, i) => ({ ...o, order: i + 1 })));
  };

  const handleOptionChange = (index: number, field: keyof QuizOptionCreateRequest, value: string | number | boolean | string[] | null) => {
    setOptions(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.title.trim()) throw new Error('Title is required');
      if (needsOptions && options.length === 0) throw new Error('At least one option is required');

      const payload = {
        ...formData,
        order: step?.order ?? nextOrder,
        options: needsOptions ? options : undefined,
      };

      const url = isEditing
        ? `${apiBasePath}/${quizId}/steps/${step.id}`
        : `${apiBasePath}/${quizId}/steps`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save step');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render on server or before mount
  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#171b22] rounded-xl w-full max-w-2xl shadow-xl my-8">
        {/* Header */}
        <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35] sticky top-0 bg-white dark:bg-[#171b22] rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {isEditing ? 'Edit Step' : 'Add New Step'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded-lg"
            >
              <svg className="w-5 h-5 text-[#5f5a55]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Step Type */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Step Type *
            </label>
            <select
              value={formData.type}
              onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as QuizStepType }))}
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert"
            >
              {STEP_TYPES.map(type => (
                <option key={type} value={type}>{STEP_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={isInfoPrompt ? 'Consistency beats random viral hits 🎯' : 'What type of content do you create?'}
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert"
              required
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Subtitle / Helper Text
            </label>
            <input
              type="text"
              value={formData.subtitle}
              onChange={e => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
              placeholder="Choose all that apply"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert"
            />
          </div>

          {/* Description (mainly for info_prompt) */}
          {isInfoPrompt && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                Body Text
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                placeholder="Growth Addicts will help you build a simple, realistic system..."
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert resize-none"
              />
            </div>
          )}

          {/* Statement (for statement_cards) */}
          {isStatementCards && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                  Statement
                </label>
                <input
                  type="text"
                  value={formData.statement}
                  onChange={e => setFormData(prev => ({ ...prev, statement: e.target.value }))}
                  placeholder="I have good ideas, but I overthink and post much less than I could."
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                  Statement Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.statementImageUrl}
                    onChange={e => setFormData(prev => ({ ...prev, statementImageUrl: e.target.value }))}
                    placeholder="https://firebasestorage.googleapis.com/..."
                    className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-mono text-sm"
                  />
                  <label className={`px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-[#f3f1ef] dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] cursor-pointer hover:bg-[#e8e3de] dark:hover:bg-[#1d222b] transition-colors text-sm font-medium flex items-center gap-1.5 ${uploadingField === 'statementImageUrl' ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingField === 'statementImageUrl' ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>📤 Upload</>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, 'statementImageUrl');
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Step Image URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={formData.imageUrl}
                onChange={e => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://firebasestorage.googleapis.com/..."
                className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-mono text-sm"
              />
              <label className={`px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-[#f3f1ef] dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] cursor-pointer hover:bg-[#e8e3de] dark:hover:bg-[#1d222b] transition-colors text-sm font-medium flex items-center gap-1.5 ${uploadingField === 'imageUrl' ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingField === 'imageUrl' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>📤 Upload</>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'imageUrl');
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Images are automatically compressed on upload (max 1200px, 80% quality)
            </p>
          </div>

          {/* Data Key (for questions) */}
          {!isInfoPrompt && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                Data Key
              </label>
              <input
                type="text"
                value={formData.dataKey}
                onChange={e => setFormData(prev => ({ ...prev, dataKey: e.target.value }))}
                placeholder="e.g., creatorType, focusedPlatforms"
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-mono text-sm"
              />
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                Key used to store the answer in the user&apos;s session
              </p>
            </div>
          )}

          {/* CTA Label (for info_prompt) */}
          {isInfoPrompt && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                Button Label
              </label>
              <input
                type="text"
                value={formData.ctaLabel}
                onChange={e => setFormData(prev => ({ ...prev, ctaLabel: e.target.value }))}
                placeholder="Got it →"
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert"
              />
            </div>
          )}

          {/* Illustration Key (legacy support) */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Illustration Key (Legacy)
            </label>
            <input
              type="text"
              value={formData.illustrationKey}
              onChange={e => setFormData(prev => ({ ...prev, illustrationKey: e.target.value }))}
              placeholder="e.g., rocket, chart, zen"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-mono text-sm"
            />
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Uses built-in illustrations (rocket, chart, zen, money, community, etc.)
            </p>
          </div>

          {/* Chart Legend Labels (shown when illustrationKey contains 'chart') */}
          {formData.illustrationKey?.includes('chart') && (
            <div className="space-y-3 p-3 bg-[#f9f7f5] dark:bg-[#0d0f12] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]">
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Chart Legend Labels
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                    Label 1
                  </label>
                  <input
                    type="text"
                    value={formData.chartLabel1}
                    onChange={e => setFormData(prev => ({ ...prev, chartLabel1: e.target.value }))}
                    placeholder="e.g., Content Quality"
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                    Emoji 1
                  </label>
                  <input
                    type="text"
                    value={formData.chartEmoji1}
                    onChange={e => setFormData(prev => ({ ...prev, chartEmoji1: e.target.value }))}
                    placeholder="💪"
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                    Label 2
                  </label>
                  <input
                    type="text"
                    value={formData.chartLabel2}
                    onChange={e => setFormData(prev => ({ ...prev, chartLabel2: e.target.value }))}
                    placeholder="e.g., Burnout Risk"
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                    Emoji 2
                  </label>
                  <input
                    type="text"
                    value={formData.chartEmoji2}
                    onChange={e => setFormData(prev => ({ ...prev, chartEmoji2: e.target.value }))}
                    placeholder="📉"
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 text-center"
                  />
                </div>
              </div>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                Leave blank to use default labels for this chart type
              </p>
            </div>
          )}

          {/* Goal Question Settings (for question types) */}
          {!isInfoPrompt && (
            <div className="space-y-3 p-3 bg-[#f0f8ff] dark:bg-[#1a2332] rounded-lg border border-[#b3d9ff] dark:border-[#2a4a6b]">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isGoalQuestion}
                    onChange={e => setFormData(prev => ({ ...prev, isGoalQuestion: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#e1ddd8] dark:border-[#262b35] text-[#a07855] focus:ring-[#a07855]/50"
                  />
                  <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    🎯 Goal Question
                  </span>
                </label>
                {formData.isGoalQuestion && (
                  <span className="text-xs bg-[#a07855] text-white px-2 py-0.5 rounded">
                    This defines the user&apos;s goal
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isStartingPointQuestion}
                    onChange={e => setFormData(prev => ({ ...prev, isStartingPointQuestion: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#e1ddd8] dark:border-[#262b35] text-[#a07855] focus:ring-[#a07855]/50"
                  />
                  <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    📍 Starting Point Question
                  </span>
                </label>
                {formData.isStartingPointQuestion && (
                  <span className="text-xs bg-[#22c55e] text-white px-2 py-0.5 rounded">
                    This defines the user&apos;s starting point
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showConfirmation}
                    onChange={e => setFormData(prev => ({ ...prev, showConfirmation: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#e1ddd8] dark:border-[#262b35] text-[#a07855] focus:ring-[#a07855]/50"
                  />
                  <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    Show Confirmation Card
                  </span>
                </label>
              </div>

              {formData.showConfirmation && (
                <div className="space-y-3 pt-2 border-t border-[#b3d9ff] dark:border-[#2a4a6b]">
                  <div>
                    <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                      Confirmation Title
                    </label>
                    <input
                      type="text"
                      value={formData.confirmationTitle}
                      onChange={e => setFormData(prev => ({ ...prev, confirmationTitle: e.target.value }))}
                      placeholder="e.g., 98% of users who picked this achieved their goal"
                      className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                      Confirmation Subtitle (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.confirmationSubtitle}
                      onChange={e => setFormData(prev => ({ ...prev, confirmationSubtitle: e.target.value }))}
                      placeholder="e.g., You're on the right track!"
                      className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Options (for question types) */}
          {needsOptions && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Options
                </label>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-sm text-[#a07855] font-albert hover:underline"
                >
                  + Add Option
                </button>
              </div>

              {options.length === 0 ? (
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">No options yet. Add at least one.</p>
              ) : (
                <div className="space-y-3">
                  {options.map((option, index) => (
                    <div
                      key={index}
                      className="p-3 bg-[#f9f7f5] dark:bg-[#0d0f12] rounded-lg space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono text-[#5f5a55] mt-2">#{index + 1}</span>
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={option.label}
                              onChange={e => handleOptionChange(index, 'label', e.target.value)}
                              placeholder="Label (e.g., TikTok-style short videos)"
                              className="flex-1 px-3 py-1.5 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert text-sm"
                            />
                            <input
                              type="text"
                              value={option.emoji}
                              onChange={e => handleOptionChange(index, 'emoji', e.target.value)}
                              placeholder="🎥"
                              className="w-16 px-3 py-1.5 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 text-center"
                            />
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={option.value}
                              onChange={e => handleOptionChange(index, 'value', e.target.value)}
                              placeholder="Value key (e.g., tiktok_short)"
                              className="flex-1 px-3 py-1.5 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-mono text-sm"
                            />
                            <input
                              type="text"
                              value={option.imageUrl}
                              onChange={e => handleOptionChange(index, 'imageUrl', e.target.value)}
                              placeholder="Image URL (optional)"
                              className="flex-1 px-3 py-1.5 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-mono text-sm"
                            />
                            <label className={`px-2 py-1.5 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-[#f3f1ef] dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] cursor-pointer hover:bg-[#e8e3de] dark:hover:bg-[#1d222b] transition-colors text-xs font-medium flex items-center ${uploadingField === `option_${index}` ? 'opacity-50 pointer-events-none' : ''}`}>
                              {uploadingField === `option_${index}` ? (
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                '📤'
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(file, `option_${index}` as `option_${number}`);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                          {/* Per-option confirmation text (only for goal questions) */}
                          {formData.isGoalQuestion && (
                            <div className="space-y-2 pt-2 border-t border-dashed border-[#e1ddd8] dark:border-[#262b35] mt-2">
                              <input
                                type="text"
                                value={option.confirmationTitle || ''}
                                onChange={e => handleOptionChange(index, 'confirmationTitle', e.target.value)}
                                placeholder="Confirmation Title (e.g., 98% of users achieved this goal!)"
                                className="w-full px-3 py-1.5 border border-blue-200 dark:border-blue-900 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-albert text-sm"
                              />
                              <input
                                type="text"
                                value={option.confirmationSubtitle || ''}
                                onChange={e => handleOptionChange(index, 'confirmationSubtitle', e.target.value)}
                                placeholder="Confirmation Subtitle (optional)"
                                className="w-full px-3 py-1.5 border border-blue-200 dark:border-blue-900 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-albert text-sm"
                              />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded-lg font-albert text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#a07855] text-white rounded-lg font-albert text-sm font-medium hover:bg-[#8c6245] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isEditing ? 'Save Changes' : 'Add Step'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

