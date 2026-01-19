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
  colors: { bg: string; accent: string; text: string };
}[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Elegant & warm, perfect for wellness coaches',
    colors: {
      bg: 'bg-[#faf8f6]',
      accent: 'bg-[#a07855]',
      text: 'text-[#1a1a1a]',
    },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Bold & dynamic, great for business coaches',
    colors: {
      bg: 'bg-white',
      accent: 'bg-gradient-to-r from-violet-500 to-purple-600',
      text: 'text-gray-900',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean & professional, ideal for consultants',
    colors: {
      bg: 'bg-gray-50',
      accent: 'bg-gray-900',
      text: 'text-gray-800',
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
                'relative p-4 rounded-xl border-2 text-left transition-all',
                isSelected
                  ? 'border-brand-accent ring-2 ring-brand-accent/20'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Template preview */}
              <div className={cn(
                'w-full h-24 rounded-lg mb-3 overflow-hidden',
                template.colors.bg
              )}>
                {/* Mini preview of template layout */}
                <div className="h-full p-2 flex flex-col">
                  {/* Hero placeholder */}
                  <div className={cn(
                    'h-8 rounded mb-1',
                    template.colors.accent,
                    'opacity-80'
                  )} />
                  {/* Content lines */}
                  <div className="flex-1 flex flex-col justify-center gap-1">
                    <div className={cn(
                      'h-1.5 w-3/4 rounded',
                      template.colors.accent,
                      'opacity-30'
                    )} />
                    <div className={cn(
                      'h-1.5 w-1/2 rounded',
                      template.colors.accent,
                      'opacity-20'
                    )} />
                  </div>
                  {/* CTA placeholder */}
                  <div className={cn(
                    'h-4 w-1/3 rounded',
                    template.colors.accent
                  )} />
                </div>
              </div>

              <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                {template.name}
              </h4>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {template.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
