'use client';

import { useState } from 'react';
import { Mail, MessageSquare, Lightbulb, Lock, ExternalLink } from 'lucide-react';
import { ContactSupportForm } from './ContactSupportForm';
import { FeatureVotingBoard } from './FeatureVotingBoard';
import { PrivateFeedbackForm } from './PrivateFeedbackForm';

const SUPPORT_EMAIL = 'hello@growthaddicts.com';

export function CoachSupportTab() {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  return (
    <div className="space-y-8">
      {/* Support Contact Section */}
      <section className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#a07855]/10 to-[#8c6245]/5 dark:from-[#b8896a]/20 dark:to-[#a07855]/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-6 h-6 text-[#a07855] dark:text-[#b8896a]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px] mb-1">
                Contact Support
              </h2>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Need help? Our team is here to assist you.
              </p>
            </div>
          </div>

          {/* Email Contact */}
          <div className="flex items-center gap-3 p-4 bg-[#faf8f6] dark:bg-[#262b35] rounded-xl mb-6">
            <Mail className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
            <div>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                You can also email us directly at
              </p>
              <a 
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-[#a07855] dark:text-[#b8896a] font-albert font-semibold hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <ContactSupportForm />
        </div>
      </section>

      {/* Feature Requests Section */}
      <section className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 dark:from-amber-500/20 dark:to-orange-500/10 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px] mb-1">
                Feature Requests
              </h2>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                See what we&apos;re building and vote on community suggestions.
              </p>
            </div>
          </div>

          <FeatureVotingBoard />
        </div>
      </section>

      {/* Private Feedback Section */}
      <section className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 dark:from-violet-500/20 dark:to-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px] mb-1">
                  Give Private Feedback
                </h2>
                <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Share confidential feedback directly with our team. This won&apos;t be visible to other users.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFeedbackForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-albert font-medium rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              Open Feedback Form
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Private Feedback Modal */}
      <PrivateFeedbackForm 
        isOpen={showFeedbackForm} 
        onClose={() => setShowFeedbackForm(false)} 
      />
    </div>
  );
}





