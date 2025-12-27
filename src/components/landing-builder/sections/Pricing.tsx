'use client';

import { ComponentConfig } from '@measured/puck';
import { Check } from 'lucide-react';

export interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaUrl: string;
  highlighted: boolean;
  badge: string;
}

export interface PricingProps {
  heading: string;
  subheading: string;
  plans: PricingPlan[];
  layout: 'single' | 'comparison' | 'stacked';
  showToggle: boolean;
}

const defaultPlans: PricingPlan[] = [
  {
    name: 'Basic',
    price: '$29',
    period: '/month',
    description: 'Perfect for getting started',
    features: ['Daily check-ins', 'Goal tracking', 'Community access', 'Mobile app'],
    ctaText: 'Start Basic',
    ctaUrl: '#',
    highlighted: false,
    badge: '',
  },
  {
    name: 'Pro',
    price: '$79',
    period: '/month',
    description: 'For serious achievers',
    features: ['Everything in Basic', '1-on-1 coaching calls', 'Custom action plans', 'Priority support', 'Weekly reviews'],
    ctaText: 'Go Pro',
    ctaUrl: '#',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Elite',
    price: '$199',
    period: '/month',
    description: 'Maximum transformation',
    features: ['Everything in Pro', 'Unlimited coaching', 'VIP community', 'Exclusive events', 'Personal success manager'],
    ctaText: 'Join Elite',
    ctaUrl: '#',
    highlighted: false,
    badge: '',
  },
];

export const Pricing = ({
  heading = 'Simple, Transparent Pricing',
  subheading = 'Choose the plan that fits your goals',
  plans = defaultPlans,
  layout = 'comparison',
}: PricingProps) => {
  const renderPricingCard = (plan: PricingPlan, index: number) => (
    <div
      key={index}
      className={`relative rounded-2xl p-8 flex flex-col ${
        plan.highlighted
          ? 'bg-[#a07855] text-white shadow-xl scale-105 z-10'
          : 'bg-white border border-[#e1ddd8] shadow-sm'
      }`}
    >
      {/* Badge */}
      {plan.badge && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-xl text-sm font-medium ${
          plan.highlighted
            ? 'bg-white text-[#a07855]'
            : 'bg-[#a07855] text-white'
        }`}>
          {plan.badge}
        </div>
      )}

      {/* Plan Name & Description */}
      <div className="text-center mb-6">
        <h3 className={`text-xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-[#1a1a1a]'}`}>
          {plan.name}
        </h3>
        <p className={`text-sm ${plan.highlighted ? 'text-white/80' : 'text-[#5f5a55]'}`}>
          {plan.description}
        </p>
      </div>

      {/* Price */}
      <div className="text-center mb-6">
        <span className={`text-4xl md:text-5xl font-bold ${plan.highlighted ? 'text-white' : 'text-[#1a1a1a]'}`}>
          {plan.price}
        </span>
        <span className={`${plan.highlighted ? 'text-white/80' : 'text-[#5f5a55]'}`}>
          {plan.period}
        </span>
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8 flex-grow">
        {plan.features.map((feature, featureIndex) => (
          <li key={featureIndex} className="flex items-start gap-3">
            <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              plan.highlighted ? 'text-white' : 'text-[#a07855]'
            }`} />
            <span className={plan.highlighted ? 'text-white/90' : 'text-[#1a1a1a]'}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <a
        href={plan.ctaUrl}
        className={`w-full py-3 px-6 rounded-xl font-semibold text-center transition-colors ${
          plan.highlighted
            ? 'bg-white text-[#a07855] hover:bg-gray-100'
            : 'bg-[#a07855] text-white hover:bg-[#8c6245]'
        }`}
      >
        {plan.ctaText}
      </a>
    </div>
  );

  return (
    <section className="font-albert py-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-4">
            {heading}
          </h2>
          {subheading && (
            <p className="text-lg text-[#5f5a55] max-w-2xl mx-auto">
              {subheading}
            </p>
          )}
        </div>

        {/* Comparison Layout */}
        {layout === 'comparison' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {plans.map((plan, index) => renderPricingCard(plan, index))}
          </div>
        )}

        {/* Single Layout */}
        {layout === 'single' && plans[0] && (
          <div className="max-w-md mx-auto">
            {renderPricingCard(plans[0], 0)}
          </div>
        )}

        {/* Stacked Layout */}
        {layout === 'stacked' && (
          <div className="space-y-6 max-w-lg mx-auto">
            {plans.map((plan, index) => renderPricingCard(plan, index))}
          </div>
        )}
      </div>
    </section>
  );
};

export const PricingConfig: ComponentConfig<PricingProps> = {
  label: 'Pricing',
  fields: {
    heading: {
      type: 'text',
      label: 'Section Heading',
    },
    subheading: {
      type: 'textarea',
      label: 'Subheading',
    },
    plans: {
      type: 'array',
      label: 'Pricing Plans',
      arrayFields: {
        name: { type: 'text', label: 'Plan Name' },
        price: { type: 'text', label: 'Price' },
        period: { type: 'text', label: 'Period (e.g., /month)' },
        description: { type: 'text', label: 'Description' },
        features: {
          type: 'array',
          label: 'Features',
          arrayFields: {
            value: { type: 'text' },
          },
        },
        ctaText: { type: 'text', label: 'Button Text' },
        ctaUrl: { type: 'text', label: 'Button URL' },
        highlighted: {
          type: 'radio',
          label: 'Highlighted',
          options: [
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ],
        },
        badge: { type: 'text', label: 'Badge Text' },
      },
      defaultItemProps: {
        name: 'Plan Name',
        price: '$49',
        period: '/month',
        description: 'Plan description',
        features: ['Feature 1', 'Feature 2', 'Feature 3'],
        ctaText: 'Get Started',
        ctaUrl: '#',
        highlighted: false,
        badge: '',
      },
    },
    layout: {
      type: 'select',
      label: 'Layout',
      options: [
        { label: 'Comparison (Side by Side)', value: 'comparison' },
        { label: 'Single Plan', value: 'single' },
        { label: 'Stacked', value: 'stacked' },
      ],
    },
    showToggle: {
      type: 'radio',
      label: 'Show Monthly/Yearly Toggle',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
  },
  defaultProps: {
    heading: 'Simple, Transparent Pricing',
    subheading: 'Choose the plan that fits your goals',
    plans: defaultPlans,
    layout: 'comparison',
    showToggle: false,
  },
  render: Pricing,
};

