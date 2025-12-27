import type { LandingPageTemplate } from '@/types';

export const coachingTemplate: LandingPageTemplate = {
  id: 'coaching',
  name: 'Coaching Program',
  description: 'Designed for personal coaching or group programs with trust-building elements.',
  thumbnail: '/templates/coaching.png',
  category: 'coaching',
  puckData: {
    content: [
      {
        type: 'Hero',
        props: {
          id: 'coaching-hero-1',
          headline: 'Achieve Your Biggest Goals with Expert Guidance',
          subheadline: 'A personalized coaching program designed to help you break through barriers and create lasting transformation.',
          ctaText: 'Apply Now',
          ctaUrl: '#',
          backgroundImage: '',
          alignment: 'center',
          layout: 'simple',
          overlayOpacity: 0.5,
          minHeight: 'large',
        },
      },
      {
        type: 'RichText',
        props: {
          id: 'coaching-richtext-1',
          content: '<p style="text-align: center; font-size: 1.25rem; max-width: 800px; margin: 0 auto;"><strong>You know you\'re capable of more.</strong></p><p style="text-align: center; max-width: 800px; margin: 1rem auto;">You\'ve tried the courses, read the books, and implemented the strategies. But something is still missing. What you need isn\'t more information—it\'s personalized guidance and accountability from someone who\'s been where you want to go.</p>',
          alignment: 'center',
          maxWidth: 'md',
        },
      },
      {
        type: 'CoachBio',
        props: {
          id: 'coaching-coach-1',
          name: 'Meet Your Coach',
          title: 'Certified Transformation Coach',
          bio: 'After experiencing my own transformation journey, I became passionate about helping others achieve the same breakthroughs. Over the past 10 years, I\'ve guided hundreds of clients through major life and career transitions. My approach is compassionate yet results-driven, meeting you exactly where you are while challenging you to reach your full potential.',
          imageUrl: '',
          credentials: [{ text: 'ICF Certified Coach' }, { text: '500+ Clients' }, { text: 'Forbes Featured' }, { text: 'Bestselling Author' }],
          layout: 'side_by_side',
          showCredentials: true,
          ctaText: 'Book a Discovery Call',
          ctaUrl: '#',
        },
      },
      {
        type: 'Features',
        props: {
          id: 'coaching-features-1',
          heading: 'The Transformation Framework',
          subheading: 'A proven system for lasting change',
          items: [
            {
              title: 'Clarity',
              description: 'Get crystal clear on what you really want and why it matters.',
              icon: 'target',
            },
            {
              title: 'Strategy',
              description: 'Develop a personalized roadmap tailored to your unique situation.',
              icon: 'zap',
            },
            {
              title: 'Accountability',
              description: 'Stay on track with regular check-ins and support.',
              icon: 'check',
            },
            {
              title: 'Breakthrough',
              description: 'Overcome limiting beliefs and take bold action toward your goals.',
              icon: 'star',
            },
          ],
          columns: 4,
          layout: 'grid',
          showIcons: true,
          iconStyle: 'filled',
        },
      },
      {
        type: 'RichText',
        props: {
          id: 'coaching-richtext-2',
          content: '<h3 style="text-align: center; margin-bottom: 1rem;">What\'s Included in the Program</h3><ul><li><strong>90-Day Intensive Coaching</strong> - Deep-dive sessions focused on your specific goals</li><li><strong>Weekly 1-on-1 Calls</strong> - 60-minute sessions with me personally</li><li><strong>Unlimited Voice Support</strong> - Reach me anytime between sessions</li><li><strong>Custom Action Plans</strong> - Tailored strategies for your unique situation</li><li><strong>Resource Library</strong> - Frameworks, templates, and exercises</li><li><strong>VIP Community Access</strong> - Connect with other high-achievers</li></ul>',
          alignment: 'center',
          maxWidth: 'md',
        },
      },
      {
        type: 'Testimonials',
        props: {
          id: 'coaching-testimonials-1',
          heading: 'Client Transformations',
          subheading: 'Real stories from real people',
          items: [
            {
              name: 'Sarah J.',
              role: 'CEO',
              content: 'Working with [Coach] was the best investment I\'ve ever made in myself. Within 90 days, I had complete clarity on my next chapter and the confidence to pursue it.',
              imageUrl: '',
              rating: 5,
            },
            {
              name: 'Mark T.',
              role: 'Entrepreneur',
              content: 'I was stuck for years before finding this program. The combination of strategy and mindset work was exactly what I needed to break through.',
              imageUrl: '',
              rating: 5,
            },
            {
              name: 'Lisa M.',
              role: 'Executive',
              content: 'The accountability and support were incredible. I achieved more in 90 days than I had in the previous 2 years.',
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
        type: 'Pricing',
        props: {
          id: 'coaching-pricing-1',
          heading: 'Investment',
          subheading: 'Choose the level of support that\'s right for you',
          plans: [
            {
              name: 'Essential',
              price: '$2,997',
              period: '3 months',
              description: 'For focused transformation',
              features: ['Bi-weekly 1-on-1 calls (6 total)', 'Email support', 'Custom action plans', 'Resource library access'],
              ctaText: 'Apply for Essential',
              ctaUrl: '#',
              highlighted: false,
              badge: '',
            },
            {
              name: 'Premium',
              price: '$4,997',
              period: '3 months',
              description: 'Maximum support & results',
              features: ['Weekly 1-on-1 calls (12 total)', 'Unlimited voice messaging', 'Custom action plans', 'VIP community access', 'Bonus workshop library', 'Emergency support calls'],
              ctaText: 'Apply for Premium',
              ctaUrl: '#',
              highlighted: true,
              badge: 'Recommended',
            },
          ],
          layout: 'comparison',
          showToggle: false,
        },
      },
      {
        type: 'FAQ',
        props: {
          id: 'coaching-faq-1',
          heading: 'Common Questions',
          subheading: '',
          items: [
            {
              question: 'How do I know if coaching is right for me?',
              answer: 'Coaching is ideal if you\'re committed to growth, ready to take action, and want personalized guidance. We can discuss your specific situation on a discovery call.',
            },
            {
              question: 'What results can I expect?',
              answer: 'Results vary based on commitment and implementation, but most clients experience significant clarity, confidence, and progress toward their goals within the first month.',
            },
            {
              question: 'How do the coaching calls work?',
              answer: 'We meet via video call at a scheduled time that works for both of us. Sessions are recorded so you can review them later.',
            },
            {
              question: 'What if I need to reschedule?',
              answer: 'Life happens! You can reschedule calls with 24-hour notice. I\'m flexible and want this to work for you.',
            },
          ],
          style: 'accordion',
          showNumbers: false,
        },
      },
      {
        type: 'CTABanner',
        props: {
          id: 'coaching-cta-1',
          headline: 'Ready to Transform Your Life?',
          subheadline: 'Limited spots available each month',
          ctaText: 'Book Your Discovery Call',
          ctaUrl: '#',
          urgencyText: 'Only 3 spots remaining for this month',
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
