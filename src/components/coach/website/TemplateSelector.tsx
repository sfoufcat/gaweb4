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

const TEMPLATES: {
  id: WebsiteTemplateName;
  name: string;
  description: string;
  preview: {
    bg: string;
    hero: string;
    line1: string;
    line2: string;
    cta: string;
  };
}[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Elegant & warm, perfect for wellness coaches',
    preview: {
      bg: 'bg-gradient-to-b from-[#fdfcfb] to-[#f8f5f2]',
      hero: 'bg-gradient-to-r from-amber-200 via-orange-200 to-amber-300',
      line1: 'bg-amber-400/40',
      line2: 'bg-amber-400/25',
      cta: 'bg-gradient-to-r from-amber-500 to-orange-500',
    },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Bold & dynamic, great for business coaches',
    preview: {
      bg: 'bg-gradient-to-b from-slate-50 to-blue-50',
      hero: 'bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500',
      line1: 'bg-indigo-400/40',
      line2: 'bg-indigo-400/25',
      cta: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean & professional, ideal for consultants',
    preview: {
      bg: 'bg-gradient-to-b from-white to-slate-50',
      hero: 'bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-400',
      line1: 'bg-emerald-400/40',
      line2: 'bg-emerald-400/25',
      cta: 'bg-gradient-to-r from-emerald-600 to-teal-600',
    },
  },
];

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
              <div className={cn(
                'w-full h-20 sm:h-24 rounded-lg mb-3 overflow-hidden shadow-sm',
                template.preview.bg
              )}>
                {/* Mini preview of template layout */}
                <div className="h-full p-2 flex flex-col">
                  {/* Hero placeholder */}
                  <div className={cn(
                    'h-7 sm:h-8 rounded-md mb-1.5',
                    template.preview.hero
                  )} />
                  {/* Content lines */}
                  <div className="flex-1 flex flex-col justify-center gap-1">
                    <div className={cn(
                      'h-1.5 w-3/4 rounded-full',
                      template.preview.line1
                    )} />
                    <div className={cn(
                      'h-1.5 w-1/2 rounded-full',
                      template.preview.line2
                    )} />
                  </div>
                  {/* CTA placeholder */}
                  <div className={cn(
                    'h-3.5 sm:h-4 w-1/3 rounded-md',
                    template.preview.cta
                  )} />
                </div>
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
