'use client';

import { Check, Star, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ProgramFeature, ProgramTestimonial, ProgramFAQ } from '@/types';

export interface LandingTemplateProps {
  headline?: string;
  subheadline?: string;
  coachBio?: string;
  keyOutcomes?: string[];
  features?: ProgramFeature[];
  testimonials?: ProgramTestimonial[];
  faqs?: ProgramFAQ[];
  ctaText?: string;
  ctaSubtext?: string;
  showTestimonials?: boolean;
  showFAQ?: boolean;
  onCTA?: () => void;
}

export function ClassicTemplate({
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
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <div className="font-albert min-h-screen bg-[#faf8f6] dark:bg-[#0a0c10]">
      {/* Hero Section */}
      {(headline || subheadline) && (
        <section className="py-16 px-6 bg-gradient-to-b from-[#f5f2ee] to-[#faf8f6] dark:from-[#11141b] dark:to-[#0a0c10]">
          <div className="max-w-4xl mx-auto text-center">
            {headline && (
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-6 leading-tight">
                {headline}
              </h1>
            )}
            {subheadline && (
              <p className="text-lg md:text-xl text-[#5f5a55] dark:text-[#b2b6c2] max-w-2xl mx-auto mb-8">
                {subheadline}
              </p>
            )}
            {ctaText && (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={onCTA}
                  className="px-8 py-4 bg-[#a07855] hover:bg-[#8c6245] text-white font-semibold text-lg rounded-xl transition-colors shadow-lg shadow-[#a07855]/20"
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

      {/* Key Outcomes */}
      {keyOutcomes.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] text-center mb-10">
              What You&apos;ll Learn
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {keyOutcomes.map((outcome, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-4 bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]"
                >
                  <div className="w-6 h-6 rounded-full bg-[#a07855]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-[#a07855]" />
                  </div>
                  <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">{outcome}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      {features.length > 0 && (
        <section className="py-16 px-6 bg-white dark:bg-[#11141b]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] text-center mb-10">
              What&apos;s Included
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="p-6 bg-[#faf8f6] dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]"
                >
                  {feature.icon && (
                    <div className="text-2xl mb-3">
                      {feature.icon === 'video' && '📹'}
                      {feature.icon === 'users' && '👥'}
                      {feature.icon === 'message-circle' && '💬'}
                      {feature.icon === 'book' && '📚'}
                      {feature.icon === 'target' && '🎯'}
                      {feature.icon === 'calendar' && '📅'}
                      {feature.icon === 'check-circle' && '✅'}
                      {feature.icon === 'zap' && '⚡'}
                      {feature.icon === 'heart' && '❤️'}
                      {feature.icon === 'star' && '⭐'}
                    </div>
                  )}
                  <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    {feature.title}
                  </h3>
                  {feature.description && (
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      {feature.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Coach Bio */}
      {coachBio && (
        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] p-8 md:p-10">
              <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-4">
                About Your Coach
              </h2>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed whitespace-pre-wrap">
                {coachBio}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {showTestimonials && testimonials.length > 0 && (
        <section className="py-16 px-6 bg-white dark:bg-[#11141b]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] text-center mb-10">
              What Others Say
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {testimonials.map((testimonial, index) => (
                <div 
                  key={index}
                  className="p-6 bg-[#faf8f6] dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]"
                >
                  {testimonial.rating && (
                    <div className="flex gap-0.5 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= testimonial.rating!
                              ? 'text-[#FFB800] fill-[#FFB800]'
                              : 'text-[#d1ccc5] dark:text-[#7d8190]'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-[#1a1a1a] dark:text-[#f5f5f8] mb-4 leading-relaxed">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#a07855]/10 flex items-center justify-center">
                      <span className="text-[#a07855] font-semibold">
                        {testimonial.author.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">
                        {testimonial.author}
                      </p>
                      {testimonial.role && (
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                          {testimonial.role}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQs */}
      {showFAQ && faqs.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] text-center mb-10">
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div 
                  key={index}
                  className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left"
                  >
                    <span className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {faq.question}
                    </span>
                    <ChevronDown 
                      className={`w-5 h-5 text-[#5f5a55] transition-transform ${
                        openFaqIndex === index ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaqIndex === index && (
                    <div className="px-6 pb-4">
                      <p className="text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      {ctaText && (
        <section className="py-16 px-6 bg-gradient-to-t from-[#f5f2ee] to-[#faf8f6] dark:from-[#11141b] dark:to-[#0a0c10]">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-6">
              Ready to Get Started?
            </h2>
            <button
              onClick={onCTA}
              className="px-8 py-4 bg-[#a07855] hover:bg-[#8c6245] text-white font-semibold text-lg rounded-xl transition-colors shadow-lg shadow-[#a07855]/20"
            >
              {ctaText}
            </button>
            {ctaSubtext && (
              <p className="mt-3 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">{ctaSubtext}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}


