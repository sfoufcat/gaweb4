'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { X, Globe, Lock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SquadVisibility } from '@/types';

/**
 * CreateSquadModal Component
 * 
 * @deprecated Replaced by Program Enrollment flow. Squads are now created automatically
 * when users enroll in a group program. Manual squad creation is no longer supported.
 * 
 * Modal for creating a new squad with name, description, timezone, and visibility.
 */

interface CreateSquadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Popular timezones for quick selection
const POPULAR_TIMEZONES = [
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

// Get all IANA timezones for searchable dropdown
function getAllTimezones(): { value: string; label: string }[] {
  try {
    const zones = Intl.supportedValuesOf('timeZone');
    return zones.map(tz => ({
      value: tz,
      label: tz.replace(/_/g, ' '),
    }));
  } catch {
    // Fallback for older browsers
    return POPULAR_TIMEZONES;
  }
}

export function CreateSquadModal({ open, onClose, onSuccess }: CreateSquadModalProps) {
  const { user } = useUser();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [visibility, setVisibility] = useState<SquadVisibility>('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Timezone search state
  const [tzSearch, setTzSearch] = useState('');
  const [showTzDropdown, setShowTzDropdown] = useState(false);
  
  const allTimezones = getAllTimezones();
  const filteredTimezones = tzSearch
    ? allTimezones.filter(tz => 
        tz.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
        tz.value.toLowerCase().includes(tzSearch.toLowerCase())
      )
    : POPULAR_TIMEZONES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Squad name is required');
      return;
    }
    
    if (!user) {
      setError('You must be logged in to create a squad');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/squad/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          timezone,
          visibility,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create squad');
      }

      onSuccess();
    } catch (err) {
      console.error('Error creating squad:', err);
      setError(err instanceof Error ? err.message : 'Failed to create squad');
    } finally {
      setLoading(false);
    }
  };

  const selectedTzLabel = allTimezones.find(tz => tz.value === timezone)?.label || timezone;

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <AlertDialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="font-albert text-[24px] tracking-[-1px]">
              Create your squad
            </AlertDialogTitle>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#faf8f6] rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-[12px] text-red-700 font-albert text-[14px]">
              {error}
            </div>
          )}

          {/* Squad Name */}
          <div>
            <label className="block font-albert font-medium text-[14px] text-text-primary mb-2">
              Squad name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter squad name"
              maxLength={50}
              className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-[12px] font-albert text-[16px] text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 focus:border-[#a07855] transition-all"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-albert font-medium text-[14px] text-text-primary mb-2">
              Description <span className="text-text-secondary">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your squad about?"
              rows={3}
              maxLength={200}
              className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-[12px] font-albert text-[16px] text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 focus:border-[#a07855] transition-all resize-none"
            />
            <p className="text-[12px] text-text-secondary mt-1 font-albert">
              {description.length}/200 characters
            </p>
          </div>

          {/* Timezone */}
          <div className="relative">
            <label className="block font-albert font-medium text-[14px] text-text-primary mb-2">
              Timezone
            </label>
            <button
              type="button"
              onClick={() => setShowTzDropdown(!showTzDropdown)}
              className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-[12px] font-albert text-[16px] text-text-primary text-left flex items-center justify-between hover:border-[#a07855] transition-all"
            >
              <span className="truncate">{selectedTzLabel}</span>
              <ChevronDown className={`w-5 h-5 text-text-secondary transition-transform ${showTzDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showTzDropdown && (
              <div className="absolute z-50 w-full mt-2 bg-white border border-[#e1ddd8] rounded-[12px] shadow-lg overflow-hidden">
                <div className="p-2 border-b border-[#e1ddd8]">
                  <input
                    type="text"
                    value={tzSearch}
                    onChange={(e) => setTzSearch(e.target.value)}
                    placeholder="Search timezones..."
                    className="w-full px-3 py-2 bg-[#faf8f6] rounded-[8px] font-albert text-[14px] focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredTimezones.map((tz) => (
                    <button
                      key={tz.value}
                      type="button"
                      onClick={() => {
                        setTimezone(tz.value);
                        setShowTzDropdown(false);
                        setTzSearch('');
                      }}
                      className={`w-full px-4 py-2 text-left font-albert text-[14px] hover:bg-[#faf8f6] transition-colors ${
                        timezone === tz.value ? 'bg-[#a07855]/10 text-[#a07855]' : 'text-text-primary'
                      }`}
                    >
                      {tz.label}
                    </button>
                  ))}
                  {filteredTimezones.length === 0 && (
                    <p className="px-4 py-3 text-text-secondary font-albert text-[14px]">
                      No timezones found
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Visibility Toggle */}
          <div>
            <label className="block font-albert font-medium text-[14px] text-text-primary mb-3">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Public Option */}
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`p-4 border rounded-[16px] text-left transition-all ${
                  visibility === 'public'
                    ? 'border-[#a07855] bg-[#a07855]/5'
                    : 'border-[#e1ddd8] hover:border-[#a07855]/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Globe className={`w-5 h-5 ${visibility === 'public' ? 'text-[#a07855]' : 'text-text-secondary'}`} />
                  <span className={`font-albert font-semibold text-[14px] ${visibility === 'public' ? 'text-[#a07855]' : 'text-text-primary'}`}>
                    Public
                  </span>
                </div>
                <p className="font-albert text-[12px] text-text-secondary">
                  Anyone can find and join your squad
                </p>
              </button>

              {/* Private Option */}
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-4 border rounded-[16px] text-left transition-all ${
                  visibility === 'private'
                    ? 'border-[#a07855] bg-[#a07855]/5'
                    : 'border-[#e1ddd8] hover:border-[#a07855]/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Lock className={`w-5 h-5 ${visibility === 'private' ? 'text-[#a07855]' : 'text-text-secondary'}`} />
                  <span className={`font-albert font-semibold text-[14px] ${visibility === 'private' ? 'text-[#a07855]' : 'text-text-primary'}`}>
                    Private
                  </span>
                </div>
                <p className="font-albert text-[12px] text-text-secondary">
                  Only people with invite code can join
                </p>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-[#a07855] hover:bg-[#8c6245] disabled:bg-[#a07855]/50 text-white rounded-[16px] py-3 font-albert font-semibold text-[16px]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create squad'
              )}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}









