'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { ChevronLeft, X, Sparkles } from 'lucide-react';
import { useWeeklyReflection } from '@/hooks/useWeeklyReflection';

interface FocusSuggestion {
  suggestion: string | null;
  currentWeek: number | null;
  trackName: string | null;
}

export default function FocusPage() {
  const router = useRouter();
  const { isLoaded } = useUser();
  const { checkIn, isLoading, saveReflection, completeCheckIn } = useWeeklyReflection();
  
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [suggestion, setSuggestion] = useState<FocusSuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(true);

  // Fetch CMS suggestion on mount
  useEffect(() => {
    async function fetchSuggestion() {
      try {
        const response = await fetch('/api/weekly-focus/suggestion');
        if (response.ok) {
          const data = await response.json();
          setSuggestion(data);
        }
      } catch (error) {
        console.error('Error fetching focus suggestion:', error);
      } finally {
        setSuggestionLoading(false);
      }
    }
    
    fetchSuggestion();
  }, []);

  // Initialize with existing data
  useEffect(() => {
    if (checkIn?.publicFocus) {
      setText(checkIn.publicFocus);
    }
  }, [checkIn]);

  const handleShare = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Save the public focus
      if (text.trim()) {
        await saveReflection('publicFocus', text.trim());
      }
      // Complete the check-in
      await completeCheckIn();
      router.push('/checkin/weekly/finish');
    } catch (error) {
      console.error('Error completing reflection:', error);
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (isSkipping) return;
    setIsSkipping(true);

    try {
      // Complete the check-in without public focus
      await completeCheckIn();
      router.push('/checkin/weekly/finish');
    } catch (error) {
      console.error('Error skipping:', error);
      setIsSkipping(false);
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
          onClick={() => router.push('/checkin/weekly/next-week')}
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
          {/* Header */}
          <h1 className="font-albert text-[28px] md:text-[42px] text-[#1a1a1a] tracking-[-2px] leading-[1.2] mb-1">
            What&apos;s your focus for the next week?
          </h1>
          
          {/* Public badge */}
          <p className="font-sans text-[14px] text-[#5f5a55] tracking-[-0.3px] leading-[1.2] mb-4 md:mb-6">
            (public)
          </p>

          {/* Text Input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="This week I'm committing to finishing my portfolio draft and running three times..."
            className="w-full h-[140px] md:h-[180px] p-0 bg-transparent border-none resize-none font-sans text-[18px] md:text-[24px] text-[#1a1a1a] tracking-[-0.5px] leading-[1.4] placeholder:text-[#a7a39e] focus:outline-none"
            autoFocus
          />

          {/* CMS Suggestion Pill */}
          {!suggestionLoading && suggestion?.suggestion && !text.trim() && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4"
            >
              <p className="font-sans text-[12px] text-[#5f5a55] mb-2">
                {suggestion.trackName ? `${suggestion.trackName} suggestion for week ${suggestion.currentWeek}:` : 'Suggested focus:'}
              </p>
              <button
                onClick={() => setText(suggestion.suggestion || '')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#a07855]/10 to-[#8c6245]/5 hover:from-[#a07855]/20 hover:to-[#8c6245]/10 border border-[#a07855] dark:border-[#b8896a]/20 rounded-full transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
                <span className="font-sans text-[14px] text-[#1a1a1a] font-medium">
                  {suggestion.suggestion}
                </span>
              </button>
            </motion.div>
          )}

          {/* Spacer on mobile to push buttons down */}
          <div className="flex-1 md:hidden" />

          {/* Buttons */}
          <div className="space-y-3 mt-6 md:mt-10 pb-8 md:pb-0">
            <button
              onClick={handleShare}
              disabled={isSubmitting || isSkipping || !text.trim()}
              className={`w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] transition-all ${
                text.trim() && !isSubmitting && !isSkipping
                  ? 'bg-[#2c2520] text-white hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-[#e1ddd8] text-[#a7a39e] cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Sharing...' : 'Share my plan'}
            </button>
            
            <button
              onClick={handleSkip}
              disabled={isSubmitting || isSkipping}
              className="w-full max-w-[400px] mx-auto block bg-white border border-[rgba(215,210,204,0.5)] text-[#2c2520] py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] hover:bg-[#f3f1ef] transition-all disabled:opacity-50"
            >
              {isSkipping ? 'Skipping...' : 'Skip this time'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}



