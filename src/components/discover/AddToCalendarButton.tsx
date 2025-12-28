'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface AddToCalendarButtonProps {
  title: string;
  description?: string;
  location?: string;
  startDateTime: string; // ISO string
  endDateTime: string;   // ISO string
  timezone?: string;
}

export function AddToCalendarButton({
  title,
  description = '',
  location = '',
  startDateTime,
  endDateTime,
  timezone = 'UTC',
}: AddToCalendarButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date to YYYYMMDDTHHMMSSZ format for calendar URLs
  function formatDateForCalendar(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  // Generate Google Calendar URL
  function getGoogleCalendarUrl(): string {
    const start = formatDateForCalendar(startDateTime);
    const end = formatDateForCalendar(endDateTime);
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${start}/${end}`,
      details: description,
      location: location,
      ctz: timezone,
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  // Generate Outlook Web Calendar URL
  function getOutlookCalendarUrl(): string {
    const params = new URLSearchParams({
      subject: title,
      body: description,
      location: location,
      startdt: startDateTime,
      enddt: endDateTime,
      path: '/calendar/action/compose',
      rru: 'addevent',
    });
    
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }

  // Generate ICS file content for Apple Calendar / other apps
  function generateICSContent(): string {
    const start = formatDateForCalendar(startDateTime);
    const end = formatDateForCalendar(endDateTime);
    const now = formatDateForCalendar(new Date().toISOString());
    
    // Escape special characters in text
    const escapeText = (text: string) => 
      text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Goal Achiever//Event//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@goalachiever.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeText(title)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `LOCATION:${escapeText(location)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  // Download ICS file
  function downloadICS() {
    const content = generateICSContent();
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-earth-600 dark:text-earth-400 bg-earth-50 dark:bg-[#1d222b] hover:bg-earth-100 dark:hover:bg-[#262b35] rounded-xl transition-colors"
      >
        <Calendar className="w-4 h-4" />
        Add to Calendar
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-[#1d222b] rounded-xl shadow-lg border border-gray-100 dark:border-[#262b35] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <a
            href={getGoogleCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-gray-50 dark:hover:bg-[#262b35] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Google Calendar
          </a>
          
          <a
            href={getOutlookCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-gray-50 dark:hover:bg-[#262b35] transition-colors border-t border-gray-100 dark:border-[#262b35]"
            onClick={() => setIsOpen(false)}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Outlook
          </a>
          
          <button
            onClick={downloadICS}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-gray-50 dark:hover:bg-[#262b35] transition-colors border-t border-gray-100 dark:border-[#262b35] text-left"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Apple Calendar (.ics)
          </button>
        </div>
      )}
    </div>
  );
}






