'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { useWeeklyReflection } from '@/hooks/useWeeklyReflection';
import type { VoiceTextStepProps } from './types';

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
 * VoiceTextStep - Reusable text input with voice-to-text support
 *
 * Used for weekly reflection inputs: whatWentWell, biggestObstacles, nextWeekPlan.
 * Configurable question, placeholder, field name, and required status.
 * Extracted from: src/app/checkin/weekly/went-well/page.tsx
 */
export function VoiceTextStep({ config, onComplete }: VoiceTextStepProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Get config values with defaults
  const {
    question = 'What went well?',
    placeholder = 'Write about what you\'re proud of this week...',
    fieldName = 'whatWentWell',
    isRequired = true,
    enableVoice = true,
  } = config;

  const { checkIn, isLoading, saveReflection } = useWeeklyReflection();

  // Initialize with existing data
  useEffect(() => {
    if (checkIn && fieldName && checkIn[fieldName as keyof typeof checkIn]) {
      setText(checkIn[fieldName as keyof typeof checkIn] as string);
    }
  }, [checkIn, fieldName]);

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
      setText(transcript);
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

  // Type for valid reflection field names
  type ReflectionFieldName = 'whatWentWell' | 'biggestObstacles' | 'nextWeekPlan' | 'publicFocus';

  const handleNext = async () => {
    if (isSubmitting) return;
    if (isRequired && !text.trim()) return;

    setIsSubmitting(true);

    try {
      if (text.trim()) {
        // Cast fieldName to the expected union type for saveReflection
        await saveReflection(fieldName as ReflectionFieldName, text.trim());
      }
      onComplete({ [fieldName]: text.trim() });
    } catch (error) {
      console.error('Error saving reflection:', error);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a] dark:border-white" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="max-w-[550px] w-full flex-1 md:flex-initial flex flex-col pt-4 md:pt-0">
          {/* Title */}
          <h1 className="font-albert text-[32px] md:text-[44px] text-[#1a1a1a] dark:text-white tracking-[-2px] leading-[1.15] mb-6 md:mb-8">
            {question}
          </h1>

          {/* Text Input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="w-full h-[120px] md:h-[150px] p-0 bg-transparent border-none resize-none font-sans text-[20px] md:text-[24px] text-[#1a1a1a] dark:text-white tracking-[-0.5px] leading-[1.4] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none"
            autoFocus
          />

          {/* Microphone button - centered, close to input */}
          {enableVoice && speechSupported && (
            <div className="flex flex-col items-center mt-4">
              <button
                onClick={toggleListening}
                className={`w-[56px] h-[56px] md:w-[64px] md:h-[64px] rounded-full border-2 flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-[#2c2520] dark:bg-[#b8896a] border-[#2c2520] dark:border-[#b8896a] text-white animate-pulse'
                    : 'bg-white dark:bg-[#171b22] border-[#d4d0cc] dark:border-[#3a3f48] text-[#8a857f] dark:text-[#7d8190] hover:border-[#2c2520] dark:hover:border-[#b8896a] hover:text-[#2c2520] dark:hover:text-[#b8896a]'
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

          {/* Spacer on mobile to push button down */}
          <div className="flex-1 md:hidden" />

          {/* Next button */}
          <div className="mt-8 md:mt-12 pb-8 md:pb-0">
            <button
              onClick={handleNext}
              disabled={isSubmitting || (isRequired && !text.trim())}
              className={`w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] transition-all ${
                text.trim() && !isSubmitting
                  ? 'bg-[#2c2520] dark:bg-white text-white dark:text-[#1a1a1a] hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#a7a39e] dark:text-[#7d8190] cursor-not-allowed'
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
