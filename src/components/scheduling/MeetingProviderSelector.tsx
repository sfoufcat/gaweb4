'use client';

import Image from 'next/image';
import { Video, Phone, Link2, Check, Lightbulb, Unplug } from 'lucide-react';
import { useCoachIntegrations } from '@/hooks/useCoachIntegrations';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type MeetingProviderType = 'in_app' | 'zoom' | 'google_meet' | 'manual';

// Logo URLs - exported for use in other components
export const ZOOM_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2Fzoom-icon.webp?alt=media&token=55a3c5b2-56d6-4532-b8d9-f26e052c762c';
export const GOOGLE_MEET_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2Fgooglemeet.png?alt=media&token=d0aa256e-b15d-4b02-817f-e779e88611fe';

export interface MeetingProviderSelectorProps {
  /** Allow in-app calling option (for 1:1 calls only) */
  allowInApp?: boolean;
  /** Currently selected provider */
  value: MeetingProviderType;
  /** Called when provider changes */
  onChange: (provider: MeetingProviderType) => void;
  /** Manual link value (when provider is 'manual' or manual override is used) */
  manualLink?: string;
  /** Called when manual link changes */
  onManualLinkChange?: (link: string) => void;
  /** When connected provider selected, use manual link instead of auto-generate */
  useManualOverride?: boolean;
  /** Called when manual override toggle changes */
  onUseManualOverrideChange?: (useManual: boolean) => void;
  /** Disable the entire selector */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Label override */
  label?: string;
  /** Already saved/generated meeting link - hides "will be auto-generated" text when set */
  savedMeetingLink?: string;
}

interface ProviderConfig {
  id: MeetingProviderType;
  label: string;
  mobileLabel?: string; // Optional shorter label for mobile
  icon?: typeof Video;
  logoUrl?: string;
  requiresConnection?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  { id: 'in_app', label: 'In-App', icon: Phone },
  { id: 'zoom', label: 'Zoom', logoUrl: ZOOM_LOGO_URL, requiresConnection: true },
  { id: 'google_meet', label: 'Meet', logoUrl: GOOGLE_MEET_LOGO_URL, requiresConnection: true },
  { id: 'manual', label: 'Link', icon: Link2 },
];

export function MeetingProviderSelector({
  allowInApp = false,
  value,
  onChange,
  manualLink = '',
  onManualLinkChange,
  useManualOverride = false,
  onUseManualOverrideChange,
  disabled = false,
  className = '',
  label = 'Meeting Link',
  savedMeetingLink,
}: MeetingProviderSelectorProps) {
  const { zoom, googleMeet, isLoading, error } = useCoachIntegrations();

  // Filter providers based on allowInApp
  const availableProviders = PROVIDERS.filter(
    (p) => p.id !== 'in_app' || allowInApp
  );

  // Check if a provider is connected
  const isProviderConnected = (providerId: MeetingProviderType): boolean => {
    if (providerId === 'zoom') return zoom.connected;
    if (providerId === 'google_meet') return googleMeet.connected;
    return true; // in_app and manual are always "connected"
  };

  // Check if a provider tab should be disabled
  const isProviderDisabled = (provider: ProviderConfig): boolean => {
    if (disabled) return true;
    if (!provider.requiresConnection) return false;
    return !isProviderConnected(provider.id);
  };

  // Get tooltip text for disabled provider
  const getDisabledTooltip = (providerId: MeetingProviderType): string => {
    if (providerId === 'zoom') {
      return 'Connect Zoom in Settings to use';
    }
    if (providerId === 'google_meet') {
      return 'Enable Google Meet in Settings to use';
    }
    return '';
  };

  // Get account email for connected provider
  const getAccountEmail = (providerId: MeetingProviderType): string | undefined => {
    if (providerId === 'zoom') return zoom.accountEmail;
    if (providerId === 'google_meet') return googleMeet.accountEmail;
    return undefined;
  };

  // Handle provider tab click
  const handleProviderClick = (provider: ProviderConfig) => {
    if (isProviderDisabled(provider)) return;
    onChange(provider.id);
    // Reset manual override when switching providers
    if (onUseManualOverrideChange) {
      onUseManualOverrideChange(false);
    }
  };

  // Render a single provider tab
  const renderProviderTab = (provider: ProviderConfig) => {
    const isSelected = value === provider.id;
    const isDisabled = isProviderDisabled(provider);
    const isConnected = isProviderConnected(provider.id);
    const Icon = provider.icon;

    const tabButton = (
      <button
        type="button"
        onClick={() => handleProviderClick(provider)}
        disabled={isDisabled}
        className={`
          w-full py-2 px-3 rounded-lg font-albert font-medium text-sm transition-colors
          flex items-center justify-center gap-2
          ${isSelected
            ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
            : 'text-[#5f5a55] dark:text-[#b2b6c2]'
          }
          ${isDisabled
            ? 'cursor-not-allowed'
            : 'hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
          }
        `}
      >
        {provider.logoUrl ? (
          <Image
            src={provider.logoUrl}
            alt={provider.label}
            width={16}
            height={16}
            className="w-4 h-4 object-contain"
          />
        ) : Icon ? (
          <Icon className="w-4 h-4" />
        ) : null}
        {provider.mobileLabel ? (
          <>
            <span className="sm:hidden">{provider.mobileLabel}</span>
            <span className="hidden sm:inline">{provider.label}</span>
          </>
        ) : (
          provider.label
        )}
        {provider.requiresConnection && isConnected && (
          <Check className="w-3 h-3 text-green-500" />
        )}
        {provider.requiresConnection && !isConnected && (
          <Unplug className="w-3 h-3 text-[#a7a39e] dark:text-[#6b7280]" />
        )}
      </button>
    );

    if (isDisabled && provider.requiresConnection) {
      return (
        <div key={provider.id} className="flex-1 min-w-0">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full">{tabButton}</div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{getDisabledTooltip(provider.id)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    }

    return (
      <div key={provider.id} className="flex-1 min-w-0">
        {tabButton}
      </div>
    );
  };

  // Render status area based on selected provider
  const renderStatusArea = () => {
    // In-App selected
    if (value === 'in_app') {
      return (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl">
          <p className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Audio call via Coachful app
          </p>
        </div>
      );
    }

    // Zoom selected and connected
    if (value === 'zoom' && zoom.connected) {
      return (
        <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl">
          <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Zoom connected
            {zoom.accountEmail && (
              <span className="text-xs opacity-75">({zoom.accountEmail})</span>
            )}
          </p>
          {!savedMeetingLink && (
            <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1 ml-6">
              Link will be auto-generated
            </p>
          )}
        </div>
      );
    }

    // Google Meet selected and connected
    if (value === 'google_meet' && googleMeet.connected) {
      return (
        <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl">
          <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Google Meet connected
            {googleMeet.accountEmail && (
              <span className="text-xs opacity-75">({googleMeet.accountEmail})</span>
            )}
          </p>
          {!savedMeetingLink && (
            <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1 ml-6">
              Link will be auto-generated
            </p>
          )}
        </div>
      );
    }

    // Manual selected
    if (value === 'manual') {
      return (
        <input
          type="url"
          value={manualLink}
          onChange={(e) => onManualLinkChange?.(e.target.value)}
          placeholder="https://zoom.us/j/... or https://meet.google.com/..."
          className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
        />
      );
    }

    return null;
  };

  // Show inline tip when video providers need configuration
  const renderSetupTip = () => {
    // Only show if both Zoom and Google Meet are not connected
    if (zoom.connected || googleMeet.connected) return null;

    return (
      <div className="mt-3 p-3 bg-[#f9f7f5] dark:bg-[#1c2028] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] flex items-start gap-2">
          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#a7a39e] dark:text-[#6b7280]" />
          <span>
            Tip: Connect Zoom or enable Google Meet from{' '}
            <a
              href="/coach?tab=scheduling&schedulingSubTab=availability"
              className="text-brand-accent underline font-medium hover:text-brand-accent/80"
            >
              Availability
            </a>
          </span>
        </p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
          <Video className="w-4 h-4 inline mr-2" />
          {label}
        </label>
        <div className="flex p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl animate-pulse">
          <div className="flex-1 py-2 px-3 rounded-lg bg-[#e1ddd8] dark:bg-[#262b35]" />
          <div className="flex-1 py-2 px-3 rounded-lg" />
          <div className="flex-1 py-2 px-3 rounded-lg" />
        </div>
      </div>
    );
  }

  // If there's an error loading integrations, show the selector anyway (will default to manual)
  if (error) {
    console.warn('[MeetingProviderSelector] Integration check failed:', error);
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
        <Video className="w-4 h-4 inline mr-2" />
        {label}
      </label>

      {/* Provider Tabs */}
      <div className="flex gap-1 p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl mb-3 overflow-visible">
        {availableProviders.map(renderProviderTab)}
      </div>

      {/* Status Area */}
      {renderStatusArea()}

      {/* Setup Tip - shows below input when video providers need configuration */}
      {renderSetupTip()}
    </div>
  );
}

// Export helper to check if selection is ready to submit
export function isMeetingProviderReady(
  provider: MeetingProviderType,
  integrations: { zoom: { connected: boolean }; googleMeet: { connected: boolean } },
  useManualOverride: boolean,
  manualLink: string
): boolean {
  if (provider === 'in_app') return true;
  if (provider === 'manual') return !!manualLink.trim();
  if (provider === 'zoom') {
    if (!integrations.zoom.connected) return false;
    if (useManualOverride) return !!manualLink.trim();
    return true; // Will auto-create
  }
  if (provider === 'google_meet') {
    if (!integrations.googleMeet.connected) return false;
    if (useManualOverride) return !!manualLink.trim();
    return true; // Will auto-create
  }
  return false;
}
