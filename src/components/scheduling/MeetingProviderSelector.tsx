'use client';

import { Video, Phone, Link2, Check } from 'lucide-react';
import { useCoachIntegrations } from '@/hooks/useCoachIntegrations';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type MeetingProviderType = 'in_app' | 'zoom' | 'google_meet' | 'manual';

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
}

interface ProviderConfig {
  id: MeetingProviderType;
  label: string;
  icon: typeof Video;
  requiresConnection?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  { id: 'in_app', label: 'In-App', icon: Phone },
  { id: 'zoom', label: 'Zoom', icon: Video, requiresConnection: true },
  { id: 'google_meet', label: 'Meet', icon: Video, requiresConnection: true },
  { id: 'manual', label: 'Manual Link', icon: Link2 },
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
}: MeetingProviderSelectorProps) {
  const { zoom, googleMeet, isLoading } = useCoachIntegrations();

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
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
          }
        `}
      >
        <Icon className="w-4 h-4" />
        {provider.label}
        {provider.requiresConnection && isConnected && (
          <Check className="w-3 h-3 text-green-500" />
        )}
      </button>
    );

    // Always use flex-1 wrapper for even distribution, put tooltip inside
    return (
      <div key={provider.id} className="flex-1">
        {isDisabled && provider.requiresConnection ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">{tabButton}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getDisabledTooltip(provider.id)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          tabButton
        )}
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
          <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1 ml-6">
            Link will be auto-generated
          </p>
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
          <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1 ml-6">
            Link will be auto-generated
          </p>
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

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
        <Video className="w-4 h-4 inline mr-2" />
        {label}
      </label>

      {/* Provider Tabs */}
      <div className="flex p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl mb-3">
        {availableProviders.map(renderProviderTab)}
      </div>

      {/* Status Area */}
      {renderStatusArea()}
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
