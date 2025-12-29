'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import type { CheckInStep, CheckInStepType } from '@/types';

interface CheckInStepConfigEditorProps {
  step: CheckInStep;
  onClose: () => void;
  onSave: (config: unknown, name?: string) => void;
}

export function CheckInStepConfigEditor({ step, onClose, onSave }: CheckInStepConfigEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(step.name || '');
  const [config, setConfig] = useState<Record<string, unknown>>(() => {
    // Extract config from the step's config object
    const stepConfig = step.config as { type: string; config: Record<string, unknown> };
    return stepConfig?.config || {};
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(config, name || undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const renderConfigFields = () => {
    switch (step.type) {
      case 'mood_scale':
        return <MoodScaleConfig config={config} updateConfig={updateConfig} />;
      case 'single_select':
      case 'multi_select':
        return <SelectConfig config={config} updateConfig={updateConfig} isMulti={step.type === 'multi_select'} />;
      case 'open_text':
        return <OpenTextConfig config={config} updateConfig={updateConfig} />;
      case 'task_planner':
        return <TaskPlannerConfig config={config} updateConfig={updateConfig} />;
      case 'task_review':
        return <TaskReviewConfig config={config} updateConfig={updateConfig} />;
      case 'breathing':
        return <BreathingConfig config={config} updateConfig={updateConfig} />;
      case 'ai_reframe_input':
      case 'ai_reframe_output':
        return <AIReframeConfig config={config} updateConfig={updateConfig} isOutput={step.type === 'ai_reframe_output'} />;
      case 'visualization':
        return <VisualizationConfig config={config} updateConfig={updateConfig} />;
      case 'progress_scale':
        return <ProgressScaleConfig config={config} updateConfig={updateConfig} />;
      case 'completion':
        return <CompletionConfig config={config} updateConfig={updateConfig} />;
      case 'goal_achieved':
        return <GoalAchievedConfig config={config} updateConfig={updateConfig} />;
      case 'explainer':
        return <ExplainerConfig config={config} updateConfig={updateConfig} />;
      default:
        return <GenericConfig config={config} updateConfig={updateConfig} />;
    }
  };

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-[#171b22] rounded-2xl w-full max-w-lg shadow-xl border border-[#e1ddd8] dark:border-[#262b35] max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">
            Configure Step
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Step name */}
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
              Step Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Custom name for this step"
              className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#666d7c] focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent"
            />
          </div>

          {/* Type-specific config */}
          {renderConfigFields()}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-[#e1ddd8] dark:border-[#262b35] text-text-primary dark:text-[#f5f5f8] rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-brand-accent text-white rounded-xl hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// Config component for mood scale
function MoodScaleConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Question
        </label>
        <input
          type="text"
          value={(config.question as string) || ''}
          onChange={(e) => updateConfig('question', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Scale Type
        </label>
        <select
          value={(config.scaleType as string) || 'emotional_state'}
          onChange={(e) => updateConfig('scaleType', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        >
          <option value="emotional_state">Emotional State (7 levels)</option>
          <option value="on_track">On Track (3 levels)</option>
          <option value="custom">Custom</option>
        </select>
      </div>
    </div>
  );
}

// Config component for single/multi select
function SelectConfig({ config, updateConfig, isMulti }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void; isMulti: boolean }) {
  const options = (config.options as { id: string; label: string; value: string }[]) || [];

  const addOption = () => {
    const newId = Date.now().toString();
    updateConfig('options', [...options, { id: newId, label: '', value: '' }]);
  };

  const updateOption = (id: string, field: string, value: string) => {
    updateConfig('options', options.map(opt => 
      opt.id === id ? { ...opt, [field]: value } : opt
    ));
  };

  const removeOption = (id: string) => {
    updateConfig('options', options.filter(opt => opt.id !== id));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Question
        </label>
        <input
          type="text"
          value={(config.question as string) || ''}
          onChange={(e) => updateConfig('question', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Options
        </label>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={option.id} className="flex gap-2">
              <input
                type="text"
                value={option.label}
                onChange={(e) => updateOption(option.id, 'label', e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1 px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] text-sm focus:outline-none focus:border-brand-accent"
              />
              <button
                onClick={() => removeOption(option.id)}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addOption}
            className="flex items-center gap-2 px-3 py-2 text-sm text-brand-accent hover:bg-brand-accent/10 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Option
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Field Name
        </label>
        <input
          type="text"
          value={(config.fieldName as string) || ''}
          onChange={(e) => updateConfig('fieldName', e.target.value)}
          placeholder="e.g., answer"
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
    </div>
  );
}

// Config component for open text
function OpenTextConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Question
        </label>
        <input
          type="text"
          value={(config.question as string) || ''}
          onChange={(e) => updateConfig('question', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Placeholder
        </label>
        <input
          type="text"
          value={(config.placeholder as string) || ''}
          onChange={(e) => updateConfig('placeholder', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="isRequired"
          checked={(config.isRequired as boolean) || false}
          onChange={(e) => updateConfig('isRequired', e.target.checked)}
          className="w-4 h-4 text-brand-accent rounded"
        />
        <label htmlFor="isRequired" className="text-sm text-text-primary dark:text-[#f5f5f8]">
          Required field
        </label>
      </div>
    </div>
  );
}

// Config component for task planner
function TaskPlannerConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Heading
        </label>
        <input
          type="text"
          value={(config.heading as string) || ''}
          onChange={(e) => updateConfig('heading', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showProgramTasks"
            checked={(config.showProgramTasks as boolean) ?? true}
            onChange={(e) => updateConfig('showProgramTasks', e.target.checked)}
            className="w-4 h-4 text-brand-accent rounded"
          />
          <label htmlFor="showProgramTasks" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show program tasks
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="allowAddTasks"
            checked={(config.allowAddTasks as boolean) ?? true}
            onChange={(e) => updateConfig('allowAddTasks', e.target.checked)}
            className="w-4 h-4 text-brand-accent rounded"
          />
          <label htmlFor="allowAddTasks" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Allow adding custom tasks
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showBacklog"
            checked={(config.showBacklog as boolean) ?? true}
            onChange={(e) => updateConfig('showBacklog', e.target.checked)}
            className="w-4 h-4 text-brand-accent rounded"
          />
          <label htmlFor="showBacklog" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show backlog
          </label>
        </div>
      </div>
    </div>
  );
}

// Config component for task review
function TaskReviewConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Heading
        </label>
        <input
          type="text"
          value={(config.heading as string) || ''}
          onChange={(e) => updateConfig('heading', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          All completed message
        </label>
        <input
          type="text"
          value={(config.completedMessage as string) || ''}
          onChange={(e) => updateConfig('completedMessage', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Partial completion message
        </label>
        <input
          type="text"
          value={(config.partialMessage as string) || ''}
          onChange={(e) => updateConfig('partialMessage', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
    </div>
  );
}

// Config component for breathing
function BreathingConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  const pattern = (config.pattern as { inhale: number; hold?: number; exhale: number }) || { inhale: 4, hold: 2, exhale: 6 };

  const updatePattern = (field: string, value: number) => {
    updateConfig('pattern', { ...pattern, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Heading
        </label>
        <input
          type="text"
          value={(config.heading as string) || ''}
          onChange={(e) => updateConfig('heading', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary dark:text-[#b2b6c2] mb-1">
            Inhale (sec)
          </label>
          <input
            type="number"
            value={pattern.inhale}
            onChange={(e) => updatePattern('inhale', parseInt(e.target.value) || 4)}
            min={1}
            max={10}
            className="w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary dark:text-[#b2b6c2] mb-1">
            Hold (sec)
          </label>
          <input
            type="number"
            value={pattern.hold || 0}
            onChange={(e) => updatePattern('hold', parseInt(e.target.value) || 0)}
            min={0}
            max={10}
            className="w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary dark:text-[#b2b6c2] mb-1">
            Exhale (sec)
          </label>
          <input
            type="number"
            value={pattern.exhale}
            onChange={(e) => updatePattern('exhale', parseInt(e.target.value) || 6)}
            min={1}
            max={10}
            className="w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Number of cycles
        </label>
        <input
          type="number"
          value={(config.cycles as number) || 3}
          onChange={(e) => updateConfig('cycles', parseInt(e.target.value) || 3)}
          min={1}
          max={10}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
    </div>
  );
}

// Config component for AI reframe
function AIReframeConfig({ config, updateConfig, isOutput }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void; isOutput: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Heading
        </label>
        <input
          type="text"
          value={(config.heading as string) || ''}
          onChange={(e) => updateConfig('heading', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      {isOutput ? (
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
            Loading message
          </label>
          <input
            type="text"
            value={(config.loadingMessage as string) || ''}
            onChange={(e) => updateConfig('loadingMessage', e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
            Placeholder
          </label>
          <input
            type="text"
            value={(config.placeholder as string) || ''}
            onChange={(e) => updateConfig('placeholder', e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
          />
        </div>
      )}
    </div>
  );
}

// Config component for visualization
function VisualizationConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Heading
        </label>
        <input
          type="text"
          value={(config.heading as string) || ''}
          onChange={(e) => updateConfig('heading', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showGoal"
            checked={(config.showGoal as boolean) ?? true}
            onChange={(e) => updateConfig('showGoal', e.target.checked)}
            className="w-4 h-4 text-brand-accent rounded"
          />
          <label htmlFor="showGoal" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show user&apos;s goal
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showIdentity"
            checked={(config.showIdentity as boolean) ?? true}
            onChange={(e) => updateConfig('showIdentity', e.target.checked)}
            className="w-4 h-4 text-brand-accent rounded"
          />
          <label htmlFor="showIdentity" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show user&apos;s identity statement
          </label>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Duration (seconds)
        </label>
        <input
          type="number"
          value={(config.durationSeconds as number) || 60}
          onChange={(e) => updateConfig('durationSeconds', parseInt(e.target.value) || 60)}
          min={10}
          max={300}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
    </div>
  );
}

// Config component for progress scale
function ProgressScaleConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Question
        </label>
        <input
          type="text"
          value={(config.question as string) || ''}
          onChange={(e) => updateConfig('question', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="showGoalProgress"
          checked={(config.showGoal as boolean) ?? true}
          onChange={(e) => updateConfig('showGoal', e.target.checked)}
          className="w-4 h-4 text-brand-accent rounded"
        />
        <label htmlFor="showGoalProgress" className="text-sm text-text-primary dark:text-[#f5f5f8]">
          Display user&apos;s goal
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Goal achieved threshold (%)
        </label>
        <input
          type="number"
          value={(config.goalAchievedThreshold as number) || 100}
          onChange={(e) => updateConfig('goalAchievedThreshold', parseInt(e.target.value) || 100)}
          min={1}
          max={100}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
        <p className="mt-1 text-xs text-text-muted dark:text-[#666d7c]">
          When user reaches this %, show goal achieved screen
        </p>
      </div>
    </div>
  );
}

// Config component for completion
function CompletionConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Heading
        </label>
        <input
          type="text"
          value={(config.heading as string) || ''}
          onChange={(e) => updateConfig('heading', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Subheading
        </label>
        <input
          type="text"
          value={(config.subheading as string) || ''}
          onChange={(e) => updateConfig('subheading', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Button text
        </label>
        <input
          type="text"
          value={(config.buttonText as string) || ''}
          onChange={(e) => updateConfig('buttonText', e.target.value)}
          placeholder="e.g., Continue, Finish, Close"
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="showConfetti"
          checked={(config.showConfetti as boolean) ?? true}
          onChange={(e) => updateConfig('showConfetti', e.target.checked)}
          className="w-4 h-4 text-brand-accent rounded"
        />
        <label htmlFor="showConfetti" className="text-sm text-text-primary dark:text-[#f5f5f8]">
          Show confetti animation
        </label>
      </div>
    </div>
  );
}

// Config component for goal achieved
function GoalAchievedConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Heading
        </label>
        <input
          type="text"
          value={(config.heading as string) || ''}
          onChange={(e) => updateConfig('heading', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Description
        </label>
        <textarea
          value={(config.description as string) || ''}
          onChange={(e) => updateConfig('description', e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent resize-none"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showCreateNewGoal"
            checked={(config.showCreateNewGoal as boolean) ?? true}
            onChange={(e) => updateConfig('showCreateNewGoal', e.target.checked)}
            className="w-4 h-4 text-brand-accent rounded"
          />
          <label htmlFor="showCreateNewGoal" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show &quot;Create new goal&quot; button
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showSkipOption"
            checked={(config.showSkipOption as boolean) ?? true}
            onChange={(e) => updateConfig('showSkipOption', e.target.checked)}
            className="w-4 h-4 text-brand-accent rounded"
          />
          <label htmlFor="showSkipOption" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show &quot;Skip for now&quot; option
          </label>
        </div>
      </div>
    </div>
  );
}

// Config component for explainer
function ExplainerConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Heading
        </label>
        <input
          type="text"
          value={(config.heading as string) || ''}
          onChange={(e) => updateConfig('heading', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Body
        </label>
        <textarea
          value={(config.body as string) || ''}
          onChange={(e) => updateConfig('body', e.target.value)}
          rows={4}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Image URL (optional)
        </label>
        <input
          type="text"
          value={(config.imageUrl as string) || ''}
          onChange={(e) => updateConfig('imageUrl', e.target.value)}
          placeholder="https://..."
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Button text
        </label>
        <input
          type="text"
          value={(config.ctaText as string) || ''}
          onChange={(e) => updateConfig('ctaText', e.target.value)}
          placeholder="Continue"
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
    </div>
  );
}

// Generic config for unknown types
function GenericConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  return (
    <div className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
      <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
        Configuration editor for this step type is not yet available.
      </p>
      <pre className="mt-2 text-xs text-text-muted dark:text-[#666d7c] overflow-auto">
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  );
}




