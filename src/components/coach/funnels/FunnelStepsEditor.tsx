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
import type { FunnelStep, FunnelStepType, CoachTier, Funnel, Program, Squad } from '@/types';
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

// Fixed/required step types
const FIXED_STEP_TYPES: FunnelStepType[] = ['signup', 'payment', 'success'];

// Step types available for adding (exclude fixed types)
const ADDABLE_STEP_TYPES: FunnelStepType[] = ['question', 'goal_setting', 'identity', 'analyzing', 'plan_reveal', 'transformation', 'info'];

export function FunnelStepsEditor({ funnelId, onBack }: FunnelStepsEditorProps) {
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Funnel metadata (to determine if program/squad is paid)
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  
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

  // Fetch funnel metadata to determine if paid
  const fetchFunnelMetadata = useCallback(async () => {
    try {
      const response = await fetch(`/api/coach/org-funnels/${funnelId}`);
      if (!response.ok) throw new Error('Failed to fetch funnel');
      const data = await response.json();
      setFunnel(data.funnel);
      
      // Check if program or squad is paid
      if (data.funnel?.programId) {
        const programRes = await fetch(`/api/coach/org-programs/${data.funnel.programId}`);
        if (programRes.ok) {
          const programData = await programRes.json();
          setIsPaid((programData.program?.priceInCents || 0) > 0);
        }
      } else if (data.funnel?.squadId) {
        // For squad funnels, check if squad has a price
        const squadRes = await fetch(`/api/coach/org-squads/${data.funnel.squadId}`);
        if (squadRes.ok) {
          const squadData = await squadRes.json();
          setIsPaid((squadData.squad?.priceInCents || 0) > 0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch funnel metadata:', err);
    }
  }, [funnelId]);

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

  // Ensure required steps exist
  const ensureRequiredSteps = useCallback(async (currentSteps: FunnelStep[]) => {
    const hasSignup = currentSteps.some(s => s.type === 'signup');
    const hasPayment = currentSteps.some(s => s.type === 'payment');
    const hasSuccess = currentSteps.some(s => s.type === 'success');
    
    const stepsToCreate: { type: FunnelStepType; config: unknown; order: number }[] = [];
    let currentMaxOrder = Math.max(...currentSteps.map(s => s.order), -1);
    
    // Signup should come before payment and success
    if (!hasSignup) {
      currentMaxOrder++;
      stepsToCreate.push({
        type: 'signup',
        config: { showSocialLogin: true },
        order: currentMaxOrder,
      });
    }
    
    // Payment should come after signup (only if paid)
    if (!hasPayment && isPaid) {
      currentMaxOrder++;
      stepsToCreate.push({
        type: 'payment',
        config: { useProgramPricing: true },
        order: currentMaxOrder,
      });
    }
    
    // Success should be last
    if (!hasSuccess) {
      currentMaxOrder++;
      stepsToCreate.push({
        type: 'success',
        config: { showConfetti: true, redirectDelay: 3000 },
        order: currentMaxOrder,
      });
    }
    
    if (stepsToCreate.length > 0) {
      try {
        for (const step of stepsToCreate) {
          await fetch(`/api/coach/org-funnels/${funnelId}/steps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(step),
          });
        }
        // Refetch steps after creating required ones
        await fetchSteps();
      } catch (err) {
        console.error('Failed to create required steps:', err);
      }
    }
  }, [funnelId, isPaid, fetchSteps]);

  useEffect(() => {
    fetchFunnelMetadata();
    fetchSteps();
  }, [fetchFunnelMetadata, fetchSteps]);

  // Ensure required steps exist after initial load
  useEffect(() => {
    if (!isLoading && steps.length >= 0 && funnel) {
      ensureRequiredSteps(steps);
    }
  }, [isLoading, funnel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Separate fixed and custom steps
  const fixedSteps = steps.filter(s => FIXED_STEP_TYPES.includes(s.type));
  const customSteps = steps.filter(s => !FIXED_STEP_TYPES.includes(s.type));

  const handleReorder = async (reorderedCustomSteps: FunnelStep[]) => {
    // Reconstruct full step list: custom steps + fixed steps at their positions
    // Fixed steps maintain their relative positions (signup before payment before success)
    const signupStep = fixedSteps.find(s => s.type === 'signup');
    const paymentStep = fixedSteps.find(s => s.type === 'payment');
    const successStep = fixedSteps.find(s => s.type === 'success');
    
    // Build final order: custom steps, then signup, then payment (if paid), then success
    const finalSteps: FunnelStep[] = [
      ...reorderedCustomSteps,
    ];
    
    if (signupStep) finalSteps.push(signupStep);
    if (paymentStep && isPaid) finalSteps.push(paymentStep);
    if (successStep) finalSteps.push(successStep);
    
    // Assign new order values
    const stepsWithOrder = finalSteps.map((step, index) => ({
      id: step.id,
      order: index,
    }));
    
    // Optimistic update
    setSteps(finalSteps.map((s, i) => ({ ...s, order: i })));

    // Save new order
    try {
      setIsSaving(true);
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
      
      // Insert before fixed steps (signup, payment, success)
      const insertOrder = customSteps.length;

      const response = await fetch(`/api/coach/org-funnels/${funnelId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config: defaultConfig, order: insertOrder }),
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

  const handleDeleteStep = async (stepId: string, stepType: FunnelStepType) => {
    // Prevent deletion of fixed steps
    if (FIXED_STEP_TYPES.includes(stepType)) {
      alert('This step is required and cannot be deleted.');
      return;
    }
    
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

  const renderStepRow = (step: FunnelStep, isFixed: boolean, showDragHandle: boolean = true) => {
    const typeInfo = STEP_TYPE_INFO[step.type];
    const Icon = typeInfo?.icon || Info;
    
    // Don't show payment step if not paid
    if (step.type === 'payment' && !isPaid) {
      return null;
    }

    return (
      <div className={`p-4 bg-white hover:bg-[#faf8f6] transition-colors ${isFixed ? 'border-l-2 border-l-[#a07855]/30' : ''}`}>
        <div className="flex items-center gap-4">
          {/* Drag handle or lock icon */}
          {showDragHandle && !isFixed ? (
            <div className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-5 h-5 text-text-muted" />
            </div>
          ) : (
            <div className="w-5 flex items-center justify-center">
              <Lock className="w-4 h-4 text-text-muted/50" />
            </div>
          )}

          {/* Step icon */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo?.color || 'bg-gray-100 text-gray-600'}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* Step info */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-text-primary">
                {step.name || typeInfo?.label || step.type}
              </p>
              {isFixed && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#f5f3f0] text-text-muted rounded">
                  Required
                </span>
              )}
            </div>
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
            {!isFixed && (
              <button
                onClick={() => handleDeleteStep(step.id, step.type)}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete step"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
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

  // Get fixed steps in correct order
  const signupStep = fixedSteps.find(s => s.type === 'signup');
  const paymentStep = fixedSteps.find(s => s.type === 'payment');
  const successStep = fixedSteps.find(s => s.type === 'success');

  return (
    <div className="space-y-6">
      {/* Custom steps list with drag and drop */}
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

        {/* Custom steps (draggable) */}
        {customSteps.length === 0 ? (
          <div className="p-6 text-center border-b border-[#e1ddd8]">
            <p className="text-text-secondary text-sm">No custom steps yet. Add questions or other steps above the required steps.</p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={customSteps} onReorder={handleReorder} className="divide-y divide-[#e1ddd8]">
            {customSteps.map((step) => (
              <Reorder.Item key={step.id} value={step}>
                {renderStepRow(step, false, true)}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}

        {/* Add step button */}
        <div className="p-4 border-b border-[#e1ddd8]">
          <button
            onClick={() => setShowAddStep(true)}
            className="w-full py-3 border-2 border-dashed border-[#e1ddd8] rounded-xl text-text-secondary hover:border-[#a07855] hover:text-[#a07855] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>

        {/* Fixed/Required steps section */}
        <div className="bg-[#faf8f6]/50">
          <div className="px-4 py-2 border-b border-[#e1ddd8]">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Required Steps</p>
          </div>
          <div className="divide-y divide-[#e1ddd8]">
            {signupStep && renderStepRow(signupStep, true, false)}
            {isPaid && paymentStep && renderStepRow(paymentStep, true, false)}
            {successStep && renderStepRow(successStep, true, false)}
          </div>
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
                  {ADDABLE_STEP_TYPES.map((type) => {
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
