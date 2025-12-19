'use client';

interface ShareButtonProps {
  title?: string;
  url?: string;
  className?: string;
}

export function ShareButton({ title, url, className = '' }: ShareButtonProps) {
  const handleShare = async () => {
    const shareUrl = url || window.location.href;
    const shareTitle = title || document.title;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled or failed:', err);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        // Could show a toast here
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-earth-100 transition-colors ${className}`}
      aria-label="Share"
    >
      <svg 
        className="w-5 h-5 text-text-primary" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    </button>
  );
}

