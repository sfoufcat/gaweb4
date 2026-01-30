'use client';

import React, { useState, useEffect, Fragment, useRef, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  PhoneIncoming,
  Layers,
  FileText,
  BookOpen,
  Calendar,
  Download,
  Link as LinkIcon,
  Plus,
  Clock,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/drawer';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { NewProgramModal } from '../programs/NewProgramModal';
import { IntakeConfigWizard } from '../intake/IntakeConfigWizard';
import { IntakeConfigActions } from '../intake/IntakeConfigActions';
import type { Program, FunnelTargetType, FunnelContentType, IntakeCallConfig } from '@/types';

interface ContentItem {
  id: string;
  title: string;
}

interface IntakeConfig {
  id: string;
  name: string;
  duration?: number;
}

interface FunnelWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  programs: Program[];
  initialTargetType?: FunnelTargetType;
  initialContentType?: FunnelContentType;
  onSaved: () => void;
  onRefreshPrograms?: () => Promise<void>;
}

type WizardStep = 'type' | 'target' | 'details';

const FUNNEL_TYPES = [
  {
    value: 'intake' as FunnelTargetType,
    label: 'Intake Call',
    description: 'Schedule calls with prospects',
    sublabel: 'Qualify leads before they become clients',
    icon: PhoneIncoming,
    color: 'bg-teal-100 dark:bg-teal-900/30',
    iconColor: 'text-teal-600 dark:text-teal-400',
  },
  {
    value: 'program' as FunnelTargetType,
    label: 'Program',
    description: 'Enroll users in a program',
    sublabel: 'Sell or provide access to coaching',
    icon: Layers,
    color: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
  },
  {
    value: 'content' as FunnelTargetType,
    label: 'Resource',
    description: 'Gate access to content',
    sublabel: 'Sell articles, courses, downloads',
    icon: FileText,
    color: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
];

const CONTENT_TYPES: { value: FunnelContentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'course', label: 'Course', icon: BookOpen },
  { value: 'article', label: 'Article', icon: FileText },
  { value: 'event', label: 'Event', icon: Calendar },
  { value: 'download', label: 'Download', icon: Download },
  { value: 'link', label: 'Link', icon: LinkIcon },
];

export function FunnelWizardModal({
  isOpen,
  onClose,
  programs,
  initialTargetType,
  initialContentType,
  onSaved,
  onRefreshPrograms,
}: FunnelWizardModalProps) {
  const [step, setStep] = useState<WizardStep>('type');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Track initial mount to skip animation on first open
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

  // Step 1: Type Selection
  const [targetType, setTargetType] = useState<FunnelTargetType>(initialTargetType || 'intake');

  // Step 2: Target Selection
  const [intakeConfigId, setIntakeConfigId] = useState('');
  const [programId, setProgramId] = useState('');
  const [contentType, setContentType] = useState<FunnelContentType>(initialContentType || 'course');
  const [contentId, setContentId] = useState('');

  // Step 3: Details
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [accessType, setAccessType] = useState<'public' | 'invite_only'>('public');
  const [isDefault, setIsDefault] = useState(false);

  // Data fetching states
  const [intakeConfigs, setIntakeConfigs] = useState<IntakeConfig[]>([]);
  const [isLoadingIntakeConfigs, setIsLoadingIntakeConfigs] = useState(false);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Nested modals
  const [showProgramWizard, setShowProgramWizard] = useState(false);
  const [showIntakeConfigEditor, setShowIntakeConfigEditor] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('type');
      setError(null);
      setTargetType(initialTargetType || 'intake');
      setIntakeConfigId('');
      setProgramId('');
      setContentType(initialContentType || 'course');
      setContentId('');
      setName('');
      setSlug('');
      setDescription('');
      setAccessType('public');
      setIsDefault(false);
    }
  }, [isOpen, initialTargetType, initialContentType]);

  // Fetch intake configs
  const fetchIntakeConfigs = useCallback(async () => {
    setIsLoadingIntakeConfigs(true);
    try {
      const response = await fetch('/api/coach/intake-configs');
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch intake configs:', data);
        setIntakeConfigs([]);
        return;
      }

      // Filter to only show active configs
      const configs = data.configs
        ?.filter((c: { isActive?: boolean }) => c.isActive !== false)
        .map((c: { id: string; name: string; duration?: number }) => ({
          id: c.id,
          name: c.name,
          duration: c.duration,
        })) || [];

      console.log('[FunnelWizard] Loaded intake configs:', configs.length);
      setIntakeConfigs(configs);
    } catch (err) {
      console.error('Failed to fetch intake configs:', err);
      setIntakeConfigs([]);
    } finally {
      setIsLoadingIntakeConfigs(false);
    }
  }, []);

  // Fetch content items
  const fetchContentItems = useCallback(async (type: FunnelContentType) => {
    setIsLoadingContent(true);
    try {
      const endpointMap: Record<FunnelContentType, string> = {
        article: '/api/coach/org-discover/articles',
        course: '/api/coach/org-discover/courses',
        event: '/api/coach/org-discover/events',
        download: '/api/coach/org-discover/downloads',
        link: '/api/coach/org-discover/links',
        video: '/api/coach/org-discover/videos',
      };

      const response = await fetch(endpointMap[type]);
      if (!response.ok) throw new Error('Failed to fetch content');
      const data = await response.json();

      let items: ContentItem[] = [];
      if (data.articles) items = data.articles.map((a: { id: string; title: string }) => ({ id: a.id, title: a.title }));
      else if (data.courses) items = data.courses.map((c: { id: string; title: string }) => ({ id: c.id, title: c.title }));
      else if (data.events) items = data.events.map((e: { id: string; title: string }) => ({ id: e.id, title: e.title }));
      else if (data.downloads) items = data.downloads.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title }));
      else if (data.links) items = data.links.map((l: { id: string; title: string }) => ({ id: l.id, title: l.title }));
      else if (data.videos) items = data.videos.map((v: { id: string; title: string }) => ({ id: v.id, title: v.title }));

      setContentItems(items);
    } catch (err) {
      console.error('Failed to fetch content items:', err);
      setContentItems([]);
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  // Fetch data when target type changes
  useEffect(() => {
    if (targetType === 'intake') {
      fetchIntakeConfigs();
    } else if (targetType === 'content') {
      fetchContentItems(contentType);
    }
  }, [targetType, contentType, fetchIntakeConfigs, fetchContentItems]);

  // Animation variants
  const fadeVariants = {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  };

  // Auto-generate slug from name
  const handleNameChange = (newName: string) => {
    setName(newName);
    const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setSlug(newSlug);
  };

  // Get step index for progress dots
  const getStepIndex = () => {
    const steps: WizardStep[] = ['type', 'target', 'details'];
    return steps.indexOf(step);
  };

  // Step validation
  const validateStep = (currentStep: WizardStep): boolean => {
    setError(null);

    if (currentStep === 'type') {
      return true; // Always valid, just a selection
    }

    if (currentStep === 'target') {
      if (targetType === 'intake' && !intakeConfigId) {
        setError('Please select an intake call configuration');
        return false;
      }
      if (targetType === 'program' && !programId) {
        setError('Please select a program');
        return false;
      }
      if (targetType === 'content' && !contentId) {
        setError('Please select a content item');
        return false;
      }
      return true;
    }

    if (currentStep === 'details') {
      if (!name.trim()) {
        setError('Please enter a funnel name');
        return false;
      }
      if (!slug.trim()) {
        setError('Please enter a URL slug');
        return false;
      }
      return true;
    }

    return true;
  };

  // Navigation
  const goToNextStep = () => {
    if (!validateStep(step)) return;
    if (step === 'type') setStep('target');
    else if (step === 'target') setStep('details');
  };

  const goToPrevStep = () => {
    setError(null);
    if (step === 'target') setStep('type');
    else if (step === 'details') setStep('target');
  };

  // Submit
  const handleSubmit = async () => {
    if (!validateStep('details')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim(),
        targetType,
        description: description.trim() || undefined,
        accessType,
        isDefault,
      };

      if (targetType === 'intake') {
        payload.intakeConfigId = intakeConfigId;
      } else if (targetType === 'program') {
        payload.programId = programId;
      } else if (targetType === 'content') {
        payload.contentType = contentType;
        payload.contentId = contentId;
      }

      const response = await fetch('/api/coach/org-funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create funnel');
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create funnel');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get URL preview
  const getUrlPreview = () => {
    if (!slug) return '';

    if (targetType === 'intake') {
      return `/book/${slug}`;
    } else if (targetType === 'program') {
      const program = programs.find(p => p.id === programId);
      if (program?.slug) {
        return `/join/${program.slug}/${slug}`;
      }
      return `/join/program/${slug}`;
    } else if (targetType === 'content') {
      return `/join/content/${contentType}/.../` + slug;
    }
    return `/${slug}`;
  };

  // Step titles
  const getStepTitle = () => {
    if (step === 'type') return 'What kind of funnel?';
    if (step === 'target') {
      if (targetType === 'intake') return 'Select intake call';
      if (targetType === 'program') return 'Select program';
      if (targetType === 'content') return 'Select resource';
    }
    return 'Funnel details';
  };

  const getStepSubtitle = () => {
    if (step === 'type') return 'Choose the type of funnel to create';
    if (step === 'target') {
      if (targetType === 'intake') return 'Which intake call should this funnel use?';
      if (targetType === 'program') return 'Which program will users enroll in?';
      if (targetType === 'content') return 'Which resource are you gating?';
    }
    return 'Give your funnel a name and configure access';
  };

  const wizardContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'type' && (
              <button
                type="button"
                onClick={goToPrevStep}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {getStepTitle()}
              </h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                {getStepSubtitle()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-6">
        {error && (
          <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-600 dark:text-red-400 text-sm font-albert">{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Type Selection */}
          {step === 'type' && (
            <motion.div
              key="type"
              variants={fadeVariants}
              initial={isInitialMount.current ? false : 'initial'}
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-3"
            >
              {FUNNEL_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = targetType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setTargetType(type.value)}
                    className={`group relative w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                      isSelected
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${type.color}`}>
                      <Icon className={`w-6 h-6 ${type.iconColor}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 text-left">
                      <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {type.label}
                      </h3>
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        {type.sublabel}
                      </p>
                    </div>

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}

          {/* Step 2: Target Selection */}
          {step === 'target' && (
            <motion.div
              key="target"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-5"
            >
              {/* Intake Config Selector */}
              {targetType === 'intake' && (
                <div>
                  {isLoadingIntakeConfigs ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
                    </div>
                  ) : intakeConfigs.length === 0 ? (
                    <div className="text-center py-8">
                      <PhoneIncoming className="w-12 h-12 text-[#a7a39e] dark:text-[#7d8190] mx-auto mb-3" />
                      <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-4 font-albert">
                        No intake calls configured yet
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowIntakeConfigEditor(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create Intake Call
                      </button>
                    </div>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                        Intake Call <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {intakeConfigs.map((config) => {
                          const isSelected = intakeConfigId === config.id;
                          return (
                            <button
                              key={config.id}
                              type="button"
                              onClick={() => setIntakeConfigId(config.id)}
                              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                isSelected
                                  ? 'border-brand-accent bg-brand-accent/5'
                                  : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                              }`}
                            >
                              <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                                {config.name}
                              </span>
                              <div className="flex items-center gap-3">
                                {config.duration && (
                                  <span className="flex items-center gap-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                                    <Clock className="w-3 h-3" />
                                    {config.duration} min
                                  </span>
                                )}
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                                <IntakeConfigActions
                                  config={config as IntakeCallConfig}
                                  size="sm"
                                  onUpdate={() => fetchIntakeConfigs()}
                                  onDelete={() => {
                                    fetchIntakeConfigs();
                                    if (intakeConfigId === config.id) {
                                      setIntakeConfigId('');
                                    }
                                  }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowIntakeConfigEditor(true)}
                        className="mt-3 flex items-center gap-2 text-sm text-brand-accent hover:text-brand-accent/80 font-medium font-albert transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create new intake call
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Program Selector */}
              {targetType === 'program' && (
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    Program <span className="text-red-500">*</span>
                  </label>
                  {programs.length === 0 ? (
                    <div className="text-center py-8">
                      <Layers className="w-12 h-12 text-[#a7a39e] dark:text-[#7d8190] mx-auto mb-3" />
                      <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-4 font-albert">
                        No programs created yet
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowProgramWizard(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create Program
                      </button>
                    </div>
                  ) : (
                    <>
                      <Select value={programId} onValueChange={setProgramId}>
                        <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                          <SelectValue placeholder="Select a program..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg">
                          {programs.map((program) => (
                            <SelectItem
                              key={program.id}
                              value={program.id}
                              className="cursor-pointer font-albert pl-3"
                            >
                              {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => setShowProgramWizard(true)}
                        className="mt-3 flex items-center gap-2 text-sm text-brand-accent hover:text-brand-accent/80 font-medium font-albert transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create new program
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Content Selector */}
              {targetType === 'content' && (
                <div className="space-y-5">
                  {/* Content Type Pills */}
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                      Content Type
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CONTENT_TYPES.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setContentType(value);
                            setContentId(''); // Reset selection when type changes
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            contentType === value
                              ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/30'
                              : 'bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:border-brand-accent/50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content Item Selector */}
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                      Select {contentType.charAt(0).toUpperCase() + contentType.slice(1)} <span className="text-red-500">*</span>
                    </label>
                    {isLoadingContent ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
                      </div>
                    ) : contentItems.length === 0 ? (
                      <div className="text-center py-6 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl">
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          No {contentType}s found. Create one first in the Discover section.
                        </p>
                      </div>
                    ) : (
                      <Select value={contentId} onValueChange={setContentId}>
                        <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent">
                          <SelectValue placeholder={`Select a ${contentType}...`} />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg">
                          {contentItems.map((item) => (
                            <SelectItem
                              key={item.id}
                              value={item.id}
                              className="cursor-pointer font-albert pl-3"
                            >
                              {item.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3: Details */}
          {step === 'details' && (
            <motion.div
              key="details"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-5"
            >
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Funnel Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Discovery Call, Free Trial"
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus-within:ring-2 focus-within:ring-brand-accent focus-within:border-transparent overflow-hidden">
                  <span className="pl-4 pr-1 py-3 text-[#a7a39e] dark:text-[#7d8190] font-albert text-sm whitespace-nowrap select-none">
                    {targetType === 'intake' ? '/book/' : targetType === 'program' ? `/join/${programs.find(p => p.id === programId)?.slug || 'program'}/` : `/join/${contentType}/`}
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="your-slug"
                    className="flex-1 px-1 py-3 bg-transparent text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#c4c0bb] dark:placeholder:text-[#4a4f5c] focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  Description <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Internal notes about this funnel"
                  rows={2}
                  className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
                />
              </div>

              {/* Access Type */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                  Access
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAccessType('public')}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      accessType === 'public'
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                    }`}
                  >
                    <span className="block font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Public
                    </span>
                    <span className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                      Anyone with link
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessType('invite_only')}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      accessType === 'invite_only'
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                    }`}
                  >
                    <span className="block font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Invite Only
                    </span>
                    <span className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                      Requires invite code
                    </span>
                  </button>
                </div>
              </div>

              {/* Default Toggle */}
              <div className="flex items-center gap-3">
                <BrandedCheckbox
                  id="isDefault"
                  checked={isDefault}
                  onChange={(checked) => setIsDefault(checked)}
                />
                <label htmlFor="isDefault" className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer">
                  Set as default funnel for this {targetType === 'content' ? contentType : targetType}
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center justify-between">
          {/* Progress Indicator - 3 dots */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
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

          {/* Action Button */}
          {step === 'details' ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Creating...' : 'Create Funnel'}
            </button>
          ) : (
            <button
              type="button"
              onClick={goToNextStep}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Nested Modals */}
      {showProgramWizard && (
        <NewProgramModal
          isOpen={showProgramWizard}
          onClose={() => setShowProgramWizard(false)}
          onCreateFromScratch={() => {
            setShowProgramWizard(false);
            onClose(); // Close funnel dialog so user can create the program
          }}
          onProgramCreated={async (programId: string) => {
            setShowProgramWizard(false);
            if (onRefreshPrograms) {
              await onRefreshPrograms();
            }
            // Auto-select the new program
            setProgramId(programId);
          }}
        />
      )}

      {/* Intake Config Wizard */}
      {showIntakeConfigEditor && (
        <IntakeConfigWizard
          isOpen={showIntakeConfigEditor}
          onClose={() => setShowIntakeConfigEditor(false)}
          onSuccess={async (config: IntakeCallConfig) => {
            setShowIntakeConfigEditor(false);
            await fetchIntakeConfigs();
            // Auto-select the new config
            setIntakeConfigId(config.id);
          }}
        />
      )}
    </div>
  );

  // Render mobile drawer or desktop dialog
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-[90vh] max-h-[90vh] flex flex-col">
          <VisuallyHidden>
            <DrawerTitle>Create Funnel</DrawerTitle>
          </VisuallyHidden>
          {wizardContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[10000]" onClose={onClose}>
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
          <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 z-[10001] overflow-hidden">
          <div className="flex h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg max-h-[85vh] transform rounded-2xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all flex flex-col overflow-hidden">
                {wizardContent}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
