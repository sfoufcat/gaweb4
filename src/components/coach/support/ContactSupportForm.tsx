'use client';

import { useState } from 'react';
import { Send, Loader2, CheckCircle } from 'lucide-react';

interface ContactSupportFormProps {
  onSuccess?: () => void;
}

export function ContactSupportForm({ onSuccess }: ContactSupportFormProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'support',
          subject,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      setIsSuccess(true);
      setSubject('');
      setMessage('');
      onSuccess?.();

      // Reset success state after 5 seconds
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-6 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h3 className="font-albert font-semibold text-lg text-emerald-800 dark:text-emerald-200 mb-1">
          Message Sent!
        </h3>
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-albert">
          We&apos;ll get back to you as soon as possible.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label 
          htmlFor="support-subject" 
          className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5"
        >
          Subject
        </label>
        <input
          id="support-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What do you need help with?"
          required
          minLength={5}
          maxLength={100}
          className="w-full px-4 py-2.5 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8680] dark:placeholder:text-[#6b7280] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:focus:border-[#b8896a] transition-all"
        />
      </div>

      <div>
        <label 
          htmlFor="support-message" 
          className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5"
        >
          Message
        </label>
        <textarea
          id="support-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue or question in detail..."
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          className="w-full px-4 py-2.5 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8680] dark:placeholder:text-[#6b7280] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:focus:border-[#b8896a] transition-all resize-none"
        />
        <p className="mt-1 text-xs text-[#8c8680] dark:text-[#6b7280] font-albert">
          {message.length}/2000 characters (min 10)
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 font-albert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !subject.trim() || message.trim().length < 10}
        style={{
          background: `linear-gradient(to right, var(--brand-accent-light, #a07855), var(--brand-accent-dark, #8c6245))`,
          color: `var(--brand-accent-foreground, #ffffff)`,
        }}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 font-albert font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:opacity-90"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send Message
          </>
        )}
      </button>
    </form>
  );
}


