'use client';

import React from 'react';
import type { ProgramOrientation } from '@/types';

interface OrientationToggleProps {
  value: ProgramOrientation;
  onChange: (mode: ProgramOrientation) => void;
  disabled?: boolean;
}

/**
 * Toggle switch for selecting program orientation (daily vs weekly)
 */
export function OrientationToggle({ value, onChange, disabled = false }: OrientationToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
        Orientation
      </span>
      <div className="flex items-center bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg p-1">
        <button
          type="button"
          onClick={() => onChange('daily')}
          disabled={disabled}
          className={`px-3 py-1.5 text-sm font-medium font-albert rounded-md transition-colors ${
            value === 'daily'
              ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Daily
        </button>
        <button
          type="button"
          onClick={() => onChange('weekly')}
          disabled={disabled}
          className={`px-3 py-1.5 text-sm font-medium font-albert rounded-md transition-colors ${
            value === 'weekly'
              ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Weekly
        </button>
      </div>
    </div>
  );
}
