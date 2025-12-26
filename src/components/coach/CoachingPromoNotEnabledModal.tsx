'use client';

import { useRouter } from 'next/navigation';
import { X, Users, Sparkles, ArrowRight } from 'lucide-react';

interface CoachingPromoNotEnabledModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  
  /**
   * Callback to close the modal
   */
  onClose: () => void;
}

/**
 * CoachingPromoNotEnabledModal
 * 
 * Shown when a coach clicks on their coaching promo that hasn't been
 * linked to a 1:1 program yet. Explains how to enable it.
 */
export function CoachingPromoNotEnabledModal({
  isOpen,
  onClose,
}: CoachingPromoNotEnabledModalProps) {
  const router = useRouter();
  
  if (!isOpen) return null;

  const handleEnable = () => {
    onClose();
    // Navigate to coach dashboard programs tab
    router.push('/coach?tab=programs');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-text-secondary hover:text-text-primary dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="w-14 h-14 bg-[#a07855]/10 dark:bg-[#b8896a]/10 rounded-2xl flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-[#a07855] dark:text-[#b8896a]" />
          </div>

          <h2 className="font-albert text-[22px] font-bold text-text-primary dark:text-[#f5f5f8] mb-2">
            Set Up Your 1:1 Promo
          </h2>

          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-relaxed">
            You can add a promo for your 1:1 coaching support here. To enable it, 
            you'll need to create a 1:1 program first.
          </p>
        </div>

        {/* Info Card */}
        <div className="px-6 pb-4">
          <div className="bg-[#faf8f6] dark:bg-[#0a0c10] rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-[#a07855]/10 dark:bg-[#b8896a]/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
              </div>
              <div>
                <p className="font-sans text-[13px] font-medium text-text-primary dark:text-[#f5f5f8] mb-1">
                  What is a 1:1 Program?
                </p>
                <p className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2]">
                  A private coaching program for individual clients. Create one to promote 
                  your coaching services and let users sign up directly.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-2 flex flex-col gap-3">
          <button
            onClick={handleEnable}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-[#a07855] to-[#c9a07a] text-white font-sans font-semibold text-[15px] rounded-xl hover:shadow-lg transition-all"
          >
            <span>Create a 1:1 Program</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-full px-5 py-2.5 text-text-secondary dark:text-[#b2b6c2] font-sans font-medium text-[14px] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

