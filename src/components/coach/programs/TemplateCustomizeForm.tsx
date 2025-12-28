'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, X, Check, Loader2, Calendar, ListTodo, Target, 
  Link2, DollarSign, FileText, Image as ImageIcon, CheckSquare, Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { ProgramTemplate } from '@/types';

interface TemplateCustomizeFormProps {
  template: ProgramTemplate;
  templateStats: { totalDays: number; totalTasks: number; totalHabits: number } | null;
  onBack: () => void;
  onClose: () => void;
  onSuccess: (programId: string) => void;
}

export function TemplateCustomizeForm({ 
  template, 
  templateStats,
  onBack, 
  onClose, 
  onSuccess 
}: TemplateCustomizeFormProps) {
  const [formData, setFormData] = useState({
    name: template.name,
    slug: generateSlug(template.name),
    description: template.description,
    priceInCents: template.suggestedPriceInCents,
    copyHabits: true,
    copyCoverImage: true,
    copyLandingPage: true,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdProgramId, setCreatedProgramId] = useState<string | null>(null);

  // Auto-generate slug from name
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      slug: generateSlug(prev.name),
    }));
  }, [formData.name]);

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.slug.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/coach/programs/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          description: formData.description.trim(),
          priceInCents: formData.priceInCents,
          copyHabits: formData.copyHabits,
          copyCoverImage: formData.copyCoverImage,
          copyLandingPage: formData.copyLandingPage,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create program');
      }
      
      // Success!
      setCreatedProgramId(data.program.id);
      setSuccess(true);
      
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a07855', '#b8896a', '#22c55e', '#fbbf24'],
      });
      
      // Call success callback after animation
      setTimeout(() => {
        onSuccess(data.program.id);
      }, 2000);
      
    } catch (err) {
      console.error('Error creating program:', err);
      setError(err instanceof Error ? err.message : 'Failed to create program');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 px-6 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6"
        >
          <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
        </motion.div>
        
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2"
        >
          Program Created!
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4"
        >
          "{formData.name}" is ready to customize
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 text-sm text-[#a7a39e] dark:text-[#7d8190]"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Redirecting...</span>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-[85vh] max-h-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
              Customize Your Program
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Based on "{template.name}"
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-xl mx-auto space-y-6">
          {/* What You're Getting */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#a07855]/10 to-transparent dark:from-[#b8896a]/10 border border-[#a07855] dark:border-[#b8896a]/20 dark:border-[#b8896a]/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
              <span className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                What's Included
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-[#a07855] dark:text-[#b8896a]">{template.lengthDays}</div>
                <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Days</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#a07855] dark:text-[#b8896a]">{templateStats?.totalTasks || '—'}</div>
                <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Tasks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#a07855] dark:text-[#b8896a]">{template.defaultHabits?.length || 0}</div>
                <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Habits</div>
              </div>
            </div>
          </div>

          {/* Program Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              <FileText className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
              Program Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter program name"
              className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:border-[#b8896a] dark:focus:border-[#b8896a] transition-all"
              required
            />
          </div>

          {/* URL Slug */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              <Link2 className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
              URL Slug *
            </label>
            <div className="flex items-center">
              <span className="px-4 py-3 rounded-l-xl border border-r-0 border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b] text-[#a7a39e] dark:text-[#7d8190] text-sm font-albert">
                yoursite.com/join/
              </span>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="program-slug"
                className="flex-1 px-4 py-3 rounded-r-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:border-[#b8896a] dark:focus:border-[#b8896a] transition-all"
                required
              />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              <DollarSign className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
              Price
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                $
              </span>
              <input
                type="number"
                value={formData.priceInCents / 100}
                onChange={(e) => setFormData(prev => ({ ...prev, priceInCents: Math.max(0, parseFloat(e.target.value) || 0) * 100 }))}
                placeholder="0.00"
                min="0"
                step="1"
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:border-[#b8896a] dark:focus:border-[#b8896a] transition-all"
              />
            </div>
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1.5 font-albert">
              Suggested: {formatPrice(template.suggestedPriceInCents)} • Set to $0 for free programs
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              <FileText className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your program..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:border-[#b8896a] dark:focus:border-[#b8896a] transition-all resize-none"
            />
          </div>

          {/* Copy Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Include from Template
            </h3>
            
            <ToggleOption
              icon={Target}
              label="Default habits"
              description="Copy the program's habit templates"
              checked={formData.copyHabits}
              onChange={(checked) => setFormData(prev => ({ ...prev, copyHabits: checked }))}
            />
            
            <ToggleOption
              icon={ImageIcon}
              label="Cover image"
              description="Use the template's cover image"
              checked={formData.copyCoverImage}
              onChange={(checked) => setFormData(prev => ({ ...prev, copyCoverImage: checked }))}
            />
            
            <ToggleOption
              icon={FileText}
              label="Landing page content"
              description="Copy outcomes, features, FAQs, and testimonials"
              checked={formData.copyLandingPage}
              onChange={(checked) => setFormData(prev => ({ ...prev, copyLandingPage: checked }))}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
            </div>
          )}
        </div>
      </form>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            You can customize content after creation
          </p>
          <button
            onClick={handleSubmit}
            disabled={loading || !formData.name.trim() || !formData.slug.trim()}
            className="px-6 py-3 rounded-xl bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white font-semibold font-albert transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Create Program
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle Option Component
interface ToggleOptionProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleOption({ icon: Icon, label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
        checked 
          ? 'border-[#a07855] dark:border-[#b8896a] bg-[#a07855]/5 dark:bg-[#b8896a]/5' 
          : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] hover:border-[#a07855] dark:border-[#b8896a]/30 dark:hover:border-[#b8896a]/30'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        checked 
          ? 'bg-[#a07855]/10 dark:bg-[#b8896a]/10' 
          : 'bg-[#f3f1ef] dark:bg-[#1d222b]'
      }`}>
        <Icon className={`w-5 h-5 ${checked ? 'text-[#a07855] dark:text-[#b8896a]' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
      </div>
      <div className="flex-1 text-left">
        <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {label}
        </h4>
        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
          {description}
        </p>
      </div>
      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
        checked 
          ? 'border-[#a07855] dark:border-[#b8896a] bg-[#a07855] dark:bg-[#b8896a]' 
          : 'border-[#e1ddd8] dark:border-[#262b35]'
      }`}>
        {checked && <Check className="w-4 h-4 text-white" />}
      </div>
    </button>
  );
}

