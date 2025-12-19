'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Quiz, UserTrack } from '@/types';
import { TRACKS } from '@/lib/track-constants';

interface QuizEditorDialogProps {
  mode: 'create' | 'clone' | 'edit';
  sourceQuiz?: Quiz;
  onClose: () => void;
  onSaved: () => void;
}

export function QuizEditorDialog({ mode, sourceQuiz, onClose, onSaved }: QuizEditorDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ensure portal only renders on client
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [formData, setFormData] = useState({
    slug: mode === 'clone' ? '' : (sourceQuiz?.slug || ''),
    title: mode === 'clone' ? '' : (sourceQuiz?.title || ''),
    trackId: sourceQuiz?.trackId || '',
    isActive: mode === 'edit' ? (sourceQuiz?.isActive ?? true) : false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate
      if (!formData.slug.trim()) {
        throw new Error('Slug is required');
      }
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      // Validate slug format
      if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        throw new Error('Slug can only contain lowercase letters, numbers, and hyphens');
      }

      let response: Response;
      
      if (mode === 'clone' && sourceQuiz) {
        // Clone existing quiz
        response = await fetch(`/api/admin/quizzes/${sourceQuiz.id}/clone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: formData.slug,
            title: formData.title,
            trackId: formData.trackId || null,
          }),
        });
      } else if (mode === 'edit' && sourceQuiz) {
        // Update existing quiz
        response = await fetch(`/api/admin/quizzes/${sourceQuiz.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: formData.slug,
            title: formData.title,
            trackId: formData.trackId || null,
            isActive: formData.isActive,
          }),
        });
      } else {
        // Create new quiz
        response = await fetch('/api/admin/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: formData.slug,
            title: formData.title,
            trackId: formData.trackId || null,
            isActive: formData.isActive,
          }),
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Operation failed');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'create': return 'Create New Quiz';
      case 'clone': return `Clone Quiz: ${sourceQuiz?.title}`;
      case 'edit': return 'Edit Quiz';
    }
  };

  // Don't render on server or before mount
  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-[#171b22] rounded-xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {getTitle()}
          </h3>
          {mode === 'clone' && (
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              All steps and options will be copied to the new quiz
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Slug *
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase() }))}
              placeholder="e.g., saas-founder"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert"
              required
            />
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Used in URL: /start/<span className="font-mono">{formData.slug || 'slug'}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., SaaS Founder Growth Quiz"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Track
            </label>
            <select
              value={formData.trackId}
              onChange={e => setFormData(prev => ({ ...prev, trackId: e.target.value as UserTrack }))}
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#0d0f12] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855]/50 font-albert"
            >
              <option value="">Unassigned</option>
              {TRACKS.map(track => (
                <option key={track.id} value={track.id}>
                  {track.icon} {track.label}
                </option>
              ))}
            </select>
          </div>

          {mode !== 'clone' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border-[#e1ddd8] dark:border-[#262b35] text-[#a07855] focus:ring-[#a07855]"
              />
              <label htmlFor="isActive" className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Active (live on the site)
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded-lg font-albert text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#a07855] text-white rounded-lg font-albert text-sm font-medium hover:bg-[#8c6245] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {mode === 'create' ? 'Create Quiz' : mode === 'clone' ? 'Clone Quiz' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

