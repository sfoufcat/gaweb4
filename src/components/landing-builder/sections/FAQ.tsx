'use client';

import { ComponentConfig } from '@measured/puck';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQProps {
  heading: string;
  subheading: string;
  items: FAQItem[];
  style: 'accordion' | 'grid' | 'simple';
  showNumbers: boolean;
}

const defaultFAQs: FAQItem[] = [
  {
    question: 'How long does the program take?',
    answer: 'Our program is designed to fit your schedule. Most members see significant results within 90 days, but you can go at your own pace.',
  },
  {
    question: 'Is there a money-back guarantee?',
    answer: 'Yes! We offer a 30-day money-back guarantee. If you\'re not satisfied, simply reach out to our support team for a full refund.',
  },
  {
    question: 'Do I need any prior experience?',
    answer: 'No prior experience is needed. Our program is designed for beginners and experienced individuals alike. We meet you where you are.',
  },
  {
    question: 'How do I access the coaching?',
    answer: 'Once enrolled, you\'ll get immediate access to our platform where you can schedule coaching calls, access resources, and connect with the community.',
  },
];

export const FAQ = ({
  heading = 'Frequently Asked Questions',
  subheading = 'Everything you need to know about the program',
  items = defaultFAQs,
  style = 'accordion',
  showNumbers = false,
}: FAQProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const AccordionItem = ({ item, index }: { item: FAQItem; index: number }) => {
    const isOpen = openIndex === index;

    return (
      <div className="border-b border-border">
        <button
          onClick={() => setOpenIndex(isOpen ? null : index)}
          className="w-full py-5 flex items-center justify-between text-left gap-4"
        >
          <span className="font-medium text-foreground flex items-center gap-3">
            {showNumbers && (
              <span className="text-sm text-muted-foreground w-6">{String(index + 1).padStart(2, '0')}</span>
            )}
            {item.question}
          </span>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isOpen ? 'max-h-96 pb-5' : 'max-h-0'
          }`}
        >
          <p className="text-muted-foreground leading-relaxed pl-0">
            {showNumbers && <span className="w-6 inline-block" />}
            {item.answer}
          </p>
        </div>
      </div>
    );
  };

  const GridItem = ({ item, index }: { item: FAQItem; index: number }) => (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="font-medium text-foreground mb-3 flex items-start gap-3">
        {showNumbers && (
          <span className="text-sm text-[#a07855] font-bold">{String(index + 1).padStart(2, '0')}</span>
        )}
        {item.question}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {item.answer}
      </p>
    </div>
  );

  const SimpleItem = ({ item, index }: { item: FAQItem; index: number }) => (
    <div className="py-6 border-b border-border last:border-0">
      <h3 className="font-medium text-foreground mb-2 flex items-start gap-3">
        {showNumbers && (
          <span className="text-[#a07855] font-bold">{index + 1}.</span>
        )}
        {item.question}
      </h3>
      <p className="text-muted-foreground leading-relaxed">
        {item.answer}
      </p>
    </div>
  );

  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {heading}
          </h2>
          {subheading && (
            <p className="text-lg text-muted-foreground">
              {subheading}
            </p>
          )}
        </div>

        {/* Accordion Style */}
        {style === 'accordion' && (
          <div className="divide-y-0">
            {items.map((item, index) => (
              <AccordionItem key={index} item={item} index={index} />
            ))}
          </div>
        )}

        {/* Grid Style */}
        {style === 'grid' && (
          <div className="grid md:grid-cols-2 gap-6">
            {items.map((item, index) => (
              <GridItem key={index} item={item} index={index} />
            ))}
          </div>
        )}

        {/* Simple Style */}
        {style === 'simple' && (
          <div>
            {items.map((item, index) => (
              <SimpleItem key={index} item={item} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export const FAQConfig: ComponentConfig<FAQProps> = {
  label: 'FAQ',
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
      label: 'FAQ Items',
      arrayFields: {
        question: { type: 'text', label: 'Question' },
        answer: { type: 'textarea', label: 'Answer' },
      },
      defaultItemProps: {
        question: 'Your question here?',
        answer: 'Your answer here.',
      },
    },
    style: {
      type: 'select',
      label: 'Style',
      options: [
        { label: 'Accordion', value: 'accordion' },
        { label: 'Grid', value: 'grid' },
        { label: 'Simple List', value: 'simple' },
      ],
    },
    showNumbers: {
      type: 'radio',
      label: 'Show Numbers',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
  },
  defaultProps: {
    heading: 'Frequently Asked Questions',
    subheading: 'Everything you need to know about the program',
    items: defaultFAQs,
    style: 'accordion',
    showNumbers: false,
  },
  render: FAQ,
};

