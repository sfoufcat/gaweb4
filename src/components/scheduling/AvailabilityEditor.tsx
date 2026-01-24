'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Globe,
  Eye,
} from 'lucide-react';
import { useAvailability } from '@/hooks/useAvailability';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { CalendarSyncSection } from './CalendarSyncSection';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import type { WeeklySchedule, TimeSlot, BlockedSlot, CoachAvailability } from '@/types';

// Demo mock availability data - use a function to get user's local timezone
const getDemoAvailability = (): CoachAvailability => ({
  coachUserId: 'demo-coach',
  odId: 'demo-org',
  weeklySchedule: {
    0: [], // Sunday - unavailable
    1: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], // Monday
    2: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], // Tuesday
    3: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], // Wednesday
    4: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], // Thursday
    5: [{ start: '09:00', end: '12:00' }], // Friday - morning only
    6: [], // Saturday - unavailable
  },
  blockedSlots: [
    {
      id: 'demo-blocked-1',
      start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
      end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(), // 4 hours later
      reason: 'Team meeting',
    },
  ],
  defaultDuration: 30,
  bufferBetweenCalls: 15,
  timezone: typeof window !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC',
  advanceBookingDays: 30,
  minNoticeHours: 24,
  syncExternalBusy: false,
  pushEventsToCalendar: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const BUFFER_OPTIONS = [
  { value: 0, label: 'No buffer' },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
];

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
];

interface TimeSlotEditorProps {
  slot: TimeSlot;
  onUpdate: (slot: TimeSlot) => void;
  onRemove: () => void;
}

function TimeSlotEditor({ slot, onUpdate, onRemove }: TimeSlotEditorProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        value={slot.start}
        onChange={(e) => onUpdate({ ...slot, start: e.target.value })}
        className="px-3 py-2 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
      />
      <span className="text-[#5f5a55] dark:text-[#b2b6c2]">to</span>
      <input
        type="time"
        value={slot.end}
        onChange={(e) => onUpdate({ ...slot, end: e.target.value })}
        className="px-3 py-2 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
      />
      <button
        onClick={onRemove}
        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        title="Remove time slot"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

interface DayScheduleEditorProps {
  day: number;
  slots: TimeSlot[];
  onUpdate: (slots: TimeSlot[]) => void;
}

function DayScheduleEditor({ day, slots, onUpdate }: DayScheduleEditorProps) {
  const dayInfo = DAYS_OF_WEEK.find(d => d.value === day)!;

  const addSlot = () => {
    onUpdate([...slots, { start: '09:00', end: '17:00' }]);
  };

  const updateSlot = (index: number, slot: TimeSlot) => {
    const newSlots = [...slots];
    newSlots[index] = slot;
    onUpdate(newSlots);
  };

  const removeSlot = (index: number) => {
    onUpdate(slots.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 border-b border-[#e1ddd8] dark:border-[#262b35] last:border-b-0">
      <div className="w-24 flex-shrink-0">
        <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
          {dayInfo.label}
        </span>
      </div>
      <div className="flex-1 space-y-2">
        {slots.length === 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-[#a7a39e] dark:text-[#7d8190] text-sm">Unavailable</span>
            <button
              onClick={addSlot}
              className="text-brand-accent hover:text-brand-accent/80 text-sm font-medium"
            >
              + Add hours
            </button>
          </div>
        ) : (
          <>
            {slots.map((slot, index) => (
              <TimeSlotEditor
                key={index}
                slot={slot}
                onUpdate={(updated) => updateSlot(index, updated)}
                onRemove={() => removeSlot(index)}
              />
            ))}
            <button
              onClick={addSlot}
              className="text-brand-accent hover:text-brand-accent/80 text-sm font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add another time slot
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface BlockedSlotCardProps {
  slot: BlockedSlot;
  onRemove: () => void;
}

function BlockedSlotCard({ slot, onRemove }: BlockedSlotCardProps) {
  const startDate = new Date(slot.start);
  const endDate = new Date(slot.end);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl">
      <div>
        <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
          {formatDate(startDate)} {formatTime(startDate)} - {formatTime(endDate)}
        </p>
        {slot.reason && (
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">{slot.reason}</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        title="Remove blocked time"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * AvailabilityEditor
 * 
 * Allows coaches to set their weekly availability schedule,
 * block specific times, and configure scheduling settings.
 */
export function AvailabilityEditor() {
  const { isDemoMode, openSignupModal } = useDemoMode();
  
  // Use real hook only when not in demo mode
  const realAvailability = useAvailability();
  
  // In demo mode, use mock data
  const availability = isDemoMode ? getDemoAvailability() : realAvailability.availability;
  const isLoading = isDemoMode ? false : realAvailability.isLoading;
  const error = isDemoMode ? null : realAvailability.error;
  const updateAvailability = realAvailability.updateAvailability;
  const addBlockedSlot = realAvailability.addBlockedSlot;
  const removeBlockedSlot = realAvailability.removeBlockedSlot;

  const [localSchedule, setLocalSchedule] = useState<WeeklySchedule | null>(null);
  const [localSettings, setLocalSettings] = useState<{
    defaultDuration: number;
    bufferBetweenCalls: number;
    timezone: string;
    advanceBookingDays: number;
    minNoticeHours: number;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // New blocked slot form
  const [showBlockedForm, setShowBlockedForm] = useState(false);
  const [newBlockedStartDate, setNewBlockedStartDate] = useState('');
  const [newBlockedStartTime, setNewBlockedStartTime] = useState('09:00');
  const [newBlockedEndDate, setNewBlockedEndDate] = useState('');
  const [newBlockedEndTime, setNewBlockedEndTime] = useState('17:00');
  const [newBlockedReason, setNewBlockedReason] = useState('');
  const [addingBlocked, setAddingBlocked] = useState(false);

  // Generate time options for blocked time selector (30-min increments)
  const TIME_OPTIONS = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const h = hour.toString().padStart(2, '0');
        const m = minute.toString().padStart(2, '0');
        const value = `${h}:${m}`;
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        const label = `${hour12}:${m.padStart(2, '0')} ${ampm}`;
        options.push({ value, label });
      }
    }
    return options;
  }, []);

  // Initialize local state when availability loads
  useState(() => {
    if (availability) {
      setLocalSchedule(availability.weeklySchedule);
      setLocalSettings({
        defaultDuration: availability.defaultDuration,
        bufferBetweenCalls: availability.bufferBetweenCalls,
        timezone: availability.timezone,
        advanceBookingDays: availability.advanceBookingDays,
        minNoticeHours: availability.minNoticeHours,
      });
    }
  });

  // Update local state when availability changes
  if (availability && !localSchedule) {
    setLocalSchedule(availability.weeklySchedule);
    setLocalSettings({
      defaultDuration: availability.defaultDuration,
      bufferBetweenCalls: availability.bufferBetweenCalls,
      timezone: availability.timezone,
      advanceBookingDays: availability.advanceBookingDays,
      minNoticeHours: availability.minNoticeHours,
    });
  }

  const handleDayUpdate = useCallback((day: number, slots: TimeSlot[]) => {
    setLocalSchedule(prev => prev ? { ...prev, [day]: slots } : null);
  }, []);

  const handleSaveSchedule = async () => {
    // In demo mode, open signup modal instead of saving
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    
    if (!localSchedule || !localSettings) return;

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      await updateAvailability({
        weeklySchedule: localSchedule,
        ...localSettings,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBlockedSlot = async () => {
    // In demo mode, open signup modal instead of adding
    if (isDemoMode) {
      openSignupModal();
      return;
    }

    if (!newBlockedStartDate || !newBlockedEndDate) return;

    // Combine date and time into ISO strings
    const startDateTime = `${newBlockedStartDate}T${newBlockedStartTime}:00`;
    const endDateTime = `${newBlockedEndDate}T${newBlockedEndTime}:00`;

    try {
      setAddingBlocked(true);
      await addBlockedSlot({
        start: startDateTime,
        end: endDateTime,
        reason: newBlockedReason || undefined,
      });
      setShowBlockedForm(false);
      setNewBlockedStartDate('');
      setNewBlockedStartTime('09:00');
      setNewBlockedEndDate('');
      setNewBlockedEndTime('17:00');
      setNewBlockedReason('');
    } catch (err) {
      // Error is handled by the hook
    } finally {
      setAddingBlocked(false);
    }
  };
  
  // Handler for removing blocked slot in demo mode
  const handleRemoveBlockedSlot = (slotId: string) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    removeBlockedSlot(slotId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="px-4 py-3 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-3">
          <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-albert">
              Demo Mode Active
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-albert">
              Showing sample availability settings for demonstration purposes
            </p>
          </div>
          <button
            onClick={openSignupModal}
            className="flex-shrink-0 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Start Free Trial
          </button>
        </div>
      )}

      {/* Calendar Sync Section - Only show in non-demo mode */}
      {!isDemoMode && <CalendarSyncSection />}

      {/* Weekly Schedule Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-accent/10 rounded-lg">
              <Clock className="w-5 h-5 text-brand-accent" />
            </div>
            <div>
              <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                Weekly Schedule
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                Set your available hours for each day of the week
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
          {localSchedule && DAYS_OF_WEEK.map(day => (
            <DayScheduleEditor
              key={day.value}
              day={day.value}
              slots={localSchedule[day.value] || []}
              onUpdate={(slots) => handleDayUpdate(day.value, slots)}
            />
          ))}
        </div>
      </div>

      {/* Settings Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-accent/10 rounded-lg">
              <Globe className="w-5 h-5 text-brand-accent" />
            </div>
            <div>
              <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                Scheduling Settings
              </h3>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                Configure your default call settings
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {localSettings && (
            <>
              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Your Timezone
                </label>
                <Select
                  value={localSettings.timezone}
                  onValueChange={(val) => setLocalSettings({ ...localSettings, timezone: val })}
                >
                  <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg max-h-60">
                    {COMMON_TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value} className="cursor-pointer font-albert">
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Default Duration */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Default Call Duration
                </label>
                <Select
                  value={String(localSettings.defaultDuration)}
                  onValueChange={(val) => setLocalSettings({ ...localSettings, defaultDuration: parseInt(val) })}
                >
                  <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg">
                    {DURATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={String(opt.value)} className="cursor-pointer font-albert">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Buffer */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Buffer Between Calls
                </label>
                <Select
                  value={String(localSettings.bufferBetweenCalls)}
                  onValueChange={(val) => setLocalSettings({ ...localSettings, bufferBetweenCalls: parseInt(val) })}
                >
                  <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg">
                    {BUFFER_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={String(opt.value)} className="cursor-pointer font-albert">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Advance Booking */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    Advance Booking (days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={localSettings.advanceBookingDays}
                    onChange={(e) => setLocalSettings({ ...localSettings, advanceBookingDays: parseInt(e.target.value) || 30 })}
                    className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    Minimum Notice (hours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={localSettings.minNoticeHours}
                    onChange={(e) => setLocalSettings({ ...localSettings, minNoticeHours: parseInt(e.target.value) || 24 })}
                    className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Blocked Times Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <Calendar className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Blocked Times
                </h3>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Block times you&apos;re unavailable
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowBlockedForm(true)}
              className="px-4 py-2 bg-[#1a1a1a] dark:bg-brand-accent text-white rounded-xl font-albert font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Block Time
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Add blocked slot form */}
          {showBlockedForm && (
            <div className="mb-6 p-4 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl space-y-4">
              {/* Start Date & Time */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Start
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <DatePicker
                    value={newBlockedStartDate}
                    onChange={(date) => {
                      setNewBlockedStartDate(date);
                      // Auto-set end date if not set or if end date is before start
                      if (!newBlockedEndDate || newBlockedEndDate < date) {
                        setNewBlockedEndDate(date);
                      }
                    }}
                    placeholder="Select date"
                    minDate={new Date()}
                    className="w-full"
                  />
                  <Select value={newBlockedStartTime} onValueChange={setNewBlockedStartTime}>
                    <SelectTrigger className="h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg max-h-60">
                      {TIME_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="cursor-pointer font-albert">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* End Date & Time */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  End
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <DatePicker
                    value={newBlockedEndDate}
                    onChange={setNewBlockedEndDate}
                    placeholder="Select date"
                    minDate={newBlockedStartDate ? new Date(newBlockedStartDate) : new Date()}
                    className="w-full"
                  />
                  <Select value={newBlockedEndTime} onValueChange={setNewBlockedEndTime}>
                    <SelectTrigger className="h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg max-h-60">
                      {TIME_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="cursor-pointer font-albert">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={newBlockedReason}
                  onChange={(e) => setNewBlockedReason(e.target.value)}
                  placeholder="e.g., Vacation, Personal appointment"
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowBlockedForm(false)}
                  className="px-4 py-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddBlockedSlot}
                  disabled={!newBlockedStartDate || !newBlockedEndDate || addingBlocked}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-albert font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addingBlocked && <Loader2 className="w-4 h-4 animate-spin" />}
                  Block Time
                </button>
              </div>
            </div>
          )}

          {/* Blocked slots list */}
          {availability?.blockedSlots && availability.blockedSlots.length > 0 ? (
            <div className="space-y-3">
              {availability.blockedSlots.map(slot => (
                <BlockedSlotCard
                  key={slot.id}
                  slot={slot}
                  onRemove={() => handleRemoveBlockedSlot(slot.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-[#a7a39e] dark:text-[#7d8190] py-8">
              No blocked times. Your weekly schedule is fully available.
            </p>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        {saveError && (
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{saveError}</span>
          </div>
        )}
        {saveSuccess && (
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">Settings saved successfully!</span>
          </div>
        )}
        {!saveError && !saveSuccess && <div />}
        
        <button
          onClick={handleSaveSchedule}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl font-albert font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Save Changes
        </button>
      </div>
    </div>
  );
}


