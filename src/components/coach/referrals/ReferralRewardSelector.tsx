'use client';

import { useState, useEffect } from 'react';
import { Gift, Clock, BookOpen, Percent, DollarSign } from 'lucide-react';
import type { ReferralReward, ReferralRewardType, Program } from '@/types';

interface ReferralRewardSelectorProps {
  value: ReferralReward | undefined;
  onChange: (reward: ReferralReward | undefined) => void;
  organizationId?: string;
}

/**
 * ReferralRewardSelector Component
 * 
 * Allows coaches to configure rewards for successful referrals:
 * - Free time: Add free days to subscription/access
 * - Free program: Grant access to another program
 * - Discount code: Auto-generate a discount code
 */
export function ReferralRewardSelector({
  value,
  onChange,
  organizationId,
}: ReferralRewardSelectorProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  // Fetch programs for the free_program reward option
  useEffect(() => {
    const fetchPrograms = async () => {
      if (!organizationId) return;
      
      setLoadingPrograms(true);
      try {
        const response = await fetch('/api/coach/org-programs');
        if (response.ok) {
          const data = await response.json();
          setPrograms(data.programs || []);
        }
      } catch (err) {
        console.error('Failed to fetch programs:', err);
      } finally {
        setLoadingPrograms(false);
      }
    };

    fetchPrograms();
  }, [organizationId]);

  const handleRewardTypeChange = (type: ReferralRewardType | 'none') => {
    if (type === 'none') {
      onChange(undefined);
      return;
    }

    const baseReward: ReferralReward = { type };
    
    // Set defaults based on type
    switch (type) {
      case 'free_time':
        baseReward.freeDays = 14; // Default 2 weeks
        break;
      case 'free_program':
        baseReward.freeProgramId = programs[0]?.id;
        break;
      case 'discount_code':
        baseReward.discountType = 'percentage';
        baseReward.discountValue = 20; // Default 20%
        break;
    }

    onChange(baseReward);
  };

  const rewardType = value?.type || 'none';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Referral Reward (Optional)
        </label>
        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
          Incentivize referrals by offering a reward when a friend completes enrollment
        </p>

        {/* Reward Type Selection */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleRewardTypeChange('none')}
            className={`p-3 rounded-lg border text-left transition-all ${
              rewardType === 'none'
                ? 'border-[#a07855] bg-[#a07855]/10 dark:bg-[#a07855]/20'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855]/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Gift className={`w-4 h-4 ${rewardType === 'none' ? 'text-[#a07855]' : 'text-[#5f5a55]'}`} />
              <span className={`text-sm font-medium ${
                rewardType === 'none' 
                  ? 'text-[#a07855]' 
                  : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
              }`}>
                No Reward
              </span>
            </div>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Track referrals only
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleRewardTypeChange('free_time')}
            className={`p-3 rounded-lg border text-left transition-all ${
              rewardType === 'free_time'
                ? 'border-[#a07855] bg-[#a07855]/10 dark:bg-[#a07855]/20'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855]/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${rewardType === 'free_time' ? 'text-[#a07855]' : 'text-[#5f5a55]'}`} />
              <span className={`text-sm font-medium ${
                rewardType === 'free_time' 
                  ? 'text-[#a07855]' 
                  : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
              }`}>
                Free Time
              </span>
            </div>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Add free days to access
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleRewardTypeChange('free_program')}
            className={`p-3 rounded-lg border text-left transition-all ${
              rewardType === 'free_program'
                ? 'border-[#a07855] bg-[#a07855]/10 dark:bg-[#a07855]/20'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855]/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className={`w-4 h-4 ${rewardType === 'free_program' ? 'text-[#a07855]' : 'text-[#5f5a55]'}`} />
              <span className={`text-sm font-medium ${
                rewardType === 'free_program' 
                  ? 'text-[#a07855]' 
                  : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
              }`}>
                Free Program
              </span>
            </div>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Grant access to a program
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleRewardTypeChange('discount_code')}
            className={`p-3 rounded-lg border text-left transition-all ${
              rewardType === 'discount_code'
                ? 'border-[#a07855] bg-[#a07855]/10 dark:bg-[#a07855]/20'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855]/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Percent className={`w-4 h-4 ${rewardType === 'discount_code' ? 'text-[#a07855]' : 'text-[#5f5a55]'}`} />
              <span className={`text-sm font-medium ${
                rewardType === 'discount_code' 
                  ? 'text-[#a07855]' 
                  : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
              }`}>
                Discount Code
              </span>
            </div>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Auto-generate a discount
            </p>
          </button>
        </div>
      </div>

      {/* Reward Configuration */}
      {value && (
        <div className="mt-4 p-4 bg-[#f8f6f4] dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]">
          {value.type === 'free_time' && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                Number of Free Days
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={value.freeDays || 14}
                  onChange={(e) => onChange({ ...value, freeDays: parseInt(e.target.value) || 14 })}
                  className="w-24 px-3 py-2 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] text-sm"
                />
                <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">days</span>
              </div>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                The referrer will get {value.freeDays || 14} free days added to their subscription when their friend enrolls
              </p>
            </div>
          )}

          {value.type === 'free_program' && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                Program to Grant Access To
              </label>
              {loadingPrograms ? (
                <div className="text-sm text-[#5f5a55]">Loading programs...</div>
              ) : programs.length === 0 ? (
                <div className="text-sm text-[#5f5a55]">No programs available</div>
              ) : (
                <select
                  value={value.freeProgramId || ''}
                  onChange={(e) => onChange({ ...value, freeProgramId: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] text-sm"
                >
                  <option value="">Select a program...</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                The referrer will get free access to this program when their friend enrolls
              </p>
            </div>
          )}

          {value.type === 'discount_code' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  Discount Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, discountType: 'percentage' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      value.discountType === 'percentage'
                        ? 'border-[#a07855] bg-[#a07855]/10'
                        : 'border-[#e1ddd8] dark:border-[#262b35]'
                    }`}
                  >
                    <Percent className="w-4 h-4" />
                    <span className="text-sm">Percentage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, discountType: 'fixed' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      value.discountType === 'fixed'
                        ? 'border-[#a07855] bg-[#a07855]/10'
                        : 'border-[#e1ddd8] dark:border-[#262b35]'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Fixed Amount</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  Discount Value
                </label>
                <div className="flex items-center gap-2">
                  {value.discountType === 'fixed' && (
                    <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">$</span>
                  )}
                  <input
                    type="number"
                    min={1}
                    max={value.discountType === 'percentage' ? 100 : 10000}
                    value={value.discountType === 'fixed' 
                      ? ((value.discountValue || 0) / 100).toFixed(2)
                      : value.discountValue || 20
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onChange({
                        ...value,
                        discountValue: value.discountType === 'fixed' 
                          ? Math.round(val * 100) 
                          : Math.min(100, val),
                      });
                    }}
                    className="w-24 px-3 py-2 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] text-sm"
                  />
                  {value.discountType === 'percentage' && (
                    <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">%</span>
                  )}
                </div>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                  A unique discount code will be auto-generated for each successful referral
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}



