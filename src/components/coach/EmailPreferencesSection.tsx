'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { CoachEmailPreferences } from '@/types';

interface EmailTypeConfig {
  key: keyof CoachEmailPreferences;
  label: string;
  description: string;
  canDisable: boolean;
}

const EMAIL_TYPES: EmailTypeConfig[] = [
  {
    key: 'verificationEnabled',
    label: 'Verification Emails',
    description: 'Email verification codes for new signups',
    canDisable: false, // Always enabled
  },
  {
    key: 'welcomeEnabled',
    label: 'Welcome Emails',
    description: 'Sent after successful payment/signup',
    canDisable: true,
  },
  {
    key: 'abandonedCartEnabled',
    label: 'Abandoned Cart Emails',
    description: 'Reminder sent 15 minutes after starting signup without completing',
    canDisable: true,
  },
  {
    key: 'morningReminderEnabled',
    label: 'Morning Reminders',
    description: 'Daily morning check-in reminder notification',
    canDisable: true,
  },
  {
    key: 'eveningReminderEnabled',
    label: 'Evening Reminders',
    description: 'Daily evening reflection reminder notification',
    canDisable: true,
  },
  {
    key: 'weeklyReminderEnabled',
    label: 'Weekly Reminders',
    description: 'Weekend weekly reflection reminder notification',
    canDisable: true,
  },
  {
    key: 'paymentFailedEnabled',
    label: 'Payment Failed',
    description: 'Notification when subscription payment fails (coach only)',
    canDisable: false, // Always enabled
  },
];

const DEFAULT_PREFERENCES: CoachEmailPreferences = {
  verificationEnabled: true,
  welcomeEnabled: true,
  abandonedCartEnabled: true,
  morningReminderEnabled: true,
  eveningReminderEnabled: true,
  weeklyReminderEnabled: true,
  paymentFailedEnabled: true,
};

/**
 * EmailPreferencesSection - Allow coach to manage email notification settings
 * 
 * Shows all email types with toggles for those that can be disabled.
 * Verification and Payment Failed emails are always enabled.
 */
export function EmailPreferencesSection() {
  const { colors } = useBrandingValues();
  const accentColor = colors.accentLight || 'var(--brand-accent-light)';

  const [preferences, setPreferences] = useState<CoachEmailPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof CoachEmailPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<keyof CoachEmailPreferences | null>(null);

  // Fetch current preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/coach/email-preferences');
        if (response.ok) {
          const data = await response.json();
          setPreferences({ ...DEFAULT_PREFERENCES, ...data.emailPreferences });
        }
      } catch {
        console.error('Failed to fetch email preferences');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  // Handle toggle
  const handleToggle = useCallback(async (key: keyof CoachEmailPreferences) => {
    const emailType = EMAIL_TYPES.find(t => t.key === key);
    if (!emailType?.canDisable) return;

    const newValue = !preferences[key];
    const previousValue = preferences[key];
    
    // Optimistic update
    setPreferences(prev => ({ ...prev, [key]: newValue }));
    setSavingKey(key);
    setError(null);
    setSuccessKey(null);

    try {
      const response = await fetch('/api/coach/email-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      // Show success briefly
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(null), 2000);
    } catch (err) {
      // Revert on error
      setPreferences(prev => ({ ...prev, [key]: previousValue }));
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setSavingKey(null);
    }
  }, [preferences]);

  if (isLoading) {
    return (
      <div className="p-6 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
        <div className="flex items-center gap-3 mb-4">
          <Mail className="w-5 h-5 text-[#8a857f]" />
          <div className="w-40 h-5 bg-[#e8e4df] dark:bg-[#262b35] rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-[#f5f3f0] dark:bg-[#1a1f2a] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Mail className="w-5 h-5" style={{ color: accentColor }} />
        <h3 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6]">
          Email Notifications
        </h3>
      </div>
      <p className="text-[13px] text-[#8a857f] mb-5">
        Control which automated emails are sent to your members. Emails will be branded with your business name.
      </p>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Email types list */}
      <div className="space-y-3">
        {EMAIL_TYPES.map((emailType) => {
          const isEnabled = preferences[emailType.key];
          const isSaving = savingKey === emailType.key;
          const showSuccess = successKey === emailType.key;

          return (
            <div
              key={emailType.key}
              className={`p-4 rounded-lg border transition-colors ${
                isEnabled
                  ? 'bg-[#f9f8f6] dark:bg-[#1a1f2a] border-[#e8e4df] dark:border-[#262b35]'
                  : 'bg-[#fafafa] dark:bg-[#0d1017] border-[#ececec] dark:border-[#1e232d]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium text-[14px] ${
                      isEnabled
                        ? 'text-[#1a1a1a] dark:text-[#faf8f6]'
                        : 'text-[#8a857f] dark:text-[#6b7280]'
                    }`}>
                      {emailType.label}
                    </h4>
                    {!emailType.canDisable && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#e8e4df] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#9ca3af]">
                        Always On
                      </span>
                    )}
                    {showSuccess && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <p className={`text-[12px] mt-0.5 ${
                    isEnabled
                      ? 'text-[#5f5a55] dark:text-[#9ca3af]'
                      : 'text-[#a8a39d] dark:text-[#4b5563]'
                  }`}>
                    {emailType.description}
                  </p>
                </div>

                {/* Toggle switch */}
                {emailType.canDisable ? (
                  <button
                    onClick={() => handleToggle(emailType.key)}
                    disabled={isSaving}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                      isEnabled ? '' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
                    } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={isEnabled ? { backgroundColor: accentColor } : undefined}
                    role="switch"
                    aria-checked={isEnabled as boolean}
                    aria-label={`Toggle ${emailType.label}`}
                  >
                    {isSaving ? (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      </span>
                    ) : (
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          isEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    )}
                  </button>
                ) : (
                  <div
                    className="w-11 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: accentColor, opacity: 0.6 }}
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <p className="mt-5 text-[12px] text-[#a8a39d] dark:text-[#6b7280]">
        Note: All emails will display your business name and branding. If you have email whitelabeling enabled, 
        emails will be sent from your custom domain.
      </p>
    </div>
  );
}

