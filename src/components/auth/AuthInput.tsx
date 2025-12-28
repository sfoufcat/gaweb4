'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, type, className, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    return (
      <div className="w-full">
        <label className="block font-sans text-sm font-medium text-text-primary mb-2">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            type={isPassword && showPassword ? 'text' : type}
            className={`
              w-full bg-white border border-[#e1ddd8] rounded-2xl py-4 px-5
              font-sans text-base text-text-primary placeholder:text-[#a7a39e]
              focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/20
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}
              ${isPassword ? 'pr-12' : ''}
              ${className || ''}
            `}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a7a39e] hover:text-text-primary transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600 font-sans animate-in fade-in slide-in-from-top-1">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = 'AuthInput';

