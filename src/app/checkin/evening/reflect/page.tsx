'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { Mic, MicOff, ChevronLeft } from 'lucide-react';
import { useEveningCheckIn } from '@/hooks/useEveningCheckIn';

export default function EveningReflectPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [reflection, setReflection] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const { saveReflection, checkIn } = useEveningCheckIn();

  // Load existing reflection if available
  useEffect(() => {
    if (checkIn?.reflectionText) {
      setReflection(checkIn.reflectionText);
    }
  }, [checkIn]);

  // Prefetch finish page for faster navigation
  useEffect(() => {
    router.prefetch('/checkin/evening/finish');
  }, [router]);

  // Initialize speech recognition
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSpeechSupported(false);
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setReflection(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleDone = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Save reflection text
      if (reflection.trim()) {
        await saveReflection(reflection.trim());
      }
      
      // Also save as a daily reflection for the goal page
      if (reflection.trim() && checkIn) {
        await fetch('/api/goal/reflections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'daily',
            date: new Date().toISOString().split('T')[0],
            emotionalState: checkIn.emotionalState || 'steady',
            tasksCompleted: checkIn.tasksCompleted || 0,
            tasksTotal: checkIn.tasksTotal || 0,
            note: reflection.trim(),
          }),
        });
      }

      // Navigate to finish
      router.push('/checkin/evening/finish');
    } catch (error) {
      console.error('Error saving reflection:', error);
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Use replace for instant navigation without adding to history
    router.replace('/checkin/evening/finish');
  };

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-[#faf8f6] flex items-center justify-center z-[9999]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[9999] bg-[#faf8f6] flex flex-col overflow-hidden"
    >
      {/* Back button - fixed top left */}
      <div className="px-6 pt-6 pb-2">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-[#1a1a1a] hover:text-[#5f5a55] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-[550px] mx-auto flex-1 md:flex-initial flex flex-col">
          {/* Title */}
          <h1 className="font-albert text-[32px] md:text-[44px] text-[#1a1a1a] tracking-[-2px] leading-[1.15] mb-2">
            Anything you'd like to reflect on?
          </h1>
          
          {/* Subtitle */}
          <p className="font-albert text-[20px] md:text-[22px] font-medium text-[#5f5a55] tracking-[-1px] leading-[1.3] mb-6 md:mb-8">
            Write a quick note about today.
          </p>

          {/* Text input area */}
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="What stood out today — something you learned, noticed, felt grateful for, or that helped you move forward…"
            className="w-full h-[120px] md:h-[150px] p-0 bg-transparent border-none resize-none font-sans text-[20px] md:text-[24px] text-[#1a1a1a] tracking-[-0.5px] leading-[1.4] placeholder:text-[#a7a39e] focus:outline-none"
          />

          {/* Microphone button - centered, close to input */}
          {speechSupported && (
            <div className="flex flex-col items-center mt-4">
              <button
                onClick={toggleListening}
                className={`w-[56px] h-[56px] md:w-[64px] md:h-[64px] rounded-full border-2 flex items-center justify-center transition-all ${
                  isListening 
                    ? 'bg-[#2c2520] border-[#2c2520] text-white animate-pulse' 
                    : 'bg-white border-[#d4d0cc] text-[#8a857f] hover:border-[#2c2520] hover:text-[#2c2520]'
                }`}
                aria-label={isListening ? 'Stop recording' : 'Start recording'}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5 md:w-6 md:h-6" />
                ) : (
                  <Mic className="w-5 h-5 md:w-6 md:h-6" />
                )}
              </button>
              {isListening && (
                <p className="text-center font-sans text-[14px] text-[#5f5a55] mt-3">
                  Listening... Tap to stop
                </p>
              )}
            </div>
          )}

          {/* Spacer on mobile to push buttons down */}
          <div className="flex-1 md:hidden" />

          {/* Action buttons */}
          <div className="space-y-3 mt-8 md:mt-12 pb-8 md:pb-0">
            {/* Done button */}
            <button
              onClick={handleDone}
              disabled={isSubmitting}
              className="w-full bg-[#2c2520] text-white py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[17px] font-bold tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Done'}
            </button>

            {/* Skip button */}
            <button
              onClick={handleSkip}
              className="w-full bg-white text-[#2c2520] py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[17px] font-bold tracking-[-0.5px] border border-[rgba(215,210,204,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
