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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateArticleModal } from './CreateArticleModal';
import { ArticleEditor } from './ArticleEditor';

interface AdminArticlesSectionProps {
  apiEndpoint?: string;
}

export function AdminArticlesSection({ apiEndpoint = '/api/admin/discover/articles' }: AdminArticlesSectionProps) {
  const [articles, setArticles] = useState<DiscoverArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [articleToDelete, setArticleToDelete] = useState<DiscoverArticle | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Modal/Editor states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<DiscoverArticle | null>(null);

  // Derive endpoints from API endpoint
  const isCoachContext = apiEndpoint.includes('/coach/');
  const uploadEndpoint = isCoachContext
    ? '/api/coach/org-upload-media'
    : '/api/admin/upload-media';
  const programsApiEndpoint = isCoachContext ? '/api/coach/org-programs' : '/api/admin/programs';
  const coachesApiEndpoint = '/api/coach/org-coaches';
  const categoriesApiEndpoint = '/api/coach/org-article-categories';

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
    const cats = new Set(articles.map(a => a.category).filter((c): c is string => Boolean(c)));
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

  const handleArticleCreated = async (articleId: string) => {
    // Fetch the newly created article and open it in the editor
    try {
      const response = await fetch(`${apiEndpoint}/${articleId}`);
      if (response.ok) {
        const data = await response.json();
        setEditingArticle(data.article || data);
      }
    } catch (err) {
      console.error('Error fetching created article:', err);
      // Refresh list and don't open editor
      await fetchArticles();
    }
  };

  const handleEditorClose = () => {
    setEditingArticle(null);
    fetchArticles();
  };

  const handleEditorSave = () => {
    // fetchArticles will be called when editor closes
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

  // If editing an article, show full-page editor
  if (editingArticle) {
    return (
      <ArticleEditor
        article={editingArticle}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
        uploadEndpoint={uploadEndpoint}
        programsApiEndpoint={programsApiEndpoint}
        apiEndpoint={apiEndpoint}
        coachesApiEndpoint={coachesApiEndpoint}
        categoriesApiEndpoint={categoriesApiEndpoint}
      />
    );
  }

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
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
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
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Articles</h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex items-center gap-3 ml-auto">
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
                <Select
                  value={categoryFilter || 'all'}
                  onValueChange={(value) => setCategoryFilter(value === 'all' ? '' : value)}
                >
                  <SelectTrigger className="h-auto px-3 py-1.5 w-auto bg-transparent border-0 shadow-none text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] focus:ring-0 ring-offset-0 font-albert text-sm gap-1.5 !justify-start">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white rounded-lg font-albert font-medium text-[15px] transition-colors duration-200 whitespace-nowrap"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        onClick={() => setEditingArticle(article)}
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
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No articles found</p>
          </div>
        )}
      </div>

      {/* Create Article Modal (Wizard) */}
      <CreateArticleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onArticleCreated={handleArticleCreated}
        apiEndpoint={apiEndpoint}
        programsApiEndpoint={programsApiEndpoint}
        uploadEndpoint={uploadEndpoint}
        coachesApiEndpoint={coachesApiEndpoint}
        categoriesApiEndpoint={categoriesApiEndpoint}
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
