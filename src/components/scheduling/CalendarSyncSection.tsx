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
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';

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
 * UI for connecting/disconnecting external calendars (Google and/or Microsoft).
 * Shows connection status and allows OAuth connection for both providers independently.
 */
export function CalendarSyncSection({ onSettingsChange }: CalendarSyncSectionProps) {
  const {
    google,
    microsoft,
    hasAnyConnected,
    isLoading,
    error,
    isGoogleConfigured,
    isMicrosoftConfigured,
    connectGoogle,
    connectMicrosoft,
    disconnectGoogle,
    disconnectMicrosoft,
    refetch,
  } = useCalendarIntegration();

  const [isConnecting, setIsConnecting] = useState<'google' | 'microsoft' | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState<'google' | 'microsoft' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleConnectGoogle = async () => {
    try {
      setIsConnecting('google');
      setLocalError(null);
      await connectGoogle();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to connect Google Calendar');
    } finally {
      setIsConnecting(null);
    }
  };

  const handleConnectMicrosoft = async () => {
    try {
      setIsConnecting('microsoft');
      setLocalError(null);
      await connectMicrosoft();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to connect Outlook');
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      setIsDisconnecting('google');
      setLocalError(null);
      await disconnectGoogle();
      onSettingsChange?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to disconnect Google Calendar');
    } finally {
      setIsDisconnecting(null);
    }
  };

  const handleDisconnectMicrosoft = async () => {
    try {
      setIsDisconnecting('microsoft');
      setLocalError(null);
      await disconnectMicrosoft();
      onSettingsChange?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to disconnect Outlook');
    } finally {
      setIsDisconnecting(null);
    }
  };

  // Not configured state (neither Google nor Microsoft set up)
  if (!isGoogleConfigured && !isMicrosoftConfigured) {
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

  return (
    <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${hasAnyConnected ? 'bg-green-100 dark:bg-green-900/20' : 'bg-blue-100 dark:bg-blue-900/20'} rounded-lg`}>
              {hasAnyConnected ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <Link2 className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <div>
              <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                Calendar Sync
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                {hasAnyConnected
                  ? 'Manage your connected calendars'
                  : 'Connect your external calendars'}
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

        {/* Benefits (show when neither connected) */}
        {!hasAnyConnected && (
          <div className="mb-4 space-y-2">
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
              <span>Connect multiple calendars to sync all your availability</span>
            </div>
          </div>
        )}

        {/* Google Calendar Section */}
        {isGoogleConfigured && (
          <div className="p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GoogleCalendarIcon className="w-8 h-8" />
                <div>
                  <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Google Calendar
                  </p>
                  {google.connected ? (
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      {google.accountEmail}
                    </p>
                  ) : (
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      Not connected
                    </p>
                  )}
                </div>
              </div>
              {google.connected ? (
                <button
                  onClick={handleDisconnectGoogle}
                  disabled={isDisconnecting === 'google'}
                  className="flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg font-albert font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isDisconnecting === 'google' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  disabled={isConnecting !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#3a3f4b] hover:bg-[#f3f1ef] dark:hover:bg-[#2d323d] rounded-lg font-albert font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8] transition-colors disabled:opacity-50"
                >
                  {isConnecting === 'google' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  Connect
                </button>
              )}
            </div>
          </div>
        )}

        {/* Microsoft Calendar Section */}
        {isMicrosoftConfigured && (
          <div className="p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <OutlookIcon className="w-8 h-8" />
                <div>
                  <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    Outlook Calendar
                  </p>
                  {microsoft.connected ? (
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      {microsoft.accountEmail}
                    </p>
                  ) : (
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      Not connected
                    </p>
                  )}
                </div>
              </div>
              {microsoft.connected ? (
                <button
                  onClick={handleDisconnectMicrosoft}
                  disabled={isDisconnecting === 'microsoft'}
                  className="flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg font-albert font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isDisconnecting === 'microsoft' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectMicrosoft}
                  disabled={isConnecting !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#3a3f4b] hover:bg-[#f3f1ef] dark:hover:bg-[#2d323d] rounded-lg font-albert font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8] transition-colors disabled:opacity-50"
                >
                  {isConnecting === 'microsoft' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  Connect
                </button>
              )}
            </div>
          </div>
        )}

        {/* Features Info (show when at least one connected) */}
        {hasAnyConnected && (
          <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35] space-y-2">
            <div className="flex items-start gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>Your busy times are synced to block scheduling slots</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>Coaching calls are added to your calendar automatically</span>
            </div>
          </div>
        )}

        <p className="text-xs text-center text-[#a7a39e] dark:text-[#7d8190]">
          We only access your calendar to check availability and add events.
          Your data is never shared.
        </p>
      </div>
    </div>
  );
}
