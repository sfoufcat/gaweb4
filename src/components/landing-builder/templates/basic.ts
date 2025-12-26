import type { LandingPageTemplate } from '@/types';

export const basicTemplate: LandingPageTemplate = {
  id: 'basic',
  name: 'Basic Landing Page',
  description: 'A clean, simple landing page with hero, features, testimonials, and CTA.',
  thumbnail: '/templates/basic.png',
  category: 'minimal',
  puckData: {
    content: [
      {
        type: 'Hero',
        props: {
          headline: 'Transform Your Life in 90 Days',
          subheadline: 'Join our proven program and achieve the results you\'ve always wanted.',
          ctaText: 'Get Started Today',
          ctaUrl: '#',
          backgroundImage: '',
          alignment: 'center',
          layout: 'simple',
          overlayOpacity: 0.5,
          minHeight: 'medium',
        },
      },
      {
        type: 'Features',
        props: {
          heading: 'What You\'ll Get',
          subheading: 'Everything you need to succeed',
          items: [
            {
              title: 'Daily Guidance',
              description: 'Personalized coaching and action steps every single day.',
              icon: 'target',
            },
            {
              title: 'Accountability',
              description: 'Stay on track with check-ins and progress tracking.',
              icon: 'check',
            },
            {
              title: 'Community',
              description: 'Connect with like-minded individuals on the same journey.',
              icon: 'users',
            },
          ],
          columns: 3,
          layout: 'grid',
          showIcons: true,
          iconStyle: 'filled',
        },
      },
      {
        type: 'Testimonials',
        props: {
          heading: 'What Our Members Say',
          subheading: '',
          items: [
            {
              name: 'Sarah M.',
              role: 'Entrepreneur',
              content: 'This program changed everything for me. I finally have clarity and direction.',
              imageUrl: '',
              rating: 5,
            },
            {
              name: 'James K.',
              role: 'Executive',
              content: 'The accountability and support are incredible. Worth every penny.',
              imageUrl: '',
              rating: 5,
            },
          ],
          layout: 'grid',
          showRatings: true,
          showImages: true,
          columns: 2,
        },
      },
      {
        type: 'CTABanner',
        props: {
          headline: 'Ready to Get Started?',
          subheadline: 'Join thousands who have already transformed their lives.',
          ctaText: 'Start Your Journey',
          ctaUrl: '#',
          urgencyText: '',
          style: 'gradient',
          alignment: 'center',
        },
      },
    ],
    root: {
      props: {
        backgroundColor: '',
      },
    },
  },
};
