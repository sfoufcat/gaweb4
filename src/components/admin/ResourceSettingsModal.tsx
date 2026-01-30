'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import {
  Settings2,
  Star,
  TrendingUp,
  Globe,
  Lock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { useStripeConnectStatus } from '@/hooks/useStripeConnectStatus';
import { StripeConnectPrompt } from '@/components/ui/StripeConnectPrompt';
import { StripeConnectModal } from '@/components/ui/StripeConnectModal';
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
  /** API endpoint for categories. Defaults to /api/coach/org-article-categories */
  categoriesApiEndpoint?: string;
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
  categoriesApiEndpoint,
  showMetadata = true,
  showPricing = true,
  showVisibility = true,
}: Omit<ResourceSettingsModalProps, 'open' | 'onOpenChange'>) {
  const { isConnected: stripeConnected, isLoading: stripeLoading, refetch: refetchStripe } = useStripeConnectStatus();
  const canAcceptPayments = stripeConnected;
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [showStripeModal, setShowStripeModal] = useState(false);

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

  const typeLabels: Record<string, string> = {
    course: 'Course',
    article: 'Article',
    event: 'Event',
    download: 'Download',
    link: 'Link',
  };

  // Animation variants
  const fadeVariants = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0 },
  };

  return (
    <>
      <div className="relative">
      <div className="overflow-y-auto max-h-[70vh] md:max-h-[75vh] scrollbar-thin">
        <div className="space-y-8 px-5 py-5 pb-16">
          {/* Section 1: Course Details (Collapsible) */}
          <section>
            <button
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#262b35] flex items-center justify-center overflow-hidden">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                  )}
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {title || `${typeLabels[type] || 'Resource'} Details`}
                  </h3>
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Name, description & cover image
                  </p>
                </div>
              </div>
              {detailsExpanded ? (
                <ChevronUp className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
              )}
            </button>

            <AnimatePresence>
              {detailsExpanded && (
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={fadeVariants}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => onTitleChange(e.target.value)}
                        placeholder={`Enter ${typeLabels[type]?.toLowerCase() || 'resource'} title...`}
                        className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        placeholder={`What will users learn from this ${typeLabels[type]?.toLowerCase() || 'content'}?`}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Cover Image
                      </label>
                      <MediaUpload
                        value={coverImageUrl}
                        onChange={onCoverImageChange}
                        folder={`${type}s`}
                        type="image"
                        uploadEndpoint={uploadEndpoint}
                        hideLabel
                        aspectRatio="16:9"
                        collapsiblePreview
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Section 2: Metadata */}
          {showMetadata && (onCategoryChange || onProgramIdsChange) && (
            <section>
              <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                Category & Programs
              </h3>
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
                      categoriesApiEndpoint={categoriesApiEndpoint}
                    />
                  </div>
                )}
                {onProgramIdsChange && programsApiEndpoint && (
                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert uppercase tracking-wide">
                      Programs
                    </label>
                    <ProgramSelector
                      value={programIds || []}
                      onChange={onProgramIdsChange}
                      programsApiEndpoint={programsApiEndpoint}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 3: Pricing (Free/Paid Cards) */}
          {showPricing && pricing && onPricingChange && (
            <section>
              <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                Pricing
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onPricingChange({ ...pricing, priceInCents: null })}
                  className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 transition-all ${
                    !isPricingEnabled
                      ? 'border-brand-accent bg-brand-accent/5'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                  }`}
                >
                  <span className={`text-base font-semibold font-albert ${
                    !isPricingEnabled ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`}>
                    Free
                  </span>
                  {!isPricingEnabled && (
                    <Check className="w-4.5 h-4.5 text-brand-accent" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (!canAcceptPayments) return;
                    if (!isPricingEnabled) {
                      onPricingChange({ ...pricing, priceInCents: 999 });
                    }
                  }}
                  disabled={!canAcceptPayments}
                  className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 transition-all ${
                    isPricingEnabled
                      ? 'border-brand-accent bg-brand-accent/5'
                      : !canAcceptPayments
                        ? 'border-[#e1ddd8] dark:border-[#262b35] opacity-50 cursor-not-allowed'
                        : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                  }`}
                >
                  <DollarSign className={`w-4.5 h-4.5 ${
                    isPricingEnabled ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`} />
                  <span className={`text-base font-semibold font-albert ${
                    isPricingEnabled ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`}>
                    Paid
                  </span>
                  {isPricingEnabled && (
                    <Check className="w-4.5 h-4.5 text-brand-accent" />
                  )}
                </button>
              </div>

              {/* Stripe Connect Prompt - show when Stripe not connected */}
              {!canAcceptPayments && (
                <div className="mt-3">
                  <StripeConnectPrompt onClick={() => setShowStripeModal(true)} />
                </div>
              )}

              <AnimatePresence mode="wait">
                {isPricingEnabled && (
                  <motion.div
                    key="paid-options"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-medium">$</span>
                        <input
                          type="number"
                          value={pricing.priceInCents ? pricing.priceInCents / 100 : ''}
                          onChange={(e) => handlePriceChange(e.target.value)}
                          placeholder="9.99"
                          className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
                        />
                      </div>
                      <CurrencySelector
                        value={pricing.currency}
                        onChange={(currency) => onPricingChange({ ...pricing, currency })}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* Section 4: Public/Private (Cards) */}
          {showPricing && pricing && onPricingChange && (
            <section>
              <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                Access
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onPricingChange({ ...pricing, isPublic: false })}
                  className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    !pricing.isPublic
                      ? 'border-brand-accent bg-brand-accent/5'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                  }`}
                >
                  <Lock className={`w-5 h-5 ${
                    !pricing.isPublic ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`} />
                  <div className="text-left">
                    <div className={`text-sm font-semibold font-albert ${
                      !pricing.isPublic ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                    }`}>
                      Private
                    </div>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      Only enrolled users
                    </p>
                  </div>
                  {!pricing.isPublic && (
                    <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />
                  )}
                </button>

                <button
                  onClick={() => onPricingChange({ ...pricing, isPublic: true })}
                  className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    pricing.isPublic
                      ? 'border-brand-accent bg-brand-accent/5'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                  }`}
                >
                  <Globe className={`w-5 h-5 ${
                    pricing.isPublic ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`} />
                  <div className="text-left">
                    <div className={`text-sm font-semibold font-albert ${
                      pricing.isPublic ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                    }`}>
                      Public
                    </div>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      Visible in Discover
                    </p>
                  </div>
                  {pricing.isPublic && (
                    <Check className="w-5 h-5 text-brand-accent flex-shrink-0" />
                  )}
                </button>
              </div>
            </section>
          )}

          {/* Section 5: Visibility (Featured/Trending Toggles) */}
          {showVisibility && (onFeaturedChange || onTrendingChange) && (
            <section>
              <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                Visibility
              </h3>
              <div className="rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
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
            </section>
          )}
        </div>

      </div>

      {/* Bottom blur gradient for comfortable scrolling */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-[#171b22] to-transparent pointer-events-none" />
      </div>

      {/* Stripe Connect Modal */}
      <StripeConnectModal
        isOpen={showStripeModal}
        onClose={() => setShowStripeModal(false)}
        onConnected={() => refetchStripe()}
      />
    </>
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
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold font-albert">
              <Settings2 className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <SettingsContent {...props} />
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
