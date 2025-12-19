'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';

/**
 * Guided Monthly Page
 * 
 * Embeds the Tally form for joining a guided/premium squad.
 * Form collects user info and preferences for premium squad matching.
 */

export default function GuidedMonthlyPage() {
  useEffect(() => {
    // Load Tally embeds when component mounts
    const loadTally = () => {
      if (typeof (window as typeof window & { Tally?: { loadEmbeds: () => void } }).Tally !== 'undefined') {
        (window as typeof window & { Tally: { loadEmbeds: () => void } }).Tally.loadEmbeds();
      } else {
        document.querySelectorAll('iframe[data-tally-src]:not([src])').forEach((iframe) => {
          const tallyIframe = iframe as HTMLIFrameElement;
          tallyIframe.src = tallyIframe.dataset.tallySrc || '';
        });
      }
    };

    loadTally();
  }, []);

  return (
    <div className="fixed inset-0 bg-[#faf8f6]">
      {/* Tally Script */}
      <Script 
        src="https://tally.so/widgets/embed.js" 
        strategy="lazyOnload"
      />

      {/* Back Button - Fixed Position */}
      <div className="fixed top-4 left-4 z-10">
        <Link 
          href="/upgrade-premium"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#e1ddd8] text-text-secondary hover:text-text-primary hover:border-[#d1ccc5] transition-all shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      </div>

      {/* Tally Form Embed - Fullscreen */}
      <iframe
        data-tally-src="https://tally.so/r/D4qpVZ?transparentBackground=1"
        width="100%"
        height="100%"
        frameBorder={0}
        marginHeight={0}
        marginWidth={0}
        title="Join a guided squad"
        className="absolute inset-0"
        style={{ border: 0 }}
      />
    </div>
  );
}

