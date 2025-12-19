'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, ChevronLeft } from 'lucide-react';

export default function ReframePage() {
  const router = useRouter();
  const [thought, setThought] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

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
      setThought(transcript);
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

      // Navigate to neutralize (AI reframe) page
      router.push(`/checkin/morning/neutralize?thought=${encodeURIComponent(thought.trim())}`);
    } catch (error) {
      console.error('Error saving thought:', error);
      setIsSubmitting(false);
    }
  };

  return (
    // Fixed container - viewport positioning
    <div 
      className="fixed inset-0 z-[9999] bg-[#faf8f6] overflow-hidden"
      style={{ minHeight: '100dvh' }}
    >
      {/* Back button - absolute positioned, outside animation */}
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-[#1a1a1a] hover:text-[#5f5a55] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Centered content container - uses absolute positioning for bulletproof centering */}
      <div 
        className="absolute left-1/2 top-1/2 w-full max-w-[550px] px-6 animate-page-fade-in"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        {/* Title */}
        <h1 className="font-albert text-[32px] md:text-[44px] text-[#1a1a1a] tracking-[-2px] leading-[1.15] mb-6 md:mb-8">
          Let&apos;s gently reframe this
        </h1>

        {/* Subtitle */}
        <h2 className="font-albert text-[22px] md:text-[28px] font-semibold text-[#1a1a1a] tracking-[-1px] leading-[1.3] mb-3">
          What&apos;s coming up for you right now?
        </h2>
        
        {/* Text input */}
        <textarea
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          placeholder="Share your thought or situation that feels heavy or is holding you back today..."
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

        {/* Action button */}
        <div className="mt-8 md:mt-12">
          <button
            onClick={handleSubmit}
            disabled={!thought.trim() || isSubmitting}
            className={`w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] transition-all ${
              thought.trim() && !isSubmitting
                ? 'bg-[#2c2520] text-white hover:scale-[1.02] active:scale-[0.98]' 
                : 'bg-[#e1ddd8] text-[#a7a39e] cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Processing...' : 'Reframe my thought'}
          </button>
        </div>
      </div>
    </div>
  );
}
