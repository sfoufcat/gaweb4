'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Upload,
  FileText,
  Database,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractPdfText, formatFileSize, type PdfExtractionResult } from '@/lib/pdf-utils';
import type {
  AIUseCase,
  AIGenerationContext,
  ProgramContentDraft,
  LandingPageDraft,
  WebsiteContentDraft,
  OrgContentContext,
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
  /** For program-specific contexts (LANDING_PAGE_PROGRAM, PROGRAM_CONTENT) */
  programId?: string;
  /** For squad-specific contexts (LANDING_PAGE_SQUAD) */
  squadId?: string;
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
  programId,
  squadId,
}: AIHelperModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<ModalStep>('input');
  const [userPrompt, setUserPrompt] = useState('');
  const [draft, setDraft] = useState<ProgramContentDraft | LandingPageDraft | WebsiteContentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // PDF upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfResult, setPdfResult] = useState<PdfExtractionResult | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);

  // "Use my content" state
  const [orgContent, setOrgContent] = useState<OrgContentContext | null>(null);
  const [isLoadingOrgContent, setIsLoadingOrgContent] = useState(false);
  const [orgContentError, setOrgContentError] = useState<string | null>(null);

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
      setPdfFile(null);
      setPdfResult(null);
      setOrgContent(null);
      setOrgContentError(null);
    }
  }, [isOpen]);

  // Handle PDF file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfFile(file);
    setIsExtractingPdf(true);
    setPdfResult(null);

    try {
      const result = await extractPdfText(file);
      setPdfResult(result);
      if (!result.success) {
        setError(result.error || 'Failed to extract PDF content');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process PDF');
    } finally {
      setIsExtractingPdf(false);
    }
  };

  // Remove PDF
  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fetch organization content for "Use my content"
  const handleUseMyContent = async () => {
    setIsLoadingOrgContent(true);
    setOrgContentError(null);

    try {
      const params = new URLSearchParams({ useCase });
      if (programId) params.append('programId', programId);
      if (squadId) params.append('squadId', squadId);

      const response = await fetch(`/api/coach/ai-context?${params}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch content');
      }

      const data = await response.json();
      setOrgContent(data);
    } catch (err) {
      setOrgContentError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setIsLoadingOrgContent(false);
    }
  };

  // Remove org content
  const handleRemoveOrgContent = () => {
    setOrgContent(null);
    setOrgContentError(null);
  };
  
  const handleGenerate = async () => {
    // Allow generation if we have PDF content OR org content, even without a detailed prompt
    const hasPdfContent = pdfResult?.success && pdfResult.text;
    const hasOrgContent = !!orgContent;
    const hasUserPrompt = userPrompt.trim().length >= 10;

    if (!hasUserPrompt && !hasPdfContent && !hasOrgContent) {
      setError('Please enter a prompt, upload a PDF, or use your existing content');
      return;
    }

    setStep('generating');
    setError(null);

    try {
      // Build enhanced context with PDF and org content
      const enhancedContext: AIGenerationContext = {
        ...context,
      };

      // Add PDF content if available
      if (pdfResult?.success && pdfResult.text) {
        enhancedContext.pdfContent = pdfResult.text;
        enhancedContext.pdfFileName = pdfFile?.name;
      }

      // Add org content if available
      if (orgContent) {
        enhancedContext.orgContent = orgContent;
      }

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase,
          userPrompt,
          context: enhancedContext,
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

                {/* Content Source Buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Use My Content Button */}
                  <button
                    type="button"
                    onClick={handleUseMyContent}
                    disabled={isLoadingOrgContent || !!orgContent}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] bg-[#faf8f6] dark:bg-[#1e222a] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingOrgContent ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4" />
                    )}
                    {orgContent ? 'Content loaded' : 'Use my content'}
                  </button>

                  {/* Upload PDF Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isExtractingPdf || !!pdfFile}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] bg-[#faf8f6] dark:bg-[#1e222a] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExtractingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {pdfFile ? 'PDF uploaded' : 'Upload PDF'}
                  </button>

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* PDF Status Indicator */}
                {pdfFile && pdfResult && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          {pdfFile.name}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {pdfResult.success
                            ? `${pdfResult.charCount.toLocaleString()} chars extracted${pdfResult.truncated ? ' (truncated)' : ''}`
                            : pdfResult.error || 'Failed to extract'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePdf}
                      className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </button>
                  </div>
                )}

                {/* Org Content Status Indicator */}
                {orgContent && (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">
                          Using your content
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          {orgContent.summary ||
                            [
                              orgContent.programs?.length && `${orgContent.programs.length} program${orgContent.programs.length > 1 ? 's' : ''}`,
                              orgContent.squads?.length && `${orgContent.squads.length} squad${orgContent.squads.length > 1 ? 's' : ''}`,
                              orgContent.program && `Program: ${orgContent.program.name}`,
                              orgContent.squad && `Squad: ${orgContent.squad.name}`,
                            ].filter(Boolean).join(', ') || 'Content loaded'
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveOrgContent}
                      className="p-1 hover:bg-green-100 dark:hover:bg-green-800/50 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </button>
                  </div>
                )}

                {/* Org Content Error */}
                {orgContentError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                    {orgContentError}
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
              <div className="flex flex-col items-center justify-center py-16">
                {/* Clean AI Loading Animation */}
                <div className="relative">
                  {/* Pulse rings */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-brand-accent/10 animate-ai-pulse-ring" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-16 h-16 rounded-full bg-brand-accent/15 animate-ai-pulse-ring"
                      style={{ animationDelay: '0.5s' }}
                    />
                  </div>

                  {/* Central icon */}
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-brand-accent" />
                  </div>
                </div>

                {/* Shimmer text */}
                <p className="mt-8 text-lg font-medium animate-ai-shimmer">
                  Creating your content
                </p>

                {/* Loading dots */}
                <div className="ai-loading-dots mt-3">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

                <p className="mt-4 text-sm text-[#5f5a55]/60 dark:text-[#b2b6c2]/60">
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
                  disabled={
                    userPrompt.trim().length < 10 &&
                    !(pdfResult?.success && pdfResult.text) &&
                    !orgContent
                  }
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

