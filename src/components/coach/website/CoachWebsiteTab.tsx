'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  AlertCircle,
  ExternalLink,
  Loader2,
  Save,
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WebsiteEditor } from './WebsiteEditor';
import { TemplateSelector } from './TemplateSelector';
import { useDemoMode } from '@/contexts/DemoModeContext';
import type { OrgWebsite, WebsiteTemplateName, WebsiteService } from '@/types';
import { DEFAULT_ORG_WEBSITE } from '@/types';
import type { WebsiteContentDraft } from '@/lib/ai/types';

interface SimpleFunnel {
  id: string;
  name: string;
  slug: string;
  targetType: string;
}

export function CoachWebsiteTab() {
  const { isDemoMode, openSignupModal } = useDemoMode();

  const [website, setWebsite] = useState<OrgWebsite | null>(null);
  const [funnels, setFunnels] = useState<SimpleFunnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Tenant required state
  const [tenantRequired, setTenantRequired] = useState<{
    tenantUrl: string | null;
    subdomain: string | null;
  } | null>(null);

  // Enable confirmation dialog
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const [pendingEnableState, setPendingEnableState] = useState(false);

  // AI generation state
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);

  // Form state - initialized from website or defaults
  const [formData, setFormData] = useState<Omit<OrgWebsite, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>({
    ...DEFAULT_ORG_WEBSITE,
  });

  const fetchWebsite = useCallback(async () => {
    if (isDemoMode) {
      // Demo mode: show empty website
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setTenantRequired(null);

      const response = await fetch('/api/coach/org-website');

      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'tenant_required') {
          setTenantRequired({
            tenantUrl: data.tenantUrl,
            subdomain: data.subdomain,
          });
          return;
        }
        throw new Error(data.error || 'Failed to fetch website');
      }

      const data = await response.json();
      setWebsite(data.website);
      setFunnels(data.funnels || []);

      // Initialize form data
      if (data.website) {
        const { id, organizationId, createdAt, updatedAt, ...rest } = data.website;
        setFormData(rest);
      }
    } catch (err) {
      console.error('Error fetching website:', err);
      setError(err instanceof Error ? err.message : 'Failed to load website');
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    fetchWebsite();
  }, [fetchWebsite]);

  const handleSave = async () => {
    if (isDemoMode) {
      openSignupModal?.();
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch('/api/coach/org-website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save website');
      }

      const data = await response.json();
      setWebsite(data.website);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Error saving website:', err);
      setError(err instanceof Error ? err.message : 'Failed to save website');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormChange = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const handleEnableToggle = (enabled: boolean) => {
    if (enabled && !formData.heroCtaFunnelId) {
      setError('Please select a funnel for the Join button before enabling your website');
      return;
    }

    if (enabled) {
      // Show confirmation dialog
      setPendingEnableState(true);
      setShowEnableConfirm(true);
    } else {
      // Disable immediately
      handleFormChange({ enabled: false });
    }
  };

  const confirmEnable = () => {
    handleFormChange({ enabled: pendingEnableState });
    setShowEnableConfirm(false);
  };

  const handleTemplateChange = (template: WebsiteTemplateName) => {
    handleFormChange({ template });
  };

  const handleAIGenerate = async () => {
    if (isDemoMode) {
      openSignupModal?.();
      return;
    }

    if (!aiPrompt.trim() || aiPrompt.length < 10) {
      setAIError('Please describe your coaching business in at least 10 characters');
      return;
    }

    try {
      setIsGenerating(true);
      setAIError(null);

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'LANDING_PAGE_WEBSITE',
          userPrompt: aiPrompt,
          context: {},
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate content');
      }

      const data = await response.json();
      const draft = data.draft as WebsiteContentDraft;

      // Apply the generated content to form data
      const generatedServices: WebsiteService[] = draft.services.items.map((item) => ({
        id: crypto.randomUUID(),
        title: item.title,
        description: item.description,
        icon: item.icon || 'star',
        funnelId: '', // User must select funnel
      }));

      handleFormChange({
        heroHeadline: draft.hero.headline,
        heroSubheadline: draft.hero.subheadline,
        heroCtaText: draft.hero.ctaText,
        coachHeadline: draft.coach.headline,
        coachBio: draft.coach.bio,
        coachBullets: draft.coach.bullets,
        servicesHeadline: draft.services.headline,
        services: generatedServices,
        testimonials: draft.testimonials.map((t) => ({
          text: t.quote,
          author: t.name,
          role: t.role || '',
          rating: 5,
        })),
        faqs: draft.faq,
        ctaHeadline: draft.cta.headline,
        ctaSubheadline: draft.cta.subheadline,
        ctaButtonText: draft.cta.buttonText,
        metaTitle: draft.seo.metaTitle,
        metaDescription: draft.seo.metaDescription,
      });

      setShowAIModal(false);
      setAIPrompt('');
    } catch (err) {
      console.error('AI generation error:', err);
      setAIError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  // Tenant required state
  if (tenantRequired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            Access from your domain
          </h2>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6">
            Website settings must be accessed from your organization&apos;s domain.
          </p>
          {tenantRequired.tenantUrl && (
            <a
              href={`${tenantRequired.tenantUrl}/coach?tab=website`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-lg font-albert font-medium transition-colors"
            >
              Go to {tenantRequired.subdomain}.coachful.co
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Enable Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Your Website
          </h2>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
            Create a beautiful landing page for visitors who aren&apos;t signed in
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="text-sm text-amber-600 dark:text-amber-400 font-albert">
              Unsaved changes
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => setShowAIModal(true)}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Generate with AI
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
        </div>
      )}

      {/* Enable/Disable Toggle Card */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Enable Website
              </h3>
              {formData.enabled && (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                  Live
                </span>
              )}
            </div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              When enabled, visitors who aren&apos;t signed in will see your website instead of the sign-in page.
            </p>
          </div>
          <Switch
            checked={formData.enabled}
            onCheckedChange={handleEnableToggle}
          />
        </div>

        {formData.enabled && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300 font-albert">
              Your website is live! Visitors will see this page when they visit your domain without being signed in.
            </p>
          </div>
        )}
      </div>

      {/* Template Selector */}
      <TemplateSelector
        value={formData.template}
        onChange={handleTemplateChange}
      />

      {/* Website Editor */}
      <WebsiteEditor
        formData={formData}
        onChange={handleFormChange}
        funnels={funnels}
      />

      {/* Enable Confirmation Dialog */}
      <AlertDialog open={showEnableConfirm} onOpenChange={setShowEnableConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable your website?</AlertDialogTitle>
            <AlertDialogDescription>
              When enabled, visitors who aren&apos;t signed in will see your website instead of the sign-in page.
              They can click &quot;Sign In&quot; to access the login page or &quot;Join&quot; to start your funnel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnable}>Enable Website</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Generation Modal */}
      <Dialog open={showAIModal} onOpenChange={setShowAIModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-accent" />
              Generate Website Content
            </DialogTitle>
            <DialogDescription>
              Describe your coaching business and we&apos;ll generate professional website content for you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                Describe your coaching business
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAIPrompt(e.target.value)}
                placeholder="Example: I'm a leadership coach helping executives develop their emotional intelligence and communication skills. My target audience is mid-level managers looking to advance to senior roles. I offer 1:1 coaching, group workshops, and a 12-week leadership development program."
                rows={6}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
                disabled={isGenerating}
              />
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1.5">
                Include your niche, target audience, services offered, and what makes you unique.
              </p>
            </div>

            {aiError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-albert">{aiError}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAIModal(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAIGenerate}
              disabled={isGenerating || !aiPrompt.trim()}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Content
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
