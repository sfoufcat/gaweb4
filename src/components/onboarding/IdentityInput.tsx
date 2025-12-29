'use client';

import { useState, useRef, useEffect } from 'react';
import { useTypewriter } from '@/hooks/useTypewriter';

interface IdentityInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidate: () => void;
  isValidating?: boolean;
  error?: string;
}

const EXAMPLE_IDENTITIES = [
  "a guide for people with anxiety...",
  "a mentor for founders...",
  "a disciplined, focused creator...",
  "a leader for my team...",
  "a leader who inspires transformation...",
];

export function IdentityInput({
  value,
  onChange,
  onValidate,
  isValidating = false,
  error,
}: IdentityInputProps) {
  const [_isFocused, setIsFocused] = useState(false);
  const prefixRef = useRef<HTMLSpanElement>(null);
  const [indent, setIndent] = useState(0);
  
  const typewriterText = useTypewriter({
    words: EXAMPLE_IDENTITIES,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
  });

  const maxLength = 200;
  const minLength = 10;

  // Measure width of "I am " to align textarea cursor
  useEffect(() => {
    if (prefixRef.current) {
      setIndent(prefixRef.current.offsetWidth);
    }
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim().length >= minLength && !isValidating) {
        onValidate();
      }
    }
  };

  return (
    <div className="px-6 py-5">
      <div className="relative min-h-[120px]">
        {/* Main Text Display Area - Acts as the visual layer for "I am" and placeholder */}
        <div 
          className="font-sans text-[24px] tracking-[-0.5px] leading-[1.2] break-words whitespace-pre-wrap pointer-events-none absolute inset-0 z-0"
          aria-hidden="true"
        >
          <span ref={prefixRef} className="text-text-primary font-normal">I am </span>
          
          {!value && (
            <span className="text-[#a7a39e]">
              {typewriterText}
            </span>
          )}
        </div>
        
        {/* Interactive Input Overlay */}
        {/* This textarea handles the user input, cursor, and interactions */}
        <textarea
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= maxLength) {
              onChange(e.target.value);
            }
          }}
          onKeyPress={handleKeyPress}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={isValidating}
          className="absolute inset-0 w-full h-full bg-transparent outline-none resize-none z-10 font-sans text-[24px] tracking-[-0.5px] leading-[1.2] text-text-primary p-0 border-none focus:ring-0"
          style={{ 
            textIndent: indent ? `${indent}px` : '52px',
            caretColor: 'var(--brand-accent-light)'
          }}
          autoFocus
          spellCheck={false}
          rows={3}
          aria-label="Your mission statement"
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
