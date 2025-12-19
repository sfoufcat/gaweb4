'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { ChevronLeft, X, Mic, MicOff } from 'lucide-react';
import { useWeeklyReflection } from '@/hooks/useWeeklyReflection';

export default function NextWeekPage() {
  const router = useRouter();
  const { isLoaded } = useUser();
  const { checkIn, isLoading, saveReflection } = useWeeklyReflection();
  
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Initialize with existing data
  useEffect(() => {
    if (checkIn?.nextWeekPlan) {
      setText(checkIn.nextWeekPlan);
    }
  }, [checkIn]);

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
      setText(transcript);
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

  const handleNext = async () => {
    if (isSubmitting || !text.trim()) return;
    setIsSubmitting(true);

    try {
      await saveReflection('nextWeekPlan', text.trim());
      router.push('/checkin/weekly/focus');
    } catch (error) {
      console.error('Error saving reflection:', error);
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-[#faf8f6] flex items-center justify-center z-[9999]"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[9999] bg-[#faf8f6] flex flex-col overflow-hidden"
    >
      {/* Header with back and close buttons */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <button
          onClick={() => router.push('/checkin/weekly/obstacles')}
          className="p-2 -ml-2 text-[#1a1a1a] hover:text-[#5f5a55] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => router.push('/')}
          className="p-2 -mr-2 text-[#5f5a55] hover:text-[#1a1a1a] transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="max-w-[550px] w-full flex-1 md:flex-initial flex flex-col">
          {/* Title */}
          <h1 className="font-albert text-[32px] md:text-[44px] text-[#1a1a1a] tracking-[-2px] leading-[1.15] mb-6 md:mb-8">
            What will you do differently next week?
          </h1>

          {/* Text Input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your intentions for next week..."
            className="w-full h-[120px] md:h-[150px] p-0 bg-transparent border-none resize-none font-sans text-[20px] md:text-[24px] text-[#1a1a1a] tracking-[-0.5px] leading-[1.4] placeholder:text-[#a7a39e] focus:outline-none"
            autoFocus
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

          {/* Spacer on mobile to push button down */}
          <div className="flex-1 md:hidden" />

          {/* Next button */}
          <div className="mt-8 md:mt-12 pb-8 md:pb-0">
            <button
              onClick={handleNext}
              disabled={isSubmitting || !text.trim()}
              className={`w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] transition-all ${
                text.trim() && !isSubmitting
                  ? 'bg-[#2c2520] text-white hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-[#e1ddd8] text-[#a7a39e] cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Saving...' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
