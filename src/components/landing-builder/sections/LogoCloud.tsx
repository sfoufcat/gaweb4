'use client';

import { ComponentConfig } from '@measured/puck';

export interface LogoItem {
  name: string;
  imageUrl: string;
}

export interface LogoCloudProps {
  title: string;
  logos: LogoItem[];
  layout: 'row' | 'grid';
  style: 'color' | 'grayscale' | 'opacity';
}

const defaultLogos: LogoItem[] = [
  { name: 'Company 1', imageUrl: '' },
  { name: 'Company 2', imageUrl: '' },
  { name: 'Company 3', imageUrl: '' },
  { name: 'Company 4', imageUrl: '' },
  { name: 'Company 5', imageUrl: '' },
];

export const LogoCloud = ({
  title = 'Trusted By',
  logos = defaultLogos,
  layout = 'row',
  style = 'grayscale',
}: LogoCloudProps) => {
  const styleClasses = {
    color: '',
    grayscale: 'grayscale hover:grayscale-0 transition-all',
    opacity: 'opacity-50 hover:opacity-100 transition-opacity',
  };

  const layoutClasses = layout === 'row' 
    ? 'flex flex-wrap justify-center items-center gap-8 md:gap-12' 
    : 'grid grid-cols-3 md:grid-cols-5 gap-8 items-center justify-items-center';

  return (
    <section className="py-12 px-6">
      <div className="max-w-5xl mx-auto">
        {title && (
          <p className="text-center text-sm text-muted-foreground uppercase tracking-wide mb-8">
            {title}
          </p>
        )}
        
        <div className={layoutClasses}>
          {logos.map((logo, index) => (
            <div
              key={index}
              className={`h-8 md:h-10 ${styleClasses[style]}`}
            >
              {logo.imageUrl ? (
                <img
                  src={logo.imageUrl}
                  alt={logo.name}
                  className="h-full w-auto object-contain"
                />
              ) : (
                <div className="h-full px-4 bg-muted rounded flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">{logo.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const LogoCloudConfig: ComponentConfig<LogoCloudProps> = {
  label: 'Logo Cloud',
  fields: {
    title: {
      type: 'text',
      label: 'Title (e.g., "Trusted By", "As Seen In")',
    },
    logos: {
      type: 'array',
      label: 'Logos',
      arrayFields: {
        name: { type: 'text', label: 'Company Name' },
        imageUrl: { type: 'text', label: 'Logo URL' },
      },
      defaultItemProps: {
        name: 'Company Name',
        imageUrl: '',
      },
    },
    layout: {
      type: 'select',
      label: 'Layout',
      options: [
        { label: 'Row', value: 'row' },
        { label: 'Grid', value: 'grid' },
      ],
    },
    style: {
      type: 'select',
      label: 'Style',
      options: [
        { label: 'Full Color', value: 'color' },
        { label: 'Grayscale (hover for color)', value: 'grayscale' },
        { label: 'Faded (hover for full)', value: 'opacity' },
      ],
    },
  },
  defaultProps: {
    title: 'Trusted By',
    logos: defaultLogos,
    layout: 'row',
    style: 'grayscale',
  },
  render: LogoCloud,
};

