'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Calendar,
  Link2,
  Unlink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';
import { useCoachIntegrations } from '@/hooks/useCoachIntegrations';
import { ZOOM_LOGO_URL } from '@/components/scheduling/MeetingProviderSelector';

// Logo URLs
const GOOGLE_CALENDAR_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2Fgooglemeet.png?alt=media&token=d0aa256e-b15d-4b02-817f-e779e88611fe';
const OUTLOOK_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FMicrosoft_Office_Outlook_(2018%E2%80%932024).svg.png?alt=media&token=40dfcf83-d51e-442f-bcec-e0beef0d2e2f';

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

  const { zoom, refetch: refetchZoom } = useCoachIntegrations();

  const [isConnecting, setIsConnecting] = useState<'google' | 'microsoft' | 'zoom' | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState<'google' | 'microsoft' | 'zoom' | null>(null);
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

  const handleConnectZoom = async () => {
    try {
      setIsConnecting('zoom');
      setLocalError(null);
      const response = await fetch('/api/coach/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'zoom' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Zoom');
      }
      if (data.type === 'oauth' && data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to connect Zoom');
      setIsConnecting(null);
    }
  };

  const handleDisconnectZoom = async () => {
    try {
      setIsDisconnecting('zoom');
      setLocalError(null);
      const response = await fetch('/api/coach/integrations?provider=zoom', {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect Zoom');
      }
      refetchZoom();
      onSettingsChange?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to disconnect Zoom');
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
                  ? 'Sync availability & add events'
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

        {/* Google Calendar Row - Compact with pill toggle */}
        {isGoogleConfigured && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
            <div className="flex items-center gap-3">
              <Image src={GOOGLE_CALENDAR_LOGO_URL} alt="Google Calendar" width={32} height={32} className="w-8 h-8 flex-shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Google Calendar
                </p>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                  {google.connected ? google.accountEmail : 'Sync availability & add events'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:flex-shrink-0">
              {google.connected ? (
                <>
                  {/* Pill toggle showing connected status */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Connected</span>
                  </div>
                  <button
                    onClick={handleDisconnectGoogle}
                    disabled={isDisconnecting === 'google'}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Disconnect"
                  >
                    {isDisconnecting === 'google' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Unlink className="w-4 h-4" />
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  disabled={isConnecting !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg font-albert font-medium text-sm hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
                >
                  {isConnecting === 'google' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      Connect
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Microsoft Calendar Row - Compact with pill toggle */}
        {isMicrosoftConfigured && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
            <div className="flex items-center gap-3">
              <Image src={OUTLOOK_LOGO_URL} alt="Outlook Calendar" width={32} height={32} className="w-8 h-8 flex-shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Outlook Calendar
                </p>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                  {microsoft.connected ? microsoft.accountEmail : 'Sync availability & add events'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:flex-shrink-0">
              {microsoft.connected ? (
                <>
                  {/* Pill toggle showing connected status */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Connected</span>
                  </div>
                  <button
                    onClick={handleDisconnectMicrosoft}
                    disabled={isDisconnecting === 'microsoft'}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Disconnect"
                  >
                    {isDisconnecting === 'microsoft' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Unlink className="w-4 h-4" />
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectMicrosoft}
                  disabled={isConnecting !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg font-albert font-medium text-sm hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
                >
                  {isConnecting === 'microsoft' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      Connect
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Zoom Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
          <div className="flex items-center gap-3">
            <Image src={ZOOM_LOGO_URL} alt="Zoom" width={32} height={32} className="w-8 h-8 flex-shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                Zoom
              </p>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                {zoom.connected ? zoom.accountEmail : 'Create Zoom meetings for calls'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:flex-shrink-0">
            {zoom.connected ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">Connected</span>
                </div>
                <button
                  onClick={handleDisconnectZoom}
                  disabled={isDisconnecting === 'zoom'}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors disabled:opacity-50"
                  title="Disconnect"
                >
                  {isDisconnecting === 'zoom' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectZoom}
                disabled={isConnecting !== null}
                className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg font-albert font-medium text-sm hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
              >
                {isConnecting === 'zoom' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    Connect
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Benefits (show when neither connected) */}
        {!hasAnyConnected && (
          <div className="space-y-2 pt-2">
            <div className="flex items-start gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>Automatically block times when you&apos;re busy</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>Add confirmed calls to your calendar automatically</span>
            </div>
          </div>
        )}

                <p className="text-xs text-center text-[#a7a39e] dark:text-[#7d8190]">
          We only access your calendar to check availability and add events.
        </p>
      </div>
    </div>
  );
}
