'use client';

import { createPortal } from 'react-dom';
import { X, CheckCircle2, Video, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IntegrationConnectedModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: 'zoom' | 'google_calendar' | 'outlook_calendar';
  accountEmail?: string;
}

const PROVIDER_CONFIG = {
  zoom: {
    name: 'Zoom',
    icon: Video,
    color: 'bg-blue-100 dark:bg-blue-900/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    features: [
      { icon: Calendar, text: '1:1 coaching calls when clients book sessions' },
      { icon: Users, text: 'Group events and cohort sessions you create' },
    ],
    settingsPath: 'Settings > Integrations',
  },
  google_calendar: {
    name: 'Google Calendar',
    icon: Calendar,
    color: 'bg-green-100 dark:bg-green-900/20',
    iconColor: 'text-green-600 dark:text-green-400',
    features: [
      { icon: Calendar, text: 'Your coaching sessions sync to Google Calendar' },
      { icon: Video, text: 'Google Meet links auto-added to calendar events' },
    ],
    settingsPath: 'Settings > Integrations',
  },
  outlook_calendar: {
    name: 'Outlook Calendar',
    icon: Calendar,
    color: 'bg-blue-100 dark:bg-blue-900/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    features: [
      { icon: Calendar, text: 'Your coaching sessions sync to Outlook Calendar' },
      { icon: Video, text: 'Teams links auto-added to calendar events' },
    ],
    settingsPath: 'Settings > Integrations',
  },
};

export function IntegrationConnectedModal({
  isOpen,
  onClose,
  provider,
  accountEmail,
}: IntegrationConnectedModalProps) {
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const config = PROVIDER_CONFIG[provider];
  const Icon = config.icon;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-text-secondary hover:text-text-primary dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4">
          <div className={`w-14 h-14 ${config.color} rounded-2xl flex items-center justify-center mb-4`}>
            <Icon className={`w-7 h-7 ${config.iconColor}`} />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-albert text-[22px] font-bold text-text-primary dark:text-[#f5f5f8]">
              {config.name} Connected
            </h2>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>

          {accountEmail && (
            <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
              Connected as <span className="font-medium text-text-primary dark:text-[#f5f5f8]">{accountEmail}</span>
            </p>
          )}
        </div>

        {/* Features */}
        <div className="px-6 pb-4">
          <div className="bg-[#faf8f6] dark:bg-[#0a0c10] rounded-xl p-4">
            <p className="font-sans text-[13px] font-medium text-text-primary dark:text-[#f5f5f8] mb-3">
              {provider === 'zoom' ? 'Zoom meetings will automatically be created for:' : 'Your calendar will now sync:'}
            </p>
            <ul className="space-y-2.5">
              {config.features.map((feature, index) => {
                const FeatureIcon = feature.icon;
                return (
                  <li key={index} className="flex items-start gap-2.5">
                    <FeatureIcon className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2] mt-0.5 flex-shrink-0" />
                    <span className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
                      {feature.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Settings Link */}
        <div className="px-6 pb-2">
          <p className="font-sans text-[12px] text-text-tertiary dark:text-[#6b7280] text-center">
            Manage {config.name} settings in {config.settingsPath}
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 pt-4">
          <Button
            onClick={onClose}
            className="w-full"
          >
            Got it
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
