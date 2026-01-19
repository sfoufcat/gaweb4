'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Palette } from 'lucide-react';
import type { WebsiteTemplateName } from '@/types';
import { cn } from '@/lib/utils';

interface TemplateSelectorProps {
  value: WebsiteTemplateName;
  onChange: (template: WebsiteTemplateName) => void;
}

interface TemplateConfig {
  id: WebsiteTemplateName;
  name: string;
  description: string;
}

const TEMPLATES: TemplateConfig[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Elegant & warm, perfect for wellness coaches',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Bold & dynamic, great for business coaches',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean & professional, ideal for consultants',
  },
];

// Classic preview - centered hero with decorative elements
function ClassicPreview() {
  return (
    <div className="h-full bg-gradient-to-b from-[#fef7ed] to-[#fef3e2] p-2 flex flex-col">
      {/* Nav */}
      <div className="flex justify-between items-center mb-2">
        <div className="w-6 h-1.5 rounded-full bg-amber-400/50" />
        <div className="flex gap-1">
          <div className="w-3 h-1 rounded-full bg-amber-300/40" />
          <div className="w-4 h-1.5 rounded-full bg-amber-500" />
        </div>
      </div>
      {/* Centered hero */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 mb-2 shadow-sm" />
        <div className="h-1.5 w-2/3 rounded-full bg-amber-800/20 mb-1" />
        <div className="h-1 w-1/2 rounded-full bg-amber-800/10" />
      </div>
      {/* CTA */}
      <div className="flex justify-center">
        <div className="h-3 w-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-sm" />
      </div>
    </div>
  );
}

// Modern preview - asymmetric bold layout
function ModernPreview() {
  return (
    <div className="h-full bg-gradient-to-br from-slate-900 to-indigo-950 p-2 flex flex-col">
      {/* Nav */}
      <div className="flex justify-between items-center mb-2">
        <div className="w-5 h-1.5 rounded bg-white/30" />
        <div className="flex gap-1">
          <div className="w-6 h-1.5 rounded bg-indigo-400" />
        </div>
      </div>
      {/* Split hero */}
      <div className="flex-1 flex gap-2">
        <div className="flex-1 flex flex-col justify-center">
          <div className="h-2 w-full rounded bg-white/90 mb-1" />
          <div className="h-1.5 w-3/4 rounded bg-white/50 mb-2" />
          <div className="h-3 w-10 rounded bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg" />
        </div>
        <div className="w-10 h-full rounded-lg bg-gradient-to-b from-indigo-400/30 to-purple-500/30 border border-indigo-400/20" />
      </div>
    </div>
  );
}

// Minimal preview - clean whitespace focused
function MinimalPreview() {
  return (
    <div className="h-full bg-white p-2 flex flex-col">
      {/* Nav */}
      <div className="flex justify-between items-center mb-3">
        <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200" />
        <div className="flex gap-2 items-center">
          <div className="w-4 h-0.5 rounded-full bg-slate-300" />
          <div className="w-4 h-0.5 rounded-full bg-slate-300" />
          <div className="w-6 h-1.5 rounded border border-slate-900" />
        </div>
      </div>
      {/* Minimal hero */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="h-1.5 w-full rounded-full bg-slate-800 mb-1.5" />
        <div className="h-1 w-2/3 rounded-full bg-slate-300 mb-3" />
        <div className="h-2.5 w-8 rounded border border-slate-900" />
      </div>
      {/* Bottom line */}
      <div className="h-px w-full bg-slate-200" />
    </div>
  );
}

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  return (
    <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="w-5 h-5 text-brand-accent" />
        <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Template Style
        </h3>
      </div>
      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-5">
        Choose a design template that matches your brand personality.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TEMPLATES.map((template) => {
          const isSelected = value === template.id;
          return (
            <motion.button
              key={template.id}
              onClick={() => onChange(template.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'relative p-3 sm:p-4 rounded-xl text-left transition-all',
                isSelected
                  ? 'ring-2 ring-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10'
                  : 'border border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/40 dark:hover:border-brand-accent/40'
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center shadow-sm">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Template preview */}
              <div className="w-full h-20 sm:h-24 rounded-lg mb-3 overflow-hidden shadow-sm border border-black/5">
                {template.id === 'classic' && <ClassicPreview />}
                {template.id === 'modern' && <ModernPreview />}
                {template.id === 'minimal' && <MinimalPreview />}
              </div>

              <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-0.5">
                {template.name}
              </h4>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert leading-relaxed">
                {template.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
