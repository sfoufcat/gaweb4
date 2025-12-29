'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Star,
  Shield,
  Clock,
  Flame,
  Gift,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { InfluencePromptConfig, InfluencePromptType } from '@/types';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { InfluencePromptCard } from '@/components/funnel/InfluencePromptCard';

// Type metadata for the selector
const INFLUENCE_TYPES: {
  type: InfluencePromptType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  example: string;
}[] = [
  {
    type: 'social_proof',
    label: 'Social Proof',
    description: 'Testimonials & success stories',
    icon: Star,
    color: 'bg-amber-100 text-amber-600',
    example: '"This changed my life" — Sarah M.',
  },
  {
    type: 'authority',
    label: 'Authority',
    description: 'Expert endorsements & credentials',
    icon: Shield,
    color: 'bg-blue-100 text-blue-600',
    example: 'Featured in Forbes, Inc., Entrepreneur',
  },
  {
    type: 'urgency',
    label: 'Urgency',
    description: 'Countdown timers & deadlines',
    icon: Clock,
    color: 'bg-red-100 text-red-600',
    example: 'Offer ends in 23:59:59',
  },
  {
    type: 'scarcity',
    label: 'Scarcity',
    description: 'Limited spots & availability',
    icon: Flame,
    color: 'bg-orange-100 text-orange-600',
    example: 'Only 5 spots remaining',
  },
  {
    type: 'reciprocity',
    label: 'Reciprocity',
    description: 'Free bonuses & gifts included',
    icon: Gift,
    color: 'bg-purple-100 text-purple-600',
    example: 'FREE: Goal-Setting Workbook ($197 value)',
  },
  {
    type: 'commitment',
    label: 'Commitment',
    description: 'Progress indicators & milestones',
    icon: CheckCircle2,
    color: 'bg-green-100 text-green-600',
    example: "You're 75% of the way there!",
  },
];

interface InfluencePromptEditorProps {
  value: InfluencePromptConfig | undefined;
  onChange: (config: InfluencePromptConfig | undefined) => void;
}

export function InfluencePromptEditor({ value, onChange }: InfluencePromptEditorProps) {
  const [isExpanded, setIsExpanded] = useState(!!value?.enabled);
  const [showPreview, setShowPreview] = useState(false);
  const [selectingType, setSelectingType] = useState(false);

  const hasPrompt = !!value?.enabled;
  const currentType = INFLUENCE_TYPES.find(t => t.type === value?.type);

  // Create a new prompt with default values
  const addPrompt = (type: InfluencePromptType) => {
    const defaults = getDefaultConfig(type);
    onChange({
      type,
      enabled: true,
      ...defaults,
    });
    setSelectingType(false);
    setIsExpanded(true);
  };

  // Remove the prompt
  const removePrompt = () => {
    onChange(undefined);
    setIsExpanded(false);
  };

  // Update a field in the config
  const updateConfig = (updates: Partial<InfluencePromptConfig>) => {
    if (!value) return;
    onChange({ ...value, ...updates });
  };

  return (
    <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h4 className="font-albert font-semibold text-text-primary dark:text-[#f5f5f8]">
            Influence Prompt
          </h4>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#a07855]/10 text-[#a07855] dark:text-[#b8896a] font-medium">
            Optional
          </span>
        </div>
        
        {hasPrompt && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-white/10 transition-colors"
              title={showPreview ? 'Hide preview' : 'Show preview'}
            >
              {showPreview ? (
                <EyeOff className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
              ) : (
                <Eye className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-white/10 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-text-muted dark:text-[#b2b6c2] mb-4">
        Add a persuasion card at the bottom of this step to boost conversions.
      </p>

      {/* Add prompt button (when none exists) */}
      {!hasPrompt && !selectingType && (
        <button
          type="button"
          onClick={() => setSelectingType(true)}
          className="w-full py-4 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-secondary dark:text-[#b2b6c2] hover:border-[#a07855] dark:border-[#b8896a] hover:text-[#a07855] dark:text-[#b8896a] transition-colors flex items-center justify-center gap-2 font-albert"
        >
          <Plus className="w-5 h-5" />
          Add Influence Prompt
        </button>
      )}

      {/* Type selector */}
      <AnimatePresence>
        {selectingType && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 mb-4">
              {INFLUENCE_TYPES.map((typeInfo) => {
                const Icon = typeInfo.icon;
                return (
                  <button
                    key={typeInfo.type}
                    type="button"
                    onClick={() => addPrompt(typeInfo.type)}
                    className="p-4 rounded-xl border-2 border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855] dark:border-[#b8896a] transition-all text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-albert font-semibold text-text-primary dark:text-[#f5f5f8] group-hover:text-[#a07855] dark:text-[#b8896a] transition-colors">
                          {typeInfo.label}
                        </h5>
                        <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-0.5">
                          {typeInfo.description}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-[#b2b6c2] mt-2 italic truncate">
                          {typeInfo.example}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setSelectingType(false)}
              className="w-full py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current prompt card & editor */}
      {hasPrompt && currentType && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {/* Current type indicator */}
              <div className="flex items-center justify-between p-3 bg-[#faf8f6] dark:bg-[#1a1f28] rounded-xl mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${currentType.color}`}>
                    <currentType.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-albert font-semibold text-text-primary dark:text-[#f5f5f8]">
                      {currentType.label}
                    </h5>
                    <p className="text-xs text-text-muted dark:text-[#b2b6c2]">
                      {currentType.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectingType(true);
                      removePrompt();
                    }}
                    className="text-xs text-[#a07855] dark:text-[#b8896a] hover:text-[#8c6245] font-medium"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={removePrompt}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Type-specific configuration */}
              <div className="space-y-4">
                {/* Shared fields */}
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
                    Custom Headline (optional)
                  </label>
                  <input
                    type="text"
                    value={value?.headline || ''}
                    onChange={(e) => updateConfig({ headline: e.target.value || undefined })}
                    placeholder={`e.g., ${currentType.label}`}
                    className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
                  />
                </div>

                {/* Type-specific fields */}
                {value?.type === 'social_proof' && (
                  <SocialProofFields
                    value={value.testimonial}
                    onChange={(testimonial) => updateConfig({ testimonial })}
                  />
                )}

                {value?.type === 'authority' && (
                  <AuthorityFields
                    value={value.authority}
                    onChange={(authority) => updateConfig({ authority })}
                  />
                )}

                {value?.type === 'urgency' && (
                  <UrgencyFields
                    value={value.urgency}
                    onChange={(urgency) => updateConfig({ urgency })}
                  />
                )}

                {value?.type === 'scarcity' && (
                  <ScarcityFields
                    value={value.scarcity}
                    onChange={(scarcity) => updateConfig({ scarcity })}
                  />
                )}

                {value?.type === 'reciprocity' && (
                  <ReciprocityFields
                    value={value.reciprocity}
                    onChange={(reciprocity) => updateConfig({ reciprocity })}
                  />
                )}

                {value?.type === 'commitment' && (
                  <CommitmentFields
                    value={value.commitment}
                    onChange={(commitment) => updateConfig({ commitment })}
                  />
                )}

                {/* Accent color override */}
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
                    Accent Color (optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={value?.accentColor || '#a07855'}
                      onChange={(e) => updateConfig({ accentColor: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={value?.accentColor || ''}
                      onChange={(e) => updateConfig({ accentColor: e.target.value || undefined })}
                      placeholder="Use org primary color"
                      className="flex-1 px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert text-sm"
                    />
                    {value?.accentColor && (
                      <button
                        type="button"
                        onClick={() => updateConfig({ accentColor: undefined })}
                        className="p-2 text-text-muted hover:text-text-primary transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
                    Leave empty to use your organization&apos;s brand color
                  </p>
                </div>

                {/* Subtext */}
                <div>
                  <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
                    Additional Text (optional)
                  </label>
                  <input
                    type="text"
                    value={value?.subtext || ''}
                    onChange={(e) => updateConfig({ subtext: e.target.value || undefined })}
                    placeholder="Extra context shown below the prompt"
                    className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
                  />
                </div>
              </div>

              {/* Preview */}
              {showPreview && value && (
                <div className="mt-6 p-4 bg-[#faf8f6] dark:bg-[#1a1f28] rounded-xl">
                  <p className="text-xs font-medium text-text-muted dark:text-[#b2b6c2] mb-3 uppercase tracking-wide">
                    Preview
                  </p>
                  <div className="bg-white dark:bg-[#11141b] rounded-xl p-4">
                    <InfluencePromptCard config={value} stepIndex={2} totalSteps={5} />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ============================================================================
// FIELD COMPONENTS
// ============================================================================

function SocialProofFields({
  value,
  onChange,
}: {
  value: InfluencePromptConfig['testimonial'];
  onChange: (v: InfluencePromptConfig['testimonial']) => void;
}) {
  const update = (updates: Partial<NonNullable<typeof value>>) => {
    onChange({ ...value, ...updates } as typeof value);
  };

  return (
    <div className="space-y-4 p-4 bg-[#faf8f6] dark:bg-[#1a1f28] rounded-xl">
      <h5 className="font-albert font-semibold text-text-primary dark:text-[#f5f5f8] text-sm">
        Testimonial
      </h5>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Quote *
        </label>
        <textarea
          value={value?.quote || ''}
          onChange={(e) => update({ quote: e.target.value })}
          placeholder="This program completely changed my life..."
          rows={3}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
            Name *
          </label>
          <input
            type="text"
            value={value?.name || ''}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Sarah M."
            className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
            Role/Title
          </label>
          <input
            type="text"
            value={value?.role || ''}
            onChange={(e) => update({ role: e.target.value || undefined })}
            placeholder="Entrepreneur"
            className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Result Achieved
        </label>
        <input
          type="text"
          value={value?.result || ''}
          onChange={(e) => update({ result: e.target.value || undefined })}
          placeholder="Lost 30 lbs in 90 days"
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
        />
      </div>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Avatar
        </label>
        <MediaUpload
          value={value?.avatarUrl || ''}
          onChange={(url) => update({ avatarUrl: url || undefined })}
          folder="programs"
          type="image"
          label="Avatar"
        />
      </div>
    </div>
  );
}

function AuthorityFields({
  value,
  onChange,
}: {
  value: InfluencePromptConfig['authority'];
  onChange: (v: InfluencePromptConfig['authority']) => void;
}) {
  const update = (updates: Partial<NonNullable<typeof value>>) => {
    onChange({ ...value, ...updates } as typeof value);
  };

  return (
    <div className="space-y-4 p-4 bg-[#faf8f6] dark:bg-[#1a1f28] rounded-xl">
      <h5 className="font-albert font-semibold text-text-primary dark:text-[#f5f5f8] text-sm">
        Authority Details
      </h5>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
            Expert/Brand Name
          </label>
          <input
            type="text"
            value={value?.name || ''}
            onChange={(e) => update({ name: e.target.value || undefined })}
            placeholder="Dr. John Smith"
            className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
            Title/Credentials
          </label>
          <input
            type="text"
            value={value?.title || ''}
            onChange={(e) => update({ title: e.target.value || undefined })}
            placeholder="PhD, Harvard"
            className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Credential Text
        </label>
        <input
          type="text"
          value={value?.credentialText || ''}
          onChange={(e) => update({ credentialText: e.target.value || undefined })}
          placeholder="Featured in Forbes, Inc., Entrepreneur"
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
        />
      </div>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Endorsement Quote
        </label>
        <textarea
          value={value?.endorsement || ''}
          onChange={(e) => update({ endorsement: e.target.value || undefined })}
          placeholder="The most comprehensive program I've seen..."
          rows={2}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert resize-none"
        />
      </div>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Logo/Badge
        </label>
        <MediaUpload
          value={value?.logoUrl || ''}
          onChange={(url) => update({ logoUrl: url || undefined })}
          folder="programs"
          type="image"
          label="Logo"
        />
      </div>
    </div>
  );
}

function UrgencyFields({
  value,
  onChange,
}: {
  value: InfluencePromptConfig['urgency'];
  onChange: (v: InfluencePromptConfig['urgency']) => void;
}) {
  const update = (updates: Partial<NonNullable<typeof value>>) => {
    onChange({ ...value, ...updates } as typeof value);
  };

  return (
    <div className="space-y-4 p-4 bg-[#faf8f6] dark:bg-[#1a1f28] rounded-xl">
      <h5 className="font-albert font-semibold text-text-primary dark:text-[#f5f5f8] text-sm">
        Urgency Settings
      </h5>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Deadline Text
        </label>
        <input
          type="text"
          value={value?.deadlineText || ''}
          onChange={(e) => update({ deadlineText: e.target.value || undefined })}
          placeholder="Special pricing ends in"
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
        />
      </div>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Countdown Duration (minutes)
        </label>
        <input
          type="number"
          value={value?.countdownMinutes || ''}
          onChange={(e) => update({ countdownMinutes: parseInt(e.target.value) || undefined })}
          placeholder="30"
          min={1}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
        />
        <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
          Timer starts when user first sees this step (persisted per user)
        </p>
      </div>

      <div className="flex items-center gap-2">
        <BrandedCheckbox
          checked={value?.showPulse || false}
          onChange={(checked) => update({ showPulse: checked })}
        />
        <span className="text-sm text-text-primary dark:text-[#f5f5f8]">
          Show pulsing animation
        </span>
      </div>
    </div>
  );
}

function ScarcityFields({
  value,
  onChange,
}: {
  value: InfluencePromptConfig['scarcity'];
  onChange: (v: InfluencePromptConfig['scarcity']) => void;
}) {
  const update = (updates: Partial<NonNullable<typeof value>>) => {
    onChange({ ...value, ...updates } as typeof value);
  };

  return (
    <div className="space-y-4 p-4 bg-[#faf8f6] dark:bg-[#1a1f28] rounded-xl">
      <h5 className="font-albert font-semibold text-text-primary dark:text-[#f5f5f8] text-sm">
        Scarcity Settings
      </h5>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
            Total Spots
          </label>
          <input
            type="number"
            value={value?.totalSpots || ''}
            onChange={(e) => update({ totalSpots: parseInt(e.target.value) || undefined })}
            placeholder="50"
            min={1}
            className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
            Remaining Spots
          </label>
          <input
            type="number"
            value={value?.remainingSpots || ''}
            onChange={(e) => update({ remainingSpots: parseInt(e.target.value) || undefined })}
            placeholder="7"
            min={0}
            className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Custom Text
        </label>
        <input
          type="text"
          value={value?.customText || ''}
          onChange={(e) => update({ customText: e.target.value || undefined })}
          placeholder="Only {remaining} spots left this month!"
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
        />
        <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
          Use {'{remaining}'} to insert the spots count
        </p>
      </div>

      <div className="flex items-center gap-2">
        <BrandedCheckbox
          checked={value?.showProgressBar !== false}
          onChange={(checked) => update({ showProgressBar: checked })}
        />
        <span className="text-sm text-text-primary dark:text-[#f5f5f8]">
          Show progress bar
        </span>
      </div>
    </div>
  );
}

function ReciprocityFields({
  value,
  onChange,
}: {
  value: InfluencePromptConfig['reciprocity'];
  onChange: (v: InfluencePromptConfig['reciprocity']) => void;
}) {
  const update = (updates: Partial<NonNullable<typeof value>>) => {
    onChange({ ...value, ...updates } as typeof value);
  };

  return (
    <div className="space-y-4 p-4 bg-[#faf8f6] dark:bg-[#1a1f28] rounded-xl">
      <h5 className="font-albert font-semibold text-text-primary dark:text-[#f5f5f8] text-sm">
        Bonus Details
      </h5>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
            Bonus Name *
          </label>
          <input
            type="text"
            value={value?.bonusName || ''}
            onChange={(e) => update({ bonusName: e.target.value || undefined })}
            placeholder="Goal-Setting Workbook"
            className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
            Value (crossed out)
          </label>
          <input
            type="text"
            value={value?.bonusValue || ''}
            onChange={(e) => update({ bonusValue: e.target.value || undefined })}
            placeholder="$197 value"
            className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Description
        </label>
        <input
          type="text"
          value={value?.bonusDescription || ''}
          onChange={(e) => update({ bonusDescription: e.target.value || undefined })}
          placeholder="A 50-page workbook to help you set and achieve your goals"
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
        />
      </div>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Bonus Image
        </label>
        <MediaUpload
          value={value?.bonusImageUrl || ''}
          onChange={(url) => update({ bonusImageUrl: url || undefined })}
          folder="programs"
          type="image"
          label="Bonus"
        />
      </div>
    </div>
  );
}

function CommitmentFields({
  value,
  onChange,
}: {
  value: InfluencePromptConfig['commitment'];
  onChange: (v: InfluencePromptConfig['commitment']) => void;
}) {
  const update = (updates: Partial<NonNullable<typeof value>>) => {
    onChange({ ...value, ...updates } as typeof value);
  };

  return (
    <div className="space-y-4 p-4 bg-[#faf8f6] dark:bg-[#1a1f28] rounded-xl">
      <h5 className="font-albert font-semibold text-text-primary dark:text-[#f5f5f8] text-sm">
        Commitment Settings
      </h5>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Milestone Text
        </label>
        <input
          type="text"
          value={value?.milestoneText || ''}
          onChange={(e) => update({ milestoneText: e.target.value || undefined })}
          placeholder="Just 2 more steps to your personalized plan!"
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
        />
        <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
          Leave empty to auto-generate based on progress
        </p>
      </div>

      <div>
        <label className="block text-sm text-text-secondary dark:text-[#b2b6c2] mb-1">
          Progress Override (%)
        </label>
        <input
          type="number"
          value={value?.progressPercent || ''}
          onChange={(e) => update({ progressPercent: parseInt(e.target.value) || undefined })}
          placeholder="Auto-calculated"
          min={0}
          max={100}
          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:text-[#f5f5f8] font-albert"
        />
        <p className="text-xs text-text-muted dark:text-[#b2b6c2] mt-1">
          Leave empty to auto-calculate from step position
        </p>
      </div>

      <div className="flex items-center gap-2">
        <BrandedCheckbox
          checked={value?.showCheckmarks || false}
          onChange={(checked) => update({ showCheckmarks: checked })}
        />
        <span className="text-sm text-text-primary dark:text-[#f5f5f8]">
          Show step checkmarks
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getDefaultConfig(type: InfluencePromptType): Partial<InfluencePromptConfig> {
  switch (type) {
    case 'social_proof':
      return {
        testimonial: {
          quote: '',
          name: '',
        },
      };
    case 'authority':
      return {
        authority: {},
      };
    case 'urgency':
      return {
        urgency: {
          showPulse: true,
        },
      };
    case 'scarcity':
      return {
        scarcity: {
          totalSpots: 50,
          remainingSpots: 7,
          showProgressBar: true,
        },
      };
    case 'reciprocity':
      return {
        reciprocity: {},
      };
    case 'commitment':
      return {
        commitment: {
          showCheckmarks: true,
        },
      };
    default:
      return {};
  }
}






