'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Plus,
  GripVertical,
  Trash2,
  Pencil,
  MessageSquare,
  Target,
  User,
  Loader2,
  PlayCircle,
  CheckCircle,
  X,
  ExternalLink
} from 'lucide-react';
import type { OnboardingStep, OnboardingStepType, FunnelStepConfigQuestion, FunnelStepConfigGoal, FunnelStepConfigIdentity, FunnelStepConfigExplainer, FunnelStepConfigSuccess } from '@/types';
import { StepConfigEditor } from '@/components/coach/funnels/StepConfigEditor';
import { ConfirmationModal } from '@/components/feed/ConfirmationModal';

interface OnboardingFlowEditorProps {
  flowId: string;
  onBack: () => void;
}

// Step types available for onboarding (subset of funnel step types)
const ONBOARDING_STEP_TYPES: OnboardingStepType[] = [
  'question',
  'goal_setting', 
  'identity',
  'explainer',
  'success'
];

const STEP_TYPE_INFO: Record<OnboardingStepType, { 
  icon: React.ElementType; 
  label: string; 
  description: string;
  color: string;
}> = {
  question: { 
    icon: MessageSquare, 
    label: 'Question', 
    description: 'Single choice, multi-select, or open question',
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
  },
  goal_setting: { 
    icon: Target, 
    label: 'Goal Setting', 
    description: 'User sets their personal goal',
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
  },
  identity: { 
    icon: User, 
    label: 'Identity', 
    description: 'User defines who they\'re becoming',
    color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'
  },
  explainer: { 
    icon: PlayCircle, 
    label: 'Explainer', 
    description: 'Rich media with image, video, or text',
    color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
  },
  success: { 
    icon: CheckCircle, 
    label: 'Success', 
    description: 'Final welcome/completion step',
    color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
  },
};

// Default configs for each step type
function getDefaultConfig(type: OnboardingStepType): FunnelStepConfigQuestion | FunnelStepConfigGoal | FunnelStepConfigIdentity | FunnelStepConfigExplainer | FunnelStepConfigSuccess {
  switch (type) {
    case 'question':
      return {
        questionType: 'single_choice',
        question: 'What brings you here?',
        options: [
          { id: '1', label: 'Option 1', value: 'option_1', order: 0 },
          { id: '2', label: 'Option 2', value: 'option_2', order: 1 },
        ],
        required: true,
        fieldName: 'question_answer',
      } as FunnelStepConfigQuestion;
    case 'goal_setting':
      return {
        examples: ['Launch my business', 'Grow to $10k/month', 'Build a team'],
        timelineDays: 90,
        heading: 'What\'s your main goal?',
        promptText: 'Set a clear, measurable goal you want to achieve',
      } as FunnelStepConfigGoal;
    case 'identity':
      return {
        examples: ['A successful entrepreneur', 'A confident leader', 'A focused achiever'],
        heading: 'Who are you becoming?',
        promptText: 'I am becoming...',
      } as FunnelStepConfigIdentity;
    case 'explainer':
      return {
        heading: 'Welcome!',
        body: 'We\'re excited to have you here. Let\'s get you set up for success.',
        ctaText: 'Continue',
        layout: 'media_top',
      } as FunnelStepConfigExplainer;
    case 'success':
      return {
        heading: 'You\'re all set!',
        body: 'Welcome to the community. Let\'s start your journey!',
        showConfetti: true,
        redirectDelay: 2000,
      } as FunnelStepConfigSuccess;
  }
}

export function OnboardingFlowEditor({ flowId, onBack }: OnboardingFlowEditorProps) {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Modals
  const [showAddStep, setShowAddStep] = useState(false);
  const [editingStep, setEditingStep] = useState<OnboardingStep | null>(null);
  const [stepToDelete, setStepToDelete] = useState<OnboardingStep | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchSteps = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/coach/org-onboarding-flow/steps?flowId=${flowId}`);
      if (!response.ok) throw new Error('Failed to fetch steps');
      const data = await response.json();
      setSteps(data.steps || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load steps');
    } finally {
      setIsLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  const handleAddStep = async (type: OnboardingStepType) => {
    setShowAddStep(false);
    setIsSaving(true);
    
    try {
      const defaultConfig = getDefaultConfig(type);
      const response = await fetch(`/api/coach/org-onboarding-flow/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowId,
          type,
          name: STEP_TYPE_INFO[type].label,
          config: { type, config: defaultConfig },
        }),
      });
      
      if (!response.ok) throw new Error('Failed to add step');
      await fetchSteps();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add step');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReorder = async (reorderedSteps: OnboardingStep[]) => {
    // Optimistically update UI
    setSteps(reorderedSteps);
    setIsSaving(true);
    
    try {
      const response = await fetch(`/api/coach/org-onboarding-flow/steps/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowId,
          stepIds: reorderedSteps.map(s => s.id),
        }),
      });
      
      if (!response.ok) throw new Error('Failed to reorder steps');
    } catch (err) {
      // Revert on error
      await fetchSteps();
      setError(err instanceof Error ? err.message : 'Failed to reorder steps');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStep = async () => {
    if (!stepToDelete) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/coach/org-onboarding-flow/steps/${stepToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete step');
      setStepToDelete(null);
      await fetchSteps();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete step');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStepConfig = async (config: unknown, name?: string) => {
    if (!editingStep) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/coach/org-onboarding-flow/steps/${editingStep.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { type: editingStep.type, config },
          name: name || editingStep.name,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update step');
      setEditingStep(null);
      await fetchSteps();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update step');
    } finally {
      setIsSaving(false);
    }
  };

  // Render step row
  const renderStepRow = (step: OnboardingStep, index: number) => {
    const typeInfo = STEP_TYPE_INFO[step.type];
    const Icon = typeInfo.icon;
    
    return (
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#171b22] border-b border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-[#1a1f27] transition-colors">
        {/* Drag handle */}
        <div className="cursor-grab active:cursor-grabbing text-text-muted dark:text-[#666d7c] hover:text-text-secondary">
          <GripVertical className="w-5 h-5" />
        </div>
        
        {/* Step number */}
        <div className="w-6 h-6 rounded-full bg-[#e1ddd8] dark:bg-[#262b35] flex items-center justify-center text-xs font-medium text-text-secondary">
          {index + 1}
        </div>
        
        {/* Icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        
        {/* Name & Type */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-primary dark:text-[#f5f5f8] truncate">
            {step.name || typeInfo.label}
          </p>
          <p className="text-xs text-text-secondary dark:text-[#b2b6c2]">
            {typeInfo.label}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditingStep(step)}
            className="p-2 hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            title="Edit step"
          >
            <Pencil className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
          </button>
          <button
            onClick={() => setStepToDelete(step)}
            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete step"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-8">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
          <span className="text-text-secondary dark:text-[#b2b6c2]">Loading steps...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Steps list */}
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#e1ddd8] dark:border-[#262b35] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </span>
            {isSaving && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            )}
          </div>
          <button
            onClick={() => window.open(`/onboarding/preview/${flowId}`, '_blank')}
            className="p-1.5 hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            title="Preview onboarding flow in new tab"
          >
            <ExternalLink className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
          </button>
        </div>

        {/* Steps (draggable) */}
        {steps.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-text-secondary dark:text-[#b2b6c2] text-sm">
              No steps yet. Add steps to build your onboarding flow.
            </p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={steps} onReorder={handleReorder}>
            {steps.map((step, index) => (
              <Reorder.Item key={step.id} value={step}>
                {renderStepRow(step, index)}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}

        {/* Add step button */}
        <div className="p-4">
          <button
            onClick={() => setShowAddStep(true)}
            className="w-full py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#363d4a] rounded-xl text-text-secondary dark:text-[#b2b6c2] hover:border-brand-accent hover:text-brand-accent transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>
      </div>

      {/* Add Step Modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {showAddStep && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
              onClick={(e) => e.target === e.currentTarget && setShowAddStep(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-[#171b22] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              >
                <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35] flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary dark:text-[#f5f5f8]">Add Step</h3>
                  <button
                    onClick={() => setShowAddStep(false)}
                    className="p-1 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-text-secondary" />
                  </button>
                </div>
                
                <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                  {ONBOARDING_STEP_TYPES.map((type) => {
                    const info = STEP_TYPE_INFO[type];
                    const Icon = info.icon;
                    
                    return (
                      <button
                        key={type}
                        onClick={() => handleAddStep(type)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#faf8f6] dark:hover:bg-[#1a1f27] transition-colors text-left"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${info.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-text-primary dark:text-[#f5f5f8]">
                            {info.label}
                          </p>
                          <p className="text-xs text-text-secondary dark:text-[#b2b6c2]">
                            {info.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Edit Step Modal - reuse StepConfigEditor from funnels */}
      {editingStep && (
        <StepConfigEditor
          step={{
            id: editingStep.id,
            funnelId: flowId,
            order: editingStep.order,
            type: editingStep.type,
            name: editingStep.name,
            config: editingStep.config,
            createdAt: editingStep.createdAt,
            updatedAt: editingStep.updatedAt,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any}
          onClose={() => setEditingStep(null)}
          onSave={handleSaveStepConfig}
        />
      )}

      {/* Delete Confirmation Modal */}
      {stepToDelete && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setStepToDelete(null)}
          onConfirm={handleDeleteStep}
          title="Delete Step"
          description={`Are you sure you want to delete "${stepToDelete.name || STEP_TYPE_INFO[stepToDelete.type].label}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="destructive"
        />
      )}
    </div>
  );
}

