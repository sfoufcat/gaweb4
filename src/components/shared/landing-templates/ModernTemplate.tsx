'use client';

import { Check, Star, ChevronDown, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { LandingTemplateProps } from './ClassicTemplate';

export function ModernTemplate({
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
  accentLight = '#a07855',
  accentDark = '#b8896a',
}: LandingTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Derived darker accent for gradients
  const accentDarker = accentDark;

  return (
    <div className="font-albert min-h-screen bg-white dark:bg-[#0a0c10]">
      {/* Bold Hero */}
      {(headline || subheadline) && (
        <section className="py-20 px-6 text-white" style={{ backgroundColor: accentLight }}>
          <div className="max-w-5xl mx-auto">
            <div className="max-w-3xl">
              {headline && (
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                  {headline}
                </h1>
              )}
              {subheadline && (
                <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl">
                  {subheadline}
                </p>
              )}
              {ctaText && (
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <button
                    onClick={onCTA}
                    className="px-8 py-4 bg-white font-semibold text-lg rounded-xl transition-all hover:shadow-xl hover:scale-105 flex items-center gap-2"
                    style={{ color: accentLight }}
                  >
                    {ctaText}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  {ctaSubtext && (
                    <p className="text-sm text-white/70 self-center">{ctaSubtext}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Key Outcomes - Card Grid */}
      {keyOutcomes.length > 0 && (
        <section className="py-20 px-6 bg-[#faf8f6] dark:bg-[#11141b]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="font-semibold text-sm uppercase tracking-wide" style={{ color: accentLight }}>
                The Transformation
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mt-2">
                What You&apos;ll Achieve
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {keyOutcomes.map((outcome, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-4 p-5 bg-white dark:bg-[#171b22] rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accentLight }}>
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">{outcome}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features - Large Cards */}
      {features.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="font-semibold text-sm uppercase tracking-wide" style={{ color: accentLight }}>
                Everything You Need
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mt-2">
                What&apos;s Inside
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="p-8 bg-[#faf8f6] dark:bg-[#171b22] rounded-3xl border border-[#e1ddd8] dark:border-[#262b35] transition-colors"
                  style={{ ['--hover-border' as string]: accentLight }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = accentLight}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                >
                  {feature.icon && (
                    <div className="text-4xl mb-4">
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
                  <h3 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
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

      {/* Coach Bio - Side by Side */}
      {coachBio && (
        <section className="py-20 px-6 bg-[#faf8f6] dark:bg-[#11141b]">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-3xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accentLight}1a` }}>
                <span className="text-5xl md:text-7xl" style={{ color: accentLight }}>👤</span>
              </div>
              <div>
                <span className="font-semibold text-sm uppercase tracking-wide" style={{ color: accentLight }}>
                  Meet Your Guide
                </span>
                <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mt-2 mb-4">
                  About Your Coach
                </h2>
                <p className="text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed whitespace-pre-wrap text-lg">
                  {coachBio}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Testimonials - Featured Cards */}
      {showTestimonials && testimonials.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="font-semibold text-sm uppercase tracking-wide" style={{ color: accentLight }}>
                Social Proof
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mt-2">
                Success Stories
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {testimonials.map((testimonial, index) => (
                <div 
                  key={index}
                  className="p-8 bg-white dark:bg-[#171b22] rounded-3xl shadow-lg hover:shadow-xl transition-shadow"
                >
                  {testimonial.rating && (
                    <div className="flex gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${
                            star <= testimonial.rating!
                              ? 'text-[#FFB800] fill-[#FFB800]'
                              : 'text-[#d1ccc5] dark:text-[#7d8190]'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-[#1a1a1a] dark:text-[#f5f5f8] text-lg mb-6 leading-relaxed">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-4 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentDarker})` }}>
                      <span className="text-white font-bold text-lg">
                        {testimonial.author.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {testimonial.author}
                      </p>
                      {testimonial.role && (
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
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

      {/* FAQs - Modern Accordion */}
      {showFAQ && faqs.length > 0 && (
        <section className="py-20 px-6 bg-[#faf8f6] dark:bg-[#11141b]">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="font-semibold text-sm uppercase tracking-wide" style={{ color: accentLight }}>
                Got Questions?
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mt-2">
                FAQ
              </h2>
            </div>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div 
                  key={index}
                  className={`bg-white dark:bg-[#171b22] rounded-2xl overflow-hidden transition-shadow ${
                    openFaqIndex === index ? 'shadow-lg' : ''
                  }`}
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left"
                  >
                    <span className="font-bold text-[#1a1a1a] dark:text-[#f5f5f8] text-lg pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown 
                      className={`w-6 h-6 transition-transform flex-shrink-0 ${
                        openFaqIndex === index ? 'rotate-180' : ''
                      }`}
                      style={{ color: accentLight }}
                    />
                  </button>
                  {openFaqIndex === index && (
                    <div className="px-6 pb-5">
                      <p className="text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed text-lg">
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

      {/* Bottom CTA - Bold Banner */}
      {ctaText && (
        <section className="py-20 px-6" style={{ backgroundColor: accentLight }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Life?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
              Join now and start your journey today.
            </p>
            <button
              onClick={onCTA}
              className="px-10 py-5 bg-white font-bold text-lg rounded-xl transition-all hover:shadow-xl hover:scale-105 flex items-center gap-2 mx-auto"
              style={{ color: accentLight }}
            >
              {ctaText}
              <ArrowRight className="w-5 h-5" />
            </button>
            {ctaSubtext && (
              <p className="mt-4 text-sm text-white/70">{ctaSubtext}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}


