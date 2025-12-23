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
  UserPlus,
  CreditCard,
  Target,
  User,
  Loader2,
  Sparkles,
  Info,
  CheckCircle,
  Lock
} from 'lucide-react';
import type { FunnelStep, FunnelStepType, CoachTier } from '@/types';
import { StepConfigEditor } from './StepConfigEditor';
import { canUseFunnelStep, TIER_PRICING } from '@/lib/coach-permissions';

interface FunnelStepsEditorProps {
  funnelId: string;
  onBack: () => void;
}

const STEP_TYPE_INFO: Record<FunnelStepType, { 
  icon: React.ElementType; 
  label: string; 
  description: string;
  color: string;
}> = {
  question: { 
    icon: MessageSquare, 
    label: 'Question', 
    description: 'Ask the user a question',
    color: 'bg-blue-100 text-blue-600'
  },
  signup: { 
    icon: UserPlus, 
    label: 'Sign Up', 
    description: 'User creates an account',
    color: 'bg-green-100 text-green-600'
  },
  payment: { 
    icon: CreditCard, 
    label: 'Payment', 
    description: 'Collect payment',
    color: 'bg-yellow-100 text-yellow-600'
  },
  goal_setting: { 
    icon: Target, 
    label: 'Goal Setting', 
    description: 'User sets their goal',
    color: 'bg-purple-100 text-purple-600'
  },
  identity: { 
    icon: User, 
    label: 'Identity', 
    description: 'User defines their identity',
    color: 'bg-pink-100 text-pink-600'
  },
  analyzing: { 
    icon: Loader2, 
    label: 'Analyzing', 
    description: 'Show loading animation',
    color: 'bg-gray-100 text-gray-600'
  },
  plan_reveal: { 
    icon: Sparkles, 
    label: 'Plan Reveal', 
    description: 'Show personalized plan',
    color: 'bg-amber-100 text-amber-600'
  },
  transformation: { 
    icon: Sparkles, 
    label: 'Transformation', 
    description: 'Show transformation graph',
    color: 'bg-amber-100 text-amber-600'
  },
  info: { 
    icon: Info, 
    label: 'Info Card', 
    description: 'Display information',
    color: 'bg-cyan-100 text-cyan-600'
  },
  success: { 
    icon: CheckCircle, 
    label: 'Success', 
    description: 'Completion celebration',
    color: 'bg-emerald-100 text-emerald-600'
  },
};

export function FunnelStepsEditor({ funnelId, onBack }: FunnelStepsEditorProps) {
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Portal mounting state
  const [mounted, setMounted] = useState(false);
  
  // Add step dialog
  const [showAddStep, setShowAddStep] = useState(false);
  
  // Edit step
  const [editingStep, setEditingStep] = useState<FunnelStep | null>(null);
  
  // Coach tier for permission checks
  const [coachTier, setCoachTier] = useState<CoachTier>('starter');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Fetch coach tier
  useEffect(() => {
    async function fetchTier() {
      try {
        const response = await fetch('/api/coach/subscription');
        if (response.ok) {
          const data = await response.json();
          setCoachTier(data.tier || 'starter');
        }
      } catch (err) {
        console.error('Failed to fetch coach tier:', err);
      }
    }
    fetchTier();
  }, []);

  const fetchSteps = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/coach/org-funnels/${funnelId}/steps`);
      if (!response.ok) throw new Error('Failed to fetch steps');
      const data = await response.json();
      setSteps(data.steps || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load steps');
    } finally {
      setIsLoading(false);
    }
  }, [funnelId]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  const handleReorder = async (reorderedSteps: FunnelStep[]) => {
    // Optimistic update
    setSteps(reorderedSteps);

    // Save new order
    try {
      setIsSaving(true);
      const stepsWithOrder = reorderedSteps.map((step, index) => ({
        id: step.id,
        order: index,
      }));

      const response = await fetch(`/api/coach/org-funnels/${funnelId}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: stepsWithOrder }),
      });

      if (!response.ok) throw new Error('Failed to save order');
    } catch (err) {
      console.error('Failed to reorder:', err);
      // Refetch to reset
      fetchSteps();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStep = async (type: FunnelStepType) => {
    try {
      setIsSaving(true);
      
      // Default config based on type
      const defaultConfig = getDefaultConfigForType(type);

      const response = await fetch(`/api/coach/org-funnels/${funnelId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config: defaultConfig }),
      });

      if (!response.ok) throw new Error('Failed to add step');
      
      setShowAddStep(false);
      await fetchSteps();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add step');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Are you sure you want to delete this step?')) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/coach/org-funnels/${funnelId}/steps/${stepId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete step');
      await fetchSteps();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete step');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStepConfig = async (stepId: string, config: unknown, name?: string) => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/coach/org-funnels/${funnelId}/steps/${stepId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, name }),
      });

      if (!response.ok) throw new Error('Failed to save step');
      
      setEditingStep(null);
      await fetchSteps();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save step');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="relative">
          <div className="w-8 h-8 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Steps list with drag and drop */}
      <div className="bg-white border border-[#e1ddd8] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#e1ddd8] bg-[#faf8f6]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">
              {steps.length} {steps.length === 1 ? 'step' : 'steps'}
            </span>
            {isSaving && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            )}
          </div>
        </div>

        {steps.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-text-secondary mb-4">No steps yet. Add your first step to get started.</p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={steps} onReorder={handleReorder} className="divide-y divide-[#e1ddd8]">
            {steps.map((step) => {
              const typeInfo = STEP_TYPE_INFO[step.type];
              const Icon = typeInfo?.icon || Info;

              return (
                <Reorder.Item key={step.id} value={step} className="p-4 bg-white hover:bg-[#faf8f6] transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Drag handle */}
                    <div className="cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-5 h-5 text-text-muted" />
                    </div>

                    {/* Step icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo?.color || 'bg-gray-100 text-gray-600'}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Step info */}
                    <div className="flex-1">
                      <p className="font-medium text-text-primary">
                        {step.name || typeInfo?.label || step.type}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {step.name ? typeInfo?.label : typeInfo?.description}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingStep(step)}
                        className="p-2 hover:bg-[#e1ddd8] rounded-lg transition-colors"
                        title="Edit configuration"
                      >
                        <Pencil className="w-4 h-4 text-text-secondary" />
                      </button>
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete step"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        )}

        {/* Add step button */}
        <div className="p-4 border-t border-[#e1ddd8]">
          <button
            onClick={() => setShowAddStep(true)}
            className="w-full py-3 border-2 border-dashed border-[#e1ddd8] rounded-xl text-text-secondary hover:border-[#a07855] hover:text-[#a07855] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>
      </div>

      {/* Preview link */}
      <div className="p-4 bg-[#faf8f6] rounded-xl border border-[#e1ddd8]">
        <p className="text-sm text-text-secondary">
          Preview your funnel by visiting the join link. Changes are saved automatically.
        </p>
      </div>

      {/* Add Step Modal - rendered via portal to escape stacking context */}
      {mounted && createPortal(
        <AnimatePresence>
          {showAddStep && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
              onClick={(e) => e.target === e.currentTarget && setShowAddStep(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl w-full max-w-md shadow-xl"
              >
                <div className="p-6 border-b border-[#e1ddd8]">
                  <h3 className="text-lg font-semibold text-text-primary">Add Step</h3>
                  <p className="text-sm text-text-secondary">Choose the type of step to add</p>
                </div>
                
                <div className="p-4 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
                  {(Object.keys(STEP_TYPE_INFO) as FunnelStepType[]).map((type) => {
                    const info = STEP_TYPE_INFO[type];
                    const Icon = info.icon;
                    const isAllowed = canUseFunnelStep(coachTier, type);
                    const requiredTier = !isAllowed ? 'pro' : null;
                    
                    return (
                      <button
                        key={type}
                        onClick={() => isAllowed && handleAddStep(type)}
                        disabled={isSaving || !isAllowed}
                        className={`p-4 border rounded-xl transition-colors text-left relative ${
                          isAllowed 
                            ? 'border-[#e1ddd8] hover:border-[#a07855] hover:bg-[#faf8f6] disabled:opacity-50'
                            : 'border-[#e1ddd8] bg-[#fafafa] cursor-not-allowed opacity-70'
                        }`}
                      >
                        {!isAllowed && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-[#f5f2ed] rounded text-[10px] font-medium text-text-secondary">
                            <Lock className="w-3 h-3" />
                            {TIER_PRICING[requiredTier as CoachTier]?.name}
                          </div>
                        )}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${info.color} ${!isAllowed ? 'opacity-50' : ''}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <p className={`font-medium text-sm ${isAllowed ? 'text-text-primary' : 'text-text-secondary'}`}>{info.label}</p>
                        <p className="text-xs text-text-muted">{info.description}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-[#e1ddd8]">
                  <button
                    onClick={() => setShowAddStep(false)}
                    className="w-full py-2 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Edit Step Config Modal */}
      {editingStep && (
        <StepConfigEditor
          step={editingStep}
          onClose={() => setEditingStep(null)}
          onSave={(config, name) => handleSaveStepConfig(editingStep.id, config, name)}
        />
      )}
    </div>
  );
}

function getDefaultConfigForType(type: FunnelStepType): unknown {
  switch (type) {
    case 'question':
      return {
        questionType: 'single_choice',
        question: 'Your question here',
        fieldName: 'answer',
        options: [
          { id: '1', label: 'Option 1', value: 'option_1', order: 0 },
          { id: '2', label: 'Option 2', value: 'option_2', order: 1 },
        ],
      };
    case 'signup':
      return {
        showSocialLogin: true,
      };
    case 'payment':
      return {
        useProgramPricing: true,
      };
    case 'goal_setting':
      return {
        examples: ['grow to 10k followers', 'make $1,000 from content'],
        timelineDays: 90,
      };
    case 'identity':
      return {
        examples: ['someone who brings value to others', 'a disciplined creator'],
      };
    case 'analyzing':
      return {
        durationMs: 3000,
        messages: ['Analyzing your responses...', 'Building your personalized plan...'],
      };
    case 'plan_reveal':
    case 'transformation':
      return {
        showGraph: true,
      };
    case 'info':
      return {
        heading: 'Welcome',
        body: 'This is an information step.',
      };
    case 'success':
      return {
        showConfetti: true,
        redirectDelay: 3000,
      };
    default:
      return {};
  }
}

