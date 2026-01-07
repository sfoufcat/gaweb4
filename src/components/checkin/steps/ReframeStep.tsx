'use client';

import { useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import type { ReframeStepProps } from './types';

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
 * ReframeStep - Speech-to-text thought input
 *
 * Extracted from /src/app/checkin/morning/reframe/page.tsx
 * Features:
 * - Speech-to-text with Web Speech API (webkit fallback)
 * - Microphone button with pulse animation when listening
 * - Continuous mode recognition with interim results
 * - Browser support detection and fallback to manual input
 */
export function ReframeStep({ config, onComplete }: ReframeStepProps) {
  const [thought, setThought] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Initialize speech recognition
  const startListening = () => {
    if (typeof window === 'undefined') return;

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSpeechSupported(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      setThought(transcript);
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

  const handleSubmit = async () => {
    if (!thought.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Save thought to check-in
      await fetch('/api/checkin/morning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userThought: thought.trim() }),
      });

      // Complete with the thought data
      onComplete({ userThought: thought.trim() });
    } catch (error) {
      console.error('Error saving thought:', error);
      setIsSubmitting(false);
    }
  };

  return (
    // Full-screen container
    <div className="h-full w-full bg-[#faf8f6] dark:bg-[#05070b] overflow-hidden">
      {/* Centered content container */}
      <div
        className="absolute left-1/2 top-1/2 w-full max-w-[550px] px-6 animate-page-fade-in"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        {/* Title */}
        <h1 className="font-albert text-[32px] md:text-[44px] text-[#1a1a1a] dark:text-white tracking-[-2px] leading-[1.15] mb-6 md:mb-8">
          Let&apos;s gently reframe this
        </h1>

        {/* Subtitle */}
        <h2 className="font-albert text-[22px] md:text-[28px] font-semibold text-[#1a1a1a] dark:text-white tracking-[-1px] leading-[1.3] mb-3">
          What&apos;s coming up for you right now?
        </h2>

        {/* Text input */}
        <textarea
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          placeholder={config.placeholder || "Share your thought or situation that feels heavy or is holding you back today..."}
          className="w-full h-[120px] md:h-[150px] p-0 bg-transparent border-none resize-none font-sans text-[20px] md:text-[24px] text-[#1a1a1a] dark:text-white tracking-[-0.5px] leading-[1.4] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none"
        />

        {/* Microphone button - centered, close to input */}
        {speechSupported && (
          <div className="flex flex-col items-center mt-4">
            <button
              onClick={toggleListening}
              className={`w-[56px] h-[56px] md:w-[64px] md:h-[64px] rounded-full border-2 flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-[#2c2520] dark:bg-white border-[#2c2520] dark:border-white text-white dark:text-[#1a1a1a] animate-pulse'
                  : 'bg-white dark:bg-[#171b22] border-[#d4d0cc] dark:border-[#262b35] text-[#8a857f] dark:text-[#7d8190] hover:border-[#2c2520] dark:hover:border-white hover:text-[#2c2520] dark:hover:text-white'
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
              <p className="text-center font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] mt-3">
                Listening... Tap to stop
              </p>
            )}
          </div>
        )}

        {/* Action button */}
        <div className="mt-8 md:mt-12">
          <button
            onClick={handleSubmit}
            disabled={!thought.trim() || isSubmitting}
            className={`w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] transition-all ${
              thought.trim() && !isSubmitting
                ? 'bg-[#2c2520] dark:bg-white text-white dark:text-[#1a1a1a] hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#a7a39e] dark:text-[#7d8190] cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Processing...' : 'Reframe my thought'}
          </button>
        </div>
      </div>
    </div>
  );
}
