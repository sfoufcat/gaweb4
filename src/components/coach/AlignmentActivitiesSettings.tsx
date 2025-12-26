'use client';

import { useState, useCallback, useEffect } from 'react';
import { Compass, Check, ChevronDown } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import type { AlignmentActivityKey, CompletionThreshold, AlignmentActivityConfig } from '@/types';
import { DEFAULT_ALIGNMENT_CONFIG } from '@/types';

// Activity display configuration
const ACTIVITY_CONFIG: Record<AlignmentActivityKey, { 
  label: string; 
  description: string;
  hasThreshold?: boolean;
  thresholdType?: 'task' | 'habit';
}> = {
  morning_checkin: {
    label: 'Morning check-in',
    description: 'Complete the daily confidence check-in',
  },
  evening_checkin: {
    label: 'Evening check-in',
    description: 'Reflect on the day and close it out',
  },
  set_tasks: {
    label: 'Set today\'s tasks',
    description: 'Add at least one task to daily focus',
  },
  complete_tasks: {
    label: 'Complete tasks',
    description: 'Complete daily focus tasks',
    hasThreshold: true,
    thresholdType: 'task',
  },
  chat_with_squad: {
    label: 'Chat with your squad',
    description: 'Send a message in the squad chat',
  },
  active_goal: {
    label: 'Have an active goal',
    description: 'Maintain an active goal in progress',
  },
  complete_habits: {
    label: 'Complete habits',
    description: 'Complete daily habits',
    hasThreshold: true,
    thresholdType: 'habit',
  },
};

// Threshold display labels
const THRESHOLD_LABELS: Record<CompletionThreshold, string> = {
  at_least_one: 'at least one',
  half: '50%',
  all: 'all',
};

// Order of activities in UI
const ACTIVITY_ORDER: AlignmentActivityKey[] = [
  'morning_checkin',
  'evening_checkin',
  'set_tasks',
  'complete_tasks',
  'chat_with_squad',
  'active_goal',
  'complete_habits',
];

/**
 * AlignmentActivitiesSettings - Allow coach to configure alignment score activities
 * 
 * Coaches can select which activities count toward their members' alignment scores.
 * Activities are evenly weighted based on how many are selected.
 */
export function AlignmentActivitiesSettings() {
  const { colors, isDefault } = useBrandingValues();
  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  const [config, setConfig] = useState<AlignmentActivityConfig>(DEFAULT_ALIGNMENT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'task' | 'habit' | null>(null);

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/org/settings');
        if (response.ok) {
          const data = await response.json();
          if (data.settings?.alignmentConfig) {
            setConfig(data.settings.alignmentConfig);
          }
        }
      } catch {
        console.error('Failed to fetch org settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    if (openDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdown]);

  // Save config to server
  const saveConfig = useCallback(async (newConfig: AlignmentActivityConfig) => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alignmentConfig: newConfig }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccessMessage('Saved');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Toggle an activity
  const toggleActivity = useCallback((activity: AlignmentActivityKey) => {
    const isEnabled = config.enabledActivities.includes(activity);
    
    // Don't allow disabling if it's the last enabled activity
    if (isEnabled && config.enabledActivities.length === 1) {
      setError('At least one activity must be enabled');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const newActivities = isEnabled
      ? config.enabledActivities.filter(a => a !== activity)
      : [...config.enabledActivities, activity];

    const newConfig = { ...config, enabledActivities: newActivities };
    setConfig(newConfig);
    saveConfig(newConfig);
  }, [config, saveConfig]);

  // Update threshold
  const updateThreshold = useCallback((type: 'task' | 'habit', threshold: CompletionThreshold) => {
    const newConfig = {
      ...config,
      [type === 'task' ? 'taskCompletionThreshold' : 'habitCompletionThreshold']: threshold,
    };
    setConfig(newConfig);
    setOpenDropdown(null);
    saveConfig(newConfig);
  }, [config, saveConfig]);

  // Calculate weight per activity
  const weightPerActivity = config.enabledActivities.length > 0
    ? Math.round(100 / config.enabledActivities.length * 10) / 10
    : 0;

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-[#f5f3f0] dark:bg-[#1a1f2a] animate-pulse">
        <div className="w-48 h-4 bg-[#e8e4df] dark:bg-[#262b35] rounded mb-3" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-full h-8 bg-[#e8e4df] dark:bg-[#262b35] rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4" style={{ color: accentColor }} />
            <h3 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
              Alignment Score Activities
            </h3>
            {successMessage && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {successMessage}
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#8a857f] mt-0.5">
            Choose which activities count toward your members&apos; daily alignment score
          </p>
        </div>
      </div>

      {/* Activities List */}
      <div className="space-y-1">
        {ACTIVITY_ORDER.map((activityKey) => {
          const activity = ACTIVITY_CONFIG[activityKey];
          const isEnabled = config.enabledActivities.includes(activityKey);
          const threshold = activity.thresholdType === 'task' 
            ? config.taskCompletionThreshold 
            : config.habitCompletionThreshold;

          return (
            <div
              key={activityKey}
              className={`
                flex items-center gap-3 p-3 rounded-lg transition-colors
                ${isEnabled 
                  ? 'bg-[#f9f7f5] dark:bg-[#1a1f2a]' 
                  : 'bg-transparent hover:bg-[#f9f7f5] dark:hover:bg-[#1a1f2a]/50'
                }
              `}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleActivity(activityKey)}
                disabled={isSaving}
                className={`
                  w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all
                  ${isEnabled
                    ? 'border-2'
                    : 'border-2 border-[#d1cdc8] dark:border-[#3d414d] bg-white dark:bg-[#171b22]'
                  }
                  ${isSaving ? 'opacity-50' : ''}
                `}
                style={isEnabled ? { 
                  backgroundColor: accentColor,
                  borderColor: accentColor,
                } : undefined}
              >
                {isEnabled && <Check className="w-3 h-3 text-white" />}
              </button>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`
                    text-[14px] font-medium
                    ${isEnabled 
                      ? 'text-[#1a1a1a] dark:text-[#faf8f6]' 
                      : 'text-[#8a857f] dark:text-[#7d8190]'
                    }
                  `}>
                    {activity.hasThreshold ? (
                      <>
                        Complete{' '}
                        <span className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isEnabled) {
                                setOpenDropdown(
                                  openDropdown === activity.thresholdType 
                                    ? null 
                                    : activity.thresholdType!
                                );
                              }
                            }}
                            disabled={!isEnabled || isSaving}
                            className={`
                              inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[13px] font-medium
                              ${isEnabled 
                                ? 'bg-[#e8e4df] dark:bg-[#262b35] hover:bg-[#ddd9d4] dark:hover:bg-[#313746]' 
                                : 'bg-[#f0ede9] dark:bg-[#1d222b] cursor-not-allowed'
                              }
                              transition-colors
                            `}
                          >
                            {THRESHOLD_LABELS[threshold || 'at_least_one']}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          
                          {/* Dropdown */}
                          {openDropdown === activity.thresholdType && (
                            <div 
                              className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-[#1d222b] border border-[#e8e4df] dark:border-[#262b35] rounded-lg shadow-lg z-10 overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(['at_least_one', 'half', 'all'] as CompletionThreshold[]).map((t) => (
                                <button
                                  key={t}
                                  onClick={() => updateThreshold(activity.thresholdType!, t)}
                                  className={`
                                    w-full px-3 py-2 text-left text-[13px] transition-colors
                                    ${threshold === t 
                                      ? 'bg-[#f5f3f0] dark:bg-[#262b35] font-medium' 
                                      : 'hover:bg-[#f9f7f5] dark:hover:bg-[#262b35]/50'
                                    }
                                    text-[#1a1a1a] dark:text-[#faf8f6]
                                  `}
                                >
                                  {THRESHOLD_LABELS[t]}
                                </button>
                              ))}
                            </div>
                          )}
                        </span>
                        {' '}{activity.thresholdType === 'task' ? 'tasks' : 'habits'}
                      </>
                    ) : (
                      activity.label
                    )}
                  </span>
                </div>
                <p className={`
                  text-[12px] mt-0.5
                  ${isEnabled 
                    ? 'text-[#8a857f] dark:text-[#7d8190]' 
                    : 'text-[#b5b0ab] dark:text-[#5c6170]'
                  }
                `}>
                  {activity.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
        <p className="text-[13px] text-[#8a857f]">
          Each selected activity is worth{' '}
          <span 
            className="font-semibold"
            style={{ color: accentColor }}
          >
            {weightPerActivity}%
          </span>
          {' '}of the alignment score
        </p>
        <p className="text-[12px] text-[#a7a39e] mt-1">
          {config.enabledActivities.length} of {ACTIVITY_ORDER.length} activities selected
        </p>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-3 text-[13px] text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

