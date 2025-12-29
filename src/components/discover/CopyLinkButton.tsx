'use client';

import { useState } from 'react';
import { Link2, Check } from 'lucide-react';

interface CopyLinkButtonProps {
  url?: string;
  className?: string;
}

export function CopyLinkButton({ url, className = '' }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = async () => {
    const copyUrl = url || window.location.href;

    try {
      await navigator.clipboard.writeText(copyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div 
      className={`relative ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={handleCopy}
        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${
          copied
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
            : 'bg-earth-50 dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8] hover:bg-earth-100 dark:hover:bg-[#262b35]'
        }`}
        aria-label={copied ? 'Copied!' : 'Copy link'}
      >
        {copied ? (
          <Check className="w-4 h-4" />
        ) : (
          <Link2 className="w-4 h-4" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#2c2520] text-xs font-medium rounded-md whitespace-nowrap z-50 animate-in fade-in duration-150">
          {copied ? 'Copied!' : 'Copy link'}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2c2520] dark:border-t-[#f5f5f8]" />
        </div>
      )}
    </div>
  );
}





