'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import type { PollFormData } from '@/types/poll';
import { useDragToDismiss } from '@/hooks/useDragToDismiss';

/**
 * PollComposer Component
 * 
 * Full-screen modal/sheet for creating a new poll.
 * Matches Figma design: node-id=802-7015
 * 
 * Features:
 * - Question input
 * - Reorderable poll options with drag handles
 * - Add option via mini sheet
 * - Settings: Active till, Anonymous voting, Multiple answers, Participants can add
 * - Send button (disabled until valid)
 */

interface PollComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pollData: PollFormData) => Promise<void>;
}

// Drag handle icon
function GripVerticalIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="6" r="1.5" fill="#a7a39e"/>
      <circle cx="15" cy="6" r="1.5" fill="#a7a39e"/>
      <circle cx="9" cy="12" r="1.5" fill="#a7a39e"/>
      <circle cx="15" cy="12" r="1.5" fill="#a7a39e"/>
      <circle cx="9" cy="18" r="1.5" fill="#a7a39e"/>
      <circle cx="15" cy="18" r="1.5" fill="#a7a39e"/>
    </svg>
  );
}

// Close/X icon
function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Generate unique ID
function generateId() {
  return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function PollComposer({ isOpen, onClose, onSubmit }: PollComposerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { sheetRef, handleRef, handleProps } = useDragToDismiss({ onClose });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddOptionSheet, setShowAddOptionSheet] = useState(false);
  const [newOptionText, setNewOptionText] = useState('');
  
  // Form state
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<{ id: string; text: string }[]>([
    { id: generateId(), text: '' },
    { id: generateId(), text: '' },
  ]);
  const [activeTill, setActiveTill] = useState<Date>(addDays(new Date(), 1));
  const [anonymous, setAnonymous] = useState(true);
  const [multipleAnswers, setMultipleAnswers] = useState(false);
  const [participantsCanAddOptions, setParticipantsCanAddOptions] = useState(false);

  // Date/time inputs
  const [dateValue, setDateValue] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [timeValue, setTimeValue] = useState(format(new Date(), 'HH:mm'));

  // Update activeTill when date/time changes
  useEffect(() => {
    if (dateValue && timeValue) {
      const newDate = new Date(`${dateValue}T${timeValue}`);
      if (!isNaN(newDate.getTime())) {
        setActiveTill(newDate);
      }
    }
  }, [dateValue, timeValue]);

  // Validation
  const isValid = question.trim().length > 0 && 
    options.filter(o => o.text.trim().length > 0).length >= 2;

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddOptionSheet) {
          setShowAddOptionSheet(false);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, showAddOptionSheet]);

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setQuestion('');
      setOptions([
        { id: generateId(), text: '' },
        { id: generateId(), text: '' },
      ]);
      setAnonymous(true);
      setMultipleAnswers(false);
      setParticipantsCanAddOptions(false);
      setDateValue(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
      setTimeValue(format(new Date(), 'HH:mm'));
    }
  }, [isOpen]);

  // Update option text
  const updateOption = useCallback((id: string, text: string) => {
    setOptions(prev => prev.map(opt => opt.id === id ? { ...opt, text } : opt));
  }, []);

  // Remove option
  const removeOption = useCallback((id: string) => {
    setOptions(prev => prev.filter(opt => opt.id !== id));
  }, []);

  // Add new option (from mini sheet)
  const handleAddOption = useCallback(() => {
    if (newOptionText.trim()) {
      setOptions(prev => [...prev, { id: generateId(), text: newOptionText.trim() }]);
      setNewOptionText('');
      setShowAddOptionSheet(false);
    }
  }, [newOptionText]);

  // Submit poll
  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const validOptions = options.filter(o => o.text.trim().length > 0);
      await onSubmit({
        question: question.trim(),
        options: validOptions,
        settings: {
          activeTill,
          anonymous,
          multipleAnswers,
          participantsCanAddOptions,
        },
      });
      onClose();
    } catch (error) {
      console.error('Failed to create poll:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        ref={sheetRef}
        className="relative w-full lg:max-w-[500px] h-full lg:h-auto lg:max-h-[90dvh] bg-[#faf8f6] lg:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom lg:zoom-in-95 duration-300 flex flex-col overflow-hidden"
      >
        {/* Grabber - Mobile only (drag handle) */}
        <div ref={handleRef} {...handleProps} className="flex justify-center pt-3 pb-2 lg:hidden cursor-grab active:cursor-grabbing">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-4 pt-2 lg:pt-5 pb-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#1a1a1a] hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
          <h1 className="font-albert text-[36px] font-normal text-[#1a1a1a] tracking-[-2px] leading-[1.2] mt-3">
            New poll
          </h1>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Question Section */}
          <div className="py-3">
            <h2 className="font-albert font-medium text-[24px] text-[#1a1a1a] tracking-[-1.5px] leading-[1.3] mb-3">
              Question
            </h2>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Which option should we take?"
              className="w-full font-geist text-[24px] text-[#1a1a1a] placeholder-[#a7a39e] tracking-[-0.5px] leading-[1.2] bg-transparent border-none outline-none"
            />
          </div>

          {/* Poll Options Section */}
          <div className="py-3">
            <h2 className="font-albert font-medium text-[24px] text-[#1a1a1a] tracking-[-1.5px] leading-[1.3] mb-3">
              Poll options
            </h2>
            <div className="flex flex-col gap-2">
              {options.map((option) => (
                <div
                  key={option.id}
                  className="bg-white rounded-[20px] px-2 py-3 flex items-center gap-1"
                >
                  {/* Drag Handle */}
                  <div className="flex-shrink-0 cursor-grab active:cursor-grabbing">
                    <GripVerticalIcon />
                  </div>
                  {/* Input */}
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                    placeholder="Option"
                    className="flex-1 font-albert font-semibold text-[18px] text-[#1a1a1a] placeholder-[#a7a39e] tracking-[-1px] leading-[1.3] bg-transparent border-none outline-none"
                  />
                  {/* Delete Button */}
                  <button
                    onClick={() => removeOption(option.id)}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[#a7a39e] hover:text-[#1a1a1a] transition-colors"
                    aria-label="Remove option"
                  >
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}

              {/* Add an option button */}
              <button
                onClick={() => setShowAddOptionSheet(true)}
                className="bg-[#f3f1ef] rounded-[20px] px-4 py-3 flex items-center justify-center"
              >
                <span className="font-albert font-semibold text-[18px] text-[#a7a39e] tracking-[-1px] leading-[1.3]">
                  Add an option
                </span>
              </button>
            </div>
          </div>

          {/* Settings Section */}
          <div className="py-3">
            <h2 className="font-albert font-medium text-[24px] text-[#1a1a1a] tracking-[-1.5px] leading-[1.3] mb-3">
              Settings
            </h2>
            <div className="flex flex-col">
              {/* Active Till */}
              <div className="flex items-center justify-between h-[52px] px-4 border-t border-[#e6e6e6]">
                <span className="font-geist text-[16px] text-[#000000] tracking-[-0.3px] leading-[1.2]">
                  Active Till
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="bg-[rgba(118,118,128,0.12)] rounded-[6px] px-3 py-1.5 font-['SF_Pro'] text-[17px] text-[#000000] tracking-[-0.43px]"
                  />
                  <input
                    type="time"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    className="bg-[rgba(118,118,128,0.12)] rounded-[6px] px-3 py-1.5 font-['SF_Pro'] text-[17px] text-[#000000] tracking-[-0.43px]"
                  />
                </div>
              </div>

              {/* Anonymous Voting */}
              <div className="flex items-center justify-between h-[52px] px-4 border-t border-[#e6e6e6]">
                <span className="font-geist text-[16px] text-[#000000] tracking-[-0.3px] leading-[1.2]">
                  Anonymous Voting
                </span>
                <button
                  onClick={() => setAnonymous(!anonymous)}
                  className={`w-[64px] h-[28px] rounded-full p-[2px] transition-colors ${
                    anonymous ? 'bg-[#34c759]' : 'bg-[#e1ddd8]'
                  }`}
                  role="switch"
                  aria-checked={anonymous}
                >
                  <div
                    className={`w-[24px] h-[24px] bg-white rounded-full transition-transform ${
                      anonymous ? 'translate-x-[36px]' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Multiple Answers */}
              <div className="flex items-center justify-between h-[52px] px-4 border-t border-[#e6e6e6]">
                <span className="font-geist text-[16px] text-[#000000] tracking-[-0.3px] leading-[1.2]">
                  Multiple Answers
                </span>
                <button
                  onClick={() => setMultipleAnswers(!multipleAnswers)}
                  className={`w-[64px] h-[28px] rounded-full p-[2px] transition-colors ${
                    multipleAnswers ? 'bg-[#34c759]' : 'bg-[#e1ddd8]'
                  }`}
                  role="switch"
                  aria-checked={multipleAnswers}
                >
                  <div
                    className={`w-[24px] h-[24px] bg-white rounded-full transition-transform ${
                      multipleAnswers ? 'translate-x-[36px]' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Participants may add an option */}
              <div className="flex items-center justify-between h-[52px] px-4 border-t border-[#e6e6e6]">
                <span className="font-geist text-[16px] text-[#000000] tracking-[-0.3px] leading-[1.2]">
                  Participants may add an option
                </span>
                <button
                  onClick={() => setParticipantsCanAddOptions(!participantsCanAddOptions)}
                  className={`w-[64px] h-[28px] rounded-full p-[2px] transition-colors ${
                    participantsCanAddOptions ? 'bg-[#34c759]' : 'bg-[#e1ddd8]'
                  }`}
                  role="switch"
                  aria-checked={participantsCanAddOptions}
                >
                  <div
                    className={`w-[24px] h-[24px] bg-white rounded-full transition-transform ${
                      participantsCanAddOptions ? 'translate-x-[36px]' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Send Button */}
        <div className="flex-shrink-0 px-6 pt-6 pb-10">
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className={`w-full py-4 rounded-[32px] font-geist font-bold text-[16px] tracking-[-0.5px] transition-all shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] ${
              isValid && !isSubmitting
                ? 'bg-[#2c2520] text-white hover:bg-[#1a1a1a]'
                : 'bg-[#e1ddd8] text-[#a7a39e] cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Creating...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Add Option Mini Sheet */}
      {showAddOptionSheet && (
        <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[6px]"
            onClick={() => setShowAddOptionSheet(false)}
          />

          {/* Sheet */}
          <div className="relative w-full lg:max-w-[400px] bg-white rounded-t-[20px] lg:rounded-[20px] shadow-2xl animate-in slide-in-from-bottom lg:zoom-in-95 duration-200">
            {/* Grabber - Mobile only */}
            <div className="flex justify-center pt-2 pb-4 lg:hidden">
              <div className="w-9 h-[5px] bg-[rgba(30,30,47,0.4)] rounded-[2.5px]" />
            </div>

            {/* Content */}
            <div className="px-4 pt-5 lg:pt-6 pb-6 space-y-8">
              <h2 className="font-albert text-[36px] font-normal text-[#1a1a1a] tracking-[-2px] leading-[1.2]">
                Add an option
              </h2>
              
              <input
                type="text"
                value={newOptionText}
                onChange={(e) => setNewOptionText(e.target.value)}
                placeholder="Option title"
                autoFocus
                className="w-full font-geist text-[24px] text-[#1a1a1a] placeholder-[#a7a39e] tracking-[-0.5px] leading-[1.2] bg-transparent border-none outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newOptionText.trim()) {
                    handleAddOption();
                  }
                }}
              />
            </div>

            {/* Add Button */}
            <div className="px-6 pt-6 pb-10">
              <button
                onClick={handleAddOption}
                disabled={!newOptionText.trim()}
                className={`w-full py-4 rounded-[32px] font-geist font-bold text-[16px] tracking-[-0.5px] transition-all shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] ${
                  newOptionText.trim()
                    ? 'bg-[#2c2520] text-white hover:bg-[#1a1a1a]'
                    : 'bg-[#e1ddd8] text-[#a7a39e] cursor-not-allowed'
                }`}
              >
                Add
              </button>
            </div>

            {/* Home Indicator - Mobile */}
            <div className="h-8 w-full flex justify-center lg:hidden">
              <div className="w-36 h-[5px] bg-[#1a1a1a] rounded-[100px]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PollComposer;

