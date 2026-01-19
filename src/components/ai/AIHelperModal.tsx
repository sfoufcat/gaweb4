'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Sparkles, 
  X, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  AIUseCase,
  AIGenerationContext,
  ProgramContentDraft,
  LandingPageDraft,
  WebsiteContentDraft,
} from '@/lib/ai/types';

// =============================================================================
// TYPES
// =============================================================================

interface AIHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  useCase: AIUseCase;
  context?: AIGenerationContext;
  onApply: (draft: ProgramContentDraft | LandingPageDraft | WebsiteContentDraft) => void | Promise<void>;
  /** Whether existing content exists that will be overwritten */
  hasExistingContent?: boolean;
  /** Custom warning message for overwrite */
  overwriteWarning?: string;
}

type ModalStep = 'input' | 'generating' | 'preview' | 'error';

// =============================================================================
// PREVIEW COMPONENTS
// =============================================================================

function ProgramContentPreview({ draft }: { draft: ProgramContentDraft }) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  
  const toggleDay = (index: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };
  
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
        <span className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {draft.duration} {draft.structure}
        </span>
        <span>•</span>
        <span>{draft.daysOrWeeks.length} {draft.structure} of content</span>
        {draft.globalDefaultHabits.length > 0 && (
          <>
            <span>•</span>
            <span>{draft.globalDefaultHabits.length} global habits</span>
          </>
        )}
      </div>
      
      {/* Global Habits */}
      {draft.globalDefaultHabits.length > 0 && (
        <div className="bg-brand-accent/10 dark:bg-brand-accent/20 rounded-lg p-3">
          <h4 className="text-sm font-medium text-brand-accent dark:text-[#c49a6c] mb-2">
            Global Default Habits
          </h4>
          <div className="space-y-1">
            {draft.globalDefaultHabits.map((habit, i) => (
              <div key={i} className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                • {habit.title} ({habit.frequency})
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Days/Weeks */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {draft.daysOrWeeks.map((dayOrWeek) => (
          <div 
            key={dayOrWeek.index}
            className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleDay(dayOrWeek.index)}
              className="w-full flex items-center justify-between p-3 bg-[#faf8f6] dark:bg-[#1e222a] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedDays.has(dayOrWeek.index) ? (
                  <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                )}
                <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {draft.structure === 'weeks' ? 'Week' : 'Day'} {dayOrWeek.index}: {dayOrWeek.title}
                </span>
              </div>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                {dayOrWeek.tasks.length} tasks
              </span>
            </button>
            
            {expandedDays.has(dayOrWeek.index) && (
              <div className="p-3 bg-white dark:bg-[#171b22] space-y-3">
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] italic">
                  {dayOrWeek.focus}
                </p>
                
                <div className="space-y-2">
                  {dayOrWeek.tasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        task.type === 'action' 
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {task.type}
                      </span>
                      <div className="flex-1">
                        <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">{task.title}</span>
                        {task.estimatedMinutes && (
                          <span className="text-[#5f5a55] dark:text-[#b2b6c2] ml-2">
                            ~{task.estimatedMinutes}min
                          </span>
                        )}
                        {task.description && (
                          <p className="text-[#5f5a55] dark:text-[#b2b6c2] text-xs mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {dayOrWeek.defaultHabits.length > 0 && (
                  <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">
                      Suggested Habits
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayOrWeek.defaultHabits.map((habit, i) => (
                        <div key={i} className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                          • {habit.title} ({habit.frequency})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingPagePreview({ draft }: { draft: LandingPageDraft }) {
  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-accent/20 to-brand-accent/5 dark:from-brand-accent/30 dark:to-brand-accent/10 rounded-lg p-4">
        <span className="text-xs font-medium text-brand-accent dark:text-[#c49a6c] uppercase tracking-wide">Hero Section</span>
        <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mt-1">{draft.hero.title}</h3>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">{draft.hero.subtitle}</p>
        <div className="flex gap-2 mt-3">
          <span className="px-3 py-1 bg-brand-accent text-brand-accent-foreground text-sm rounded-lg">{draft.hero.primaryCta}</span>
          {draft.hero.secondaryCta && (
            <span className="px-3 py-1 border border-brand-accent text-brand-accent text-sm rounded-lg">{draft.hero.secondaryCta}</span>
          )}
        </div>
      </div>
      
      {/* About Coach */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">About the Coach</span>
        <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mt-1">{draft.aboutCoach.headline}</h4>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-2 line-clamp-3">{draft.aboutCoach.bio}</p>
        <ul className="mt-2 space-y-1">
          {draft.aboutCoach.bullets.slice(0, 3).map((bullet, i) => (
            <li key={i} className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">✓ {bullet}</li>
          ))}
        </ul>
      </div>
      
      {/* What You'll Learn */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">What You&apos;ll Learn</span>
        <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mt-1">{draft.whatYoullLearn.headline}</h4>
        <div className="mt-2 grid gap-2">
          {draft.whatYoullLearn.items.slice(0, 4).map((item, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{item.title}</span>
              <span className="text-[#5f5a55] dark:text-[#b2b6c2]"> – {item.description}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* What's Included */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">What&apos;s Included</span>
        <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mt-1">{draft.whatsIncluded.headline}</h4>
        <div className="mt-2 grid gap-2">
          {draft.whatsIncluded.items.slice(0, 4).map((item, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">📦 {item.title}</span>
              <span className="text-[#5f5a55] dark:text-[#b2b6c2]"> – {item.description}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Who It's For */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">Who It&apos;s For</span>
        <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mt-1">{draft.whoItsFor.headline}</h4>
        <ul className="mt-2 space-y-1">
          {draft.whoItsFor.items.map((item, i) => (
            <li key={i} className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">→ {item}</li>
          ))}
        </ul>
      </div>
      
      {/* Testimonials */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">Testimonials ({draft.testimonials.length})</span>
        <div className="mt-2 space-y-3">
          {draft.testimonials.slice(0, 2).map((t, i) => (
            <div key={i} className="bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg p-3">
              <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] italic">&ldquo;{t.quote}&rdquo;</p>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">— {t.name}{t.role ? `, ${t.role}` : ''}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* FAQs */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">FAQs ({draft.faq.length})</span>
        <div className="mt-2 space-y-2">
          {draft.faq.slice(0, 3).map((faq, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">Q: {faq.question}</p>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">A: {faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Tone */}
      <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
        <Zap className="w-4 h-4" />
        <span>Tone: <span className="capitalize font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{draft.tone}</span></span>
      </div>
    </div>
  );
}

function WebsiteContentPreview({ draft }: { draft: WebsiteContentDraft }) {
  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-accent/20 to-brand-accent/5 dark:from-brand-accent/30 dark:to-brand-accent/10 rounded-lg p-4">
        <span className="text-xs font-medium text-brand-accent dark:text-[#c49a6c] uppercase tracking-wide">Hero Section</span>
        <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mt-1">{draft.hero.headline}</h3>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">{draft.hero.subheadline}</p>
        <div className="mt-3">
          <span className="px-3 py-1 bg-brand-accent text-brand-accent-foreground text-sm rounded-lg">{draft.hero.ctaText}</span>
        </div>
      </div>

      {/* About Coach */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">About the Coach</span>
        <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mt-1">{draft.coach.headline}</h4>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-2 line-clamp-3">{draft.coach.bio}</p>
        <ul className="mt-2 space-y-1">
          {draft.coach.bullets.slice(0, 3).map((bullet, i) => (
            <li key={i} className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">✓ {bullet}</li>
          ))}
        </ul>
      </div>

      {/* Services */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">Services ({draft.services.items.length})</span>
        <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mt-1">{draft.services.headline}</h4>
        <div className="mt-2 grid gap-2">
          {draft.services.items.slice(0, 4).map((item, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{item.title}</span>
              <span className="text-[#5f5a55] dark:text-[#b2b6c2]"> – {item.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">Testimonials ({draft.testimonials.length})</span>
        <div className="mt-2 space-y-3">
          {draft.testimonials.slice(0, 2).map((t, i) => (
            <div key={i} className="bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg p-3">
              <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] italic">&ldquo;{t.quote}&rdquo;</p>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">— {t.name}{t.role ? `, ${t.role}` : ''}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">FAQs ({draft.faq.length})</span>
        <div className="mt-2 space-y-2">
          {draft.faq.slice(0, 3).map((faq, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">Q: {faq.question}</p>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">A: {faq.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">Footer CTA</span>
        <h4 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mt-1">{draft.cta.headline}</h4>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">{draft.cta.subheadline}</p>
        <div className="mt-2">
          <span className="px-3 py-1 bg-brand-accent text-brand-accent-foreground text-sm rounded-lg">{draft.cta.buttonText}</span>
        </div>
      </div>

      {/* SEO */}
      <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4">
        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">SEO</span>
        <div className="mt-2 space-y-1">
          <p className="text-sm"><span className="text-[#5f5a55] dark:text-[#b2b6c2]">Title:</span> <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">{draft.seo.metaTitle}</span></p>
          <p className="text-sm"><span className="text-[#5f5a55] dark:text-[#b2b6c2]">Description:</span> <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">{draft.seo.metaDescription}</span></p>
        </div>
      </div>

      {/* Tone */}
      <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
        <Zap className="w-4 h-4" />
        <span>Tone: <span className="capitalize font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{draft.tone}</span></span>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AIHelperModal({
  isOpen,
  onClose,
  title,
  description,
  useCase,
  context,
  onApply,
  hasExistingContent = false,
  overwriteWarning,
}: AIHelperModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<ModalStep>('input');
  const [userPrompt, setUserPrompt] = useState('');
  const [draft, setDraft] = useState<ProgramContentDraft | LandingPageDraft | WebsiteContentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setUserPrompt('');
      setDraft(null);
      setError(null);
      setIsApplying(false);
    }
  }, [isOpen]);
  
  const handleGenerate = async () => {
    if (!userPrompt.trim() || userPrompt.length < 10) {
      setError('Please enter a more detailed prompt (at least 10 characters)');
      return;
    }
    
    setStep('generating');
    setError(null);
    
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase,
          userPrompt,
          context,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate content');
      }
      
      const data = await response.json();
      setDraft(data.draft);
      setStep('preview');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStep('error');
    }
  };
  
  const handleRegenerate = () => {
    setDraft(null);
    setStep('input');
  };
  
  const handleApply = async () => {
    if (!draft) return;
    
    setIsApplying(true);
    try {
      await onApply(draft);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
      setIsApplying(false);
    }
  };
  
  if (!isOpen || !mounted) return null;
  
  // Build context preview
  const contextItems: string[] = [];
  if (context?.programName) contextItems.push(`Program: ${context.programName}`);
  if (context?.squadName) contextItems.push(`Squad: ${context.squadName}`);
  if (context?.duration) contextItems.push(`Duration: ${context.duration} ${context.structure || 'days'}`);
  if (context?.targetAudience) contextItems.push(`Audience: ${context.targetAudience}`);
  
  const modalContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] animate-backdrop-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white dark:bg-[#171b22] rounded-[24px] p-6 max-w-[600px] w-full max-h-[85vh] overflow-hidden flex flex-col animate-modal-zoom-in pointer-events-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-brand-accent" />
              <div>
                <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {title}
                </h2>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  {description}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {step === 'input' && (
              <div className="space-y-4">
                {/* Context Preview */}
                {contextItems.length > 0 && (
                  <div className="bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg p-3">
                    <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">
                      Context
                    </span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {contextItems.map((item, i) => (
                        <span 
                          key={i}
                          className="px-2 py-1 bg-white dark:bg-[#171b22] text-sm text-[#1a1a1a] dark:text-[#f5f5f8] rounded-md border border-[#e1ddd8] dark:border-[#262b35]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Prompt Input */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    Describe what you want
                  </label>
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder={useCase === 'PROGRAM_CONTENT'
                      ? "E.g., Create a 30-day program for creators who want to grow their audience. Focus on content strategy, consistency, and engagement. Include daily action tasks and weekly reflection exercises..."
                      : useCase === 'LANDING_PAGE_WEBSITE'
                      ? "E.g., I'm a leadership coach helping executives develop their emotional intelligence. My target audience is mid-level managers looking to advance. I offer 1:1 coaching, group workshops, and a 12-week leadership program..."
                      : "E.g., Create a landing page for busy professionals who want to level up their health. Tone should be friendly but professional. Highlight the community aspect and accountability..."
                    }
                    rows={6}
                    className="w-full px-4 py-3 border-2 border-brand-accent/40 dark:border-brand-accent/30 rounded-xl bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none focus:outline-none focus:border-brand-accent"
                  />
                  <p className="mt-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                    Be specific about your audience, outcomes, tone, and any constraints
                  </p>
                </div>
                
                {/* Overwrite Warning */}
                {hasExistingContent && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">
                      {overwriteWarning || 'This will replace your existing content. Make sure to review the preview before applying.'}
                    </p>
                  </div>
                )}
                
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </div>
            )}
            
            {step === 'generating' && (
              <div className="flex flex-col items-center justify-center py-12">
                {/* Sparkle Animation Container */}
                <div className="relative w-24 h-24">
                  {/* Outer glow ring */}
                  <div className="absolute inset-0 rounded-full bg-brand-accent/20 dark:bg-brand-accent/20 animate-sparkle-pulse-ring" />
                  
                  {/* Central icon container */}
                  <div className="absolute inset-0 flex items-center justify-center animate-sparkle-pulse-glow">
                    <Sparkles 
                      className="w-10 h-10 text-brand-accent"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(160, 120, 85, 0.6))' }}
                    />
                  </div>
                  
                  {/* Floating particles */}
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className={`absolute w-2 h-2 rounded-full bg-brand-accent left-1/2 top-1/2 opacity-0 animate-sparkle-float-${i % 4}`}
                      style={{ animationDelay: `${i * 0.375}s` }}
                    />
                  ))}
                  
                  {/* Small twinkling stars */}
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={`star-${i}`}
                      className="absolute animate-sparkle-twinkle"
                      style={{
                        left: `${20 + (i * 12)}%`,
                        top: `${15 + ((i * 17) % 70)}%`,
                        animationDelay: `${i * 0.25}s`,
                      }}
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="text-brand-accent/70 dark:text-brand-accent/70">
                        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                      </svg>
                    </div>
                  ))}
                </div>
                
                <p className="mt-6 text-[#5f5a55] dark:text-[#b2b6c2]">
                  Generating your content...
                </p>
                <p className="mt-1 text-sm text-[#5f5a55]/70 dark:text-[#b2b6c2]/70">
                  This may take 15-30 seconds
                </p>
              </div>
            )}
            
            {step === 'preview' && draft && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Content generated successfully!</span>
                </div>
                
                {useCase === 'PROGRAM_CONTENT' ? (
                  <ProgramContentPreview draft={draft as ProgramContentDraft} />
                ) : useCase === 'LANDING_PAGE_WEBSITE' ? (
                  <WebsiteContentPreview draft={draft as WebsiteContentDraft} />
                ) : (
                  <LandingPagePreview draft={draft as LandingPageDraft} />
                )}
                
                {hasExistingContent && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">
                      Clicking &ldquo;Apply&rdquo; will replace your existing content.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {step === 'error' && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <p className="mt-4 text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">
                  Generation Failed
                </p>
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 text-center">
                  {error}
                </p>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
            {step === 'input' && (
              <>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={userPrompt.trim().length < 10}
                  className="bg-brand-accent hover:bg-brand-accent/90 text-white flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate
                </Button>
              </>
            )}
            
            {step === 'generating' && (
              <Button
                variant="outline"
                onClick={() => {
                  setStep('input');
                }}
                className="border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]"
              >
                Cancel
              </Button>
            )}
            
            {step === 'preview' && (
              <>
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  className="border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </Button>
                <Button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="bg-brand-accent hover:bg-brand-accent/90 text-white flex items-center gap-2"
                >
                  {isApplying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Apply
                    </>
                  )}
                </Button>
              </>
            )}
            
            {step === 'error' && (
              <>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setStep('input');
                    setError(null);
                  }}
                  className="bg-brand-accent hover:bg-brand-accent/90 text-white flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
  
  return createPortal(modalContent, document.body);
}

