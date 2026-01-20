'use client';

import { useState, useEffect, useRef } from 'react';
import type { DiscoverArticle } from '@/types/discover';
import { Button } from '@/components/ui/button';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { AuthorSelector } from '@/components/admin/AuthorSelector';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { ContentPricingFields, type ContentPricingData } from '@/components/admin/ContentPricingFields';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { ArticleSettingsModal } from './ArticleSettingsModal';
import { ArrowLeft, Settings2, Pencil } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface ArticleEditorProps {
  article: DiscoverArticle;
  onClose: () => void;
  onSave: () => void;
  uploadEndpoint: string;
  programsApiEndpoint: string;
  apiEndpoint: string;
  coachesApiEndpoint?: string;
  categoriesApiEndpoint?: string;
}

export function ArticleEditor({
  article,
  onClose,
  onSave,
  uploadEndpoint,
  programsApiEndpoint,
  apiEndpoint,
  coachesApiEndpoint = '/api/coach/org-coaches',
  categoriesApiEndpoint = '/api/coach/org-article-categories',
}: ArticleEditorProps) {
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    coverImageUrl: '',
    thumbnailUrl: '',
    authorId: null as string | null,
    authorName: '',
    authorTitle: '',
    publishedAt: '',
    category: '',
    programIds: [] as string[],
    featured: false,
    trending: false,
    priceInCents: null as number | null,
    currency: 'USD',
    purchaseType: 'popup' as 'popup' | 'landing_page',
    isPublic: true,
  });

  useEffect(() => {
    if (article) {
      setFormData({
        title: article.title || '',
        content: article.content || '',
        coverImageUrl: article.coverImageUrl || '',
        thumbnailUrl: article.thumbnailUrl || '',
        authorId: article.authorId || null,
        authorName: article.authorName || '',
        authorTitle: article.authorTitle || '',
        publishedAt: article.publishedAt ? article.publishedAt.split('T')[0] : '',
        category: article.category || '',
        programIds: article.programIds || [],
        featured: article.featured || false,
        trending: article.trending || false,
        priceInCents: article.priceInCents ?? null,
        currency: article.currency || 'USD',
        purchaseType: (article.purchaseType || 'popup') as 'popup' | 'landing_page',
        isPublic: article.isPublic !== false,
      });
    }
  }, [article]);

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }

    if (!formData.coverImageUrl.trim()) {
      alert('Cover image is required');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...formData,
        thumbnailUrl: formData.thumbnailUrl || null,
        publishedAt: formData.publishedAt ? new Date(formData.publishedAt).toISOString() : new Date().toISOString(),
        programIds: formData.programIds,
      };

      const url = `${apiEndpoint}/${article.id}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save article');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving article:', err);
      alert(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handleTitleEditClick = () => {
    titleInputRef.current?.focus();
  };

  // Pricing data for ContentPricingFields
  const pricingData: ContentPricingData = {
    priceInCents: formData.priceInCents,
    currency: formData.currency,
    purchaseType: formData.purchaseType,
    isPublic: formData.isPublic,
  };

  const handlePricingChange = (pricing: ContentPricingData) => {
    setFormData(prev => ({
      ...prev,
      priceInCents: pricing.priceInCents,
      currency: pricing.currency,
      purchaseType: pricing.purchaseType,
      isPublic: pricing.isPublic,
    }));
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#faf8f6] dark:bg-[#0d0f14]">
      {/* Header */}
      <div className="border-b border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <input
              ref={titleInputRef}
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={() => setIsTitleFocused(false)}
              placeholder="Article title..."
              className="flex-1 text-base sm:text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-[#9ca3af] min-w-0"
            />
            {!isTitleFocused && (
              <button
                type="button"
                onClick={handleTitleEditClick}
                className="p-1.5 text-[#9ca3af] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] transition-colors flex-shrink-0"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Settings Button - Mobile only */}
            {!isDesktop && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                title="Article Settings"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            )}

            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="hidden sm:inline-flex border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] font-albert"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !formData.title.trim()}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert text-sm sm:text-base px-3 sm:px-4"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content with Desktop Sidebar */}
      <div className="flex-1 flex overflow-hidden gap-6 p-6">
        {/* Main Content Area - Inline editing without container */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl">
            {/* Cover Image Section - Mobile only */}
            {!isDesktop && (
              <div className="mb-8">
                {formData.coverImageUrl ? (
                  <div className="relative group rounded-xl overflow-hidden">
                    <img
                      src={formData.coverImageUrl}
                      alt="Cover"
                      className="w-full h-48 sm:h-64 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, coverImageUrl: '' }))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-4 py-2 bg-white/90 dark:bg-[#171b22]/90 text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert font-medium text-sm"
                      >
                        Change Cover
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                      Cover Image <span className="text-text-muted text-xs font-normal">(1600 x 800px)</span>
                    </label>
                    <MediaUpload
                      value={formData.coverImageUrl}
                      onChange={(url) => setFormData(prev => ({ ...prev, coverImageUrl: url }))}
                      folder="articles"
                      type="image"
                      required
                      uploadEndpoint={uploadEndpoint}
                      hideLabel
                      aspectRatio="16:9"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Content Editor - Inline, no extra container */}
            <RichTextEditor
              value={formData.content}
              onChange={(content) => setFormData(prev => ({ ...prev, content }))}
              label="Content"
              required
              rows={24}
              placeholder="Write your article content here..."
              showMediaToolbar={true}
              mediaFolder="articles"
              uploadEndpoint={uploadEndpoint}
            />

            {/* Pricing & Access - Below content on desktop */}
            {isDesktop && (
              <div className="mt-8 pt-8 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 font-albert">
                  Pricing & Access
                </label>
                <ContentPricingFields
                  value={pricingData}
                  onChange={handlePricingChange}
                />
              </div>
            )}
          </div>
        </div>

        {/* Desktop Sidebar */}
        {isDesktop && (
          <div className="w-80 flex-shrink-0 overflow-y-auto bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8]/60 dark:border-[#262b35]/40">
            <div className="p-5 space-y-5">
              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Cover Image
                </label>
                {formData.coverImageUrl ? (
                  <div className="relative group rounded-xl overflow-hidden">
                    <img
                      src={formData.coverImageUrl}
                      alt="Cover"
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, coverImageUrl: '' }))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-white/90 dark:bg-[#171b22]/90 text-[#1a1a1a] dark:text-[#f5f5f8] rounded-lg font-albert font-medium text-xs"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <MediaUpload
                    value={formData.coverImageUrl}
                    onChange={(url) => setFormData(prev => ({ ...prev, coverImageUrl: url }))}
                    folder="articles"
                    type="image"
                    required
                    uploadEndpoint={uploadEndpoint}
                    hideLabel
                    aspectRatio="16:9"
                  />
                )}
              </div>

              <hr className="border-[#e1ddd8] dark:border-[#262b35]" />

              {/* Author */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Author
                </label>
                <AuthorSelector
                  value={formData.authorId}
                  onChange={({ authorId, authorName }) =>
                    setFormData(prev => ({ ...prev, authorId, authorName }))
                  }
                  placeholder="Select author..."
                  coachesApiEndpoint={coachesApiEndpoint}
                />
              </div>

              {/* Author Title */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Author Title
                  <span className="text-[#8c8a87] dark:text-[#8b8f9a] font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.authorTitle}
                  onChange={e => setFormData(prev => ({ ...prev, authorTitle: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors text-sm"
                  placeholder="e.g., Life Coach, CEO"
                />
              </div>

              <hr className="border-[#e1ddd8] dark:border-[#262b35]" />

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Category
                </label>
                <CategorySelector
                  value={formData.category}
                  onChange={(category) => setFormData(prev => ({ ...prev, category }))}
                  placeholder="Select or create..."
                  categoriesApiEndpoint={categoriesApiEndpoint}
                />
              </div>

              {/* Programs */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Programs
                </label>
                <ProgramSelector
                  value={formData.programIds}
                  onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
                  placeholder="Select programs..."
                  programsApiEndpoint={programsApiEndpoint}
                />
              </div>

              {/* Published Date */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Published Date
                </label>
                <input
                  type="date"
                  value={formData.publishedAt}
                  onChange={e => setFormData(prev => ({ ...prev, publishedAt: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors text-sm"
                />
              </div>

              <hr className="border-[#e1ddd8] dark:border-[#262b35]" />

              {/* Display Options */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 font-albert">
                  Display Options
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <BrandedCheckbox
                      checked={formData.featured}
                      onChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
                    />
                    <span
                      className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer"
                      onClick={() => setFormData(prev => ({ ...prev, featured: !prev.featured }))}
                    >
                      Featured
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BrandedCheckbox
                      checked={formData.trending}
                      onChange={(checked) => setFormData(prev => ({ ...prev, trending: checked }))}
                    />
                    <span
                      className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer"
                      onClick={() => setFormData(prev => ({ ...prev, trending: !prev.trending }))}
                    >
                      Trending
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal - Mobile only */}
      {!isDesktop && (
        <ArticleSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          formData={formData}
          onChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
          uploadEndpoint={uploadEndpoint}
          programsApiEndpoint={programsApiEndpoint}
          coachesApiEndpoint={coachesApiEndpoint}
          categoriesApiEndpoint={categoriesApiEndpoint}
        />
      )}
    </div>
  );
}
