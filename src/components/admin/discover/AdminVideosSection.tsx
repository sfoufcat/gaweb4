'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import {
  ContentPricingFields,
  getDefaultPricingData,
  type ContentPricingData,
} from '@/components/admin/ContentPricingFields';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Search, X, Plus, Play, Clock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { DiscoverVideo, VideoStatus } from '@/types/discover';
import { CreateVideoModal } from './CreateVideoModal';

// Simplified Edit Dialog (for existing videos)
interface VideoEditDialogProps {
  video: DiscoverVideo;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  apiEndpoint: string;
  programsApiEndpoint: string;
}

function VideoEditDialog({
  video,
  isOpen,
  onClose,
  onSave,
  apiEndpoint,
  programsApiEndpoint,
}: VideoEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    customThumbnailUrl: '',
    programIds: [] as string[],
    order: 0,
    pricing: getDefaultPricingData() as ContentPricingData,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (video && isOpen) {
      setFormData({
        title: video.title || '',
        description: video.description || '',
        customThumbnailUrl: video.customThumbnailUrl || '',
        programIds: video.programIds || [],
        order: video.order || 0,
        pricing: {
          priceInCents: video.priceInCents ?? null,
          currency: video.currency || 'USD',
          purchaseType: (video.purchaseType as 'popup' | 'landing_page') || 'popup',
          isPublic: video.isPublic !== false,
        },
      });
      setError(null);
    }
  }, [video, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!formData.title) {
        throw new Error('Title is required');
      }

      const payload = {
        title: formData.title,
        description: formData.description,
        customThumbnailUrl: formData.customThumbnailUrl || null,
        programIds: formData.programIds,
        order: formData.order,
        priceInCents: formData.pricing.priceInCents,
        currency: formData.pricing.currency,
        purchaseType: formData.pricing.purchaseType,
        isPublic: formData.pricing.isPublic,
      };

      const response = await fetch(`${apiEndpoint}/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save video');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving video:', err);
      setError(err instanceof Error ? err.message : 'Failed to save video');
    } finally {
      setSaving(false);
    }
  };

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const content = (
    <form onSubmit={handleSubmit}>
      <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
        <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Edit Video
        </h2>
      </div>

      <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
            Title *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2.5 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
            placeholder="e.g., Getting Started with Mindfulness"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2.5 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
            placeholder="Brief description of the video content..."
          />
        </div>

        {/* Video Status Display */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
            Video Status
          </label>
          <div className="p-3 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-center gap-2">
              {video.videoStatus === 'ready' && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400 font-albert">Ready</span>
                </>
              )}
              {video.videoStatus === 'encoding' && (
                <>
                  <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                  <span className="text-sm text-amber-600 dark:text-amber-400 font-albert">Processing...</span>
                </>
              )}
              {video.videoStatus === 'failed' && (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-600 dark:text-red-400 font-albert">Failed</span>
                </>
              )}
              {video.videoStatus === 'uploading' && (
                <>
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-albert">Uploading...</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Custom Thumbnail URL */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
            Custom Thumbnail URL (optional)
          </label>
          <input
            type="text"
            value={formData.customThumbnailUrl}
            onChange={(e) => setFormData((prev) => ({ ...prev, customThumbnailUrl: e.target.value }))}
            className="w-full px-3 py-2.5 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
            placeholder="https://example.com/thumbnail.jpg"
          />
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
            Leave empty to use auto-generated thumbnail
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
            </div>
          </div>
        )}

        {/* Programs */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
            Programs
          </label>
          <ProgramSelector
            value={formData.programIds}
            onChange={(programIds) => setFormData((prev) => ({ ...prev, programIds }))}
            placeholder="Select programs for this video..."
            programsApiEndpoint={programsApiEndpoint}
          />
        </div>

        {/* Pricing & Access */}
        <ContentPricingFields
          value={formData.pricing}
          onChange={(pricing) => setFormData((prev) => ({ ...prev, pricing }))}
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
          {saving ? 'Saving...' : 'Update Video'}
        </Button>
      </div>
    </form>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl p-0" hideCloseButton>
          <VisuallyHidden>
            <DialogTitle>Edit Video</DialogTitle>
          </VisuallyHidden>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[90dvh]">{content}</DrawerContent>
    </Drawer>
  );
}

// Format duration in seconds to mm:ss or hh:mm:ss
function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface AdminVideosSectionProps {
  apiEndpoint?: string;
}

export function AdminVideosSection({
  apiEndpoint = '/api/admin/discover/videos',
}: AdminVideosSectionProps) {
  const [videos, setVideos] = useState<DiscoverVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [videoToEdit, setVideoToEdit] = useState<DiscoverVideo | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<DiscoverVideo | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derive endpoints from API endpoint
  const isCoachContext = apiEndpoint.includes('/coach/');
  const programsApiEndpoint = isCoachContext ? '/api/coach/org-programs' : '/api/admin/programs';

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch videos');
      }
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;

    const query = searchQuery.toLowerCase();
    return videos.filter(
      (video) =>
        video.title.toLowerCase().includes(query) ||
        video.description?.toLowerCase().includes(query)
    );
  }, [videos, searchQuery]);

  const handleSearchExpand = useCallback(() => {
    setIsSearchExpanded(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSearchCollapse = useCallback(() => {
    setIsSearchExpanded(false);
    setSearchQuery('');
  }, []);

  const handleDelete = async () => {
    if (!videoToDelete) return;

    try {
      setDeleteLoading(true);
      const response = await fetch(`${apiEndpoint}/${videoToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete video');
      }

      await fetchVideos();
      setVideoToDelete(null);
    } catch (err) {
      console.error('Error deleting video:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete video');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleVideoCreated = () => {
    fetchVideos();
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
            <div key={i} className="bg-[#faf8f6] dark:bg-[#11141b] rounded-xl overflow-hidden">
              <div className="aspect-video bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="p-4 space-y-2">
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
        <div className="text-center text-red-600">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button
            onClick={fetchVideos}
            className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white"
          >
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
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Videos ({filteredVideos.length})
            </h2>

            <div className="flex items-center gap-2 ml-auto relative">
              {/* Animated search input */}
              <div
                className={cn(
                  'flex items-center overflow-hidden transition-all duration-300 ease-out',
                  isSearchExpanded ? 'w-48 opacity-100' : 'w-0 opacity-0'
                )}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-brand-accent/20 font-albert"
                />
              </div>

              <button
                onClick={isSearchExpanded ? handleSearchCollapse : handleSearchExpand}
                className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              >
                {isSearchExpanded ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline text-[15px] font-medium">Add Video</span>
              </button>
            </div>
          </div>
        </div>

        {/* Video Grid */}
        <div className="p-4 sm:p-6">
          {filteredVideos.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f3f1ef] dark:bg-[#1e222a] flex items-center justify-center">
                <Play className="w-8 h-8 text-[#9ca3af]" />
              </div>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {searchQuery
                  ? 'No videos found'
                  : 'No videos yet. Add premium video content for your clients.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                  className="group bg-[#faf8f6] dark:bg-[#11141b] rounded-xl overflow-hidden border border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-[#e1ddd8] dark:bg-[#262b35]">
                    {video.thumbnailUrl || video.customThumbnailUrl ? (
                      <img
                        src={video.customThumbnailUrl || video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-12 h-12 text-[#9ca3af]" />
                      </div>
                    )}

                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-6 h-6 text-[#1a1a1a] ml-1" />
                      </div>
                    </div>

                    {/* Duration badge */}
                    {video.durationSeconds != null && video.durationSeconds > 0 && (
                      <div className="absolute bottom-2 right-2 text-white text-xs font-medium font-albert flex items-center gap-1 drop-shadow-md">
                        <Clock className="w-3 h-3" />
                        {formatDuration(video.durationSeconds)}
                      </div>
                    )}

                    {/* Status badge */}
                    <div className="absolute top-2 left-2">
                      {video.videoStatus === 'encoding' && (
                        <div className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded font-albert flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Processing
                        </div>
                      )}
                      {video.videoStatus === 'failed' && (
                        <div className="px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded font-albert flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Failed
                        </div>
                      )}
                    </div>

                    {/* Price badge */}
                    {video.priceInCents && video.priceInCents > 0 && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded font-albert">
                        ${(video.priceInCents / 100).toFixed(0)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {video.title}
                    </h3>
                    {video.description && (
                      <p className="mt-1 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert line-clamp-2">
                        {video.description}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVideoToEdit(video)}
                        className="text-brand-accent hover:text-brand-accent/90 hover:bg-brand-accent/10 font-albert"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVideoToDelete(video)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 font-albert"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Video Modal (2-step wizard) */}
      <CreateVideoModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onVideoCreated={handleVideoCreated}
        apiEndpoint={apiEndpoint}
        programsApiEndpoint={programsApiEndpoint}
      />

      {/* Edit Video Dialog (simplified) */}
      {videoToEdit && (
        <VideoEditDialog
          video={videoToEdit}
          isOpen={!!videoToEdit}
          onClose={() => setVideoToEdit(null)}
          onSave={fetchVideos}
          apiEndpoint={apiEndpoint}
          programsApiEndpoint={programsApiEndpoint}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!videoToDelete} onOpenChange={(open) => !open && setVideoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Delete Video</AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              Are you sure you want to delete &quot;<strong>{videoToDelete?.title}</strong>&quot;?
              This will also delete the video from Bunny Stream. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} className="font-albert">
              Cancel
            </AlertDialogCancel>
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
