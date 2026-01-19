'use client';

import React from 'react';
import Image from 'next/image';
import {
  Plus,
  Trash2,
  Star,
  X,
  Type,
  Image as ImageIcon,
  User,
  Briefcase,
  MessageSquare,
  HelpCircle,
  Megaphone,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaUpload } from '@/components/admin/MediaUpload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import type { OrgWebsite, ProgramTestimonial, ProgramFAQ, WebsiteService } from '@/types';

interface SimpleFunnel {
  id: string;
  name: string;
  slug: string;
  targetType: string;
}

type WebsiteFormData = Omit<OrgWebsite, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>;

interface WebsiteEditorProps {
  formData: WebsiteFormData;
  onChange: (updates: Partial<WebsiteFormData>) => void;
  funnels: SimpleFunnel[];
}

// Icon options for services
const SERVICE_ICONS = [
  { value: 'video', label: 'Video', emoji: '📹' },
  { value: 'users', label: 'Users', emoji: '👥' },
  { value: 'message-circle', label: 'Chat', emoji: '💬' },
  { value: 'book', label: 'Book', emoji: '📚' },
  { value: 'target', label: 'Target', emoji: '🎯' },
  { value: 'calendar', label: 'Calendar', emoji: '📅' },
  { value: 'check-circle', label: 'Check', emoji: '✅' },
  { value: 'zap', label: 'Energy', emoji: '⚡' },
  { value: 'heart', label: 'Heart', emoji: '❤️' },
  { value: 'star', label: 'Star', emoji: '⭐' },
  { value: 'rocket', label: 'Rocket', emoji: '🚀' },
  { value: 'trophy', label: 'Trophy', emoji: '🏆' },
];

export function WebsiteEditor({ formData, onChange, funnels }: WebsiteEditorProps) {
  // Coach Bullets management
  const addCoachBullet = () => {
    onChange({
      coachBullets: [...(formData.coachBullets || []), ''],
    });
  };

  const updateCoachBullet = (index: number, value: string) => {
    onChange({
      coachBullets: (formData.coachBullets || []).map((b, i) => i === index ? value : b),
    });
  };

  const removeCoachBullet = (index: number) => {
    onChange({
      coachBullets: (formData.coachBullets || []).filter((_, i) => i !== index),
    });
  };

  // Services management
  const addService = () => {
    const newService: WebsiteService = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      icon: 'star',
      funnelId: '',
    };
    onChange({
      services: [...(formData.services || []), newService],
    });
  };

  const updateService = (index: number, updates: Partial<WebsiteService>) => {
    onChange({
      services: (formData.services || []).map((s, i) =>
        i === index ? { ...s, ...updates } : s
      ),
    });
  };

  const removeService = (index: number) => {
    onChange({
      services: (formData.services || []).filter((_, i) => i !== index),
    });
  };

  // Testimonials management
  const addTestimonial = () => {
    onChange({
      testimonials: [...(formData.testimonials || []), { text: '', author: '', role: '', rating: 5 }],
    });
  };

  const updateTestimonial = (index: number, updates: Partial<ProgramTestimonial>) => {
    onChange({
      testimonials: (formData.testimonials || []).map((t, i) =>
        i === index ? { ...t, ...updates } : t
      ),
    });
  };

  const removeTestimonial = (index: number) => {
    onChange({
      testimonials: (formData.testimonials || []).filter((_, i) => i !== index),
    });
  };

  // FAQs management
  const addFAQ = () => {
    onChange({
      faqs: [...(formData.faqs || []), { question: '', answer: '' }],
    });
  };

  const updateFAQ = (index: number, updates: Partial<ProgramFAQ>) => {
    onChange({
      faqs: (formData.faqs || []).map((f, i) => i === index ? { ...f, ...updates } : f),
    });
  };

  const removeFAQ = (index: number) => {
    onChange({
      faqs: (formData.faqs || []).filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      {/* Hero Section */}
      <CollapsibleSection title="Hero Section" icon={Type} defaultOpen={true}>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          The first thing visitors see when they land on your page.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
              Headline *
            </label>
            <input
              type="text"
              value={formData.heroHeadline || ''}
              onChange={(e) => onChange({ heroHeadline: e.target.value })}
              placeholder="e.g., Transform Your Life with Expert Coaching"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
              Subtitle
            </label>
            <textarea
              value={formData.heroSubheadline || ''}
              onChange={(e) => onChange({ heroSubheadline: e.target.value })}
              placeholder="e.g., Personalized coaching programs designed to help you achieve your biggest goals..."
              rows={2}
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
                Join Button Text
              </label>
              <input
                type="text"
                value={formData.heroCtaText || ''}
                onChange={(e) => onChange({ heroCtaText: e.target.value })}
                placeholder="Get Started"
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
                Join Button Links To *
              </label>
              <Select
                value={formData.heroCtaFunnelId || ''}
                onValueChange={(value) => onChange({ heroCtaFunnelId: value || null })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a funnel..." />
                </SelectTrigger>
                <SelectContent>
                  {funnels.length === 0 ? (
                    <div className="p-3 text-sm text-[#5f5a55] dark:text-[#b2b6c2] text-center">
                      No active funnels. Create a funnel first.
                    </div>
                  ) : (
                    funnels.map((funnel) => (
                      <SelectItem key={funnel.id} value={funnel.id}>
                        {funnel.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Cover Image Section */}
      <CollapsibleSection title="Cover Image" icon={ImageIcon} defaultOpen={false}>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
          A hero image displayed at the top of your website. Recommended size: 1920 x 1080px (16:9 ratio).
        </p>

        {formData.heroImageUrl ? (
          <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden bg-[#faf8f6] dark:bg-[#11141b]">
            <Image
              src={formData.heroImageUrl}
              alt="Hero image"
              fill
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => onChange({ heroImageUrl: undefined })}
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <div className="max-w-xs">
            <MediaUpload
              value={formData.heroImageUrl || ''}
              onChange={(url) => onChange({ heroImageUrl: url })}
              folder="websites"
              type="image"
              uploadEndpoint="/api/coach/org-upload-media"
              hideLabel
              aspectRatio="16:9"
              previewSize="thumbnail"
            />
          </div>
        )}
      </CollapsibleSection>

      {/* Coach/About Section */}
      <CollapsibleSection title="About You" icon={User} defaultOpen={true}>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          Tell visitors about yourself and your coaching approach.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
              Section Headline
            </label>
            <input
              type="text"
              value={formData.coachHeadline || ''}
              onChange={(e) => onChange({ coachHeadline: e.target.value })}
              placeholder="About Your Coach"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
              Bio
            </label>
            <textarea
              value={formData.coachBio || ''}
              onChange={(e) => onChange({ coachBio: e.target.value })}
              placeholder="Share your story, experience, and what makes you uniquely qualified to help your clients..."
              rows={4}
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Key Credentials
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addCoachBullet}
                className="text-brand-accent hover:text-brand-accent/80"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
              Highlight your qualifications, certifications, or achievements.
            </p>
            <div className="space-y-2">
              {(formData.coachBullets || []).map((bullet, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => updateCoachBullet(index, e.target.value)}
                    placeholder="e.g., ICF Certified Coach"
                    className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeCoachBullet(index)}
                    className="p-2 text-[#5f5a55] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(formData.coachBullets || []).length === 0 && (
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] italic">
                  No credentials added yet
                </p>
              )}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Services Section */}
      <CollapsibleSection
        title="Services & Offerings"
        icon={Briefcase}
        defaultOpen={false}
        description={(formData.services || []).length > 0 ? `${(formData.services || []).length} service(s)` : undefined}
      >
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          Showcase what you offer. Each service links to one of your funnels.
        </p>
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
            Section Headline
          </label>
          <input
            type="text"
            value={formData.servicesHeadline || ''}
            onChange={(e) => onChange({ servicesHeadline: e.target.value })}
            placeholder="What I Offer"
            className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4"
          />
        </div>
        <div className="space-y-4">
          {(formData.services || []).map((service, index) => (
            <div
              key={service.id}
              className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Service {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeService(index)}
                  className="p-1 text-[#5f5a55] hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={service.title}
                    onChange={(e) => updateService(index, { title: e.target.value })}
                    placeholder="e.g., 1:1 Coaching"
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                    Icon
                  </label>
                  <Select
                    value={service.icon || 'star'}
                    onValueChange={(value) => updateService(index, { icon: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_ICONS.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          <span className="flex items-center gap-2">
                            <span>{icon.emoji}</span>
                            <span>{icon.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                    Description
                  </label>
                  <textarea
                    value={service.description}
                    onChange={(e) => updateService(index, { description: e.target.value })}
                    placeholder="Brief description of this service..."
                    rows={2}
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm resize-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                    Links To
                  </label>
                  <Select
                    value={service.funnelId || ''}
                    onValueChange={(value) => updateService(index, { funnelId: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a funnel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {funnels.map((funnel) => (
                        <SelectItem key={funnel.id} value={funnel.id}>
                          {funnel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addService}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>
      </CollapsibleSection>

      {/* Testimonials Section */}
      <CollapsibleSection
        title="Testimonials"
        icon={MessageSquare}
        defaultOpen={false}
        description={(formData.testimonials || []).length > 0 ? `${(formData.testimonials || []).length} testimonial(s)` : undefined}
      >
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          Social proof from happy clients builds trust with potential customers.
        </p>
        <div className="space-y-4">
          {(formData.testimonials || []).map((testimonial, index) => (
            <div
              key={index}
              className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Testimonial {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeTestimonial(index)}
                  className="p-1 text-[#5f5a55] hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                    Quote
                  </label>
                  <textarea
                    value={testimonial.text}
                    onChange={(e) => updateTestimonial(index, { text: e.target.value })}
                    placeholder="What did they say about working with you?"
                    rows={3}
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={testimonial.author}
                      onChange={(e) => updateTestimonial(index, { author: e.target.value })}
                      placeholder="Client name"
                      className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                      Role/Title
                    </label>
                    <input
                      type="text"
                      value={testimonial.role || ''}
                      onChange={(e) => updateTestimonial(index, { role: e.target.value })}
                      placeholder="e.g., Entrepreneur"
                      className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                    Rating
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => updateTestimonial(index, { rating: star })}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= (testimonial.rating || 5)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addTestimonial}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Testimonial
          </Button>
        </div>
      </CollapsibleSection>

      {/* FAQs Section */}
      <CollapsibleSection
        title="FAQs"
        icon={HelpCircle}
        defaultOpen={false}
        description={(formData.faqs || []).length > 0 ? `${(formData.faqs || []).length} FAQ(s)` : undefined}
      >
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          Answer common questions to help visitors make a decision.
        </p>
        <div className="space-y-4">
          {(formData.faqs || []).map((faq, index) => (
            <div
              key={index}
              className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  FAQ {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeFAQ(index)}
                  className="p-1 text-[#5f5a55] hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                    Question
                  </label>
                  <input
                    type="text"
                    value={faq.question}
                    onChange={(e) => updateFAQ(index, { question: e.target.value })}
                    placeholder="e.g., How long is the program?"
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                    Answer
                  </label>
                  <textarea
                    value={faq.answer}
                    onChange={(e) => updateFAQ(index, { answer: e.target.value })}
                    placeholder="Your answer..."
                    rows={2}
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addFAQ}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add FAQ
          </Button>
        </div>
      </CollapsibleSection>

      {/* Footer CTA Section */}
      <CollapsibleSection title="Footer CTA" icon={Megaphone} defaultOpen={false}>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          A final call-to-action at the bottom of your page.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
              Headline
            </label>
            <input
              type="text"
              value={formData.ctaHeadline || ''}
              onChange={(e) => onChange({ ctaHeadline: e.target.value })}
              placeholder="e.g., Ready to Transform Your Life?"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
              Subheadline
            </label>
            <input
              type="text"
              value={formData.ctaSubheadline || ''}
              onChange={(e) => onChange({ ctaSubheadline: e.target.value })}
              placeholder="e.g., Join hundreds of clients who have achieved their goals"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
                Button Text
              </label>
              <input
                type="text"
                value={formData.ctaButtonText || ''}
                onChange={(e) => onChange({ ctaButtonText: e.target.value })}
                placeholder="Get Started"
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
                Links To (optional)
              </label>
              <Select
                value={formData.ctaFunnelId || 'hero'}
                onValueChange={(value) => onChange({ ctaFunnelId: value === 'hero' ? null : value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Same as hero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hero">Same as hero Join button</SelectItem>
                  {funnels.map((funnel) => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      {funnel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* SEO Section */}
      <CollapsibleSection title="SEO & Sharing" icon={Search} defaultOpen={false}>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          Optimize how your website appears in search results and social shares.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
              Page Title
            </label>
            <input
              type="text"
              value={formData.metaTitle || ''}
              onChange={(e) => onChange({ metaTitle: e.target.value })}
              placeholder="e.g., Transform Your Life | Coach Name"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
            />
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Appears in browser tabs and search results. Keep under 60 characters.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
              Meta Description
            </label>
            <textarea
              value={formData.metaDescription || ''}
              onChange={(e) => onChange({ metaDescription: e.target.value })}
              placeholder="A brief description of your coaching services..."
              rows={2}
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
            />
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Appears in search results. Keep under 160 characters.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
              Social Sharing Image
            </label>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-2">
              This image appears when your website is shared on social media. Recommended: 1200 x 630px.
            </p>
            {formData.ogImageUrl ? (
              <div className="relative w-full max-w-sm aspect-[1200/630] rounded-lg overflow-hidden bg-[#faf8f6] dark:bg-[#11141b]">
                <Image
                  src={formData.ogImageUrl}
                  alt="Social sharing image"
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => onChange({ ogImageUrl: undefined })}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <div className="max-w-xs">
                <MediaUpload
                  value={formData.ogImageUrl || ''}
                  onChange={(url) => onChange({ ogImageUrl: url })}
                  folder="websites"
                  type="image"
                  uploadEndpoint="/api/coach/org-upload-media"
                  hideLabel
                  previewSize="thumbnail"
                />
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Navigation Settings */}
      <CollapsibleSection title="Navigation Settings" icon={User} defaultOpen={false}>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          Customize the navigation bar that appears at the top of your website.
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Show Sign In Button
              </label>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                Allow existing users to sign in from your website
              </p>
            </div>
            <Button
              type="button"
              variant={formData.showSignIn ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ showSignIn: !formData.showSignIn })}
            >
              {formData.showSignIn ? 'Visible' : 'Hidden'}
            </Button>
          </div>
          {formData.showSignIn && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
                Sign In Button Text
              </label>
              <input
                type="text"
                value={formData.signInButtonText || ''}
                onChange={(e) => onChange({ signInButtonText: e.target.value })}
                placeholder="Sign In"
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
              />
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
