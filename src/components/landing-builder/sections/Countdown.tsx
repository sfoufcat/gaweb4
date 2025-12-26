'use client';

import { ComponentConfig } from '@measured/puck';
import { useState, useEffect } from 'react';

export interface CountdownProps {
  targetDate: string;
  heading: string;
  expiredText: string;
  style: 'minimal' | 'boxed' | 'urgent';
  showLabels: boolean;
  ctaText: string;
  ctaUrl: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(targetDate: string): TimeLeft | null {
  const difference = new Date(targetDate).getTime() - new Date().getTime();
  
  if (difference <= 0) {
    return null;
  }
  
  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

export const Countdown = ({
  targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  heading = 'Limited Time Offer Ends In',
  expiredText = 'This offer has expired',
  style = 'boxed',
  showLabels = true,
  ctaText = 'Claim Your Spot',
  ctaUrl = '#',
}: CountdownProps) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);
    
    setTimeLeft(calculateTimeLeft(targetDate));
    
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!mounted) {
    return (
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </section>
    );
  }

  if (!timeLeft) {
    return (
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lg text-muted-foreground">{expiredText}</p>
        </div>
      </section>
    );
  }

  const styleClasses = {
    minimal: {
      container: 'bg-transparent',
      box: 'text-center',
      number: 'text-4xl md:text-5xl font-bold text-foreground',
      label: 'text-sm text-muted-foreground uppercase tracking-wide',
    },
    boxed: {
      container: 'bg-card border border-border rounded-2xl p-8',
      box: 'bg-background rounded-xl p-4 text-center min-w-[80px]',
      number: 'text-3xl md:text-4xl font-bold text-foreground',
      label: 'text-xs text-muted-foreground uppercase tracking-wide mt-1',
    },
    urgent: {
      container: 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-8',
      box: 'bg-white dark:bg-red-950 rounded-xl p-4 text-center min-w-[80px] shadow-sm',
      number: 'text-3xl md:text-4xl font-bold text-red-600 dark:text-red-400',
      label: 'text-xs text-red-500 uppercase tracking-wide mt-1',
    },
  };

  const classes = styleClasses[style];

  return (
    <section className="py-12 px-6">
      <div className={`max-w-4xl mx-auto ${classes.container}`}>
        {heading && (
          <h2 className={`text-2xl md:text-3xl font-bold text-center mb-8 ${
            style === 'urgent' ? 'text-red-600 dark:text-red-400' : 'text-foreground'
          }`}>
            {heading}
          </h2>
        )}
        
        <div className="flex justify-center gap-4 md:gap-6">
          {[
            { value: timeLeft.days, label: 'Days' },
            { value: timeLeft.hours, label: 'Hours' },
            { value: timeLeft.minutes, label: 'Minutes' },
            { value: timeLeft.seconds, label: 'Seconds' },
          ].map((unit) => (
            <div key={unit.label} className={classes.box}>
              <div className={classes.number}>
                {String(unit.value).padStart(2, '0')}
              </div>
              {showLabels && (
                <div className={classes.label}>{unit.label}</div>
              )}
            </div>
          ))}
        </div>

        {ctaText && (
          <div className="text-center mt-8">
            <a
              href={ctaUrl}
              className={`inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg transition-colors ${
                style === 'urgent'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#a07855] hover:bg-[#8c6245] text-white'
              }`}
            >
              {ctaText}
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export const CountdownConfig: ComponentConfig<CountdownProps> = {
  label: 'Countdown Timer',
  fields: {
    targetDate: {
      type: 'text',
      label: 'Target Date (YYYY-MM-DD)',
    },
    heading: {
      type: 'text',
      label: 'Heading',
    },
    expiredText: {
      type: 'text',
      label: 'Expired Message',
    },
    style: {
      type: 'select',
      label: 'Style',
      options: [
        { label: 'Minimal', value: 'minimal' },
        { label: 'Boxed', value: 'boxed' },
        { label: 'Urgent (Red)', value: 'urgent' },
      ],
    },
    showLabels: {
      type: 'radio',
      label: 'Show Labels',
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
    targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    heading: 'Limited Time Offer Ends In',
    expiredText: 'This offer has expired',
    style: 'boxed',
    showLabels: true,
    ctaText: 'Claim Your Spot',
    ctaUrl: '#',
  },
  render: Countdown,
};

