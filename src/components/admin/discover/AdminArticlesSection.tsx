'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { DiscoverArticle } from '@/types/discover';
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
import { FileText, Star, TrendingUp, MoreVertical, Search, X, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [filtersWidth, setFiltersWidth] = useState(200);
  const filtersRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  // Measure filters width for animated search expansion
  useEffect(() => {
    if (filtersRef.current && !isSearchExpanded) {
      setFiltersWidth(filtersRef.current.offsetWidth);
    }
  }, [categories, isSearchExpanded]);

  const handleSearchExpand = useCallback(() => {
    setIsSearchExpanded(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSearchCollapse = useCallback(() => {
    setIsSearchExpanded(false);
    setSearchQuery('');
  }, []);

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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
              <div className="w-24 h-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-4 w-1/2 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
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
        <div className="p-4 sm:p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
          <div className="flex items-center justify-between gap-3">
            {/* Title with inline count */}
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Articles ({filteredArticles.length})
            </h2>

            <div className="flex items-center gap-2 ml-auto relative">
              {/* Animated search input - expands over filters */}
              <div
                className={cn(
                  "flex items-center overflow-hidden transition-all duration-300 ease-out",
                  isSearchExpanded ? "opacity-100" : "w-0 opacity-0"
                )}
                style={{ width: isSearchExpanded ? `${Math.max(filtersWidth, 200)}px` : 0 }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9ca3af] focus:outline-none focus:ring-0 font-albert"
                />
              </div>

              {/* Filters container - hidden when search expanded */}
              <div
                ref={filtersRef}
                className={cn(
                  "flex items-center gap-2 transition-all duration-300 ease-out",
                  isSearchExpanded && "opacity-0 pointer-events-none absolute right-16 w-0 overflow-hidden"
                )}
              >
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
              </div>

              {/* Search toggle button */}
              <button
                onClick={isSearchExpanded ? handleSearchCollapse : handleSearchExpand}
                className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              >
                {isSearchExpanded ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>

              {/* Plus button - always visible */}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline text-[15px] font-medium">New Article</span>
              </button>
            </div>
          </div>
        </div>

        {/* Articles List */}
        <div className="divide-y divide-[#e1ddd8]/50 dark:divide-[#262b35]/50">
          {filteredArticles.map(article => (
            <div
              key={article.id}
              onClick={() => setEditingArticle(article)}
              className="flex items-center gap-4 p-4 bg-white dark:bg-[#171b22] hover:bg-[#faf8f6] dark:hover:bg-[#1c2028] cursor-pointer transition-all group"
            >
              {/* Cover Image */}
              <div className="relative w-24 h-16 sm:w-28 sm:h-[4.5rem] rounded-lg overflow-hidden bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                {article.coverImageUrl ? (
                  <Image
                    src={article.coverImageUrl}
                    alt={article.title}
                    fill
                    className="object-cover"
                    sizes="112px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6470]" />
                  </div>
                )}
              </div>

              {/* Article Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate group-hover:text-brand-accent transition-colors">
                  {article.title}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  <span>{article.authorName}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{formatDate(article.publishedAt)}</span>
                  {article.category && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline">{article.category}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                {article.featured && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 font-albert">
                    <Star className="w-3 h-3" />
                    Featured
                  </span>
                )}
                {article.trending && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 font-albert">
                    <TrendingUp className="w-3 h-3" />
                    Trending
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                {/* Desktop: Show edit and delete icons directly */}
                <div className="hidden sm:flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingArticle(article)}
                    className="h-8 w-8 p-0 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setArticleToDelete(article)}
                    className="h-8 w-8 p-0 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-red-600 dark:hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {/* Mobile: Show vertical dots menu */}
                <div className="sm:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setEditingArticle(article)}
                        className="font-albert"
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setArticleToDelete(article)}
                        className="text-red-600 font-albert"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredArticles.length === 0 && (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-[#d1ccc6] dark:text-[#3d4350] mb-3" />
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No articles found</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 text-brand-accent hover:text-brand-accent/90 font-albert font-medium text-sm"
            >
              Create your first article
            </button>
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
