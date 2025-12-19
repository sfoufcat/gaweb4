'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useGuestSession } from '@/hooks/useGuestSession';

/**
 * Confetti Piece Component
 */
function ConfettiPiece({ index }: { index: number }) {
  const colors = ['#ff6b6b', '#ff8c42', '#ffa500', '#9b59b6', '#a07855', '#4ecdc4', '#45b7d1', '#96ceb4', '#f7c948'];
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
 * Welcome Page - Shown after successful payment verification
 * Displays confetti animation and welcome message before account creation
 */
export default function WelcomePage() {
  const router = useRouter();
  const { data } = useGuestSession();
  const [showConfetti, setShowConfetti] = useState(false);

  // Start confetti animation on mount and redirect after delay
  useEffect(() => {
    setShowConfetti(true);

    // Redirect to create-account after 3 seconds
    const timer = setTimeout(() => {
      router.push('/start/create-account');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  // Generate confetti pieces
  const confettiPieces = showConfetti ? Array.from({ length: 50 }, (_, i) => i) : [];

  return (
    <div className="fixed inset-0 overflow-hidden bg-app-bg">
      {/* Confetti Animation Layer */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confettiPieces.map((index) => (
            <ConfettiPiece key={index} index={index} />
          ))}
        </div>
      )}

      {/* Logo Header */}
      <motion.div 
        className="absolute top-8 left-0 right-0 flex justify-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Image 
          src="/logo.jpg" 
          alt="GrowthAddicts" 
          width={56} 
          height={56} 
          className="rounded-lg"
        />
      </motion.div>

      {/* Content */}
      <div className="min-h-full flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl lg:max-w-2xl mx-auto text-center">
          {/* Celebration Icon */}
          <motion.div
            className="mb-8 inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-[#f7c948] to-[#f5b820] rounded-full shadow-[0px_0px_60px_rgba(247,201,72,0.4)]"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 200,
              damping: 15,
              duration: 0.8 
            }}
          >
            <motion.span
              className="text-5xl"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              🎉
            </motion.span>
          </motion.div>

          {/* Welcome Message */}
          <motion.h1 
            className="font-albert text-[36px] lg:text-[48px] text-text-primary tracking-[-2px] leading-[1.15] mb-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Welcome to{' '}
            <span className="bg-gradient-to-r from-[#a07855] via-[#d4a574] to-[#a07855] bg-clip-text text-transparent">
              GrowthAddicts!
            </span>
          </motion.h1>
          
          {/* Subtitle with user's name if available */}
          <motion.p 
            className="font-sans text-[17px] lg:text-[19px] text-text-secondary tracking-[-0.3px] leading-[1.4] mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            {data.firstName ? `${data.firstName}, your` : 'Your'} transformation journey begins now
          </motion.p>

          {/* Loading indicator */}
          <motion.div 
            className="flex items-center justify-center gap-2 text-text-secondary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div className="w-5 h-5 rounded-full border-2 border-[#a07855] border-t-transparent animate-spin" />
            <span className="font-sans text-[14px]">Setting up your account...</span>
          </motion.div>
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



