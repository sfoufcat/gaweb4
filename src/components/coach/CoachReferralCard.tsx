'use client';

import { useState, useEffect } from 'react';
import { 
  Gift, 
  Copy, 
  Check, 
  Users, 
  Trophy,
  Loader2,
  Share2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  totalRewardsEarned: number;
}

interface ReferralData {
  code: string;
  referralUrl: string;
  stats: ReferralStats;
}

/**
 * CoachReferralCard
 * 
 * Displays the coach's referral code and stats.
 * Can be placed in the coach dashboard or settings.
 */
export function CoachReferralCard() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);

  useEffect(() => {
    fetchReferralCode();
  }, []);

  const fetchReferralCode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/coach/my-referral-code');
      
      if (!response.ok) {
        throw new Error('Failed to get referral code');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching referral code:', err);
      setError(err instanceof Error ? err.message : 'Failed to load referral code');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareReferral = async () => {
    if (!data) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join GrowthAddicts',
          text: 'Build your coaching platform with GrowthAddicts. Use my referral code to get 1 month free!',
          url: data.referralUrl,
        });
      } catch (err) {
        // User cancelled or share failed, fall back to copy
        copyToClipboard(data.referralUrl, 'url');
      }
    } else {
      copyToClipboard(data.referralUrl, 'url');
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1a1e26] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-[#1a1e26] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-6">
        <div className="text-center py-4">
          <p className="text-red-500 dark:text-red-400 font-sans text-sm">{error}</p>
          <Button 
            onClick={fetchReferralCode}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white dark:bg-[#1a1e26] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 px-6 py-4 border-b border-amber-200/50 dark:border-amber-800/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Gift className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-albert font-semibold text-[16px] text-[#1a1a1a] dark:text-[#f5f5f8]">
              Refer Coaches, Earn Rewards
            </h3>
            <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
              Both you and your referral get 1 month free
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Referral Code */}
        <div>
          <label className="font-albert text-[12px] font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide mb-2 block">
            Your Referral Code
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl px-4 py-3 font-mono text-[18px] font-bold text-brand-accent tracking-wider text-center">
              {data.code}
            </div>
            <Button
              onClick={() => copyToClipboard(data.code, 'code')}
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-xl"
            >
              {copied === 'code' ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Referral Link */}
        <div>
          <label className="font-albert text-[12px] font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide mb-2 block">
            Your Referral Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl px-4 py-3 font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] truncate">
              {data.referralUrl}
            </div>
            <Button
              onClick={() => copyToClipboard(data.referralUrl, 'url')}
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-xl"
            >
              {copied === 'url' ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Share Button */}
        <Button
          onClick={shareReferral}
          className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl py-3 font-albert font-semibold"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share Referral Link
        </Button>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="text-center p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
            <div className="flex items-center justify-center mb-1">
              <Users className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </div>
            <div className="font-albert font-bold text-[20px] text-[#1a1a1a] dark:text-[#f5f5f8]">
              {data.stats.totalReferrals}
            </div>
            <div className="font-sans text-[11px] text-[#8a8580] dark:text-[#6b7280]">
              Referrals
            </div>
          </div>
          
          <div className="text-center p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
            <div className="flex items-center justify-center mb-1">
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div className="font-albert font-bold text-[20px] text-[#1a1a1a] dark:text-[#f5f5f8]">
              {data.stats.successfulReferrals}
            </div>
            <div className="font-sans text-[11px] text-[#8a8580] dark:text-[#6b7280]">
              Converted
            </div>
          </div>
          
          <div className="text-center p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
            <div className="flex items-center justify-center mb-1">
              <Gift className="w-4 h-4 text-green-500" />
            </div>
            <div className="font-albert font-bold text-[20px] text-[#1a1a1a] dark:text-[#f5f5f8]">
              {data.stats.totalRewardsEarned}
            </div>
            <div className="font-sans text-[11px] text-[#8a8580] dark:text-[#6b7280]">
              Months Earned
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

