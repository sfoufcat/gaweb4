'use client';

import { ComponentConfig } from '@measured/puck';

export interface HeroProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  backgroundImage: string;
  alignment: 'left' | 'center' | 'right';
  layout: 'simple' | 'with_image' | 'split';
  overlayOpacity: number;
  minHeight: 'small' | 'medium' | 'large' | 'full';
}

export const Hero = ({
  headline = 'Transform Your Life Today',
  subheadline = 'Join thousands who have already started their journey',
  ctaText = 'Get Started',
  ctaUrl = '#',
  backgroundImage = '',
  alignment = 'center',
  layout = 'simple',
  overlayOpacity = 0.5,
  minHeight = 'medium',
}: HeroProps) => {
  const alignmentClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  };

  const heightClasses = {
    small: 'min-h-[40vh]',
    medium: 'min-h-[60vh]',
    large: 'min-h-[80vh]',
    full: 'min-h-screen',
  };

  return (
    <section
      className={`font-albert relative flex flex-col justify-center px-6 py-16 ${heightClasses[minHeight]} ${alignmentClasses[alignment]}`}
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-black rounded-2xl"
          style={{ opacity: overlayOpacity }}
        />
      )}

      {/* Content */}
      <div className={`relative z-10 max-w-4xl mx-auto flex flex-col gap-6 ${alignmentClasses[alignment]}`}>
        <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight ${backgroundImage ? 'text-white' : 'text-[#1a1a1a]'}`}>
          {headline}
        </h1>
        
        {subheadline && (
          <p className={`text-lg md:text-xl max-w-2xl ${backgroundImage ? 'text-white/90' : 'text-[#5f5a55]'}`}>
            {subheadline}
          </p>
        )}

        {ctaText && (
          <a
            href={ctaUrl}
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] rounded-xl transition-colors mt-4 shadow-sm"
          >
            {ctaText}
          </a>
        )}
      </div>
    </section>
  );
};

export const HeroConfig: ComponentConfig<HeroProps> = {
  label: 'Hero Section',
  fields: {
    headline: {
      type: 'text',
      label: 'Headline',
    },
    subheadline: {
      type: 'textarea',
      label: 'Subheadline',
    },
    ctaText: {
      type: 'text',
      label: 'Button Text',
    },
    ctaUrl: {
      type: 'text',
      label: 'Button URL',
    },
    backgroundImage: {
      type: 'text',
      label: 'Background Image URL',
    },
    alignment: {
      type: 'select',
      label: 'Text Alignment',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    layout: {
      type: 'select',
      label: 'Layout',
      options: [
        { label: 'Simple', value: 'simple' },
        { label: 'With Image', value: 'with_image' },
        { label: 'Split', value: 'split' },
      ],
    },
    overlayOpacity: {
      type: 'number',
      label: 'Overlay Opacity (0-1)',
      min: 0,
      max: 1,
    },
    minHeight: {
      type: 'select',
      label: 'Minimum Height',
      options: [
        { label: 'Small (40vh)', value: 'small' },
        { label: 'Medium (60vh)', value: 'medium' },
        { label: 'Large (80vh)', value: 'large' },
        { label: 'Full Screen', value: 'full' },
      ],
    },
  },
  defaultProps: {
    headline: 'Transform Your Life Today',
    subheadline: 'Join thousands who have already started their journey',
    ctaText: 'Get Started',
    ctaUrl: '#',
    backgroundImage: '',
    alignment: 'center',
    layout: 'simple',
    overlayOpacity: 0.5,
    minHeight: 'medium',
  },
  render: Hero,
};

