'use client';

import { useState, useEffect } from 'react';
import type { DiscoverArticle } from '@/types/discover';
import { Button } from '@/components/ui/button';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { ArticleSettingsModal } from './ArticleSettingsModal';
import { ArrowLeft, Settings2, ImageIcon } from 'lucide-react';

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
  const [showCoverUpload, setShowCoverUpload] = useState(false);

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

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#faf8f6] dark:bg-[#0d0f14]">
      {/* Header */}
      <div className="border-b border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Article title..."
              className="flex-1 text-base sm:text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-[#9ca3af] min-w-0"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Settings Button */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              title="Article Settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="hidden sm:inline-flex border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-[#262b35] font-albert"
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Cover Image Section */}
          <div className="rounded-2xl border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#171b22] overflow-hidden">
            {formData.coverImageUrl && !showCoverUpload ? (
              <div className="relative group">
                <img
                  src={formData.coverImageUrl}
                  alt="Cover"
                  className="w-full h-48 sm:h-64 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setShowCoverUpload(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity px-4 py-2 bg-white/90 dark:bg-[#171b22]/90 text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert font-medium text-sm flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Change Cover
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Cover Image <span className="text-text-muted text-xs font-normal">(1600 x 800px)</span>
                </label>
                <MediaUpload
                  value={formData.coverImageUrl}
                  onChange={(url) => {
                    setFormData(prev => ({ ...prev, coverImageUrl: url }));
                    if (url) setShowCoverUpload(false);
                  }}
                  folder="articles"
                  type="image"
                  required
                  uploadEndpoint={uploadEndpoint}
                  hideLabel
                  aspectRatio="16:9"
                />
                {formData.coverImageUrl && (
                  <button
                    type="button"
                    onClick={() => setShowCoverUpload(false)}
                    className="mt-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent font-albert"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content Editor Section */}
          <div className="rounded-2xl border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#171b22] overflow-hidden">
            <div className="p-4 sm:p-6">
              <RichTextEditor
                value={formData.content}
                onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                label="Content"
                required
                rows={20}
                placeholder="Write your article content here..."
                showMediaToolbar={true}
                mediaFolder="articles"
                uploadEndpoint={uploadEndpoint}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
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
    </div>
  );
}
