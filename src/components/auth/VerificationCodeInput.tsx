'use client';

import { useRef, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';

interface VerificationCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function VerificationCodeInput({
  value,
  onChange,
  error,
  disabled,
  autoFocus = false,
}: VerificationCodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Split the value into individual digits
  const digits = value.split('').concat(Array(6 - value.length).fill(''));

  useEffect(() => {
    // Auto-focus first input on mount if autoFocus is true
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const focusInput = (index: number) => {
    if (index >= 0 && index < 6 && inputRefs.current[index]) {
      inputRefs.current[index]?.focus();
    }
  };

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Only allow digits
    const digit = inputValue.replace(/\D/g, '').slice(-1);
    
    if (digit) {
      // Create new value array
      const newDigits = [...digits];
      newDigits[index] = digit;
      const newValue = newDigits.join('').slice(0, 6);
      onChange(newValue);
      
      // Move to next input
      if (index < 5) {
        focusInput(index + 1);
      }
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      
      const newDigits = [...digits];
      
      if (digits[index]) {
        // Clear current digit
        newDigits[index] = '';
        onChange(newDigits.join(''));
      } else if (index > 0) {
        // Move to previous input and clear it
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);
    
    if (digits) {
      onChange(digits);
      // Focus the last filled input or the next empty one
      const focusIndex = Math.min(digits.length, 5);
      focusInput(focusIndex);
    }
  };

  const handleFocus = (index: number) => {
    // Select the content when focusing
    inputRefs.current[index]?.select();
  };

  return (
    <div className="w-full">
      <label className="block font-sans text-sm font-medium text-text-primary mb-3">
        Verification code
      </label>
      <div className="flex justify-between gap-2 sm:gap-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={digits[index]}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(index)}
            disabled={disabled}
            className={`
              w-full aspect-square max-w-[60px] sm:max-w-[64px]
              bg-white border-2 rounded-xl
              font-sans text-2xl sm:text-3xl font-semibold text-center text-text-primary
              focus:outline-none transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error 
                ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
                : digits[index] 
                  ? 'border-[#a07855] focus:border-[#a07855] focus:ring-2 focus:ring-[#a07855]/20' 
                  : 'border-[#e1ddd8] focus:border-[#a07855] focus:ring-2 focus:ring-[#a07855]/20'
              }
            `}
          />
        ))}
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600 font-sans animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
}











