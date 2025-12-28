'use client';

import { Check, Minus } from 'lucide-react';

interface BrandedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  indeterminate?: boolean;
}

export function BrandedCheckbox({ checked, onChange, id, disabled, className = '', indeterminate }: BrandedCheckboxProps) {
  const isActive = checked || indeterminate;
  
  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 
        transition-all duration-200 
        ${isActive 
          ? 'border-[#a07855] dark:border-[#b8896a] bg-[#a07855] dark:bg-[#b8896a]' 
          : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#171b22] hover:border-[#a07855] dark:hover:border-[#b8896a]/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {indeterminate ? (
        <Minus className="w-3.5 h-3.5 text-white" strokeWidth={3} />
      ) : checked ? (
        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
      ) : null}
    </button>
  );
}

