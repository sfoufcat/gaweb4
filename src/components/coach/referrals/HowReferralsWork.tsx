'use client';

import { HelpCircle, Users, Share2, Gift, CheckCircle2 } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/collapsible-section';

interface HowReferralsWorkProps {
  defaultOpen?: boolean;
}

/**
 * HowReferralsWork Component
 *
 * Collapsible explainer section that explains how the referral system works.
 * Helps coaches understand the flow and confidently promote the feature.
 */
export function HowReferralsWork({ defaultOpen = false }: HowReferralsWorkProps) {
  return (
    <CollapsibleSection
      title="How Referrals Work"
      icon={HelpCircle}
      description="Learn how to grow your programs through referrals"
      defaultOpen={defaultOpen}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Who can share */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Who can share?
            </h4>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
              Your existing members get a unique referral link to share with friends and family
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
            <Share2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              How does it work?
            </h4>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
              Friend clicks the link, goes through your signup funnel, and joins your program
            </p>
          </div>
        </div>

        {/* Rewards */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <Gift className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              What rewards can you offer?
            </h4>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
              Optional: free product access, discount codes, or cash rewards for successful referrals
            </p>
          </div>
        </div>

        {/* When triggered */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              When are rewards triggered?
            </h4>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
              Rewards are granted automatically when the referred friend completes enrollment
            </p>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
