'use client';

import { ComponentConfig } from '@measured/puck';

export interface CoachBioProps {
  name: string;
  title: string;
  bio: string;
  imageUrl: string;
  credentials: string[];
  layout: 'side_by_side' | 'centered' | 'card';
  showCredentials: boolean;
  ctaText: string;
  ctaUrl: string;
}

export const CoachBio = ({
  name = 'Coach Name',
  title = 'Certified Life Coach',
  bio = 'With over 10 years of experience helping clients achieve their goals, I\'ve developed a proven system that delivers real results. My approach combines practical strategies with compassionate support.',
  imageUrl = '',
  credentials = ['Certified Life Coach', '10+ Years Experience', '500+ Clients Helped'],
  layout = 'side_by_side',
  showCredentials = true,
  ctaText = 'Book a Call',
  ctaUrl = '#',
}: CoachBioProps) => {
  const renderImage = (size: 'small' | 'large' = 'large') => (
    <div className={`${size === 'large' ? 'w-64 h-64 md:w-80 md:h-80' : 'w-32 h-32'} rounded-2xl bg-muted overflow-hidden flex-shrink-0`}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-4xl text-muted-foreground">
          {name.charAt(0)}
        </div>
      )}
    </div>
  );

  const renderCredentials = () => (
    <div className="flex flex-wrap gap-2 mt-4">
      {credentials.map((credential, index) => (
        <span
          key={index}
          className="px-3 py-1 bg-[#a07855]/10 text-[#a07855] rounded-full text-sm font-medium"
        >
          {credential}
        </span>
      ))}
    </div>
  );

  // Side by Side Layout
  if (layout === 'side_by_side') {
    return (
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
            {renderImage('large')}
            
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {name}
              </h2>
              <p className="text-lg text-[#a07855] font-medium mb-4">{title}</p>
              <p className="text-muted-foreground leading-relaxed mb-6">{bio}</p>
              
              {showCredentials && credentials.length > 0 && renderCredentials()}
              
              {ctaText && (
                <a
                  href={ctaUrl}
                  className="inline-flex items-center justify-center px-6 py-3 mt-6 text-white bg-[#a07855] hover:bg-[#8c6245] rounded-lg font-medium transition-colors"
                >
                  {ctaText}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Centered Layout
  if (layout === 'centered') {
    return (
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            {renderImage('large')}
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            {name}
          </h2>
          <p className="text-lg text-[#a07855] font-medium mb-4">{title}</p>
          <p className="text-muted-foreground leading-relaxed mb-6">{bio}</p>
          
          {showCredentials && credentials.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {credentials.map((credential, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-[#a07855]/10 text-[#a07855] rounded-full text-sm font-medium"
                >
                  {credential}
                </span>
              ))}
            </div>
          )}
          
          {ctaText && (
            <a
              href={ctaUrl}
              className="inline-flex items-center justify-center px-6 py-3 mt-6 text-white bg-[#a07855] hover:bg-[#8c6245] rounded-lg font-medium transition-colors"
            >
              {ctaText}
            </a>
          )}
        </div>
      </section>
    );
  }

  // Card Layout
  return (
    <section className="py-16 px-6">
      <div className="max-w-lg mx-auto">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="flex justify-center mb-6">
            {renderImage('small')}
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-1">
            {name}
          </h2>
          <p className="text-[#a07855] font-medium mb-4">{title}</p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">{bio}</p>
          
          {showCredentials && credentials.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {credentials.map((credential, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 bg-[#a07855]/10 text-[#a07855] rounded-full text-xs font-medium"
                >
                  {credential}
                </span>
              ))}
            </div>
          )}
          
          {ctaText && (
            <a
              href={ctaUrl}
              className="inline-flex items-center justify-center px-6 py-3 mt-6 text-white bg-[#a07855] hover:bg-[#8c6245] rounded-lg font-medium transition-colors w-full"
            >
              {ctaText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

export const CoachBioConfig: ComponentConfig<CoachBioProps> = {
  label: 'Coach Bio',
  fields: {
    name: {
      type: 'text',
      label: 'Name',
    },
    title: {
      type: 'text',
      label: 'Title/Role',
    },
    bio: {
      type: 'textarea',
      label: 'Bio',
    },
    imageUrl: {
      type: 'text',
      label: 'Photo URL',
    },
    credentials: {
      type: 'array',
      label: 'Credentials',
      arrayFields: {
        value: { type: 'text' },
      },
      defaultItemProps: 'Credential',
    },
    layout: {
      type: 'select',
      label: 'Layout',
      options: [
        { label: 'Side by Side', value: 'side_by_side' },
        { label: 'Centered', value: 'centered' },
        { label: 'Card', value: 'card' },
      ],
    },
    showCredentials: {
      type: 'radio',
      label: 'Show Credentials',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    ctaText: {
      type: 'text',
      label: 'Button Text',
    },
    ctaUrl: {
      type: 'text',
      label: 'Button URL',
    },
  },
  defaultProps: {
    name: 'Coach Name',
    title: 'Certified Life Coach',
    bio: 'With over 10 years of experience helping clients achieve their goals, I\'ve developed a proven system that delivers real results. My approach combines practical strategies with compassionate support.',
    imageUrl: '',
    credentials: ['Certified Life Coach', '10+ Years Experience', '500+ Clients Helped'],
    layout: 'side_by_side',
    showCredentials: true,
    ctaText: 'Book a Call',
    ctaUrl: '#',
  },
  render: CoachBio,
};

