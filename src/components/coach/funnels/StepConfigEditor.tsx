'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import type { FunnelStep, FunnelStepType, FunnelQuestionOption } from '@/types';
import { nanoid } from 'nanoid';
import { MediaUpload } from '@/components/admin/MediaUpload';

interface StepConfigEditorProps {
  step: FunnelStep;
  onClose: () => void;
  onSave: (config: unknown, name?: string) => void;
}

export function StepConfigEditor({ step, onClose, onSave }: StepConfigEditorProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    ((step.config as unknown) as { config: Record<string, unknown> })?.config || {}
  );
  const [stepName, setStepName] = useState(step.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(config, stepName.trim() || undefined);
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
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Step Name - shown for all step types */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Step Name</label>
            <input
              type="text"
              value={stepName}
              onChange={(e) => setStepName(e.target.value)}
              className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
              placeholder={`e.g., "${step.type.replace(/_/g, ' ')} - Main"`}
            />
            <p className="text-xs text-text-muted mt-1">A custom name to help you identify this step</p>
          </div>

          {/* Step-specific config */}
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

      {/* Scale customization - only show for scale type */}
      {config.questionType === 'scale' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Scale Min</label>
              <input
                type="number"
                value={config.scaleMin as number || 1}
                onChange={(e) => onChange({ ...config, scaleMin: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
                min={0}
                max={10}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Scale Max</label>
              <input
                type="number"
                value={config.scaleMax as number || 10}
                onChange={(e) => onChange({ ...config, scaleMax: parseInt(e.target.value) || 10 })}
                className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
                min={1}
                max={20}
              />
            </div>
          </div>
          <p className="text-xs text-text-muted -mt-4">Number of scale points: {((config.scaleMax as number || 10) - (config.scaleMin as number || 1) + 1)}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Start Label</label>
              <input
                type="text"
                value={(config.scaleLabels as { min?: string; max?: string })?.min || ''}
                onChange={(e) => onChange({ 
                  ...config, 
                  scaleLabels: { 
                    ...((config.scaleLabels as { min?: string; max?: string }) || {}),
                    min: e.target.value 
                  }
                })}
                className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
                placeholder="e.g., Strongly disagree"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">End Label</label>
              <input
                type="text"
                value={(config.scaleLabels as { min?: string; max?: string })?.max || ''}
                onChange={(e) => onChange({ 
                  ...config, 
                  scaleLabels: { 
                    ...((config.scaleLabels as { min?: string; max?: string }) || {}),
                    max: e.target.value 
                  }
                })}
                className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
                placeholder="e.g., Strongly agree"
              />
            </div>
          </div>
        </>
      )}

      {(config.questionType === 'single_choice' || config.questionType === 'multi_choice' || !config.questionType) && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Options</label>
          <div className="space-y-4">
            {options.map((option) => (
              <div key={option.id} className="border border-[#e1ddd8] rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-text-muted cursor-grab flex-shrink-0" />
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => updateOption(option.id, { label: e.target.value })}
                    className="flex-1 px-3 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] text-sm"
                    placeholder="Option label (emojis allowed)"
                  />
                  <button
                    onClick={() => removeOption(option.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
                {/* Optional image upload */}
                <div className="pl-6">
                  <MediaUpload
                    value={option.imageUrl || ''}
                    onChange={(url) => updateOption(option.id, { imageUrl: url })}
                    folder="programs"
                    type="image"
                    label="Option Image (optional)"
                  />
                </div>
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
          <p className="text-xs text-text-muted mt-2">Options with images display as cards in a grid layout</p>
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
interface Testimonial {
  name: string;
  text: string;
  imageUrl?: string;
}

function AnalyzingConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const messages = (config.messages as string[]) || [];
  const testimonials = (config.testimonials as Testimonial[]) || [];

  const addTestimonial = () => {
    if (testimonials.length >= 3) return; // Max 3 testimonials
    const newTestimonial: Testimonial = {
      name: '',
      text: '',
    };
    onChange({ ...config, testimonials: [...testimonials, newTestimonial] });
  };

  const updateTestimonial = (index: number, updates: Partial<Testimonial>) => {
    const updated = [...testimonials];
    updated[index] = { ...updated[index], ...updates };
    onChange({ ...config, testimonials: updated });
  };

  const removeTestimonial = (index: number) => {
    onChange({ ...config, testimonials: testimonials.filter((_, i) => i !== index) });
  };

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

      {/* Testimonials Section */}
      <div className="pt-4 border-t border-[#e1ddd8]">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-text-primary">Testimonials</label>
          {testimonials.length < 3 && (
            <button
              onClick={addTestimonial}
              className="text-sm text-[#a07855] hover:text-[#8c6245] font-medium"
            >
              + Add testimonial
            </button>
          )}
        </div>
        
        {testimonials.length === 0 ? (
          <p className="text-sm text-text-muted">Add testimonials to display below the analyzing animation.</p>
        ) : (
          <div className="space-y-4">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="border border-[#e1ddd8] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-secondary">Testimonial {index + 1}</span>
                  <button
                    onClick={() => removeTestimonial(index)}
                    className="text-red-500 hover:text-red-600 text-sm"
                  >
                    Remove
                  </button>
                </div>
                
                <div>
                  <label className="block text-xs text-text-muted mb-1">Name</label>
                  <input
                    type="text"
                    value={testimonial.name}
                    onChange={(e) => updateTestimonial(index, { name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] text-sm"
                    placeholder="John D."
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-text-muted mb-1">Quote</label>
                  <textarea
                    value={testimonial.text}
                    onChange={(e) => updateTestimonial(index, { text: e.target.value })}
                    className="w-full px-3 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] text-sm resize-none"
                    rows={2}
                    placeholder="This program changed my life..."
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-text-muted mb-1">Avatar Image (optional)</label>
                  <MediaUpload
                    value={testimonial.imageUrl || ''}
                    onChange={(url) => updateTestimonial(index, { imageUrl: url })}
                    folder="programs"
                    type="image"
                    label="Avatar"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        
        <p className="text-xs text-text-muted mt-2">Up to 3 testimonials. These appear below the analyzing animation.</p>
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
        <label className="block text-sm font-medium text-text-primary mb-2">Image (optional)</label>
        <MediaUpload
          value={config.imageUrl as string || ''}
          onChange={(url) => onChange({ ...config, imageUrl: url })}
          folder="programs"
          type="image"
          label="Image"
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

