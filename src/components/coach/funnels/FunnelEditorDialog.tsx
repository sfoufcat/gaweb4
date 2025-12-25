'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Layers, UsersRound } from 'lucide-react';
import type { Funnel, Program, FunnelTargetType } from '@/types';
import { BrandedCheckbox } from '@/components/ui/checkbox';

interface Squad {
  id: string;
  name: string;
  slug?: string;
}

interface FunnelEditorDialogProps {
  mode: 'create' | 'edit';
  funnel?: Funnel;
  programs: Program[];
  squads?: Squad[];
  onClose: () => void;
  onSaved: () => void;
}

export function FunnelEditorDialog({ 
  mode, 
  funnel, 
  programs,
  squads = [],
  onClose, 
  onSaved 
}: FunnelEditorDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [formData, setFormData] = useState({
    name: funnel?.name || '',
    slug: funnel?.slug || '',
    targetType: (funnel?.targetType || 'program') as FunnelTargetType,
    programId: funnel?.programId || '',
    squadId: funnel?.squadId || '',
    description: funnel?.description || '',
    accessType: funnel?.accessType || 'public',
    isDefault: funnel?.isDefault || false,
  });

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = mode === 'create' 
      ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : formData.slug;
    setFormData(prev => ({ ...prev, name, slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate
      if (!formData.name.trim()) {
        throw new Error('Name is required');
      }
      if (!formData.slug.trim()) {
        throw new Error('Slug is required');
      }
      if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        throw new Error('Slug can only contain lowercase letters, numbers, and hyphens');
      }
      
      // Validate target selection
      if (formData.targetType === 'program' && !formData.programId) {
        throw new Error('Please select a program');
      }
      if (formData.targetType === 'squad' && !formData.squadId) {
        throw new Error('Please select a squad');
      }

      let response: Response;
      
      if (mode === 'edit' && funnel) {
        // Update existing funnel
        response = await fetch(`/api/coach/org-funnels/${funnel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            accessType: formData.accessType,
            isDefault: formData.isDefault,
          }),
        });
      } else {
        // Create new funnel
        response = await fetch('/api/coach/org-funnels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            slug: formData.slug,
            targetType: formData.targetType,
            programId: formData.targetType === 'program' ? formData.programId : null,
            squadId: formData.targetType === 'squad' ? formData.squadId : null,
            description: formData.description || null,
            accessType: formData.accessType,
            isDefault: formData.isDefault,
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

  if (!mounted) return null;

  const content = (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 font-albert">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8] font-albert">
            {mode === 'create' ? 'Create New Funnel' : 'Edit Funnel'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Target Type Toggle (only for create) */}
          {mode === 'create' && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Funnel Target *
                </label>
                <div className="flex gap-2 p-1 bg-[#f5f3f0] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, targetType: 'program', squadId: '' }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                      formData.targetType === 'program'
                        ? 'bg-white text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Program
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, targetType: 'squad', programId: '' }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                      formData.targetType === 'squad'
                        ? 'bg-white text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <UsersRound className="w-4 h-4" />
                    Squad
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-2">
                  {formData.targetType === 'program'
                    ? 'Enroll users in a program through this funnel'
                    : 'Add users directly to a squad through this funnel'}
                </p>
              </div>

              {/* Program Selector (when targetType is program) */}
              {formData.targetType === 'program' && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Program *
                  </label>
                  <select
                    value={formData.programId}
                    onChange={(e) => setFormData(prev => ({ ...prev, programId: e.target.value }))}
                    className="w-full px-4 py-2 bg-white border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
                    required={formData.targetType === 'program'}
                  >
                    <option value="">Select a program</option>
                    {programs.map(program => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Squad Selector (when targetType is squad) */}
              {formData.targetType === 'squad' && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Squad *
                  </label>
                  <select
                    value={formData.squadId}
                    onChange={(e) => setFormData(prev => ({ ...prev, squadId: e.target.value }))}
                    className="w-full px-4 py-2 bg-white border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
                    required={formData.targetType === 'squad'}
                  >
                    <option value="">Select a squad</option>
                    {squads.map(squad => (
                      <option key={squad.id} value={squad.id}>
                        {squad.name}
                      </option>
                    ))}
                  </select>
                  {squads.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No squads available. Create a squad first.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Discovery Quiz"
              className="w-full px-4 py-2 bg-white border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855]"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              URL Slug *
            </label>
            <div className="flex items-center">
              <span className="px-3 py-2 bg-[#f5f3f0] border border-r-0 border-[#e1ddd8] rounded-l-lg text-text-muted text-sm whitespace-nowrap">
                {formData.targetType === 'squad' ? '/join/squad/[slug]/' : '/join/[program]/'}
              </span>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') 
                }))}
                placeholder="discovery-quiz"
                className="flex-1 px-4 py-2 bg-white border border-[#e1ddd8] rounded-r-lg focus:outline-none focus:border-[#a07855]"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description for internal use"
              rows={2}
              className="w-full px-4 py-2 bg-white border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-[#a07855] resize-none"
            />
          </div>

          {/* Access Type */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Access Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="accessType"
                  value="public"
                  checked={formData.accessType === 'public'}
                  onChange={(e) => setFormData(prev => ({ ...prev, accessType: e.target.value as 'public' | 'invite_only' }))}
                  className="text-[#a07855] focus:ring-[#a07855]"
                />
                <span className="text-text-primary">Public</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="accessType"
                  value="invite_only"
                  checked={formData.accessType === 'invite_only'}
                  onChange={(e) => setFormData(prev => ({ ...prev, accessType: e.target.value as 'public' | 'invite_only' }))}
                  className="text-[#a07855] focus:ring-[#a07855]"
                />
                <span className="text-text-primary">Invite Only</span>
              </label>
            </div>
            <p className="text-xs text-text-muted mt-1">
              {formData.accessType === 'public' 
                ? 'Anyone with the link can access this funnel'
                : 'Only users with an invite code can access this funnel'}
            </p>
          </div>

          {/* Is Default */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <BrandedCheckbox
                checked={formData.isDefault}
                onChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
              />
              <span className="text-text-primary">
                Set as default funnel for this {formData.targetType}
              </span>
            </label>
            <p className="text-xs text-text-muted mt-1 ml-6">
              {formData.targetType === 'squad'
                ? 'The default funnel is used when users visit /join/squad/[slug] without specifying a funnel'
                : 'The default funnel is used when users visit /join/[program] without specifying a funnel'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 bg-[#a07855] text-white rounded-lg hover:bg-[#8c6245] disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Funnel' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

