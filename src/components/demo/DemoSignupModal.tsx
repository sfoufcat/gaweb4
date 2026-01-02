'use client';

/**
 * DemoSignupModal
 * 
 * Modal shown when demo users try to perform permanent save actions.
 * Prompts them to sign up on growthaddicts.com to continue.
 */

import { useState, useEffect } from 'react';
import { X, Sparkles, ArrowRight, Check } from 'lucide-react';

interface DemoSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  action?: string; // What action they were trying to do
  featureHighlights?: string[]; // Features to highlight
}

export function DemoSignupModal({
  isOpen,
  onClose,
  action = 'save your changes',
  featureHighlights = [
    'Create unlimited programs',
    'Build engaged communities',
    'Custom branding & domain',
    'Powerful analytics',
  ],
}: DemoSignupModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const handleSignUp = () => {
    // Redirect to the main growthaddicts.com join page
    window.location.href = 'https://growthaddicts.com/join';
  };

  const handleSignIn = () => {
    // Redirect to sign in
    window.location.href = 'https://growthaddicts.com/sign-in';
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-[#171b22] rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with gradient */}
        <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-[#a07855] to-[#8b6745] text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Ready to get started?</h2>
              <p className="text-white/80 text-sm">Create your free account</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-6">
            To <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{action}</span>, 
            create your account and unlock all features:
          </p>

          {/* Feature list */}
          <ul className="space-y-3 mb-6">
            {featureHighlights.map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">
                  {feature}
                </span>
              </li>
            ))}
          </ul>

          {/* CTA Buttons */}
          <button
            onClick={handleSignUp}
            className="w-full py-3.5 px-6 rounded-xl bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] font-semibold text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity mb-3"
          >
            Start Free Trial
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleSignIn}
            className="w-full py-3 px-6 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium text-sm hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a] transition-colors"
          >
            Already have an account? Sign in
          </button>

          {/* Note */}
          <p className="text-center text-xs text-[#8a857f] dark:text-[#6b6f7b] mt-4">
            No credit card required · 14-day free trial
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage demo signup modal state
 */
export function useDemoSignupModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState<string>('save your changes');

  const showModal = (actionDescription?: string) => {
    if (actionDescription) {
      setAction(actionDescription);
    }
    setIsOpen(true);
  };

  const hideModal = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    action,
    showModal,
    hideModal,
  };
}

/**
 * DemoActionButton
 * 
 * A button wrapper that shows the signup modal instead of performing the action in demo mode.
 */
interface DemoActionButtonProps {
  isDemoMode: boolean;
  onClick: () => void;
  actionDescription: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function DemoActionButton({
  isDemoMode,
  onClick,
  actionDescription,
  children,
  className = '',
  disabled = false,
}: DemoActionButtonProps) {
  const { isOpen, action, showModal, hideModal } = useDemoSignupModal();

  const handleClick = () => {
    if (isDemoMode) {
      showModal(actionDescription);
    } else {
      onClick();
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={className}
        disabled={disabled}
      >
        {children}
      </button>
      <DemoSignupModal
        isOpen={isOpen}
        onClose={hideModal}
        action={action}
      />
    </>
  );
}

