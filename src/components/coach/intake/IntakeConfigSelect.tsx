'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Clock, Check } from 'lucide-react';
import type { IntakeCallConfig } from '@/types';
import { IntakeConfigActions } from './IntakeConfigActions';

interface IntakeConfigSelectProps {
  configs: Array<{ id: string; name: string; duration?: number }>;
  value: string;
  onChange: (value: string) => void;
  onConfigUpdate?: () => void;
  onConfigDelete?: (configId: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function IntakeConfigSelect({
  configs,
  value,
  onChange,
  onConfigUpdate,
  onConfigDelete,
  placeholder = 'Select an intake config',
  required = false,
  disabled = false,
}: IntakeConfigSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedConfig = configs.find(c => c.id === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-4 py-2.5 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-left transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-brand-accent/50 focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-brand-accent/50'
        }`}
      >
        <span className={`font-albert ${selectedConfig ? 'text-[#1a1a1a] dark:text-[#f5f5f8]' : 'text-[#8c8c8c] dark:text-[#7f8694]'}`}>
          {selectedConfig ? selectedConfig.name : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg max-h-60 overflow-auto">
          {/* Empty option */}
          {!required && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              <span className="text-[#8c8c8c] dark:text-[#7f8694] font-albert">{placeholder}</span>
            </button>
          )}

          {/* Config options */}
          {configs.map((config) => {
            const isSelected = config.id === value;
            return (
              <div
                key={config.id}
                className={`flex items-center justify-between px-4 py-2.5 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors ${
                  isSelected ? 'bg-brand-accent/5' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(config.id);
                    setIsOpen(false);
                  }}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <span className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {config.name}
                  </span>
                  {config.duration && (
                    <span className="flex items-center gap-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                      <Clock className="w-3 h-3" />
                      {config.duration} min
                    </span>
                  )}
                  {isSelected && (
                    <Check className="w-4 h-4 text-brand-accent ml-auto" />
                  )}
                </button>
                <IntakeConfigActions
                  config={config as IntakeCallConfig}
                  size="sm"
                  onUpdate={() => onConfigUpdate?.()}
                  onDelete={(configId) => {
                    onConfigDelete?.(configId);
                    if (value === configId) {
                      onChange('');
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
