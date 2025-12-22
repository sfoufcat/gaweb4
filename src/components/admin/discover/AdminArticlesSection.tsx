'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DiscoverArticle } from '@/types/discover';
import type { UserTrack } from '@/types';
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
import { Button } from '@/components/ui/button';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { ProgramSelector } from '@/components/admin/ProgramSelector';

// Track options for dropdown
const TRACK_OPTIONS: { value: UserTrack | ''; label: string }[] = [
  { value: '', label: 'All Tracks (No specific track)' },
  { value: 'content_creator', label: 'Creator' },
  { value: 'saas', label: 'SaaS' },
  { value: 'coach_consultant', label: 'Coach/Consultant' },
  { value: 'ecom', label: 'Ecom' },
  { value: 'agency', label: 'Agency' },
  { value: 'community_builder', label: 'Community Builder' },
  { value: 'general', label: 'General' },
];

// Helper to get track display name
const getTrackDisplayName = (track: UserTrack | null | undefined): string => {
  if (!track) return '—';
  const option = TRACK_OPTIONS.find(t => t.value === track);
  return option?.label || track;
};

// Article Form Dialog
function ArticleFormDialog({
  article,
  isOpen,
  onClose,
  onSave,
  uploadEndpoint,
}: {
  article: DiscoverArticle | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  uploadEndpoint: string;
}) {
  const isEditing = !!article;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    coverImageUrl: '',
    content: '',
    authorName: '',
    authorTitle: '',
    authorAvatarUrl: '',
    authorBio: '',
    publishedAt: '',
    category: '',
    articleType: 'playbook' as 'playbook' | 'trend' | 'caseStudy',
    track: '' as UserTrack | '',
    programIds: [] as string[],
    featured: false,
    trending: false,
  });

  useEffect(() => {
    if (article) {
      setFormData({
        title: article.title || '',
        coverImageUrl: article.coverImageUrl || '',
        content: article.content || '',
        authorName: article.authorName || '',
        authorTitle: article.authorTitle || '',
        authorAvatarUrl: article.authorAvatarUrl || '',
        authorBio: article.authorBio || '',
        publishedAt: article.publishedAt ? article.publishedAt.split('T')[0] : '',
        category: article.category || '',
        articleType: article.articleType || 'playbook',
        track: article.track || '',
        programIds: article.programIds || [],
        featured: article.featured || false,
        trending: article.trending || false,
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        title: '',
        coverImageUrl: '',
        content: '',
        authorName: '',
        authorTitle: '',
        authorAvatarUrl: '',
        authorBio: '',
        publishedAt: today,
        category: '',
        articleType: 'playbook',
        track: '',
        programIds: [],
        featured: false,
        trending: false,
      });
    }
  }, [article, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        publishedAt: formData.publishedAt ? new Date(formData.publishedAt).toISOString() : new Date().toISOString(),
        track: formData.track || null, // Convert empty string to null (deprecated)
        programIds: formData.programIds, // New program association
      };

      const url = isEditing 
        ? `/api/admin/discover/articles/${article.id}`
        : '/api/admin/discover/articles';
      
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white dark:bg-[#171b22] rounded-2xl w-full max-w-2xl mx-4 shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35]">
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">
              {isEditing ? 'Edit Article' : 'Create Article'}
            </h2>
          </div>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
              />
            </div>

            {/* Cover Image */}
            <MediaUpload
              value={formData.coverImageUrl}
              onChange={(url) => setFormData(prev => ({ ...prev, coverImageUrl: url }))}
              folder="articles"
              type="image"
              label="Cover Image"
              required
              uploadEndpoint={uploadEndpoint}
            />

            {/* Author Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Author Name *</label>
                <input
                  type="text"
                  required
                  value={formData.authorName}
                  onChange={e => setFormData(prev => ({ ...prev, authorName: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Author Title *</label>
                <input
                  type="text"
                  required
                  value={formData.authorTitle}
                  onChange={e => setFormData(prev => ({ ...prev, authorTitle: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                  placeholder="e.g., Life Coach, CEO"
                />
              </div>
            </div>

            {/* Author Avatar & Bio */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Author Avatar URL</label>
              <input
                type="url"
                value={formData.authorAvatarUrl}
                onChange={e => setFormData(prev => ({ ...prev, authorAvatarUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Author Bio</label>
              <textarea
                value={formData.authorBio}
                onChange={e => setFormData(prev => ({ ...prev, authorBio: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert resize-none text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                placeholder="Brief bio about the author..."
              />
            </div>

            {/* Published Date & Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Published Date</label>
                <input
                  type="date"
                  value={formData.publishedAt}
                  onChange={e => setFormData(prev => ({ ...prev, publishedAt: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                  placeholder="e.g., Mindset, Productivity"
                />
              </div>
            </div>

            {/* Article Type & Track */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Article Type *</label>
                <select
                  required
                  value={formData.articleType}
                  onChange={e => setFormData(prev => ({ ...prev, articleType: e.target.value as 'playbook' | 'trend' | 'caseStudy' }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                >
                  <option value="playbook">Playbook</option>
                  <option value="trend">Trend</option>
                  <option value="caseStudy">Case Study</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Track</label>
                <select
                  value={formData.track}
                  onChange={e => setFormData(prev => ({ ...prev, track: e.target.value as UserTrack | '' }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                >
                  {TRACK_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190] font-albert">Track is deprecated. Use Programs below for content targeting.</p>

            {/* Program Association */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                Programs
              </label>
              <ProgramSelector
                value={formData.programIds}
                onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
                placeholder="Select programs for this article..."
              />
            </div>

            {/* Content with Rich Text Editor */}
            <RichTextEditor
              value={formData.content}
              onChange={(content) => setFormData(prev => ({ ...prev, content }))}
              label="Content"
              required
              rows={12}
              placeholder="Write your article content here..."
              showMediaToolbar={true}
              mediaFolder="articles"
              uploadEndpoint={uploadEndpoint}
            />

            {/* Featured & Trending */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={e => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                  className="w-4 h-4 text-[#a07855] border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] rounded focus:ring-[#a07855] dark:focus:ring-[#b8896a]"
                />
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Featured (Recommended)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.trending}
                  onChange={e => setFormData(prev => ({ ...prev, trending: e.target.checked }))}
                  className="w-4 h-4 text-[#a07855] border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] rounded focus:ring-[#a07855] dark:focus:ring-[#b8896a]"
                />
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Trending</span>
              </label>
            </div>
          </div>

          <div className="p-6 border-t border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] flex justify-end gap-3">
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
              disabled={saving}
              className="bg-[#a07855] hover:bg-[#8c6245] text-white font-albert"
            >
              {saving ? 'Saving...' : isEditing ? 'Update Article' : 'Create Article'}
            </Button>
          </div>
        </form>
      </div>
    </div>
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
  const [trackFilter, setTrackFilter] = useState('');
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
    
    if (trackFilter) {
      if (trackFilter === 'none') {
        filtered = filtered.filter(article => !article.track);
      } else {
        filtered = filtered.filter(article => article.track === trackFilter);
      }
    }
    
    return filtered;
  }, [articles, searchQuery, categoryFilter, trackFilter]);

  const handleDelete = async () => {
    if (!articleToDelete) return;
    
    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/admin/discover/articles/${articleToDelete.id}`, {
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
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert">Loading articles...</p>
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
          <Button onClick={fetchArticles} className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white">
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
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-48 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190]"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Category Filter */}
              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}
              
              {/* Track Filter */}
              <select
                value={trackFilter}
                onChange={e => setTrackFilter(e.target.value)}
                className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
              >
                <option value="">All Tracks</option>
                <option value="none">No Track</option>
                {TRACK_OPTIONS.filter(t => t.value).map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              
              <Button
                onClick={() => { setArticleToEdit(null); setIsFormOpen(true); }}
                className="bg-[#a07855] hover:bg-[#8c6245] text-white font-albert"
              >
                + Create Article
              </Button>
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
                <TableHead className="font-albert">Type</TableHead>
                <TableHead className="font-albert">Track</TableHead>
                <TableHead className="font-albert">Featured</TableHead>
                <TableHead className="font-albert">Trending</TableHead>
                <TableHead className="font-albert text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredArticles.map(article => (
                <TableRow key={article.id}>
                  <TableCell className="font-albert font-medium max-w-[200px] truncate text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]">
                    {article.title}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {article.authorName}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {formatDate(article.publishedAt)}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {article.category || '—'}
                  </TableCell>
                  <TableCell>
                    {article.articleType ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-albert ${
                        article.articleType === 'playbook' ? 'bg-emerald-100 text-emerald-700' :
                        article.articleType === 'trend' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {article.articleType === 'caseStudy' ? 'Case Study' : 
                         article.articleType.charAt(0).toUpperCase() + article.articleType.slice(1)}
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190] text-sm font-albert">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {article.track ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 font-albert">
                        {getTrackDisplayName(article.track)}
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190] text-sm font-albert">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {article.featured ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 font-albert">
                        Yes
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190] text-sm font-albert">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {article.trending ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 font-albert">
                        Yes
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190] text-sm font-albert">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setArticleToEdit(article); setIsFormOpen(true); }}
                        className="text-[#a07855] hover:text-[#8c6245] hover:bg-[#a07855]/10 font-albert"
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

