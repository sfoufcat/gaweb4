'use client';

import { useState, useRef, useEffect } from 'react';
import { useTypewriter } from '@/hooks/useTypewriter';
import { CalendarIcon } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';

interface GoalInputProps {
  value: string;
  onChange: (value: string) => void;
  targetDate: string | null;
  onDateChange: (date: string) => void;
  error?: string;
}

const EXAMPLE_GOALS = [
  "launch the Coachful app...",
  "grow to $50k MRR...",
  "lose 10 kg...",
  "complete my first marathon...",
  "publish my first book...",
];

export function GoalInput({
  value,
  onChange,
  targetDate,
  onDateChange,
  error,
}: GoalInputProps) {
  const [_isFocused, setIsFocused] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const prefixRef = useRef<HTMLSpanElement>(null);
  const [indent, setIndent] = useState(0);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const typewriterText = useTypewriter({
    words: EXAMPLE_GOALS,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
  });

  const maxLength = 200;

  // Fix hydration by only showing typewriter after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Measure width of "I want to " to align textarea cursor
  useEffect(() => {
    if (prefixRef.current) {
      setIndent(prefixRef.current.offsetWidth);
    }
  }, []);


  return (
    <div className="px-6 py-3">
      {/* Goal Input */}
      <div className="relative min-h-[80px]">
        {/* Main Text Display Area - Acts as the visual layer for "I want to" and placeholder */}
        <div 
          className="font-sans text-[24px] tracking-[-0.5px] leading-[1.2] break-words whitespace-pre-wrap pointer-events-none absolute inset-0 z-0"
          aria-hidden="true"
        >
          <span ref={prefixRef} className="text-text-primary font-normal">I want to </span>
          
          {!value && isMounted && (
            <span className="text-[#a7a39e]">
              {typewriterText}
            </span>
          )}
        </div>
        
        {/* Interactive Input Overlay */}
        <textarea
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= maxLength) {
              onChange(e.target.value);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="absolute inset-0 w-full h-full bg-transparent outline-none resize-none z-10 font-sans text-[24px] tracking-[-0.5px] leading-[1.2] text-text-primary p-0 border-none focus:ring-0"
          style={{ 
            textIndent: indent ? `${indent}px` : '100px',
            caretColor: 'var(--brand-accent-light)'
          }}
          autoFocus
          spellCheck={false}
          rows={3}
          aria-label="Your goal"
        />
      </div>

      {/* Date Picker - Beautiful app-native DatePicker */}
      <div className="mt-2">
        <DatePicker
          value={targetDate || ''}
          onChange={(date) => onDateChange(date)}
          minDate={new Date()}
          placeholder="By when?"
          className="w-full text-[18px]"
        />
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 font-sans animate-in fade-in slide-in-from-top-1 relative z-20">
          {error}
        </p>
      )}
    </div>
  );
}

