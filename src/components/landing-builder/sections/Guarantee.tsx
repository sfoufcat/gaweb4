'use client';

import { ComponentConfig } from '@measured/puck';
import { Shield, CheckCircle, RefreshCw } from 'lucide-react';

export interface GuaranteeProps {
  title: string;
  description: string;
  badgeStyle: 'shield' | 'checkmark' | 'refresh' | 'none';
  style: 'simple' | 'card' | 'bordered';
  daysGuarantee: number;
}

export const Guarantee = ({
  title = '30-Day Money-Back Guarantee',
  description = 'We\'re confident you\'ll love our program. If you\'re not completely satisfied within the first 30 days, simply reach out and we\'ll refund your investment in full. No questions asked.',
  badgeStyle = 'shield',
  style = 'card',
  daysGuarantee = 30,
}: GuaranteeProps) => {
  const iconMap = {
    shield: Shield,
    checkmark: CheckCircle,
    refresh: RefreshCw,
    none: null,
  };

  const IconComponent = iconMap[badgeStyle];

  const styleClasses = {
    simple: {
      container: '',
      inner: 'text-center',
    },
    card: {
      container: 'bg-card border border-border rounded-2xl p-8',
      inner: 'text-center',
    },
    bordered: {
      container: 'border-2 border-brand-accent rounded-2xl p-8',
      inner: 'text-center',
    },
  };

  const classes = styleClasses[style];

  return (
    <section className="py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <div className={classes.container}>
          <div className={classes.inner}>
            {/* Badge/Icon */}
            {IconComponent && (
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-brand-accent/10 flex items-center justify-center">
                  <IconComponent className="w-10 h-10 text-brand-accent" />
                </div>
              </div>
            )}

            {/* Days Badge */}
            {daysGuarantee > 0 && (
              <div className="flex justify-center mb-4">
                <span className="px-4 py-1 bg-brand-accent text-white rounded-full text-sm font-medium">
                  {daysGuarantee} Days
                </span>
              </div>
            )}

            {/* Title */}
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              {title}
            </h2>

            {/* Description */}
            <p className="text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export const GuaranteeConfig: ComponentConfig<GuaranteeProps> = {
  label: 'Guarantee',
  fields: {
    title: {
      type: 'text',
      label: 'Title',
    },
    description: {
      type: 'textarea',
      label: 'Description',
    },
    daysGuarantee: {
      type: 'number',
      label: 'Guarantee Days',
      min: 0,
    },
    badgeStyle: {
      type: 'select',
      label: 'Badge Icon',
      options: [
        { label: 'Shield', value: 'shield' },
        { label: 'Checkmark', value: 'checkmark' },
        { label: 'Refresh', value: 'refresh' },
        { label: 'None', value: 'none' },
      ],
    },
    style: {
      type: 'select',
      label: 'Style',
      options: [
        { label: 'Simple', value: 'simple' },
        { label: 'Card', value: 'card' },
        { label: 'Bordered', value: 'bordered' },
      ],
    },
  },
  defaultProps: {
    title: '30-Day Money-Back Guarantee',
    description: 'We\'re confident you\'ll love our program. If you\'re not completely satisfied within the first 30 days, simply reach out and we\'ll refund your investment in full. No questions asked.',
    badgeStyle: 'shield',
    style: 'card',
    daysGuarantee: 30,
  },
  render: Guarantee,
};

