'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Calendar, ListTodo, Users, Star, ArrowRight } from 'lucide-react';
import type { ProgramTemplate, TemplateCategory } from '@/types';

interface TemplateCardProps {
  template: ProgramTemplate;
  onSelect: () => void;
  featured?: boolean;
}

// Category colors for badges
const categoryStyles: Record<TemplateCategory, string> = {
  business: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  habits: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  mindset: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  health: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  productivity: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  relationships: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

// Gradient backgrounds for cards without images
const categoryGradients: Record<TemplateCategory, string> = {
  business: 'from-blue-500/20 via-blue-400/10 to-blue-600/5',
  habits: 'from-green-500/20 via-green-400/10 to-green-600/5',
  mindset: 'from-purple-500/20 via-purple-400/10 to-purple-600/5',
  health: 'from-rose-500/20 via-rose-400/10 to-rose-600/5',
  productivity: 'from-amber-500/20 via-amber-400/10 to-amber-600/5',
  relationships: 'from-pink-500/20 via-pink-400/10 to-pink-600/5',
};

export function TemplateCard({ template, onSelect, featured }: TemplateCardProps) {
  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(0)}`;
  };

  return (
    <motion.button
      onClick={onSelect}
      className={`group relative w-full text-left rounded-2xl overflow-hidden border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] transition-all duration-300 ${
        featured ? 'ring-2 ring-brand-accent dark:ring-brand-accent/20 dark:ring-brand-accent/20' : ''
      }`}
      whileHover={{ 
        y: -4, 
        boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15)',
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Cover Image / Gradient */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {template.coverImageUrl ? (
          <>
            <Image
              src={template.coverImageUrl}
              alt={template.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${categoryGradients[template.category]}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}

        {/* Featured Badge */}
        {featured && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-accent text-white text-xs font-medium shadow-lg">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </span>
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute top-3 right-3">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${categoryStyles[template.category]}`}>
            {template.category}
          </span>
        </div>

        {/* Days Badge - Bottom Left */}
        <div className="absolute bottom-3 left-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-black/70 text-[#1a1a1a] dark:text-white text-xs font-medium backdrop-blur-sm">
            <Calendar className="w-3 h-3" />
            {template.lengthDays} days
          </span>
        </div>

        {/* Suggested Price - Bottom Right */}
        <div className="absolute bottom-3 right-3">
          <span className="inline-flex px-2.5 py-1 rounded-full bg-white/90 dark:bg-black/70 text-[#1a1a1a] dark:text-white text-xs font-medium backdrop-blur-sm">
            {formatPrice(template.suggestedPriceInCents)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Title */}
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.3px] mb-2 line-clamp-1 group-hover:text-brand-accent dark:group-hover:text-brand-accent transition-colors">
          {template.name}
        </h3>

        {/* Preview Description */}
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert line-clamp-2 mb-4 min-h-[40px]">
          {template.previewDescription}
        </p>

        {/* Stats Row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-[#a7a39e] dark:text-[#7d8190]">
            <ListTodo className="w-3.5 h-3.5" />
            <span>{template.lengthDays * 3}+ tasks</span>
          </div>
          {template.usageCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[#a7a39e] dark:text-[#7d8190]">
              <Users className="w-3.5 h-3.5" />
              <span>{template.usageCount} coaches</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md bg-[#f3f1ef] dark:bg-[#1d222b] text-[#5f5a55] dark:text-[#b2b6c2] text-xs font-albert"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="px-2 py-0.5 text-[#a7a39e] dark:text-[#7d8190] text-xs">
                +{template.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <span className="text-sm font-medium text-brand-accent font-albert group-hover:underline">
            View template
          </span>
          <div className="w-8 h-8 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center group-hover:bg-[#a07855] dark:group-hover:bg-brand-accent transition-colors">
            <ArrowRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] group-hover:text-white transition-colors" />
          </div>
        </div>
      </div>

      {/* Hover border effect */}
      <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-brand-accent/30 dark:group-hover:border-brand-accent/30 transition-colors pointer-events-none" />
    </motion.button>
  );
}

