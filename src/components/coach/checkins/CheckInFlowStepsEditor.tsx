'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Pencil,
  SmilePlus,
  MessageSquare,
  CheckSquare,
  ListChecks,
  Wind,
  Brain,
  Sparkles,
  Eye,
  Target,
  Trophy,
  FileText,
  Loader2,
  Info
} from 'lucide-react';
import type { CheckInStep, CheckInStepType, OrgCheckInFlow } from '@/types';
import { CheckInStepConfigEditor } from './CheckInStepConfigEditor';
import { DeleteConfirmationModal } from '@/components/feed/ConfirmationModal';

interface CheckInFlowStepsEditorProps {
  flowId: string;
  isSystemDefault?: boolean;
  onBack: () => void;
}

const STEP_TYPE_INFO: Record<CheckInStepType, { 
  icon: React.ElementType; 
  label: string; 
  description: string;
  color: string;
}> = {
  mood_scale: { 
    icon: SmilePlus, 
    label: 'Mood Scale', 
    description: 'Emotional state or on-track slider',
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
  },
  single_select: { 
    icon: MessageSquare, 
    label: 'Single Select', 
    description: 'Single choice question',
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
  },
  multi_select: { 
    icon: CheckSquare, 
    label: 'Multi Select', 
    description: 'Multiple choice question',
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
  },
  open_text: { 
    icon: FileText, 
    label: 'Open Text', 
    description: 'Free-form journal/reflection',
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
  },
  task_planner: { 
    icon: ListChecks, 
    label: 'Task Planner', 
    description: 'Plan your day tasks',
    color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
  },
  task_review: { 
    icon: CheckSquare, 
    label: 'Task Review', 
    description: 'Review task completion',
    color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400'
  },
  breathing: { 
    icon: Wind, 
    label: 'Breathing', 
    description: 'Guided breathing exercise',
    color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400'
  },
  ai_reframe_input: { 
    icon: Brain, 
    label: 'AI Reframe Input', 
    description: 'User thought input for AI',
    color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
  },
  ai_reframe_output: { 
    icon: Sparkles, 
    label: 'AI Reframe Output', 
    description: 'AI response display',
    color: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400'
  },
  visualization: { 
    icon: Eye, 
    label: 'Visualization', 
    description: 'Manifestation with goal & identity',
    color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'
  },
  progress_scale: { 
    icon: Target, 
    label: 'Progress Scale', 
    description: 'Weekly progress slider (0-100%)',
    color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
  },
  completion: { 
    icon: Trophy, 
    label: 'Completion', 
    description: 'End screen with celebration',
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
  },
  goal_achieved: { 
    icon: Trophy, 
    label: 'Goal Achieved', 
    description: 'Conditional end when goal is 100%',
    color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
  },
  explainer: { 
    icon: Info, 
    label: 'Explainer', 
    description: 'Text with optional media',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'
  },
};

// Step types available for adding
const ADDABLE_STEP_TYPES: CheckInStepType[] = [
  'mood_scale',
  'single_select',
  'multi_select',
  'open_text',
  'task_planner',
  'task_review',
  'breathing',
  'ai_reframe_input',
  'ai_reframe_output',
  'visualization',
  'progress_scale',
  'explainer',
  'completion',
  'goal_achieved',
];

// Steps that should typically be at the end
const END_STEP_TYPES: CheckInStepType[] = ['completion', 'goal_achieved'];

export function CheckInFlowStepsEditor({ flowId, isSystemDefault = false, onBack }: CheckInFlowStepsEditorProps) {
  const [steps, setSteps] = useState<CheckInStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Flow metadata
  const [flow, setFlow] = useState<OrgCheckInFlow | null>(null);
  
  // Portal mounting state
  const [mounted, setMounted] = useState(false);
  
  // Add step dialog
  const [showAddStep, setShowAddStep] = useState(false);
  
  // Edit step
  const [editingStep, setEditingStep] = useState<CheckInStep | null>(null);
  
  // Delete confirmation modal
  const [stepToDelete, setStepToDelete] = useState<{id: string; type: CheckInStepType} | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const fetchFlow = useCallback(async () => {
    try {
      const response = await fetch(`/api/coach/org-checkin-flows/${flowId}`);
      if (!response.ok) throw new Error('Failed to fetch flow');
      const data = await response.json();
      setFlow(data.flow);
    } catch (err) {
      console.error('Failed to fetch flow:', err);
    }
  }, [flowId]);

  const fetchSteps = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/coach/org-checkin-flows/${flowId}/steps`);
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
    fetchFlow();
    fetchSteps();
  }, [fetchFlow, fetchSteps]);

  // Get all steps sorted by order
  const sortableSteps = steps.sort((a, b) => a.order - b.order);

  const handleReorder = async (reorderedSteps: CheckInStep[]) => {
    // Validate completion step must remain last
    const completionIndex = reorderedSteps.findIndex(s => 
      s.type === 'completion' || s.type === 'goal_achieved'
    );
    if (completionIndex !== -1 && completionIndex !== reorderedSteps.length - 1) {
      // Completion step is not last - reject the reorder
      return;
    }
    
    // Save the full reordered list
    const stepsWithOrder = reorderedSteps.map((step, index) => ({
      id: step.id,
      order: index,
    }));
    
    // Optimistic update
    setSteps(reorderedSteps.map((s, i) => ({ ...s, order: i })));

    try {
      setIsSaving(true);
      const response = await fetch(`/api/coach/org-checkin-flows/${flowId}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: stepsWithOrder }),
      });

      if (!response.ok) throw new Error('Failed to save order');
    } catch (err) {
      console.error('Failed to reorder:', err);
      fetchSteps();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStep = async (type: CheckInStepType) => {
    try {
      setIsSaving(true);
      
      // Default config based on type
      const defaultConfig = getDefaultConfigForType(type);
      
      // Find completion step - new steps must be inserted before it
      const completionIndex = sortableSteps.findIndex(s => 
        s.type === 'completion' || s.type === 'goal_achieved'
      );
      
      // Default: insert before completion step (or at end if no completion step)
      let insertOrder = completionIndex !== -1 ? completionIndex : sortableSteps.length;
      
      // If this IS a completion-type step, put it at the end
      if (END_STEP_TYPES.includes(type)) {
        insertOrder = sortableSteps.length;
      }

      const response = await fetch(`/api/coach/org-checkin-flows/${flowId}/steps`, {
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

  const handleDeleteStep = (stepId: string, stepType: CheckInStepType) => {
    setStepToDelete({ id: stepId, type: stepType });
  };

  const executeDeleteStep = async () => {
    if (!stepToDelete) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/coach/org-checkin-flows/${flowId}/steps/${stepToDelete.id}`, {
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
      const response = await fetch(`/api/coach/org-checkin-flows/${flowId}/steps/${stepId}`, {
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

  const handleToggleStepEnabled = async (stepId: string, currentEnabled: boolean) => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/coach/org-checkin-flows/${flowId}/steps/${stepId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (!response.ok) throw new Error('Failed to toggle step');
      await fetchSteps();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle step');
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepRow = (step: CheckInStep) => {
    const typeInfo = STEP_TYPE_INFO[step.type];
    const Icon = typeInfo?.icon || Info;
    const isDisabled = step.enabled === false;

    return (
      <div className={`p-4 bg-white dark:bg-[#171b22] hover:bg-[#faf8f6] dark:hover:bg-[#1a1f28] transition-colors ${isDisabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-4">
          {/* Drag handle */}
          <div className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-5 h-5 text-text-muted dark:text-[#666d7c]" />
          </div>

          {/* Step icon */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo?.color || 'bg-gray-100 text-gray-600'}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* Step info */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-text-primary dark:text-[#f5f5f8]">
                {step.name || typeInfo?.label || step.type}
              </p>
              {step.conditions && step.conditions.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                  Conditional
                </span>
              )}
              {isDisabled && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
              {step.name ? typeInfo?.label : typeInfo?.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingStep(step)}
              className="p-2 hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              title="Edit configuration"
            >
              <Pencil className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
            {isSystemDefault ? (
              /* Enable/Disable Toggle for default flows */
              <button
                onClick={() => handleToggleStepEnabled(step.id, step.enabled !== false)}
                className={`
                  relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
                  ${step.enabled !== false
                    ? 'bg-[#4CAF50]' 
                    : 'bg-[#d1cec9] dark:bg-[#3d4351]'
                  }
                `}
                title={step.enabled !== false ? 'Disable step' : 'Enable step'}
              >
                <span className={`
                  absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                  ${step.enabled !== false ? 'left-[22px]' : 'left-0.5'}
                `} />
              </button>
            ) : (
              /* Delete button for custom flows */
              <button
                onClick={() => handleDeleteStep(step.id, step.type)}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
            <div className="h-4 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35] last:border-b-0">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="w-8 h-8 rounded-lg bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                  <div className="h-3 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                </div>
                <div className="h-8 w-8 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* All steps list with drag and drop */}
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
              {sortableSteps.length} {sortableSteps.length === 1 ? 'step' : 'steps'}
            </span>
            {isSaving && (
              <span className="text-xs text-text-muted dark:text-[#666d7c] flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            )}
          </div>
        </div>

        {/* All steps (draggable) */}
        {sortableSteps.length === 0 ? (
          <div className="p-6 text-center border-b border-[#e1ddd8] dark:border-[#262b35]">
            <p className="text-text-secondary dark:text-[#b2b6c2] text-sm">No steps yet. Add steps to build your check-in flow.</p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={sortableSteps} onReorder={handleReorder} className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
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
            className="w-full py-3 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-secondary dark:text-[#b2b6c2] hover:border-[#a07855] dark:border-[#b8896a] hover:text-[#a07855] dark:text-[#b8896a] dark:hover:border-[#b8896a] dark:hover:text-[#b8896a] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>
      </div>

      {/* Tip */}
      <div className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
        <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
          Drag steps to reorder. Changes are saved automatically.
        </p>
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
                className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/10 dark:shadow-black/30"
              >
                <div className="p-6 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                  <h3 className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8]">Add Step</h3>
                  <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">Choose the type of step to add</p>
                </div>
                
                <div className="p-4 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
                  {ADDABLE_STEP_TYPES.map((type) => {
                    const info = STEP_TYPE_INFO[type];
                    const Icon = info.icon;
                    
                    return (
                      <button
                        key={type}
                        onClick={() => handleAddStep(type)}
                        disabled={isSaving}
                        className="p-4 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:border-[#a07855] dark:border-[#b8896a] dark:hover:border-[#b8896a] hover:bg-[#faf8f6] dark:hover:bg-[#1a1f28] transition-colors text-left disabled:opacity-50"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${info.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <p className="font-medium text-sm text-text-primary dark:text-[#f5f5f8]">{info.label}</p>
                        <p className="text-xs text-text-muted dark:text-[#666d7c]">{info.description}</p>
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
        <CheckInStepConfigEditor
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

function getDefaultConfigForType(type: CheckInStepType): unknown {
  switch (type) {
    case 'mood_scale':
      return {
        question: 'How are you feeling today?',
        scaleType: 'emotional_state',
        options: [
          { value: 'low_stuck', label: 'Low / Stuck' },
          { value: 'uneasy', label: 'Uneasy' },
          { value: 'uncertain', label: 'Uncertain' },
          { value: 'neutral', label: 'Neutral' },
          { value: 'steady', label: 'Steady' },
          { value: 'confident', label: 'Confident' },
          { value: 'energized', label: 'Energized' },
        ],
      };
    case 'single_select':
      return {
        question: 'Your question here',
        options: [
          { id: '1', label: 'Option 1', value: 'option_1' },
          { id: '2', label: 'Option 2', value: 'option_2' },
        ],
        fieldName: 'answer',
      };
    case 'multi_select':
      return {
        question: 'Select all that apply',
        options: [
          { id: '1', label: 'Option 1', value: 'option_1' },
          { id: '2', label: 'Option 2', value: 'option_2' },
        ],
        fieldName: 'selections',
      };
    case 'open_text':
      return {
        question: 'Write your thoughts...',
        placeholder: 'Start typing...',
        fieldName: 'reflection',
        isRequired: false,
      };
    case 'task_planner':
      return {
        heading: 'Plan your day',
        description: 'What do you want to accomplish today?',
        showProgramTasks: true,
        allowAddTasks: true,
        showBacklog: true,
      };
    case 'task_review':
      return {
        heading: 'How did you do today?',
        completedMessage: 'Amazing! You completed all your tasks! 🎉',
        partialMessage: 'Great effort! Every step counts.',
        noTasksMessage: 'No tasks were planned for today.',
      };
    case 'breathing':
      return {
        heading: 'Take a moment to breathe',
        description: 'Follow the circle to calm your mind',
        pattern: { inhale: 4, hold: 2, exhale: 6 },
        cycles: 3,
      };
    case 'ai_reframe_input':
      return {
        heading: 'What\'s on your mind?',
        placeholder: 'Share any thoughts or worries...',
      };
    case 'ai_reframe_output':
      return {
        heading: 'Here\'s a different perspective',
        loadingMessage: 'Thinking...',
      };
    case 'visualization':
      return {
        heading: 'Visualize your success',
        showGoal: true,
        showIdentity: true,
        durationSeconds: 60,
      };
    case 'progress_scale':
      return {
        question: 'How close are you to achieving your goal?',
        description: 'Move the slider to indicate your progress',
        showGoal: true,
        goalAchievedThreshold: 100,
      };
    case 'completion':
      return {
        heading: 'Great job! ✨',
        subheading: 'You\'ve completed your check-in',
        showConfetti: true,
        buttonText: 'Continue',
        variant: 'great_job',
      };
    case 'goal_achieved':
      return {
        heading: 'Goal achieved! 🎉',
        description: 'Congratulations on reaching your goal!',
        showCreateNewGoal: true,
        showSkipOption: true,
      };
    case 'explainer':
      return {
        heading: 'Welcome',
        body: 'This is an information step.',
      };
    default:
      return {};
  }
}

