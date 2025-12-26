'use client';

import { ComponentConfig } from '@measured/puck';
import { useEffect, useState, useRef } from 'react';

export interface StatItem {
  value: string;
  label: string;
  prefix: string;
  suffix: string;
}

export interface StatsProps {
  heading: string;
  items: StatItem[];
  layout: 'row' | 'grid';
  animated: boolean;
  style: 'minimal' | 'boxed' | 'divided';
}

const defaultStats: StatItem[] = [
  { value: '500', label: 'Happy Clients', prefix: '', suffix: '+' },
  { value: '98', label: 'Success Rate', prefix: '', suffix: '%' },
  { value: '10', label: 'Years Experience', prefix: '', suffix: '+' },
  { value: '24', label: 'Support Available', prefix: '', suffix: '/7' },
];

function AnimatedNumber({ value, prefix, suffix }: { value: string; prefix: string; suffix: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const numericValue = parseInt(value.replace(/\D/g, ''), 10) || 0;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 1500;
    const steps = 30;
    const increment = numericValue / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setDisplayValue(numericValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isVisible, numericValue]);

  return (
    <span ref={ref}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

export const Stats = ({
  heading = '',
  items = defaultStats,
  layout = 'row',
  animated = true,
  style = 'minimal',
}: StatsProps) => {
  const styleClasses = {
    minimal: {
      container: '',
      item: 'text-center',
      value: 'text-4xl md:text-5xl font-bold text-[#1a1a1a]',
      label: 'text-[#5f5a55] mt-2',
    },
    boxed: {
      container: '',
      item: 'bg-white border border-[#e1ddd8] rounded-2xl p-6 text-center shadow-sm',
      value: 'text-3xl md:text-4xl font-bold text-[#a07855]',
      label: 'text-[#5f5a55] mt-2 text-sm',
    },
    divided: {
      container: 'divide-x divide-[#e1ddd8]',
      item: 'text-center px-8',
      value: 'text-4xl md:text-5xl font-bold text-[#1a1a1a]',
      label: 'text-[#5f5a55] mt-2',
    },
  };

  const classes = styleClasses[style];
  const layoutClasses = layout === 'row' ? 'flex flex-wrap justify-center gap-8 md:gap-12' : 'grid grid-cols-2 md:grid-cols-4 gap-6';

  return (
    <section className="font-albert py-16 px-6">
      <div className="max-w-5xl mx-auto">
        {heading && (
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] text-center mb-12">
            {heading}
          </h2>
        )}
        
        <div className={`${layoutClasses} ${classes.container}`}>
          {items.map((item, index) => (
            <div key={index} className={classes.item}>
              <div className={classes.value}>
                {animated ? (
                  <AnimatedNumber value={item.value} prefix={item.prefix} suffix={item.suffix} />
                ) : (
                  `${item.prefix}${item.value}${item.suffix}`
                )}
              </div>
              <p className={classes.label}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const StatsConfig: ComponentConfig<StatsProps> = {
  label: 'Stats',
  fields: {
    heading: {
      type: 'text',
      label: 'Section Heading (optional)',
    },
    items: {
      type: 'array',
      label: 'Statistics',
      arrayFields: {
        value: { type: 'text', label: 'Value (number)' },
        label: { type: 'text', label: 'Label' },
        prefix: { type: 'text', label: 'Prefix (e.g., $)' },
        suffix: { type: 'text', label: 'Suffix (e.g., +, %)' },
      },
      defaultItemProps: {
        value: '100',
        label: 'Statistic Label',
        prefix: '',
        suffix: '+',
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
    animated: {
      type: 'radio',
      label: 'Animate Numbers',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    style: {
      type: 'select',
      label: 'Style',
      options: [
        { label: 'Minimal', value: 'minimal' },
        { label: 'Boxed', value: 'boxed' },
        { label: 'Divided', value: 'divided' },
      ],
    },
  },
  defaultProps: {
    heading: '',
    items: defaultStats,
    layout: 'row',
    animated: true,
    style: 'minimal',
  },
  render: Stats,
};

