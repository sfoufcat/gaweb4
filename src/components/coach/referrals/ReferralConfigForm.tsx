'use client';

import { useState, useEffect } from 'react';
import { Users, ChevronDown, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { ReferralRewardSelector } from './ReferralRewardSelector';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type { ReferralConfig, Funnel, ReferralReward } from '@/types';

interface ReferralConfigFormProps {
  targetType: 'program' | 'squad';
  targetId: string;
  targetName: string;
  initialConfig?: ReferralConfig | null;
  organizationId?: string;
  onSave: (config: ReferralConfig | null) => Promise<void>;
  onCancel?: () => void;
}

/**
 * ReferralConfigForm Component
 * 
 * Form for coaches to configure referral settings for a program or squad.
 * Includes:
 * - Toggle to enable/disable referrals
 * - Funnel selection dropdown
 * - Reward configuration
 */
export function ReferralConfigForm({
  targetType,
  targetId,
  targetName,
  initialConfig,
  organizationId,
  onSave,
  onCancel,
}: ReferralConfigFormProps) {
  const [enabled, setEnabled] = useState(initialConfig?.enabled || false);
  const [funnelId, setFunnelId] = useState(initialConfig?.funnelId || '');
  const [reward, setReward] = useState<ReferralReward | undefined>(initialConfig?.reward);
  
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loadingFunnels, setLoadingFunnels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch funnels for this target
  useEffect(() => {
    const fetchFunnels = async () => {
      setLoadingFunnels(true);
      try {
        const response = await fetch('/api/coach/org-funnels');
        if (response.ok) {
          const data = await response.json();
          // Filter funnels that target this program/squad
          const targetFunnels = (data.funnels || []).filter((f: Funnel) => {
            if (targetType === 'program') {
              return f.programId === targetId;
            } else {
              return f.squadId === targetId;
            }
          });
          setFunnels(targetFunnels);
        }
      } catch (err) {
        console.error('Failed to fetch funnels:', err);
      } finally {
        setLoadingFunnels(false);
      }
    };

    fetchFunnels();
  }, [targetType, targetId]);

  const handleSave = async () => {
    setError(null);
    
    if (enabled && !funnelId) {
      setError('Please select a funnel for referrals');
      return;
    }

    setSaving(true);
    try {
      // Always save a config object - use { enabled: false } when disabled
      // This allows us to distinguish "explicitly disabled" from "never configured"
      const config: ReferralConfig = enabled
        ? {
            enabled: true,
            funnelId,
            reward,
          }
        : {
            enabled: false,
            funnelId: '', // Empty but required by type
          };

      await onSave(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const targetLabel = targetType === 'program' ? 'program' : 'squad';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
        <div className="w-10 h-10 rounded-full bg-[#a07855]/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
        </div>
        <div>
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Referral Settings
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Configure referrals for {targetName}
          </p>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Enable Referrals
          </label>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Allow users to invite friends to this {targetLabel}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      {enabled && (
        <>
          {/* Funnel Selection */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              Referral Funnel *
            </label>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
              Select the funnel that referred users will go through
            </p>

            {loadingFunnels ? (
              <div className="flex items-center gap-2 text-sm text-[#5f5a55]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading funnels...
              </div>
            ) : funnels.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      No funnels available
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Create a funnel for this {targetLabel} first, then configure referrals.
                    </p>
                    <a
                      href="/coach?tab=funnels"
                      className="inline-flex items-center gap-1 text-xs text-[#a07855] dark:text-[#b8896a] hover:underline mt-2"
                    >
                      Go to Funnels
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={funnelId}
                  onChange={(e) => setFunnelId(e.target.value)}
                  className="w-full appearance-none px-4 py-3 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] text-sm pr-10 cursor-pointer"
                >
                  <option value="">Select a funnel...</option>
                  {funnels.map((funnel) => (
                    <option key={funnel.id} value={funnel.id}>
                      {funnel.name} {funnel.isDefault && '(Default)'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] pointer-events-none" />
              </div>
            )}
          </div>

          {/* Reward Configuration */}
          <ReferralRewardSelector
            value={reward}
            onChange={setReward}
            organizationId={organizationId}
          />
        </>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || (enabled && funnels.length === 0)}
          className="flex-1 bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  );
}


