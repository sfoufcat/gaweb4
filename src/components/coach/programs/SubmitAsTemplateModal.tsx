'use client';

import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import { 
  X, Share2, Tag, FileText, DollarSign, Loader2, Check, 
  AlertCircle, Sparkles, Users
} from 'lucide-react';
import type { ProgramWithStats, TemplateCategory } from '@/types';

interface SubmitAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  program: ProgramWithStats;
  onSuccess: () => void;
}

const CATEGORIES: { value: TemplateCategory; label: string; description: string }[] = [
  { value: 'business', label: 'Business', description: 'Client acquisition, sales, marketing' },
  { value: 'habits', label: 'Habits', description: 'Daily routines, behavior change' },
  { value: 'mindset', label: 'Mindset', description: 'Confidence, leadership, growth' },
  { value: 'health', label: 'Health', description: 'Fitness, nutrition, wellness' },
  { value: 'productivity', label: 'Productivity', description: 'Time management, focus, systems' },
  { value: 'relationships', label: 'Relationships', description: 'Communication, networking' },
];

const SUGGESTED_TAGS: Record<TemplateCategory, string[]> = {
  business: ['sales', 'marketing', 'clients', 'revenue', 'entrepreneurship', 'consulting'],
  habits: ['morning routine', 'daily habits', 'behavior change', 'consistency', 'discipline'],
  mindset: ['confidence', 'leadership', 'growth', 'resilience', 'motivation', 'self-improvement'],
  health: ['fitness', 'nutrition', 'wellness', 'energy', 'sleep', 'stress management'],
  productivity: ['time management', 'focus', 'deep work', 'systems', 'efficiency', 'organization'],
  relationships: ['communication', 'networking', 'boundaries', 'connection', 'leadership'],
};

export function SubmitAsTemplateModal({ 
  isOpen, 
  onClose, 
  program,
  onSuccess 
}: SubmitAsTemplateModalProps) {
  const [formData, setFormData] = useState({
    category: '' as TemplateCategory | '',
    tags: [] as string[],
    customTag: '',
    previewDescription: '',
    suggestedPriceInCents: program.priceInCents,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check eligibility
  const isEligible = program.lengthDays >= 7;

  const handleTagToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : prev.tags.length < 6 ? [...prev.tags, tag] : prev.tags,
    }));
  };

  const handleAddCustomTag = () => {
    const tag = formData.customTag.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 6) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
        customTag: '',
      }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.category || !formData.previewDescription.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/coach/templates/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: program.id,
          category: formData.category,
          tags: formData.tags,
          previewDescription: formData.previewDescription.trim(),
          suggestedPriceInCents: formData.suggestedPriceInCents,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit template');
      }
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
      
    } catch (err) {
      console.error('Error submitting template:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit template');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        category: '',
        tags: [],
        customTag: '',
        previewDescription: '',
        suggestedPriceInCents: program.priceInCents,
      });
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  if (success) {
    return (
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {}}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 shadow-2xl shadow-black/10 dark:shadow-black/30">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4"
                  >
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </motion.div>
                  
                  <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Submitted for Review!
                  </h2>
                  
                  <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    We'll review "{program.name}" and notify you once it's approved.
                  </p>
                </motion.div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/30">
                {/* Header */}
                <div className="px-6 py-5 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center">
                        <Share2 className="w-5 h-5 text-brand-accent" />
                      </div>
                      <div>
                        <Dialog.Title className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                          Share as Template
                        </Dialog.Title>
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          Help other coaches with "{program.name}"
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleClose}
                      className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                  {!isEligible ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Program Not Eligible
                      </h3>
                      <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
                        Templates must have at least 7 days of content and 20+ tasks.
                      </p>
                      <p className="text-sm text-[#a7a39e] dark:text-[#7d8190]">
                        Current: {program.lengthDays} days
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Info Banner */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-brand-accent/10 to-transparent dark:from-[#b8896a]/10 border border-brand-accent/20 dark:border-brand-accent/20">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-brand-accent flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                              Your program will be reviewed and, if approved, made available to all coaches.
                            </p>
                            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                              Your organization info will not be shared.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Category */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                          <Tag className="w-4 h-4 text-brand-accent" />
                          Category *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => setFormData(prev => ({ 
                                ...prev, 
                                category: cat.value,
                                tags: [], // Reset tags when category changes
                              }))}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                formData.category === cat.value
                                  ? 'border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/5'
                                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/30 dark:hover:border-brand-accent/30'
                              }`}
                            >
                              <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm">
                                {cat.label}
                              </span>
                              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-0.5">
                                {cat.description}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tags */}
                      {formData.category && (
                        <div>
                          <label className="flex items-center justify-between text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                            <span className="flex items-center gap-2">
                              <Tag className="w-4 h-4 text-brand-accent" />
                              Tags (up to 6)
                            </span>
                            <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                              {formData.tags.length}/6 selected
                            </span>
                          </label>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {SUGGESTED_TAGS[formData.category].map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleTagToggle(tag)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                  formData.tags.includes(tag)
                                    ? 'bg-brand-accent text-white'
                                    : 'bg-[#f3f1ef] dark:bg-[#1d222b] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e8e4df] dark:hover:bg-[#262b35]'
                                }`}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={formData.customTag}
                              onChange={(e) => setFormData(prev => ({ ...prev, customTag: e.target.value }))}
                              placeholder="Add custom tag..."
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTag())}
                              className="flex-1 px-3 py-2 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] text-sm font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30"
                            />
                            <button
                              type="button"
                              onClick={handleAddCustomTag}
                              disabled={!formData.customTag.trim() || formData.tags.length >= 6}
                              className="px-3 py-2 rounded-lg bg-[#f3f1ef] dark:bg-[#1d222b] text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-medium disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Preview Description */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                          <FileText className="w-4 h-4 text-brand-accent" />
                          Gallery Description *
                        </label>
                        <textarea
                          value={formData.previewDescription}
                          onChange={(e) => setFormData(prev => ({ ...prev, previewDescription: e.target.value }))}
                          placeholder="A compelling 1-2 sentence description that will appear in the template gallery..."
                          rows={3}
                          maxLength={200}
                          className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 resize-none"
                        />
                        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1 text-right">
                          {formData.previewDescription.length}/200
                        </p>
                      </div>

                      {/* Suggested Price */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                          <DollarSign className="w-4 h-4 text-brand-accent" />
                          Suggested Price for Others
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#b2b6c2]">
                            $
                          </span>
                          <input
                            type="number"
                            value={formData.suggestedPriceInCents / 100}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              suggestedPriceInCents: Math.max(0, parseFloat(e.target.value) || 0) * 100 
                            }))}
                            min="0"
                            step="1"
                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30"
                          />
                        </div>
                        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1">
                          Coaches can adjust this when using your template
                        </p>
                      </div>

                      {/* Error Message */}
                      {error && (
                        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                          <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                {isEligible && (
                  <div className="px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        <Users className="w-4 h-4" />
                        <span>Help other coaches succeed</span>
                      </div>
                      <button
                        onClick={handleSubmit}
                        disabled={loading || !formData.category || !formData.previewDescription.trim()}
                        className="px-5 py-2.5 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold font-albert transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Share2 className="w-4 h-4" />
                            Submit for Review
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

