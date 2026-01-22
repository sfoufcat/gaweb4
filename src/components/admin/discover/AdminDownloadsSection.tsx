'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
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
import { MediaUpload } from '@/components/admin/MediaUpload';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { ContentPricingFields, getDefaultPricingData, type ContentPricingData } from '@/components/admin/ContentPricingFields';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Search, X, Plus } from 'lucide-react';

interface ProgramDownload {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: string;
  programId?: string;
  programIds?: string[];
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Download Form Dialog
function DownloadFormDialog({
  download,
  isOpen,
  onClose,
  onSave,
  uploadEndpoint,
  apiEndpoint,
  programsApiEndpoint,
}: {
  download: ProgramDownload | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  uploadEndpoint: string;
  apiEndpoint: string;
  programsApiEndpoint: string;
}) {
  const isEditing = !!download;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    fileUrl: '',
    fileType: '',
    programIds: [] as string[],
    order: 0,
    pricing: getDefaultPricingData() as ContentPricingData,
  });

  useEffect(() => {
    if (download) {
      // Cast to any to access potential pricing fields
      const downloadData = download as ProgramDownload & { priceInCents?: number; currency?: string; purchaseType?: string; isPublic?: boolean };
      setFormData({
        title: download.title || '',
        description: download.description || '',
        fileUrl: download.fileUrl || '',
        fileType: download.fileType || '',
        programIds: download.programIds || (download.programId ? [download.programId] : []),
        order: download.order || 0,
        pricing: {
          priceInCents: downloadData.priceInCents ?? null,
          currency: downloadData.currency || 'USD',
          purchaseType: (downloadData.purchaseType as 'popup' | 'landing_page') || 'popup',
          isPublic: downloadData.isPublic !== false,
        },
      });
    } else {
      setFormData({
        title: '',
        description: '',
        fileUrl: '',
        fileType: '',
        programIds: [],
        order: 0,
        pricing: getDefaultPricingData(),
      });
    }
  }, [download, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = isEditing 
        ? `${apiEndpoint}/${download.id}`
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

      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save download');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving download:', err);
      alert(err instanceof Error ? err.message : 'Failed to save download');
    } finally {
      setSaving(false);
    }
  };

  // Auto-detect file type from URL
  const detectFileType = (url: string): string => {
    if (!url) return '';
    const extension = url.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      'pdf': 'PDF',
      'doc': 'Word',
      'docx': 'Word',
      'xls': 'Excel',
      'xlsx': 'Excel',
      'ppt': 'PowerPoint',
      'pptx': 'PowerPoint',
      'zip': 'ZIP',
      'mp4': 'Video',
      'mp3': 'Audio',
      'png': 'Image',
      'jpg': 'Image',
      'jpeg': 'Image',
    };
    return typeMap[extension || ''] || extension?.toUpperCase() || '';
  };

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const content = (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
        <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {isEditing ? 'Edit Download' : 'Create Download'}
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
            placeholder="e.g., Weekly Reflection Worksheet"
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
            placeholder="Brief description of the download..."
          />
        </div>

        {/* File Upload */}
        <MediaUpload
          value={formData.fileUrl}
          onChange={(url) => {
            setFormData(prev => ({
              ...prev,
              fileUrl: url,
              fileType: detectFileType(url) || prev.fileType,
            }));
          }}
          folder="downloads"
          type="file"
          label="File"
          required
          uploadEndpoint={uploadEndpoint}
        />

        {/* Programs */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
            Programs
          </label>
          <ProgramSelector
            value={formData.programIds}
            onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
            placeholder="Select programs for this download..."
            programsApiEndpoint={programsApiEndpoint}
          />
        </div>

        {/* Pricing & Access */}
        <ContentPricingFields
          value={formData.pricing}
          onChange={(pricing) => setFormData(prev => ({ ...prev, pricing }))}
        />
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
          {saving ? 'Saving...' : isEditing ? 'Update Download' : 'Create Download'}
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

interface AdminDownloadsSectionProps {
  apiEndpoint?: string;
}

export function AdminDownloadsSection({ apiEndpoint = '/api/admin/discover/downloads' }: AdminDownloadsSectionProps) {
  const [downloads, setDownloads] = useState<ProgramDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [downloadToEdit, setDownloadToEdit] = useState<ProgramDownload | null>(null);
  const [downloadToDelete, setDownloadToDelete] = useState<ProgramDownload | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derive endpoints from API endpoint - use coach endpoints for coach routes
  const isCoachContext = apiEndpoint.includes('/coach/');
  const uploadEndpoint = isCoachContext 
    ? '/api/coach/org-upload-media' 
    : '/api/admin/upload-media';
  const programsApiEndpoint = isCoachContext 
    ? '/api/coach/org-programs' 
    : '/api/admin/programs';

  const fetchDownloads = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch downloads');
      }
      const data = await response.json();
      setDownloads(data.downloads || []);
    } catch (err) {
      console.error('Error fetching downloads:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch downloads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDownloads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredDownloads = useMemo(() => {
    if (!searchQuery.trim()) return downloads;

    const query = searchQuery.toLowerCase();
    return downloads.filter(download =>
      download.title.toLowerCase().includes(query) ||
      download.description?.toLowerCase().includes(query)
    );
  }, [downloads, searchQuery]);

  const handleSearchExpand = useCallback(() => {
    setIsSearchExpanded(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSearchCollapse = useCallback(() => {
    setIsSearchExpanded(false);
    setSearchQuery('');
  }, []);

  const handleDelete = async () => {
    if (!downloadToDelete) return;
    
    try {
      setDeleteLoading(true);
      const response = await fetch(`${apiEndpoint}/${downloadToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete download');
      }
      
      await fetchDownloads();
      setDownloadToDelete(null);
    } catch (err) {
      console.error('Error deleting download:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete download');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-28 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          <div className="h-10 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#faf8f6] dark:bg-[#11141b] rounded-xl p-4 space-y-3">
              <div className="w-10 h-10 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
              <div className="h-5 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              <div className="h-4 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
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
          <Button onClick={fetchDownloads} className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white">
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
              Downloads ({filteredDownloads.length})
            </h2>

            <div className="flex items-center gap-2 ml-auto relative">
              {/* Animated search input */}
              <div
                className={cn(
                  "flex items-center overflow-hidden transition-all duration-300 ease-out",
                  isSearchExpanded ? "w-48 opacity-100" : "w-0 opacity-0"
                )}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search downloads..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-brand-accent/20 font-albert"
                />
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
                onClick={() => { setDownloadToEdit(null); setIsFormOpen(true); }}
                className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
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
                <TableHead className="font-albert">Description</TableHead>
                <TableHead className="font-albert">Type</TableHead>
                <TableHead className="font-albert text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDownloads.map(download => (
                <TableRow key={download.id}>
                  <TableCell className="font-albert font-medium max-w-[200px] truncate">
                    {download.title}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] max-w-[300px] truncate">
                    {download.description || '—'}
                  </TableCell>
                  <TableCell>
                    {download.fileType ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 font-albert">
                        {download.fileType}
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-albert">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDownloadToEdit(download); setIsFormOpen(true); }}
                        className="text-brand-accent hover:text-brand-accent/90 hover:bg-brand-accent/10 font-albert"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDownloadToDelete(download)}
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

        {filteredDownloads.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {searchQuery ? 'No downloads found' : 'No downloads yet. Upload files clients can download, then link them to programs or weeks.'}
            </p>
          </div>
        )}
      </div>

      {/* Download Form Dialog */}
      <DownloadFormDialog
        download={downloadToEdit}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setDownloadToEdit(null); }}
        onSave={fetchDownloads}
        uploadEndpoint={uploadEndpoint}
        apiEndpoint={apiEndpoint}
        programsApiEndpoint={programsApiEndpoint}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!downloadToDelete} onOpenChange={open => !open && setDownloadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Delete Download</AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              Are you sure you want to delete &quot;<strong>{downloadToDelete?.title}</strong>&quot;? This action cannot be undone.
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

