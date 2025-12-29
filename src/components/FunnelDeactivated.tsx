'use client';

import { PauseCircle, ArrowLeft } from 'lucide-react';

interface FunnelDeactivatedProps {
  /** Coach/organization name to display */
  coachName?: string;
  /** Platform/app name */
  platformName?: string;
}

/**
 * FunnelDeactivated Component
 * 
 * Shown to public visitors when they try to access a funnel/join page
 * for an organization whose subscription is inactive.
 * 
 * Design goals:
 * - Non-alarming, friendly message
 * - Does NOT expose billing/payment details
 * - Minimal branding (just coach name if available)
 * - Provides a way to check back later
 */
export function FunnelDeactivated({ coachName, platformName }: FunnelDeactivatedProps) {
  const displayName = coachName || platformName || 'This coach';
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#faf8f6] to-[#f5f2ef] dark:from-[#05070b] dark:to-[#0a0d12] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <PauseCircle className="w-10 h-10 text-amber-500 dark:text-amber-400" strokeWidth={1.5} />
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Program Currently Unavailable
        </h1>
        
        {/* Description */}
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
          {displayName}&apos;s platform is temporarily unavailable.
        </p>
        
        <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-8">
          Please check back later or contact the coach directly for more information.
        </p>
        
        {/* Actions */}
        <div className="space-y-3">
          {/* Go back / home */}
          <a
            href="https://growthaddicts.com"
            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-medium rounded-xl transition-colors font-albert"
          >
            <ArrowLeft className="w-5 h-5" />
            Go to Growth Addicts
          </a>
          
          {/* Reload to check again */}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 w-full px-6 py-3 border border-[#e1ddd8] dark:border-[#262b35] hover:bg-white dark:hover:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium rounded-xl transition-colors font-albert"
          >
            Check Again
          </button>
        </div>
        
        {/* Help text */}
        <p className="mt-8 text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
          If you believe this is an error, please contact the coach.
        </p>
      </div>
    </div>
  );
}

export default FunnelDeactivated;

