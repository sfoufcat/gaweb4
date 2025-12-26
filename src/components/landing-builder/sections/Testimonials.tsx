'use client';

import { ComponentConfig } from '@measured/puck';
import { Star } from 'lucide-react';

export interface TestimonialItem {
  name: string;
  role: string;
  content: string;
  imageUrl: string;
  rating: number;
}

export interface TestimonialsProps {
  heading: string;
  subheading: string;
  items: TestimonialItem[];
  layout: 'grid' | 'carousel' | 'single' | 'stacked';
  showRatings: boolean;
  showImages: boolean;
  columns: 2 | 3;
}

const defaultTestimonials: TestimonialItem[] = [
  {
    name: 'Sarah Johnson',
    role: 'Entrepreneur',
    content: 'This program completely transformed how I approach my goals. The structured approach and accountability made all the difference.',
    imageUrl: '',
    rating: 5,
  },
  {
    name: 'Michael Chen',
    role: 'Business Owner',
    content: 'I was skeptical at first, but within 30 days I saw real results. The coaching support is incredible.',
    imageUrl: '',
    rating: 5,
  },
  {
    name: 'Emily Rodriguez',
    role: 'Marketing Director',
    content: 'Finally a program that delivers on its promises. The community aspect keeps me motivated every single day.',
    imageUrl: '',
    rating: 5,
  },
];

export const Testimonials = ({
  heading = 'What Our Members Say',
  subheading = 'Join thousands of satisfied members who have transformed their lives',
  items = defaultTestimonials,
  layout = 'grid',
  showRatings = true,
  showImages = true,
  columns = 3,
}: TestimonialsProps) => {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );

  const renderTestimonialCard = (item: TestimonialItem, index: number) => (
    <div
      key={index}
      className="bg-white border border-[#e1ddd8] rounded-2xl p-6 flex flex-col gap-4 shadow-sm"
    >
      {showRatings && renderStars(item.rating)}
      
      <p className="text-[#1a1a1a] leading-relaxed">&ldquo;{item.content}&rdquo;</p>
      
      <div className="flex items-center gap-3 mt-auto pt-4">
        {showImages && (
          <div className="w-10 h-10 rounded-full bg-[#f5f3f0] flex items-center justify-center overflow-hidden">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-medium text-[#5f5a55]">
                {item.name.charAt(0)}
              </span>
            )}
          </div>
        )}
        <div>
          <p className="font-medium text-[#1a1a1a]">{item.name}</p>
          <p className="text-sm text-[#5f5a55]">{item.role}</p>
        </div>
      </div>
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

        {/* Testimonials Grid */}
        {layout === 'grid' && (
          <div className={`grid gap-6 ${gridCols[columns]}`}>
            {items.map((item, index) => renderTestimonialCard(item, index))}
          </div>
        )}

        {/* Single Featured */}
        {layout === 'single' && items[0] && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-[#e1ddd8] rounded-2xl p-8 text-center shadow-sm">
              {showRatings && (
                <div className="flex justify-center mb-4">
                  {renderStars(items[0].rating)}
                </div>
              )}
              <p className="text-xl text-[#1a1a1a] leading-relaxed mb-6">
                &ldquo;{items[0].content}&rdquo;
              </p>
              <div className="flex items-center justify-center gap-3">
                {showImages && (
                  <div className="w-12 h-12 rounded-full bg-[#f5f3f0] flex items-center justify-center overflow-hidden">
                    {items[0].imageUrl ? (
                      <img src={items[0].imageUrl} alt={items[0].name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-medium text-[#5f5a55]">
                        {items[0].name.charAt(0)}
                      </span>
                    )}
                  </div>
                )}
                <div className="text-left">
                  <p className="font-medium text-[#1a1a1a]">{items[0].name}</p>
                  <p className="text-sm text-[#5f5a55]">{items[0].role}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stacked */}
        {layout === 'stacked' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            {items.map((item, index) => renderTestimonialCard(item, index))}
          </div>
        )}
      </div>
    </section>
  );
};

export const TestimonialsConfig: ComponentConfig<TestimonialsProps> = {
  label: 'Testimonials',
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
      label: 'Testimonials',
      arrayFields: {
        name: { type: 'text', label: 'Name' },
        role: { type: 'text', label: 'Role/Title' },
        content: { type: 'textarea', label: 'Testimonial' },
        imageUrl: { type: 'text', label: 'Photo URL' },
        rating: { 
          type: 'number', 
          label: 'Rating (1-5)',
          min: 1,
          max: 5,
        },
      },
      defaultItemProps: {
        name: 'Customer Name',
        role: 'Role',
        content: 'This is an amazing testimonial...',
        imageUrl: '',
        rating: 5,
      },
    },
    layout: {
      type: 'select',
      label: 'Layout',
      options: [
        { label: 'Grid', value: 'grid' },
        { label: 'Single Featured', value: 'single' },
        { label: 'Stacked', value: 'stacked' },
      ],
    },
    showRatings: {
      type: 'radio',
      label: 'Show Star Ratings',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showImages: {
      type: 'radio',
      label: 'Show Profile Images',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    columns: {
      type: 'select',
      label: 'Columns (Grid only)',
      options: [
        { label: '2 Columns', value: 2 },
        { label: '3 Columns', value: 3 },
      ],
    },
  },
  defaultProps: {
    heading: 'What Our Members Say',
    subheading: 'Join thousands of satisfied members who have transformed their lives',
    items: defaultTestimonials,
    layout: 'grid',
    showRatings: true,
    showImages: true,
    columns: 3,
  },
  render: Testimonials,
};

