'use client';

import { useRef, useEffect } from 'react';
import { useTypewriter } from '@/hooks/useTypewriter';

/**
 * IdentityInput Component - 2025 Design
 * 
 * Modern, minimalist input for identity statements with smooth animations and micro-interactions
 */

interface MissionInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isValid?: boolean;
  autoFocus?: boolean;
}

const EXAMPLE_IDENTITIES = [
  "a guide for people with anxiety",
  "a mentor for founders",
  "a disciplined, focused creator",
  "a leader for my team",
  "a leader who inspires transformation",
];

export function MissionInput({
  value,
  onChange,
  disabled = false,
  isValid = false,
  autoFocus = true,
}: MissionInputProps) {
  const prefixRef = useRef<HTMLSpanElement>(null);
  const indentRef = useRef(0);
  
  const typewriterText = useTypewriter({
    words: EXAMPLE_IDENTITIES,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
  });

  // Measure "I am " width for perfect cursor alignment
  useEffect(() => {
    if (prefixRef.current) {
      indentRef.current = prefixRef.current.offsetWidth;
    }
  }, []);

  return (
    <div className="relative group">
      {/* Animated gradient border */}
      <div className={`
        absolute -inset-0.5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500
        ${isValid 
          ? 'bg-gradient-to-r from-nature-500 to-earth-500 animate-pulse' 
          : 'bg-gradient-bronze blur-sm'
        }
      `} />
      
      {/* Main input card */}
      <div className={`
        relative backdrop-blur-xl rounded-3xl p-8 transition-all duration-300
        ${isValid 
          ? 'bg-nature-50/90 border-2 border-nature-500/20 shadow-nature-500/10' 
          : 'bg-white/80 border border-earth-200/50 hover:border-earth-300/50 shadow-lg hover:shadow-xl'
        }
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
      `}>
        {/* Visual Layer - "I am" prefix and typewriter on same line */}
        <div 
          className="pointer-events-none absolute left-8 top-8 z-0"
          aria-hidden="true"
        >
          <div className="font-serif text-3xl md:text-4xl tracking-tight leading-[1.2] text-earth-900">
            <span ref={prefixRef} className="font-sans text-3xl md:text-4xl font-normal text-earth-400">I am </span>
            {!value && (
              <span className="font-serif text-3xl md:text-4xl font-normal text-earth-300/50">
                {typewriterText}
              </span>
            )}
          </div>
        </div>
        
        {/* Interactive Layer */}
        <textarea
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= 200) {
              onChange(e.target.value);
            }
          }}
          disabled={disabled}
          className="relative z-10 w-full bg-transparent outline-none resize-none border-none focus:ring-0 font-serif text-3xl md:text-4xl tracking-tight leading-[1.2] text-earth-900 p-0 min-h-[100px] placeholder:text-transparent"
          style={{ 
            textIndent: indentRef.current ? `${indentRef.current}px` : '80px',
            caretColor: 'var(--brand-accent-light)'
          }}
          autoFocus={autoFocus}
          spellCheck={false}
          rows={3}
          aria-label="Your identity statement"
        />
        
        {/* Character count with smooth transition */}
        <div className={`
          mt-4 text-right text-sm font-medium font-mono transition-colors duration-200
          ${value.length > 180 ? 'text-earth-500' : 'text-earth-300'}
          ${value.length === 200 ? 'text-red-600' : ''}
        `}>
          {value.length} / 200
        </div>
      </div>
    </div>
  );
}
