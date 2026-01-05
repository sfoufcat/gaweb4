'use client';

import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Calendar, CalendarDays, AlertTriangle } from 'lucide-react';
import type { ProgramOrientation } from '@/types';

interface OrientationToggleProps {
  value: ProgramOrientation;
  onChange: (mode: ProgramOrientation) => void;
  disabled?: boolean;
  showConfirmation?: boolean; // Show confirmation dialog when switching modes
  hasExistingContent?: boolean; // Whether program has existing content that would be affected
}

/**
 * Toggle switch for selecting program content mode (weekly vs daily)
 * Weekly mode (default): Tasks added to weeks, distributed to days automatically
 * Daily mode: Granular control, tasks added to specific days
 */
export function OrientationToggle({ 
  value, 
  onChange, 
  disabled = false,
  showConfirmation = false,
  hasExistingContent = false,
}: OrientationToggleProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<ProgramOrientation | null>(null);

  const handleModeChange = (newMode: ProgramOrientation) => {
    if (newMode === value) return;
    
    if (showConfirmation && hasExistingContent) {
      setPendingMode(newMode);
      setConfirmOpen(true);
    } else {
      onChange(newMode);
    }
  };

  const confirmModeChange = () => {
    if (pendingMode) {
      onChange(pendingMode);
    }
    setConfirmOpen(false);
    setPendingMode(null);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Content Mode
          </span>
          <div className="flex items-center bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg p-1">
            {/* Weekly mode first (default) */}
            <button
              type="button"
              onClick={() => handleModeChange('weekly')}
              disabled={disabled}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium font-albert rounded-md transition-colors ${
                value === 'weekly'
                  ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Weekly
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('daily')}
              disabled={disabled}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium font-albert rounded-md transition-colors ${
                value === 'daily'
                  ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Daily
            </button>
          </div>
        </div>
        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
          {value === 'weekly' 
            ? 'Add tasks to weeks — they\'ll be distributed to days automatically'
            : 'Add tasks to specific days for granular control'}
        </p>
      </div>

      {/* Mode Switch Confirmation Dialog */}
      <Transition appear show={confirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setConfirmOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 text-left align-middle shadow-xl transition-all border border-[#e1ddd8] dark:border-[#262b35]">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      >
                        Switch to {pendingMode === 'daily' ? 'Daily' : 'Weekly'} Mode?
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          {pendingMode === 'daily' 
                            ? 'Existing week tasks will be distributed to individual days. You can then edit each day\'s content separately.'
                            : 'Day-level tasks will be aggregated back to the week level. You may want to review the content after switching.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors font-albert"
                      onClick={() => setConfirmOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-white bg-brand-accent hover:bg-brand-accent/90 rounded-lg transition-colors font-albert"
                      onClick={confirmModeChange}
                    >
                      Switch Mode
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
