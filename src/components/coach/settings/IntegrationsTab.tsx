'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  CalendarPlus,
  FileText,
  CheckSquare,
  Zap,
  Workflow,
  ExternalLink,
  Check,
  Loader2,
  Settings,
  Trash2,
  AlertCircle,
  Lock,
  Table,
  MessageSquare,
  MessageCircle,
  Database,
  Clock,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  INTEGRATION_PROVIDERS,
  type CoachIntegration,
  type IntegrationProviderMeta,
  type IntegrationProvider,
  type IntegrationCategory,
  type WebhookEventType,
  type WEBHOOK_EVENTS,
  type GoogleCalendarSettings,
} from '@/lib/integrations/types';

interface IntegrationsTabProps {
  coachTier?: 'starter' | 'pro' | 'scale';
}

// Map provider IDs to their icons
const PROVIDER_ICONS: Record<IntegrationProvider, React.ElementType> = {
  google_calendar: Calendar,
  google_sheets: Table,
  outlook_calendar: Calendar,
  notion: FileText,
  airtable: Database,
  todoist: CheckSquare,
  asana: CheckSquare,
  slack: MessageSquare,
  discord: MessageCircle,
  zapier: Zap,
  make: Workflow,
  calcom: CalendarPlus,
  zoom: Video,
};

// Category labels
const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  calendar: 'Calendar & Meetings',
  data: 'Data Export',
  tasks: 'Task Management',
  notifications: 'Notifications',
  automation: 'Automation',
  scheduling: 'Scheduling',
  knowledge: 'Knowledge Base',
};

export function IntegrationsTab({ coachTier = 'starter' }: IntegrationsTabProps) {
  const [integrations, setIntegrations] = useState<CoachIntegration[]>([]);
  const [available, setAvailable] = useState<IntegrationProviderMeta[]>([]);
  const [configuredProviders, setConfiguredProviders] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProviderMeta | null>(null);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [disconnectingIntegration, setDisconnectingIntegration] = useState<CoachIntegration | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<CoachIntegration | null>(null);
  
  // Form states
  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch integrations
  const fetchIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/coach/integrations');
      if (!response.ok) {
        throw new Error('Failed to fetch integrations');
      }

      const data = await response.json();
      setIntegrations(data.integrations || []);
      setAvailable(data.available || []);
      setConfiguredProviders(data.configured || {});
    } catch (err) {
      console.error('Error fetching integrations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
    
    // Check for connection result in URL params
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const errorParam = params.get('error');
    
    if (connected) {
      // Show success toast or notification
      console.log(`Successfully connected ${connected}`);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (errorParam) {
      setError(`Connection failed: ${errorParam}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchIntegrations]);

  // Connect integration
  const handleConnect = async () => {
    if (!selectedProvider) return;

    try {
      setConnecting(true);
      setError(null);

      const body: Record<string, unknown> = {
        provider: selectedProvider.id,
      };

      // Add webhook URL for webhook integrations
      if (selectedProvider.authType === 'webhook') {
        if (!webhookUrl.trim()) {
          setError('Please enter a webhook URL');
          setConnecting(false);
          return;
        }
        body.webhookUrl = webhookUrl.trim();
        body.settings = {
          events: selectedEvents,
          includeClientData: false,
          retryOnFailure: true,
        };
      }

      // Add API key for API key integrations
      if (selectedProvider.authType === 'api_key') {
        if (!apiKey.trim()) {
          setError('Please enter an API key');
          setConnecting(false);
          return;
        }
        body.apiKey = apiKey.trim();
        body.settings = {
          language: 'en',
          speakerDiarization: true,
          punctuation: true,
          autoTranscribe: true,
          summarize: true,
        };
      }

      const response = await fetch('/api/coach/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect integration');
      }

      // Handle OAuth flow
      if (data.type === 'oauth' && data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }

      // Handle direct connection
      if (data.success) {
        setIsConnectModalOpen(false);
        resetForm();
        fetchIntegrations();
      }
    } catch (err) {
      console.error('Error connecting integration:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect integration');
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect integration
  const handleDisconnect = async () => {
    if (!disconnectingIntegration) return;

    try {
      setDisconnecting(true);

      const response = await fetch(`/api/coach/integrations/${disconnectingIntegration.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect integration');
      }

      setIsDisconnectModalOpen(false);
      setDisconnectingIntegration(null);
      fetchIntegrations();
    } catch (err) {
      console.error('Error disconnecting integration:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect integration');
    } finally {
      setDisconnecting(false);
    }
  };

  // Save integration settings
  const handleSaveSettings = async () => {
    if (!editingIntegration) return;

    try {
      setSaving(true);

      const response = await fetch(`/api/coach/integrations/${editingIntegration.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: editingIntegration.settings,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setIsSettingsModalOpen(false);
      setEditingIntegration(null);
      fetchIntegrations();
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedProvider(null);
    setWebhookUrl('');
    setApiKey('');
    setSelectedEvents([]);
    setError(null);
  };

  // Update Google Calendar feature toggles
  const updateGoogleCalendarSettings = async (
    integrationId: string,
    field: 'enableCalendarSync' | 'enableMeetLinks',
    value: boolean
  ) => {
    try {
      const response = await fetch(`/api/coach/integrations/${integrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { [field]: value },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      // Refresh integrations list
      await fetchIntegrations();
    } catch (err) {
      console.error('Error updating Google Calendar settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  };

  // Check if provider requires higher tier
  const isTierLocked = (provider: IntegrationProviderMeta): boolean => {
    const tierOrder = ['starter', 'pro', 'scale'];
    const requiredIndex = tierOrder.indexOf(provider.requiredTier || 'starter');
    const currentIndex = tierOrder.indexOf(coachTier);
    return currentIndex < requiredIndex;
  };

  // Check if provider is configured (OAuth credentials set)
  const isProviderConfigured = (providerId: IntegrationProvider): boolean => {
    return configuredProviders[providerId] !== false;
  };

  // Group available providers by category
  const groupedAvailable = available.reduce((acc, provider) => {
    const category = provider.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(provider);
    return acc;
  }, {} as Record<IntegrationCategory, IntegrationProviderMeta[]>);

  // Get connected integration by provider (only if status === 'connected')
  const getConnectedIntegration = (provider: IntegrationProvider): CoachIntegration | undefined => {
    return integrations.find((i) => i.provider === provider && i.status === 'connected');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-1">Integrations</h2>
        <p className="text-text-secondary text-sm">
          Connect external tools to enhance your coaching workflow
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-red-600 dark:text-red-400 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Connected Integrations */}
      {integrations.filter(i => i.status === 'connected').length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3 uppercase tracking-wide">
            Connected
          </h3>
          <div className="grid gap-3">
            {integrations.filter(i => i.status === 'connected').map((integration) => {
              const Icon = PROVIDER_ICONS[integration.provider];
              // Use INTEGRATION_PROVIDERS for consistent, user-friendly names
              const providerMeta = INTEGRATION_PROVIDERS[integration.provider] || {
                name: integration.provider,
                description: '',
              };
              
              return (
                <div
                  key={integration.id}
                  className="bg-white dark:bg-[#1d222b] border border-gray-200 dark:border-[#2a303b] rounded-xl p-4"
                >
                  {/* Main content row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left: Icon and info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-text-primary">
                            {(providerMeta as IntegrationProviderMeta).name || integration.provider}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            <Check className="w-3 h-3" />
                            Connected
                          </span>
                        </div>
                        {integration.accountEmail && (
                          <p className="text-sm text-text-secondary mt-0.5 truncate">
                            {integration.accountEmail}
                          </p>
                        )}
                        {integration.lastSyncAt && (
                          <p className="text-xs text-text-muted mt-1">
                            Last synced: {new Date(integration.lastSyncAt as string).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Feature toggles and actions */}
                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-13 sm:ml-0">
                      {/* Feature toggles for Google Calendar - pill switch style */}
                      {integration.provider === 'google_calendar' && (
                        <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-[#262b35] rounded-full">
                          <button
                            onClick={() => updateGoogleCalendarSettings(
                              integration.id,
                              'enableCalendarSync',
                              !(integration.settings as GoogleCalendarSettings)?.enableCalendarSync
                            )}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              (integration.settings as GoogleCalendarSettings)?.enableCalendarSync !== false
                                ? 'bg-white dark:bg-[#1d222b] text-green-600 dark:text-green-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Calendar</span>
                          </button>
                          <button
                            onClick={() => updateGoogleCalendarSettings(
                              integration.id,
                              'enableMeetLinks',
                              !(integration.settings as GoogleCalendarSettings)?.enableMeetLinks
                            )}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              (integration.settings as GoogleCalendarSettings)?.enableMeetLinks
                                ? 'bg-white dark:bg-[#1d222b] text-green-600 dark:text-green-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Meet</span>
                          </button>
                        </div>
                      )}

                      {/* Delete button */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDisconnectingIntegration(integration);
                            setIsDisconnectModalOpen(true);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Integrations by Category */}
      {Object.entries(groupedAvailable).map(([category, providers]) => (
        <div key={category}>
          <h3 className="text-sm font-medium text-text-secondary mb-3 uppercase tracking-wide">
            {CATEGORY_LABELS[category as IntegrationCategory]}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => {
              const Icon = PROVIDER_ICONS[provider.id];
              const isLocked = isTierLocked(provider);
              const isConfigured = isProviderConfigured(provider.id);
              const connected = getConnectedIntegration(provider.id);
              
              if (connected) return null; // Already shown in connected section
              
              const isDisabled = isLocked || !isConfigured;
              
              return (
                <div
                  key={provider.id}
                  className={`bg-white dark:bg-[#1d222b] border border-gray-200 dark:border-[#2a303b] rounded-xl p-4 ${
                    isDisabled ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isDisabled 
                        ? 'bg-gray-100 dark:bg-[#262b35]' 
                        : 'bg-gray-100 dark:bg-[#262b35]'
                    }`}>
                      <Icon className={`w-5 h-5 ${isDisabled ? 'text-text-muted' : 'text-text-secondary'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${isDisabled ? 'text-text-muted' : 'text-text-primary'}`}>
                          {provider.name}
                        </span>
                        {!isConfigured && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                            <Clock className="w-3 h-3" />
                            Coming Soon
                          </span>
                        )}
                        {isConfigured && isLocked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <Lock className="w-3 h-3" />
                            {provider.requiredTier?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mt-0.5 line-clamp-2 ${isDisabled ? 'text-text-muted' : 'text-text-secondary'}`}>
                        {provider.description}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        {!isConfigured ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="opacity-50 cursor-not-allowed"
                          >
                            Coming Soon
                          </Button>
                        ) : isLocked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                          >
                            Upgrade to Connect
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedProvider(provider);
                              setIsConnectModalOpen(true);
                            }}
                          >
                            Connect
                          </Button>
                        )}
                        {provider.docsUrl && (
                          <a
                            href={provider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text-muted hover:text-text-secondary"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Connect Modal */}
      <Transition appear show={isConnectModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setIsConnectModalOpen(false);
            resetForm();
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md bg-white dark:bg-[#1d222b] rounded-2xl p-6 shadow-xl">
                  <Dialog.Title className="text-lg font-semibold text-text-primary mb-4">
                    Connect {selectedProvider?.name}
                  </Dialog.Title>

                  {selectedProvider?.authType === 'oauth2' && (
                    <div className="space-y-4">
                      <p className="text-text-secondary text-sm">
                        You&apos;ll be redirected to {selectedProvider.name} to authorize access.
                      </p>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>Permissions requested:</strong>
                        </p>
                        <ul className="text-sm text-blue-600 dark:text-blue-400 mt-1 space-y-1">
                          {selectedProvider.scopes?.map((scope) => (
                            <li key={scope}>• {scope}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {selectedProvider?.authType === 'webhook' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Webhook URL
                        </label>
                        <input
                          type="url"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          placeholder="https://hooks.zapier.com/..."
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#262b35] border border-gray-200 dark:border-[#2a303b] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        />
                        <p className="text-xs text-text-muted mt-1">
                          Get this URL from your {selectedProvider.name} trigger
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                          Events to Send
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {Object.entries(WEBHOOK_EVENTS_LIST).map(([event, meta]) => (
                            <label
                              key={event}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedEvents.includes(event as WebhookEventType)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEvents([...selectedEvents, event as WebhookEventType]);
                                  } else {
                                    setSelectedEvents(selectedEvents.filter((e) => e !== event));
                                  }
                                }}
                                className="rounded border-gray-300 dark:border-gray-600 text-brand-accent focus:ring-brand-accent"
                              />
                              <span className="text-sm text-text-primary">{meta.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedProvider?.authType === 'api_key' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          API Key
                        </label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Enter your API key"
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#262b35] border border-gray-200 dark:border-[#2a303b] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        />
                        <p className="text-xs text-text-muted mt-1">
                          Get your API key from{' '}
                          <a
                            href={selectedProvider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-accent hover:underline"
                          >
                            {selectedProvider.name} dashboard
                          </a>
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsConnectModalOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConnect}
                      disabled={connecting}
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : selectedProvider?.authType === 'oauth2' ? (
                        'Authorize'
                      ) : (
                        'Connect'
                      )}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Disconnect Confirmation Modal */}
      <Transition appear show={isDisconnectModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setIsDisconnectModalOpen(false);
            setDisconnectingIntegration(null);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-sm bg-white dark:bg-[#1d222b] rounded-2xl p-6 shadow-xl">
                  <Dialog.Title className="text-lg font-semibold text-text-primary mb-2">
                    Disconnect Integration?
                  </Dialog.Title>
                  <p className="text-text-secondary text-sm mb-6">
                    This will remove the connection to {disconnectingIntegration?.provider}. 
                    You can reconnect anytime.
                  </p>

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsDisconnectModalOpen(false);
                        setDisconnectingIntegration(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                    >
                      {disconnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        'Disconnect'
                      )}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Settings Modal */}
      <Transition appear show={isSettingsModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setIsSettingsModalOpen(false);
            setEditingIntegration(null);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md bg-white dark:bg-[#1d222b] rounded-2xl p-6 shadow-xl">
                  <Dialog.Title className="text-lg font-semibold text-text-primary mb-4">
                    Integration Settings
                  </Dialog.Title>

                  {editingIntegration && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#262b35] rounded-lg">
                        {PROVIDER_ICONS[editingIntegration.provider] && (
                          <div className="w-8 h-8 bg-white dark:bg-[#1d222b] rounded-lg flex items-center justify-center">
                            {(() => {
                              const Icon = PROVIDER_ICONS[editingIntegration.provider];
                              return <Icon className="w-4 h-4 text-text-secondary" />;
                            })()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-text-primary">
                            {editingIntegration.provider.replace(/_/g, ' ')}
                          </p>
                          {editingIntegration.accountEmail && (
                            <p className="text-sm text-text-secondary">
                              {editingIntegration.accountEmail}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Provider-specific settings would go here */}
                      <div className="text-sm text-text-secondary">
                        Settings configuration coming soon...
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsSettingsModalOpen(false);
                        setEditingIntegration(null);
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      onClick={handleSaveSettings}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

// Webhook events list for the connect modal
const WEBHOOK_EVENTS_LIST: Record<string, { name: string; description: string; category: string }> = {
  'client.checkin.completed': {
    name: 'Check-in Completed',
    description: 'Triggered when a client completes their daily check-in',
    category: 'Check-ins',
  },
  'client.goal.achieved': {
    name: 'Goal Achieved',
    description: 'Triggered when a client marks a goal as achieved',
    category: 'Goals',
  },
  'coaching.session.completed': {
    name: 'Session Completed',
    description: 'Triggered when a coaching session ends',
    category: 'Coaching',
  },
  'program.purchased': {
    name: 'Program Purchased',
    description: 'Triggered when a client purchases a program',
    category: 'Programs',
  },
  'squad.member.joined': {
    name: 'Squad Member Joined',
    description: 'Triggered when someone joins a squad',
    category: 'Squads',
  },
};

export default IntegrationsTab;

