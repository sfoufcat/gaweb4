'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { 
  Loader2, 
  Check, 
  Shield, 
  FileText, 
  BookOpen, 
  Calendar, 
  Download, 
  Link as LinkIcon,
  X,
} from 'lucide-react';
import type { PurchasableContentType } from '@/types/discover';

interface ContentPurchaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: {
    id: string;
    type: PurchasableContentType;
    title: string;
    description?: string;
    coverImageUrl?: string;
    priceInCents: number;
    currency?: string;
    coachName?: string;
    coachImageUrl?: string;
    keyOutcomes?: string[];
  };
  onPurchaseComplete?: () => void;
}

/**
 * Helper to convert hex to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get icon for content type
 */
function getContentTypeIcon(type: PurchasableContentType) {
  switch (type) {
    case 'article':
      return FileText;
    case 'course':
      return BookOpen;
    case 'event':
      return Calendar;
    case 'download':
      return Download;
    case 'link':
      return LinkIcon;
    default:
      return FileText;
  }
}

/**
 * Get content URL for navigation
 */
function getContentUrl(type: PurchasableContentType, id: string): string {
  switch (type) {
    case 'article':
      return `/discover/articles/${id}`;
    case 'course':
      return `/discover/courses/${id}`;
    case 'event':
      return `/discover/events/${id}`;
    case 'download':
      return `/discover/downloads/${id}`;
    case 'link':
      return `/discover/links/${id}`;
    default:
      return `/discover`;
  }
}

/**
 * Format price from cents
 */
function formatPrice(cents: number, currency = 'usd') {
  if (cents === 0) return 'Free';
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * Content inside the sheet/dialog
 */
function PurchaseContent({
  content,
  onPurchase,
  isPurchasing,
  isSignedIn,
  purchaseSuccess,
}: {
  content: ContentPurchaseSheetProps['content'];
  onPurchase: () => void;
  isPurchasing: boolean;
  isSignedIn: boolean;
  purchaseSuccess: boolean;
}) {
  const { colors } = useBrandingValues();
  const ContentIcon = getContentTypeIcon(content.type);
  
  return (
    <div className="flex flex-col">
      {/* Content Preview */}
      <div className="px-4 pb-4">
        <div className="flex gap-4">
          {/* Cover Image or Icon */}
          <div className="flex-shrink-0">
            {content.coverImageUrl ? (
              <div className="w-20 h-20 rounded-xl overflow-hidden">
                <Image
                  src={content.coverImageUrl}
                  alt={content.title}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div 
                className="w-20 h-20 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: hexToRgba(colors.accentLight, 0.1) }}
              >
                <ContentIcon 
                  className="w-8 h-8" 
                  style={{ color: colors.accentLight }} 
                />
              </div>
            )}
          </div>
          
          {/* Content Info */}
          <div className="flex-1 min-w-0">
            <div 
              className="text-xs font-medium px-2 py-0.5 rounded-full w-fit mb-1"
              style={{ 
                backgroundColor: hexToRgba(colors.accentLight, 0.1),
                color: colors.accentLight 
              }}
            >
              {content.type.charAt(0).toUpperCase() + content.type.slice(1)}
            </div>
            <h3 className="font-albert font-semibold text-lg text-text-primary dark:text-[#f5f5f8] line-clamp-2">
              {content.title}
            </h3>
            {content.coachName && (
              <p className="text-sm text-text-secondary dark:text-[#b2b6c2] mt-1">
                by {content.coachName}
              </p>
            )}
          </div>
        </div>
        
        {/* Description */}
        {content.description && (
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2] mt-4 line-clamp-3">
            {content.description}
          </p>
        )}
        
        {/* Key Outcomes */}
        {content.keyOutcomes && content.keyOutcomes.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
              What you&apos;ll get:
            </p>
            <ul className="space-y-1.5">
              {content.keyOutcomes.slice(0, 3).map((outcome, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check 
                    className="w-4 h-4 mt-0.5 flex-shrink-0" 
                    style={{ color: colors.accentLight }}
                  />
                  <span className="text-sm text-text-secondary dark:text-[#b2b6c2]">
                    {outcome}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Price & CTA */}
      <div className="border-t border-[#e1ddd8] dark:border-[#262b35] px-4 py-4">
        <AnimatePresence mode="wait">
          {!purchaseSuccess ? (
            <motion.div
              key="purchase"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-2xl font-bold text-text-primary dark:text-[#f5f5f8]">
                    {formatPrice(content.priceInCents, content.currency)}
                  </span>
                  {content.priceInCents > 0 && (
                    <span className="text-sm text-text-secondary dark:text-[#b2b6c2] ml-2">
                      one-time
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-text-secondary dark:text-[#b2b6c2]">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs">Secure checkout</span>
                </div>
              </div>
              
              <Button
                onClick={onPurchase}
                disabled={isPurchasing}
                className="w-full py-3 text-white font-semibold rounded-xl transition-all"
                style={{ 
                  background: `linear-gradient(135deg, ${colors.accentLight}, ${colors.accentDark})`,
                }}
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : !isSignedIn ? (
                  'Sign in to purchase'
                ) : content.priceInCents === 0 ? (
                  'Get for free'
                ) : (
                  `Purchase for ${formatPrice(content.priceInCents, content.currency)}`
                )}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 0.4, 
                ease: [0.34, 1.56, 0.64, 1] // Spring-like bounce
              }}
              className="flex flex-col items-center py-4"
            >
              {/* Success checkmark circle */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  delay: 0.1,
                  duration: 0.4,
                  ease: [0.34, 1.56, 0.64, 1]
                }}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-4"
              >
                <motion.div
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  <Check className="w-8 h-8 text-white stroke-[3]" />
                </motion.div>
              </motion.div>
              
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8]"
              >
                Added to My Content
              </motion.p>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                className="text-sm text-text-secondary dark:text-[#b2b6c2] mt-1"
              >
                Redirecting...
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * ContentPurchaseSheet - Slide-up on mobile, modal on desktop
 * Shows content preview and purchase button for quick purchases.
 */
export function ContentPurchaseSheet({
  open,
  onOpenChange,
  content,
  onPurchaseComplete,
}: ContentPurchaseSheetProps) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  
  // Reset success state when sheet closes
  useEffect(() => {
    if (!open) {
      setPurchaseSuccess(false);
    }
  }, [open]);
  
  const handlePurchase = async () => {
    if (!isSignedIn) {
      // Redirect to sign-in
      const returnPath = window.location.pathname;
      router.push(`/sign-in?redirect=${encodeURIComponent(returnPath)}`);
      return;
    }
    
    setIsPurchasing(true);
    
    try {
      const response = await fetch('/api/content/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: content.type,
          contentId: content.id,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Purchase failed');
      }
      
      if (result.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = result.checkoutUrl;
        return;
      }
      
      // Show success animation
      setPurchaseSuccess(true);
      
      // Navigate to content page after animation
      setTimeout(() => {
        onOpenChange(false);
        onPurchaseComplete?.();
        const contentUrl = getContentUrl(content.type, content.id);
        router.push(contentUrl);
      }, 1500);
      
    } catch (error) {
      console.error('Purchase error:', error);
      // Could add toast notification here
    } finally {
      setIsPurchasing(false);
    }
  };
  
  return (
    <>
      {/* Mobile: Drawer */}
      <div className="lg:hidden">
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{content.title}</DrawerTitle>
              <DrawerDescription>Purchase this content</DrawerDescription>
            </DrawerHeader>
            <PurchaseContent
              content={content}
              onPurchase={handlePurchase}
              isPurchasing={isPurchasing}
              isSignedIn={!!isSignedIn}
              purchaseSuccess={purchaseSuccess}
            />
          </DrawerContent>
        </Drawer>
      </div>
      
      {/* Desktop: Dialog */}
      <div className="hidden lg:block">
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-md p-0 gap-0">
            <DialogHeader className="sr-only">
              <DialogTitle>{content.title}</DialogTitle>
              <DialogDescription>Purchase this content</DialogDescription>
            </DialogHeader>
            
            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 z-10 rounded-full p-1.5 hover:bg-[#e1ddd8]/50 dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-4 h-4 text-text-secondary" />
            </button>
            
            <div className="pt-6">
              <PurchaseContent
                content={content}
                onPurchase={handlePurchase}
                isPurchasing={isPurchasing}
                isSignedIn={!!isSignedIn}
                purchaseSuccess={purchaseSuccess}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
