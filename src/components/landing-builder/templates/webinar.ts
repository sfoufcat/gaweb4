import type { LandingPageTemplate } from '@/types';

export const webinarTemplate: LandingPageTemplate = {
  id: 'webinar',
  name: 'Webinar Registration',
  description: 'Perfect for webinar sign-ups with countdown, host bio, and agenda.',
  thumbnail: '/templates/webinar.png',
  category: 'webinar',
  puckData: {
    content: [
      {
        type: 'Hero',
        props: {
          id: 'webinar-hero-1',
          headline: 'FREE Live Training: The 3-Step System to [Result]',
          subheadline: 'Join me for a 60-minute masterclass where I reveal the exact framework I use with my private clients.',
          ctaText: 'Reserve My Spot',
          ctaUrl: '#',
          backgroundImage: '',
          alignment: 'center',
          layout: 'simple',
          overlayOpacity: 0.5,
          minHeight: 'medium',
        },
      },
      {
        type: 'Countdown',
        props: {
          id: 'webinar-countdown-1',
          targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          heading: 'Webinar Starts In',
          expiredText: 'Registration is closed',
          style: 'boxed',
          showLabels: true,
          ctaText: 'Save My Seat',
          ctaUrl: '#',
        },
      },
      {
        type: 'Features',
        props: {
          id: 'webinar-features-1',
          heading: 'What You\'ll Learn',
          subheading: 'In this 60-minute session, I\'ll reveal:',
          items: [
            {
              title: 'The Core Framework',
              description: 'The exact 3-step system that generates consistent results for my clients.',
              icon: 'target',
            },
            {
              title: 'Common Mistakes',
              description: 'The 5 mistakes most people make (and how to avoid them).',
              icon: 'shield',
            },
            {
              title: 'Quick Wins',
              description: 'Actionable strategies you can implement immediately after the training.',
              icon: 'zap',
            },
            {
              title: 'Live Q&A',
              description: 'Get your questions answered in real-time during our live session.',
              icon: 'users',
            },
          ],
          columns: 2,
          layout: 'grid',
          showIcons: true,
          iconStyle: 'filled',
        },
      },
      {
        type: 'CoachBio',
        props: {
          id: 'webinar-coach-1',
          name: 'Your Name',
          title: 'Coach & Founder',
          bio: 'With over 10 years of experience, I\'ve helped hundreds of clients achieve breakthrough results. My unique approach combines proven strategies with personalized support to help you reach your goals faster than you ever thought possible.',
          imageUrl: '',
          credentials: [{ text: 'Certified Coach' }, { text: '500+ Clients' }, { text: '10+ Years Experience' }],
          layout: 'side_by_side',
          showCredentials: true,
          ctaText: '',
          ctaUrl: '',
        },
      },
      {
        type: 'Testimonials',
        props: {
          id: 'webinar-testimonials-1',
          heading: 'What Past Attendees Say',
          subheading: '',
          items: [
            {
              name: 'Rachel T.',
              role: 'Business Owner',
              content: 'This webinar was packed with value. I took more notes in 60 minutes than I have in months!',
              imageUrl: '',
              rating: 5,
            },
            {
              name: 'David M.',
              role: 'Consultant',
              content: 'Finally, someone who explains things clearly and gives actionable advice. Highly recommend!',
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
          id: 'webinar-cta-1',
          headline: 'Don\'t Miss This Free Training',
          subheadline: 'Limited spots available. Reserve yours now.',
          ctaText: 'Yes, Save My Spot!',
          ctaUrl: '#',
          urgencyText: 'Only 100 spots remaining',
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
