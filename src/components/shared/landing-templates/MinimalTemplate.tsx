'use client';

import { Check, Star, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import type { LandingTemplateProps } from './ClassicTemplate';

export function MinimalTemplate({
  headline,
  subheadline,
  coachBio,
  keyOutcomes = [],
  features = [],
  testimonials = [],
  faqs = [],
  ctaText = 'Get Started',
  ctaSubtext,
  showTestimonials = true,
  showFAQ = true,
  onCTA,
}: LandingTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <div className="font-albert min-h-screen bg-white dark:bg-[#0a0c10]">
      {/* Minimal Hero */}
      {(headline || subheadline) && (
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            {headline && (
              <h1 className="text-4xl md:text-5xl font-light text-[#1a1a1a] dark:text-[#f5f5f8] mb-6 leading-tight tracking-tight">
                {headline}
              </h1>
            )}
            {subheadline && (
              <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] mb-10 leading-relaxed">
                {subheadline}
              </p>
            )}
            {ctaText && (
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={onCTA}
                  className="px-8 py-3 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] font-medium rounded-full transition-all hover:opacity-80"
                >
                  {ctaText}
                </button>
                {ctaSubtext && (
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">{ctaSubtext}</p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Divider */}
      <div className="max-w-24 mx-auto border-t border-[#e1ddd8] dark:border-[#262b35]" />

      {/* Key Outcomes - Simple List */}
      {keyOutcomes.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-widest mb-8 text-center">
              What You&apos;ll Learn
            </h2>
            <div className="space-y-4">
              {keyOutcomes.map((outcome, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-4 py-3 border-b border-[#f0ede9] dark:border-[#1d222b] last:border-0"
                >
                  <Check className="w-4 h-4 text-[#a07855] flex-shrink-0" />
                  <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">{outcome}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features - Text Focus */}
      {features.length > 0 && (
        <section className="py-20 px-6 bg-[#faf8f6] dark:bg-[#11141b]">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-widest mb-8 text-center">
              What&apos;s Included
            </h2>
            <div className="space-y-8">
              {features.map((feature, index) => (
                <div key={index} className="text-center">
                  <h3 className="text-xl font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    {feature.title}
                  </h3>
                  {feature.description && (
                    <p className="text-[#5f5a55] dark:text-[#b2b6c2]">
                      {feature.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Coach Bio - Elegant Quote Style */}
      {coachBio && (
        <section className="py-20 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-widest mb-8">
              Your Guide
            </h2>
            <p className="text-lg text-[#1a1a1a] dark:text-[#f5f5f8] leading-relaxed whitespace-pre-wrap italic">
              {coachBio}
            </p>
          </div>
        </section>
      )}

      {/* Divider */}
      <div className="max-w-24 mx-auto border-t border-[#e1ddd8] dark:border-[#262b35]" />

      {/* Testimonials - Simple Quote */}
      {showTestimonials && testimonials.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-widest mb-12 text-center">
              Kind Words
            </h2>
            <div className="space-y-12">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="text-center">
                  {testimonial.rating && (
                    <div className="flex gap-1 justify-center mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= testimonial.rating!
                              ? 'text-[#a07855] fill-[#a07855]'
                              : 'text-[#e1ddd8] dark:text-[#262b35]'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-xl text-[#1a1a1a] dark:text-[#f5f5f8] mb-6 leading-relaxed font-light italic">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <div>
                    <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {testimonial.author}
                    </p>
                    {testimonial.role && (
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        {testimonial.role}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQs - Clean Accordion */}
      {showFAQ && faqs.length > 0 && (
        <section className="py-20 px-6 bg-[#faf8f6] dark:bg-[#11141b]">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-widest mb-12 text-center">
              Questions
            </h2>
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {faqs.map((faq, index) => (
                <div key={index} className="py-6">
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] pr-4">
                      {faq.question}
                    </span>
                    {openFaqIndex === index ? (
                      <Minus className="w-4 h-4 text-[#5f5a55] flex-shrink-0" />
                    ) : (
                      <Plus className="w-4 h-4 text-[#5f5a55] flex-shrink-0" />
                    )}
                  </button>
                  {openFaqIndex === index && (
                    <p className="mt-4 text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                      {faq.answer}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA - Minimal */}
      {ctaText && (
        <section className="py-24 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] mb-8">
              Ready to begin?
            </p>
            <button
              onClick={onCTA}
              className="px-10 py-4 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] font-medium rounded-full transition-all hover:opacity-80"
            >
              {ctaText}
            </button>
            {ctaSubtext && (
              <p className="mt-4 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">{ctaSubtext}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}


