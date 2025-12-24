'use client';

import { useState, useCallback } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import type { FeedReportReason } from '@/types';

interface ReportModalProps {
  postId: string;
  onClose: () => void;
}

const REPORT_REASONS: { value: FeedReportReason; label: string; description: string }[] = [
  { 
    value: 'spam', 
    label: 'Spam', 
    description: 'Misleading or repetitive content' 
  },
  { 
    value: 'harassment', 
    label: 'Harassment or bullying', 
    description: 'Targeting or threatening someone' 
  },
  { 
    value: 'inappropriate', 
    label: 'Inappropriate content', 
    description: 'Nudity, violence, or offensive material' 
  },
  { 
    value: 'misinformation', 
    label: 'Misinformation', 
    description: 'False or misleading information' 
  },
  { 
    value: 'other', 
    label: 'Other', 
    description: 'Something else not listed above' 
  },
];

export function ReportModal({ postId, onClose }: ReportModalProps) {
  const { colors, isDefault } = useBrandingValues();
  const [selectedReason, setSelectedReason] = useState<FeedReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!selectedReason || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/feed/${postId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error === 'You have already reported this post') {
          alert('You have already reported this post.');
          onClose();
          return;
        }
        throw new Error(error.error || 'Failed to submit report');
      }

      setSubmitted(true);
      
      // Auto close after showing success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Report error:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  }, [postId, selectedReason, details, isSubmitting, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[10%] md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md bg-white dark:bg-[#13171f] rounded-2xl z-50 overflow-hidden shadow-xl">
        {submitted ? (
          // Success state
          <div className="p-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <svg className="w-8 h-8" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#faf8f6] mb-2">
              Report Submitted
            </h2>
            <p className="text-[14px] text-[#8a857f]">
              Thank you for helping keep our community safe. Our team will review this report.
            </p>
          </div>
        ) : (
          // Report form
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#e8e4df] dark:border-[#262b35]">
              <h2 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6]">
                Report Post
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
              >
                <svg className="w-5 h-5 text-[#8a857f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-4">
              <p className="text-[14px] text-[#8a857f] mb-4">
                Why are you reporting this post?
              </p>

              {/* Reasons */}
              <div className="space-y-2 mb-4">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason.value}
                    onClick={() => setSelectedReason(reason.value)}
                    className={`w-full p-3 rounded-xl text-left transition-colors border ${
                      selectedReason === reason.value
                        ? 'border-2'
                        : 'border-[#e8e4df] dark:border-[#262b35] hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a]'
                    }`}
                    style={selectedReason === reason.value ? { 
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}08`,
                    } : undefined}
                  >
                    <p className="font-medium text-[14px] text-[#1a1a1a] dark:text-[#faf8f6]">
                      {reason.label}
                    </p>
                    <p className="text-[12px] text-[#8a857f]">
                      {reason.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Additional details */}
              {selectedReason && (
                <div className="mb-4">
                  <label className="block text-[13px] text-[#8a857f] mb-2">
                    Additional details (optional)
                  </label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Provide any additional context..."
                    className="w-full h-24 px-3 py-2 rounded-xl bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[14px] text-[#1a1a1a] dark:text-[#faf8f6] placeholder-[#8a857f] resize-none focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{ ['--tw-ring-color' as string]: accentColor }}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#e8e4df] dark:border-[#262b35] flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[14px] font-medium text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#ebe7e2] dark:hover:bg-[#262b35] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedReason || isSubmitting}
                className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: accentColor }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

