'use client';

import { ArrowRight } from 'lucide-react';

interface StripeConnectPromptProps {
  /** Callback when the prompt is clicked */
  onClick: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Beautiful Stripe connect prompt card.
 * Shows the Stripe S logo with a clean call-to-action design.
 * Used in content creation modals (videos, articles, courses, etc.)
 */
export function StripeConnectPrompt({ onClick, className = '' }: StripeConnectPromptProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#f8f6f4] to-[#f3f1ef] dark:from-[#1d222b] dark:to-[#1a1f27] border border-[#e1ddd8]/60 dark:border-[#262b35]/60 cursor-pointer hover:border-brand-accent/40 transition-all group ${className}`}
    >
      <div className="w-8 h-8 rounded-lg bg-[#635bff]/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-[#635bff]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Connect Stripe for payments
        </p>
        <p className="text-xs text-[#5f5a55] dark:text-[#8b8f9a] font-albert">
          Enable paid content in seconds
        </p>
      </div>
      <ArrowRight className="w-4 h-4 text-[#8c8c8c] group-hover:text-brand-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </div>
  );
}
