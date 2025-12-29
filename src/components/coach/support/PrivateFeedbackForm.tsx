'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Loader2, CheckCircle, X, ChevronDown } from 'lucide-react';

type FeedbackCategory = 'general' | 'bug' | 'improvement' | 'other';

interface PrivateFeedbackFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string; description: string }[] = [
  { value: 'general', label: 'General Feedback', description: 'Share your thoughts' },
  { value: 'improvement', label: 'Improvement Suggestion', description: 'How we can do better' },
  { value: 'bug', label: 'Bug Report', description: 'Something isn\'t working' },
  { value: 'other', label: 'Other', description: 'Anything else' },
];

export function PrivateFeedbackForm({ isOpen, onClose }: PrivateFeedbackFormProps) {
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feedback',
          message,
          category,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      setIsSuccess(true);
      setMessage('');
      setCategory('general');

      // Auto-close after 3 seconds
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <>
      {/* Backdrop with fade-in animation */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal with scale + fade animation */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="relative w-full max-w-md bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-accent/10 dark:bg-brand-accent/20 flex items-center justify-center">
                <Lock className="w-4 h-4 text-brand-accent" />
              </div>
              <h3 className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8]">
                Private Feedback
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          {isSuccess ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h4 className="font-albert font-semibold text-xl text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Thank You!
              </h4>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Your feedback has been submitted privately. We appreciate you taking the time to help us improve.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Share confidential feedback with our team. This won&apos;t be visible to other users.
              </p>

              <div>
                <label 
                  htmlFor="feedback-category"
                  className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5"
                >
                  Category
                </label>
                <div className="relative">
                  <select
                    id="feedback-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                    className="w-full appearance-none px-4 py-2.5 pr-10 bg-[#faf8f6] dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 dark:focus:ring-brand-accent/30 focus:border-brand-accent dark:focus:border-brand-accent transition-all cursor-pointer"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8c8680] dark:text-[#6b7280] pointer-events-none" />
                </div>
              </div>

              <div>
                <label 
                  htmlFor="feedback-message"
                  className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5"
                >
                  Your Feedback
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share your thoughts, report an issue, or suggest an improvement..."
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  className="w-full px-4 py-2.5 bg-[#faf8f6] dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8680] dark:placeholder:text-[#6b7280] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 dark:focus:ring-brand-accent/30 focus:border-brand-accent dark:focus:border-brand-accent transition-all resize-none"
                />
                <p className="mt-1 text-xs text-[#8c8680] dark:text-[#6b7280] font-albert">
                  {message.length}/2000 characters
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 font-albert">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-[#faf8f6] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] font-albert font-medium rounded-xl hover:bg-[#e1ddd8] dark:hover:bg-[#2d333e] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || message.trim().length < 10}
                  style={{
                    background: `linear-gradient(to right, var(--brand-accent-light, #a07855), var(--brand-accent-dark, #8c6245))`,
                    color: `var(--brand-accent-foreground, #ffffff)`,
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 font-albert font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Submit Privately
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}


