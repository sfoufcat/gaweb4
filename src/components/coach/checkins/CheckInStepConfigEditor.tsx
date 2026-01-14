'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { CheckInStep } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface CheckInStepConfigEditorProps {
  step: CheckInStep;
  onClose: () => void;
  onSave: (config: unknown, name?: string) => void;
}

export function CheckInStepConfigEditor({ step, onClose, onSave }: CheckInStepConfigEditorProps) {
  const [name, setName] = useState(step.name || '');
  const [config, setConfig] = useState<Record<string, unknown>>(() => {
    // Extract config from the step's config object
    const stepConfig = step.config as { type: string; config: Record<string, unknown> };
    return stepConfig?.config || {};
  });
  const [isSaving, setIsSaving] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

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
      case 'accept':
        return <AcceptConfig config={config} updateConfig={updateConfig} />;
      case 'reframe':
      case 'reframe_input':
        return <AIReframeConfig config={config} updateConfig={updateConfig} isOutput={false} />;
      case 'ai_reframe':
      case 'ai_reframe_input':
      case 'ai_reframe_output':
        return <AIReframeConfig config={config} updateConfig={updateConfig} isOutput={true} />;
      case 'begin_manifest':
        return <BeginManifestConfig config={config} updateConfig={updateConfig} />;
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
      // Weekly check-in specific steps
      case 'on_track_scale':
        return <OnTrackScaleConfig config={config} updateConfig={updateConfig} />;
      case 'voice_text':
        return <VoiceTextConfig config={config} updateConfig={updateConfig} />;
      case 'weekly_focus':
        return <WeeklyFocusConfig config={config} updateConfig={updateConfig} />;
      case 'momentum_progress':
        return <MomentumProgressConfig config={config} updateConfig={updateConfig} />;
      // Evening check-in specific steps
      case 'evening_mood':
        return <EveningMoodConfig config={config} updateConfig={updateConfig} />;
      case 'evening_reflection':
        return <EveningReflectionConfig config={config} updateConfig={updateConfig} />;
      case 'evening_task_review':
        return <EveningTaskReviewConfig config={config} updateConfig={updateConfig} />;
      default:
        return <GenericConfig config={config} updateConfig={updateConfig} />;
    }
  };

  // Shared content for both Dialog and Drawer
  const content = (
    <>
      {/* Content */}
      <div className="px-6 py-4 md:p-6 space-y-5 md:space-y-6 overflow-y-auto flex-1">
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
      <div className="flex gap-3 px-6 py-4 md:p-6 border-t border-[#e1ddd8] dark:border-[#262b35] pb-safe">
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
    </>
  );

  // Desktop: Use Dialog (centered modal)
  if (isDesktop) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg p-0 flex flex-col max-h-[90vh]" hideCloseButton>
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
            <DialogTitle>Configure Step</DialogTitle>
          </DialogHeader>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
          </button>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Use Drawer (slide-up)
  return (
    <Drawer open={true} onOpenChange={(open) => !open && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[85dvh] flex flex-col">
        {/* Header */}
        <DrawerHeader className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <DrawerTitle>Configure Step</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
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
          className="accent-brand-accent"
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
            className="accent-brand-accent"
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
            className="accent-brand-accent"
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
            className="accent-brand-accent"
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

// Config component for accept step
function AcceptConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
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
          Message
        </label>
        <textarea
          value={(config.message as string) || ''}
          onChange={(e) => updateConfig('message', e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent resize-none"
        />
      </div>
    </div>
  );
}

// Config component for begin manifest step
function BeginManifestConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
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
            className="accent-brand-accent"
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
            className="accent-brand-accent"
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
          className="accent-brand-accent"
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
          className="accent-brand-accent"
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
            className="accent-brand-accent"
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
            className="accent-brand-accent"
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

// ============================================
// WEEKLY CHECK-IN SPECIFIC CONFIG COMPONENTS
// ============================================

// Config component for on_track_scale (Weekly: On Track Check)
function OnTrackScaleConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  const options = (config.options as { value: string; label: string; gradient: string }[]) || [];

  const addOption = () => {
    updateConfig('options', [...options, { value: '', label: '', gradient: 'linear-gradient(180deg, rgba(100, 200, 100, 0.2), rgba(100, 200, 100, 0.05))' }]);
  };

  const updateOption = (index: number, field: string, value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    updateConfig('options', newOptions);
  };

  const removeOption = (index: number) => {
    updateConfig('options', options.filter((_, i) => i !== index));
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
          placeholder="Are you on track to achieve your goal?"
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
          placeholder="Reflect on your week"
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Options (3 states: No / Maybe / Yes)
        </label>
        <div className="space-y-3">
          {options.map((option, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => updateOption(index, 'label', e.target.value)}
                  placeholder="Label (e.g., No, Maybe, Yes)"
                  className="w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] text-sm focus:outline-none focus:border-brand-accent"
                />
                <input
                  type="text"
                  value={option.value}
                  onChange={(e) => updateOption(index, 'value', e.target.value)}
                  placeholder="Value (e.g., off_track, somewhat, on_track)"
                  className="w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] text-sm focus:outline-none focus:border-brand-accent"
                />
              </div>
              <button
                onClick={() => removeOption(index)}
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
    </div>
  );
}

// Config component for voice_text (Weekly: What Went Well, Biggest Obstacles, Next Week Plan)
function VoiceTextConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
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
          placeholder="What went well this week?"
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
          placeholder="Share your wins..."
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Field Name
        </label>
        <input
          type="text"
          value={(config.fieldName as string) || ''}
          onChange={(e) => updateConfig('fieldName', e.target.value)}
          placeholder="e.g., whatWentWell, obstacles, nextWeekPlan"
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="voiceTextRequired"
            checked={(config.isRequired as boolean) || false}
            onChange={(e) => updateConfig('isRequired', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="voiceTextRequired" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Required field
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="enableVoice"
            checked={(config.enableVoice as boolean) ?? true}
            onChange={(e) => updateConfig('enableVoice', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="enableVoice" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Enable voice-to-text
          </label>
        </div>
      </div>
    </div>
  );
}

// Config component for weekly_focus (Weekly: Weekly Focus)
function WeeklyFocusConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
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
          placeholder="What's your focus for this week?"
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
          placeholder="Describe your main focus..."
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Field Name
        </label>
        <input
          type="text"
          value={(config.fieldName as string) || ''}
          onChange={(e) => updateConfig('fieldName', e.target.value)}
          placeholder="e.g., weeklyFocus"
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showAiSuggestion"
            checked={(config.showAiSuggestion as boolean) ?? true}
            onChange={(e) => updateConfig('showAiSuggestion', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="showAiSuggestion" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show AI suggestion
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showPublicBadge"
            checked={(config.showPublicBadge as boolean) ?? true}
            onChange={(e) => updateConfig('showPublicBadge', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="showPublicBadge" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show &quot;public&quot; badge
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showShareButton"
            checked={(config.showShareButton as boolean) ?? true}
            onChange={(e) => updateConfig('showShareButton', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="showShareButton" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show share button
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showSkipButton"
            checked={(config.showSkipButton as boolean) ?? false}
            onChange={(e) => updateConfig('showSkipButton', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="showSkipButton" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show skip button
          </label>
        </div>
      </div>
    </div>
  );
}

// Config component for momentum_progress (Weekly: Progress with momentum physics)
function MomentumProgressConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
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
          placeholder="How close are you to your goal?"
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="momentumShowGoal"
          checked={(config.showGoal as boolean) ?? true}
          onChange={(e) => updateConfig('showGoal', e.target.checked)}
          className="accent-brand-accent"
        />
        <label htmlFor="momentumShowGoal" className="text-sm text-text-primary dark:text-[#f5f5f8]">
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
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="enableMomentum"
            checked={(config.enableMomentum as boolean) ?? true}
            onChange={(e) => updateConfig('enableMomentum', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="enableMomentum" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Enable momentum physics animation
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="enableAudioFeedback"
            checked={(config.enableAudioFeedback as boolean) ?? true}
            onChange={(e) => updateConfig('enableAudioFeedback', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="enableAudioFeedback" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Enable audio feedback
          </label>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EVENING CHECK-IN SPECIFIC CONFIG COMPONENTS
// ============================================

// Config component for evening_mood (Evening: 5-state mood slider)
function EveningMoodConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
  const options = (config.options as { value: string; label: string; gradient: string }[]) || [];

  const addOption = () => {
    updateConfig('options', [...options, { value: '', label: '', gradient: 'linear-gradient(180deg, rgba(100, 200, 100, 0.2), rgba(100, 200, 100, 0.05))' }]);
  };

  const updateOption = (index: number, field: string, value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    updateConfig('options', newOptions);
  };

  const removeOption = (index: number) => {
    updateConfig('options', options.filter((_, i) => i !== index));
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
          placeholder="How was your day?"
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Options (5 states: Tough Day → Great Day)
        </label>
        <div className="space-y-3">
          {options.map((option, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => updateOption(index, 'label', e.target.value)}
                  placeholder="Label (e.g., Tough Day, Great Day)"
                  className="w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] text-sm focus:outline-none focus:border-brand-accent"
                />
                <input
                  type="text"
                  value={option.value}
                  onChange={(e) => updateOption(index, 'value', e.target.value)}
                  placeholder="Value (e.g., tough_day, great_day)"
                  className="w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] text-sm focus:outline-none focus:border-brand-accent"
                />
              </div>
              <button
                onClick={() => removeOption(index)}
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
    </div>
  );
}

// Config component for evening_reflection (Evening: Text with voice input)
function EveningReflectionConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
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
          placeholder="What's on your mind tonight?"
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
          placeholder="Share your thoughts..."
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Field Name
        </label>
        <input
          type="text"
          value={(config.fieldName as string) || ''}
          onChange={(e) => updateConfig('fieldName', e.target.value)}
          placeholder="e.g., eveningReflection"
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="eveningEnableVoice"
            checked={(config.enableVoice as boolean) ?? true}
            onChange={(e) => updateConfig('enableVoice', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="eveningEnableVoice" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Enable voice-to-text
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showSkip"
            checked={(config.showSkip as boolean) ?? true}
            onChange={(e) => updateConfig('showSkip', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="showSkip" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show skip button
          </label>
        </div>
      </div>
    </div>
  );
}

// Config component for evening_task_review (Evening: Task review with completion status)
function EveningTaskReviewConfig({ config, updateConfig }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
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
          placeholder="Review your tasks"
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
          placeholder="Amazing! You completed all your tasks!"
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
          placeholder="Good progress! You completed {completed} of {total} tasks."
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          No tasks message
        </label>
        <input
          type="text"
          value={(config.noTasksMessage as string) || ''}
          onChange={(e) => updateConfig('noTasksMessage', e.target.value)}
          placeholder="No tasks were planned for today."
          className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showTaskList"
            checked={(config.showTaskList as boolean) ?? true}
            onChange={(e) => updateConfig('showTaskList', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="showTaskList" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Show task list
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="allowTaskEdit"
            checked={(config.allowTaskEdit as boolean) ?? true}
            onChange={(e) => updateConfig('allowTaskEdit', e.target.checked)}
            className="accent-brand-accent"
          />
          <label htmlFor="allowTaskEdit" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Allow task editing
          </label>
        </div>
      </div>
    </div>
  );
}

// Generic config for unknown types
function GenericConfig({ config }: { config: Record<string, unknown>; updateConfig: (key: string, value: unknown) => void }) {
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




