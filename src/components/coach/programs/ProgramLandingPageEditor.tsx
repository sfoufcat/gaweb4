'use client';

import React from 'react';
import { Plus, Trash2, Star, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProgramFeature, ProgramTestimonial, ProgramFAQ } from '@/types';

interface LandingPageFormData {
  coachBio: string;
  keyOutcomes: string[];
  features: ProgramFeature[];
  testimonials: ProgramTestimonial[];
  faqs: ProgramFAQ[];
  showEnrollmentCount: boolean;
  showCurriculum: boolean;
}

interface ProgramLandingPageEditorProps {
  formData: LandingPageFormData;
  onChange: (data: LandingPageFormData) => void;
}

export function ProgramLandingPageEditor({ formData, onChange }: ProgramLandingPageEditorProps) {
  // Key Outcomes management
  const addOutcome = () => {
    onChange({
      ...formData,
      keyOutcomes: [...formData.keyOutcomes, ''],
    });
  };

  const updateOutcome = (index: number, value: string) => {
    onChange({
      ...formData,
      keyOutcomes: formData.keyOutcomes.map((o, i) => i === index ? value : o),
    });
  };

  const removeOutcome = (index: number) => {
    onChange({
      ...formData,
      keyOutcomes: formData.keyOutcomes.filter((_, i) => i !== index),
    });
  };

  // Features management
  const addFeature = () => {
    onChange({
      ...formData,
      features: [...formData.features, { title: '', description: '', icon: '' }],
    });
  };

  const updateFeature = (index: number, updates: Partial<ProgramFeature>) => {
    onChange({
      ...formData,
      features: formData.features.map((f, i) => i === index ? { ...f, ...updates } : f),
    });
  };

  const removeFeature = (index: number) => {
    onChange({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    });
  };

  // Testimonials management
  const addTestimonial = () => {
    onChange({
      ...formData,
      testimonials: [...formData.testimonials, { text: '', author: '', role: '', rating: 5 }],
    });
  };

  const updateTestimonial = (index: number, updates: Partial<ProgramTestimonial>) => {
    onChange({
      ...formData,
      testimonials: formData.testimonials.map((t, i) => i === index ? { ...t, ...updates } : t),
    });
  };

  const removeTestimonial = (index: number) => {
    onChange({
      ...formData,
      testimonials: formData.testimonials.filter((_, i) => i !== index),
    });
  };

  // FAQs management
  const addFAQ = () => {
    onChange({
      ...formData,
      faqs: [...formData.faqs, { question: '', answer: '' }],
    });
  };

  const updateFAQ = (index: number, updates: Partial<ProgramFAQ>) => {
    onChange({
      ...formData,
      faqs: formData.faqs.map((f, i) => i === index ? { ...f, ...updates } : f),
    });
  };

  const removeFAQ = (index: number) => {
    onChange({
      ...formData,
      faqs: formData.faqs.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-8">
      {/* Coach Bio */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
        <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          About the Coach
        </h3>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
          A short bio that appears on your program landing page. Leave empty to hide this section.
        </p>
        <textarea
          value={formData.coachBio}
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
            className="flex items-center gap-1 border-[#a07855] text-[#a07855] hover:bg-[#a07855]/10"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {formData.keyOutcomes.length === 0 ? (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] italic py-3 text-center">
              No outcomes added yet. Click &quot;Add&quot; to create your first one.
            </p>
          ) : (
            formData.keyOutcomes.map((outcome, index) => (
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
            className="flex items-center gap-1 border-[#a07855] text-[#a07855] hover:bg-[#a07855]/10"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="space-y-3">
          {formData.features.length === 0 ? (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] italic py-3 text-center">
              No features added yet. Click &quot;Add&quot; to create your first one.
            </p>
          ) : (
            formData.features.map((feature, index) => (
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
          <div>
            <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Testimonials
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
              Social proof from past participants
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addTestimonial}
            className="flex items-center gap-1 border-[#a07855] text-[#a07855] hover:bg-[#a07855]/10"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="space-y-4">
          {formData.testimonials.length === 0 ? (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] italic py-3 text-center">
              No testimonials added yet. Click &quot;Add&quot; to create your first one.
            </p>
          ) : (
            formData.testimonials.map((testimonial, index) => (
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
          <div>
            <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Frequently Asked Questions
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
              Common questions potential participants might have
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addFAQ}
            className="flex items-center gap-1 border-[#a07855] text-[#a07855] hover:bg-[#a07855]/10"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="space-y-3">
          {formData.faqs.length === 0 ? (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] italic py-3 text-center">
              No FAQs added yet. Click &quot;Add&quot; to create your first one.
            </p>
          ) : (
            formData.faqs.map((faq, index) => (
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

      {/* Display Settings */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
        <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Display Settings
        </h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.showEnrollmentCount}
              onChange={(e) => onChange({ ...formData, showEnrollmentCount: e.target.checked })}
              className="w-4 h-4 rounded border-[#e1ddd8] text-[#a07855] focus:ring-[#a07855]"
            />
            <div>
              <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Show enrollment count
              </span>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Display &quot;X students enrolled&quot; badge on landing page
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.showCurriculum}
              onChange={(e) => onChange({ ...formData, showCurriculum: e.target.checked })}
              className="w-4 h-4 rounded border-[#e1ddd8] text-[#a07855] focus:ring-[#a07855]"
            />
            <div>
              <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Show curriculum preview
              </span>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Display program day titles as a curriculum outline
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}


