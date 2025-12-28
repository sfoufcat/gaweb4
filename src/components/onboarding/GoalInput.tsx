'use client';

import { useState, useRef, useEffect } from 'react';
import { useTypewriter } from '@/hooks/useTypewriter';
import { CalendarIcon } from 'lucide-react';

interface GoalInputProps {
  value: string;
  onChange: (value: string) => void;
  targetDate: string | null;
  onDateChange: (date: string) => void;
  error?: string;
}

const EXAMPLE_GOALS = [
  "launch the GrowthAddicts app...",
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
            caretColor: '#a07855'
          }}
          autoFocus
          spellCheck={false}
          rows={3}
          aria-label="Your goal"
        />
      </div>

      {/* Date Picker - Styled native input (visible) */}
      <div className="mt-2">
        <div className="relative">
          <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#a7a39e] pointer-events-none z-10" />
          <input
            id="goal-date"
            ref={dateInputRef}
            type="date"
            value={targetDate || ''}
            onChange={(e) => onDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            placeholder="By when?"
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#e1ddd8] hover:border-[#a07855] dark:border-[#b8896a] focus:border-[#a07855] dark:border-[#b8896a] focus:outline-none focus:ring-0 transition-all font-sans text-[18px] tracking-[-0.5px] leading-[1.2] text-text-primary cursor-pointer"
            style={{
              colorScheme: 'light',
            }}
            aria-label="Select target date"
          />
          {!targetDate && (
            <span className="absolute left-12 top-1/2 -translate-y-1/2 font-sans text-[18px] tracking-[-0.5px] leading-[1.2] text-[#a7a39e] pointer-events-none">
              By when?
            </span>
          )}
        </div>
      </div>
      
      {error && (
        <p className="mt-3 text-sm text-red-600 font-sans animate-in fade-in slide-in-from-top-1 relative z-20">
          {error}
        </p>
      )}
    </div>
  );
}

