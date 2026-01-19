'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Settings2, Star, TrendingUp, Globe, DollarSign, AlertTriangle } from 'lucide-react';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStripeConnectStatus } from '@/hooks/useStripeConnectStatus';
import { CurrencySelector } from '@/components/admin/ContentPricingFields';

export interface ContentPricingData {
  priceInCents: number | null;
  currency: string;
  purchaseType: 'popup' | 'landing_page';
  isPublic: boolean;
}

export interface ResourceSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'course' | 'article' | 'event' | 'download' | 'link';
  // Basic fields
  title: string;
  onTitleChange: (title: string) => void;
  coverImageUrl: string;
  onCoverImageChange: (url: string) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  // Metadata
  category?: string;
  onCategoryChange?: (cat: string) => void;
  level?: string;
  onLevelChange?: (level: string) => void;
  programIds?: string[];
  onProgramIdsChange?: (ids: string[]) => void;
  // Pricing
  pricing?: ContentPricingData;
  onPricingChange?: (pricing: ContentPricingData) => void;
  // Visibility
  featured?: boolean;
  onFeaturedChange?: (featured: boolean) => void;
  trending?: boolean;
  onTrendingChange?: (trending: boolean) => void;
  // Config
  uploadEndpoint: string;
  programsApiEndpoint?: string;
  showMetadata?: boolean;
  showPricing?: boolean;
  showVisibility?: boolean;
}

function SettingsToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#f3f1ef] dark:hover:bg-[#1e232c]'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
        <div>
          <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {label}
          </span>
          {description && (
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {description}
            </p>
          )}
        </div>
      </div>
      <BrandedCheckbox checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}

function SettingsContent({
  type,
  title,
  onTitleChange,
  coverImageUrl,
  onCoverImageChange,
  description,
  onDescriptionChange,
  category,
  onCategoryChange,
  level,
  onLevelChange,
  programIds,
  onProgramIdsChange,
  pricing,
  onPricingChange,
  featured,
  onFeaturedChange,
  trending,
  onTrendingChange,
  uploadEndpoint,
  programsApiEndpoint,
  showMetadata = true,
  showPricing = true,
  showVisibility = true,
}: Omit<ResourceSettingsModalProps, 'open' | 'onOpenChange'>) {
  const { isConnected: stripeConnected, isLoading: stripeLoading } = useStripeConnectStatus();
  const canEnablePricing = stripeConnected || stripeLoading;

  const isPricingEnabled = pricing?.priceInCents !== null && (pricing?.priceInCents ?? 0) > 0;
  const priceInDollars = pricing?.priceInCents
    ? (pricing.priceInCents / 100).toFixed(2)
    : '';

  const handlePriceChange = (dollarValue: string) => {
    if (!pricing || !onPricingChange) return;
    const cleanValue = dollarValue.replace(/[^0-9.]/g, '');
    if (cleanValue === '' || cleanValue === '.') {
      onPricingChange({ ...pricing, priceInCents: null });
      return;
    }
    const cents = Math.round(parseFloat(cleanValue) * 100);
    if (!isNaN(cents) && cents >= 0) {
      onPricingChange({ ...pricing, priceInCents: cents });
    }
  };

  const handlePricingToggle = (enabled: boolean) => {
    if (!pricing || !onPricingChange) return;
    if (enabled && !canEnablePricing) return;
    if (!enabled) {
      onPricingChange({ ...pricing, priceInCents: null });
    } else if (!pricing.priceInCents) {
      onPricingChange({ ...pricing, priceInCents: 999 }); // Default $9.99
    }
  };

  const typeLabels: Record<string, string> = {
    course: 'Course',
    article: 'Article',
    event: 'Event',
    download: 'Download',
    link: 'Link',
  };

  return (
    <div className="space-y-5 overflow-y-auto max-h-[70vh] md:max-h-[75vh] pr-1 scrollbar-thin">
      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={`Enter ${typeLabels[type]?.toLowerCase() || 'resource'} title...`}
            className="w-full px-3 py-2.5 text-sm border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert bg-white dark:bg-[#0d0f14]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
            Cover Image <span className="text-[#9ca3af] font-normal text-xs">(1200 × 675px)</span> <span className="text-red-500">*</span>
          </label>
          <MediaUpload
            value={coverImageUrl}
            onChange={onCoverImageChange}
            folder={`${type}s`}
            type="image"
            uploadEndpoint={uploadEndpoint}
            hideLabel
            previewSize="full"
          />
        </div>

        <div>
          <RichTextEditor
            value={description}
            onChange={onDescriptionChange}
            label="Description *"
            placeholder={`What will users learn from this ${typeLabels[type]?.toLowerCase() || 'content'}?`}
            rows={3}
            showMediaToolbar={false}
            uploadEndpoint={uploadEndpoint}
          />
        </div>
      </div>

      {/* Metadata */}
      {showMetadata && (onCategoryChange || onLevelChange || onProgramIdsChange) && (
        <>
          <div className="border-t border-[#e1ddd8] dark:border-[#262b35]" />
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {onCategoryChange && (
                <div>
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert uppercase tracking-wide">
                    Category
                  </label>
                  <CategorySelector
                    value={category || ''}
                    onChange={onCategoryChange}
                    placeholder="Select..."
                  />
                </div>
              )}
              {onLevelChange && (
                <div>
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert uppercase tracking-wide">
                    Level
                  </label>
                  <Select value={level || ''} onValueChange={onLevelChange}>
                    <SelectTrigger className="w-full h-10 bg-white dark:bg-[#0d0f14] border-[#e1ddd8] dark:border-[#262b35] rounded-lg">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {onProgramIdsChange && programsApiEndpoint && (
              <div>
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert uppercase tracking-wide">
                  Programs
                </label>
                <ProgramSelector
                  value={programIds || []}
                  onChange={onProgramIdsChange}
                  programsApiEndpoint={programsApiEndpoint}
                  showHelperText
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Pricing & Access */}
      {showPricing && pricing && onPricingChange && (
        <>
          <div className="border-t border-[#e1ddd8] dark:border-[#262b35]" />
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert uppercase tracking-wide px-1">
              Pricing & Access
            </h4>

            {/* Stripe Connect Warning */}
            {!stripeLoading && !stripeConnected && (
              <div className="mx-1 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-albert">
                    Connect your Stripe account in Settings to accept payments.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
              <SettingsToggleRow
                icon={DollarSign}
                label="Enable Pricing"
                description="Charge a one-time fee for access"
                checked={isPricingEnabled}
                onChange={handlePricingToggle}
                disabled={!canEnablePricing}
              />

              {/* Price Configuration (conditional) */}
              {isPricingEnabled && (
                <div className="px-3 pb-3 pt-1 space-y-3 bg-[#faf8f6] dark:bg-[#11141b]">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#5f5a55]">$</span>
                      <input
                        type="text"
                        value={priceInDollars}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert bg-white dark:bg-[#0d0f14]"
                      />
                    </div>
                    <CurrencySelector
                      value={pricing.currency}
                      onChange={(currency) => onPricingChange({ ...pricing, currency })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onPricingChange({ ...pricing, purchaseType: 'popup' })}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        pricing.purchaseType === 'popup'
                          ? 'bg-brand-accent text-white border-brand-accent'
                          : 'bg-white dark:bg-[#0d0f14] border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent'
                      }`}
                    >
                      Popup Checkout
                    </button>
                    <button
                      type="button"
                      onClick={() => onPricingChange({ ...pricing, purchaseType: 'landing_page' })}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        pricing.purchaseType === 'landing_page'
                          ? 'bg-brand-accent text-white border-brand-accent'
                          : 'bg-white dark:bg-[#0d0f14] border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent'
                      }`}
                    >
                      Landing Page
                    </button>
                  </div>
                </div>
              )}

              <SettingsToggleRow
                icon={Globe}
                label="Public in Discover"
                description="Visible to all users in Discover"
                checked={pricing.isPublic}
                onChange={(isPublic) => onPricingChange({ ...pricing, isPublic })}
              />
            </div>
          </div>
        </>
      )}

      {/* Visibility */}
      {showVisibility && (onFeaturedChange || onTrendingChange) && (
        <>
          <div className="border-t border-[#e1ddd8] dark:border-[#262b35]" />
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert uppercase tracking-wide px-1">
              Visibility
            </h4>
            <div className="rounded-lg border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
              {onFeaturedChange && (
                <SettingsToggleRow
                  icon={Star}
                  label="Featured"
                  description="Show in featured section"
                  checked={featured || false}
                  onChange={onFeaturedChange}
                />
              )}
              {onTrendingChange && (
                <SettingsToggleRow
                  icon={TrendingUp}
                  label="Trending"
                  description="Show in trending section"
                  checked={trending || false}
                  onChange={onTrendingChange}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ResourceSettingsModal(props: ResourceSettingsModalProps) {
  const { open, onOpenChange, type } = props;
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const typeLabels: Record<string, string> = {
    course: 'Course',
    article: 'Article',
    event: 'Event',
    download: 'Download',
    link: 'Link',
  };

  const title = `${typeLabels[type] || 'Resource'} Settings`;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold font-albert">
              <Settings2 className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <SettingsContent {...props} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b border-[#e1ddd8] dark:border-[#262b35]">
          <DrawerTitle className="flex items-center gap-2 text-base font-semibold font-albert">
            <Settings2 className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
            {title}
          </DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pb-8">
          <SettingsContent {...props} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
