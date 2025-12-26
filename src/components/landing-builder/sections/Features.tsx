'use client';

import { ComponentConfig } from '@measured/puck';
import { Check, Star, Zap, Target, Heart, Shield, Clock, Users } from 'lucide-react';

export interface FeatureItem {
  title: string;
  description: string;
  icon: string;
}

export interface FeaturesProps {
  heading: string;
  subheading: string;
  items: FeatureItem[];
  columns: 2 | 3 | 4;
  layout: 'grid' | 'list' | 'alternating';
  showIcons: boolean;
  iconStyle: 'filled' | 'outlined' | 'minimal';
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  check: Check,
  star: Star,
  zap: Zap,
  target: Target,
  heart: Heart,
  shield: Shield,
  clock: Clock,
  users: Users,
};

const defaultFeatures: FeatureItem[] = [
  {
    title: 'Personalized Coaching',
    description: 'Get tailored guidance based on your unique goals and circumstances.',
    icon: 'target',
  },
  {
    title: 'Daily Accountability',
    description: 'Stay on track with daily check-ins and progress tracking.',
    icon: 'check',
  },
  {
    title: 'Supportive Community',
    description: 'Connect with like-minded individuals on the same journey.',
    icon: 'users',
  },
  {
    title: 'Proven Framework',
    description: 'Follow a science-backed system that delivers real results.',
    icon: 'star',
  },
];

export const Features = ({
  heading = 'Why Choose Us',
  subheading = 'Everything you need to achieve your goals',
  items = defaultFeatures,
  columns = 3,
  layout = 'grid',
  showIcons = true,
  iconStyle = 'filled',
}: FeaturesProps) => {
  const columnClasses = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  };

  const iconStyleClasses = {
    filled: 'bg-[#a07855] text-white p-3 rounded-xl',
    outlined: 'border-2 border-[#a07855] text-[#a07855] p-3 rounded-xl',
    minimal: 'text-[#a07855]',
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || Check;
    return (
      <div className={iconStyleClasses[iconStyle]}>
        <IconComponent className="w-6 h-6" />
      </div>
    );
  };

  const renderFeatureCard = (item: FeatureItem, index: number) => (
    <div key={index} className="flex flex-col gap-4">
      {showIcons && renderIcon(item.icon)}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
        <p className="text-muted-foreground">{item.description}</p>
      </div>
    </div>
  );

  const renderListFeature = (item: FeatureItem, index: number) => (
    <div key={index} className="flex gap-4 items-start">
      {showIcons && renderIcon(item.icon)}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{item.title}</h3>
        <p className="text-muted-foreground">{item.description}</p>
      </div>
    </div>
  );

  const renderAlternatingFeature = (item: FeatureItem, index: number) => (
    <div
      key={index}
      className={`flex flex-col md:flex-row gap-6 items-center ${
        index % 2 === 1 ? 'md:flex-row-reverse' : ''
      }`}
    >
      {showIcons && (
        <div className="flex-shrink-0">
          <div className={`${iconStyleClasses[iconStyle]} scale-150`}>
            {(() => {
              const IconComponent = iconMap[item.icon] || Check;
              return <IconComponent className="w-8 h-8" />;
            })()}
          </div>
        </div>
      )}
      <div className={index % 2 === 1 ? 'md:text-right' : ''}>
        <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
        <p className="text-muted-foreground">{item.description}</p>
      </div>
    </div>
  );

  return (
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {heading}
          </h2>
          {subheading && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {subheading}
            </p>
          )}
        </div>

        {/* Grid Layout */}
        {layout === 'grid' && (
          <div className={`grid gap-8 ${columnClasses[columns]}`}>
            {items.map((item, index) => renderFeatureCard(item, index))}
          </div>
        )}

        {/* List Layout */}
        {layout === 'list' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            {items.map((item, index) => renderListFeature(item, index))}
          </div>
        )}

        {/* Alternating Layout */}
        {layout === 'alternating' && (
          <div className="space-y-12 max-w-3xl mx-auto">
            {items.map((item, index) => renderAlternatingFeature(item, index))}
          </div>
        )}
      </div>
    </section>
  );
};

export const FeaturesConfig: ComponentConfig<FeaturesProps> = {
  label: 'Features',
  fields: {
    heading: {
      type: 'text',
      label: 'Section Heading',
    },
    subheading: {
      type: 'textarea',
      label: 'Subheading',
    },
    items: {
      type: 'array',
      label: 'Features',
      arrayFields: {
        title: { type: 'text', label: 'Title' },
        description: { type: 'textarea', label: 'Description' },
        icon: {
          type: 'select',
          label: 'Icon',
          options: [
            { label: 'Checkmark', value: 'check' },
            { label: 'Star', value: 'star' },
            { label: 'Lightning', value: 'zap' },
            { label: 'Target', value: 'target' },
            { label: 'Heart', value: 'heart' },
            { label: 'Shield', value: 'shield' },
            { label: 'Clock', value: 'clock' },
            { label: 'Users', value: 'users' },
          ],
        },
      },
      defaultItemProps: {
        title: 'Feature Title',
        description: 'Feature description goes here',
        icon: 'check',
      },
    },
    columns: {
      type: 'select',
      label: 'Columns',
      options: [
        { label: '2 Columns', value: 2 },
        { label: '3 Columns', value: 3 },
        { label: '4 Columns', value: 4 },
      ],
    },
    layout: {
      type: 'select',
      label: 'Layout',
      options: [
        { label: 'Grid', value: 'grid' },
        { label: 'List', value: 'list' },
        { label: 'Alternating', value: 'alternating' },
      ],
    },
    showIcons: {
      type: 'radio',
      label: 'Show Icons',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    iconStyle: {
      type: 'select',
      label: 'Icon Style',
      options: [
        { label: 'Filled', value: 'filled' },
        { label: 'Outlined', value: 'outlined' },
        { label: 'Minimal', value: 'minimal' },
      ],
    },
  },
  defaultProps: {
    heading: 'Why Choose Us',
    subheading: 'Everything you need to achieve your goals',
    items: defaultFeatures,
    columns: 3,
    layout: 'grid',
    showIcons: true,
    iconStyle: 'filled',
  },
  render: Features,
};

