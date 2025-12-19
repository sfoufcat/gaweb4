'use client';

import { useState } from 'react';
import type { HabitReminder } from '@/types';

interface ReminderSelectorProps {
  value: HabitReminder | null;
  onChange: (reminder: HabitReminder | null) => void;
}

export function ReminderSelector({ value, onChange }: ReminderSelectorProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleToggle = () => {
    if (value) {
      onChange(null);
    } else {
      setShowTimePicker(true);
    }
  };

  const handleTimeSelect = (time: string) => {
    onChange({ time });
    setShowTimePicker(false);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-3">
      {/* Reminder Toggle/Display Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-4 py-3 bg-[#f9f8f7] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl font-sans text-[16px] text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors text-left flex items-center justify-between"
      >
        <span>{value ? formatTime(value.time) : 'No reminder'}</span>
        {value ? (
          <svg className="w-5 h-5 text-text-muted dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-text-muted dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        )}
      </button>

      {/* Time Picker */}
      {showTimePicker && (
        <div className="p-4 bg-[#f9f8f7] dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#313746] rounded-xl space-y-3">
          <input
            type="time"
            value={value?.time || '09:00'}
            onChange={(e) => handleTimeSelect(e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl font-sans text-[16px] text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] focus:border-transparent"
          />
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowTimePicker(false)}
              className="flex-1 py-2.5 px-4 bg-white dark:bg-[#1e222a] text-text-primary dark:text-[#f5f5f8] rounded-lg font-sans font-medium text-[14px] border border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => value && setShowTimePicker(false)}
              className="flex-1 py-2.5 px-4 bg-[#a07855] dark:bg-[#b8896a] text-white rounded-lg font-sans font-medium text-[14px] hover:bg-[#8a6649] dark:hover:bg-[#a07855] transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

