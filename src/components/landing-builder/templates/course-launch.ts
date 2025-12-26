import type { LandingPageTemplate } from '@/types';

export const courseLaunchTemplate: LandingPageTemplate = {
  id: 'course-launch',
  name: 'Course Launch',
  description: 'Ideal for launching online courses with curriculum preview and pricing tiers.',
  thumbnail: '/templates/course-launch.png',
  category: 'course',
  puckData: {
    content: [
      {
        type: 'Hero',
        props: {
          headline: 'Master [Skill] in Just 8 Weeks',
          subheadline: 'The comprehensive online course that takes you from beginner to confident practitioner.',
          ctaText: 'Enroll Now',
          ctaUrl: '#',
          backgroundImage: '',
          alignment: 'center',
          layout: 'simple',
          overlayOpacity: 0.5,
          minHeight: 'medium',
        },
      },
      {
        type: 'Video',
        props: {
          mediaType: 'youtube',
          url: '',
          caption: 'Watch the course introduction',
          autoplay: false,
          layout: 'contained',
          aspectRatio: '16:9',
        },
      },
      {
        type: 'Stats',
        props: {
          heading: '',
          items: [
            { value: '8', label: 'Weeks of Content', prefix: '', suffix: '' },
            { value: '50', label: 'Video Lessons', prefix: '', suffix: '+' },
            { value: '1000', label: 'Students Enrolled', prefix: '', suffix: '+' },
            { value: '4.9', label: 'Star Rating', prefix: '', suffix: '' },
          ],
          layout: 'row',
          animated: true,
          style: 'minimal',
        },
      },
      {
        type: 'Features',
        props: {
          heading: 'Course Curriculum',
          subheading: 'A comprehensive 8-week journey',
          items: [
            {
              title: 'Week 1-2: Foundations',
              description: 'Build a solid foundation with core concepts and fundamentals.',
              icon: 'target',
            },
            {
              title: 'Week 3-4: Core Skills',
              description: 'Develop the essential skills you\'ll use every day.',
              icon: 'zap',
            },
            {
              title: 'Week 5-6: Advanced Techniques',
              description: 'Take your skills to the next level with advanced strategies.',
              icon: 'star',
            },
            {
              title: 'Week 7-8: Real-World Application',
              description: 'Apply everything you\'ve learned to real projects.',
              icon: 'check',
            },
          ],
          columns: 2,
          layout: 'grid',
          showIcons: true,
          iconStyle: 'filled',
        },
      },
      {
        type: 'RichText',
        props: {
          content: '<h3 style="text-align: center; margin-bottom: 1rem;">What\'s Included</h3><ul><li><strong>50+ HD Video Lessons</strong> - Learn at your own pace</li><li><strong>Downloadable Resources</strong> - Templates, checklists, and guides</li><li><strong>Private Community</strong> - Connect with fellow students</li><li><strong>Weekly Office Hours</strong> - Get your questions answered live</li><li><strong>Certificate of Completion</strong> - Show off your achievement</li><li><strong>Lifetime Access</strong> - Including all future updates</li></ul>',
          alignment: 'center',
          maxWidth: 'md',
        },
      },
      {
        type: 'CoachBio',
        props: {
          name: 'Your Instructor',
          title: 'Expert & Educator',
          bio: 'I\'ve spent over a decade mastering this craft and have taught thousands of students worldwide. My teaching style is practical, engaging, and results-focused. I can\'t wait to guide you on your journey.',
          imageUrl: '',
          credentials: ['Industry Expert', '10+ Years Experience', '5000+ Students'],
          layout: 'centered',
          showCredentials: true,
          ctaText: '',
          ctaUrl: '',
        },
      },
      {
        type: 'Testimonials',
        props: {
          heading: 'Student Success Stories',
          subheading: '',
          items: [
            {
              name: 'Alex P.',
              role: 'Designer',
              content: 'This course was exactly what I needed. The content is clear, practical, and immediately applicable.',
              imageUrl: '',
              rating: 5,
            },
            {
              name: 'Maria S.',
              role: 'Freelancer',
              content: 'Best investment I\'ve made in my career. The community alone is worth the price.',
              imageUrl: '',
              rating: 5,
            },
            {
              name: 'Chris L.',
              role: 'Entrepreneur',
              content: 'I went from complete beginner to landing my first client in just 6 weeks!',
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
          heading: 'Choose Your Plan',
          subheading: 'All plans include lifetime access',
          plans: [
            {
              name: 'Self-Study',
              price: '$297',
              period: 'one-time',
              description: 'Learn at your own pace',
              features: ['All 50+ video lessons', 'Downloadable resources', 'Private community access', 'Certificate of completion'],
              ctaText: 'Start Learning',
              ctaUrl: '#',
              highlighted: false,
              badge: '',
            },
            {
              name: 'Premium',
              price: '$497',
              period: 'one-time',
              description: 'Extra support & bonuses',
              features: ['Everything in Self-Study', 'Weekly office hours', '3 bonus workshops', 'Priority email support', '1-on-1 feedback session'],
              ctaText: 'Go Premium',
              ctaUrl: '#',
              highlighted: true,
              badge: 'Most Popular',
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
          description: 'Try the course risk-free. If you\'re not completely satisfied within the first 30 days, we\'ll give you a full refund. No questions asked.',
          badgeStyle: 'shield',
          style: 'card',
          daysGuarantee: 30,
        },
      },
      {
        type: 'FAQ',
        props: {
          heading: 'Common Questions',
          subheading: '',
          items: [
            {
              question: 'How long do I have access to the course?',
              answer: 'Forever! You get lifetime access, including any future updates to the course content.',
            },
            {
              question: 'What if I fall behind?',
              answer: 'No worries! The course is self-paced, so you can take as long as you need.',
            },
            {
              question: 'Is this course for beginners?',
              answer: 'Yes! We start from the fundamentals and build up. No prior experience required.',
            },
            {
              question: 'Can I get a refund?',
              answer: 'Absolutely. We offer a 30-day money-back guarantee, no questions asked.',
            },
          ],
          style: 'accordion',
          showNumbers: false,
        },
      },
      {
        type: 'CTABanner',
        props: {
          headline: 'Start Your Journey Today',
          subheadline: 'Join 1000+ students who have transformed their skills',
          ctaText: 'Enroll Now',
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

