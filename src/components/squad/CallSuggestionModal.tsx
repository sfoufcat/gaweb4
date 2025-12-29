'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, X, Trash2 } from 'lucide-react';
import type { Squad, UnifiedEvent } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * CallSuggestionModal Component
 * 
 * Modal for suggesting a new squad call or proposing edits/deletion.
 * Used by StandardSquadCallCard for standard (non-premium) squads.
 * Uses the unified events API.
 * 
 * Features:
 * - Date picker
 * - Time picker  
 * - Timezone selector
 * - Location input (presets + custom)
 * - Optional title
 * - Delete option (when editing existing event)
 */

interface CallSuggestionModalProps {
  squad: Squad;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  existingEvent?: UnifiedEvent | null; // For editing existing events
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

export function CallSuggestionModal({ 
  squad, 
  isOpen, 
  onClose, 
  onSuccess,
  existingEvent,
}: CallSuggestionModalProps) {
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

  const isEditMode = existingEvent && existingEvent.status === 'confirmed';
  
  // Initialize form with existing event data or defaults
  useEffect(() => {
    if (isOpen) {
      if (existingEvent && existingEvent.startDateTime) {
        const eventDate = new Date(existingEvent.startDateTime);
        const eventTz = existingEvent.timezone || 'America/New_York';
        
        // Format date in the event's timezone
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: eventTz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        setDate(dateFormatter.format(eventDate));
        
        // Format time in the event's timezone
        const timeFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: eventTz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const timeParts = timeFormatter.formatToParts(eventDate);
        const hour = timeParts.find(p => p.type === 'hour')?.value || '10';
        const minute = timeParts.find(p => p.type === 'minute')?.value || '00';
        setTime(`${hour}:${minute}`);
        
        setTimezone(eventTz);
        
        // Check if location is a preset
        const loc = existingEvent.locationLabel || 'Squad chat';
        if (LOCATION_PRESETS.includes(loc)) {
          setLocation(loc);
          setUseCustomLocation(false);
        } else {
          setUseCustomLocation(true);
          setCustomLocation(loc);
        }
        
        setTitle(existingEvent.title !== 'Squad accountability call' ? existingEvent.title : '');
      } else {
        // Default values for new event
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        setDate(nextWeek.toISOString().split('T')[0]);
        setTime('10:00');
        
        // Try to use user's timezone
        try {
          const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (COMMON_TIMEZONES.some(tz => tz.value === userTz)) {
            setTimezone(userTz);
          } else {
            setTimezone(squad.timezone || 'America/New_York');
          }
        } catch {
          setTimezone(squad.timezone || 'America/New_York');
        }
        
        setLocation('Squad chat');
        setCustomLocation('');
        setUseCustomLocation(false);
        setTitle('');
      }
      setError(null);
    }
  }, [isOpen, squad, existingEvent]);
  
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
      
      const localDate = new Date(year, month - 1, day, hours, minutes);
      
      // Convert to UTC for storage
      const dateInTz = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
      const utcDate = new Date(localDate.getTime() - (dateInTz.getTime() - localDate.getTime()));
      
      // Use unified events API
      const eventData = {
        title: title.trim() || 'Squad accountability call',
        startDateTime: utcDate.toISOString(),
        timezone,
        locationType: 'chat' as const,
        locationLabel: finalLocation,
        meetingLink: finalLocation.startsWith('http') ? finalLocation : undefined,
        eventType: 'squad_call' as const,
        scope: 'squad' as const,
        participantModel: 'squad_members' as const,
        approvalType: 'voting' as const,
        status: 'pending_approval' as const,
        organizationId: squad.organizationId || undefined,
        programId: squad.programId || undefined,
        // Include programIds array for program content API compatibility
        programIds: squad.programId ? [squad.programId] : [],
        squadId: squad.id,
        isCoachLed: false,
        sendChatReminders: true,
        chatChannelId: squad.chatChannelId,
      };
      
      let response: Response;
      
      if (isEditMode && existingEvent) {
        // Update existing event
        console.log('[CallSuggestionModal] Updating event:', existingEvent.id, eventData);
        response = await fetch(`/api/events/${existingEvent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
      } else {
        // Create new event
        console.log('[CallSuggestionModal] Creating new event:', eventData);
        response = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
      }
      
      const data = await response.json();
      console.log('[CallSuggestionModal] Response:', response.status, data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to suggest call');
      }
      
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('[CallSuggestionModal] Error suggesting call:', err);
      setError(err instanceof Error ? err.message : 'Failed to suggest call');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
    if (isDeleting || !existingEvent) return;
    
    try {
      setIsDeleting(true);
      setError(null);
      
      // Cancel the event using unified events API
      const response = await fetch(`/api/events/${existingEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'canceled' }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel event');
      }
      
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error canceling event:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel event');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Get minimum date (today)
  const minDate = new Date().toISOString().split('T')[0];
  
  // Handle dialog close - only allow if not submitting
  const handleOpenChange = (open: boolean) => {
    if (!open && (isSubmitting || isDeleting)) {
      // Prevent closing while submitting
      return;
    }
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-albert text-[20px] tracking-[-0.5px] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-accent" />
              {isEditMode ? 'Propose call update' : 'Suggest a squad call'}
            </DialogTitle>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[#f3f1ef] transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
          
          {/* Info text */}
          <p className="font-albert text-[13px] text-text-secondary mt-2">
            {isEditMode 
              ? 'Propose a new time for the call. Squad members will vote to approve.'
              : 'Suggest a call time. Squad members will vote to confirm.'
            }
          </p>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm font-albert">{error}</p>
            </div>
          )}
          
          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div>
              <label className="block font-albert font-medium text-[14px] text-text-primary mb-2">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={minDate}
                className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all"
              />
            </div>
            
            {/* Time */}
            <div>
              <label className="block font-albert font-medium text-[14px] text-text-primary mb-2">
                Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all"
                />
              </div>
            </div>
          </div>
          
          {/* Timezone */}
          <div>
            <label className="block font-albert font-medium text-[14px] text-text-primary mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all appearance-none cursor-pointer"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Location */}
          <div>
            <label className="block font-albert font-medium text-[14px] text-text-primary mb-2">
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
                  className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all"
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
            <label className="block font-albert font-medium text-[14px] text-text-primary mb-2">
              Title <span className="text-text-secondary font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Squad accountability call"
              className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 focus:border-brand-accent transition-all"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          {/* Delete button - only show if editing existing confirmed event */}
          {isEditMode && existingEvent && (
            <button
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-red-600 hover:bg-red-50 rounded-full font-albert text-sm transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Canceling...' : 'Cancel call'}
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
              {isSubmitting 
                ? 'Suggesting...' 
                : isEditMode 
                  ? 'Propose update' 
                  : 'Suggest call'
              }
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

