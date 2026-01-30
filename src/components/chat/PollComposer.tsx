'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import type { PollFormData } from '@/types/poll';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * PollComposer Component
 *
 * Full-screen modal/sheet for creating a new poll.
 * - Desktop: Centered dialog/popup using Radix Dialog
 * - Mobile: Slide-up drawer using Vaul
 *
 * Features:
 * - Question input
 * - Reorderable poll options with drag handles
 * - Add option via mini sheet/dialog
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

// Shared poll form content component
function PollFormContent({
  question,
  setQuestion,
  options,
  updateOption,
  removeOption,
  addOption,
  dateValue,
  setDateValue,
  timeValue,
  setTimeValue,
  anonymous,
  setAnonymous,
  multipleAnswers,
  setMultipleAnswers,
  participantsCanAddOptions,
  setParticipantsCanAddOptions,
  isValid,
  isSubmitting,
  onSubmit,
  onClose,
}: {
  question: string;
  setQuestion: (v: string) => void;
  options: { id: string; text: string }[];
  updateOption: (id: string, text: string) => void;
  removeOption: (id: string) => void;
  addOption: () => void;
  dateValue: string;
  setDateValue: (v: string) => void;
  timeValue: string;
  setTimeValue: (v: string) => void;
  anonymous: boolean;
  setAnonymous: (v: boolean) => void;
  multipleAnswers: boolean;
  setMultipleAnswers: (v: boolean) => void;
  participantsCanAddOptions: boolean;
  setParticipantsCanAddOptions: (v: boolean) => void;
  isValid: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="px-4 pt-2 md:pt-5 pb-6 flex-shrink-0">
        <div className="flex items-start justify-between">
          <h1 className="font-albert text-[36px] font-normal text-[#1a1a1a] tracking-[-2px] leading-[1.2]">
            New poll
          </h1>
          {/* Desktop only: X button far-right */}
          <button
            onClick={onClose}
            className="hidden md:flex w-8 h-8 items-center justify-center text-[#5f5a55] hover:text-[#1a1a1a] hover:bg-[#f3f1ef] rounded-lg transition-all"
            aria-label="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
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
              onClick={addOption}
              className="bg-[#f3f1ef] rounded-[20px] px-4 py-3 flex items-center justify-center hover:bg-[#eae7e3] transition-colors"
            >
              <span className="font-albert font-semibold text-[18px] text-[#a7a39e] tracking-[-1px] leading-[1.3]">
                + Add option
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
            <div className="flex items-center justify-between py-4 px-4 border-t border-[#e6e6e6]">
              <span className="font-albert text-[16px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                Active Till
              </span>
              <div className="flex items-center gap-5">
                <DatePicker
                  value={dateValue}
                  onChange={(d) => setDateValue(d)}
                  minDate={new Date()}
                  placeholder="Date"
                  displayFormat="MMM d"
                  iconPosition="left"
                  className="w-auto h-auto px-0 py-0 bg-transparent border-0 shadow-none hover:bg-transparent hover:opacity-80 focus:ring-0 text-brand-accent font-medium"
                  zIndex="z-[10003]"
                />
                <TimePicker
                  value={timeValue}
                  onChange={(t) => setTimeValue(t)}
                  placeholder="Time"
                  iconPosition="left"
                  className="w-auto h-auto px-0 py-0 bg-transparent border-0 shadow-none hover:bg-transparent hover:opacity-80 focus:ring-0 text-brand-accent font-medium"
                  zIndex="z-[10003]"
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
      <div className="flex-shrink-0 px-6 pt-6 pb-10 md:pb-6">
        <button
          onClick={onSubmit}
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
    </>
  );
}

// Add Option content component
function AddOptionContent({
  newOptionText,
  setNewOptionText,
  onAdd,
  onClose,
  showCloseButton = false,
}: {
  newOptionText: string;
  setNewOptionText: (v: string) => void;
  onAdd: () => void;
  onClose: () => void;
  showCloseButton?: boolean;
}) {
  return (
    <>
      {/* Header for desktop dialog */}
      {showCloseButton && (
        <div className="px-4 pt-4">
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#1a1a1a] hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-4 pt-5 md:pt-2 pb-6 space-y-8">
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
              onAdd();
            }
          }}
        />
      </div>

      {/* Add Button */}
      <div className="px-6 pt-6 pb-10 md:pb-6">
        <button
          onClick={onAdd}
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
    </>
  );
}

export function PollComposer({ isOpen, onClose, onSubmit }: PollComposerProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Add new empty option inline
  const addOption = useCallback(() => {
    setOptions(prev => [...prev, { id: generateId(), text: '' }]);
  }, []);

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

  // Desktop: Use Radix Dialog
  if (isDesktop) {
    return (
      <>
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DialogContent
            hideCloseButton
            zIndex="z-[10002]"
            className="max-w-[500px] max-h-[85vh] p-0 bg-[#faf8f6] flex flex-col overflow-hidden overscroll-contain"
            aria-describedby={undefined}
          >
            <VisuallyHidden.Root>
              <DialogTitle>Create a new poll</DialogTitle>
            </VisuallyHidden.Root>
            <PollFormContent
              question={question}
              setQuestion={setQuestion}
              options={options}
              updateOption={updateOption}
              removeOption={removeOption}
              addOption={addOption}
              dateValue={dateValue}
              setDateValue={setDateValue}
              timeValue={timeValue}
              setTimeValue={setTimeValue}
              anonymous={anonymous}
              setAnonymous={setAnonymous}
              multipleAnswers={multipleAnswers}
              setMultipleAnswers={setMultipleAnswers}
              participantsCanAddOptions={participantsCanAddOptions}
              setParticipantsCanAddOptions={setParticipantsCanAddOptions}
              isValid={isValid}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              onClose={onClose}
            />
          </DialogContent>
        </Dialog>

      </>
    );
  }

  // Mobile: Use Vaul Drawer
  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent
        className="max-h-[90dvh] flex flex-col overflow-hidden overscroll-contain bg-[#faf8f6]"
        zIndex="z-[10002]"
      >
        <PollFormContent
          question={question}
          setQuestion={setQuestion}
          options={options}
          updateOption={updateOption}
          removeOption={removeOption}
          addOption={addOption}
          dateValue={dateValue}
          setDateValue={setDateValue}
          timeValue={timeValue}
          setTimeValue={setTimeValue}
          anonymous={anonymous}
          setAnonymous={setAnonymous}
          multipleAnswers={multipleAnswers}
          setMultipleAnswers={setMultipleAnswers}
          participantsCanAddOptions={participantsCanAddOptions}
          setParticipantsCanAddOptions={setParticipantsCanAddOptions}
          isValid={isValid}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onClose={onClose}
        />
      </DrawerContent>
    </Drawer>
  );
}

export default PollComposer;
