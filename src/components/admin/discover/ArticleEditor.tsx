'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { DiscoverArticle } from '@/types/discover';
import { Button } from '@/components/ui/button';
import { AuthorSelector } from '@/components/admin/AuthorSelector';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { ContentPricingFields, type ContentPricingData } from '@/components/admin/ContentPricingFields';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { ArticleSettingsModal } from './ArticleSettingsModal';
import { DatePicker } from '@/components/ui/date-picker';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  ArrowLeft,
  Settings2,
  X,
  Bold,
  Italic,
  List,
  ListOrdered,
  Image as ImageIcon,
} from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

// Inline TipTap content editor - truly inline like Notion, always-visible formatting
function InlineContentEditor({
  value,
  onChange,
  placeholder = 'Write your article...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none font-albert text-[#1a1a1a] dark:text-[#f5f5f8] min-h-[200px] prose prose-lg dark:prose-invert max-w-none [&_.is-editor-empty:first-child::before]:text-[#a7a39e] [&_.is-editor-empty:first-child::before]:dark:text-[#5f6470] [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:pointer-events-none',
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  const buttonClass = (isActive: boolean) =>
    `p-1.5 rounded transition-colors ${
      isActive
        ? 'bg-brand-accent text-white'
        : 'text-[#9a958f] dark:text-[#6b7280] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
    }`;

  return (
    <div>
      {/* Always-visible formatting toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 mb-3">
        {/* Text formatting */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBold().run();
          }}
          className={buttonClass(editor.isActive('bold'))}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleItalic().run();
          }}
          className={buttonClass(editor.isActive('italic'))}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleStrike().run();
          }}
          className={buttonClass(editor.isActive('strike'))}
          title="Strikethrough"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 12h18v2H3v-2zm6-7h6v3H9V5zm0 14h6v-3H9v3z" />
          </svg>
        </button>

        <div className="w-px h-4 bg-[#e8e4df] dark:bg-[#3a3f4b] mx-1" />

        {/* Headings */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 2 }).run();
          }}
          className={buttonClass(editor.isActive('heading', { level: 2 }))}
          title="Heading 2"
        >
          <span className="font-bold text-xs font-albert">H2</span>
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 3 }).run();
          }}
          className={buttonClass(editor.isActive('heading', { level: 3 }))}
          title="Heading 3"
        >
          <span className="font-bold text-xs font-albert">H3</span>
        </button>

        <div className="w-px h-4 bg-[#e8e4df] dark:bg-[#3a3f4b] mx-1" />

        {/* Lists */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBulletList().run();
          }}
          className={buttonClass(editor.isActive('bulletList'))}
          title="Bullet list"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleOrderedList().run();
          }}
          className={buttonClass(editor.isActive('orderedList'))}
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-[#e8e4df] dark:bg-[#3a3f4b] mx-1" />

        {/* Quote */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBlockquote().run();
          }}
          className={buttonClass(editor.isActive('blockquote'))}
          title="Blockquote"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      </div>
      {/* Editor content - truly inline, no box */}
      <EditorContent editor={editor} />
    </div>
  );
}

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
      {/* Header - transparent style matching EventEditor */}
      <div className="sticky top-0 z-10 border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6]/80 dark:bg-[#0d0f14]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
              {formData.title || 'New Article'}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-4">
            {/* Settings Button - Mobile only */}
            {!isDesktop && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                title="Article Settings"
              >
                <Settings2 className="w-5 h-5" />
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Left Column - Main Content */}
            <div className="flex-1 space-y-6">

              {/* Hero Section - Cover Image + Title + Content */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
                {/* Cover Image */}
                <div className="relative aspect-[16/7] group">
                  {formData.coverImageUrl ? (
                    <>
                      <Image
                        src={formData.coverImageUrl}
                        alt={formData.title || 'Article cover'}
                        fill
                        className="object-cover"
                      />
                      {/* Subtle gradient overlay for better button visibility */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#f9f8f7] dark:bg-[#1a1e25] border-b border-[#e8e4df] dark:border-[#262b35]">
                      <div className="w-12 h-12 rounded-xl bg-[#f0eeeb] dark:bg-[#262b35] flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6470]" />
                      </div>
                      <span className="text-sm text-[#a7a39e] dark:text-[#5f6470]">Add a cover image</span>
                    </div>
                  )}

                  {/* Top-right action buttons */}
                  <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          // Create form data and upload
                          const uploadFormData = new FormData();
                          uploadFormData.append('file', file);
                          uploadFormData.append('folder', 'articles');

                          try {
                            const response = await fetch(uploadEndpoint, {
                              method: 'POST',
                              body: uploadFormData,
                            });
                            const data = await response.json();
                            if (data.url) {
                              setFormData(prev => ({ ...prev, coverImageUrl: data.url }));
                            }
                          } catch (error) {
                            console.error('Upload failed:', error);
                          }
                        }}
                      />
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/90 dark:bg-[#1e222a]/90 text-[#1a1a1a] dark:text-[#f5f5f8] backdrop-blur-sm shadow-sm hover:bg-white dark:hover:bg-[#1e222a] transition-colors cursor-pointer">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {formData.coverImageUrl ? 'Change' : 'Upload'}
                      </span>
                    </label>
                    {formData.coverImageUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, coverImageUrl: '' }))}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/90 dark:bg-[#1e222a]/90 text-[#5f5a55] dark:text-[#b2b6c2] backdrop-blur-sm shadow-sm hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Badges - bottom left */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    {formData.featured && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100/90 text-amber-700 backdrop-blur-sm">
                        Featured
                      </span>
                    )}
                    {formData.trending && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100/90 text-blue-700 backdrop-blur-sm">
                        Trending
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Content - Inline Editable */}
                <div className="p-6">
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Article title..."
                    className="w-full text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert bg-transparent border-0 outline-none placeholder:text-[#a7a39e] dark:placeholder:text-[#5f6470] focus:ring-0"
                  />
                  <div className="mt-4">
                    <InlineContentEditor
                      value={formData.content}
                      onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                      placeholder="Write your article..."
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Section - Below content on desktop */}
              {isDesktop && (
                <ContentPricingFields
                  value={pricingData}
                  onChange={handlePricingChange}
                />
              )}
            </div>

            {/* Right Sidebar - Desktop only */}
            {isDesktop && (
              <div className="lg:w-[340px] xl:w-80 space-y-4 flex-shrink-0">

                {/* Author Section */}
                <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Author</h3>
                  <AuthorSelector
                    value={formData.authorId}
                    onChange={({ authorId, authorName }) =>
                      setFormData(prev => ({ ...prev, authorId, authorName }))
                    }
                    placeholder="Select author..."
                    coachesApiEndpoint={coachesApiEndpoint}
                  />
                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">
                      Author Title <span className="text-[#8c8a87] dark:text-[#8b8f9a]">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.authorTitle}
                      onChange={e => setFormData(prev => ({ ...prev, authorTitle: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors text-sm"
                      placeholder="e.g., Life Coach, CEO"
                    />
                  </div>
                </div>

                {/* Organization Section */}
                <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Organization</h3>

                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Category</label>
                    <CategorySelector
                      value={formData.category}
                      onChange={(category) => setFormData(prev => ({ ...prev, category }))}
                      placeholder="Select or create..."
                      categoriesApiEndpoint={categoriesApiEndpoint}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Programs</label>
                    <ProgramSelector
                      value={formData.programIds}
                      onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
                      placeholder="Select programs..."
                      programsApiEndpoint={programsApiEndpoint}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Published Date</label>
                    <DatePicker
                      value={formData.publishedAt}
                      onChange={(date) => setFormData(prev => ({ ...prev, publishedAt: date }))}
                      placeholder="Select date"
                    />
                  </div>
                </div>

                {/* Display Options Section */}
                <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-5">
                  <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">Display Options</h3>
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
            )}

          </div>
        </div>
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
