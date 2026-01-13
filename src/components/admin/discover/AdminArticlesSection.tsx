'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DiscoverArticle } from '@/types/discover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { AuthorSelector } from '@/components/admin/AuthorSelector';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { ContentPricingFields, getDefaultPricingData, type ContentPricingData } from '@/components/admin/ContentPricingFields';
import { useMediaQuery } from '@/hooks/useMediaQuery';

// Article Form Dialog
function ArticleFormDialog({
  article,
  isOpen,
  onClose,
  onSave,
  uploadEndpoint,
  apiEndpoint,
}: {
  article: DiscoverArticle | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  uploadEndpoint: string;
  apiEndpoint: string;
}) {
  const isEditing = !!article;
  const [saving, setSaving] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(false);
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
    pricing: getDefaultPricingData() as ContentPricingData,
  });

  // Determine if we're in coach context based on API endpoint
  const isCoachContext = apiEndpoint.includes('/coach/');
  const programsApiEndpoint = isCoachContext ? '/api/coach/org-programs' : '/api/admin/programs';
  const categoriesApiEndpoint = '/api/coach/org-article-categories';
  const coachesApiEndpoint = '/api/coach/org-coaches';

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
        pricing: {
          priceInCents: article.priceInCents ?? null,
          currency: article.currency || 'USD',
          purchaseType: article.purchaseType || 'popup',
          isPublic: article.isPublic !== false, // Default to true
        },
      });
      // Show thumbnail section if article already has a thumbnail
      setShowThumbnail(!!article.thumbnailUrl);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        title: '',
        content: '',
        coverImageUrl: '',
        thumbnailUrl: '',
        authorId: null,
        authorName: '',
        authorTitle: '',
        publishedAt: today,
        category: '',
        programIds: [],
        featured: false,
        trending: false,
        pricing: getDefaultPricingData(),
      });
      setShowThumbnail(false);
    }
  }, [article, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.content.trim()) {
      alert('Content is required');
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
        // Flatten pricing fields
        priceInCents: formData.pricing.priceInCents,
        currency: formData.pricing.currency,
        purchaseType: formData.pricing.purchaseType,
        isPublic: formData.pricing.isPublic,
      };
      // Remove the nested pricing object from payload
      delete (payload as Record<string, unknown>).pricing;

      const url = isEditing 
        ? `${apiEndpoint}/${article.id}`
        : apiEndpoint;
      
      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
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

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const content = (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
        <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {isEditing ? 'Edit Article' : 'Create Article'}
        </h2>
      </div>

      <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Title *</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent dark:focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
          />
        </div>

        {/* Content - Moved right after Title */}
        <RichTextEditor
          value={formData.content}
          onChange={(content) => setFormData(prev => ({ ...prev, content }))}
          label="Content *"
          required
          rows={12}
          placeholder="Write your article content here..."
          showMediaToolbar={true}
          mediaFolder="articles"
          uploadEndpoint={uploadEndpoint}
        />

        {/* Cover Image */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
            Cover Image <span className="text-text-muted text-xs font-normal">(1600 x 800px)</span> *
          </label>
          <MediaUpload
            value={formData.coverImageUrl}
            onChange={(url) => setFormData(prev => ({ ...prev, coverImageUrl: url }))}
            folder="articles"
            type="image"
            required
            uploadEndpoint={uploadEndpoint}
            hideLabel
            previewSize="thumbnail"
          />
        </div>

        {/* Thumbnail - Collapsible */}
        {!showThumbnail ? (
          <button
            type="button"
            onClick={() => setShowThumbnail(true)}
            className="flex items-center gap-2 text-sm text-brand-accent hover:text-brand-accent/90 font-albert font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Thumbnail
          </button>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Thumbnail <span className="text-text-muted text-xs font-normal">(1200 x 675px)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowThumbnail(false);
                  setFormData(prev => ({ ...prev, thumbnailUrl: '' }));
                }}
                className="text-xs text-[#5f5a55] hover:text-red-500 font-albert transition-colors"
              >
                Remove
              </button>
            </div>
            <MediaUpload
              value={formData.thumbnailUrl}
              onChange={(url) => setFormData(prev => ({ ...prev, thumbnailUrl: url }))}
              folder="articles"
              type="image"
              uploadEndpoint={uploadEndpoint}
              hideLabel
              previewSize="thumbnail"
            />
          </div>
        )}

        {/* Author Selection */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Author *</label>
          <AuthorSelector
            value={formData.authorId}
            onChange={({ authorId, authorName }) =>
              setFormData(prev => ({ ...prev, authorId, authorName }))
            }
            placeholder="Select author..."
            coachesApiEndpoint={coachesApiEndpoint}
          />
        </div>

        {/* Author Title - Now Optional */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Author Title</label>
          <input
            type="text"
            value={formData.authorTitle}
            onChange={e => setFormData(prev => ({ ...prev, authorTitle: e.target.value }))}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent dark:focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
            placeholder="e.g., Life Coach, CEO (optional)"
          />
        </div>

        {/* Published Date */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Published Date</label>
          <input
            type="date"
            value={formData.publishedAt}
            onChange={e => setFormData(prev => ({ ...prev, publishedAt: e.target.value }))}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent dark:focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
          />
        </div>

        {/* Category - New CategorySelector */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Category</label>
          <CategorySelector
            value={formData.category}
            onChange={(category) => setFormData(prev => ({ ...prev, category }))}
            placeholder="Select or create category..."
            categoriesApiEndpoint={categoriesApiEndpoint}
          />
        </div>

        {/* Program Association */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
            Programs
          </label>
          <ProgramSelector
            value={formData.programIds}
            onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
            placeholder="Select programs for this article..."
            programsApiEndpoint={programsApiEndpoint}
          />
        </div>

        {/* Pricing & Access */}
        <ContentPricingFields
          value={formData.pricing}
          onChange={(pricing) => setFormData(prev => ({ ...prev, pricing }))}
        />

        {/* Featured & Trending - Removed "Recommended" from Featured */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <BrandedCheckbox
              checked={formData.featured}
              onChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
            />
            <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, featured: !prev.featured }))}>Featured</span>
          </div>
          <div className="flex items-center gap-2">
            <BrandedCheckbox
              checked={formData.trending}
              onChange={(checked) => setFormData(prev => ({ ...prev, trending: checked }))}
            />
            <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, trending: !prev.trending }))}>Trending</span>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-[#e1ddd8] dark:border-[#262b35] flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={saving}
          className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5 font-albert"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || !formData.title.trim() || !formData.content.trim() || !formData.coverImageUrl.trim()}
          className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
        >
          {saving ? 'Saving...' : isEditing ? 'Update Article' : 'Create Article'}
        </Button>
      </div>
    </form>
  );

  // Desktop: Use Dialog (centered modal)
  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl p-0" hideCloseButton>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Use Drawer (slide-up)
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[85dvh]">
        {content}
      </DrawerContent>
    </Drawer>
  );
}

interface AdminArticlesSectionProps {
  apiEndpoint?: string;
}

export function AdminArticlesSection({ apiEndpoint = '/api/admin/discover/articles' }: AdminArticlesSectionProps) {
  const [articles, setArticles] = useState<DiscoverArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [articleToEdit, setArticleToEdit] = useState<DiscoverArticle | null>(null);
  const [articleToDelete, setArticleToDelete] = useState<DiscoverArticle | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derive upload endpoint from API endpoint - use coach upload for coach routes
  const uploadEndpoint = apiEndpoint.includes('/coach/') 
    ? '/api/coach/org-upload-media' 
    : '/api/admin/upload-media';

  const fetchArticles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch articles');
      }
      const data = await response.json();
      setArticles(data.articles || []);
    } catch (err) {
      console.error('Error fetching articles:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(articles.map(a => a.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [articles]);

  const filteredArticles = useMemo(() => {
    let filtered = articles;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.authorName.toLowerCase().includes(query)
      );
    }
    
    if (categoryFilter) {
      filtered = filtered.filter(article => article.category === categoryFilter);
    }
    
    return filtered;
  }, [articles, searchQuery, categoryFilter]);

  const handleDelete = async () => {
    if (!articleToDelete) return;
    
    try {
      setDeleteLoading(true);
      // Use dynamic apiEndpoint instead of hardcoded admin route
      const response = await fetch(`${apiEndpoint}/${articleToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete article');
      }
      
      await fetchArticles();
      setArticleToDelete(null);
    } catch (err) {
      console.error('Error deleting article:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete article');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          <div className="h-10 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#faf8f6] dark:bg-[#11141b] rounded-xl overflow-hidden">
              <div className="h-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="p-4 space-y-2">
                <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-4 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button onClick={fetchArticles} className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Articles</h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mt-1">
                {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-48 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border border-transparent focus:border-[#e1ddd8] dark:focus:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9ca3af] focus:outline-none font-albert"
                />
              </div>
              
              {/* Category Filter */}
              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="appearance-none bg-transparent pr-6 py-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] focus:outline-none font-albert text-sm cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%235f5a55'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0 center', backgroundSize: '16px' }}
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}
              
              <button
                onClick={() => { setArticleToEdit(null); setIsFormOpen(true); }}
                className="flex items-center gap-2 px-2.5 py-1.5 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white rounded-lg font-albert font-medium text-[15px] transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Article
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-albert">Title</TableHead>
                <TableHead className="font-albert">Author</TableHead>
                <TableHead className="font-albert">Published</TableHead>
                <TableHead className="font-albert">Category</TableHead>
                <TableHead className="font-albert">Featured</TableHead>
                <TableHead className="font-albert">Trending</TableHead>
                <TableHead className="font-albert text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredArticles.map(article => (
                <TableRow key={article.id}>
                  <TableCell className="font-albert font-medium max-w-[200px] truncate text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {article.title}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {article.authorName}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {formatDate(article.publishedAt)}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {article.category || '—'}
                  </TableCell>
                  <TableCell>
                    {article.featured ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 font-albert">
                        Yes
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-albert">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {article.trending ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 font-albert">
                        Yes
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-albert">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setArticleToEdit(article); setIsFormOpen(true); }}
                        className="text-brand-accent hover:text-brand-accent/90 hover:bg-brand-accent/10 font-albert"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setArticleToDelete(article)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 font-albert"
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredArticles.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert">No articles found</p>
          </div>
        )}
      </div>

      {/* Article Form Dialog */}
      <ArticleFormDialog
        article={articleToEdit}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setArticleToEdit(null); }}
        onSave={fetchArticles}
        uploadEndpoint={uploadEndpoint}
        apiEndpoint={apiEndpoint}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!articleToDelete} onOpenChange={open => !open && setArticleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Delete Article</AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              Are you sure you want to delete &quot;<strong>{articleToDelete?.title}</strong>&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} className="font-albert">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 font-albert"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

