'use client';

import { useState } from 'react';
import { Copy, Check, Share2, Settings2, Gift, Clock, Percent, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Program, ReferralConfig } from '@/types';

interface ReferralProgramCardProps {
  program: Program;
  /** Called when user clicks "Enable Referrals" */
  onEnableClick?: (programId: string) => void;
  /** Called when user clicks "Edit" on an enabled program */
  onEditClick?: (programId: string) => void;
}

/**
 * ReferralProgramCard Component
 *
 * Card showing a program with its referral status and quick actions.
 * - If referrals enabled: Copy Link, Share, Edit
 * - If not enabled: Enable Referrals button
 */
export function ReferralProgramCard({
  program,
  onEnableClick,
  onEditClick,
}: ReferralProgramCardProps) {
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [referralLink, setReferralLink] = useState<string | null>(null);

  const config = program.referralConfig as ReferralConfig | undefined;
  const isEnabled = config?.enabled;

  const getRewardBadge = () => {
    if (!config?.reward) return null;

    switch (config.reward.type) {
      case 'free_time':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <Clock className="w-3 h-3" />
            {config.reward.freeDays} days free
          </span>
        );
      case 'free_program':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <BookOpen className="w-3 h-3" />
            Free program
          </span>
        );
      case 'discount_code':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <Percent className="w-3 h-3" />
            {config.reward.discountType === 'percentage'
              ? `${config.reward.discountValue}% off`
              : `$${((config.reward.discountValue || 0) / 100).toFixed(0)} off`}
          </span>
        );
      default:
        return null;
    }
  };

  const handleCopyLink = async () => {
    // Generate link if we don't have it yet
    if (!referralLink) {
      setGeneratingLink(true);
      try {
        const response = await fetch('/api/referral/generate-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetType: 'program',
            targetId: program.id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setReferralLink(data.referralUrl);
          await navigator.clipboard.writeText(data.referralUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (err) {
        console.error('Failed to generate/copy link:', err);
      } finally {
        setGeneratingLink(false);
      }
    } else {
      try {
        await navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleShare = async () => {
    // Generate link if we don't have it yet
    let linkToShare = referralLink;

    if (!linkToShare) {
      setGeneratingLink(true);
      try {
        const response = await fetch('/api/referral/generate-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetType: 'program',
            targetId: program.id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          linkToShare = data.referralUrl;
          setReferralLink(data.referralUrl);
        }
      } catch (err) {
        console.error('Failed to generate link:', err);
        return;
      } finally {
        setGeneratingLink(false);
      }
    }

    if (linkToShare && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${program.name}`,
          text: `Check out ${program.name}!`,
          url: linkToShare,
        });
      } catch (err) {
        // User cancelled or share failed
        console.error('Share failed:', err);
      }
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
              {program.name}
            </h3>
            {isEnabled ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <Gift className="w-3 h-3" />
                Referrals enabled
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]">
                Not configured
              </span>
            )}
          </div>

          {program.type && (
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert capitalize mt-0.5">
              {program.type.replace('_', ' ')}
            </p>
          )}

          {/* Reward badge */}
          {isEnabled && config?.reward && (
            <div className="mt-2">{getRewardBadge()}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isEnabled ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                disabled={generatingLink}
                className="h-8 px-3"
              >
                {generatingLink ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy Link
                  </>
                )}
              </Button>

              {canShare && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleShare}
                  disabled={generatingLink}
                  className="h-8 w-8 p-0"
                  title="Share"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEditClick?.(program.id)}
                className="h-8 w-8 p-0"
                title="Edit settings"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => onEnableClick?.(program.id)}
              className="h-8 bg-brand-accent hover:bg-brand-accent/90 text-white"
            >
              Create Referral
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
