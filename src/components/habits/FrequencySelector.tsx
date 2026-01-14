'use client';

import { useState } from 'react';
import type { FrequencyType } from '@/types';
import { DaysOfWeekSelector } from './DaysOfWeekSelector';
import { DaysOfMonthGrid } from './DaysOfMonthGrid';

interface FrequencySelectorProps {
  frequencyType: FrequencyType;
  frequencyValue: number[] | number;
  onFrequencyTypeChange: (type: FrequencyType) => void;
  onFrequencyValueChange: (value: number[] | number) => void;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly_specific_days', label: 'Specific days of a week' },
  { value: 'weekly_number', label: 'Number of days per week' },
  { value: 'monthly_specific_days', label: 'Specific days of the month' },
  { value: 'monthly_number', label: 'Number of days per month' },
] as const;

export function FrequencySelector({
  frequencyType,
  frequencyValue,
  onFrequencyTypeChange,
  onFrequencyValueChange,
}: FrequencySelectorProps) {
  const [showOptions, setShowOptions] = useState(false);

  const getFrequencyLabel = () => {
    const option = FREQUENCY_OPTIONS.find(opt => opt.value === frequencyType);
    return option?.label || 'Select frequency';
  };

  const handleOptionSelect = (type: FrequencyType) => {
    onFrequencyTypeChange(type);
    setShowOptions(false);
    
    // Set default values based on type
    if (type === 'daily') {
      onFrequencyValueChange(7);
    } else if (type === 'weekly_specific_days') {
      onFrequencyValueChange([]);
    } else if (type === 'weekly_number') {
      onFrequencyValueChange(3);
    } else if (type === 'monthly_specific_days') {
      onFrequencyValueChange([]);
    } else if (type === 'monthly_number') {
      onFrequencyValueChange(6);
    }
  };

  const incrementValue = () => {
    if (typeof frequencyValue === 'number') {
      const max = frequencyType === 'weekly_number' ? 7 : 31;
      onFrequencyValueChange(Math.min(frequencyValue + 1, max));
    }
  };

  const decrementValue = () => {
    if (typeof frequencyValue === 'number') {
      onFrequencyValueChange(Math.max(frequencyValue - 1, 1));
    }
  };

  return (
    <div className="space-y-3">
      {/* Frequency Type Button */}
      <button
        type="button"
        onClick={() => setShowOptions(!showOptions)}
        className="w-full px-4 py-3 bg-[#f9f8f7] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl font-sans text-[16px] text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors text-left flex items-center justify-between"
      >
        <span>{getFrequencyLabel()}</span>
        <svg className="w-5 h-5 text-text-muted dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Options Modal - Responsive */}
      {showOptions && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-end md:items-center md:justify-center" 
          onClick={() => setShowOptions(false)}
        >
          {/* Modal Content */}
          <div 
            className="bg-app-bg dark:bg-[#171b22] rounded-t-[32px] md:rounded-[32px] w-full max-w-[402px] mx-auto md:max-h-[80dvh] md:overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with title and close button */}
            <div className="p-6 md:pt-4 pb-4 flex items-center justify-between">
              <h3 className="font-albert text-[24px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
                How often?
              </h3>
              
              {/* Close button - Always visible */}
              <button
                type="button"
                onClick={() => setShowOptions(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Close"
              >
                <svg className="w-6 h-6 text-text-secondary dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Options */}
            <div className="px-6 pb-6 space-y-1">{FREQUENCY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleOptionSelect(option.value as FrequencyType)}
                  className={`
                    w-full text-left px-7 py-4 rounded-xl font-albert text-[18px] tracking-[-1px] leading-[1.3]
                    transition-all duration-300
                    ${frequencyType === option.value
                      ? 'bg-brand-accent text-white scale-[1.02] shadow-md'
                      : 'text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] hover:scale-[1.01] active:scale-[0.99]'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
            
            {/* Bottom padding - Mobile only */}
            <div className="h-8 md:hidden" />
          </div>
        </div>
      )}

      {/* Frequency Value Inputs */}
      {frequencyType === 'weekly_specific_days' && (
        <div className="pt-2">
          <DaysOfWeekSelector
            selected={Array.isArray(frequencyValue) ? frequencyValue : []}
            onChange={onFrequencyValueChange}
          />
        </div>
      )}

      {frequencyType === 'weekly_number' && (
        <div className="pt-2 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={decrementValue}
              className="flex-1 h-12 rounded-xl bg-[#f9f8f7] dark:bg-[#1e222a] hover:bg-[#e8e0d5] dark:hover:bg-[#262b35] flex items-center justify-center transition-colors border border-[#e1ddd8] dark:border-[#313746]"
            >
              <svg className="w-6 h-6 text-text-primary dark:text-[#f5f5f8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <div className="flex-1 h-12 rounded-xl bg-[#f9f8f7] dark:bg-[#1e222a] flex items-center justify-center font-albert font-semibold text-[18px] tracking-[-1px] border border-[#e1ddd8] dark:border-[#313746] text-text-primary dark:text-[#f5f5f8]">
              {typeof frequencyValue === 'number' ? frequencyValue : 3}
            </div>
            <button
              type="button"
              onClick={incrementValue}
              className="flex-1 h-12 rounded-xl bg-[#f9f8f7] dark:bg-[#1e222a] hover:bg-[#e8e0d5] dark:hover:bg-[#262b35] flex items-center justify-center transition-colors border border-[#e1ddd8] dark:border-[#313746]"
            >
              <svg className="w-6 h-6 text-text-primary dark:text-[#f5f5f8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <p className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[1.2] text-center">
            Complete on any {typeof frequencyValue === 'number' ? frequencyValue : 3} days of the week
          </p>
        </div>
      )}

      {frequencyType === 'monthly_specific_days' && (
        <div className="pt-2">
          <DaysOfMonthGrid
            selected={Array.isArray(frequencyValue) ? frequencyValue : []}
            onChange={onFrequencyValueChange}
          />
        </div>
      )}

      {frequencyType === 'monthly_number' && (
        <div className="pt-2 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={decrementValue}
              className="flex-1 h-12 rounded-xl bg-[#f9f8f7] dark:bg-[#1e222a] hover:bg-[#e8e0d5] dark:hover:bg-[#262b35] flex items-center justify-center transition-colors border border-[#e1ddd8] dark:border-[#313746]"
            >
              <svg className="w-6 h-6 text-text-primary dark:text-[#f5f5f8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <div className="flex-1 h-12 rounded-xl bg-[#f9f8f7] dark:bg-[#1e222a] flex items-center justify-center font-albert font-semibold text-[18px] tracking-[-1px] border border-[#e1ddd8] dark:border-[#313746] text-text-primary dark:text-[#f5f5f8]">
              {typeof frequencyValue === 'number' ? frequencyValue : 6}
            </div>
            <button
              type="button"
              onClick={incrementValue}
              className="flex-1 h-12 rounded-xl bg-[#f9f8f7] dark:bg-[#1e222a] hover:bg-[#e8e0d5] dark:hover:bg-[#262b35] flex items-center justify-center transition-colors border border-[#e1ddd8] dark:border-[#313746]"
            >
              <svg className="w-6 h-6 text-text-primary dark:text-[#f5f5f8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <p className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] leading-[1.2] text-center">
            Complete on any {typeof frequencyValue === 'number' ? frequencyValue : 6} days of the month
          </p>
        </div>
      )}
    </div>
  );
}

