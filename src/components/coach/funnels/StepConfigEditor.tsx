'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, GripVertical, ImageIcon, Video, Youtube, PlayCircle, Monitor, Code, Sparkles, Lock } from 'lucide-react';
import Image from 'next/image';
import type { FunnelStep, FunnelStepType, FunnelQuestionOption, InfluencePromptConfig, FunnelStepTrackingConfig, MetaPixelEvent, CoachTier } from '@/types';
import { nanoid } from 'nanoid';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LandingPageEditor, type LandingPageFormData } from '@/components/shared/LandingPageEditor';
import { InfluencePromptEditor } from './InfluencePromptEditor';
import { AIHelperModal } from '@/components/ai';
import type { LandingPageDraft, ProgramContentDraft, AIGenerationContext } from '@/lib/ai/types';
import { hasPermission } from '@/lib/coach-permissions';
import { Button } from '@/components/ui/button';

interface StepConfigEditorProps {
  step: FunnelStep;
  onClose: () => void;
  onSave: (config: unknown, name?: string, influencePrompt?: InfluencePromptConfig, tracking?: FunnelStepTrackingConfig) => void;
}

// Meta Pixel event options for dropdown
const META_PIXEL_EVENTS: { value: MetaPixelEvent; label: string; description: string }[] = [
  { value: 'PageView', label: 'Page View', description: 'User viewed this step' },
  { value: 'ViewContent', label: 'View Content', description: 'Viewing specific content' },
  { value: 'Lead', label: 'Lead', description: 'Lead generation' },
  { value: 'CompleteRegistration', label: 'Complete Registration', description: 'Account creation' },
  { value: 'InitiateCheckout', label: 'Initiate Checkout', description: 'Started checkout process' },
  { value: 'AddToCart', label: 'Add to Cart', description: 'Added to cart' },
  { value: 'Purchase', label: 'Purchase', description: 'Completed purchase' },
  { value: 'Subscribe', label: 'Subscribe', description: 'Newsletter/subscription signup' },
  { value: 'Contact', label: 'Contact', description: 'Contact form submission' },
  { value: 'StartTrial', label: 'Start Trial', description: 'Started free trial' },
  { value: 'SubmitApplication', label: 'Submit Application', description: 'Application submitted' },
];

export function StepConfigEditor({ step, onClose, onSave }: StepConfigEditorProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    ((step.config as unknown) as { config: Record<string, unknown> })?.config || {}
  );
  const [stepName, setStepName] = useState(step.name || '');
  const [influencePrompt, setInfluencePrompt] = useState<InfluencePromptConfig | undefined>(
    step.influencePrompt
  );
  const [tracking, setTracking] = useState<FunnelStepTrackingConfig | undefined>(
    step.tracking
  );
  const [showTrackingSettings, setShowTrackingSettings] = useState(
    !!(step.tracking?.metaEvent || step.tracking?.googleEvent || step.tracking?.customHtml)
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Clean up tracking config - only include non-empty values
    let cleanedTracking: FunnelStepTrackingConfig | undefined = undefined;
    if (tracking) {
      const hasValues = tracking.metaEvent || tracking.googleEvent || tracking.googleAdsConversionLabel || tracking.customHtml;
      if (hasValues) {
        cleanedTracking = {};
        if (tracking.metaEvent) cleanedTracking.metaEvent = tracking.metaEvent;
        if (tracking.googleEvent) cleanedTracking.googleEvent = tracking.googleEvent;
        if (tracking.googleAdsConversionLabel) cleanedTracking.googleAdsConversionLabel = tracking.googleAdsConversionLabel;
        if (tracking.customHtml) cleanedTracking.customHtml = tracking.customHtml;
      }
    }
    await onSave(config, stepName.trim() || undefined, influencePrompt, cleanedTracking);
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
      case 'landing_page':
        return <LandingPageConfigEditor config={config} onChange={setConfig} onClose={onClose} />;
      case 'upsell':
        return <UpsellConfigEditor config={config} onChange={setConfig} />;
      case 'downsell':
        return <DownsellConfigEditor config={config} onChange={setConfig} />;
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
        className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl shadow-black/10 dark:shadow-black/30 max-h-[90vh] overflow-hidden flex flex-col"
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
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] font-albert"
              placeholder={`e.g., "${step.type.replace(/_/g, ' ')} - Main"`}
            />
            <p className="text-xs font-albert text-text-muted dark:text-[#b2b6c2] mt-1">A custom name to help you identify this step</p>
          </div>

          {/* Step-specific config */}
          {renderConfigEditor()}

          {/* Influence Prompt Editor - available for all step types except success */}
          {step.type !== 'success' && (
            <InfluencePromptEditor
              value={influencePrompt}
              onChange={setInfluencePrompt}
            />
          )}

          {/* Tracking Events Section - Collapsible */}
          <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTrackingSettings(!showTrackingSettings)}
              className="w-full flex items-center justify-between p-4 bg-[#faf8f6] dark:bg-[#1a1f27] hover:bg-[#f5f3f0] dark:hover:bg-[#1e232c] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Code className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
                <div className="text-left">
                  <span className="font-medium text-text-primary dark:text-[#f5f5f8] font-albert">Tracking Events</span>
                  <p className="text-xs text-text-muted dark:text-[#7f8694] mt-0.5 font-albert">
                    Fire Meta or Google events when this step is reached
                  </p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-text-secondary dark:text-[#b2b6c2] transition-transform ${showTrackingSettings ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showTrackingSettings && (
              <div className="p-4 space-y-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                {/* Meta Pixel Event */}
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2 font-albert">
                    Meta Pixel Event
                  </label>
                  <Select
                    value={tracking?.metaEvent || 'none'}
                    onValueChange={(value) => setTracking(prev => ({
                      ...prev,
                      metaEvent: value === 'none' ? undefined : value as MetaPixelEvent,
                    }))}
                  >
                    <SelectTrigger className="w-full font-albert">
                      <SelectValue placeholder="Select an event (optional)" />
                    </SelectTrigger>
                    <SelectContent className="font-albert">
                      <SelectItem value="none">None</SelectItem>
                      {META_PIXEL_EVENTS.map((event) => (
                        <SelectItem key={event.value} value={event.value}>
                          {event.label} - {event.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text-muted dark:text-[#7f8694] mt-1 font-albert">
                    Event fires when user reaches this step
                  </p>
                </div>

                {/* Google Analytics Event */}
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2 font-albert">
                    Google Analytics Event
                  </label>
                  <input
                    type="text"
                    value={tracking?.googleEvent || ''}
                    onChange={(e) => setTracking(prev => ({
                      ...prev,
                      googleEvent: e.target.value || undefined,
                    }))}
                    className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] font-albert"
                    placeholder="e.g., funnel_step_signup"
                  />
                  <p className="text-xs text-text-muted dark:text-[#7f8694] mt-1 font-albert">
                    Custom GA4 event name (use snake_case)
                  </p>
                </div>

                {/* Google Ads Conversion Label */}
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2 font-albert">
                    Google Ads Conversion Label
                  </label>
                  <input
                    type="text"
                    value={tracking?.googleAdsConversionLabel || ''}
                    onChange={(e) => setTracking(prev => ({
                      ...prev,
                      googleAdsConversionLabel: e.target.value || undefined,
                    }))}
                    className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] font-albert"
                    placeholder="e.g., AbC123_xyz"
                  />
                  <p className="text-xs text-text-muted dark:text-[#7f8694] mt-1 font-albert">
                    Conversion label (requires Google Ads ID set at funnel level)
                  </p>
                </div>

                {/* Custom HTML/Script */}
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2 font-albert">
                    Custom Tracking Code
                  </label>
                  <textarea
                    value={tracking?.customHtml || ''}
                    onChange={(e) => setTracking(prev => ({
                      ...prev,
                      customHtml: e.target.value || undefined,
                    }))}
                    className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent resize-none font-mono text-sm dark:text-[#f5f5f8]"
                    rows={3}
                    placeholder="<!-- TikTok, Snapchat, or other pixel events -->"
                  />
                  <p className="text-xs text-text-muted dark:text-[#7f8694] mt-1 font-albert">
                    Custom scripts executed when this step is reached
                  </p>
                </div>
              </div>
            )}
          </div>
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
            className="flex-1 py-2 px-4 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] resize-none font-albert"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] font-albert"
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
                className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] font-albert"
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
                className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] font-albert"
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
                className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] font-albert"
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
                className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] font-albert"
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
                    className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] text-sm font-albert"
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
                        className="w-10 h-10 rounded-lg border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent transition-colors flex items-center justify-center"
                        title="Add image"
                      >
                        {uploadingOptionId === option.id ? (
                          <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
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
              className="w-full py-2 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-secondary dark:text-[#b2b6c2] hover:border-brand-accent hover:text-brand-accent transition-colors flex items-center justify-center gap-2 font-albert"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
          placeholder="Create your account"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Subheading</label>
        <input
          type="text"
          value={config.subheading as string || ''}
          onChange={(e) => onChange({ ...config, subheading: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
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
            className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Example Goals</label>
        <textarea
          value={examples.join('\n')}
          onChange={(e) => onChange({ ...config, examples: e.target.value.split('\n').filter(Boolean) })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent resize-none"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent resize-none"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
          placeholder="Who are you becoming?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Prompt Text</label>
        <input
          type="text"
          value={config.promptText as string || ''}
          onChange={(e) => onChange({ ...config, promptText: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
        />
        <p className="text-xs text-text-muted mt-1">e.g., 3000 = 3 seconds</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Messages</label>
        <textarea
          value={messages.join('\n')}
          onChange={(e) => onChange({ ...config, messages: e.target.value.split('\n').filter(Boolean) })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent resize-none"
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
              className="text-sm text-brand-accent hover:text-brand-accent/90 font-medium"
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
                    className="w-full px-3 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent text-sm"
                    placeholder="John D."
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-text-muted mb-1">Quote</label>
                  <textarea
                    value={testimonial.text}
                    onChange={(e) => updateTestimonial(index, { text: e.target.value })}
                    className="w-full px-3 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent text-sm resize-none"
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
                    uploadEndpoint="/api/coach/org-upload-media"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
          placeholder="Your {X}-month plan is ready!"
        />
        <p className="text-xs text-text-muted mt-1">Use {'{X}'} to insert the timeline duration</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Custom Body</label>
        <textarea
          value={config.body as string || ''}
          onChange={(e) => onChange({ ...config, body: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent resize-none"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
          placeholder="Continue"
        />
      </div>
    </div>
  );
}

// Explainer Config Editor - rich media step with layouts
import type { ExplainerMediaType, ExplainerLayout } from '@/types';

const MEDIA_TYPE_OPTIONS: { value: ExplainerMediaType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'image', label: 'Image', description: 'Upload or paste an image URL', icon: <ImageIcon className="w-5 h-5" /> },
  { value: 'video_upload', label: 'Video', description: 'Upload a video file', icon: <Video className="w-5 h-5" /> },
  { value: 'youtube', label: 'YouTube', description: 'Paste a YouTube video URL', icon: <Youtube className="w-5 h-5" /> },
  { value: 'vimeo', label: 'Vimeo', description: 'Paste a Vimeo video URL', icon: <PlayCircle className="w-5 h-5" /> },
  { value: 'loom', label: 'Loom', description: 'Paste a Loom share URL', icon: <Monitor className="w-5 h-5" /> },
  { value: 'iframe', label: 'Embed', description: 'Paste an iframe embed code or URL', icon: <Code className="w-5 h-5" /> },
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
          <MediaUpload
            value={config.imageUrl as string || ''}
            onChange={(url) => onChange({ ...config, imageUrl: url })}
            folder="programs"
            type="image"
            label="Image"
            uploadEndpoint="/api/coach/org-upload-media"
          />
        );
      
      case 'video_upload':
        return (
          <MediaUpload
            value={config.videoUrl as string || ''}
            onChange={(url) => onChange({ ...config, videoUrl: url })}
            folder="programs"
            type="video"
            label="Video"
            uploadEndpoint="/api/coach/org-upload-media"
          />
        );
      
      case 'youtube':
        return (
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">YouTube URL</label>
            <input
              type="url"
              value={config.youtubeUrl as string || ''}
              onChange={(e) => onChange({ ...config, youtubeUrl: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
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
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
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
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
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
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] resize-none font-mono text-sm"
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
        <div className="grid grid-cols-3 gap-2">
          {MEDIA_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...config, mediaType: option.value })}
              className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                mediaType === option.value
                  ? 'border-brand-accent bg-brand-accent/5 text-brand-accent'
                  : 'border-[#e1ddd8] dark:border-[#262b35] text-text-muted hover:border-brand-accent/50'
              }`}
            >
              {option.icon}
              <span className="text-xs font-medium">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-2">
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
                  ? 'border-brand-accent bg-brand-accent/5 text-brand-accent'
                  : 'border-[#e1ddd8] dark:border-[#262b35] text-text-muted hover:border-brand-accent/50'
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
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
              placeholder="Welcome"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Body</label>
            <textarea
              value={config.body as string || ''}
              onChange={(e) => onChange({ ...config, body: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] resize-none"
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
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
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
  const [isMusicDrawerOpen, setIsMusicDrawerOpen] = React.useState(false);
  
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
    // Close drawer after selection
    setIsMusicDrawerOpen(false);
  };
  
  // Get selected track name for display
  const selectedTrackName = React.useMemo(() => {
    if (!config.celebrationSound) return 'None';
    const track = tracks.find(t => t.id === config.celebrationSound);
    return track?.name || 'None';
  }, [config.celebrationSound, tracks]);
  
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
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
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
                <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg overflow-hidden">
                  {/* Drawer Header - shows selected track */}
                  <button
                    type="button"
                    onClick={() => setIsMusicDrawerOpen(!isMusicDrawerOpen)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-[#11141b] hover:bg-[#faf8f6] dark:hover:bg-[#1a1f28] transition-colors"
                  >
                    <svg className="w-4 h-4 text-brand-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <span className="text-sm text-text-primary dark:text-[#f5f5f8] flex-1 text-left">{selectedTrackName}</span>
                    <svg 
                      className={`w-4 h-4 text-text-muted dark:text-[#b2b6c2] transition-transform duration-200 ${isMusicDrawerOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Drawer Content - track options */}
                  <motion.div
                    initial={false}
                    animate={{ 
                      height: isMusicDrawerOpen ? 'auto' : 0,
                      opacity: isMusicDrawerOpen ? 1 : 0
                    }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-[#e1ddd8] dark:border-[#262b35] divide-y divide-[#e1ddd8] dark:divide-[#262b35] max-h-[200px] overflow-y-auto">
                      {/* None option */}
                      <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-[#1a1f28] transition-colors ${!config.celebrationSound ? 'bg-brand-accent/5' : ''}`}>
                        <input
                          type="radio"
                          name="celebrationSound"
                          value=""
                          checked={!config.celebrationSound}
                          onChange={() => handleTrackChange('')}
                          className="w-4 h-4 accent-brand-accent"
                        />
                        <span className="text-sm text-text-primary dark:text-[#f5f5f8] flex-1">None</span>
                      </label>
                      {/* Track options */}
                      {tracks.map(track => (
                        <label 
                          key={track.id} 
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-[#1a1f28] transition-colors ${config.celebrationSound === track.id ? 'bg-brand-accent/5' : ''}`}
                        >
                          <input
                            type="radio"
                            name="celebrationSound"
                            value={track.id}
                            checked={config.celebrationSound === track.id}
                            onChange={() => handleTrackChange(track.id)}
                            className="w-4 h-4 accent-brand-accent"
                          />
                          <span className="text-sm text-text-primary dark:text-[#f5f5f8] flex-1">{track.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handlePreviewToggle(track.id);
                            }}
                            className="p-1.5 rounded-full hover:bg-brand-accent/10 transition-colors"
                            title={playingTrackId === track.id ? 'Stop' : 'Preview'}
                          >
                            {playingTrackId === track.id ? (
                              <svg className="w-4 h-4 text-brand-accent" fill="currentColor" viewBox="0 0 24 24">
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
                  </motion.div>
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
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
            />
            <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">Time before redirecting to dashboard</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Custom Heading</label>
            <input
              type="text"
              value={config.heading as string || ''}
              onChange={(e) => onChange({ ...config, heading: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
              placeholder="Welcome to [Program]! 🎉"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">Custom Body</label>
            <textarea
              value={config.body as string || ''}
              onChange={(e) => onChange({ ...config, body: e.target.value })}
              className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] resize-none"
              rows={2}
              placeholder="You're all set! Taking you to your dashboard..."
            />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// LANDING PAGE CONFIG EDITOR
// ============================================================================

interface LandingPageConfigEditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  onClose: () => void;
}

function LandingPageConfigEditor({ config, onChange }: LandingPageConfigEditorProps) {
  // AI Helper state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [currentTier, setCurrentTier] = useState<CoachTier>('starter');
  const [isLoadingTier, setIsLoadingTier] = useState(true);
  
  // Fetch current tier for AI feature gating
  useEffect(() => {
    const fetchTier = async () => {
      try {
        const response = await fetch('/api/coach/subscription');
        if (response.ok) {
          const data = await response.json();
          if (data.tier) {
            setCurrentTier(data.tier);
          }
        }
      } catch (err) {
        console.error('[LandingPageConfigEditor] Error fetching tier:', err);
      } finally {
        setIsLoadingTier(false);
      }
    };
    fetchTier();
  }, []);
  
  // Check if AI generation is allowed for this tier
  const canUseAI = hasPermission(currentTier, 'ai_landing_page_generation');
  
  // Map config to form data format
  const formData: LandingPageFormData = {
    template: (config.template as LandingPageFormData['template']) || 'classic',
    headline: config.headline as string | undefined,
    subheadline: config.subheadline as string | undefined,
    coachBio: config.coachBio as string | undefined,
    keyOutcomes: config.keyOutcomes as string[] | undefined,
    features: config.features as LandingPageFormData['features'],
    testimonials: config.testimonials as LandingPageFormData['testimonials'],
    faqs: config.faqs as LandingPageFormData['faqs'],
    ctaText: config.ctaText as string | undefined,
    ctaSubtext: config.ctaSubtext as string | undefined,
    showTestimonials: config.showTestimonials as boolean | undefined,
    showFAQ: config.showFAQ as boolean | undefined,
  };

  const handleFormChange = (newData: LandingPageFormData) => {
    onChange({
      ...config,
      ...newData,
    });
  };
  
  // Apply AI-generated landing page content
  const handleApplyAIContent = async (draft: ProgramContentDraft | LandingPageDraft) => {
    const lpDraft = draft as LandingPageDraft;
    
    // Map AI-generated content to landing page config
    onChange({
      ...config,
      headline: lpDraft.hero.title,
      subheadline: lpDraft.hero.subtitle,
      ctaText: lpDraft.hero.primaryCta,
      coachBio: lpDraft.aboutCoach.bio,
      keyOutcomes: lpDraft.whatYoullLearn.items.map(item => `${item.title}: ${item.description}`),
      features: lpDraft.whatsIncluded.items.map((item) => ({
        title: item.title,
        description: item.description,
        icon: '',
      })),
      testimonials: lpDraft.testimonials.map((t) => ({
        text: t.quote,
        author: t.name,
        role: t.role || '',
        rating: 5,
      })),
      faqs: lpDraft.faq.map((f) => ({
        question: f.question,
        answer: f.answer,
      })),
      showTestimonials: true,
      showFAQ: true,
    });
    
    setIsAIModalOpen(false);
  };
  
  // Check if there's existing content
  const hasExistingContent = !!(formData.coachBio || (formData.keyOutcomes && formData.keyOutcomes.length > 0));

  return (
    <div className="space-y-4">
      {/* AI Generation Button */}
      <div className="flex items-center justify-between bg-gradient-to-r from-brand-accent/5 to-brand-accent/10 dark:from-brand-accent/10 dark:to-brand-accent/20 rounded-xl p-4 border border-brand-accent/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-accent/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-brand-accent" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              AI Landing Page Generator
            </h4>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Generate compelling landing page copy with AI
            </p>
          </div>
        </div>
        
        {canUseAI ? (
          <Button
            variant="outline"
            onClick={() => setIsAIModalOpen(true)}
            disabled={isLoadingTier}
            className="border-brand-accent text-brand-accent hover:bg-brand-accent/10 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Generate with AI
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-brand-accent/20 text-brand-accent px-2 py-1 rounded-full font-medium">
              Pro
            </span>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/coach/plan'}
              className="border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Upgrade to Unlock
            </Button>
          </div>
        )}
      </div>
      
      {/* Landing Page Editor */}
      <LandingPageEditor 
        formData={formData} 
        onChange={handleFormChange}
        showHeadline={true}
        isFunnel={true}
      />
      
      {/* AI Helper Modal */}
      <AIHelperModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        title="Generate Landing Page"
        description="Create compelling landing page copy for your funnel"
        useCase="LANDING_PAGE_PROGRAM"
        context={{
          programName: formData.headline || 'Your Program',
          niche: formData.subheadline?.slice(0, 100),
        } as AIGenerationContext}
        onApply={handleApplyAIContent}
        hasExistingContent={hasExistingContent}
        overwriteWarning="This will replace your existing landing page content."
      />
    </div>
  );
}

// ============================================================================
// UPSELL CONFIG EDITOR
// ============================================================================

interface UpsellDownsellConfigEditorProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

// Helper component to avoid TypeScript inference issues with conditionally rendered discount input
function DiscountValueInput({
  showDiscountUI,
  isPercentDiscount,
  isFixedDiscount,
  discountValue,
  originalPriceInCents,
  onChange,
  config,
}: {
  showDiscountUI: boolean;
  isPercentDiscount: boolean;
  isFixedDiscount: boolean;
  discountValue: number;
  originalPriceInCents: number;
  onChange: (config: Record<string, unknown>) => void;
  config: Record<string, unknown>;
}): React.ReactElement | null {
  if (!showDiscountUI) return null;
  
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
        {isPercentDiscount ? 'Discount Percentage' : 'Discount Amount'}
      </label>
      <div className="flex items-center gap-2">
        {isFixedDiscount ? <span className="text-text-secondary">$</span> : null}
        <input
          type="number"
          value={isFixedDiscount ? discountValue / 100 : discountValue}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0;
            onChange({ 
              ...config, 
              discountValue: isFixedDiscount ? Math.round(val * 100) : val,
            });
          }}
          className="w-32 px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
          min={0}
          max={isPercentDiscount ? 100 : originalPriceInCents / 100}
        />
        {isPercentDiscount ? <span className="text-text-secondary">%</span> : null}
      </div>
    </div>
  );
}

// Helper component for final price preview
function FinalPricePreview({
  showDiscountUI,
  originalPriceInCents,
  finalPriceInCents,
}: {
  showDiscountUI: boolean;
  originalPriceInCents: number;
  finalPriceInCents: number;
}): React.ReactElement {
  return (
    <div className="pt-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary dark:text-[#b2b6c2]">Final Price:</span>
        <div className="flex items-center gap-2">
          {showDiscountUI ? (
            <span className="text-text-muted line-through">
              ${(originalPriceInCents / 100).toFixed(2)}
            </span>
          ) : null}
          <span className="text-xl font-bold text-brand-accent">
            ${(finalPriceInCents / 100).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function UpsellConfigEditor({ config, onChange }: UpsellDownsellConfigEditorProps) {
  return <UpsellDownsellConfigForm config={config} onChange={onChange} type="upsell" />;
}

function DownsellConfigEditor({ config, onChange }: UpsellDownsellConfigEditorProps) {
  return <UpsellDownsellConfigForm config={config} onChange={onChange} type="downsell" />;
}

function UpsellDownsellConfigForm({ 
  config, 
  onChange,
  type,
}: UpsellDownsellConfigEditorProps & { type: 'upsell' | 'downsell' }): React.JSX.Element {
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [products, setProducts] = useState<Array<{ id: string; name: string; imageUrl?: string; priceInCents: number }>>([]);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [isCreatingPrice, setIsCreatingPrice] = useState(false);
  
  // Create strongly typed local config to prevent 'unknown' type inference issues
  interface UpsellConfig {
    productType: 'program' | 'squad' | 'article' | 'course';
    productId?: string;
    productName?: string;
    productImageUrl?: string;
    originalPriceInCents: number;
    finalPriceInCents: number;
    discountType: 'none' | 'percent' | 'fixed';
    discountValue: number;
    headline?: string;
    description?: string;
    ctaText?: string;
    declineText?: string;
    isRecurring?: boolean;
    recurringInterval?: string;
    stripePriceId?: string;
    stripeCouponId?: string;
    currency?: string;
    linkedDownsellStepId?: string;
  }
  
  const typedConfig: UpsellConfig = {
    productType: (config.productType as 'program' | 'squad' | 'article' | 'course') || 'program',
    productId: config.productId as string | undefined,
    productName: config.productName as string | undefined,
    productImageUrl: config.productImageUrl as string | undefined,
    originalPriceInCents: (config.originalPriceInCents as number) || 0,
    finalPriceInCents: (config.finalPriceInCents as number) || 0,
    discountType: (config.discountType as 'none' | 'percent' | 'fixed') || 'none',
    discountValue: (config.discountValue as number) || 0,
    headline: config.headline as string | undefined,
    description: config.description as string | undefined,
    ctaText: config.ctaText as string | undefined,
    declineText: config.declineText as string | undefined,
    isRecurring: config.isRecurring as boolean | undefined,
    recurringInterval: config.recurringInterval as string | undefined,
    stripePriceId: config.stripePriceId as string | undefined,
    stripeCouponId: config.stripeCouponId as string | undefined,
    currency: config.currency as string | undefined,
    linkedDownsellStepId: config.linkedDownsellStepId as string | undefined,
  };
  
  const { productType, discountType, originalPriceInCents, discountValue } = typedConfig;
  
  // Helpers for determining discount display
  const showDiscountUI: boolean = discountType !== 'none';
  const isPercentDiscount: boolean = discountType === 'percent';
  const isFixedDiscount: boolean = discountType === 'fixed';
  
  // Calculate final price
  const calculateFinalPrice = () => {
    if (discountType === 'none') return originalPriceInCents;
    if (discountType === 'percent') return Math.round(originalPriceInCents * (1 - discountValue / 100));
    if (discountType === 'fixed') return Math.max(0, originalPriceInCents - discountValue);
    return originalPriceInCents;
  };
  
  const finalPriceInCents = calculateFinalPrice();
  
  // Fetch products when type changes or on initial mount
  React.useEffect(() => {
    const fetchProducts = async () => {
      setIsLoadingProducts(true);
      try {
        // Determine endpoint based on product type
        let endpoint = '/api/coach/org-programs';
        if (productType === 'squad') endpoint = '/api/coach/org-squads';
        if (productType === 'article') endpoint = '/api/coach/org-discover/articles';
        if (productType === 'course') endpoint = '/api/coach/org-discover/courses';
        
        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          let items: Array<{ id: string; name: string; imageUrl?: string; priceInCents: number }> = [];
          
          if (productType === 'program') {
            items = data.programs?.map((p: { id: string; name: string; coverImageUrl?: string; priceInCents?: number }) => ({
              id: p.id,
              name: p.name,
              imageUrl: p.coverImageUrl,
              priceInCents: p.priceInCents || 0,
            })) || [];
          } else if (productType === 'squad') {
            items = data.squads?.map((s: { id: string; name: string; coverImageUrl?: string; avatarUrl?: string; priceInCents?: number }) => ({
              id: s.id,
              name: s.name,
              imageUrl: s.coverImageUrl || s.avatarUrl,
              priceInCents: s.priceInCents || 0,
            })) || [];
          } else if (productType === 'article') {
            // Filter to only show gated articles (priceInCents > 0)
            items = data.articles
              ?.filter((a: { priceInCents?: number }) => a.priceInCents && a.priceInCents > 0)
              .map((a: { id: string; title: string; coverImageUrl?: string; thumbnailUrl?: string; priceInCents?: number }) => ({
                id: a.id,
                name: a.title,
                imageUrl: a.thumbnailUrl || a.coverImageUrl,
                priceInCents: a.priceInCents || 0,
              })) || [];
          } else if (productType === 'course') {
            // Filter to only show gated courses (priceInCents > 0)
            items = data.courses
              ?.filter((c: { priceInCents?: number }) => c.priceInCents && c.priceInCents > 0)
              .map((c: { id: string; title: string; coverImageUrl?: string; priceInCents?: number }) => ({
                id: c.id,
                name: c.title,
                imageUrl: c.coverImageUrl,
                priceInCents: c.priceInCents || 0,
              })) || [];
          }
          
          setProducts(items);
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setIsLoadingProducts(false);
        setInitialFetchDone(true);
      }
    };
    
    // Always fetch on mount or when productType changes
    fetchProducts();
  }, [productType]);
  
  // Ensure we fetch on mount even if productType hasn't changed
  React.useEffect(() => {
    if (!initialFetchDone && products.length === 0) {
      const fetchInitialProducts = async () => {
        setIsLoadingProducts(true);
        try {
          const endpoint = '/api/coach/org-programs'; // Default to programs
          const response = await fetch(endpoint);
          if (response.ok) {
            const data = await response.json();
            const items = data.programs?.map((p: { id: string; name: string; coverImageUrl?: string; priceInCents?: number }) => ({
              id: p.id,
              name: p.name,
              imageUrl: p.coverImageUrl,
              priceInCents: p.priceInCents || 0,
            }));
            setProducts(items || []);
          }
        } catch (err) {
          console.error('Failed to fetch initial products:', err);
        } finally {
          setIsLoadingProducts(false);
          setInitialFetchDone(true);
        }
      };
      fetchInitialProducts();
    }
  }, [initialFetchDone, products.length]);
  
  // Auto-populate product details when product is selected
  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      onChange({
        ...config,
        productId,
        productName: product.name,
        productImageUrl: product.imageUrl,
        originalPriceInCents: product.priceInCents,
        finalPriceInCents: product.priceInCents, // Reset to original when changing product
        discountType: 'none',
        discountValue: undefined,
      });
    }
  };
  
  // Create Stripe price when saving
  const createStripePrice = async () => {
    if (!typedConfig.productId) return;
    
    setIsCreatingPrice(true);
    try {
      const response = await fetch('/api/funnel/create-upsell-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType,
          productId: typedConfig.productId,
          priceInCents: finalPriceInCents,
          originalPriceInCents,
          discountType,
          discountValue,
          isRecurring: typedConfig.isRecurring || false,
          recurringInterval: typedConfig.recurringInterval || 'month',
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        onChange({
          ...config,
          stripePriceId: data.stripePriceId,
          stripeCouponId: data.stripeCouponId,
          finalPriceInCents,
        });
      }
    } catch (err) {
      console.error('Failed to create Stripe price:', err);
    } finally {
      setIsCreatingPrice(false);
    }
  };
  
  // Auto-update final price when discount changes
  React.useEffect(() => {
    onChange({
      ...config,
      finalPriceInCents,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalPriceInCents]);
  
  
  return (
    <div className="space-y-6">
      {/* Product Type Selector */}
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Product Type
        </label>
        <Select
          value={productType}
          onValueChange={(value) => onChange({ ...config, productType: value, productId: undefined })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select product type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="program">Program</SelectItem>
            <SelectItem value="squad">Squad</SelectItem>
            <SelectItem value="article">Article</SelectItem>
            <SelectItem value="course">Course</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Product Selector */}
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Select {productType === 'program' ? 'Program' : productType === 'squad' ? 'Squad' : productType === 'article' ? 'Article' : 'Course'}
          {(productType === 'article' || productType === 'course') && (
            <span className="text-xs text-text-muted dark:text-[#b2b6c2] ml-1">(gated content only)</span>
          )}
        </label>
        {isLoadingProducts ? (
          <div className="text-text-secondary text-sm">Loading...</div>
        ) : products.length === 0 ? (
          <div className="text-text-secondary text-sm p-3 bg-[#f9f8f6] dark:bg-[#11141b] rounded-lg">
            {(productType === 'article' || productType === 'course') 
              ? `No gated ${productType}s found. To use content as an upsell, set a price on it first.`
              : `No ${productType}s found.`
            }
          </div>
        ) : (
          <Select
            value={typedConfig.productId || ''}
            onValueChange={handleProductChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select a ${productType === 'article' ? 'Article' : productType === 'course' ? 'Course' : productType}`} />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} (${(product.priceInCents / 100).toFixed(2)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      {/* Headline */}
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Headline
        </label>
        <input
          type="text"
          value={typedConfig.headline || ''}
          onChange={(e) => onChange({ ...config, headline: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
          placeholder={type === 'upsell' ? "Wait! Special One-Time Offer" : "Before You Go..."}
        />
      </div>
      
      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Description / Benefits
        </label>
        <textarea
          value={typedConfig.description || ''}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8] resize-none"
          rows={4}
          placeholder="List benefits, one per line:&#10;• Exclusive content&#10;• Community access&#10;• Weekly coaching calls"
        />
        <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
          Use bullet points (•) or new lines to separate benefits
        </p>
      </div>
      
      {/* Pricing Section */}
      <div className="p-4 bg-[#f9f8f6] dark:bg-[#11141b] rounded-xl space-y-4">
        <h4 className="font-medium text-text-primary dark:text-[#f5f5f8]">Pricing</h4>
        
        {/* Original Price (read-only from product) */}
        <div>
          <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
            Original Price (from {productType === 'article' ? 'Article' : productType === 'course' ? 'Course' : productType})
          </label>
          <div className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8]">
            ${(originalPriceInCents / 100).toFixed(2)}
          </div>
        </div>
        
        {/* Discount Type */}
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
            Discount
          </label>
          <Select
            value={discountType}
            onValueChange={(value) => onChange({ 
              ...config, 
              discountType: value,
              discountValue: value === 'none' ? undefined : discountValue,
            })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Discount (Full Price)</SelectItem>
              <SelectItem value="percent">Percentage Off</SelectItem>
              <SelectItem value="fixed">Fixed Amount Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Discount Value - show only when discount is applied */}
        <DiscountValueInput 
          showDiscountUI={showDiscountUI}
          isPercentDiscount={isPercentDiscount}
          isFixedDiscount={isFixedDiscount}
          discountValue={discountValue}
          originalPriceInCents={originalPriceInCents}
          onChange={onChange}
          config={config}
        />
        
        {/* Final Price Preview */}
        <FinalPricePreview 
          showDiscountUI={showDiscountUI}
          originalPriceInCents={originalPriceInCents}
          finalPriceInCents={finalPriceInCents}
        />
        
        {/* Recurring Toggle */}
        <div className="flex items-center gap-3">
          <BrandedCheckbox
            id="isRecurring"
            checked={typedConfig.isRecurring || false}
            onChange={(checked) => onChange({ ...config, isRecurring: checked })}
          />
          <label htmlFor="isRecurring" className="text-sm text-text-primary dark:text-[#f5f5f8]">
            Recurring subscription
          </label>
        </div>
        
        {typedConfig.isRecurring ? (
          <Select
            value={typedConfig.recurringInterval || 'month'}
            onValueChange={(value) => onChange({ ...config, recurringInterval: value })}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        
        {/* Create Stripe Price Button */}
        {typedConfig.productId ? (
          <button
            onClick={createStripePrice}
            disabled={isCreatingPrice}
            className="w-full py-2 px-4 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 transition-colors text-sm"
          >
            {isCreatingPrice ? 'Creating...' : typedConfig.stripePriceId ? 'Update Stripe Price' : 'Create Stripe Price'}
          </button>
        ) : null}
        
        {typedConfig.stripePriceId ? (
          <p className="text-xs text-green-600 dark:text-green-400">
            ✓ Stripe price configured
          </p>
        ) : null}
      </div>
      
      {/* CTA Text */}
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          CTA Button Text
        </label>
        <input
          type="text"
          value={typedConfig.ctaText || ''}
          onChange={(e) => onChange({ ...config, ctaText: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
          placeholder={type === 'upsell' ? "Add to Order" : "Yes, I Want This Deal!"}
        />
      </div>
      
      {/* Decline Text */}
      <div>
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
          Decline Link Text
        </label>
        <input
          type="text"
          value={typedConfig.declineText || ''}
          onChange={(e) => onChange({ ...config, declineText: e.target.value })}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-brand-accent dark:text-[#f5f5f8]"
          placeholder={type === 'upsell' ? "No thanks, skip this offer" : "No thanks, I'll pass"}
        />
      </div>
    </div>
  );
}

