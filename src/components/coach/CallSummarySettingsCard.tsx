'use client';

import { useState, useEffect } from 'react';
import {
  Phone,
  Sparkles,
  Settings,
  Loader2,
  AlertCircle,
  ShoppingCart,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditPurchaseModal } from './CreditPurchaseModal';
import type { SummarySettings, SummaryCredits } from '@/types';

interface CallSummarySettingsCardProps {
  onSettingsChange?: () => void;
}

interface CreditsData {
  credits: {
    planAllocated: number;
    planUsed: number;
    planRemaining: number;
    purchasedRemaining: number;
    totalRemaining: number;
    periodStart: string | null;
    periodEnd: string | null;
  };
  availablePacks: Array<{
    size: number;
    name: string;
    credits: number;
    priceInCents: number;
    priceFormatted: string;
  }>;
}

/**
 * CallSummarySettingsCard
 *
 * Displays AI call summary settings including:
 * - Credit usage and remaining balance
 * - Auto-generate toggle
 * - Task generation mode
 * - Purchase more credits
 */
export function CallSummarySettingsCard({ onSettingsChange }: CallSummarySettingsCardProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null);
  const [settings, setSettings] = useState<SummarySettings>({
    autoGenerate: true,
    taskGenerationMode: 'approve',
  });
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch credits info
      const creditsResponse = await fetch('/api/coach/credits/purchase');
      if (creditsResponse.ok) {
        const data = await creditsResponse.json();
        setCreditsData(data);
      }

      // Fetch org settings for summary preferences
      const settingsResponse = await fetch('/api/org/settings');
      if (settingsResponse.ok) {
        const data = await settingsResponse.json();
        if (data.summarySettings) {
          setSettings(data.summarySettings);
        }
      }
    } catch (err) {
      console.error('Error fetching summary settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoGenerate = async () => {
    try {
      setSaving(true);
      const newSettings = { ...settings, autoGenerate: !settings.autoGenerate };

      const response = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summarySettings: newSettings }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      setSettings(newSettings);
      onSettingsChange?.();
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTaskModeChange = async (mode: 'auto' | 'approve' | 'disabled') => {
    try {
      setSaving(true);
      const newSettings = { ...settings, taskGenerationMode: mode };

      const response = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summarySettings: newSettings }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      setSettings(newSettings);
      onSettingsChange?.();
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#171b22] rounded-xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const credits = creditsData?.credits;
  const usagePercent = credits
    ? Math.round((credits.planUsed / Math.max(credits.planAllocated, 1)) * 100)
    : 0;
  const isLowCredits = credits && credits.totalRemaining <= 3;

  return (
    <>
      <div className="bg-white dark:bg-[#171b22] rounded-xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary dark:text-[#f5f5f8]">
                AI Call Summaries
              </h3>
              <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
                Automatic transcription and insights
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Credits Usage */}
        {credits && (
          <div className="mb-6 p-4 bg-[#faf8f6] dark:bg-[#1e222a] rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-text-secondary" />
                <span className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
                  Call Credits
                </span>
              </div>
              <span className="text-sm text-text-secondary dark:text-[#b2b6c2]">
                {credits.totalRemaining} remaining
              </span>
            </div>

            {/* Plan credits progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Plan credits</span>
                <span>{credits.planUsed} / {credits.planAllocated} used</span>
              </div>
              <Progress value={usagePercent} className="h-2" />
            </div>

            {/* Purchased credits */}
            {credits.purchasedRemaining > 0 && (
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-text-secondary">+ Purchased credits</span>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {credits.purchasedRemaining} available
                </span>
              </div>
            )}

            {/* Low credits warning */}
            {isLowCredits && (
              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  Running low on credits
                </span>
              </div>
            )}

            {/* Buy more button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => setShowPurchaseModal(true)}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Buy More Credits
            </Button>
          </div>
        )}

        {/* Settings */}
        <div className="space-y-4">
          {/* Auto-generate toggle */}
          <div className="flex items-center justify-between p-4 bg-[#faf8f6] dark:bg-[#1e222a] rounded-xl">
            <div>
              <p className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
                Auto-generate summaries
              </p>
              <p className="text-xs text-text-secondary dark:text-[#b2b6c2] mt-0.5">
                Automatically create AI summaries after calls
              </p>
            </div>
            <button
              onClick={handleToggleAutoGenerate}
              disabled={saving}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.autoGenerate
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings.autoGenerate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Task generation mode */}
          <div className="p-4 bg-[#faf8f6] dark:bg-[#1e222a] rounded-xl">
            <p className="text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
              Task extraction
            </p>
            <Select
              value={settings.taskGenerationMode}
              onValueChange={(v) => handleTaskModeChange(v as 'auto' | 'approve' | 'disabled')}
              disabled={saving}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approve">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    <span>Review before adding</span>
                  </div>
                </SelectItem>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Auto-add to backlog</span>
                  </div>
                </SelectItem>
                <SelectItem value="disabled">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Disabled</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-text-secondary dark:text-[#b2b6c2] mt-2">
              {settings.taskGenerationMode === 'approve' &&
                'AI-extracted tasks will appear for your review before being added'}
              {settings.taskGenerationMode === 'auto' &&
                'Tasks will be automatically added to client backlogs'}
              {settings.taskGenerationMode === 'disabled' &&
                'No tasks will be extracted from call summaries'}
            </p>
          </div>
        </div>
      </div>

      {/* Purchase Modal */}
      <CreditPurchaseModal
        open={showPurchaseModal}
        onOpenChange={setShowPurchaseModal}
      />
    </>
  );
}
