'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Check } from 'lucide-react';

/**
 * Confetti Piece Component
 */
function ConfettiPiece({ index }: { index: number }) {
  const colors = ['#ff6b6b', '#ff8c42', '#ffa500', '#9b59b6', '#a07855', '#4ecdc4', '#45b7d1', '#96ceb4'];
  const color = colors[index % colors.length];
  const left = Math.random() * 100;
  const animationDelay = Math.random() * 0.5;
  const animationDuration = 2 + Math.random() * 2;
  const size = 8 + Math.random() * 8;
  const rotation = Math.random() * 360;

  return (
    <div
      className="fixed pointer-events-none animate-confetti-fall"
      style={{
        left: `${left}%`,
        top: '-20px',
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        transform: `rotate(${rotation}deg)`,
        animationDelay: `${animationDelay}s`,
        animationDuration: `${animationDuration}s`,
        zIndex: 9999,
      }}
    />
  );
}

/**
 * Commitment/Success Page
 * 
 * DEPRECATED: This page is kept for backward compatibility.
 * The new flow goes: goal -> transformation -> plan -> Stripe checkout
 * Users who somehow land here will be redirected to the transformation page.
 */

export default function CommitmentPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [showConfetti, setShowConfetti] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Redirect to transformation page (new flow)
  useEffect(() => {
    if (isLoaded && user) {
      router.replace('/onboarding/transformation');
    }
  }, [isLoaded, user, router]);

  const handleContinue = useCallback(async () => {
    // Trigger confetti
    setShowConfetti(true);
    setIsNavigating(true);

    // Redirect to transformation page instead of completing onboarding
    setTimeout(() => {
      router.push('/onboarding/transformation');
    }, 1500);
  }, [router]);

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-app-bg">
        <div className="min-h-full flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-text-primary mx-auto mb-4" />
            <p className="text-text-secondary">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  // Generate confetti pieces
  const confettiPieces = showConfetti ? Array.from({ length: 100 }, (_, i) => i) : [];

  return (
    <div className="fixed inset-0 overflow-hidden bg-app-bg">
      {/* Confetti Layer */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confettiPieces.map((index) => (
            <ConfettiPiece key={index} index={index} />
          ))}
        </div>
      )}

      <div className="min-h-full flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl lg:max-w-2xl mx-auto text-center">
          
          {/* Success Icon */}
          <div className="mb-8 inline-flex items-center justify-center w-24 h-24 bg-[#a07855] dark:bg-[#b8896a] rounded-3xl">
            <Check className="w-12 h-12 text-white stroke-[3]" />
          </div>

          {/* Heading */}
          <h1 className="font-albert text-[42px] lg:text-[52px] text-text-primary tracking-[-2px] leading-[1.2] mb-6">
            Fantastic!
          </h1>

          {/* Subtitle */}
          <p className="font-sans text-[18px] lg:text-[20px] text-text-secondary tracking-[-0.5px] leading-[1.4] mb-12">
            You&apos;ve set your goal and your path. Now, it&apos;s time to commit!
          </p>

          {/* Action Button */}
          <button
            onClick={handleContinue}
            disabled={isNavigating}
            className="w-full bg-[#2c2520] text-white font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-80 disabled:cursor-not-allowed"
          >
            {isNavigating ? '🎉 Let\'s go!' : 'Let\'s go!'}
          </button>

        </div>
      </div>

      {/* Confetti Animation Styles */}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        :global(.animate-confetti-fall) {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}

