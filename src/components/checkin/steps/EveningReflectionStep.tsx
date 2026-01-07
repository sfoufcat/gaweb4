'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { useEveningCheckIn } from '@/hooks/useEveningCheckIn';
import type { EveningReflectionStepProps } from './types';

// Web Speech API types
interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

/**
 * EveningReflectionStep - Text area with voice-to-text support
 *
 * Provides text input with Web Speech API voice recognition,
 * optional skip button, saves reflection to evening check-in.
 * Extracted from: src/app/checkin/evening/reflect/page.tsx
 */
export function EveningReflectionStep({ config, data, onComplete }: EveningReflectionStepProps) {
  const [reflection, setReflection] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Get config values with defaults
  const {
    question = "Anything you'd like to reflect on?",
    placeholder = 'What stood out today — something you learned, noticed, felt grateful for, or that helped you move forward...',
    showSkip = true,
    fieldName = 'reflectionText',
    enableVoice = true,
  } = config;

  const { saveReflection, checkIn } = useEveningCheckIn();

  // Load existing reflection if available
  useEffect(() => {
    if (checkIn?.reflectionText) {
      setReflection(checkIn.reflectionText);
    }
  }, [checkIn]);

  // Initialize speech recognition
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSpeechSupported(false);
      return;
    }

    const SpeechRecognitionConstructor = (window as Record<string, unknown>).webkitSpeechRecognition || (window as Record<string, unknown>).SpeechRecognition;
    const recognition = new (SpeechRecognitionConstructor as new () => SpeechRecognitionInstance)();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setReflection(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
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

        // Also save as a daily reflection for the goal page
        if (checkIn) {
          await fetch('/api/goal/reflections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'daily',
              date: new Date().toISOString().split('T')[0],
              emotionalState: data?.emotionalState || checkIn.emotionalState || 'steady',
              tasksCompleted: data?.tasksCompleted ?? checkIn.tasksCompleted ?? 0,
              tasksTotal: data?.tasksTotal ?? checkIn.tasksTotal ?? 0,
              note: reflection.trim(),
            }),
          });
        }
      }

      onComplete({ [fieldName]: reflection.trim() });
    } catch (error) {
      console.error('Error saving reflection:', error);
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onComplete({});
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-[550px] mx-auto flex-1 md:flex-initial flex flex-col pt-4 md:pt-0">
          {/* Title */}
          <h1 className="font-albert text-[32px] md:text-[44px] text-[#1a1a1a] dark:text-white tracking-[-2px] leading-[1.15] mb-2">
            {question}
          </h1>

          {/* Subtitle */}
          <p className="font-albert text-[20px] md:text-[22px] font-medium text-[#5f5a55] dark:text-[#a0a0a0] tracking-[-1px] leading-[1.3] mb-6 md:mb-8">
            Write a quick note about today.
          </p>

          {/* Text input area */}
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder={placeholder}
            className="w-full h-[120px] md:h-[150px] p-0 bg-transparent border-none resize-none font-sans text-[20px] md:text-[24px] text-[#1a1a1a] dark:text-white tracking-[-0.5px] leading-[1.4] placeholder:text-[#a7a39e] dark:placeholder:text-[#6a6a6a] focus:outline-none"
          />

          {/* Microphone button */}
          {enableVoice && speechSupported && (
            <div className="flex flex-col items-center mt-4">
              <button
                onClick={toggleListening}
                className={`w-[56px] h-[56px] md:w-[64px] md:h-[64px] rounded-full border-2 flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-[#2c2520] border-[#2c2520] text-white animate-pulse'
                    : 'bg-white dark:bg-[#1a1f28] border-[#d4d0cc] dark:border-[#3a3f48] text-[#8a857f] dark:text-[#a0a0a0] hover:border-[#2c2520] dark:hover:border-white hover:text-[#2c2520] dark:hover:text-white'
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
                <p className="text-center font-sans text-[14px] text-[#5f5a55] dark:text-[#a0a0a0] mt-3">
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
            {showSkip && (
              <button
                onClick={handleSkip}
                className="w-full bg-white dark:bg-[#1a1f28] text-[#2c2520] dark:text-white py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[17px] font-bold tracking-[-0.5px] border border-[rgba(215,210,204,0.5)] dark:border-[#3a3f48] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
