'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import type { UserTrack } from '@/types';

// Track definitions with display information
const TRACKS: { 
  id: UserTrack; 
  label: string; 
  description: string; 
  icon: string;
  gradient: string;
}[] = [
  {
    id: 'content_creator',
    label: 'Content Creator',
    description: 'Build an audience, publish content consistently, and grow across platforms.',
    icon: '🎬',
    gradient: 'from-pink-500/20 to-purple-500/20',
  },
  {
    id: 'saas',
    label: 'SaaS Founder',
    description: 'Focus on product iterations, user acquisition, and retention.',
    icon: '💻',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    id: 'coach_consultant',
    label: 'Coach / Consultant',
    description: 'Create scalable offers, attract high-quality clients, and grow your practice.',
    icon: '🎯',
    gradient: 'from-amber-500/20 to-orange-500/20',
  },
  {
    id: 'ecom',
    label: 'E-Commerce',
    description: 'Grow your brand through acquisition, conversion optimization, and retention.',
    icon: '🛒',
    gradient: 'from-green-500/20 to-emerald-500/20',
  },
  {
    id: 'agency',
    label: 'Agency Owner',
    description: 'Deliver results for clients while building systems and delegation.',
    icon: '🏢',
    gradient: 'from-indigo-500/20 to-violet-500/20',
  },
  {
    id: 'general',
    label: 'General Entrepreneur',
    description: 'For founders building hybrid or unclear business models.',
    icon: '🚀',
    gradient: 'from-rose-500/20 to-red-500/20',
  },
];

interface TrackSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (track: UserTrack) => Promise<void>;
  isLoading?: boolean;
}

export function TrackSelectionModal({ 
  isOpen, 
  onClose, 
  onSelect,
  isLoading = false,
}: TrackSelectionModalProps) {
  const [selected, setSelected] = useState<UserTrack | null>(null);
  const [hoveredTrack, setHoveredTrack] = useState<UserTrack | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    
    setIsSaving(true);
    try {
      await onSelect(selected);
      setSelected(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setSelected(null);
      onClose();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <Dialog.Title as="h3" className="font-albert text-xl text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
                      Select Your Track
                    </Dialog.Title>
                    <p className="font-sans text-sm text-text-secondary dark:text-[#b2b6c2] mt-1">
                      Choose the business type that best describes you
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isSaving}
                    className="w-8 h-8 flex items-center justify-center text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-full transition-all duration-200 disabled:opacity-50"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Track Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-h-[60vh] overflow-y-auto pr-1">
                  {TRACKS.map((track) => {
                    const isSelected = selected === track.id;
                    const isHovered = hoveredTrack === track.id;
                    
                    return (
                      <button
                        key={track.id}
                        onClick={() => setSelected(track.id)}
                        onMouseEnter={() => setHoveredTrack(track.id)}
                        onMouseLeave={() => setHoveredTrack(null)}
                        disabled={isSaving}
                        className={`
                          relative p-4 rounded-xl border-2 text-left
                          transition-all duration-200 ease-out
                          disabled:opacity-50 disabled:cursor-not-allowed
                          ${isSelected 
                            ? 'border-[#a07855] bg-[#faf8f6] dark:bg-[#1d222b] shadow-md' 
                            : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] hover:border-[#c9a07a] dark:hover:border-[#4a4a4a]'
                          }
                        `}
                      >
                        {/* Background gradient on hover/select */}
                        <div className={`
                          absolute inset-0 rounded-xl bg-gradient-to-br ${track.gradient}
                          transition-opacity duration-300
                          ${isSelected || isHovered ? 'opacity-100' : 'opacity-0'}
                        `} />
                        
                        {/* Content */}
                        <div className="relative z-10">
                          <div className="flex items-start gap-3">
                            <span className="text-[28px] flex-shrink-0">{track.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="font-albert text-[15px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px]">
                                  {track.label}
                                </h4>
                                {isSelected && (
                                  <svg className="w-4 h-4 text-[#a07855] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <p className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4]">
                                {track.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSaving}
                    className="flex-1 py-3 px-4 rounded-xl font-sans font-medium text-[15px] bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!selected || isSaving}
                    className={`
                      flex-1 py-3 px-4 rounded-xl font-sans font-medium text-[15px]
                      transition-all duration-200
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${selected 
                        ? 'bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] shadow-[0px_4px_12px_0px_rgba(247,201,72,0.3)] hover:shadow-[0px_6px_16px_0px_rgba(247,201,72,0.4)]'
                        : 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted dark:text-[#7d8190]'
                      }
                      flex items-center justify-center gap-2
                    `}
                  >
                    {isSaving ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Select Track'
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

