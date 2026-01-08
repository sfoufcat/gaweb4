'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { ContentPricingFields, getDefaultPricingData, type ContentPricingData } from '@/components/admin/ContentPricingFields';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ProgramLink {
  id: string;
  title: string;
  description?: string;
  url: string;
  programId?: string;
  programIds?: string[];
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Link Form Dialog
function LinkFormDialog({
  link,
  isOpen,
  onClose,
  onSave,
  apiEndpoint,
  programsApiEndpoint,
}: {
  link: ProgramLink | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  apiEndpoint: string;
  programsApiEndpoint: string;
}) {
  const isEditing = !!link;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    programIds: [] as string[],
    order: 0,
    pricing: getDefaultPricingData() as ContentPricingData,
  });

  useEffect(() => {
    if (link) {
      // Cast to any to access potential pricing fields
      const linkData = link as ProgramLink & { priceInCents?: number; currency?: string; purchaseType?: string; isPublic?: boolean };
      setFormData({
        title: link.title || '',
        description: link.description || '',
        url: link.url || '',
        programIds: link.programIds || (link.programId ? [link.programId] : []),
        order: link.order || 0,
        pricing: {
          priceInCents: linkData.priceInCents ?? null,
          currency: linkData.currency || 'USD',
          purchaseType: (linkData.purchaseType as 'popup' | 'landing_page') || 'popup',
          isPublic: linkData.isPublic !== false,
        },
      });
    } else {
      setFormData({
        title: '',
        description: '',
        url: '',
        programIds: [],
        order: 0,
        pricing: getDefaultPricingData(),
      });
    }
  }, [link, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const apiUrl = isEditing 
        ? `${apiEndpoint}/${link.id}`
        : apiEndpoint;
      
      // Flatten pricing into payload
      const payload = {
        ...formData,
        priceInCents: formData.pricing.priceInCents,
        currency: formData.pricing.currency,
        purchaseType: formData.pricing.purchaseType,
        isPublic: formData.pricing.isPublic,
      };
      delete (payload as Record<string, unknown>).pricing;

      const response = await fetch(apiUrl, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save link');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving link:', err);
      alert(err instanceof Error ? err.message : 'Failed to save link');
    } finally {
      setSaving(false);
    }
  };

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const content = (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
        <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {isEditing ? 'Edit Link' : 'Create Link'}
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
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
            placeholder="e.g., Program Community"
          />
        </div>

        {/* URL */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">URL *</label>
          <input
            type="url"
            required
            value={formData.url}
            onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
            placeholder="https://..."
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Description</label>
          <textarea
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
            placeholder="Brief description of the link..."
          />
        </div>

        {/* Programs */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
            Programs
          </label>
          <ProgramSelector
            value={formData.programIds}
            onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
            placeholder="Select programs for this link..."
            programsApiEndpoint={programsApiEndpoint}
          />
        </div>

        {/* Pricing & Access */}
        <ContentPricingFields
          value={formData.pricing}
          onChange={(pricing) => setFormData(prev => ({ ...prev, pricing }))}
        />

        {/* Order */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Display Order</label>
          <input
            type="number"
            value={formData.order}
            onChange={e => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
          />
          <p className="mt-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Lower numbers appear first.
          </p>
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
          disabled={saving}
          className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
        >
          {saving ? 'Saving...' : isEditing ? 'Update Link' : 'Create Link'}
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

interface AdminLinksSectionProps {
  apiEndpoint?: string;
}

export function AdminLinksSection({ apiEndpoint = '/api/admin/discover/links' }: AdminLinksSectionProps) {
  const [links, setLinks] = useState<ProgramLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkToEdit, setLinkToEdit] = useState<ProgramLink | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<ProgramLink | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derive programs endpoint from API endpoint - use coach endpoint for coach routes
  const isCoachContext = apiEndpoint.includes('/coach/');
  const programsApiEndpoint = isCoachContext 
    ? '/api/coach/org-programs' 
    : '/api/admin/programs';

  const fetchLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch links');
      }
      const data = await response.json();
      setLinks(data.links || []);
    } catch (err) {
      console.error('Error fetching links:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return links;
    
    const query = searchQuery.toLowerCase();
    return links.filter(link =>
      link.title.toLowerCase().includes(query) ||
      link.url.toLowerCase().includes(query)
    );
  }, [links, searchQuery]);

  const handleDelete = async () => {
    if (!linkToDelete) return;
    
    try {
      setDeleteLoading(true);
      const response = await fetch(`${apiEndpoint}/${linkToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete link');
      }
      
      await fetchLinks();
      setLinkToDelete(null);
    } catch (err) {
      console.error('Error deleting link:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete link');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          <div className="h-10 w-28 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
              <div className="w-10 h-10 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-3 w-64 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
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
        <div className="text-center text-red-600">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button onClick={fetchLinks} className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white">
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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Links</h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                {filteredLinks.length} link{filteredLinks.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search links..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-48 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#7d8190]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <Button
                onClick={() => { setLinkToEdit(null); setIsFormOpen(true); }}
                className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
              >
                + Create Link
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
                <TableHead className="font-albert">URL</TableHead>
                <TableHead className="font-albert">Order</TableHead>
                <TableHead className="font-albert text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLinks.map(link => (
                <TableRow key={link.id}>
                  <TableCell className="font-albert font-medium max-w-[200px] truncate">
                    {link.title}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] max-w-[300px] truncate">
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-brand-accent hover:underline"
                    >
                      {link.url}
                    </a>
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {link.order || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setLinkToEdit(link); setIsFormOpen(true); }}
                        className="text-brand-accent hover:text-brand-accent/90 hover:bg-brand-accent/10 font-albert"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLinkToDelete(link)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 font-albert"
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

        {filteredLinks.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No links found</p>
          </div>
        )}
      </div>

      {/* Link Form Dialog */}
      <LinkFormDialog
        link={linkToEdit}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setLinkToEdit(null); }}
        onSave={fetchLinks}
        apiEndpoint={apiEndpoint}
        programsApiEndpoint={programsApiEndpoint}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!linkToDelete} onOpenChange={open => !open && setLinkToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Delete Link</AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              Are you sure you want to delete &quot;<strong>{linkToDelete?.title}</strong>&quot;? This action cannot be undone.
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

