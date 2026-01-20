'use client';

import React, { useState, Fragment, useCallback, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileText,
  Globe,
  Lock,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { AuthorSelector } from '@/components/admin/AuthorSelector';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { CategorySelector } from '@/components/admin/CategorySelector';

// Wizard step types
type WizardStep = 'info' | 'details';

// Wizard data collected across steps
interface ArticleWizardData {
  // Step 1: Info
  title: string;
  coverImage: string;
  authorId: string | null;
  authorName: string;
  // Step 2: Details
  programIds: string[];
  category: string;
  pricing: 'free' | 'paid';
  price: number;
  isPublic: boolean;
}

const DEFAULT_WIZARD_DATA: ArticleWizardData = {
  title: '',
  coverImage: '',
  authorId: null,
  authorName: '',
  programIds: [],
  category: '',
  pricing: 'free',
  price: 0,
  isPublic: true,
};

interface CreateArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onArticleCreated: (articleId: string) => void;
  apiEndpoint?: string;
  programsApiEndpoint?: string;
  uploadEndpoint?: string;
  coachesApiEndpoint?: string;
  categoriesApiEndpoint?: string;
}

export function CreateArticleModal({
  isOpen,
  onClose,
  onArticleCreated,
  apiEndpoint = '/api/coach/org-discover/articles',
  programsApiEndpoint = '/api/coach/org-programs',
  uploadEndpoint = '/api/coach/org-upload-media',
  coachesApiEndpoint = '/api/coach/org-coaches',
  categoriesApiEndpoint = '/api/coach/org-article-categories',
}: CreateArticleModalProps) {
  const [step, setStep] = useState<WizardStep>('info');
  const [wizardData, setWizardData] = useState<ArticleWizardData>(DEFAULT_WIZARD_DATA);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const isMobile = useMediaQuery('(max-width: 768px)');

  // Track if this is the initial mount to skip animation on first open
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isOpen) {
      isInitialMount.current = true;
      const timer = setTimeout(() => {
        isInitialMount.current = false;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Smooth fade animation variants
  const fadeVariants = {
    initial: {
      opacity: 0,
      scale: 0.98,
    },
    animate: {
      opacity: 1,
      scale: 1,
    },
    exit: {
      opacity: 0,
      scale: 0.98,
    },
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('info');
      setWizardData(DEFAULT_WIZARD_DATA);
      setIsCreating(false);
      setCreateError(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
  };

  const updateWizardData = useCallback((updates: Partial<ArticleWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  }, []);

  const goToNextStep = () => {
    if (step === 'info') {
      setStep('details');
    }
  };

  const goToPreviousStep = () => {
    if (step === 'details') {
      setStep('info');
    }
  };

  const handleCreateArticle = async () => {
    setIsCreating(true);
    setCreateError(null);

    try {
      const articleData = {
        title: wizardData.title,
        coverImageUrl: wizardData.coverImage,
        authorId: wizardData.authorId,
        authorName: wizardData.authorName,
        authorTitle: '',
        content: '', // Empty content - will be edited in full-page editor
        programIds: wizardData.programIds,
        category: wizardData.category || null,
        priceInCents: wizardData.pricing === 'paid' ? wizardData.price * 100 : null,
        isPublic: wizardData.isPublic,
        purchaseType: wizardData.pricing === 'paid' ? 'one_time' : 'free',
        publishedAt: new Date().toISOString(),
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articleData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create article');
      }

      const data = await response.json();
      const articleId = data.id;

      handleClose();
      onArticleCreated(articleId);
    } catch (error) {
      console.error('Error creating article:', error);
      setCreateError(error instanceof Error ? error.message : 'Failed to create article');
    } finally {
      setIsCreating(false);
    }
  };

  // Get step index for progress indicator
  const getStepIndex = () => {
    const steps: WizardStep[] = ['info', 'details'];
    return steps.indexOf(step);
  };

  // Validation for each step
  const canProceed = () => {
    switch (step) {
      case 'info':
        return (
          wizardData.title.trim().length > 0 &&
          wizardData.coverImage.length > 0 &&
          wizardData.authorId !== null
        );
      case 'details':
        return true; // All fields optional in step 2
      default:
        return false;
    }
  };

  // Wizard content (shared between Dialog and Drawer)
  const wizardContent = (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center gap-3">
          {step !== 'info' && (
            <button
              onClick={goToPreviousStep}
              className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
              {step === 'info' && 'New Article'}
              {step === 'details' && 'Details'}
            </h2>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">
          {step === 'info' && (
            <motion.div
              key="info"
              variants={fadeVariants}
              initial={isInitialMount.current ? false : "initial"}
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <InfoStep
                data={wizardData}
                onChange={updateWizardData}
                uploadEndpoint={uploadEndpoint}
                coachesApiEndpoint={coachesApiEndpoint}
              />
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <DetailsStep
                data={wizardData}
                onChange={updateWizardData}
                error={createError}
                programsApiEndpoint={programsApiEndpoint}
                categoriesApiEndpoint={categoriesApiEndpoint}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center justify-between">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= getStepIndex()
                    ? 'bg-brand-accent'
                    : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                }`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <button
            onClick={step === 'details' ? handleCreateArticle : goToNextStep}
            disabled={!canProceed() || isCreating}
            className="flex items-center gap-2 px-5 py-2 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : step === 'details' ? (
              <>
                Create Article
                <Sparkles className="w-4 h-4" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render mobile drawer or desktop dialog
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DrawerContent className="max-h-[90vh]">
          {wizardContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={handleClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all">
                {wizardContent}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// ============================================================================
// STEP 1: Article Info
// ============================================================================
interface InfoStepProps {
  data: ArticleWizardData;
  onChange: (updates: Partial<ArticleWizardData>) => void;
  uploadEndpoint: string;
  coachesApiEndpoint: string;
}

function InfoStep({
  data,
  onChange,
  uploadEndpoint,
  coachesApiEndpoint,
}: InfoStepProps) {
  return (
    <div className="space-y-4">
      {/* Article Title */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder='e.g., "10 Tips for Better Sleep"'
          className="w-full px-3 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors text-sm"
        />
      </div>

      {/* Cover Image */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
          Cover Image <span className="text-red-500">*</span>
        </label>
        <MediaUpload
          value={data.coverImage}
          onChange={(url) => onChange({ coverImage: url })}
          folder="articles"
          type="image"
          uploadEndpoint={uploadEndpoint}
          hideLabel
          aspectRatio="16:9"
        />
      </div>

      {/* Author */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
          Author <span className="text-red-500">*</span>
        </label>
        <AuthorSelector
          value={data.authorId}
          onChange={({ authorId, authorName }) =>
            onChange({ authorId, authorName })
          }
          placeholder="Select author..."
          coachesApiEndpoint={coachesApiEndpoint}
        />
      </div>
    </div>
  );
}

// ============================================================================
// STEP 2: Details (Programs, Category, Pricing)
// ============================================================================
interface DetailsStepProps {
  data: ArticleWizardData;
  onChange: (updates: Partial<ArticleWizardData>) => void;
  error: string | null;
  programsApiEndpoint: string;
  categoriesApiEndpoint: string;
}

function DetailsStep({ data, onChange, error, programsApiEndpoint, categoriesApiEndpoint }: DetailsStepProps) {
  return (
    <div className="space-y-5">
      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
          Category
          <span className="text-[#8c8a87] dark:text-[#8b8f9a] font-normal ml-1.5">(optional)</span>
        </label>
        <CategorySelector
          value={data.category}
          onChange={(category) => onChange({ category })}
          placeholder="Select or create category..."
          categoriesApiEndpoint={categoriesApiEndpoint}
        />
      </div>

      {/* Programs */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
          Link to Programs
          <span className="text-[#8c8a87] dark:text-[#8b8f9a] font-normal ml-1.5">(optional)</span>
        </label>
        <ProgramSelector
          value={data.programIds}
          onChange={(programIds) => onChange({ programIds })}
          placeholder="Select programs..."
          programsApiEndpoint={programsApiEndpoint}
        />
      </div>

      {/* Pricing */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Pricing
        </label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={() => onChange({ pricing: 'free' })}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
              data.pricing === 'free'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <span className={`font-semibold text-sm ${data.pricing === 'free' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>
              Free
            </span>
          </button>
          <button
            onClick={() => onChange({ pricing: 'paid' })}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
              data.pricing === 'paid'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <DollarSign className={`w-4 h-4 ${data.pricing === 'paid' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className={`font-semibold text-sm ${data.pricing === 'paid' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>
              Paid
            </span>
          </button>
        </div>

        {/* Price Input */}
        {data.pricing === 'paid' && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm">$</span>
            <input
              type="number"
              value={data.price || ''}
              onChange={(e) => onChange({ price: Math.max(0, parseInt(e.target.value) || 0) })}
              placeholder="0"
              className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors text-sm"
            />
          </div>
        )}
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Visibility
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onChange({ isPublic: true })}
            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
              data.isPublic
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <Globe className={`w-4 h-4 ${data.isPublic ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className={`font-albert font-medium text-sm ${data.isPublic ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>Public</span>
          </button>
          <button
            onClick={() => onChange({ isPublic: false })}
            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
              !data.isPublic
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <Lock className={`w-4 h-4 ${!data.isPublic ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className={`font-albert font-medium text-sm ${!data.isPublic ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>Private</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
        </div>
      )}
    </div>
  );
}
