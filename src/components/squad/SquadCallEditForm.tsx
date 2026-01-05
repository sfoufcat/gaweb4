'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, X, Trash2, Repeat, Users, ChevronDown, ChevronUp, Image as ImageIcon, FileText, Plus } from 'lucide-react';
import type { Squad, RecurrenceFrequency, EventVisibility } from '@/types';
import { MediaUpload } from '@/components/admin/MediaUpload';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * SquadCallEditForm Component
 * 
 * Modal form for coaches to schedule/update squad calls.
 * Uses the unified events API.
 * 
 * Features:
 * - Date picker
 * - Time picker
 * - Timezone selector
 * - Location input
 * - Optional title
 * - Recurrence settings with smart summary
 * - Program visibility toggle
 * - Cancel confirmation for recurring events
 */

interface SquadCallEditFormProps {
  squad: Squad;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  existingEventId?: string; // If editing an existing event
}

// Common timezones for the dropdown
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
const LOCATION_PRESETS = [
  'Squad chat',
  'Zoom',
  'Google Meet',
  'Microsoft Teams',
];

// Recurrence options
const RECURRENCE_OPTIONS: { value: RecurrenceFrequency | 'none'; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

// Day names for display (plural form for recurrence summary)
const DAY_NAMES_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

// Helper to format time in 12-hour format
function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

// Helper to get day of week from date string (YYYY-MM-DD)
function getDayOfWeekFromDate(dateStr: string): number {
  if (!dateStr) return 1; // Default to Monday
  const date = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
  return date.getDay();
}

export function SquadCallEditForm({ 
  squad, 
  isOpen, 
  onClose, 
  onSuccess,
  existingEventId,
}: SquadCallEditFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [timezone, setTimezone] = useState('America/New_York');
  const [location, setLocation] = useState('Squad chat');
  const [customLocation, setCustomLocation] = useState('');
  const [title, setTitle] = useState('');
  
  // Track if using a preset or custom location
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  
  // Recurrence settings
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency | 'none'>('none');
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState(1); // Monday
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [showRecurrenceDetails, setShowRecurrenceDetails] = useState(false);
  
  // Visibility setting
  const [visibility, setVisibility] = useState<EventVisibility>('squad_only');
  
  // Rich content fields (optional)
  const [showRichContent, setShowRichContent] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [bulletPoints, setBulletPoints] = useState<string[]>(['']);
  const [additionalInfo, setAdditionalInfo] = useState({
    type: '',
    language: 'English',
    difficulty: 'All levels',
  });
  
  // Cancel confirmation dialog for recurring events
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  // Track if the event is recurring (for showing cancel options)
  const [isRecurringEvent, setIsRecurringEvent] = useState(false);
  
  // Whether we're editing an existing call (legacy or unified)
  const isEditing = !!existingEventId || !!squad.nextCallDateTime;
  
  // Auto-sync recurrence day of week when date changes
  useEffect(() => {
    if (date && (recurrence === 'weekly' || recurrence === 'biweekly')) {
      const dayOfWeek = getDayOfWeekFromDate(date);
      setRecurrenceDayOfWeek(dayOfWeek);
    }
  }, [date, recurrence]);
  
  // Build recurrence summary text
  const getRecurrenceSummary = (): string => {
    if (recurrence === 'none') return '';
    
    const timeStr = formatTime12Hour(time);
    const dayName = DAY_NAMES_PLURAL[recurrenceDayOfWeek];
    
    switch (recurrence) {
      case 'daily':
        return `Repeats daily at ${timeStr}`;
      case 'weekly':
        return `Repeats ${dayName} at ${timeStr}`;
      case 'biweekly':
        return `Repeats every 2 weeks on ${dayName} at ${timeStr}`;
      case 'monthly':
        return `Repeats monthly at ${timeStr}`;
      default:
        return '';
    }
  };
  
  // Initialize form with existing call data
  useEffect(() => {
    if (isOpen && squad) {
      // Check if there's an existing event to load
      if (existingEventId) {
        // Load from unified events API
        loadExistingEvent(existingEventId);
      } else if (squad.nextCallDateTime) {
        // Legacy: Load from squad fields
        loadFromSquadFields();
      } else {
        // Default values for new call
        setDefaultValues();
      }
      setError(null);
    }
  }, [isOpen, squad, existingEventId]);
  
  const loadExistingEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}`);
      if (response.ok) {
        const { event } = await response.json();
        
        const callDate = new Date(event.startDateTime);
        const callTz = event.timezone || 'America/New_York';
        
        setDate(formatDateForInput(callDate, callTz));
        setTime(formatTimeForInput(callDate, callTz));
        setTimezone(callTz);
        
        const loc = event.locationLabel || 'Squad chat';
        if (LOCATION_PRESETS.includes(loc)) {
          setLocation(loc);
          setUseCustomLocation(false);
        } else {
          setUseCustomLocation(true);
          setCustomLocation(loc);
        }
        
        setTitle(event.title || '');
        setVisibility(event.visibility || 'squad_only');
        
        // Load recurrence settings
        if (event.isRecurring && event.recurrence) {
          setRecurrence(event.recurrence.frequency);
          setIsRecurringEvent(true);
          if (event.recurrence.dayOfWeek !== undefined) {
            setRecurrenceDayOfWeek(event.recurrence.dayOfWeek);
          }
          if (event.recurrence.endDate) {
            setRecurrenceEndDate(event.recurrence.endDate);
          }
        } else {
          setRecurrence('none');
          setIsRecurringEvent(false);
        }
        
        // Load rich content fields
        setCoverImageUrl(event.coverImageUrl || '');
        setDescription(event.description || event.longDescription || '');
        setBulletPoints(event.bulletPoints?.length ? event.bulletPoints : ['']);
        setAdditionalInfo(event.additionalInfo || { type: '', language: 'English', difficulty: 'All levels' });
        setShowRichContent(!!(event.coverImageUrl || event.description || event.bulletPoints?.length));
      }
    } catch (err) {
      console.error('Error loading event:', err);
    }
  };
  
  const loadFromSquadFields = () => {
    const callDate = new Date(squad.nextCallDateTime!);
    const callTz = squad.nextCallTimezone || 'America/New_York';
    
    setDate(formatDateForInput(callDate, callTz));
    setTime(formatTimeForInput(callDate, callTz));
    setTimezone(callTz);
    
    const loc = squad.nextCallLocation || 'Squad chat';
    if (LOCATION_PRESETS.includes(loc)) {
      setLocation(loc);
      setUseCustomLocation(false);
    } else {
      setUseCustomLocation(true);
      setCustomLocation(loc);
    }
    
    setTitle(squad.nextCallTitle || '');
    setRecurrence('none');
    setIsRecurringEvent(false);
    setVisibility('squad_only');
  };
  
  const setDefaultValues = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7); // Default to next week
    setDate(tomorrow.toISOString().split('T')[0]);
    setTime('10:00');
    setTimezone(squad.timezone || 'America/New_York');
    setLocation('Squad chat');
    setCustomLocation('');
    setUseCustomLocation(false);
    setTitle('');
    setRecurrence('none');
    setRecurrenceEndDate('');
    setShowRecurrenceDetails(false);
    setIsRecurringEvent(false);
    setVisibility('squad_only');
    // Reset rich content
    setShowRichContent(false);
    setCoverImageUrl('');
    setDescription('');
    setBulletPoints(['']);
    setAdditionalInfo({ type: '', language: 'English', difficulty: 'All levels' });
  };
  
  const formatDateForInput = (date: Date, tz: string): string => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  };
  
  const formatTimeForInput = (date: Date, tz: string): string => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hour = parts.find(p => p.type === 'hour')?.value || '10';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    return `${hour}:${minute}`;
  };
  
  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setError(null);
    
    // Validate required fields
    if (!date || !time) {
      setError('Please select a date and time');
      return;
    }
    
    const finalLocation = useCustomLocation ? customLocation.trim() : location;
    if (!finalLocation) {
      setError('Please enter a location');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Construct the datetime in the selected timezone
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      
      // Create a date string that includes timezone context
      const localDate = new Date(year, month - 1, day, hours, minutes);
      
      // Convert to UTC for storage
      const dateInTz = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
      const utcDate = new Date(localDate.getTime() - (dateInTz.getTime() - localDate.getTime()));
      
      // Build recurrence pattern if needed
      const recurrencePattern = recurrence !== 'none' ? {
        frequency: recurrence,
        dayOfWeek: recurrence === 'weekly' || recurrence === 'biweekly' 
          ? recurrenceDayOfWeek 
          : undefined,
        dayOfMonth: recurrence === 'monthly' ? day : undefined,
        time: time,
        timezone: timezone,
        startDate: date,
        endDate: recurrenceEndDate || undefined,
      } : undefined;
      
      // Build event data
      const eventData = {
        title: title.trim() || 'Squad call',
        description: description.trim() || `Squad call for ${squad.name}`,
        startDateTime: utcDate.toISOString(),
        timezone,
        durationMinutes: 60,
        
        locationType: finalLocation.startsWith('http') ? 'online' : 'chat',
        locationLabel: finalLocation,
        meetingLink: finalLocation.startsWith('http') ? finalLocation : undefined,
        
        eventType: 'squad_call',
        scope: 'squad',
        participantModel: 'squad_members',
        approvalType: 'none',
        
        visibility,
        
        organizationId: squad.organizationId || undefined,
        programId: squad.programId || undefined,
        // Include programIds array for program content API compatibility
        programIds: squad.programId ? [squad.programId] : [],
        squadId: squad.id,
        cohortId: squad.cohortId || undefined,
        
        isRecurring: recurrence !== 'none',
        recurrence: recurrencePattern,
        
        isCoachLed: true,
        
        chatChannelId: squad.chatChannelId || undefined,
        sendChatReminders: true,
        
        // Rich content fields
        coverImageUrl: coverImageUrl || undefined,
        bulletPoints: bulletPoints.filter(bp => bp.trim()),
        additionalInfo: (additionalInfo.type || additionalInfo.language || additionalInfo.difficulty) 
          ? additionalInfo 
          : undefined,
        longDescription: description.trim() || undefined,
        shortDescription: description.trim() ? description.substring(0, 200) : undefined,
      };
      
      let response;

      if (existingEventId) {
        // Update existing unified event
        response = await fetch(`/api/events/${existingEventId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
      } else {
        // Create new event
        response = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
      }
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save call details');
      }
      
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error saving call details:', err);
      setError(err instanceof Error ? err.message : 'Failed to save call details');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handler to initiate delete - shows confirmation for recurring events
  const handleDeleteClick = () => {
    if (isRecurringEvent || recurrence !== 'none') {
      setShowCancelDialog(true);
    } else {
      handleDelete(false);
    }
  };
  
  const handleDelete = async (cancelAllFuture: boolean) => {
    if (isDeleting) return;
    
    try {
      setIsDeleting(true);
      setError(null);
      setShowCancelDialog(false);
      
      if (existingEventId) {
        // Delete unified event with optional cancelFuture param
        const url = cancelAllFuture 
          ? `/api/events/${existingEventId}?cancelFuture=true`
          : `/api/events/${existingEventId}`;
        const response = await fetch(url, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to remove call');
        }
      } else if (squad.nextCallDateTime) {
        // Legacy: Delete via squad API
        const response = await fetch(`/api/coach/squads/${squad.id}/call`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to remove call');
        }
      }
      
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error deleting call:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove call');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Get minimum date (today)
  const minDate = new Date().toISOString().split('T')[0];
  
  // Show program visibility toggle only if squad has a program
  const showVisibilityToggle = !!squad.programId;
  
  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-albert text-[20px] tracking-[-0.5px] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-accent" />
              {isEditing ? 'Edit squad call' : 'Schedule squad call'}
            </DialogTitle>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-red-600 dark:text-red-400 text-sm font-albert">{error}</p>
            </div>
          )}
          
          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div>
              <label className="block font-albert font-medium text-[14px] text-text-primary dark:text-[#f5f5f8] mb-2">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={minDate}
                className="w-full px-4 py-3 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all"
              />
            </div>
            
            {/* Time */}
            <div>
              <label className="block font-albert font-medium text-[14px] text-text-primary dark:text-[#f5f5f8] mb-2">
                Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary dark:text-[#7d8190]" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all"
                />
              </div>
            </div>
          </div>
          
          {/* Timezone */}
          <div>
            <label className="block font-albert font-medium text-[14px] text-text-primary dark:text-[#f5f5f8] mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all appearance-none cursor-pointer"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Recurrence */}
          <div>
            <label className="block font-albert font-medium text-[14px] text-text-primary dark:text-[#f5f5f8] mb-2">
              <Repeat className="inline w-4 h-4 mr-1 -mt-0.5" />
              Repeat
            </label>
            <select
              value={recurrence}
              onChange={(e) => {
                const newValue = e.target.value as RecurrenceFrequency | 'none';
                setRecurrence(newValue);
                // Auto-sync day of week when switching to weekly/biweekly
                if ((newValue === 'weekly' || newValue === 'biweekly') && date) {
                  setRecurrenceDayOfWeek(getDayOfWeekFromDate(date));
                }
              }}
              className="w-full px-4 py-3 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all appearance-none cursor-pointer"
            >
              {RECURRENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            {/* Recurrence Summary - clickable to expand/edit */}
            {recurrence !== 'none' && (
              <button
                type="button"
                onClick={() => setShowRecurrenceDetails(!showRecurrenceDetails)}
                className="mt-2 w-full flex items-center justify-between px-3 py-2 bg-[#f9f7f5] dark:bg-[#1c2028] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-left group hover:border-brand-accent transition-colors"
              >
                <span className="font-albert text-[13px] text-brand-accent font-medium">
                  {getRecurrenceSummary()}
                </span>
                {showRecurrenceDetails ? (
                  <ChevronUp className="w-4 h-4 text-text-secondary group-hover:text-brand-accent transition-colors" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-secondary group-hover:text-brand-accent transition-colors" />
                )}
              </button>
            )}
          </div>
          
          {/* Recurrence Details (expanded) */}
          {recurrence !== 'none' && showRecurrenceDetails && (
            <div className="space-y-4 p-4 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
              {/* Day selector note */}
              {(recurrence === 'weekly' || recurrence === 'biweekly') && (
                <p className="font-albert text-[12px] text-text-secondary dark:text-[#7d8190]">
                  The repeat day is automatically set based on the date you selected ({DAY_NAMES_PLURAL[recurrenceDayOfWeek]}).
                </p>
              )}
              
              {/* End Date */}
              <div>
                <label className="block font-albert font-medium text-[13px] text-text-primary dark:text-[#f5f5f8] mb-2">
                  End date <span className="text-text-secondary font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  min={date}
                  className="w-full px-3 py-2 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg font-albert text-[13px] text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all"
                />
              </div>
            </div>
          )}
          
          {/* Location */}
          <div>
            <label className="block font-albert font-medium text-[14px] text-text-primary dark:text-[#f5f5f8] mb-2">
              <MapPin className="inline w-4 h-4 mr-1 -mt-0.5" />
              Location
            </label>
            
            {!useCustomLocation ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {LOCATION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLocation(preset)}
                      className={`px-3 py-1.5 rounded-full font-albert text-[13px] transition-all ${
                        location === preset
                          ? 'bg-brand-accent text-white'
                          : 'bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] hover:bg-[#e9e5e0] dark:hover:bg-[#2e333d]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setUseCustomLocation(true)}
                  className="text-[13px] text-brand-accent hover:underline font-albert"
                >
                  + Add custom location/link
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="e.g., https://zoom.us/j/... or meeting room name"
                  className="w-full px-4 py-3 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-text-primary dark:text-[#f5f5f8] placeholder:text-text-secondary/60 dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomLocation(false);
                    setCustomLocation('');
                  }}
                  className="text-[13px] text-brand-accent hover:underline font-albert"
                >
                  ← Use preset location
                </button>
              </div>
            )}
          </div>
          
          {/* Title (Optional) */}
          <div>
            <label className="block font-albert font-medium text-[14px] text-text-primary dark:text-[#f5f5f8] mb-2">
              Title <span className="text-text-secondary dark:text-[#7d8190] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Squad coaching call"
              className="w-full px-4 py-3 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-text-primary dark:text-[#f5f5f8] placeholder:text-text-secondary/60 dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all"
            />
          </div>
          
          {/* Program Visibility Toggle */}
          {showVisibilityToggle && (
            <div className="p-4 bg-[#f3f1ef] dark:bg-[#171b22] rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={visibility === 'program_wide'}
                  onChange={(e) => setVisibility(e.target.checked ? 'program_wide' : 'squad_only')}
                  className="mt-1 w-5 h-5 rounded-md border-2 border-[#d4cfc9] dark:border-[#3a3f4a] text-brand-accent focus:ring-brand-accent dark:ring-brand-accent focus:ring-offset-0 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-accent" />
                    <span className="font-albert font-medium text-[14px] text-text-primary dark:text-[#f5f5f8]">
                      Show on program calendar
                    </span>
                  </div>
                  <p className="text-[12px] text-text-secondary dark:text-[#7d8190] mt-1 leading-relaxed">
                    Make this call visible to all program enrollees, not just squad members.
                  </p>
                </div>
              </label>
            </div>
          )}
          
          {/* Rich Content Section (Collapsible) */}
          <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-4">
            <button
              type="button"
              onClick={() => setShowRichContent(!showRichContent)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-accent" />
                <span className="font-albert font-medium text-[14px] text-text-primary dark:text-[#f5f5f8]">
                  Add details for event page
                </span>
                <span className="text-[12px] text-text-secondary dark:text-[#7d8190]">(optional)</span>
              </div>
              {showRichContent ? (
                <ChevronUp className="w-4 h-4 text-text-secondary group-hover:text-brand-accent transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-secondary group-hover:text-brand-accent transition-colors" />
              )}
            </button>
            
            {showRichContent && (
              <div className="mt-4 space-y-4 p-4 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
                {/* Cover Image */}
                <div>
                  <label className="block font-albert font-medium text-[13px] text-text-primary dark:text-[#f5f5f8] mb-2">
                    <ImageIcon className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                    Cover Image
                  </label>
                  <MediaUpload
                    value={coverImageUrl}
                    onChange={setCoverImageUrl}
                    folder="events"
                    type="image"
                    uploadEndpoint="/api/coach/org-upload-media"
                    hideLabel
                    aspectRatio="16:9"
                  />
                </div>
                
                {/* Description */}
                <div>
                  <label className="block font-albert font-medium text-[13px] text-text-primary dark:text-[#f5f5f8] mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What will this call cover?"
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg font-albert text-[13px] text-text-primary dark:text-[#f5f5f8] placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all resize-none"
                  />
                </div>
                
                {/* Bullet Points */}
                <div>
                  <label className="block font-albert font-medium text-[13px] text-text-primary dark:text-[#f5f5f8] mb-2">
                    Key takeaways
                  </label>
                  <div className="space-y-2">
                    {bulletPoints.map((bp, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={bp}
                          onChange={(e) => {
                            const newPoints = [...bulletPoints];
                            newPoints[index] = e.target.value;
                            setBulletPoints(newPoints);
                          }}
                          placeholder="What attendees will learn..."
                          className="flex-1 px-3 py-2 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg font-albert text-[13px] text-text-primary dark:text-[#f5f5f8] placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all"
                        />
                        {bulletPoints.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setBulletPoints(bulletPoints.filter((_, i) => i !== index))}
                            className="px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBulletPoints([...bulletPoints, ''])}
                      className="flex items-center gap-1 text-[12px] text-brand-accent hover:text-brand-accent/90 dark:hover:text-[#d4a57a] font-albert"
                    >
                      <Plus className="w-3 h-3" />
                      Add bullet point
                    </button>
                  </div>
                </div>
                
                {/* Additional Info */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Type</label>
                    <input
                      type="text"
                      value={additionalInfo.type}
                      onChange={(e) => setAdditionalInfo({ ...additionalInfo, type: e.target.value })}
                      placeholder="Q&A"
                      className="w-full px-2 py-1.5 text-[12px] bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Language</label>
                    <input
                      type="text"
                      value={additionalInfo.language}
                      onChange={(e) => setAdditionalInfo({ ...additionalInfo, language: e.target.value })}
                      className="w-full px-2 py-1.5 text-[12px] bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Level</label>
                    <input
                      type="text"
                      value={additionalInfo.difficulty}
                      onChange={(e) => setAdditionalInfo({ ...additionalInfo, difficulty: e.target.value })}
                      className="w-full px-2 py-1.5 text-[12px] bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          {/* Delete button - only show if editing */}
          {isEditing && (
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting || isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full font-albert text-sm transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Removing...' : 'Remove call'}
            </button>
          )}
          
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <button 
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="mt-2 sm:mt-0 inline-flex h-10 items-center justify-center rounded-full border border-[#e1ddd8] dark:border-[#262b35] bg-background dark:bg-[#1e222a] px-4 py-2 text-sm font-semibold ring-offset-background transition-colors hover:bg-accent dark:hover:bg-[#262b35] hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 font-albert flex-1 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isDeleting}
              className="inline-flex h-10 items-center justify-center px-4 py-2 font-albert rounded-full bg-brand-accent hover:bg-brand-accent/90 text-white text-sm font-semibold flex-1 sm:flex-none disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update call' : 'Schedule call'}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Cancel Confirmation Dialog for Recurring Events */}
    <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-albert text-[18px] tracking-[-0.3px]">
            Cancel recurring call?
          </AlertDialogTitle>
          <AlertDialogDescription className="font-albert text-[14px] text-text-secondary dark:text-[#7d8190]">
            This is a recurring event. Would you like to cancel just the next occurrence or all future calls?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex flex-col gap-2 py-2">
          <button
            onClick={() => handleDelete(false)}
            disabled={isDeleting}
            className="w-full px-4 py-3 bg-[#f3f1ef] dark:bg-[#262b35] hover:bg-[#e9e5e0] dark:hover:bg-[#2e333d] rounded-xl font-albert text-[14px] text-text-primary dark:text-[#f5f5f8] text-left transition-colors disabled:opacity-50"
          >
            <span className="font-medium">Cancel this call only</span>
            <p className="text-[12px] text-text-secondary dark:text-[#7d8190] mt-0.5">
              Future calls in this series will continue as scheduled
            </p>
          </button>
          
          <button
            onClick={() => handleDelete(true)}
            disabled={isDeleting}
            className="w-full px-4 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl font-albert text-[14px] text-red-700 dark:text-red-400 text-left transition-colors disabled:opacity-50"
          >
            <span className="font-medium">Cancel all future calls</span>
            <p className="text-[12px] text-red-600/70 dark:text-red-400/70 mt-0.5">
              This will cancel the entire recurring series
            </p>
          </button>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel 
            disabled={isDeleting}
            className="font-albert rounded-full border-[#e1ddd8] dark:border-[#262b35]"
          >
            Keep call
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
