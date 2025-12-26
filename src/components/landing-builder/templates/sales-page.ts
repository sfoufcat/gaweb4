import type { LandingPageTemplate } from '@/types';

export const salesPageTemplate: LandingPageTemplate = {
  id: 'sales-page',
  name: 'High-Converting Sales Page',
  description: 'Optimized for conversions with social proof, urgency, and trust elements.',
  thumbnail: '/templates/sales-page.png',
  category: 'sales',
  puckData: {
    content: [
      {
        type: 'Hero',
        props: {
          headline: 'Finally Achieve Your Biggest Goals (Without the Overwhelm)',
          subheadline: 'The proven 90-day system that\'s helped 500+ people transform their lives—and it can work for you too.',
          ctaText: 'Yes, I Want This!',
          ctaUrl: '#',
          backgroundImage: '',
          alignment: 'center',
          layout: 'simple',
          overlayOpacity: 0.5,
          minHeight: 'large',
        },
      },
      {
        type: 'LogoCloud',
        props: {
          title: 'As Featured In',
          logos: [
            { name: 'Forbes', imageUrl: '' },
            { name: 'Inc.', imageUrl: '' },
            { name: 'Entrepreneur', imageUrl: '' },
            { name: 'Fast Company', imageUrl: '' },
          ],
          layout: 'row',
          style: 'grayscale',
        },
      },
      {
        type: 'Video',
        props: {
          mediaType: 'youtube',
          url: '',
          caption: 'Watch: How This System Works',
          autoplay: false,
          layout: 'contained',
          aspectRatio: '16:9',
        },
      },
      {
        type: 'Stats',
        props: {
          heading: 'The Results Speak for Themselves',
          items: [
            { value: '500', label: 'Lives Changed', prefix: '', suffix: '+' },
            { value: '98', label: 'Success Rate', prefix: '', suffix: '%' },
            { value: '4.9', label: 'Average Rating', prefix: '', suffix: '/5' },
          ],
          layout: 'row',
          animated: true,
          style: 'boxed',
        },
      },
      {
        type: 'Features',
        props: {
          heading: 'Here\'s What You\'ll Get',
          subheading: 'Everything you need for your transformation',
          items: [
            {
              title: 'Personalized Action Plan',
              description: 'A customized roadmap designed specifically for your goals and lifestyle.',
              icon: 'target',
            },
            {
              title: 'Daily Coaching',
              description: 'Expert guidance and support every step of the way.',
              icon: 'star',
            },
            {
              title: '24/7 Community Access',
              description: 'Connect with like-minded achievers anytime, anywhere.',
              icon: 'users',
            },
            {
              title: 'Weekly Live Sessions',
              description: 'Group coaching calls to answer your questions and keep you on track.',
              icon: 'zap',
            },
          ],
          columns: 2,
          layout: 'grid',
          showIcons: true,
          iconStyle: 'filled',
        },
      },
      {
        type: 'Testimonials',
        props: {
          heading: 'Success Stories',
          subheading: 'Real people, real results',
          items: [
            {
              name: 'Jennifer L.',
              role: 'Business Owner',
              content: 'I was skeptical at first, but within 30 days I achieved more than I had in the past year. This system just works.',
              imageUrl: '',
              rating: 5,
            },
            {
              name: 'Michael R.',
              role: 'Executive',
              content: 'The accountability and structure were exactly what I needed. I\'ve recommended this to everyone I know.',
              imageUrl: '',
              rating: 5,
            },
            {
              name: 'Amanda S.',
              role: 'Entrepreneur',
              content: 'Life-changing! I finally have clarity, focus, and the results to prove it.',
              imageUrl: '',
              rating: 5,
            },
          ],
          layout: 'grid',
          showRatings: true,
          showImages: true,
          columns: 3,
        },
      },
      {
        type: 'Countdown',
        props: {
          targetDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          heading: 'Special Launch Pricing Ends In',
          expiredText: 'This offer has expired',
          style: 'urgent',
          showLabels: true,
          ctaText: 'Lock In Your Spot Now',
          ctaUrl: '#',
        },
      },
      {
        type: 'Pricing',
        props: {
          heading: 'Choose Your Path',
          subheading: 'Investment in yourself that pays dividends forever',
          plans: [
            {
              name: 'Self-Paced',
              price: '$197',
              period: 'one-time',
              description: 'Perfect for self-starters',
              features: ['Full program access', 'Community membership', 'Mobile app', 'Email support'],
              ctaText: 'Get Started',
              ctaUrl: '#',
              highlighted: false,
              badge: '',
            },
            {
              name: 'Coached',
              price: '$497',
              period: 'one-time',
              description: 'Our most popular option',
              features: ['Everything in Self-Paced', 'Weekly group coaching', '1-on-1 kickoff call', 'Priority support', 'Bonus resources'],
              ctaText: 'Join Coached',
              ctaUrl: '#',
              highlighted: true,
              badge: 'Best Value',
            },
            {
              name: 'VIP',
              price: '$997',
              period: 'one-time',
              description: 'Maximum transformation',
              features: ['Everything in Coached', 'Monthly 1-on-1 calls', 'Personal success manager', 'VIP community', 'Lifetime updates'],
              ctaText: 'Go VIP',
              ctaUrl: '#',
              highlighted: false,
              badge: '',
            },
          ],
          layout: 'comparison',
          showToggle: false,
        },
      },
      {
        type: 'Guarantee',
        props: {
          title: '30-Day Money-Back Guarantee',
          description: 'We\'re so confident in our program that we offer a full 30-day money-back guarantee. If you\'re not completely satisfied, simply reach out and we\'ll refund every penny. No questions asked.',
          badgeStyle: 'shield',
          style: 'card',
          daysGuarantee: 30,
        },
      },
      {
        type: 'FAQ',
        props: {
          heading: 'Frequently Asked Questions',
          subheading: '',
          items: [
            {
              question: 'How long do I have access to the program?',
              answer: 'You get lifetime access! Once you join, you can go through the material at your own pace, forever.',
            },
            {
              question: 'What if I\'m too busy?',
              answer: 'The program is designed for busy people. Each daily action takes just 15-30 minutes, and you can always adjust your pace.',
            },
            {
              question: 'Is there a guarantee?',
              answer: 'Yes! We offer a full 30-day money-back guarantee. If you\'re not satisfied, we\'ll refund you completely.',
            },
            {
              question: 'How is this different from other programs?',
              answer: 'Our approach combines proven frameworks with daily accountability and a supportive community. It\'s not just information—it\'s transformation.',
            },
          ],
          style: 'accordion',
          showNumbers: false,
        },
      },
      {
        type: 'CTABanner',
        props: {
          headline: 'Your Transformation Starts Today',
          subheadline: 'Join 500+ members who are already living their best lives',
          ctaText: 'Start My Transformation',
          ctaUrl: '#',
          urgencyText: 'Limited spots available',
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

