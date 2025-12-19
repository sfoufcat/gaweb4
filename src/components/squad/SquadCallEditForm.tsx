'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, X, Trash2 } from 'lucide-react';
import type { Squad } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * SquadCallEditForm Component
 * 
 * Modal form for coaches to schedule/update the next squad call.
 * Used in the Coach Dashboard for premium squads.
 * 
 * Features:
 * - Date picker
 * - Time picker
 * - Timezone selector
 * - Location input
 * - Optional title
 */

interface SquadCallEditFormProps {
  squad: Squad;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

export function SquadCallEditForm({ squad, isOpen, onClose, onSuccess }: SquadCallEditFormProps) {
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
  
  // Initialize form with existing call data
  useEffect(() => {
    if (isOpen && squad) {
      if (squad.nextCallDateTime) {
        const callDate = new Date(squad.nextCallDateTime);
        const callTz = squad.nextCallTimezone || 'America/New_York';
        
        // Format date in the call's timezone
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: callTz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        setDate(dateFormatter.format(callDate));
        
        // Format time in the call's timezone
        const timeFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: callTz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const timeParts = timeFormatter.formatToParts(callDate);
        const hour = timeParts.find(p => p.type === 'hour')?.value || '10';
        const minute = timeParts.find(p => p.type === 'minute')?.value || '00';
        setTime(`${hour}:${minute}`);
        
        setTimezone(callTz);
        
        // Check if location is a preset
        const loc = squad.nextCallLocation || 'Squad chat';
        if (LOCATION_PRESETS.includes(loc)) {
          setLocation(loc);
          setUseCustomLocation(false);
        } else {
          setUseCustomLocation(true);
          setCustomLocation(loc);
        }
        
        setTitle(squad.nextCallTitle || '');
      } else {
        // Default values for new call
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 7); // Default to next week
        setDate(tomorrow.toISOString().split('T')[0]);
        setTime('10:00');
        setTimezone(squad.timezone || 'America/New_York');
        setLocation('Squad chat');
        setCustomLocation('');
        setUseCustomLocation(false);
        setTitle('');
      }
      setError(null);
    }
  }, [isOpen, squad]);
  
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
      // Parse the local date/time and convert to ISO
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      
      // Create a date string that includes timezone context
      // We'll send the datetime and timezone separately to the API
      const localDate = new Date(year, month - 1, day, hours, minutes);
      
      // Convert to UTC for storage
      // Using Intl to handle timezone conversion properly
      const dateInTz = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
      const utcDate = new Date(localDate.getTime() - (dateInTz.getTime() - localDate.getTime()));
      
      const response = await fetch(`/api/coach/squads/${squad.id}/call`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateTime: utcDate.toISOString(),
          timezone,
          location: finalLocation,
          title: title.trim() || undefined,
        }),
      });
      
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
  
  const handleDelete = async () => {
    if (isDeleting || !squad.nextCallDateTime) return;
    
    try {
      setIsDeleting(true);
      setError(null);
      
      const response = await fetch(`/api/coach/squads/${squad.id}/call`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove call');
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
  
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="font-albert text-[20px] tracking-[-0.5px] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#a07855]" />
              {squad.nextCallDateTime ? 'Edit squad call' : 'Schedule squad call'}
            </AlertDialogTitle>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[#f3f1ef] transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </AlertDialogHeader>

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
                className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 focus:border-[#a07855] transition-all"
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
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 focus:border-[#a07855] transition-all"
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
              className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 focus:border-[#a07855] transition-all appearance-none cursor-pointer"
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
                          ? 'bg-[#a07855] text-white'
                          : 'bg-[#f3f1ef] text-text-primary hover:bg-[#e9e5e0]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setUseCustomLocation(true)}
                  className="text-[13px] text-[#a07855] hover:underline font-albert"
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
                  className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 focus:border-[#a07855] transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomLocation(false);
                    setCustomLocation('');
                  }}
                  className="text-[13px] text-[#a07855] hover:underline font-albert"
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
              placeholder="Squad coaching call"
              className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 focus:border-[#a07855] transition-all"
            />
          </div>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          {/* Delete button - only show if there's an existing call */}
          {squad.nextCallDateTime && (
            <button
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-red-600 hover:bg-red-50 rounded-full font-albert text-sm transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Removing...' : 'Remove call'}
            </button>
          )}
          
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <AlertDialogCancel 
              disabled={isSubmitting || isDeleting}
              className="font-albert rounded-full border-[#e1ddd8] flex-1 sm:flex-none"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={isSubmitting || isDeleting}
              className="font-albert rounded-full bg-[#a07855] hover:bg-[#8c6245] text-white flex-1 sm:flex-none"
            >
              {isSubmitting ? 'Saving...' : squad.nextCallDateTime ? 'Update call' : 'Schedule call'}
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

