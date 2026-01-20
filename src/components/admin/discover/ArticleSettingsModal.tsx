'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { DatePicker } from '@/components/ui/date-picker';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { AuthorSelector } from '@/components/admin/AuthorSelector';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { ContentPricingFields, type ContentPricingData } from '@/components/admin/ContentPricingFields';

interface ArticleSettingsFormData {
  title: string;
  coverImageUrl: string;
  thumbnailUrl: string;
  authorId: string | null;
  authorName: string;
  authorTitle: string;
  publishedAt: string;
  category: string;
  programIds: string[];
  featured: boolean;
  trending: boolean;
  priceInCents: number | null;
  currency: string;
  purchaseType: 'popup' | 'landing_page';
  isPublic: boolean;
}

interface ArticleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: ArticleSettingsFormData;
  onChange: (updates: Partial<ArticleSettingsFormData>) => void;
  uploadEndpoint: string;
  programsApiEndpoint: string;
  coachesApiEndpoint: string;
  categoriesApiEndpoint: string;
}

export function ArticleSettingsModal({
  isOpen,
  onClose,
  formData,
  onChange,
  uploadEndpoint,
  programsApiEndpoint,
  coachesApiEndpoint,
  categoriesApiEndpoint,
}: ArticleSettingsModalProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Convert form data to pricing format for ContentPricingFields
  const pricingData: ContentPricingData = {
    priceInCents: formData.priceInCents,
    currency: formData.currency,
    purchaseType: formData.purchaseType,
    isPublic: formData.isPublic,
  };

  const handlePricingChange = (pricing: ContentPricingData) => {
    onChange({
      priceInCents: pricing.priceInCents,
      currency: pricing.currency,
      purchaseType: pricing.purchaseType,
      isPublic: pricing.isPublic,
    });
  };

  const content = (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
          Article Settings
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Author Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert uppercase tracking-wide">
            Author
          </h3>

          {/* Author Selection */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">Author</label>
            <AuthorSelector
              value={formData.authorId}
              onChange={({ authorId, authorName }) =>
                onChange({ authorId, authorName })
              }
              placeholder="Select author..."
              coachesApiEndpoint={coachesApiEndpoint}
            />
          </div>

          {/* Author Title */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
              Author Title
              <span className="text-[#8c8a87] dark:text-[#8b8f9a] font-normal ml-1.5">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.authorTitle}
              onChange={e => onChange({ authorTitle: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors text-sm"
              placeholder="e.g., Life Coach, CEO"
            />
          </div>
        </div>

        <hr className="border-[#e1ddd8] dark:border-[#262b35]" />

        {/* Organization Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert uppercase tracking-wide">
            Organization
          </h3>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">Category</label>
            <CategorySelector
              value={formData.category}
              onChange={(category) => onChange({ category })}
              placeholder="Select or create category..."
              categoriesApiEndpoint={categoriesApiEndpoint}
            />
          </div>

          {/* Program Association */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">Programs</label>
            <ProgramSelector
              value={formData.programIds}
              onChange={(programIds) => onChange({ programIds })}
              placeholder="Select programs..."
              programsApiEndpoint={programsApiEndpoint}
            />
          </div>

          {/* Published Date */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">Published Date</label>
            <DatePicker
              value={formData.publishedAt}
              onChange={(date) => onChange({ publishedAt: date })}
              placeholder="Select date"
            />
          </div>
        </div>

        <hr className="border-[#e1ddd8] dark:border-[#262b35]" />

        {/* Thumbnail Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert uppercase tracking-wide">
            Thumbnail
            <span className="text-[#8c8a87] dark:text-[#8b8f9a] font-normal ml-1.5 normal-case tracking-normal">(optional)</span>
          </h3>
          <MediaUpload
            value={formData.thumbnailUrl}
            onChange={(url) => onChange({ thumbnailUrl: url })}
            folder="articles"
            type="image"
            uploadEndpoint={uploadEndpoint}
            hideLabel
            previewSize="thumbnail"
          />
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Recommended size: 1200 x 675px. Used for article cards and sharing.
          </p>
        </div>

        <hr className="border-[#e1ddd8] dark:border-[#262b35]" />

        {/* Pricing & Access */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert uppercase tracking-wide">
            Pricing & Access
          </h3>
          <ContentPricingFields
            value={pricingData}
            onChange={handlePricingChange}
          />
        </div>

        <hr className="border-[#e1ddd8] dark:border-[#262b35]" />

        {/* Visibility Options */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert uppercase tracking-wide">
            Display Options
          </h3>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <BrandedCheckbox
                checked={formData.featured}
                onChange={(checked) => onChange({ featured: checked })}
              />
              <span
                className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer"
                onClick={() => onChange({ featured: !formData.featured })}
              >
                Featured
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BrandedCheckbox
                checked={formData.trending}
                onChange={(checked) => onChange({ trending: checked })}
              />
              <span
                className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer"
                onClick={() => onChange({ trending: !formData.trending })}
              >
                Trending
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <Button
          onClick={onClose}
          className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
        >
          Done
        </Button>
      </div>
    </div>
  );

  // Mobile: Use Drawer (slide-up)
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Use Dialog (centered modal)
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all">
                {content}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
