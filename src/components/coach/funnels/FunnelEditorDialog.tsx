'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Layers, UsersRound, ChevronDown, ChevronUp, Code, FileText, BookOpen, Calendar, Download, Link as LinkIcon, Plus } from 'lucide-react';
import { NewProgramModal } from '../programs/NewProgramModal';
import type { Funnel, Program, FunnelTargetType, FunnelContentType, FunnelTrackingConfig } from '@/types';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface Squad {
  id: string;
  name: string;
  slug?: string;
}

interface ContentItem {
  id: string;
  title: string;
}

interface FunnelFormData {
  name: string;
  slug: string;
  targetType: FunnelTargetType;
  programId: string;
  squadId: string;
  contentType: FunnelContentType;
  contentId: string;
  description: string;
  accessType: string;
  isDefault: boolean;
}

interface FunnelEditorDialogProps {
  mode: 'create' | 'edit';
  funnel?: Funnel;
  programs: Program[];
  squads?: Squad[];
  /** Pre-selected content type when creating from content tab */
  initialContentType?: FunnelContentType;
  onClose: () => void;
  onSaved: () => void;
  /** Demo mode - skip API calls and use onDemoSave instead */
  demoMode?: boolean;
  /** Called in demo mode instead of making API calls */
  onDemoSave?: (data: FunnelFormData, isEdit: boolean) => void;
  /** Called to refresh programs list after creating a new program */
  onRefreshPrograms?: () => Promise<void>;
}

const CONTENT_TYPES: { value: FunnelContentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'article', label: 'Article', icon: FileText },
  { value: 'course', label: 'Course', icon: BookOpen },
  { value: 'event', label: 'Event', icon: Calendar },
  { value: 'download', label: 'Download', icon: Download },
  { value: 'link', label: 'Link', icon: LinkIcon },
];

export function FunnelEditorDialog({
  mode,
  funnel,
  programs,
  squads = [],
  initialContentType,
  onClose,
  onSaved,
  demoMode = false,
  onDemoSave,
  onRefreshPrograms,
}: FunnelEditorDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProgramWizard, setShowProgramWizard] = useState(false);

  // Content items state
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const [formData, setFormData] = useState({
    name: funnel?.name || '',
    slug: funnel?.slug || '',
    targetType: (funnel?.targetType || (initialContentType ? 'content' : 'program')) as FunnelTargetType,
    programId: funnel?.programId || '',
    squadId: funnel?.squadId || '',
    contentType: (funnel?.contentType || initialContentType || 'article') as FunnelContentType,
    contentId: funnel?.contentId || '',
    description: funnel?.description || '',
    accessType: funnel?.accessType || 'public',
    isDefault: funnel?.isDefault || false,
    tracking: {
      metaPixelId: funnel?.tracking?.metaPixelId || '',
      googleAnalyticsId: funnel?.tracking?.googleAnalyticsId || '',
      googleAdsId: funnel?.tracking?.googleAdsId || '',
      customHeadHtml: funnel?.tracking?.customHeadHtml || '',
      customBodyHtml: funnel?.tracking?.customBodyHtml || '',
    } as FunnelTrackingConfig,
  });
  
  // Toggle for showing tracking settings
  const [showTrackingSettings, setShowTrackingSettings] = useState(
    !!(funnel?.tracking?.metaPixelId || funnel?.tracking?.googleAnalyticsId || funnel?.tracking?.googleAdsId || funnel?.tracking?.customHeadHtml || funnel?.tracking?.customBodyHtml)
  );

  // Fetch content items when content type changes
  const fetchContentItems = useCallback(async (contentType: FunnelContentType) => {
    setIsLoadingContent(true);
    try {
      // Map content type to API endpoint
      const endpointMap: Record<FunnelContentType, string> = {
        article: '/api/coach/org-discover/articles',
        course: '/api/coach/org-discover/courses',
        event: '/api/coach/org-discover/events',
        download: '/api/coach/org-discover/downloads',
        link: '/api/coach/org-discover/links',
      };
      
      const response = await fetch(endpointMap[contentType]);
      if (!response.ok) throw new Error('Failed to fetch content');
      const data = await response.json();
      
      // Normalize the response - different endpoints return different structures
      let items: ContentItem[] = [];
      if (data.articles) {
        items = data.articles.map((a: { id: string; title: string }) => ({ id: a.id, title: a.title }));
      } else if (data.courses) {
        items = data.courses.map((c: { id: string; title: string }) => ({ id: c.id, title: c.title }));
      } else if (data.events) {
        items = data.events.map((e: { id: string; title: string }) => ({ id: e.id, title: e.title }));
      } else if (data.downloads) {
        items = data.downloads.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title }));
      } else if (data.links) {
        items = data.links.map((l: { id: string; title: string }) => ({ id: l.id, title: l.title }));
      }
      
      setContentItems(items);
    } catch (err) {
      console.error('Failed to fetch content items:', err);
      setContentItems([]);
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  // Fetch content items when content type changes
  useEffect(() => {
    if (formData.targetType === 'content') {
      fetchContentItems(formData.contentType);
    }
  }, [formData.targetType, formData.contentType, fetchContentItems]);

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
      if (formData.targetType === 'content' && !formData.contentId) {
        throw new Error('Please select a content item');
      }
      
      // In demo mode, call the onDemoSave callback instead of making API calls
      if (demoMode && onDemoSave) {
        onDemoSave({
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          targetType: formData.targetType,
          programId: formData.programId,
          squadId: formData.squadId,
          contentType: formData.contentType,
          contentId: formData.contentId,
          description: formData.description,
          accessType: formData.accessType,
          isDefault: formData.isDefault,
        }, mode === 'edit');
        onSaved();
        return;
      }

      // Build tracking config (only include non-empty values)
      const trackingConfig: FunnelTrackingConfig = {};
      if (formData.tracking.metaPixelId?.trim()) {
        trackingConfig.metaPixelId = formData.tracking.metaPixelId.trim();
      }
      if (formData.tracking.googleAnalyticsId?.trim()) {
        trackingConfig.googleAnalyticsId = formData.tracking.googleAnalyticsId.trim();
      }
      if (formData.tracking.googleAdsId?.trim()) {
        trackingConfig.googleAdsId = formData.tracking.googleAdsId.trim();
      }
      if (formData.tracking.customHeadHtml?.trim()) {
        trackingConfig.customHeadHtml = formData.tracking.customHeadHtml.trim();
      }
      if (formData.tracking.customBodyHtml?.trim()) {
        trackingConfig.customBodyHtml = formData.tracking.customBodyHtml.trim();
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
            tracking: Object.keys(trackingConfig).length > 0 ? trackingConfig : null,
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
            contentType: formData.targetType === 'content' ? formData.contentType : null,
            contentId: formData.targetType === 'content' ? formData.contentId : null,
            description: formData.description || null,
            accessType: formData.accessType,
            isDefault: formData.isDefault,
            tracking: Object.keys(trackingConfig).length > 0 ? trackingConfig : null,
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

  // Get URL slug prefix based on target type
  const getSlugPrefix = () => {
    if (formData.targetType === 'squad') return '/join/squad/[slug]/';
    if (formData.targetType === 'content') return `/join/content/${formData.contentType}/[id]/`;
    return '/join/[program]/';
  };

  // Get target type description
  const getTargetDescription = () => {
    if (formData.targetType === 'program') return 'Enroll users in a program through this funnel';
    if (formData.targetType === 'squad') return 'Add users directly to a squad through this funnel';
    return 'Sell or gate access to content through this funnel';
  };

  // Form content - shared between Dialog and Drawer
  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-5">
          {/* Target Type Toggle (only for create) */}
          {mode === 'create' && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  Funnel Target *
                </label>
                <div className="flex gap-2 p-1 bg-[#f5f3f0] dark:bg-[#1a1f27] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, targetType: 'program', squadId: '', contentId: '' }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-albert font-medium transition-all ${
                      formData.targetType === 'program'
                        ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                        : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Program
                  </button>
                  {/* HIDDEN: Standalone squads disabled - squads now managed via Program > Community */}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, targetType: 'content', programId: '', squadId: '' }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-albert font-medium transition-all ${
                      formData.targetType === 'content'
                        ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                        : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Content
                  </button>
                </div>
                <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mt-2">
                  {getTargetDescription()}
                </p>
              </div>

              {/* Program Selector (when targetType is program) */}
              {formData.targetType === 'program' && (
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Program *
                  </label>
                  {programs.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#13171f] text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-accent/10 flex items-center justify-center">
                        <Layers className="w-6 h-6 text-brand-accent" />
                      </div>
                      <h4 className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                        No programs yet
                      </h4>
                      <p className="text-sm text-[#8c8c8c] dark:text-[#7f8694] font-albert mb-4">
                        Create a program first to set up a funnel for it
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowProgramWizard(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-accent text-white text-sm font-medium hover:bg-brand-accent/90 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create Program
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.programId}
                      onChange={(e) => setFormData(prev => ({ ...prev, programId: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      required={formData.targetType === 'program'}
                    >
                      <option value="">Select a program</option>
                      {programs.map(program => (
                        <option key={program.id} value={program.id}>
                          {program.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* HIDDEN: Standalone squads disabled - squads now managed via Program > Community */}

              {/* Content Type and Item Selector (when targetType is content) */}
              {formData.targetType === 'content' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Content Type *
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {CONTENT_TYPES.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, contentType: value, contentId: '' }))}
                          className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all ${
                            formData.contentType === value
                              ? 'bg-brand-accent/10 border-brand-accent text-brand-accent'
                              : 'bg-white dark:bg-[#1a1f27] border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent/50'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-albert font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Select {CONTENT_TYPES.find(t => t.value === formData.contentType)?.label} *
                    </label>
                    <select
                      value={formData.contentId}
                      onChange={(e) => setFormData(prev => ({ ...prev, contentId: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      required={formData.targetType === 'content'}
                      disabled={isLoadingContent}
                    >
                      <option value="">
                        {isLoadingContent ? 'Loading...' : `Select ${formData.contentType}`}
                      </option>
                      {contentItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                    {!isLoadingContent && contentItems.length === 0 && (
                      <p className="text-xs text-amber-600 font-albert mt-1">
                        No {formData.contentType}s available. Create one first in the Discover tab.
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Discovery Quiz"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              URL Slug *
            </label>
            <div className="flex items-center">
              <span className="px-3 py-2.5 bg-[#f5f3f0] dark:bg-[#1a1f27] border border-r-0 border-[#e1ddd8] dark:border-[#262b35] rounded-l-xl text-[#8c8c8c] dark:text-[#7f8694] text-sm font-albert whitespace-nowrap">
                {getSlugPrefix()}
              </span>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                }))}
                placeholder="discovery-quiz"
                className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-r-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description for internal use"
              rows={2}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
            />
          </div>

          {/* Access Type */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              Access Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <span className="relative flex items-center justify-center">
                  <input
                    type="radio"
                    name="accessType"
                    value="public"
                    checked={formData.accessType === 'public'}
                    onChange={(e) => setFormData(prev => ({ ...prev, accessType: e.target.value as 'public' | 'invite_only' }))}
                    className="sr-only"
                  />
                  <span className={`w-[18px] h-[18px] rounded-full border-2 transition-colors ${
                    formData.accessType === 'public'
                      ? 'border-brand-accent'
                      : 'border-[#d1cdc8] dark:border-[#3a4150]'
                  }`}>
                    {formData.accessType === 'public' && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-accent" />
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm">Public</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <span className="relative flex items-center justify-center">
                  <input
                    type="radio"
                    name="accessType"
                    value="invite_only"
                    checked={formData.accessType === 'invite_only'}
                    onChange={(e) => setFormData(prev => ({ ...prev, accessType: e.target.value as 'public' | 'invite_only' }))}
                    className="sr-only"
                  />
                  <span className={`w-[18px] h-[18px] rounded-full border-2 transition-colors ${
                    formData.accessType === 'invite_only'
                      ? 'border-brand-accent'
                      : 'border-[#d1cdc8] dark:border-[#3a4150]'
                  }`}>
                    {formData.accessType === 'invite_only' && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-accent" />
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm">Invite Only</span>
              </label>
            </div>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mt-1">
              {formData.accessType === 'public'
                ? 'Anyone with the link can access this funnel'
                : 'Only users with an invite code can access this funnel'}
            </p>
          </div>

          {/* Is Default */}
          <div>
            <div className="flex items-center gap-2">
              <BrandedCheckbox
                checked={formData.isDefault}
                onChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
              />
              <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, isDefault: !prev.isDefault }))}>
                Set as default funnel for this {formData.targetType === 'content' ? 'content item' : formData.targetType}
              </span>
            </div>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mt-1 ml-6">
              {formData.targetType === 'squad'
                ? 'The default funnel is used when users visit /join/squad/[slug] without specifying a funnel'
                : formData.targetType === 'content'
                ? 'The default funnel is used when users visit /join/content/[type]/[id] without specifying a funnel'
                : 'The default funnel is used when users visit /join/[program] without specifying a funnel'}
            </p>
          </div>

          {/* Tracking Settings (Collapsible) */}
          <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTrackingSettings(!showTrackingSettings)}
              className="w-full flex items-center justify-between p-4 bg-[#faf8f6] dark:bg-[#1a1f27] hover:bg-[#f5f3f0] dark:hover:bg-[#1e232c] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Code className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                <div className="text-left">
                  <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">Tracking Pixels</span>
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mt-0.5">
                    Meta Pixel, Google Analytics, custom code
                  </p>
                </div>
              </div>
              {showTrackingSettings ? (
                <ChevronUp className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
              )}
            </button>

            {showTrackingSettings && (
              <div className="p-4 space-y-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                {/* Meta Pixel ID */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Meta Pixel ID
                  </label>
                  <input
                    type="text"
                    value={formData.tracking.metaPixelId || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      tracking: { ...prev.tracking, metaPixelId: e.target.value }
                    }))}
                    placeholder="e.g., 1234567890"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c]"
                  />
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mt-1">
                    Facebook/Meta Pixel ID for conversion tracking
                  </p>
                </div>

                {/* Google Analytics ID */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Google Analytics ID
                  </label>
                  <input
                    type="text"
                    value={formData.tracking.googleAnalyticsId || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      tracking: { ...prev.tracking, googleAnalyticsId: e.target.value }
                    }))}
                    placeholder="e.g., G-XXXXXXXXXX"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c]"
                  />
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mt-1">
                    Google Analytics 4 measurement ID
                  </p>
                </div>

                {/* Google Ads ID */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Google Ads ID
                  </label>
                  <input
                    type="text"
                    value={formData.tracking.googleAdsId || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      tracking: { ...prev.tracking, googleAdsId: e.target.value }
                    }))}
                    placeholder="e.g., AW-XXXXXXXXXX"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c]"
                  />
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mt-1">
                    Google Ads conversion tracking ID
                  </p>
                </div>

                {/* Custom Head HTML */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Custom Head Code
                  </label>
                  <textarea
                    value={formData.tracking.customHeadHtml || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      tracking: { ...prev.tracking, customHeadHtml: e.target.value }
                    }))}
                    placeholder="<!-- TikTok Pixel, Snapchat Pixel, etc. -->"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50 resize-none font-mono text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c]"
                  />
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mt-1">
                    Custom scripts injected in &lt;head&gt; - use for other tracking pixels
                  </p>
                </div>

                {/* Custom Body HTML */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Custom Body Code
                  </label>
                  <textarea
                    value={formData.tracking.customBodyHtml || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      tracking: { ...prev.tracking, customBodyHtml: e.target.value }
                    }))}
                    placeholder="<!-- Scripts that need to run in body -->"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50 resize-none font-mono text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c]"
                  />
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mt-1">
                    Custom scripts injected in &lt;body&gt;
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-albert">
              {error}
            </div>
          )}

      </div>

      {/* Actions - Sticky footer */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 bg-brand-accent text-white rounded-xl font-albert font-medium hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Funnel' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );

  // Program creation wizard modal
  const programWizardModal = (
    <NewProgramModal
      isOpen={showProgramWizard}
      onClose={() => setShowProgramWizard(false)}
      onCreateFromScratch={() => {
        setShowProgramWizard(false);
        onClose(); // Close funnel dialog so user can edit the program
      }}
      onProgramCreated={async (programId) => {
        setShowProgramWizard(false);
        // Refresh programs list and auto-select the new program
        if (onRefreshPrograms) {
          await onRefreshPrograms();
        }
        setFormData(prev => ({ ...prev, programId }));
      }}
      demoMode={demoMode}
    />
  );

  // Desktop: Dialog
  if (isDesktop) {
    return (
      <>
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="max-w-2xl p-0 gap-0 rounded-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#e1ddd8] dark:border-[#262b35] flex-shrink-0">
              <DialogTitle className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {mode === 'create' ? 'Create New Funnel' : 'Edit Funnel'}
              </DialogTitle>
              <DialogDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                {mode === 'create'
                  ? 'Create a custom entry point for your program, squad, or content'
                  : 'Update your funnel settings'}
              </DialogDescription>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
        {programWizardModal}
      </>
    );
  }

  // Mobile: Drawer (slide up bottom sheet)
  return (
    <>
      <Drawer open={true} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="px-4 pb-3 border-b border-[#e1ddd8] dark:border-[#262b35] flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {mode === 'create' ? 'Create New Funnel' : 'Edit Funnel'}
                </DrawerTitle>
                <DrawerDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                  {mode === 'create'
                    ? 'Create a custom entry point'
                    : 'Update your funnel settings'}
                </DrawerDescription>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
              >
                <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
              </button>
            </div>
          </DrawerHeader>
          {formContent}
          {/* Safe area padding for mobile */}
          <div className="h-6 flex-shrink-0" />
        </DrawerContent>
      </Drawer>
      {programWizardModal}
    </>
  );
}
