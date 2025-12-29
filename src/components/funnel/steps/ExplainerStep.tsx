'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import type { FunnelStepConfigExplainer, ExplainerLayout } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, var(--brand-accent-light))';
const primaryHoverVar = 'var(--funnel-primary-hover, var(--brand-accent-dark))';

// URL parsing helpers
function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&?#]+)/,
    /youtube\.com\/shorts\/([^&?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function getVimeoVideoId(url: string): string | null {
  if (!url) return null;
  // Handle various Vimeo URL formats
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /vimeo\.com\/video\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function getLoomVideoId(url: string): string | null {
  if (!url) return null;
  // Handle Loom URL formats
  const patterns = [
    /loom\.com\/share\/([a-zA-Z0-9]+)/,
    /loom\.com\/embed\/([a-zA-Z0-9]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// Check if a string is an iframe code
function isIframeCode(code: string): boolean {
  return code.trim().startsWith('<iframe') || code.trim().startsWith('<embed');
}

// Extract iframe src URL from embed code
function extractIframeSrc(code: string): string | null {
  const match = code.match(/src=["']([^"']+)["']/);
  return match?.[1] || null;
}

interface MediaRendererProps {
  config: FunnelStepConfigExplainer;
}

function MediaRenderer({ config }: MediaRendererProps) {
  const mediaType = config.mediaType || 'image';
  
  // Common iframe wrapper for video embeds
  const VideoIframeWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/5">
      {children}
    </div>
  );

  switch (mediaType) {
    case 'image':
      if (!config.imageUrl) return null;
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl overflow-hidden"
        >
          <Image
            src={config.imageUrl}
            alt=""
            width={800}
            height={600}
            className="w-full h-auto object-cover"
            unoptimized={config.imageUrl.startsWith('http')}
          />
        </motion.div>
      );

    case 'video_upload':
      if (!config.videoUrl) return null;
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <VideoIframeWrapper>
            <video
              src={config.videoUrl}
              controls
              autoPlay={config.autoplay}
              muted={config.muted || config.autoplay} // Autoplay requires muted
              loop={config.loop}
              playsInline
              className="w-full h-full object-contain"
            />
          </VideoIframeWrapper>
        </motion.div>
      );

    case 'youtube': {
      const videoId = getYouTubeVideoId(config.youtubeUrl || '');
      if (!videoId) return null;
      const params = new URLSearchParams({
        rel: '0',
        modestbranding: '1',
        ...(config.autoplay && { autoplay: '1' }),
        ...(config.muted && { mute: '1' }),
        ...(config.loop && { loop: '1', playlist: videoId }),
      });
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <VideoIframeWrapper>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </VideoIframeWrapper>
        </motion.div>
      );
    }

    case 'vimeo': {
      const videoId = getVimeoVideoId(config.vimeoUrl || '');
      if (!videoId) return null;
      const params = new URLSearchParams({
        dnt: '1',
        ...(config.autoplay && { autoplay: '1' }),
        ...(config.muted && { muted: '1' }),
        ...(config.loop && { loop: '1' }),
      });
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <VideoIframeWrapper>
            <iframe
              src={`https://player.vimeo.com/video/${videoId}?${params.toString()}`}
              title="Vimeo video"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </VideoIframeWrapper>
        </motion.div>
      );
    }

    case 'loom': {
      const videoId = getLoomVideoId(config.loomUrl || '');
      if (!videoId) return null;
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <VideoIframeWrapper>
            <iframe
              src={`https://www.loom.com/embed/${videoId}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`}
              title="Loom video"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </VideoIframeWrapper>
        </motion.div>
      );
    }

    case 'iframe': {
      const iframeCode = config.iframeCode || '';
      if (!iframeCode) return null;
      
      // If it's a full iframe code, extract the src
      // If it's just a URL, use it directly
      let iframeSrc: string | null = null;
      if (isIframeCode(iframeCode)) {
        iframeSrc = extractIframeSrc(iframeCode);
      } else {
        // Assume it's a URL
        iframeSrc = iframeCode.trim();
      }
      
      if (!iframeSrc) return null;
      
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <VideoIframeWrapper>
            <iframe
              src={iframeSrc}
              title="Embedded content"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </VideoIframeWrapper>
        </motion.div>
      );
    }

    default:
      return null;
  }
}

interface ExplainerStepProps {
  config: FunnelStepConfigExplainer;
  onComplete: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  isFirstStep: boolean;
}

export function ExplainerStep({
  config,
  onComplete,
  onBack,
  isFirstStep,
}: ExplainerStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const layout: ExplainerLayout = config.layout || 'media_top';
  const isFullscreen = layout === 'fullscreen';
  const isSideBySide = layout === 'side_by_side';

  // Check if we have media to show
  const hasMedia = useMemo(() => {
    const mediaType = config.mediaType || 'image';
    switch (mediaType) {
      case 'image': return !!config.imageUrl;
      case 'video_upload': return !!config.videoUrl;
      case 'youtube': return !!config.youtubeUrl;
      case 'vimeo': return !!config.vimeoUrl;
      case 'loom': return !!config.loomUrl;
      case 'iframe': return !!config.iframeCode;
      default: return false;
    }
  }, [config]);

  const handleContinue = async () => {
    setIsSubmitting(true);
    await onComplete({});
    setIsSubmitting(false);
  };

  // Layout-specific classes
  const containerClasses = useMemo(() => {
    if (isSideBySide) {
      return 'w-full max-w-4xl mx-auto relative flex flex-col lg:flex-row lg:items-center lg:gap-8';
    }
    return 'w-full max-w-xl mx-auto relative';
  }, [isSideBySide]);

  const renderMediaSection = () => {
    if (!hasMedia) return null;
    
    return (
      <div className={isSideBySide ? 'lg:flex-1 mb-6 lg:mb-0' : 'mb-8'}>
        <MediaRenderer config={config} />
      </div>
    );
  };

  const renderTextSection = () => {
    if (isFullscreen) {
      // Fullscreen only shows CTA, no text
      return null;
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-center ${isSideBySide ? 'lg:flex-1 lg:text-left' : 'mb-8'}`}
      >
        {config.heading && (
          <h1 className="font-albert text-[28px] sm:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4">
            {config.heading}
          </h1>
        )}
        {config.body && (
          <p className="text-text-secondary text-lg leading-relaxed whitespace-pre-line">
            {config.body}
          </p>
        )}
      </motion.div>
    );
  };

  const renderCTA = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className={isSideBySide ? 'w-full lg:w-auto' : ''}
    >
      <button
        onClick={handleContinue}
        disabled={isSubmitting}
        className={`py-3 px-6 text-white rounded-xl font-medium disabled:opacity-50 transition-colors ${
          isSideBySide ? 'w-full lg:w-auto lg:min-w-[200px]' : 'w-full'
        }`}
        style={{ backgroundColor: primaryVar }}
        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = primaryHoverVar)}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
      >
        {isSubmitting ? 'Loading...' : config.ctaText || 'Continue'}
      </button>
    </motion.div>
  );

  // Render based on layout
  if (isFullscreen) {
    return (
      <div className={containerClasses}>
        {/* Back button */}
        {!isFirstStep && onBack && (
          <button
            onClick={onBack}
            className="absolute -top-2 left-0 p-2 rounded-full hover:bg-[#f5f3f0] transition-colors z-10"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
        )}

        <div className="flex flex-col items-center gap-6 w-full">
          {renderMediaSection()}
          {renderCTA()}
        </div>
      </div>
    );
  }

  if (isSideBySide) {
    return (
      <div className={containerClasses}>
        {/* Back button */}
        {!isFirstStep && onBack && (
          <button
            onClick={onBack}
            className="absolute -top-2 left-0 p-2 rounded-full hover:bg-[#f5f3f0] transition-colors z-10"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
        )}

        {renderMediaSection()}
        
        <div className="flex flex-col lg:flex-1">
          {renderTextSection()}
          {renderCTA()}
        </div>
      </div>
    );
  }

  // Default layouts: media_top or media_bottom
  const isMediaBottom = layout === 'media_bottom';

  return (
    <div className={containerClasses}>
      {/* Back button */}
      {!isFirstStep && onBack && (
        <button
          onClick={onBack}
          className="absolute -top-2 left-0 p-2 rounded-full hover:bg-[#f5f3f0] transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
      )}

      {isMediaBottom ? (
        <>
          {renderTextSection()}
          {renderMediaSection()}
          {renderCTA()}
        </>
      ) : (
        <>
          {renderMediaSection()}
          {renderTextSection()}
          {renderCTA()}
        </>
      )}
    </div>
  );
}

