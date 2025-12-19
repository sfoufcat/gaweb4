'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';

/**
 * Rocket Piece Component - flies upward
 */
function RocketPiece({ index }: { index: number }) {
  const left = 5 + Math.random() * 90; // Keep rockets within visible area
  const animationDelay = Math.random() * 1.5;
  const animationDuration = 2 + Math.random() * 1.5;
  const size = 24 + Math.random() * 16; // 24-40px rockets
  const rotation = -15 + Math.random() * 30; // Slight tilt variation

  return (
    <div
      className="fixed pointer-events-none animate-rocket-fly"
      style={{
        left: `${left}%`,
        bottom: '-60px',
        fontSize: `${size}px`,
        transform: `rotate(${rotation}deg)`,
        animationDelay: `${animationDelay}s`,
        animationDuration: `${animationDuration}s`,
        zIndex: 9999,
      }}
    >
      🚀
    </div>
  );
}

/**
 * Star Sparkle Component
 */
function StarSparkle({ index }: { index: number }) {
  const left = Math.random() * 100;
  const top = Math.random() * 100;
  const animationDelay = Math.random() * 2;
  const size = 12 + Math.random() * 12;

  return (
    <div
      className="fixed pointer-events-none animate-sparkle"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        fontSize: `${size}px`,
        animationDelay: `${animationDelay}s`,
        zIndex: 9998,
      }}
    >
      ✨
    </div>
  );
}

/**
 * Journey Started Page
 * Celebratory animation with rockets before redirecting to homepage
 */
export default function JourneyStartedPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [showAnimation, setShowAnimation] = useState(false);

  // Start animation on mount
  useEffect(() => {
    setShowAnimation(true);
    
    // Redirect to homepage after 3 seconds
    const timer = setTimeout(() => {
      router.push('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/');
    }
  }, [isLoaded, user, router]);

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  // Generate animation pieces
  const rockets = showAnimation ? Array.from({ length: 20 }, (_, i) => i) : [];
  const sparkles = showAnimation ? Array.from({ length: 15 }, (_, i) => i) : [];

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-b from-[#1a1510] via-[#2c2520] to-[#1a1510]">
      {/* Rocket Animation Layer */}
      {showAnimation && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {rockets.map((index) => (
            <RocketPiece key={index} index={index} />
          ))}
          {sparkles.map((index) => (
            <StarSparkle key={`sparkle-${index}`} index={index} />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="min-h-full flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto text-center">
          {/* Animated Icon */}
          <motion.div
            className="mb-8 inline-flex items-center justify-center w-28 h-28 bg-gradient-to-br from-[#f7c948] to-[#f5b820] rounded-full shadow-[0px_0px_60px_rgba(247,201,72,0.4)]"
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
              🚀
            </motion.span>
          </motion.div>

          {/* Title */}
          <motion.h1 
            className="font-albert text-[42px] lg:text-[52px] text-white tracking-[-2px] leading-[1.1] mb-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Your journey{' '}
            <span className="bg-gradient-to-r from-[#f7c948] to-[#f5b820] bg-clip-text text-transparent">
              has started!
            </span>
          </motion.h1>
          
          {/* Subtitle */}
          <motion.p 
            className="font-sans text-[18px] text-white/70 leading-[1.5]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            Get ready to crush your goals
          </motion.p>

          {/* Loading dots */}
          <motion.div 
            className="flex justify-center gap-2 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-[#f7c948] animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes rocket-fly {
          0% {
            transform: translateY(0) rotate(var(--rotation, 0deg));
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(-120vh) rotate(var(--rotation, 0deg));
            opacity: 0;
          }
        }
        :global(.animate-rocket-fly) {
          animation: rocket-fly ease-out forwards;
        }
        
        @keyframes sparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
        :global(.animate-sparkle) {
          animation: sparkle 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

