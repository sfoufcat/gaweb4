'use client';

import { useState } from 'react';
import type { HabitFormData, FrequencyType, HabitReminder } from '@/types';
import { FrequencySelector } from './FrequencySelector';
import { ReminderSelector } from './ReminderSelector';

interface HabitFormProps {
  initialData?: Partial<HabitFormData>;
  onSubmit: (data: HabitFormData) => void;
  onArchive?: () => void;
  isEditing?: boolean;
  isSubmitting?: boolean;
}

export function HabitForm({
  initialData,
  onSubmit,
  onArchive,
  isEditing = false,
  isSubmitting = false,
}: HabitFormProps) {
  const [formData, setFormData] = useState<HabitFormData>({
    text: initialData?.text || '',
    linkedRoutine: initialData?.linkedRoutine || '',
    frequencyType: initialData?.frequencyType || 'daily',
    frequencyValue: initialData?.frequencyValue || 7,
    reminder: initialData?.reminder || null,
    targetRepetitions: initialData?.targetRepetitions || null,
  });

  // Helper to capitalize first letter
  const capitalizeFirstLetter = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.text.trim()) {
      // Capitalize first letter of habit name and linked routine
      const capitalizedData = {
        ...formData,
        text: capitalizeFirstLetter(formData.text.trim()),
        linkedRoutine: capitalizeFirstLetter(formData.linkedRoutine.trim()),
      };
      onSubmit(capitalizedData);
    }
  };

  const isFormValid = formData.text.trim().length >= 3;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="p-6 space-y-6">
        
        {/* Habit Text Input */}
        <div>
          <label className="block font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] mb-3">
            What do you want to do?
          </label>
          <textarea
            value={formData.text}
            onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
            disabled={isSubmitting}
            placeholder="e.g., Read for 20 minutes"
            className="w-full px-4 py-3 bg-[#f9f8f7] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-sans text-[16px] text-text-primary dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent dark:focus:ring-brand-accent focus:border-transparent resize-none"
            autoFocus
            spellCheck={false}
            rows={2}
            maxLength={150}
            aria-label="Habit description"
          />
          <p className="mt-1 font-sans text-[12px] text-text-muted dark:text-[#7d8190]">
            {formData.text.length}/150 characters
          </p>
        </div>

        {/* Linked Routine Input */}
        <div>
          <label className="block font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] mb-3">
            Linked routine <span className="text-text-muted dark:text-[#7d8190] font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.linkedRoutine}
            onChange={(e) => setFormData(prev => ({ ...prev, linkedRoutine: e.target.value }))}
            disabled={isSubmitting}
            placeholder="e.g., after breakfast"
            className="w-full px-4 py-3 bg-[#f9f8f7] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-sans text-[16px] text-text-primary dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent dark:focus:ring-brand-accent focus:border-transparent"
            spellCheck={false}
            maxLength={100}
            aria-label="Linked routine"
          />
          <p className="mt-1 font-sans text-[12px] text-text-muted dark:text-[#7d8190]">
            Connect this habit to an existing routine for better consistency
          </p>
        </div>

        {/* Frequency Selector */}
        <div>
          <label className="block font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] mb-3">
            How often?
          </label>
          <FrequencySelector
            frequencyType={formData.frequencyType}
            frequencyValue={formData.frequencyValue}
            onFrequencyTypeChange={(type: FrequencyType) => 
              setFormData(prev => ({ ...prev, frequencyType: type }))
            }
            onFrequencyValueChange={(value: number[] | number) =>
              setFormData(prev => ({ ...prev, frequencyValue: value }))
            }
          />
        </div>

        {/* Reminder Selector */}
        <div>
          <label className="block font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] mb-3">
            Reminder
          </label>
          <ReminderSelector
            value={formData.reminder}
            onChange={(reminder: HabitReminder | null) =>
              setFormData(prev => ({ ...prev, reminder }))
            }
          />
        </div>

        {/* Target Repetitions */}
        <div>
          <label className="block font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] mb-3">
            Target repetitions <span className="text-text-muted dark:text-[#7d8190] font-normal">(optional)</span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.targetRepetitions || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              targetRepetitions: e.target.value ? parseInt(e.target.value) : null 
            }))}
            placeholder="No limit"
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-[#f9f8f7] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-sans text-[16px] text-text-primary dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent dark:focus:ring-brand-accent focus:border-transparent"
          />
          <p className="mt-1 font-sans text-[12px] text-text-muted dark:text-[#7d8190]">
            Set a goal for how many times you want to complete this habit
          </p>
        </div>
      </div>

      {/* Fixed Action Buttons at Bottom */}
      <div className="p-6 pt-4 space-y-3 bg-white dark:bg-[#171b22] border-t border-[#e1ddd8] dark:border-[#262b35]">
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className={`
            w-full py-4 px-4 rounded-full
            font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4]
            transition-all duration-200
            ${isFormValid && !isSubmitting
              ? 'bg-[#1A1A1A] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-[#E5E5E5] dark:bg-[#262b35] text-[#A3A3A3] dark:text-[#7d8190] cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? 'Saving...' : 'Save habit'}
        </button>

        {isEditing && onArchive && (
          <button
            type="button"
            onClick={onArchive}
            disabled={isSubmitting}
            className="w-full py-4 px-4 rounded-full bg-white dark:bg-[#1e222a] text-text-primary dark:text-[#f5f5f8] border border-[#e1ddd8] dark:border-[#262b35] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] hover:border-[#d1cdc8] dark:hover:border-[#313746] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mark as complete and archive
          </button>
        )}
      </div>
    </form>
  );
}

