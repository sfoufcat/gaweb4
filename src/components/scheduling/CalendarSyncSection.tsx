'use client';

import { useState } from 'react';
import {
  Calendar,
  Link2,
  Unlink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useNylasGrant } from '@/hooks/useNylasGrant';

// Google Calendar icon as inline SVG
function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#fff" stroke="#4285F4" strokeWidth="1.5"/>
      <path d="M3 8h18" stroke="#4285F4" strokeWidth="1.5"/>
      <path d="M8 3v5" stroke="#4285F4" strokeWidth="1.5"/>
      <path d="M16 3v5" stroke="#4285F4" strokeWidth="1.5"/>
      <rect x="6" y="11" width="3" height="3" rx="0.5" fill="#EA4335"/>
      <rect x="10.5" y="11" width="3" height="3" rx="0.5" fill="#FBBC04"/>
      <rect x="15" y="11" width="3" height="3" rx="0.5" fill="#34A853"/>
      <rect x="6" y="15.5" width="3" height="3" rx="0.5" fill="#4285F4"/>
      <rect x="10.5" y="15.5" width="3" height="3" rx="0.5" fill="#EA4335"/>
    </svg>
  );
}

// Microsoft Outlook icon as inline SVG
function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#0078D4"/>
      <ellipse cx="8" cy="12" rx="4" ry="5" fill="#fff"/>
      <ellipse cx="8" cy="12" rx="2.5" ry="3.5" fill="#0078D4"/>
      <path d="M14 8h6v8h-6z" fill="#fff" fillOpacity="0.3"/>
      <path d="M14 8l3 4-3 4" stroke="#fff" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

interface CalendarSyncSectionProps {
  /** Called when sync settings change */
  onSettingsChange?: () => void;
}

/**
 * CalendarSyncSection
 *
 * UI for connecting/disconnecting external calendar via Nylas.
 * Shows connection status, sync settings, and allows OAuth connection.
 */
export function CalendarSyncSection({ onSettingsChange }: CalendarSyncSectionProps) {
  const {
    grant,
    syncSettings,
    isLoading,
    error,
    isConfigured,
    connect,
    disconnect,
    updateSyncSettings,
    refetch,
  } = useNylasGrant();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleConnect = async (provider: 'google' | 'microsoft') => {
    try {
      setIsConnecting(true);
      setLocalError(null);
      // Nylas will determine the provider based on the OAuth flow
      // The loginHint can be used to pre-fill email
      await connect();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to connect calendar');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      setLocalError(null);
      await disconnect();
      onSettingsChange?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to disconnect calendar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleToggleSetting = async (setting: 'syncExternalBusy' | 'pushEventsToCalendar') => {
    if (!syncSettings) return;

    try {
      setIsSavingSettings(true);
      setLocalError(null);
      await updateSyncSettings({
        [setting]: !syncSettings[setting],
      });
      onSettingsChange?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Not configured state (Nylas not set up on backend)
  if (!isConfigured) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                Calendar Sync
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                Connect your external calendar
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center py-4">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              Calendar integration is not configured. Please contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                Calendar Sync
              </h3>
            </div>
          </div>
        </div>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
        </div>
      </div>
    );
  }

  // Connected state
  if (grant && syncSettings) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Calendar Connected
                </h3>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  {syncSettings.connectedCalendarName || grant.calendarName || 'Your calendar is synced'}
                </p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
              title="Refresh status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Error message */}
          {(error || localError) && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{localError || error}</span>
            </div>
          )}

          {/* Sync Settings Toggles */}
          <div className="space-y-3">
            {/* Sync External Busy Times */}
            <label className="flex items-center justify-between p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl cursor-pointer hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors">
              <div className="flex-1 mr-4">
                <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Sync busy times from calendar
                </p>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Block scheduling slots when you have events in your external calendar
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={syncSettings.syncExternalBusy}
                  onChange={() => handleToggleSetting('syncExternalBusy')}
                  disabled={isSavingSettings}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#d1cdc8] dark:bg-[#3d4555] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-accent rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
              </div>
            </label>

            {/* Push Events to Calendar */}
            <label className="flex items-center justify-between p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl cursor-pointer hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors">
              <div className="flex-1 mr-4">
                <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Add calls to my calendar
                </p>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Automatically add confirmed coaching calls to your external calendar
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={syncSettings.pushEventsToCalendar}
                  onChange={() => handleToggleSetting('pushEventsToCalendar')}
                  disabled={isSavingSettings}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#d1cdc8] dark:bg-[#3d4555] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-accent rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
              </div>
            </label>
          </div>

          {/* Disconnect Button */}
          <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl font-albert font-medium transition-colors disabled:opacity-50"
            >
              {isDisconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              Disconnect Calendar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not connected state - show connect options
  return (
    <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Link2 className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
              Connect Your Calendar
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              Sync your availability and events with an external calendar
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Error message */}
        {(error || localError) && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Benefits List */}
        <div className="mb-6 space-y-2">
          <div className="flex items-start gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Automatically block times when you&apos;re busy</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Add confirmed calls to your calendar automatically</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span>Keep all your events in one place</span>
          </div>
        </div>

        {/* Connect Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleConnect('google')}
            disabled={isConnecting}
            className="flex-1 flex items-center justify-center gap-3 px-6 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f9f8f7] dark:hover:bg-[#262b35] rounded-xl font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] transition-colors disabled:opacity-50"
          >
            {isConnecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleCalendarIcon className="w-5 h-5" />
            )}
            Connect Google Calendar
          </button>

          <button
            onClick={() => handleConnect('microsoft')}
            disabled={isConnecting}
            className="flex-1 flex items-center justify-center gap-3 px-6 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f9f8f7] dark:hover:bg-[#262b35] rounded-xl font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] transition-colors disabled:opacity-50"
          >
            {isConnecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <OutlookIcon className="w-5 h-5" />
            )}
            Connect Outlook
          </button>
        </div>

        <p className="mt-4 text-xs text-center text-[#a7a39e] dark:text-[#7d8190]">
          We only access your calendar to check availability and add events.
          Your data is never shared.
        </p>
      </div>
    </div>
  );
}
