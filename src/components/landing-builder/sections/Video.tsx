'use client';

import { ComponentConfig } from '@measured/puck';

export interface VideoProps {
  mediaType: 'youtube' | 'vimeo' | 'loom' | 'custom';
  url: string;
  caption: string;
  autoplay: boolean;
  layout: 'full' | 'contained' | 'floating';
  aspectRatio: '16:9' | '4:3' | '1:1' | '9:16';
}

function getEmbedUrl(mediaType: string, url: string, autoplay: boolean): string {
  if (!url) return '';
  
  try {
    if (mediaType === 'youtube') {
      // Extract video ID from various YouTube URL formats
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
      ];
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return `https://www.youtube.com/embed/${match[1]}${autoplay ? '?autoplay=1&mute=1' : ''}`;
        }
      }
    }
    
    if (mediaType === 'vimeo') {
      const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (match) {
        return `https://player.vimeo.com/video/${match[1]}${autoplay ? '?autoplay=1&muted=1' : ''}`;
      }
    }
    
    if (mediaType === 'loom') {
      const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
      if (match) {
        return `https://www.loom.com/embed/${match[1]}${autoplay ? '?autoplay=1' : ''}`;
      }
    }
    
    return url;
  } catch {
    return url;
  }
}

export const Video = ({
  mediaType = 'youtube',
  url = '',
  caption = '',
  autoplay = false,
  layout = 'contained',
  aspectRatio = '16:9',
}: VideoProps) => {
  const embedUrl = getEmbedUrl(mediaType, url, autoplay);
  
  const aspectClasses = {
    '16:9': 'aspect-video',
    '4:3': 'aspect-[4/3]',
    '1:1': 'aspect-square',
    '9:16': 'aspect-[9/16]',
  };

  const layoutClasses = {
    full: 'w-full',
    contained: 'max-w-4xl mx-auto',
    floating: 'max-w-2xl mx-auto rounded-2xl shadow-2xl overflow-hidden',
  };

  if (!url) {
    return (
      <section className="font-albert py-12 px-6">
        <div className={`${layoutClasses[layout]}`}>
          <div className={`${aspectClasses[aspectRatio]} bg-[#f5f3f0] rounded-2xl flex items-center justify-center`}>
            <p className="text-[#5f5a55]">Add a video URL to display</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="font-albert py-12 px-6">
      <div className={`${layoutClasses[layout]}`}>
        <div className={`${aspectClasses[aspectRatio]} rounded-2xl overflow-hidden bg-black shadow-lg`}>
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        
        {caption && (
          <p className="text-center text-sm text-[#5f5a55] mt-4">
            {caption}
          </p>
        )}
      </div>
    </section>
  );
};

export const VideoConfig: ComponentConfig<VideoProps> = {
  label: 'Video Section',
  fields: {
    mediaType: {
      type: 'select',
      label: 'Video Source',
      options: [
        { label: 'YouTube', value: 'youtube' },
        { label: 'Vimeo', value: 'vimeo' },
        { label: 'Loom', value: 'loom' },
        { label: 'Custom Embed', value: 'custom' },
      ],
    },
    url: {
      type: 'text',
      label: 'Video URL',
    },
    caption: {
      type: 'text',
      label: 'Caption (optional)',
    },
    autoplay: {
      type: 'radio',
      label: 'Autoplay (muted)',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    layout: {
      type: 'select',
      label: 'Layout',
      options: [
        { label: 'Full Width', value: 'full' },
        { label: 'Contained', value: 'contained' },
        { label: 'Floating Card', value: 'floating' },
      ],
    },
    aspectRatio: {
      type: 'select',
      label: 'Aspect Ratio',
      options: [
        { label: '16:9 (Widescreen)', value: '16:9' },
        { label: '4:3 (Standard)', value: '4:3' },
        { label: '1:1 (Square)', value: '1:1' },
        { label: '9:16 (Vertical)', value: '9:16' },
      ],
    },
  },
  defaultProps: {
    mediaType: 'youtube',
    url: '',
    caption: '',
    autoplay: false,
    layout: 'contained',
    aspectRatio: '16:9',
  },
  render: Video,
};

