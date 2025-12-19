'use client';

import { useState, useEffect, useRef } from 'react';

interface ManifestCardProps {
  type: 'identity' | 'goal';
  content: string;
  subtitle?: string;
  duration: number; // in seconds
  onComplete: () => void;
  audioSrc?: string; // Optional audio for goal manifestation
}

// Gradient backgrounds matching Figma
const GRADIENTS = {
  identity: 'linear-gradient(180deg, #B8D4D4 0%, #D4B8C8 50%, #E8C8B8 100%)',
  goal: 'linear-gradient(180deg, #E066FF 0%, #9933FF 50%, #6600CC 100%)',
};

export function ManifestCard({ 
  type, 
  content, 
  subtitle,
  duration, 
  onComplete,
  audioSrc,
}: ManifestCardProps) {
  const [progress, setProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start expansion animation
    setTimeout(() => setIsExpanded(true), 100);

    // Start progress timer
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      const newProgress = Math.min(100, (elapsed / (duration * 1000)) * 100);
      setProgress(newProgress);

      if (now >= endTime) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    }, 100);

    // Play audio if provided
    if (audioSrc && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [duration, audioSrc]);

  const handleContinue = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onComplete();
  };

  return (
    <div 
      className={`fixed inset-0 z-50 transition-all duration-700 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
      style={{ background: GRADIENTS[type] }}
    >
      {/* Audio element for goal meditation */}
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} loop />
      )}

      {/* Progress bar at top */}
      <div className="absolute top-[20px] left-[20px] right-[20px]">
        <div className="w-full h-[2px] bg-white/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white/80 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="h-full flex flex-col items-center justify-center px-8">
        {/* Circle outline (subtle) */}
        <div className="relative">
          <div 
            className={`absolute inset-0 rounded-full border border-white/20 transition-all duration-1000 ${
              isExpanded ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            }`}
            style={{ width: '400px', height: '400px', marginLeft: '-200px', marginTop: '-200px', left: '50%', top: '50%' }}
          />
        </div>

        {/* Text content */}
        <div className="text-center max-w-[400px] relative z-10">
          <h1 
            className={`font-albert font-medium tracking-[-2px] leading-[1.2] transition-all duration-700 delay-300 ${
              isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } ${type === 'goal' ? 'text-white text-[48px]' : 'text-[#1a1a1a] text-[48px]'}`}
          >
            {content}
          </h1>
          
          {subtitle && (
            <p 
              className={`mt-4 font-sans text-[18px] tracking-[-0.4px] transition-all duration-700 delay-500 ${
                isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              } ${type === 'goal' ? 'text-white/80' : 'text-[#5f5a55]'}`}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Continue button */}
      <div className="absolute bottom-[40px] left-0 right-0 px-6">
        <button
          onClick={handleContinue}
          className={`w-full max-w-[354px] mx-auto block py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] transition-all ${
            type === 'goal' 
              ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30' 
              : 'bg-white/50 text-[#2c2520] border border-white/30 hover:bg-white/70'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

