'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, X } from 'lucide-react';

export type ProductType = 'program' | 'squad' | 'content' | 'article' | 'course' | 'event' | 'download';

interface AlreadyEnrolledModalProps {
  isOpen: boolean;
  onClose: () => void;
  productType: ProductType;
  productName?: string;
  redirectUrl?: string;
  /** Custom message to display */
  message?: string;
  /** Show "Go to X" button - defaults to true */
  showGoToButton?: boolean;
  /** Custom CTA text for the primary button */
  ctaText?: string;
}

/**
 * Get the appropriate icon and styling based on product type
 */
function getProductConfig(productType: ProductType) {
  switch (productType) {
    case 'program':
      return {
        title: 'Already Enrolled',
        icon: '🎯',
        defaultMessage: 'You are already enrolled in this program.',
        buttonText: 'Go to Program',
        accentColor: 'bg-emerald-500',
      };
    case 'squad':
      return {
        title: 'Already a Member',
        icon: '👥',
        defaultMessage: 'You are already a member of this squad.',
        buttonText: 'Go to Squad',
        accentColor: 'bg-blue-500',
      };
    case 'article':
      return {
        title: 'Already Purchased',
        icon: '📖',
        defaultMessage: 'You already own this article.',
        buttonText: 'Read Article',
        accentColor: 'bg-purple-500',
      };
    case 'course':
      return {
        title: 'Already Enrolled',
        icon: '🎓',
        defaultMessage: 'You already have access to this course.',
        buttonText: 'Go to Course',
        accentColor: 'bg-indigo-500',
      };
    case 'event':
      return {
        title: 'Already Registered',
        icon: '📅',
        defaultMessage: 'You are already registered for this event.',
        buttonText: 'View Event',
        accentColor: 'bg-orange-500',
      };
    case 'download':
      return {
        title: 'Already Purchased',
        icon: '📥',
        defaultMessage: 'You already own this download.',
        buttonText: 'Download Now',
        accentColor: 'bg-teal-500',
      };
    default:
      return {
        title: 'Already Owned',
        icon: '✓',
        defaultMessage: 'You already have access to this content.',
        buttonText: 'View Content',
        accentColor: 'bg-green-500',
      };
  }
}

/**
 * AlreadyEnrolledModal - A beautiful modal that informs users they already own a product
 * 
 * Used when users attempt to purchase something they already have access to.
 * Provides clear messaging and a path to the existing content.
 */
export function AlreadyEnrolledModal({
  isOpen,
  onClose,
  productType,
  productName,
  redirectUrl,
  message,
  showGoToButton = true,
  ctaText,
}: AlreadyEnrolledModalProps) {
  const router = useRouter();
  const config = getProductConfig(productType);
  
  const displayMessage = message || (productName 
    ? `You already have access to ${productName}.`
    : config.defaultMessage
  );
  
  const handleGoTo = () => {
    if (redirectUrl) {
      router.push(redirectUrl);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center sm:text-center border-b-0 pb-0">
          {/* Success Icon */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30">
            <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          
          <DialogTitle className="text-xl font-bold text-center">
            {config.icon} {config.title}
          </DialogTitle>
          
          <DialogDescription className="text-center mt-2 text-base">
            {displayMessage}
          </DialogDescription>
        </DialogHeader>

        {/* Info Box */}
        <div className="my-4 p-4 rounded-xl bg-gradient-to-br from-earth-50 to-earth-100 dark:from-[#1a1f28] dark:to-[#1f242d] border border-earth-200/50 dark:border-[#262b35]">
          <p className="text-sm text-earth-600 dark:text-[#b2b6c2] text-center">
            No need to purchase again — you can access your content anytime from your dashboard.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 order-2 sm:order-1"
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          
          {showGoToButton && redirectUrl && (
            <Button
              onClick={handleGoTo}
              className="flex-1 order-1 sm:order-2"
            >
              {ctaText || config.buttonText}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AlreadyEnrolledModal;

