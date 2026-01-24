'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Clock,
  Video,
  Link as LinkIcon,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react';
import type { IntakeCallConfig, IntakeCallMeetingProvider, IntakeFormField } from '@/types';
import { MeetingProviderSelector } from '@/components/scheduling/MeetingProviderSelector';

interface IntakeConfigEditorProps {
  config: IntakeCallConfig | null;
  onSave: (config: IntakeCallConfig) => void;
  onCancel: () => void;
}

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 90, label: '90 minutes' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'email', label: 'Email' },
];

export function IntakeConfigEditor({ config, onSave, onCancel }: IntakeConfigEditorProps) {
  const isEditing = !!config;

  // Form state
  const [name, setName] = useState(config?.name || '');
  const [description, setDescription] = useState(config?.description || '');
  const [duration, setDuration] = useState(config?.duration || 30);
  const [meetingProvider, setMeetingProvider] = useState<IntakeCallMeetingProvider>(
    config?.meetingProvider || 'zoom'
  );
  const [manualMeetingUrl, setManualMeetingUrl] = useState(config?.manualMeetingUrl || '');
  const [confirmationMessage, setConfirmationMessage] = useState(config?.confirmationMessage || '');
  const [requirePhone, setRequirePhone] = useState(config?.requirePhone || false);
  const [customFields, setCustomFields] = useState<IntakeFormField[]>(config?.customFields || []);
  const [allowCancellation, setAllowCancellation] = useState(config?.allowCancellation ?? true);
  const [allowReschedule, setAllowReschedule] = useState(config?.allowReschedule ?? true);
  const [cancelDeadlineHours, setCancelDeadlineHours] = useState(config?.cancelDeadlineHours || 24);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Custom fields management
  const addCustomField = () => {
    setCustomFields(prev => [
      ...prev,
      {
        id: `field_${Date.now()}`,
        label: '',
        type: 'text',
        required: false,
      },
    ]);
  };

  const updateCustomField = (id: string, updates: Partial<IntakeFormField>) => {
    setCustomFields(prev =>
      prev.map(field => (field.id === id ? { ...field, ...updates } : field))
    );
  };

  const removeCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(field => field.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (meetingProvider === 'manual' && !manualMeetingUrl) {
      setError('Meeting URL is required for manual provider');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        duration,
        meetingProvider,
        manualMeetingUrl: meetingProvider === 'manual' ? manualMeetingUrl : undefined,
        confirmationMessage: confirmationMessage.trim() || undefined,
        requirePhone,
        customFields: customFields.filter(f => f.label.trim()),
        allowCancellation,
        allowReschedule,
        cancelDeadlineHours,
      };

      const url = isEditing
        ? `/api/coach/intake-configs/${config.id}`
        : '/api/coach/intake-configs';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await response.json();
      onSave(data.config);
    } catch (err) {
      console.error('Error saving config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Intake Call' : 'New Intake Call'}
          </h2>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Basic Info</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Discovery Call"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What will you discuss in this call?"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Call Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Call Settings</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Duration
            </label>
            <select
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {DURATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Meeting Provider
          </label>
          <MeetingProviderSelector
            value={meetingProvider}
            onChange={(provider) => {
              setMeetingProvider(provider as IntakeCallMeetingProvider);
            }}
            manualLink={manualMeetingUrl}
            onManualLinkChange={setManualMeetingUrl}
          />
        </div>
      </div>

      {/* Booking Form Fields */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Booking Form Fields</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Name and email are always required. Add additional fields below.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="requirePhone"
            checked={requirePhone}
            onChange={e => setRequirePhone(e.target.checked)}
            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <label htmlFor="requirePhone" className="text-sm text-gray-700 dark:text-gray-300">
            Require phone number
          </label>
        </div>

        {/* Custom fields */}
        <div className="space-y-3">
          {customFields.map((field, index) => (
            <div
              key={field.id}
              className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="text-gray-400 cursor-grab">
                <GripVertical className="h-5 w-5" />
              </div>
              <div className="flex-1 grid gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={field.label}
                  onChange={e => updateCustomField(field.id, { label: e.target.value })}
                  placeholder="Field label"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <select
                  value={field.type}
                  onChange={e => updateCustomField(field.id, { type: e.target.value as IntakeFormField['type'] })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {FIELD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={e => updateCustomField(field.id, { required: e.target.checked })}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() => removeCustomField(field.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addCustomField}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Custom Field
          </button>
        </div>
      </div>

      {/* Cancellation Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Cancellation & Rescheduling</h3>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allowCancellation"
              checked={allowCancellation}
              onChange={e => setAllowCancellation(e.target.checked)}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="allowCancellation" className="text-sm text-gray-700 dark:text-gray-300">
              Allow prospects to cancel their booking
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allowReschedule"
              checked={allowReschedule}
              onChange={e => setAllowReschedule(e.target.checked)}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="allowReschedule" className="text-sm text-gray-700 dark:text-gray-300">
              Allow prospects to reschedule their booking
            </label>
          </div>

          {(allowCancellation || allowReschedule) && (
            <div className="flex items-center gap-2 pl-6">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Deadline:
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={cancelDeadlineHours}
                onChange={e => setCancelDeadlineHours(Number(e.target.value))}
                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                hours before call
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Message */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Confirmation Message</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Shown to the prospect after they book. Leave empty for a default message.
        </p>
        <textarea
          value={confirmationMessage}
          onChange={e => setConfirmationMessage(e.target.value)}
          placeholder="Thanks for booking! I'm looking forward to speaking with you."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        />
      </div>
    </form>
  );
}
