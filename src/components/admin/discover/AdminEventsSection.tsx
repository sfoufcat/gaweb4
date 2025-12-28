'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, MapPin, Repeat, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import type { DiscoverEvent } from '@/types/discover';
import type { RecurrenceFrequency } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { ContentPricingFields, getDefaultPricingData, type ContentPricingData } from '@/components/admin/ContentPricingFields';

// Common timezones (same as SquadCallEditForm)
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC' },
];

// Location presets
const LOCATION_OPTIONS = [
  { value: 'zoom', label: 'Zoom' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'microsoft_teams', label: 'Microsoft Teams' },
  { value: 'in_person', label: 'In-person' },
  { value: 'other', label: 'Other' },
];

// Recurrence options
const RECURRENCE_OPTIONS: { value: RecurrenceFrequency | 'none'; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

// Day names for recurrence display
const DAY_NAMES_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

// Helper to format time in 12-hour format
function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

// Helper to get day of week from date string
function getDayOfWeekFromDate(dateStr: string): number {
  if (!dateStr) return 1;
  const date = new Date(dateStr + 'T12:00:00');
  return date.getDay();
}

// Coach type for host selector
interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
}

// Event Form Dialog - Refactored to create UnifiedEvent objects
function EventFormDialog({
  event,
  isOpen,
  onClose,
  onSave,
  uploadEndpoint,
  apiEndpoint,
}: {
  event: DiscoverEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  uploadEndpoint: string;
  apiEndpoint: string;
}) {
  const isEditing = !!event;
  const [saving, setSaving] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showRecurrenceDetails, setShowRecurrenceDetails] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  
  // Derive API context
  const isCoachContext = apiEndpoint.includes('/coach/');
  const coachesApiEndpoint = '/api/coach/org-coaches';
  const programsApiEndpoint = isCoachContext ? '/api/coach/org-programs' : '/api/admin/programs';
  
  const [formData, setFormData] = useState({
    title: '',
    coverImageUrl: '',
    date: '',
    time: '10:00',
    durationMinutes: 60,
    timezone: 'America/New_York',
    location: 'zoom' as string,
    meetingLink: '',
    description: '',
    bulletPoints: [''],
    additionalInfo: { type: '', language: 'English', difficulty: 'All levels' },
    hostUserId: '',
    featured: false,
    category: '',
    programIds: [] as string[],
    maxAttendees: '',
    // Recurrence
    recurrence: 'none' as RecurrenceFrequency | 'none',
    recurrenceDayOfWeek: 1,
    recurrenceEndDate: '',
    // Pricing
    pricing: getDefaultPricingData() as ContentPricingData,
  });

  // Fetch coaches on mount
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const response = await fetch(coachesApiEndpoint);
        if (response.ok) {
          const data = await response.json();
          setCoaches(data.coaches || []);
        }
      } catch (error) {
        console.error('Failed to fetch coaches:', error);
      } finally {
        setLoadingCoaches(false);
      }
    };
    fetchCoaches();
  }, [coachesApiEndpoint]);

  // Auto-sync recurrence day when date changes
  useEffect(() => {
    if (formData.date && (formData.recurrence === 'weekly' || formData.recurrence === 'biweekly')) {
      setFormData(prev => ({ ...prev, recurrenceDayOfWeek: getDayOfWeekFromDate(prev.date) }));
    }
  }, [formData.date, formData.recurrence]);

  useEffect(() => {
    if (event) {
      // Parse existing event data (may be DiscoverEvent or UnifiedEvent format)
      const startTime = event.startTime || '10:00';
      const endTime = event.endTime || '11:00';
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const durationMinutes = ((endH * 60 + endM) - (startH * 60 + startM)) || 60;
      
      // Determine location type from existing data
      let locationValue = 'other';
      const label = (event.locationLabel || '').toLowerCase();
      if (label.includes('zoom')) locationValue = 'zoom';
      else if (label.includes('google') || label.includes('meet')) locationValue = 'google_meet';
      else if (label.includes('teams')) locationValue = 'microsoft_teams';
      else if (event.locationType === 'in_person') locationValue = 'in_person';
      
      setFormData({
        title: event.title || '',
        coverImageUrl: event.coverImageUrl || '',
        date: event.date || '',
        time: startTime,
        durationMinutes,
        timezone: event.timezone || 'America/New_York',
        location: locationValue,
        meetingLink: event.zoomLink || '',
        description: event.longDescription || event.shortDescription || '',
        bulletPoints: event.bulletPoints?.length ? event.bulletPoints : [''],
        additionalInfo: event.additionalInfo || { type: '', language: 'English', difficulty: 'All levels' },
        hostUserId: '', // Will need to match by name if migrating
        featured: event.featured || false,
        category: event.category || '',
        programIds: event.programIds || [],
        maxAttendees: event.maxAttendees?.toString() || '',
        recurrence: 'none',
        recurrenceDayOfWeek: 1,
        recurrenceEndDate: '',
        pricing: {
          priceInCents: event.priceInCents ?? null,
          currency: event.currency || 'USD',
          purchaseType: event.purchaseType || 'popup',
          isPublic: event.isPublic !== false,
        },
      });
      setShowImagePreview(!!event.coverImageUrl);
    } else {
      // Default values for new event
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setFormData({
        title: '',
        coverImageUrl: '',
        date: nextWeek.toISOString().split('T')[0],
        time: '10:00',
        durationMinutes: 60,
        timezone: 'America/New_York',
        location: 'zoom',
        meetingLink: '',
        description: '',
        bulletPoints: [''],
        additionalInfo: { type: '', language: 'English', difficulty: 'All levels' },
        hostUserId: '',
        featured: false,
        category: '',
        programIds: [],
        maxAttendees: '',
        recurrence: 'none',
        recurrenceDayOfWeek: 1,
        recurrenceEndDate: '',
        pricing: getDefaultPricingData(),
      });
      setShowImagePreview(false);
      setShowRecurrenceDetails(false);
    }
  }, [event, isOpen]);

  // Get recurrence summary text
  const getRecurrenceSummary = (): string => {
    if (formData.recurrence === 'none') return '';
    const timeStr = formatTime12Hour(formData.time);
    const dayName = DAY_NAMES_PLURAL[formData.recurrenceDayOfWeek];
    switch (formData.recurrence) {
      case 'daily': return `Repeats daily at ${timeStr}`;
      case 'weekly': return `Repeats ${dayName} at ${timeStr}`;
      case 'biweekly': return `Repeats every 2 weeks on ${dayName} at ${timeStr}`;
      case 'monthly': return `Repeats monthly at ${timeStr}`;
      default: return '';
    }
  };

  // Get location label for display
  const getLocationLabel = (): string => {
    switch (formData.location) {
      case 'zoom': return 'Zoom';
      case 'google_meet': return 'Google Meet';
      case 'microsoft_teams': return 'Microsoft Teams';
      case 'in_person': return 'In-person';
      default: return 'Other';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Get selected host info
      const selectedHost = coaches.find(c => c.id === formData.hostUserId);
      
      // Build the payload as UnifiedEvent-compatible
      const payload = {
        title: formData.title,
        coverImageUrl: formData.coverImageUrl || null,
        date: formData.date,
        startTime: formData.time,
        endTime: calculateEndTime(formData.time, formData.durationMinutes),
        timezone: formData.timezone,
        durationMinutes: formData.durationMinutes,
        locationType: formData.location === 'in_person' ? 'in_person' : 'online',
        locationLabel: getLocationLabel(),
        meetingLink: formData.meetingLink || null,
        shortDescription: formData.description.substring(0, 200),
        longDescription: formData.description,
        bulletPoints: formData.bulletPoints.filter(bp => bp.trim()),
        additionalInfo: formData.additionalInfo,
        hostUserId: formData.hostUserId || null,
        hostName: selectedHost ? `${selectedHost.firstName} ${selectedHost.lastName}`.trim() : '',
        hostAvatarUrl: selectedHost?.imageUrl || null,
        featured: formData.featured,
        category: formData.category || null,
        programIds: formData.programIds,
        maxAttendees: formData.maxAttendees ? parseInt(formData.maxAttendees) : null,
        // Recurrence
        isRecurring: formData.recurrence !== 'none',
        recurrence: formData.recurrence !== 'none' ? {
          frequency: formData.recurrence,
          dayOfWeek: (formData.recurrence === 'weekly' || formData.recurrence === 'biweekly') 
            ? formData.recurrenceDayOfWeek : undefined,
          time: formData.time,
          timezone: formData.timezone,
          startDate: formData.date,
          endDate: formData.recurrenceEndDate || undefined,
        } : null,
        // Pricing
        priceInCents: formData.pricing.priceInCents,
        currency: formData.pricing.currency,
        purchaseType: formData.pricing.purchaseType,
        isPublic: formData.pricing.isPublic,
      };

      const url = isEditing 
        ? `${apiEndpoint}/${event!.id}`
        : apiEndpoint;
      
      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save event');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving event:', err);
      alert(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  // Calculate end time from start time and duration
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  const addBulletPoint = () => {
    setFormData(prev => ({ ...prev, bulletPoints: [...prev.bulletPoints, ''] }));
  };

  const removeBulletPoint = (index: number) => {
    setFormData(prev => ({
      ...prev,
      bulletPoints: prev.bulletPoints.filter((_, i) => i !== index),
    }));
  };

  const updateBulletPoint = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      bulletPoints: prev.bulletPoints.map((bp, i) => i === index ? value : bp),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl shadow-black/10 dark:shadow-black/30 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#a07855]" />
              {isEditing ? 'Edit Event' : 'Create Event'}
            </h2>
          </div>

          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                placeholder="Event title..."
              />
            </div>

            {/* Cover Image - Compact with click to expand */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                Cover Image <span className="text-text-muted text-xs font-normal">(optional)</span>
              </label>
              {formData.coverImageUrl && !showImagePreview ? (
                <button
                  type="button"
                  onClick={() => setShowImagePreview(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[#a07855] hover:text-[#8c6245] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:bg-[#faf8f6] dark:hover:bg-[#1c2028] transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Image uploaded - Click to change</span>
                </button>
              ) : (
                <div className={showImagePreview ? '' : ''}>
                  <MediaUpload
                    value={formData.coverImageUrl}
                    onChange={(url) => setFormData(prev => ({ ...prev, coverImageUrl: url }))}
                    folder="events"
                    type="image"
                    uploadEndpoint={uploadEndpoint}
                    hideLabel
                    previewSize="thumbnail"
                  />
                  {showImagePreview && formData.coverImageUrl && (
                    <button
                      type="button"
                      onClick={() => setShowImagePreview(false)}
                      className="mt-2 text-xs text-text-secondary hover:text-[#a07855]"
                    >
                      Collapse preview
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Date, Time & Duration Row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                  <Clock className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.time}
                  onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Duration</label>
                <select
                  value={formData.durationMinutes}
                  onChange={e => setFormData(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Timezone</label>
              <select
                value={formData.timezone}
                onChange={e => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Recurrence */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                <Repeat className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                Repeat
              </label>
              <select
                value={formData.recurrence}
                onChange={e => {
                  const newValue = e.target.value as RecurrenceFrequency | 'none';
                  setFormData(prev => ({ 
                    ...prev, 
                    recurrence: newValue,
                    recurrenceDayOfWeek: (newValue === 'weekly' || newValue === 'biweekly') && prev.date 
                      ? getDayOfWeekFromDate(prev.date) 
                      : prev.recurrenceDayOfWeek
                  }));
                }}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
              >
                {RECURRENCE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              
              {formData.recurrence !== 'none' && (
                <button
                  type="button"
                  onClick={() => setShowRecurrenceDetails(!showRecurrenceDetails)}
                  className="mt-2 w-full flex items-center justify-between px-3 py-2 bg-[#f9f7f5] dark:bg-[#1c2028] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-left group hover:border-[#a07855] transition-colors"
                >
                  <span className="font-albert text-[13px] text-[#a07855] dark:text-[#b8896a]">
                    {getRecurrenceSummary()}
                  </span>
                  {showRecurrenceDetails ? (
                    <ChevronUp className="w-4 h-4 text-text-secondary" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-secondary" />
                  )}
                </button>
              )}
              
              {formData.recurrence !== 'none' && showRecurrenceDetails && (
                <div className="mt-2 p-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]">
                  {(formData.recurrence === 'weekly' || formData.recurrence === 'biweekly') && (
                    <p className="text-xs text-text-secondary mb-2">
                      Repeat day is auto-set from selected date ({DAY_NAMES_PLURAL[formData.recurrenceDayOfWeek]}).
                    </p>
                  )}
                  <label className="block text-xs font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                    End date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.recurrenceEndDate}
                    onChange={e => setFormData(prev => ({ ...prev, recurrenceEndDate: e.target.value }))}
                    min={formData.date}
                    className="w-full px-2 py-1.5 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                  />
                </div>
              )}
            </div>

            {/* Attach to Programs - MOVED ABOVE LOCATION */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                Attach to program(s)
              </label>
              <ProgramSelector
                value={formData.programIds}
                onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
                placeholder="Select programs..."
                programsApiEndpoint={programsApiEndpoint}
              />
              <p className="text-xs text-text-secondary dark:text-[#7d8190] mt-1">
                If selected, it will only show for these programs. Leave empty for all users.
              </p>
            </div>

            {/* Location - Simplified */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                <MapPin className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                Location
              </label>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={formData.location}
                  onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                >
                  {LOCATION_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {formData.location !== 'in_person' && (
                  <input
                    type="url"
                    value={formData.meetingLink}
                    onChange={e => setFormData(prev => ({ ...prev, meetingLink: e.target.value }))}
                    placeholder="Meeting URL..."
                    className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                  />
                )}
              </div>
            </div>

            {/* Host - Select from coaches */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Host</label>
              <select
                value={formData.hostUserId}
                onChange={e => setFormData(prev => ({ ...prev, hostUserId: e.target.value }))}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
              >
                <option value="">{loadingCoaches ? 'Loading coaches...' : 'Select a host...'}</option>
                {coaches.map(coach => (
                  <option key={coach.id} value={coach.id}>
                    {coach.firstName} {coach.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Category - Use CategorySelector */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Category</label>
              <CategorySelector
                value={formData.category}
                onChange={(category) => setFormData(prev => ({ ...prev, category }))}
                placeholder="Select or create category..."
              />
            </div>

            {/* Description */}
            <RichTextEditor
              value={formData.description}
              onChange={(description) => setFormData(prev => ({ ...prev, description }))}
              label="Description"
              rows={4}
              placeholder="Event description..."
              showMediaToolbar={true}
              mediaFolder="events"
              uploadEndpoint={uploadEndpoint}
            />

            {/* Bullet Points */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                Key takeaways <span className="text-text-muted text-xs font-normal">(optional)</span>
              </label>
              <div className="space-y-2">
                {formData.bulletPoints.map((bp, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={bp}
                      onChange={e => updateBulletPoint(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                      placeholder="What attendees will learn..."
                    />
                    <button
                      type="button"
                      onClick={() => removeBulletPoint(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBulletPoint}
                  className="text-sm text-[#a07855] hover:text-[#8c6245] font-albert"
                >
                  + Add bullet point
                </button>
              </div>
            </div>

            {/* Additional Info - Collapsed section */}
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-[#a07855] hover:text-[#8c6245] font-albert list-none flex items-center gap-1">
                <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                Additional details (type, language, difficulty)
              </summary>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-albert">Event Type</label>
                  <input
                    type="text"
                    value={formData.additionalInfo.type}
                    onChange={e => setFormData(prev => ({ ...prev, additionalInfo: { ...prev.additionalInfo, type: e.target.value } }))}
                    className="w-full px-2 py-1.5 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                    placeholder="Live workshop"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-albert">Language</label>
                  <input
                    type="text"
                    value={formData.additionalInfo.language}
                    onChange={e => setFormData(prev => ({ ...prev, additionalInfo: { ...prev.additionalInfo, language: e.target.value } }))}
                    className="w-full px-2 py-1.5 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-albert">Difficulty</label>
                  <input
                    type="text"
                    value={formData.additionalInfo.difficulty}
                    onChange={e => setFormData(prev => ({ ...prev, additionalInfo: { ...prev.additionalInfo, difficulty: e.target.value } }))}
                    className="w-full px-2 py-1.5 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                  />
                </div>
              </div>
            </details>

            {/* Pricing & Access */}
            <ContentPricingFields
              value={formData.pricing}
              onChange={(pricing) => setFormData(prev => ({ ...prev, pricing }))}
            />

            {/* Max Attendees */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Max Attendees</label>
                <input
                  type="number"
                  value={formData.maxAttendees}
                  onChange={e => setFormData(prev => ({ ...prev, maxAttendees: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                  placeholder="Leave empty for unlimited"
                />
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <BrandedCheckbox
                    checked={formData.featured}
                    onChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
                  />
                  <span 
                    className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer" 
                    onClick={() => setFormData(prev => ({ ...prev, featured: !prev.featured }))}
                  >
                    Featured Event
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5 font-albert"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#a07855] hover:bg-[#8c6245] text-white font-albert"
            >
              {saving ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AdminEventsSectionProps {
  apiEndpoint?: string;
}

export function AdminEventsSection({ apiEndpoint = '/api/admin/discover/events' }: AdminEventsSectionProps) {
  const [events, setEvents] = useState<DiscoverEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventToEdit, setEventToEdit] = useState<DiscoverEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<DiscoverEvent | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derive upload endpoint from API endpoint - use coach upload for coach routes
  const uploadEndpoint = apiEndpoint.includes('/coach/') 
    ? '/api/coach/org-upload-media' 
    : '/api/admin/upload-media';

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch events');
      }
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEvents = useMemo(() => {
    let filtered = events;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        (event.hostName || '').toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [events, searchQuery]);

  const handleDelete = async () => {
    if (!eventToDelete) return;
    
    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/admin/discover/events/${eventToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event');
      }
      
      await fetchEvents();
      setEventToDelete(null);
    } catch (err) {
      console.error('Error deleting event:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          <div className="h-10 w-28 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
              <div className="w-16 h-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-4 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-4 w-40 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button onClick={fetchEvents} className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Events</h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mt-1">
                {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-64 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#7d8190]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <Button
                onClick={() => { setEventToEdit(null); setIsFormOpen(true); }}
                className="bg-[#a07855] hover:bg-[#8c6245] text-white font-albert"
              >
                + Create Event
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-albert">Title</TableHead>
                <TableHead className="font-albert">Date</TableHead>
                <TableHead className="font-albert">Time</TableHead>
                <TableHead className="font-albert">Location</TableHead>
                <TableHead className="font-albert">Host</TableHead>
                <TableHead className="font-albert">Featured</TableHead>
                <TableHead className="font-albert text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map(event => (
                <TableRow key={event.id}>
                  <TableCell className="font-albert font-medium max-w-[200px] truncate">
                    {event.title}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {formatDate(event.date)}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {event.startTime}–{event.endTime} {event.timezone}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.locationLabel || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {event.hostName || '—'}
                  </TableCell>
                  <TableCell>
                    {event.featured ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-albert">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Featured
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-albert">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEventToEdit(event); setIsFormOpen(true); }}
                        className="text-[#a07855] hover:text-[#8c6245] hover:bg-[#a07855]/10 font-albert"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEventToDelete(event)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 font-albert"
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredEvents.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert">No events found</p>
          </div>
        )}
      </div>

      {/* Event Form Dialog */}
      <EventFormDialog
        event={eventToEdit}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEventToEdit(null); }}
        onSave={fetchEvents}
        uploadEndpoint={uploadEndpoint}
        apiEndpoint={apiEndpoint}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!eventToDelete} onOpenChange={open => !open && setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Delete Event</AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              Are you sure you want to delete &quot;<strong>{eventToDelete?.title}</strong>&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} className="font-albert">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 font-albert"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

