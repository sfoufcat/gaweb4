'use client';

import { ComponentConfig } from '@measured/puck';

export interface CTABannerProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaUrl: string;
  urgencyText: string;
  style: 'simple' | 'gradient' | 'bordered' | 'dark';
  alignment: 'left' | 'center';
}

export const CTABanner = ({
  headline = 'Ready to Transform Your Life?',
  subheadline = 'Join thousands of successful members today',
  ctaText = 'Get Started Now',
  ctaUrl = '#',
  urgencyText = '',
  style = 'gradient',
  alignment = 'center',
}: CTABannerProps) => {
  const styleClasses = {
    simple: {
      container: 'bg-card border border-border',
      headline: 'text-foreground',
      subheadline: 'text-muted-foreground',
      button: 'bg-brand-accent hover:bg-brand-accent/90 text-white',
      urgency: 'text-brand-accent',
    },
    gradient: {
      container: 'bg-gradient-to-r from-brand-accent to-[#8c6245]',
      headline: 'text-white',
      subheadline: 'text-white/90',
      button: 'bg-white hover:bg-gray-100 text-brand-accent',
      urgency: 'text-white/90',
    },
    bordered: {
      container: 'bg-transparent border-2 border-brand-accent',
      headline: 'text-foreground',
      subheadline: 'text-muted-foreground',
      button: 'bg-brand-accent hover:bg-brand-accent/90 text-white',
      urgency: 'text-brand-accent',
    },
    dark: {
      container: 'bg-gray-900',
      headline: 'text-white',
      subheadline: 'text-gray-300',
      button: 'bg-brand-accent hover:bg-brand-accent/90 text-white',
      urgency: 'text-brand-accent',
    },
  };

  const classes = styleClasses[style];
  const alignmentClass = alignment === 'center' ? 'text-center items-center' : 'text-left items-start';

  return (
    <section className="font-albert py-8 px-6">
      <div className="max-w-4xl mx-auto">
        <div className={`${classes.container} rounded-2xl p-8 md:p-12 flex flex-col gap-4 ${alignmentClass}`}>
          <h2 className={`text-2xl md:text-3xl font-bold ${classes.headline}`}>
            {headline}
          </h2>
          
          {subheadline && (
            <p className={`text-lg ${classes.subheadline}`}>
              {subheadline}
            </p>
          )}
          
          <div className={`flex flex-col sm:flex-row gap-4 mt-2 ${alignment === 'center' ? 'items-center' : 'items-start'}`}>
            <a
              href={ctaUrl}
              className={`${classes.button} px-8 py-4 rounded-xl font-semibold text-lg transition-colors shadow-sm`}
            >
              {ctaText}
            </a>
            
            {urgencyText && (
              <span className={`${classes.urgency} text-sm font-medium`}>
                {urgencyText}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export const CTABannerConfig: ComponentConfig<CTABannerProps> = {
  label: 'CTA Banner',
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
    urgencyText: {
      type: 'text',
      label: 'Urgency Text (optional)',
    },
    style: {
      type: 'select',
      label: 'Style',
      options: [
        { label: 'Simple', value: 'simple' },
        { label: 'Gradient', value: 'gradient' },
        { label: 'Bordered', value: 'bordered' },
        { label: 'Dark', value: 'dark' },
      ],
    },
    alignment: {
      type: 'select',
      label: 'Alignment',
      options: [
        { label: 'Center', value: 'center' },
        { label: 'Left', value: 'left' },
      ],
    },
  },
  defaultProps: {
    headline: 'Ready to Transform Your Life?',
    subheadline: 'Join thousands of successful members today',
    ctaText: 'Get Started Now',
    ctaUrl: '#',
    urgencyText: '',
    style: 'gradient',
    alignment: 'center',
  },
  render: CTABanner,
};

