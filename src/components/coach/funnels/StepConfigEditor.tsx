'use client';

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, GripVertical, ImageIcon } from 'lucide-react';
import Image from 'next/image';
import type { FunnelStep, FunnelStepType, FunnelQuestionOption } from '@/types';
import { nanoid } from 'nanoid';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      case 'explainer':
        return <ExplainerConfigEditor config={config} onChange={setConfig} />;
      case 'info':
        // Legacy support - use ExplainerConfigEditor for info steps too
        return <ExplainerConfigEditor config={config} onChange={setConfig} />;
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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold font-albert text-text-primary dark:text-[#f5f5f8] capitalize">
              {step.type.replace(/_/g, ' ')} Configuration
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 font-albert overscroll-contain">
          {/* Step Name - shown for all step types */}
          <div>
            <label className="block text-sm font-medium font-albert text-text-primary dark:text-[#f5f5f8] mb-2">Step Name</label>
            <input
              type="text"
              value={stepName}
              onChange={(e) => setStepName(e.target.value)}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] font-albert"
              placeholder={`e.g., "${step.type.replace(/_/g, ' ')} - Main"`}
            />
            <p className="text-xs font-albert text-text-muted dark:text-[#b2b6c2] mt-1">A custom name to help you identify this step</p>
          </div>

          {/* Step-specific config */}
          {renderConfigEditor()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg transition-colors"
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
  const [uploadingOptionId, setUploadingOptionId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  // Check if any option has an image
  const hasImageOptions = options.some(o => o.imageUrl);

  // Handle inline image upload
  const handleImageUpload = async (optionId: string, file: File) => {
    setUploadingOptionId(optionId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'programs');

      const response = await fetch('/api/admin/upload-media', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      updateOption(optionId, { imageUrl: data.url });
    } catch (err) {
      console.error('Failed to upload image:', err);
    } finally {
      setUploadingOptionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium font-albert text-text-primary dark:text-[#f5f5f8] mb-2">Question Type</label>
        <Select
          value={config.questionType as string || 'single_choice'}
          onValueChange={(value) => onChange({ ...config, questionType: value })}
        >
          <SelectTrigger className="w-full font-albert">
            <SelectValue placeholder="Select question type" />
          </SelectTrigger>
          <SelectContent className="font-albert">
            <SelectItem value="single_choice">Single Choice</SelectItem>
            <SelectItem value="multi_choice">Multiselect</SelectItem>
            <SelectItem value="text">Text Input</SelectItem>
            <SelectItem value="scale">Scale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium font-albert text-text-primary dark:text-[#f5f5f8] mb-2">Question Text *</label>
        <textarea
          value={config.question as string || ''}
          onChange={(e) => onChange({ ...config, question: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] resize-none font-albert"
          rows={2}
          placeholder="Enter your question..."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium font-albert text-text-primary dark:text-[#f5f5f8] mb-2">Field Name</label>
        <input
          type="text"
          value={config.fieldName as string || 'answer'}
          onChange={(e) => onChange({ ...config, fieldName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] font-albert"
          placeholder="e.g., workdayStyle"
        />
        <p className="text-xs font-albert text-text-muted dark:text-[#b2b6c2] mt-1">This is the key used to store the answer</p>
      </div>

      {/* Scale customization - only show for scale type */}
      {config.questionType === 'scale' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium font-albert text-text-primary dark:text-[#f5f5f8] mb-2">Scale Min</label>
              <input
                type="number"
                value={config.scaleMin as number || 1}
                onChange={(e) => onChange({ ...config, scaleMin: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] font-albert"
                min={0}
                max={10}
              />
            </div>
            <div>
              <label className="block text-sm font-medium font-albert text-text-primary dark:text-[#f5f5f8] mb-2">Scale Max</label>
              <input
                type="number"
                value={config.scaleMax as number || 10}
                onChange={(e) => onChange({ ...config, scaleMax: parseInt(e.target.value) || 10 })}
                className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] font-albert"
                min={1}
                max={20}
              />
            </div>
          </div>
          <p className="text-xs font-albert text-text-muted dark:text-[#b2b6c2] -mt-4">Number of scale points: {((config.scaleMax as number || 10) - (config.scaleMin as number || 1) + 1)}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium font-albert text-text-primary dark:text-[#f5f5f8] mb-2">Start Label</label>
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
                className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] font-albert"
                placeholder="e.g., Strongly disagree"
              />
            </div>
            <div>
              <label className="block text-sm font-medium font-albert text-text-primary dark:text-[#f5f5f8] mb-2">End Label</label>
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
                className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] font-albert"
                placeholder="e.g., Strongly agree"
              />
            </div>
          </div>
        </>
      )}

      {(config.questionType === 'single_choice' || config.questionType === 'multi_choice' || !config.questionType) && (
        <div>
          <label className="block text-sm font-medium font-albert text-text-primary dark:text-[#f5f5f8] mb-2">Options *</label>
          <div className="space-y-3">
            {options.map((option) => (
              <div key={option.id} className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-text-muted cursor-grab flex-shrink-0" />
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => updateOption(option.id, { label: e.target.value })}
                    className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] text-sm font-albert"
                    placeholder="Option label (emojis allowed)"
                    required
                  />
                  {/* Inline image thumbnail/upload */}
                  <div className="flex-shrink-0">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      className="hidden"
                      ref={(el) => { fileInputRefs.current[option.id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(option.id, file);
                      }}
                    />
                    {option.imageUrl ? (
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-[#e1ddd8] dark:border-[#262b35] group">
                        <Image
                          src={option.imageUrl}
                          alt={option.label}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                        <button
                          onClick={() => updateOption(option.id, { imageUrl: undefined })}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="Remove image"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRefs.current[option.id]?.click()}
                        disabled={uploadingOptionId === option.id}
                        className="w-10 h-10 rounded-lg border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855] transition-colors flex items-center justify-center"
                        title="Add image"
                      >
                        {uploadingOptionId === option.id ? (
                          <div className="w-4 h-4 border-2 border-[#a07855] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-text-muted" />
                        )}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => removeOption(option.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={addOption}
              className="w-full py-2 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-secondary dark:text-[#b2b6c2] hover:border-[#a07855] hover:text-[#a07855] transition-colors flex items-center justify-center gap-2 font-albert"
            >
              <Plus className="w-4 h-4" />
              Add Option
            </button>
          </div>

          {/* Image Display Mode - only show when options have images */}
          {hasImageOptions && (
            <div className="mt-4 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]">
              <label className="block text-sm font-medium font-albert text-text-primary dark:text-[#f5f5f8] mb-2">Image Display Mode</label>
              <Select
                value={config.imageDisplayMode as string || 'card'}
                onValueChange={(value) => onChange({ ...config, imageDisplayMode: value })}
              >
                <SelectTrigger className="w-full font-albert">
                  <SelectValue placeholder="Select display mode" />
                </SelectTrigger>
                <SelectContent className="font-albert">
                  <SelectItem value="inline">Inline (small thumbnail next to text)</SelectItem>
                  <SelectItem value="card">Card (2x2 grid on mobile, 4 on desktop)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs font-albert text-text-muted dark:text-[#b2b6c2] mt-1.5">
                {config.imageDisplayMode === 'inline' 
                  ? 'Images appear as small thumbnails beside each option label'
                  : 'Images appear as larger cards in a grid layout'}
              </p>
            </div>
          )}
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
        <div className="flex items-center gap-2">
          <BrandedCheckbox
            checked={config.showSocialLogin !== false}
            onChange={(checked) => onChange({ ...config, showSocialLogin: checked })}
          />
          <span className="text-text-primary cursor-pointer" onClick={() => onChange({ ...config, showSocialLogin: config.showSocialLogin === false })}>Show social login buttons (Google)</span>
        </div>
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
        <div className="flex items-center gap-2">
          <BrandedCheckbox
            checked={config.useProgramPricing !== false}
            onChange={(checked) => onChange({ ...config, useProgramPricing: checked })}
          />
          <span className="text-text-primary cursor-pointer" onClick={() => onChange({ ...config, useProgramPricing: config.useProgramPricing === false })}>Use program&apos;s default pricing</span>
        </div>
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
        <div className="flex items-center gap-2">
          <BrandedCheckbox
            checked={config.showGraph !== false}
            onChange={(checked) => onChange({ ...config, showGraph: checked })}
          />
          <span className="text-text-primary cursor-pointer" onClick={() => onChange({ ...config, showGraph: config.showGraph === false })}>Show transformation graph</span>
        </div>
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

// Explainer Config Editor - rich media step with layouts
import type { ExplainerMediaType, ExplainerLayout } from '@/types';

const MEDIA_TYPE_OPTIONS: { value: ExplainerMediaType; label: string; description: string }[] = [
  { value: 'image', label: 'Image', description: 'Upload or paste an image URL' },
  { value: 'video_upload', label: 'Video Upload', description: 'Upload a video file' },
  { value: 'youtube', label: 'YouTube', description: 'Paste a YouTube video URL' },
  { value: 'vimeo', label: 'Vimeo', description: 'Paste a Vimeo video URL' },
  { value: 'loom', label: 'Loom', description: 'Paste a Loom share URL' },
  { value: 'iframe', label: 'Embed Code', description: 'Paste an iframe embed code or URL' },
];

const LAYOUT_OPTIONS: { value: ExplainerLayout; label: string; icon: React.ReactNode }[] = [
  { 
    value: 'media_top', 
    label: 'Media Top',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="24" height="10" rx="2" className="fill-current opacity-30" />
        <line x1="6" y1="18" x2="26" y2="18" />
        <line x1="6" y1="22" x2="20" y2="22" />
        <line x1="6" y1="26" x2="26" y2="26" />
      </svg>
    ),
  },
  { 
    value: 'media_bottom', 
    label: 'Media Bottom',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="6" y1="6" x2="26" y2="6" />
        <line x1="6" y1="10" x2="20" y2="10" />
        <rect x="4" y="18" width="24" height="10" rx="2" className="fill-current opacity-30" />
      </svg>
    ),
  },
  { 
    value: 'fullscreen', 
    label: 'Fullscreen',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="24" height="24" rx="2" className="fill-current opacity-30" />
      </svg>
    ),
  },
  { 
    value: 'side_by_side', 
    label: 'Side by Side',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="12" height="24" rx="2" className="fill-current opacity-30" />
        <line x1="20" y1="8" x2="28" y2="8" />
        <line x1="20" y1="12" x2="26" y2="12" />
        <line x1="20" y1="16" x2="28" y2="16" />
        <line x1="20" y1="20" x2="24" y2="20" />
      </svg>
    ),
  },
];

function ExplainerConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const mediaType = (config.mediaType as ExplainerMediaType) || 'image';
  const layout = (config.layout as ExplainerLayout) || 'media_top';
  const isFullscreen = layout === 'fullscreen';

  // Helper to render the appropriate media input based on type
  const renderMediaInput = () => {
    switch (mediaType) {
      case 'image':
        return (
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Image</label>
            <MediaUpload
              value={config.imageUrl as string || ''}
              onChange={(url) => onChange({ ...config, imageUrl: url })}
              folder="programs"
              type="image"
              label="Image"
            />
          </div>
        );
      
      case 'video_upload':
        return (
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Video</label>
            <MediaUpload
              value={config.videoUrl as string || ''}
              onChange={(url) => onChange({ ...config, videoUrl: url })}
              folder="programs"
              type="video"
              label="Video"
            />
          </div>
        );
      
      case 'youtube':
        return (
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">YouTube URL</label>
            <input
              type="url"
              value={config.youtubeUrl as string || ''}
              onChange={(e) => onChange({ ...config, youtubeUrl: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8]"
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
              Paste the full YouTube video URL
            </p>
            {typeof config.youtubeUrl === 'string' && config.youtubeUrl && (
              <div className="mt-3 aspect-video rounded-lg overflow-hidden bg-black/5">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(config.youtubeUrl)}`}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        );
      
      case 'vimeo':
        return (
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Vimeo URL</label>
            <input
              type="url"
              value={config.vimeoUrl as string || ''}
              onChange={(e) => onChange({ ...config, vimeoUrl: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8]"
              placeholder="https://vimeo.com/..."
            />
            <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
              Paste the full Vimeo video URL
            </p>
            {typeof config.vimeoUrl === 'string' && config.vimeoUrl && getVimeoId(config.vimeoUrl) && (
              <div className="mt-3 aspect-video rounded-lg overflow-hidden bg-black/5">
                <iframe
                  src={`https://player.vimeo.com/video/${getVimeoId(config.vimeoUrl)}?dnt=1`}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        );
      
      case 'loom':
        return (
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Loom URL</label>
            <input
              type="url"
              value={config.loomUrl as string || ''}
              onChange={(e) => onChange({ ...config, loomUrl: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8]"
              placeholder="https://www.loom.com/share/..."
            />
            <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
              Paste the Loom share URL
            </p>
            {typeof config.loomUrl === 'string' && config.loomUrl && getLoomId(config.loomUrl) && (
              <div className="mt-3 aspect-video rounded-lg overflow-hidden bg-black/5">
                <iframe
                  src={`https://www.loom.com/embed/${getLoomId(config.loomUrl)}?hide_owner=true&hide_share=true`}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        );
      
      case 'iframe':
        return (
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Embed Code or URL</label>
            <textarea
              value={config.iframeCode as string || ''}
              onChange={(e) => onChange({ ...config, iframeCode: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] resize-none font-mono text-sm"
              rows={4}
              placeholder='<iframe src="..." ...></iframe> or https://...'
            />
            <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
              Paste an iframe embed code or a direct URL
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Media Type Selector */}
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Media Type</label>
        <Select
          value={mediaType}
          onValueChange={(value) => onChange({ ...config, mediaType: value as ExplainerMediaType })}
        >
          <SelectTrigger className="w-full font-albert">
            <SelectValue placeholder="Select media type" />
          </SelectTrigger>
          <SelectContent className="font-albert">
            {MEDIA_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
          {MEDIA_TYPE_OPTIONS.find(o => o.value === mediaType)?.description}
        </p>
      </div>

      {/* Media Input (dynamic based on type) */}
      {renderMediaInput()}

      {/* Video Options - show for video types */}
      {(mediaType === 'video_upload' || mediaType === 'youtube' || mediaType === 'vimeo') && (
        <div className="p-4 bg-[#faf8f6] dark:bg-[#1a1f28] rounded-lg border border-[#e1ddd8] dark:border-[#262b35] space-y-3">
          <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8]">Video Options</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <BrandedCheckbox
                checked={config.autoplay as boolean || false}
                onChange={(checked) => onChange({ ...config, autoplay: checked, muted: checked ? true : config.muted })}
              />
              <span className="text-sm text-text-primary dark:text-[#f5f5f8]">Autoplay</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <BrandedCheckbox
                checked={config.muted as boolean || false}
                onChange={(checked) => onChange({ ...config, muted: checked })}
              />
              <span className="text-sm text-text-primary dark:text-[#f5f5f8]">Muted</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <BrandedCheckbox
                checked={config.loop as boolean || false}
                onChange={(checked) => onChange({ ...config, loop: checked })}
              />
              <span className="text-sm text-text-primary dark:text-[#f5f5f8]">Loop</span>
            </label>
          </div>
          {!!config.autoplay && (
            <p className="text-xs text-text-muted dark:text-[#b2b6c2]">
              Note: Autoplay requires video to be muted (browser policy)
            </p>
          )}
        </div>
      )}

      {/* Layout Selector */}
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Layout</label>
        <div className="grid grid-cols-4 gap-2">
          {LAYOUT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...config, layout: option.value })}
              className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                layout === option.value
                  ? 'border-[#a07855] bg-[#a07855]/5 text-[#a07855]'
                  : 'border-[#e1ddd8] dark:border-[#262b35] text-text-muted hover:border-[#a07855]/50'
              }`}
            >
              {option.icon}
              <span className="text-xs font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Text Content - hide heading/body for fullscreen layout */}
      {!isFullscreen && (
        <>
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Heading</label>
            <input
              type="text"
              value={config.heading as string || ''}
              onChange={(e) => onChange({ ...config, heading: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8]"
              placeholder="Welcome"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Body</label>
            <textarea
              value={config.body as string || ''}
              onChange={(e) => onChange({ ...config, body: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] resize-none"
              rows={4}
              placeholder="Your information text..."
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Button Text</label>
        <input
          type="text"
          value={config.ctaText as string || ''}
          onChange={(e) => onChange({ ...config, ctaText: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8]"
          placeholder="Continue"
        />
      </div>
    </div>
  );
}

// URL ID extraction helpers for preview
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&?#]+)/,
    /youtube\.com\/shorts\/([^&?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function getVimeoId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /vimeo\.com\/video\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function getLoomId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /loom\.com\/share\/([a-zA-Z0-9]+)/,
    /loom\.com\/embed\/([a-zA-Z0-9]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// Info Config Editor - Legacy, redirects to ExplainerConfigEditor
// Kept for backward compatibility
function InfoConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  // Migrate legacy config to new format
  const migratedConfig = {
    ...config,
    mediaType: config.mediaType || 'image',
    layout: config.layout || 'media_top',
  };
  return <ExplainerConfigEditor config={migratedConfig} onChange={onChange} />;
}

// Success Config Editor
function SuccessConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const skipSuccessPage = config.skipSuccessPage as boolean || false;
  const showConfetti = config.showConfetti !== false;
  
  // Music tracks state
  const [tracks, setTracks] = React.useState<Array<{ id: string; name: string; url: string }>>([]);
  const [isLoadingTracks, setIsLoadingTracks] = React.useState(false);
  const [previewAudio, setPreviewAudio] = React.useState<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = React.useState<string | null>(null);
  
  // Fetch music tracks on mount
  React.useEffect(() => {
    async function fetchTracks() {
      setIsLoadingTracks(true);
      try {
        const res = await fetch('/api/music/list');
        const data = await res.json();
        if (data.success && data.tracks) {
          setTracks(data.tracks);
        }
      } catch (err) {
        console.error('Failed to fetch music tracks:', err);
      } finally {
        setIsLoadingTracks(false);
      }
    }
    fetchTracks();
  }, []);
  
  // Cleanup audio on unmount
  React.useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [previewAudio]);
  
  const handlePreviewToggle = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    // If clicking the same track that's playing, stop it
    if (playingTrackId === trackId && previewAudio) {
      previewAudio.pause();
      setPlayingTrackId(null);
      return;
    }
    
    // Stop any currently playing audio
    if (previewAudio) {
      previewAudio.pause();
    }
    
    // Create new audio and play
    const audio = new Audio(track.url);
    audio.volume = 0.5;
    audio.onended = () => setPlayingTrackId(null);
    audio.onerror = () => {
      console.error('Failed to play track:', track.url);
      setPlayingTrackId(null);
    };
    audio.play()
      .then(() => setPlayingTrackId(trackId))
      .catch(err => {
        console.error('Failed to play:', err);
        setPlayingTrackId(null);
      });
    setPreviewAudio(audio);
  };
  
  const handleTrackChange = (trackId: string) => {
    // Stop preview if playing
    if (previewAudio) {
      previewAudio.pause();
      setPlayingTrackId(null);
    }
    onChange({ ...config, celebrationSound: trackId || undefined });
  };
  
  return (
    <div className="space-y-6">
      {/* Skip success page option */}
      <div className="p-4 bg-[#faf8f6] dark:bg-[#1a1f28] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex items-start gap-3">
          <BrandedCheckbox
            checked={skipSuccessPage}
            onChange={(checked) => onChange({ ...config, skipSuccessPage: checked })}
            className="mt-0.5"
          />
          <div className="cursor-pointer" onClick={() => onChange({ ...config, skipSuccessPage: !skipSuccessPage })}>
            <span className="text-text-primary dark:text-[#f5f5f8] font-medium">Skip success page</span>
            <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
              Redirect users directly to homepage after completing the funnel
            </p>
          </div>
        </div>
        
        {skipSuccessPage && (
          <div className="mt-4 pl-6">
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
              Custom Redirect URL (optional)
            </label>
            <input
              type="text"
              value={config.skipSuccessRedirect as string || ''}
              onChange={(e) => onChange({ ...config, skipSuccessRedirect: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8]"
              placeholder="/ (homepage)"
            />
            <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
              Leave empty to redirect to homepage. Use relative paths like /dashboard
            </p>
          </div>
        )}
      </div>

      {/* Only show customization options if not skipping */}
      {!skipSuccessPage && (
        <>
          <div>
            <div className="flex items-center gap-2">
              <BrandedCheckbox
                checked={showConfetti}
                onChange={(checked) => onChange({ ...config, showConfetti: checked })}
              />
              <span className="text-text-primary dark:text-[#f5f5f8] cursor-pointer" onClick={() => onChange({ ...config, showConfetti: !showConfetti })}>Show confetti animation</span>
            </div>
          </div>

          {/* Celebration Music - only show when confetti is enabled */}
          {showConfetti && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
                Celebration Music
              </label>
              {isLoadingTracks ? (
                <p className="text-sm text-text-muted dark:text-[#b2b6c2]">Loading tracks...</p>
              ) : (
                <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg divide-y divide-[#e1ddd8] dark:divide-[#262b35] max-h-[240px] overflow-y-auto">
                  {/* None option */}
                  <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-[#1a1f28] transition-colors">
                    <input
                      type="radio"
                      name="celebrationSound"
                      value=""
                      checked={!config.celebrationSound}
                      onChange={() => handleTrackChange('')}
                      className="w-4 h-4 accent-[#a07855]"
                    />
                    <span className="text-sm text-text-primary dark:text-[#f5f5f8] flex-1">None</span>
                  </label>
                  {/* Track options */}
                  {tracks.map(track => (
                    <label 
                      key={track.id} 
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-[#1a1f28] transition-colors"
                    >
                      <input
                        type="radio"
                        name="celebrationSound"
                        value={track.id}
                        checked={config.celebrationSound === track.id}
                        onChange={() => handleTrackChange(track.id)}
                        className="w-4 h-4 accent-[#a07855]"
                      />
                      <span className="text-sm text-text-primary dark:text-[#f5f5f8] flex-1">{track.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePreviewToggle(track.id);
                        }}
                        className="p-1.5 rounded-full hover:bg-[#a07855]/10 transition-colors"
                        title={playingTrackId === track.id ? 'Stop' : 'Preview'}
                      >
                        {playingTrackId === track.id ? (
                          <svg className="w-4 h-4 text-[#a07855]" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-text-muted dark:text-[#b2b6c2]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1.5">
                Music plays with confetti animation
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Redirect Delay (ms)</label>
            <input
              type="number"
              value={config.redirectDelay as number || 3000}
              onChange={(e) => onChange({ ...config, redirectDelay: parseInt(e.target.value) || 3000 })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8]"
            />
            <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">Time before redirecting to dashboard</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Custom Heading</label>
            <input
              type="text"
              value={config.heading as string || ''}
              onChange={(e) => onChange({ ...config, heading: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8]"
              placeholder="Welcome to [Program]! 🎉"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Custom Body</label>
            <textarea
              value={config.body as string || ''}
              onChange={(e) => onChange({ ...config, body: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:text-[#f5f5f8] resize-none"
              rows={2}
              placeholder="You're all set! Taking you to your dashboard..."
            />
          </div>
        </>
      )}
    </div>
  );
}

