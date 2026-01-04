'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useClerk } from '@clerk/nextjs';
import type { EmailPreferences } from '@/types';

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
  coachingCall24h: true,
  coachingCall1h: true,
};

export function SettingsDrawer({ 
  isOpen, 
  onClose,
  initialEmailPreferences 
}: SettingsDrawerProps) {
  const { openUserProfile } = useClerk();
  
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>(
    initialEmailPreferences || DEFAULT_EMAIL_PREFERENCES
  );
  const [savingPreference, setSavingPreference] = useState<string | null>(null);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Handle Manage Payments click - redirects to coach's Stripe Connect portal
  const handleManagePayments = async () => {
    setIsLoadingPortal(true);
    setError(null);

    try {
      const response = await fetch('/api/billing/coach-portal', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to open payment portal');
      }

      const { url } = await response.json();
      
      // Open coach's Stripe billing portal in a new tab
      window.open(url, '_blank');
      setIsLoadingPortal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open payment portal');
      console.error('Error opening payment portal:', err);
      setIsLoadingPortal(false);
    }
  };

  // Handle Manage Account click (Clerk modal)
  const handleManageAccount = () => {
    openUserProfile();
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
                          <PreferenceRow label="Community call (24h before)" prefKey="squadCall24h" />
                          <PreferenceRow label="Community call (1h before)" prefKey="squadCall1h" />
                          <PreferenceRow label="1:1 call (24h before)" prefKey="coachingCall24h" />
                          <PreferenceRow label="1:1 call (1h before)" prefKey="coachingCall1h" />
                        </div>
                      </div>

                      {/* Section B: Manage Payments */}
                      <div className="mb-8">
                        <h3 className="font-albert text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-4">
                          Payments
                        </h3>
                        <button
                          onClick={handleManagePayments}
                          disabled={isLoadingPortal}
                          className="w-full py-4 px-6 bg-white dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl font-sans font-medium text-base text-text-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                        >
                          <span>Manage Payments</span>
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
                          Update payment method or view invoices
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
    </>
  );
}
