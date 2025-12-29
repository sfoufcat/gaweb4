'use client';

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';

interface VerificationCodeInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * OTP-style verification code input with 6 separate boxes
 * Features:
 * - Auto-advance to next box on input
 * - Backspace moves to previous box
 * - Paste support for full code
 * - Exposes single combined code value
 */
export function VerificationCodeInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = true,
}: VerificationCodeInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync internal digits state with external value
  useEffect(() => {
    const valueArray = value.split('').slice(0, length);
    const paddedArray = [...valueArray, ...Array(length - valueArray.length).fill('')];
    setDigits(paddedArray);
  }, [value, length]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Only accept digits
    if (newValue && !/^\d$/.test(newValue)) {
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = newValue;
    setDigits(newDigits);

    // Emit combined value
    const combinedValue = newDigits.join('');
    onChange(combinedValue);

    // Auto-advance to next input if a digit was entered
    if (newValue && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      if (digits[index] === '' && index > 0) {
        // If current box is empty, move to previous and clear it
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        onChange(newDigits.join(''));
      } else {
        // Clear current box
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
        onChange(newDigits.join(''));
      }
      e.preventDefault();
    }

    // Handle left arrow
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Handle right arrow
    if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    
    if (pastedData) {
      const newDigits = pastedData.split('').concat(Array(length - pastedData.length).fill(''));
      setDigits(newDigits.slice(0, length));
      onChange(pastedData);
      
      // Focus on the next empty box or the last box
      const nextEmptyIndex = pastedData.length < length ? pastedData.length : length - 1;
      inputRefs.current[nextEmptyIndex]?.focus();
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select the content when focused
    e.target.select();
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={handleFocus}
          disabled={disabled}
          className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-albert font-semibold text-text-primary bg-white border-2 border-[#e1ddd8] rounded-xl outline-none transition-all focus:border-brand-accent focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Digit ${index + 1} of ${length}`}
        />
      ))}
    </div>
  );
}








