'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useClerk } from '@clerk/nextjs';
import type { EmailPreferences, UserTrack } from '@/types';
import { useTrack } from '@/hooks/useTrack';
import { TrackSelectionModal } from './TrackSelectionModal';
import { useMenuTitles } from '@/contexts/BrandingContext';

// Track labels for display
const TRACK_LABELS: Record<UserTrack, string> = {
  content_creator: 'Content Creator',
  saas: 'SaaS Founder',
  coach_consultant: 'Coach / Consultant',
  ecom: 'E-Commerce',
  agency: 'Agency Owner',
  community_builder: 'Community Builder',
  general: 'General Entrepreneur',
};

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmailPreferences?: EmailPreferences;
}

// Default email preferences (all enabled by default)
const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  morningCheckIn: true,
  eveningCheckIn: true,
  weeklyReview: true,
  squadCall24h: true,
  squadCall1h: true,
};

export function SettingsDrawer({ 
  isOpen, 
  onClose,
  initialEmailPreferences 
}: SettingsDrawerProps) {
  const { openUserProfile } = useClerk();
  const { track, hasTrack, isLoading: trackLoading, setTrack, refreshTrack } = useTrack();
  const { squad: squadTitle } = useMenuTitles();
  
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>(
    initialEmailPreferences || DEFAULT_EMAIL_PREFERENCES
  );
  const [savingPreference, setSavingPreference] = useState<string | null>(null);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrackResetModal, setShowTrackResetModal] = useState(false);
  const [isResettingTrack, setIsResettingTrack] = useState(false);
  const [showTrackSelectModal, setShowTrackSelectModal] = useState(false);

  // Update local state when initialEmailPreferences changes
  useEffect(() => {
    if (initialEmailPreferences) {
      setEmailPreferences(initialEmailPreferences);
    }
  }, [initialEmailPreferences]);

  // Handle toggle change for email preferences
  const handleToggle = async (key: keyof EmailPreferences) => {
    const newValue = !emailPreferences[key];
    
    // Optimistically update UI
    setEmailPreferences(prev => ({
      ...prev,
      [key]: newValue,
    }));
    
    setSavingPreference(key);
    setError(null);

    try {
      const response = await fetch('/api/user/email-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [key]: newValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preference');
      }
    } catch (err) {
      // Revert on error
      setEmailPreferences(prev => ({
        ...prev,
        [key]: !newValue,
      }));
      setError('Failed to save preference. Please try again.');
      console.error('Error saving email preference:', err);
    } finally {
      setSavingPreference(null);
    }
  };

  // Handle Manage Subscription click
  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    setError(null);

    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to open billing portal');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe billing portal
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
      console.error('Error opening billing portal:', err);
      setIsLoadingPortal(false);
    }
  };

  // Handle Manage Account click (Clerk modal)
  const handleManageAccount = () => {
    openUserProfile();
  };

  // Handle Change Track click
  const handleChangeTrack = () => {
    setShowTrackResetModal(true);
  };

  // Handle Track Reset confirmation
  const handleConfirmTrackReset = async () => {
    setIsResettingTrack(true);
    setError(null);

    try {
      const response = await fetch('/api/user/track/reset', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset track');
      }

      // Close reset modal and show track selection modal
      setShowTrackResetModal(false);
      setShowTrackSelectModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset track');
      console.error('Error resetting track:', err);
    } finally {
      setIsResettingTrack(false);
    }
  };

  // Toggle component
  const Toggle = ({ 
    enabled, 
    onChange, 
    loading,
    disabled 
  }: { 
    enabled: boolean; 
    onChange: () => void;
    loading?: boolean;
    disabled?: boolean;
  }) => (
    <button
      onClick={onChange}
      disabled={loading || disabled}
      className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-offset-2 ${
        enabled ? 'bg-earth-600' : 'bg-gray-200 dark:bg-[#262b35]'
      } ${(loading || disabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
      role="switch"
      aria-checked={enabled}
    >
      <span className="sr-only">Toggle setting</span>
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-7' : 'translate-x-0'
        }`}
      >
        {loading && (
          <svg className="w-full h-full p-1 animate-spin text-earth-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
      </span>
    </button>
  );

  // Email preference row
  const PreferenceRow = ({ 
    label, 
    prefKey 
  }: { 
    label: string; 
    prefKey: keyof EmailPreferences;
  }) => (
    <div className="flex items-center justify-between py-4 border-b border-[#e1ddd8]/30 dark:border-[#262b35]/30 last:border-b-0">
      <span className="font-sans text-base text-text-primary dark:text-[#f5f5f8]">{label}</span>
      <Toggle
        enabled={emailPreferences[prefKey]}
        onChange={() => handleToggle(prefKey)}
        loading={savingPreference === prefKey}
      />
    </div>
  );

  return (
    <>
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-200"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-app-bg dark:bg-[#05070b] shadow-xl">
                    {/* Header */}
                    <div className="px-6 py-6 border-b border-[#e1ddd8]/30 dark:border-[#262b35]/30">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="font-albert text-2xl text-text-primary dark:text-[#f5f5f8] tracking-[-1px]">
                          Settings
                        </Dialog.Title>
                        <button
                          onClick={onClose}
                          className="ml-3 w-8 h-8 flex items-center justify-center text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] rounded-full transition-all duration-200"
                          aria-label="Close settings"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      {/* Error display */}
                      {error && (
                        <div className="mb-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4">
                          <p className="font-sans text-sm text-red-600 dark:text-red-300">{error}</p>
                        </div>
                      )}

                      {/* Section A: Email Notifications */}
                      <div className="mb-8">
                        <h3 className="font-albert text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-4">
                          Email Notifications
                        </h3>
                        <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 px-4">
                          <PreferenceRow label="Morning check-in" prefKey="morningCheckIn" />
                          <PreferenceRow label="Evening check-in" prefKey="eveningCheckIn" />
                          <PreferenceRow label="Weekly review" prefKey="weeklyReview" />
                          <PreferenceRow label={`${squadTitle} call (24h before)`} prefKey="squadCall24h" />
                          <PreferenceRow label={`${squadTitle} call (1h before)`} prefKey="squadCall1h" />
                        </div>
                      </div>

                      {/* Section B: My Track */}
                      <div className="mb-8">
                        <h3 className="font-albert text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-4">
                          My Track
                        </h3>
                        <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 p-4">
                          {trackLoading ? (
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full border-2 border-[#e1ddd8] dark:border-[#262b35] border-t-[#a07855] animate-spin" />
                              <span className="font-sans text-sm text-text-secondary dark:text-[#b2b6c2]">Loading...</span>
                            </div>
                          ) : hasTrack && track ? (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-sans font-medium text-base text-text-primary dark:text-[#f5f5f8]">
                                  {TRACK_LABELS[track]}
                                </p>
                                <p className="font-sans text-xs text-text-secondary dark:text-[#b2b6c2] mt-0.5">
                                  Your current business focus
                                </p>
                              </div>
                              <button
                                onClick={handleChangeTrack}
                                className="font-sans text-sm font-medium text-[#a07855] hover:text-[#8c6245] transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <p className="font-sans text-sm text-text-secondary dark:text-[#b2b6c2]">
                                No track selected
                              </p>
                              <button
                                onClick={() => setShowTrackSelectModal(true)}
                                className="font-sans text-sm font-medium text-[#a07855] hover:text-[#8c6245] transition-colors"
                              >
                                Select Track
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section C: Manage Subscription */}
                      <div className="mb-8">
                        <h3 className="font-albert text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-4">
                          Subscription
                        </h3>
                        <button
                          onClick={handleManageSubscription}
                          disabled={isLoadingPortal}
                          className="w-full py-4 px-6 bg-white dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl font-sans font-medium text-base text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                        >
                          <span>Manage Subscription</span>
                          {isLoadingPortal ? (
                            <svg className="w-5 h-5 animate-spin text-text-secondary dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </button>
                        <p className="mt-2 px-1 font-sans text-xs text-text-secondary dark:text-[#b2b6c2]">
                          Update payment method, change plan, or view invoices
                        </p>
                      </div>

                      {/* Section D: Manage Account */}
                      <div className="mb-8">
                        <h3 className="font-albert text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-4">
                          Account
                        </h3>
                        <button
                          onClick={handleManageAccount}
                          className="w-full py-4 px-6 bg-white dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl font-sans font-medium text-base text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors flex items-center justify-between"
                        >
                          <span>Manage Account</span>
                          <svg className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <p className="mt-2 px-1 font-sans text-xs text-text-secondary dark:text-[#b2b6c2]">
                          Change email, password, or connected accounts
                        </p>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>

    {/* Track Reset Confirmation Modal */}
    <Transition appear show={showTrackResetModal} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={() => !isResettingTrack && setShowTrackResetModal(false)}>
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="font-albert text-xl text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-3">
                  Change Your Track?
                </Dialog.Title>
                
                <div className="mb-6">
                  <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-relaxed mb-4">
                    Switching your track will reset your Starter Program, your program tasks, and your program habits.
                  </p>
                  <p className="font-sans text-[15px] text-text-primary dark:text-[#f5f5f8] font-medium mb-4">
                    Your streak will stay untouched.
                  </p>
                  <div className="bg-[#f3f1ef] dark:bg-[#1d222b] rounded-xl p-4 space-y-2">
                    <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2] leading-relaxed">
                      <span className="font-medium text-text-primary dark:text-[#f5f5f8]">Will be reset:</span> Program tasks, program habits, Starter Program enrollment
                    </p>
                    <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2] leading-relaxed">
                      <span className="font-medium text-green-600 dark:text-green-400">Stays unchanged:</span> Streak, squads, custom habits, premium status, coach assignment
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowTrackResetModal(false)}
                    disabled={isResettingTrack}
                    className="flex-1 py-3 px-4 rounded-xl font-sans font-medium text-[15px] bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTrackReset}
                    disabled={isResettingTrack}
                    className="flex-1 py-3 px-4 rounded-xl font-sans font-medium text-[15px] bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isResettingTrack ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Resetting...
                      </>
                    ) : (
                      'Yes, change track'
                    )}
                  </button>
                </div>
                </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>

    {/* Track Selection Modal */}
    <TrackSelectionModal
      isOpen={showTrackSelectModal}
      onClose={() => setShowTrackSelectModal(false)}
      onSelect={async (selectedTrack) => {
        const success = await setTrack(selectedTrack);
        if (success) {
          await refreshTrack();
          setShowTrackSelectModal(false);
        } else {
          setError('Failed to set track. Please try again.');
        }
      }}
    />
    </>
  );
}
