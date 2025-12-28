'use client';

import React from 'react';
import { Plus, Trash2, Star, GripVertical, Layout, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import type { 
  ProgramFeature, 
  ProgramTestimonial, 
  ProgramFAQ, 
  LandingPageTemplateName 
} from '@/types';

export interface LandingPageFormData {
  template: LandingPageTemplateName;
  headline?: string;
  subheadline?: string;
  coachBio?: string;
  keyOutcomes?: string[];
  features?: ProgramFeature[];
  testimonials?: ProgramTestimonial[];
  faqs?: ProgramFAQ[];
  ctaText?: string;
  ctaSubtext?: string;
  showTestimonials?: boolean;
  showFAQ?: boolean;
  showPrice?: boolean; // Only used in funnel LPs - default true
  // Program display props (typically auto-populated from program context)
  programName?: string;
  programDescription?: string;
  programImageUrl?: string;
  priceInCents?: number;
  durationDays?: number;
  enrolledCount?: number;
  programType?: 'individual' | 'group';
  coachName?: string;
  coachImageUrl?: string;
}

interface LandingPageEditorProps {
  formData: LandingPageFormData;
  onChange: (data: LandingPageFormData) => void;
  showHeadline?: boolean; // For funnels, we might want headline/subheadline
  isFunnel?: boolean; // When true, shows funnel-specific options like showPrice toggle
}

const TEMPLATES: { 
  id: LandingPageTemplateName; 
  name: string; 
  description: string; 
  icon: React.ElementType;
}[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional layout with sections stacked vertically',
    icon: Layout,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Bold hero, card grids, and alternating sections',
    icon: Sparkles,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean typography, subtle dividers, premium feel',
    icon: Layers,
  },
];

export function LandingPageEditor({ 
  formData, 
  onChange,
  showHeadline = false,
  isFunnel = false,
}: LandingPageEditorProps) {
  // Initialize arrays if undefined
  const keyOutcomes = formData.keyOutcomes || [];
  const features = formData.features || [];
  const testimonials = formData.testimonials || [];
  const faqs = formData.faqs || [];

  // Key Outcomes management
  const addOutcome = () => {
    onChange({
      ...formData,
      keyOutcomes: [...keyOutcomes, ''],
    });
  };

  const updateOutcome = (index: number, value: string) => {
    onChange({
      ...formData,
      keyOutcomes: keyOutcomes.map((o, i) => i === index ? value : o),
    });
  };

  const removeOutcome = (index: number) => {
    onChange({
      ...formData,
      keyOutcomes: keyOutcomes.filter((_, i) => i !== index),
    });
  };

  // Features management
  const addFeature = () => {
    onChange({
      ...formData,
      features: [...features, { title: '', description: '', icon: '' }],
    });
  };

  const updateFeature = (index: number, updates: Partial<ProgramFeature>) => {
    onChange({
      ...formData,
      features: features.map((f, i) => i === index ? { ...f, ...updates } : f),
    });
  };

  const removeFeature = (index: number) => {
    onChange({
      ...formData,
      features: features.filter((_, i) => i !== index),
    });
  };

  // Testimonials management
  const addTestimonial = () => {
    onChange({
      ...formData,
      testimonials: [...testimonials, { text: '', author: '', role: '', rating: 5 }],
    });
  };

  const updateTestimonial = (index: number, updates: Partial<ProgramTestimonial>) => {
    onChange({
      ...formData,
      testimonials: testimonials.map((t, i) => i === index ? { ...t, ...updates } : t),
    });
  };

  const removeTestimonial = (index: number) => {
    onChange({
      ...formData,
      testimonials: testimonials.filter((_, i) => i !== index),
    });
  };

  // FAQs management
  const addFAQ = () => {
    onChange({
      ...formData,
      faqs: [...faqs, { question: '', answer: '' }],
    });
  };

  const updateFAQ = (index: number, updates: Partial<ProgramFAQ>) => {
    onChange({
      ...formData,
      faqs: faqs.map((f, i) => i === index ? { ...f, ...updates } : f),
    });
  };

  const removeFAQ = (index: number) => {
    onChange({
      ...formData,
      faqs: faqs.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-8">
      {/* Template Selector */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
        <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Choose Template
        </h3>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          Select a design style for your landing page
        </p>
        <div className="grid grid-cols-3 gap-3">
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            const isSelected = formData.template === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onChange({ ...formData, template: template.id })}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-[#a07855] dark:border-[#b8896a] bg-[#a07855]/5 dark:bg-[#a07855]/10'
                    : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855] dark:border-[#b8896a]/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  isSelected 
                    ? 'bg-[#a07855] dark:bg-[#b8896a] text-white' 
                    : 'bg-[#f5f3f0] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-semibold text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {template.name}
                </div>
                <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                  {template.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Headline & Subheadline (optional - for funnels) */}
      {showHeadline && (
        <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
          <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
            Hero Section
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                Headline
              </label>
              <input
                type="text"
                value={formData.headline || ''}
                onChange={(e) => onChange({ ...formData, headline: e.target.value })}
                placeholder="Transform Your Life in 90 Days"
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                Subheadline
              </label>
              <textarea
                value={formData.subheadline || ''}
                onChange={(e) => onChange({ ...formData, subheadline: e.target.value })}
                placeholder="Join thousands who have already started their journey..."
                rows={2}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* CTA Settings */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
        <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Call to Action
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              Button Text
            </label>
            <input
              type="text"
              value={formData.ctaText || ''}
              onChange={(e) => onChange({ ...formData, ctaText: e.target.value })}
              placeholder="Get Started Today"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              Supporting Text (optional)
            </label>
            <input
              type="text"
              value={formData.ctaSubtext || ''}
              onChange={(e) => onChange({ ...formData, ctaSubtext: e.target.value })}
              placeholder="30-day money-back guarantee"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
            />
          </div>
        </div>
      </div>

      {/* Show Price Toggle - Only for funnel LPs */}
      {isFunnel && (
        <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
          <div className="flex items-center gap-3">
            <BrandedCheckbox
              checked={formData.showPrice !== false}
              onChange={(checked) => onChange({ ...formData, showPrice: checked })}
            />
            <div>
              <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Show Price
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                Display the program price in the sidebar. Uncheck to hide pricing and reveal it later in the funnel.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Coach Bio */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
        <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          About the Coach
        </h3>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
          A short bio that appears on your landing page. Leave empty to hide this section.
        </p>
        <textarea
          value={formData.coachBio || ''}
          onChange={(e) => onChange({ ...formData, coachBio: e.target.value })}
          placeholder="Share a bit about yourself, your experience, and what makes you uniquely qualified to guide this program..."
          rows={4}
          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
        />
      </div>

      {/* Key Outcomes */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              What You&apos;ll Learn
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
              Key outcomes or benefits participants will gain
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addOutcome}
            className="flex items-center gap-1 border-[#a07855] dark:border-[#b8896a] text-[#a07855] dark:text-[#b8896a] hover:bg-[#a07855]/10"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {keyOutcomes.length === 0 ? (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] italic py-3 text-center">
              No outcomes added yet. Click &quot;Add&quot; to create your first one.
            </p>
          ) : (
            keyOutcomes.map((outcome, index) => (
              <div key={index} className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-[#d1ccc5] dark:text-[#7d8190] flex-shrink-0 cursor-grab" />
                <input
                  type="text"
                  value={outcome}
                  onChange={(e) => updateOutcome(index, e.target.value)}
                  placeholder="e.g., Build a daily practice that sticks"
                  className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                />
                <button
                  onClick={() => removeOutcome(index)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Features */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              What&apos;s Included
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
              Features, resources, or perks of the program
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addFeature}
            className="flex items-center gap-1 border-[#a07855] dark:border-[#b8896a] text-[#a07855] dark:text-[#b8896a] hover:bg-[#a07855]/10"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="space-y-3">
          {features.length === 0 ? (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] italic py-3 text-center">
              No features added yet. Click &quot;Add&quot; to create your first one.
            </p>
          ) : (
            features.map((feature, index) => (
              <div key={index} className="p-3 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-[#d1ccc5] dark:text-[#7d8190] flex-shrink-0 cursor-grab" />
                  <input
                    type="text"
                    value={feature.title}
                    onChange={(e) => updateFeature(index, { title: e.target.value })}
                    placeholder="Feature title (e.g., Weekly group calls)"
                    className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                  />
                  <button
                    onClick={() => removeFeature(index)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
                <div className="pl-6">
                  <input
                    type="text"
                    value={feature.description || ''}
                    onChange={(e) => updateFeature(index, { description: e.target.value })}
                    placeholder="Brief description (optional)"
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                  />
                </div>
                <div className="pl-6">
                  <select
                    value={feature.icon || ''}
                    onChange={(e) => updateFeature(index, { icon: e.target.value })}
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                  >
                    <option value="">Select icon (optional)</option>
                    <option value="video">📹 Video calls</option>
                    <option value="users">👥 Community</option>
                    <option value="message-circle">💬 Messaging</option>
                    <option value="book">📚 Resources</option>
                    <option value="target">🎯 Goals</option>
                    <option value="calendar">📅 Schedule</option>
                    <option value="check-circle">✅ Accountability</option>
                    <option value="zap">⚡ Quick wins</option>
                    <option value="heart">❤️ Support</option>
                    <option value="star">⭐ Premium</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Testimonials */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <BrandedCheckbox
              checked={formData.showTestimonials !== false}
              onChange={(checked) => onChange({ ...formData, showTestimonials: checked })}
            />
            <div>
              <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Testimonials
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                Social proof from past participants
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addTestimonial}
            className="flex items-center gap-1 border-[#a07855] dark:border-[#b8896a] text-[#a07855] dark:text-[#b8896a] hover:bg-[#a07855]/10"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="space-y-4">
          {testimonials.length === 0 ? (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] italic py-3 text-center">
              No testimonials added yet. Click &quot;Add&quot; to create your first one.
            </p>
          ) : (
            testimonials.map((testimonial, index) => (
              <div key={index} className="p-4 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <textarea
                    value={testimonial.text}
                    onChange={(e) => updateTestimonial(index, { text: e.target.value })}
                    placeholder="What did they say about the program?"
                    rows={3}
                    className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm resize-none"
                  />
                  <button
                    onClick={() => removeTestimonial(index)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={testimonial.author}
                    onChange={(e) => updateTestimonial(index, { author: e.target.value })}
                    placeholder="Name"
                    className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                  />
                  <input
                    type="text"
                    value={testimonial.role || ''}
                    onChange={(e) => updateTestimonial(index, { role: e.target.value })}
                    placeholder="Role (e.g., Program graduate 2024)"
                    className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Rating:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => updateTestimonial(index, { rating: star })}
                      className="p-0.5 transition-colors"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= (testimonial.rating || 5)
                            ? 'text-[#FFB800] fill-[#FFB800]'
                            : 'text-[#d1ccc5] dark:text-[#7d8190]'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <BrandedCheckbox
              checked={formData.showFAQ !== false}
              onChange={(checked) => onChange({ ...formData, showFAQ: checked })}
            />
            <div>
              <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Frequently Asked Questions
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                Common questions potential participants might have
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addFAQ}
            className="flex items-center gap-1 border-[#a07855] dark:border-[#b8896a] text-[#a07855] dark:text-[#b8896a] hover:bg-[#a07855]/10"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="space-y-3">
          {faqs.length === 0 ? (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] italic py-3 text-center">
              No FAQs added yet. Click &quot;Add&quot; to create your first one.
            </p>
          ) : (
            faqs.map((faq, index) => (
              <div key={index} className="p-3 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-[#d1ccc5] dark:text-[#7d8190] flex-shrink-0 cursor-grab" />
                  <input
                    type="text"
                    value={faq.question}
                    onChange={(e) => updateFAQ(index, { question: e.target.value })}
                    placeholder="Question"
                    className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm font-medium"
                  />
                  <button
                    onClick={() => removeFAQ(index)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
                <div className="pl-6">
                  <textarea
                    value={faq.answer}
                    onChange={(e) => updateFAQ(index, { answer: e.target.value })}
                    placeholder="Answer"
                    rows={2}
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm resize-none"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


