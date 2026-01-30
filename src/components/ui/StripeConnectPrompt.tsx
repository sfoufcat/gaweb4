'use client';

import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

const STRIPE_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FIcon.jpeg?alt=media&token=a0b3f96f-af0e-4f5e-87a8-50d4ddce4080';

interface StripeConnectPromptProps {
  /** Callback when the prompt is clicked */
  onClick: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Beautiful Stripe connect prompt card.
 * Shows the Stripe logo with a clean call-to-action design.
 * Used in content creation modals (videos, articles, courses, etc.)
 */
export function StripeConnectPrompt({ onClick, className = '' }: StripeConnectPromptProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#f8f6f4] to-[#f3f1ef] dark:from-[#1d222b] dark:to-[#1a1f27] border border-[#e1ddd8]/60 dark:border-[#262b35]/60 cursor-pointer hover:border-brand-accent/40 transition-all group ${className}`}
    >
      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
        <Image
          src={STRIPE_LOGO_URL}
          alt="Stripe"
          width={32}
          height={32}
          className="w-full h-full object-cover"
        />
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
