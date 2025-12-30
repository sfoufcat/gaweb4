'use client';

import { useEffect, useCallback } from 'react';
import Image from 'next/image';
import { X, Users, Sparkles } from 'lucide-react';
import type { DecoyListing } from '@/types';
import { MARKETPLACE_CATEGORIES } from '@/types';

interface DecoyProgramModalProps {
  listing: DecoyListing | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateOwn: () => void;
}

/**
 * DecoyProgramModal
 * 
 * Beautiful modal that appears when a decoy program card is clicked.
 * Shows "program is full" message with options to go back or create your own.
 */
export function DecoyProgramModal({ listing, isOpen, onClose, onCreateOwn }: DecoyProgramModalProps) {
  // Close on escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !listing) return null;

  const categoryLabel = listing.categories[0] 
    ? MARKETPLACE_CATEGORIES.find(c => c.value === listing.categories[0])?.label 
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#171b22] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/20 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/30 dark:hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Hero Image */}
        <div className="relative h-48 sm:h-56">
          <Image
            src={listing.coverImageUrl}
            alt={listing.title}
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          
          {/* Category Badge */}
          {categoryLabel && (
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1.5 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-sm rounded-full text-xs font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
                {categoryLabel}
              </span>
            </div>
          )}
          
          {/* Coach Info - Bottom of image */}
          <div className="absolute bottom-4 left-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/30">
              <Image
                src={listing.coachAvatarUrl}
                alt={listing.coachName}
                width={44}
                height={44}
                className="object-cover"
                unoptimized
              />
            </div>
            <div>
              <p className="font-albert text-[15px] font-semibold text-white">
                {listing.coachName}
              </p>
              <p className="font-sans text-[12px] text-white/70">
                Program Creator
              </p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Title */}
          <h2 className="font-albert text-[24px] sm:text-[28px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px] leading-tight mb-3">
            {listing.title}
          </h2>
          
          {/* Description */}
          <p className="font-sans text-[14px] sm:text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-6">
            {listing.description}
          </p>
          
          {/* Full Notice */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-albert text-[17px] font-semibold text-red-700 dark:text-red-300 mb-1">
                  This program is currently full
                </h3>
                <p className="font-sans text-[13px] text-red-600/80 dark:text-red-400/70 leading-relaxed">
                  All spots for the current cohort have been filled. New spots open periodically.
                </p>
              </div>
            </div>
          </div>
          
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Create Your Own */}
            <button
              onClick={() => {
                onClose();
                onCreateOwn();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-xl font-albert text-[15px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#e8b923]/20"
            >
              <Sparkles className="w-4 h-4" />
              Create Your Own
            </button>
            
            {/* Go Back */}
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3.5 bg-[#f3f1ef] dark:bg-[#262b35] hover:bg-[#e1ddd8] dark:hover:bg-[#313746] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert text-[15px] font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

