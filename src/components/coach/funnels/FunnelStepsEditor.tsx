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
  Lock,
  PlayCircle,
  LayoutTemplate,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';
// Note: Lock is still used in the Add Step modal for tier-gated steps
import type { FunnelStep, FunnelStepType, CoachTier, Funnel, Program, Squad } from '@/types';
import { StepConfigEditor } from './StepConfigEditor';
import { canUseFunnelStep, TIER_PRICING } from '@/lib/coach-permissions';
import { DeleteConfirmationModal } from '@/components/feed/ConfirmationModal';
import { useStripeConnectStatus } from '@/hooks/useStripeConnectStatus';

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
    description: 'Single choice, multi-select, open question, and more',
    color: 'bg-blue-100 text-blue-600'
  },
  signup: { 
    icon: UserPlus, 
    label: 'Sign Up', 
    description: 'User signs in or creates an account',
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
  explainer: { 
    icon: PlayCircle, 
    label: 'Explainer', 
    description: 'Rich media with image, video, YouTube, or embed',
    color: 'bg-indigo-100 text-indigo-600'
  },
  landing_page: { 
    icon: LayoutTemplate, 
    label: 'Landing Page', 
    description: 'Full drag-and-drop landing page builder',
    color: 'bg-violet-100 text-violet-600'
  },
  upsell: { 
    icon: TrendingUp, 
    label: 'Upsell', 
    description: 'One-click offer after payment',
    color: 'bg-orange-100 text-orange-600'
  },
  downsell: { 
    icon: TrendingDown, 
    label: 'Downsell', 
    description: 'Alternative offer if upsell declined',
    color: 'bg-rose-100 text-rose-600'
  },
  info: { 
    icon: Info, 
    label: 'Info Card', 
    description: '[Legacy] Use Explainer instead',
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
const ADDABLE_STEP_TYPES: FunnelStepType[] = ['question', 'explainer', 'landing_page', 'goal_setting', 'identity', 'analyzing', 'plan_reveal', 'transformation', 'upsell', 'downsell'];

// Maximum allowed upsells and downsells per funnel
const MAX_UPSELLS = 2;
const MAX_DOWNSELLS = 2;

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
  
  // Delete confirmation modal
  const [stepToDelete, setStepToDelete] = useState<{id: string; type: FunnelStepType} | null>(null);
  
  // Stripe Connect status for payment step guard
  const { isConnected: stripeConnected, isLoading: stripeLoading } = useStripeConnectStatus();

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
    
    // Payment should come first (only if paid)
    if (!hasPayment && isPaid) {
      currentMaxOrder++;
      stepsToCreate.push({
        type: 'payment',
        config: { useProgramPricing: true },
        order: currentMaxOrder,
      });
    }
    
    // Signup should come after payment
    if (!hasSignup) {
      currentMaxOrder++;
      stepsToCreate.push({
        type: 'signup',
        config: { showSocialLogin: true },
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

  // Get all steps sorted by order, filtering out payment if not paid
  const sortableSteps = steps
    .filter(s => !(s.type === 'payment' && !isPaid))
    .sort((a, b) => a.order - b.order);

  const handleReorder = async (reorderedSteps: FunnelStep[]) => {
    // Validate upsell/downsell positioning - they must stay after payment step
    const paymentIndex = reorderedSteps.findIndex(s => s.type === 'payment');
    if (paymentIndex !== -1) {
      for (let i = 0; i < reorderedSteps.length; i++) {
        const step = reorderedSteps[i];
        if ((step.type === 'upsell' || step.type === 'downsell') && i <= paymentIndex) {
          // Upsell/downsell was moved before payment - reject the reorder
          // Reset to current order
          return;
        }
      }
    }
    
    // Save the full reordered list directly - all steps can be rearranged freely
    const stepsWithOrder = reorderedSteps.map((step, index) => ({
      id: step.id,
      order: index,
    }));
    
    // Optimistic update
    setSteps(reorderedSteps.map((s, i) => ({ ...s, order: i })));

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
      
      // Validate upsell/downsell limits
      if (type === 'upsell') {
        const existingUpsells = steps.filter(s => s.type === 'upsell').length;
        if (existingUpsells >= MAX_UPSELLS) {
          alert(`Maximum of ${MAX_UPSELLS} upsells allowed per funnel.`);
          setIsSaving(false);
          return;
        }
      }
      
      if (type === 'downsell') {
        const existingDownsells = steps.filter(s => s.type === 'downsell').length;
        if (existingDownsells >= MAX_DOWNSELLS) {
          alert(`Maximum of ${MAX_DOWNSELLS} downsells allowed per funnel.`);
          setIsSaving(false);
          return;
        }
        // Downsell requires at least one upsell
        const hasUpsell = steps.some(s => s.type === 'upsell');
        if (!hasUpsell) {
          alert('Add an upsell step first. Downsells are shown when a user declines an upsell.');
          setIsSaving(false);
          return;
        }
      }
      
      // Default config based on type
      const defaultConfig = getDefaultConfigForType(type);
      
      // For upsell/downsell, insert after payment step
      let insertOrder = sortableSteps.length;
      if (type === 'upsell' || type === 'downsell') {
        const paymentIndex = sortableSteps.findIndex(s => s.type === 'payment');
        if (paymentIndex !== -1) {
          // Find the last upsell/downsell step after payment
          const afterPaymentSteps = sortableSteps.slice(paymentIndex + 1);
          const lastUpsellDownsellIndex = afterPaymentSteps.findLastIndex(
            s => s.type === 'upsell' || s.type === 'downsell'
          );
          insertOrder = paymentIndex + 1 + (lastUpsellDownsellIndex !== -1 ? lastUpsellDownsellIndex + 1 : 0);
        }
      }

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

  const handleDeleteStep = (stepId: string, stepType: FunnelStepType) => {
    // Prevent deletion of fixed steps
    if (FIXED_STEP_TYPES.includes(stepType)) {
      alert('This step is required and cannot be deleted.');
      return;
    }
    
    // Open confirmation modal
    setStepToDelete({ id: stepId, type: stepType });
  };

  const executeDeleteStep = async () => {
    if (!stepToDelete) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/coach/org-funnels/${funnelId}/steps/${stepToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete step');
      await fetchSteps();
      setStepToDelete(null);
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

  const renderStepRow = (step: FunnelStep) => {
    const typeInfo = STEP_TYPE_INFO[step.type];
    const Icon = typeInfo?.icon || Info;
    const isRequired = FIXED_STEP_TYPES.includes(step.type);
    const isSignupStep = step.type === 'signup';

    return (
      <div className="p-4 bg-white hover:bg-[#faf8f6] transition-colors">
        <div className="flex items-center gap-4">
          {/* Drag handle - shown for all steps */}
          <div className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-5 h-5 text-text-muted" />
          </div>

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
              {isRequired && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#f5f3f0] text-text-muted rounded">
                  Required
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-text-secondary">
                {step.name ? typeInfo?.label : typeInfo?.description}
              </p>
              {/* Info tooltip for signup step */}
              {isSignupStep && (
                <div className="relative group/tooltip">
                  <Info className="w-3.5 h-3.5 text-text-muted cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-[#2c2520] text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 shadow-lg">
                    Existing users will sign in, new users will create an account.
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#2c2520]" />
                  </div>
                </div>
              )}
            </div>
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
            {!isRequired && (
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
      <div className="space-y-2 animate-pulse">
        <div className="bg-white border border-[#e1ddd8] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#e1ddd8] bg-[#faf8f6]">
            <div className="h-4 w-20 bg-[#e1ddd8]/50 rounded" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 border-b border-[#e1ddd8] last:border-b-0">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-[#e1ddd8]/50 rounded" />
                <div className="w-8 h-8 rounded-lg bg-[#e1ddd8]/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-[#e1ddd8]/50 rounded" />
                  <div className="h-3 w-24 bg-[#e1ddd8]/50 rounded" />
                </div>
                <div className="h-8 w-8 bg-[#e1ddd8]/50 rounded" />
              </div>
            </div>
          ))}
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
      {/* All steps list with drag and drop */}
      <div className="bg-white border border-[#e1ddd8] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#e1ddd8] bg-[#faf8f6]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">
              {sortableSteps.length} {sortableSteps.length === 1 ? 'step' : 'steps'}
            </span>
            {isSaving && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            )}
          </div>
        </div>

        {/* All steps (draggable) */}
        {sortableSteps.length === 0 ? (
          <div className="p-6 text-center border-b border-[#e1ddd8]">
            <p className="text-text-secondary text-sm">No steps yet. Add steps to build your funnel.</p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={sortableSteps} onReorder={handleReorder} className="divide-y divide-[#e1ddd8]">
            {sortableSteps.map((step) => (
              <Reorder.Item key={step.id} value={step}>
                {renderStepRow(step)}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}

        {/* Add step button */}
        <div className="p-4">
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
              className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
              onClick={(e) => e.target === e.currentTarget && setShowAddStep(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/10 dark:shadow-black/30"
              >
                <div className="p-6 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                  <h3 className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8]">Add Step</h3>
                  <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">Choose the type of step to add</p>
                </div>
                
                <div className="p-4 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
                  {/* Stripe Connect Warning for Payment Steps */}
                  {!stripeLoading && !stripeConnected && (
                    <div className="col-span-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 mb-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                            Stripe account required for payments
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                            Connect your Stripe account in Settings to add payment, upsell, or downsell steps.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {ADDABLE_STEP_TYPES.map((type) => {
                    const info = STEP_TYPE_INFO[type];
                    const Icon = info.icon;
                    const isAllowed = canUseFunnelStep(coachTier, type);
                    const requiredTier = !isAllowed ? 'pro' : null;
                    
                    // Check upsell/downsell limits and requirements
                    const existingUpsells = steps.filter(s => s.type === 'upsell').length;
                    const existingDownsells = steps.filter(s => s.type === 'downsell').length;
                    const hasPaymentStep = steps.some(s => s.type === 'payment');
                    const isMaxUpsells = type === 'upsell' && existingUpsells >= MAX_UPSELLS;
                    const isMaxDownsells = type === 'downsell' && existingDownsells >= MAX_DOWNSELLS;
                    const needsUpsellFirst = type === 'downsell' && existingUpsells === 0;
                    const needsPaymentStep = (type === 'upsell' || type === 'downsell') && !hasPaymentStep;
                    
                    // Payment-related steps require Stripe to be connected
                    const isPaymentRelated = type === 'upsell' || type === 'downsell';
                    const needsStripe = isPaymentRelated && !stripeConnected && !stripeLoading;
                    
                    const isLimitReached = isMaxUpsells || isMaxDownsells || needsUpsellFirst || needsPaymentStep || needsStripe;
                    
                    return (
                      <button
                        key={type}
                        onClick={() => isAllowed && !isLimitReached && handleAddStep(type)}
                        disabled={isSaving || !isAllowed || isLimitReached}
                        className={`p-4 border rounded-xl transition-colors text-left relative ${
                          isAllowed && !isLimitReached
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
                        {needsStripe && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 rounded text-[10px] font-medium text-amber-600">
                            <AlertTriangle className="w-3 h-3" />
                            Stripe
                          </div>
                        )}
                        {isMaxUpsells && !needsStripe && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-orange-100 rounded text-[10px] font-medium text-orange-600">
                            Max {MAX_UPSELLS}
                          </div>
                        )}
                        {isMaxDownsells && !needsStripe && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-rose-100 rounded text-[10px] font-medium text-rose-600">
                            Max {MAX_DOWNSELLS}
                          </div>
                        )}
                        {needsUpsellFirst && !needsStripe && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-100 rounded text-[10px] font-medium text-amber-600">
                            Add upsell first
                          </div>
                        )}
                        {needsPaymentStep && !needsStripe && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-blue-100 rounded text-[10px] font-medium text-blue-600">
                            Payment required
                          </div>
                        )}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${info.color} ${!isAllowed || isLimitReached ? 'opacity-50' : ''}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <p className={`font-medium text-sm ${isAllowed && !isLimitReached ? 'text-text-primary' : 'text-text-secondary'}`}>{info.label}</p>
                        <p className="text-xs text-text-muted">{info.description}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                  <button
                    onClick={() => setShowAddStep(false)}
                    className="w-full py-2 text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
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

      {/* Delete Step Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!stepToDelete}
        onClose={() => setStepToDelete(null)}
        onConfirm={executeDeleteStep}
        itemName="step"
        isLoading={isSaving}
      />
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
    case 'upsell':
      return {
        headline: 'Wait! Special One-Time Offer',
        description: 'Get exclusive access to additional content and resources.',
        ctaText: 'Add to Order',
        declineText: 'No thanks, skip this offer',
        discountType: 'none',
        isRecurring: false,
      };
    case 'downsell':
      return {
        headline: 'Before You Go...',
        description: 'Here\'s a special offer just for you.',
        ctaText: 'Yes, I Want This Deal!',
        declineText: 'No thanks, I\'ll pass',
        discountType: 'percent',
        discountValue: 20,
        isRecurring: false,
      };
    default:
      return {};
  }
}
