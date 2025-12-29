'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Store, Upload, ExternalLink, Eye, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import type { MarketplaceListing, Funnel } from '@/types';
import { MARKETPLACE_CATEGORIES } from '@/types';

interface FunnelOption {
  id: string;
  name: string;
  slug: string;
  programName?: string;
}

/**
 * MarketplaceSettings - Allow coach to enable/disable and configure marketplace listing
 * 
 * When enabled: Listing appears on public marketplace with link to selected funnel
 * When disabled: Listing is hidden from public marketplace
 */
export function MarketplaceSettings() {
  const { colors, isDefault } = useBrandingValues();
  const accentColor = isDefault ? '#a07855' : colors.accentLight;
  
  // Listing state
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  
  // Funnels dropdown options
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [funnelsLoading, setFunnelsLoading] = useState(true);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch current listing
  const fetchListing = useCallback(async () => {
    try {
      const response = await fetch('/api/coach/marketplace-listing');
      if (response.ok) {
        const data = await response.json();
        if (data.listing) {
          setListing(data.listing);
          setEnabled(data.listing.enabled);
          setTitle(data.listing.title || '');
          setDescription(data.listing.description || '');
          setCoverImageUrl(data.listing.coverImageUrl || '');
          setSelectedFunnelId(data.listing.funnelId || '');
          setCategories(data.listing.categories || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch marketplace listing:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch available funnels
  const fetchFunnels = useCallback(async () => {
    try {
      const response = await fetch('/api/coach/org-funnels');
      if (response.ok) {
        const data = await response.json();
        const funnelOptions: FunnelOption[] = (data.funnels || []).map((f: Funnel) => ({
          id: f.id,
          name: f.name,
          slug: f.slug,
        }));
        setFunnels(funnelOptions);
      }
    } catch (err) {
      console.error('Failed to fetch funnels:', err);
    } finally {
      setFunnelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListing();
    fetchFunnels();
  }, [fetchListing, fetchFunnels]);

  // Handle cover image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'marketplace-cover');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      setCoverImageUrl(data.url);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    // Validation when enabling
    if (enabled) {
      if (!title.trim()) {
        setError('Please enter a title for your listing');
        return;
      }
      if (!description.trim()) {
        setError('Please enter a description for your listing');
        return;
      }
      if (!coverImageUrl) {
        setError('Please upload a cover image');
        return;
      }
      if (!selectedFunnelId) {
        setError('Please select a funnel to link to');
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/coach/marketplace-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          title: title.trim(),
          description: description.trim(),
          coverImageUrl,
          funnelId: selectedFunnelId,
          categories,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save listing');
      }

      const data = await response.json();
      setListing(data.listing);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save listing');
    } finally {
      setSaving(false);
    }
  };

  // Toggle category
  const toggleCategory = (category: string) => {
    setCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
        <div className="h-12 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
            <Store className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Marketplace Listing
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {enabled 
                ? 'Your program is visible on the public marketplace'
                : 'Enable to show your program on the public marketplace'}
            </p>
          </div>
        </div>
        
        {/* Toggle */}
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            enabled ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
          }`}
          style={enabled ? { backgroundColor: accentColor } : undefined}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Fields - Only show when enabled */}
      {enabled && (
        <div className="space-y-5 pt-4 border-t border-[#e1ddd8] dark:border-[#313746]">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Listing Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 12-Week Fitness Transformation"
              className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:focus:border-[#b8896a]"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Short Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your program in 1-2 sentences..."
              className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:focus:border-[#b8896a] resize-none"
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert text-right">
              {description.length}/200
            </p>
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Cover Image *
            </label>
            <div className="flex items-start gap-4">
              {coverImageUrl ? (
                <div className="relative w-40 h-24 rounded-xl overflow-hidden border border-[#e1ddd8] dark:border-[#313746]">
                  <Image
                    src={coverImageUrl}
                    alt="Cover preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-40 h-24 rounded-xl border-2 border-dashed border-[#e1ddd8] dark:border-[#313746] flex items-center justify-center">
                  <span className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">No image</span>
                </div>
              )}
              <div className="flex-1">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors">
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#a07855] dark:text-[#b8896a]" />
                    ) : (
                      <Upload className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    )}
                    <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      {uploading ? 'Uploading...' : 'Upload Image'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-2">
                  Recommended: 800x450px, max 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Funnel Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Link to Funnel *
            </label>
            {funnelsLoading ? (
              <div className="h-12 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl animate-pulse" />
            ) : funnels.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 dark:text-amber-200 font-albert font-medium">
                      No funnels available
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-albert mt-1">
                      Create a funnel first to list your program on the marketplace.
                    </p>
                    <a
                      href="/coach?tab=funnels"
                      className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300 font-albert font-medium mt-2 hover:underline"
                    >
                      Go to Funnels
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <select
                value={selectedFunnelId}
                onChange={(e) => setSelectedFunnelId(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:focus:border-[#b8896a]"
              >
                <option value="">Select a funnel...</option>
                {funnels.map((funnel) => (
                  <option key={funnel.id} value={funnel.id}>
                    {funnel.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
              When users click your listing, they&apos;ll be directed to this funnel
            </p>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Categories (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {MARKETPLACE_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => toggleCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-albert transition-colors ${
                    categories.includes(cat.value)
                      ? 'bg-[#a07855] dark:bg-[#b8896a] text-white'
                      : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e9e5e0] dark:hover:bg-[#313746]'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 font-albert">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300 font-albert">
            Marketplace listing saved successfully!
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-[#e1ddd8] dark:border-[#313746]">
        <button
          onClick={() => setShowPreview(true)}
          disabled={!enabled || !title || !description || !coverImageUrl}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-albert text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1e26] rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            {/* Preview Card */}
            <div className="relative">
              {coverImageUrl ? (
                <div className="relative h-48 w-full">
                  <Image
                    src={coverImageUrl}
                    alt={title || 'Preview'}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="h-48 w-full bg-[#e1ddd8] dark:bg-[#262b35]" />
              )}
            </div>
            
            <div className="p-5">
              <h4 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                {title || 'Your Listing Title'}
              </h4>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
                {description || 'Your listing description will appear here...'}
              </p>
              
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {categories.map(cat => {
                    const catInfo = MARKETPLACE_CATEGORIES.find(c => c.value === cat);
                    return (
                      <span key={cat} className="px-2 py-0.5 bg-[#f3f1ef] dark:bg-[#262b35] rounded-full text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        {catInfo?.emoji} {catInfo?.label}
                      </span>
                    );
                  })}
                </div>
              )}
              
              <button
                className="w-full py-2.5 rounded-xl font-albert text-sm font-medium text-white"
                style={{ backgroundColor: accentColor }}
              >
                View Program
              </button>
            </div>
            
            {/* Close button */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowPreview(false)}
                className="w-full py-2.5 bg-[#f3f1ef] dark:bg-[#262b35] rounded-xl text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm hover:bg-[#e9e5e0] dark:hover:bg-[#313746] transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

