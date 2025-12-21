'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import type { FunnelStep, FunnelStepType, FunnelQuestionOption } from '@/types';
import { nanoid } from 'nanoid';

interface StepConfigEditorProps {
  step: FunnelStep;
  onClose: () => void;
  onSave: (config: unknown) => void;
}

export function StepConfigEditor({ step, onClose, onSave }: StepConfigEditorProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    (step.config as { config: Record<string, unknown> })?.config || {}
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(config);
    setIsSaving(false);
  };

  const renderConfigEditor = () => {
    switch (step.type) {
      case 'question':
        return <QuestionConfigEditor config={config} onChange={setConfig} />;
      case 'signup':
        return <SignupConfigEditor config={config} onChange={setConfig} />;
      case 'payment':
        return <PaymentConfigEditor config={config} onChange={setConfig} />;
      case 'goal_setting':
        return <GoalConfigEditor config={config} onChange={setConfig} />;
      case 'identity':
        return <IdentityConfigEditor config={config} onChange={setConfig} />;
      case 'analyzing':
        return <AnalyzingConfigEditor config={config} onChange={setConfig} />;
      case 'plan_reveal':
      case 'transformation':
        return <PlanRevealConfigEditor config={config} onChange={setConfig} />;
      case 'info':
        return <InfoConfigEditor config={config} onChange={setConfig} />;
      case 'success':
        return <SuccessConfigEditor config={config} onChange={setConfig} />;
      default:
        return (
          <div className="text-text-secondary text-center py-8">
            No configuration options for this step type.
          </div>
        );
    }
  };

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#e1ddd8]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary capitalize">
              {step.type.replace(/_/g, ' ')} Configuration
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f5f3f0] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {renderConfigEditor()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#e1ddd8] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 text-text-secondary hover:text-text-primary border border-[#e1ddd8] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 px-4 bg-[#a07855] text-white rounded-lg hover:bg-[#8c6245] disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(content, document.body);
}

// Question Config Editor
function QuestionConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const options = (config.options as FunnelQuestionOption[]) || [];

  const addOption = () => {
    const newOption: FunnelQuestionOption = {
      id: nanoid(8),
      label: `Option ${options.length + 1}`,
      value: `option_${options.length + 1}`,
      order: options.length,
    };
    onChange({ ...config, options: [...options, newOption] });
  };

  const updateOption = (id: string, updates: Partial<FunnelQuestionOption>) => {
    onChange({
      ...config,
      options: options.map(o => o.id === id ? { ...o, ...updates } : o),
    });
  };

  const removeOption = (id: string) => {
    onChange({
      ...config,
      options: options.filter(o => o.id !== id).map((o, i) => ({ ...o, order: i })),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Question Type</label>
        <select
          value={config.questionType as string || 'single_choice'}
          onChange={(e) => onChange({ ...config, questionType: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
        >
          <option value="single_choice">Single Choice</option>
          <option value="multi_choice">Multiple Choice</option>
          <option value="text">Text Input</option>
          <option value="scale">Scale</option>
          <option value="workday">Preset: Workday Style</option>
          <option value="obstacles">Preset: Obstacles</option>
          <option value="business_stage">Preset: Business Stage</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Question Text</label>
        <textarea
          value={config.question as string || ''}
          onChange={(e) => onChange({ ...config, question: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] resize-none"
          rows={2}
          placeholder="Enter your question..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Field Name</label>
        <input
          type="text"
          value={config.fieldName as string || 'answer'}
          onChange={(e) => onChange({ ...config, fieldName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="e.g., workdayStyle"
        />
        <p className="text-xs text-text-muted mt-1">This is the key used to store the answer</p>
      </div>

      {(config.questionType === 'single_choice' || config.questionType === 'multi_choice' || !config.questionType) && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Options</label>
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-text-muted cursor-grab" />
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => updateOption(option.id, { label: e.target.value })}
                  className="flex-1 px-3 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] text-sm"
                  placeholder="Option label"
                />
                <input
                  type="text"
                  value={option.emoji || ''}
                  onChange={(e) => updateOption(option.id, { emoji: e.target.value })}
                  className="w-16 px-3 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] text-sm text-center"
                  placeholder="😀"
                />
                <button
                  onClick={() => removeOption(option.id)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
            <button
              onClick={addOption}
              className="w-full py-2 border-2 border-dashed border-[#e1ddd8] rounded-lg text-text-secondary hover:border-[#a07855] hover:text-[#a07855] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Option
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Signup Config Editor
function SignupConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.showSocialLogin !== false}
            onChange={(e) => onChange({ ...config, showSocialLogin: e.target.checked })}
            className="rounded text-[#a07855] focus:ring-[#a07855]"
          />
          <span className="text-text-primary">Show social login buttons (Google)</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Heading</label>
        <input
          type="text"
          value={config.heading as string || ''}
          onChange={(e) => onChange({ ...config, heading: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="Create your account"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Subheading</label>
        <input
          type="text"
          value={config.subheading as string || ''}
          onChange={(e) => onChange({ ...config, subheading: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="Sign up to continue your journey"
        />
      </div>
    </div>
  );
}

// Payment Config Editor
function PaymentConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.useProgramPricing !== false}
            onChange={(e) => onChange({ ...config, useProgramPricing: e.target.checked })}
            className="rounded text-[#a07855] focus:ring-[#a07855]"
          />
          <span className="text-text-primary">Use program's default pricing</span>
        </label>
      </div>

      {!config.useProgramPricing && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Custom Price (cents)</label>
          <input
            type="number"
            value={config.priceInCents as number || 0}
            onChange={(e) => onChange({ ...config, priceInCents: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
            placeholder="9900"
          />
          <p className="text-xs text-text-muted mt-1">e.g., 9900 = $99.00</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Heading</label>
        <input
          type="text"
          value={config.heading as string || ''}
          onChange={(e) => onChange({ ...config, heading: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="Complete your enrollment"
        />
      </div>
    </div>
  );
}

// Goal Config Editor
function GoalConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const examples = (config.examples as string[]) || [];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Timeline (days)</label>
        <input
          type="number"
          value={config.timelineDays as number || 90}
          onChange={(e) => onChange({ ...config, timelineDays: parseInt(e.target.value) || 90 })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Example Goals</label>
        <textarea
          value={examples.join('\n')}
          onChange={(e) => onChange({ ...config, examples: e.target.value.split('\n').filter(Boolean) })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] resize-none"
          rows={4}
          placeholder="One example per line..."
        />
        <p className="text-xs text-text-muted mt-1">These show as placeholder suggestions</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Heading</label>
        <input
          type="text"
          value={config.heading as string || ''}
          onChange={(e) => onChange({ ...config, heading: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="Set your 90-day goal"
        />
      </div>
    </div>
  );
}

// Identity Config Editor
function IdentityConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const examples = (config.examples as string[]) || [];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Example Identities</label>
        <textarea
          value={examples.join('\n')}
          onChange={(e) => onChange({ ...config, examples: e.target.value.split('\n').filter(Boolean) })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] resize-none"
          rows={4}
          placeholder="One example per line..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Heading</label>
        <input
          type="text"
          value={config.heading as string || ''}
          onChange={(e) => onChange({ ...config, heading: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="Who are you becoming?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Prompt Text</label>
        <input
          type="text"
          value={config.promptText as string || ''}
          onChange={(e) => onChange({ ...config, promptText: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="I am becoming..."
        />
      </div>
    </div>
  );
}

// Analyzing Config Editor
function AnalyzingConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const messages = (config.messages as string[]) || [];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Duration (ms)</label>
        <input
          type="number"
          value={config.durationMs as number || 3000}
          onChange={(e) => onChange({ ...config, durationMs: parseInt(e.target.value) || 3000 })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
        />
        <p className="text-xs text-text-muted mt-1">e.g., 3000 = 3 seconds</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Messages</label>
        <textarea
          value={messages.join('\n')}
          onChange={(e) => onChange({ ...config, messages: e.target.value.split('\n').filter(Boolean) })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] resize-none"
          rows={4}
          placeholder="One message per line..."
        />
        <p className="text-xs text-text-muted mt-1">These cycle through during the animation</p>
      </div>
    </div>
  );
}

// Plan Reveal Config Editor
function PlanRevealConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.showGraph !== false}
            onChange={(e) => onChange({ ...config, showGraph: e.target.checked })}
            className="rounded text-[#a07855] focus:ring-[#a07855]"
          />
          <span className="text-text-primary">Show transformation graph</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Heading</label>
        <input
          type="text"
          value={config.heading as string || ''}
          onChange={(e) => onChange({ ...config, heading: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="Your {X}-month plan is ready!"
        />
        <p className="text-xs text-text-muted mt-1">Use {'{X}'} to insert the timeline duration</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Body</label>
        <textarea
          value={config.body as string || ''}
          onChange={(e) => onChange({ ...config, body: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] resize-none"
          rows={3}
          placeholder="Custom encouragement text..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Button Text</label>
        <input
          type="text"
          value={config.ctaText as string || ''}
          onChange={(e) => onChange({ ...config, ctaText: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="Continue"
        />
      </div>
    </div>
  );
}

// Info Config Editor
function InfoConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Heading *</label>
        <input
          type="text"
          value={config.heading as string || ''}
          onChange={(e) => onChange({ ...config, heading: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="Welcome"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Body *</label>
        <textarea
          value={config.body as string || ''}
          onChange={(e) => onChange({ ...config, body: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] resize-none"
          rows={4}
          placeholder="Your information text..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Image URL (optional)</label>
        <input
          type="text"
          value={config.imageUrl as string || ''}
          onChange={(e) => onChange({ ...config, imageUrl: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Button Text</label>
        <input
          type="text"
          value={config.ctaText as string || ''}
          onChange={(e) => onChange({ ...config, ctaText: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="Continue"
        />
      </div>
    </div>
  );
}

// Success Config Editor
function SuccessConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.showConfetti !== false}
            onChange={(e) => onChange({ ...config, showConfetti: e.target.checked })}
            className="rounded text-[#a07855] focus:ring-[#a07855]"
          />
          <span className="text-text-primary">Show confetti animation</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Redirect Delay (ms)</label>
        <input
          type="number"
          value={config.redirectDelay as number || 3000}
          onChange={(e) => onChange({ ...config, redirectDelay: parseInt(e.target.value) || 3000 })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
        />
        <p className="text-xs text-text-muted mt-1">Time before redirecting to dashboard</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Heading</label>
        <input
          type="text"
          value={config.heading as string || ''}
          onChange={(e) => onChange({ ...config, heading: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
          placeholder="Welcome to [Program]! 🎉"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Body</label>
        <textarea
          value={config.body as string || ''}
          onChange={(e) => onChange({ ...config, body: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] resize-none"
          rows={2}
          placeholder="You're all set! Taking you to your dashboard..."
        />
      </div>
    </div>
  );
}

