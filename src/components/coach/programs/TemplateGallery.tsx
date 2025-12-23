'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowLeft, X, Loader2, LayoutGrid } from 'lucide-react';
import { TemplateCard } from './TemplateCard';
import type { ProgramTemplate, TemplateCategory } from '@/types';

interface TemplateGalleryProps {
  onSelectTemplate: (template: ProgramTemplate) => void;
  onBack: () => void;
  onClose: () => void;
}

type DurationFilter = 'all' | 'short' | 'medium' | 'long';

const CATEGORIES: { value: TemplateCategory | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'bg-[#5f5a55] text-white' },
  { value: 'business', label: 'Business', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'habits', label: 'Habits', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'mindset', label: 'Mindset', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'health', label: 'Health', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  { value: 'productivity', label: 'Productivity', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'relationships', label: 'Relationships', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
];

const DURATIONS: { value: DurationFilter; label: string }[] = [
  { value: 'all', label: 'Any length' },
  { value: 'short', label: '7-14 days' },
  { value: 'medium', label: '21-30 days' },
  { value: 'long', label: '60+ days' },
];

export function TemplateGallery({ onSelectTemplate, onBack, onClose }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedDuration, setSelectedDuration] = useState<DurationFilter>('all');

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        if (selectedCategory !== 'all') {
          params.set('category', selectedCategory);
        }
        if (selectedDuration !== 'all') {
          params.set('duration', selectedDuration);
        }
        if (searchQuery.trim()) {
          params.set('search', searchQuery.trim());
        }
        
        const response = await fetch(`/api/templates?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }
        
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (err) {
        console.error('Error fetching templates:', err);
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    };
    
    // Debounce search
    const timeoutId = setTimeout(fetchTemplates, searchQuery ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [selectedCategory, selectedDuration, searchQuery]);

  // Separate featured templates
  const featuredTemplates = templates.filter(t => t.featured);
  const regularTemplates = templates.filter(t => !t.featured);

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
              Template Gallery
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {templates.length} templates available
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

      {/* Filters */}
      <div className="px-6 py-4 space-y-4 border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:focus:border-[#b8896a] transition-all"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium font-albert transition-all duration-200 ${
                selectedCategory === cat.value
                  ? 'bg-[#a07855] text-white dark:bg-[#b8896a]'
                  : 'bg-white dark:bg-[#1d222b] text-[#5f5a55] dark:text-[#b2b6c2] border border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855] dark:hover:border-[#b8896a]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Duration Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Duration:</span>
          <div className="flex gap-1 p-1 rounded-xl bg-white dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35]">
            {DURATIONS.map((dur) => (
              <button
                key={dur.value}
                onClick={() => setSelectedDuration(dur.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-albert transition-all duration-200 ${
                  selectedDuration === dur.value
                    ? 'bg-[#a07855] text-white dark:bg-[#b8896a]'
                    : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                }`}
              >
                {dur.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="space-y-8 animate-pulse">
            {/* Featured section skeleton */}
            <div className="space-y-4">
              <div className="h-6 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
                    <div className="h-40 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
                    <div className="p-4 space-y-3">
                      <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                      <div className="h-4 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                      <div className="flex gap-2">
                        <div className="h-5 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                        <div className="h-5 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* All templates grid skeleton */}
            <div className="space-y-4">
              <div className="h-6 w-28 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
                    <div className="h-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                      <div className="h-3 w-1/2 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-red-600 dark:text-red-400 font-albert mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-[#a07855] dark:text-[#b8896a] font-albert text-sm hover:underline"
            >
              Try again
            </button>
          </div>
        ) : templates.length === 0 ? (
          <EmptyState 
            searchQuery={searchQuery}
            category={selectedCategory}
            onClearFilters={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedDuration('all');
            }}
          />
        ) : (
          <div className="space-y-8">
            {/* Featured Section */}
            {featuredTemplates.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#a07855] dark:text-[#b8896a] font-albert uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-6 h-px bg-[#a07855] dark:bg-[#b8896a]" />
                  Featured Templates
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {featuredTemplates.map((template, index) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <TemplateCard
                        template={template}
                        onSelect={() => onSelectTemplate(template)}
                        featured
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* All Templates */}
            {regularTemplates.length > 0 && (
              <div>
                {featuredTemplates.length > 0 && (
                  <h3 className="text-sm font-semibold text-[#5f5a55] dark:text-[#b2b6c2] font-albert uppercase tracking-wider mb-4">
                    All Templates
                  </h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {regularTemplates.map((template, index) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (featuredTemplates.length + index) * 0.05 }}
                    >
                      <TemplateCard
                        template={template}
                        onSelect={() => onSelectTemplate(template)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Empty State Component
interface EmptyStateProps {
  searchQuery: string;
  category: TemplateCategory | 'all';
  onClearFilters: () => void;
}

function EmptyState({ searchQuery, category, onClearFilters }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#f3f1ef] dark:bg-[#1d222b] flex items-center justify-center mb-6">
        <LayoutGrid className="w-10 h-10 text-[#a7a39e] dark:text-[#7d8190]" />
      </div>
      <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
        No templates found
      </h3>
      <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert max-w-sm mb-6">
        {searchQuery 
          ? `No templates match "${searchQuery}"`
          : category !== 'all'
            ? `No templates in the ${category} category yet`
            : 'No templates available at the moment'
        }
      </p>
      {(searchQuery || category !== 'all') && (
        <button
          onClick={onClearFilters}
          className="px-4 py-2 rounded-xl bg-[#a07855] hover:bg-[#8c6245] dark:bg-[#b8896a] dark:hover:bg-[#a07855] text-white font-albert text-sm transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

