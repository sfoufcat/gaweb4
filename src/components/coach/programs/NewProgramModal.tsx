'use client';

import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LayoutTemplate, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Folder } from 'lucide-react';
import { TemplateGallery } from './TemplateGallery';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { TemplateCustomizeForm } from './TemplateCustomizeForm';
import type { ProgramTemplate, TemplateDay } from '@/types';

export type NewProgramView = 'choice' | 'gallery' | 'preview' | 'customize' | 'scratch-config';

interface NewProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFromScratch: (options?: { numModules?: number }) => void;
  onProgramCreated: (programId: string) => void;
  demoMode?: boolean;
  onDemoCreate?: (program: { name: string; type: 'group' | 'individual'; duration: number }) => void;
}

export function NewProgramModal({ 
  isOpen, 
  onClose, 
  onCreateFromScratch,
  onProgramCreated,
  demoMode = false,
  onDemoCreate,
}: NewProgramModalProps) {
  const [view, setView] = useState<NewProgramView>('choice');
  const [selectedTemplate, setSelectedTemplate] = useState<ProgramTemplate | null>(null);
  const [templateDays, setTemplateDays] = useState<TemplateDay[]>([]);
  const [templateStats, setTemplateStats] = useState<{
    totalDays: number;
    totalTasks: number;
    totalHabits: number;
  } | null>(null);
  const [numModules, setNumModules] = useState(1);

  const handleClose = () => {
    // Reset state on close
    setView('choice');
    setSelectedTemplate(null);
    setTemplateDays([]);
    setTemplateStats(null);
    setNumModules(1);
    onClose();
  };

  const handleSelectTemplate = (template: ProgramTemplate) => {
    setSelectedTemplate(template);
    setView('preview');
  };

  const handlePreviewLoaded = (days: TemplateDay[], stats: { totalDays: number; totalTasks: number; totalHabits: number }) => {
    setTemplateDays(days);
    setTemplateStats(stats);
  };

  const handleUseTemplate = () => {
    setView('customize');
  };

  const handleBackToGallery = () => {
    setSelectedTemplate(null);
    setTemplateDays([]);
    setTemplateStats(null);
    setView('gallery');
  };

  const handleProgramCreated = (programId: string) => {
    handleClose();
    onProgramCreated(programId);
  };

  const handleFromScratch = () => {
    handleClose();
    onCreateFromScratch({ numModules });
  };

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
              <Dialog.Panel className={`w-full transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all ${
                view === 'choice' ? 'max-w-2xl' : 'max-w-5xl'
              }`}>
                {/* Header - Only show for choice view */}
                {view === 'choice' && (
                  <div className="relative px-8 pt-8 pb-2">
                    <button
                      onClick={handleClose}
                      className="absolute right-4 top-4 p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <Dialog.Title className="text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
                      Create New Program
                    </Dialog.Title>
                    <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                      Choose how you want to start
                    </p>
                  </div>
                )}

                {/* Content */}
                <AnimatePresence mode="wait">
                  {view === 'choice' && (
                    <motion.div
                      key="choice"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="p-8"
                    >
                      <StartingPointSelector 
                        onSelectTemplate={() => setView('gallery')}
                        onSelectScratch={() => setView('scratch-config')}
                      />
                    </motion.div>
                  )}

                  {view === 'gallery' && (
                    <motion.div
                      key="gallery"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <TemplateGallery 
                        onSelectTemplate={handleSelectTemplate}
                        onBack={() => setView('choice')}
                        onClose={handleClose}
                      />
                    </motion.div>
                  )}

                  {view === 'preview' && selectedTemplate && (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <TemplatePreviewModal 
                        template={selectedTemplate}
                        onUseTemplate={handleUseTemplate}
                        onBack={handleBackToGallery}
                        onClose={handleClose}
                        onLoaded={handlePreviewLoaded}
                      />
                    </motion.div>
                  )}

                  {view === 'customize' && selectedTemplate && (
                    <motion.div
                      key="customize"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <TemplateCustomizeForm 
                        template={selectedTemplate}
                        templateStats={templateStats}
                        onBack={() => setView('preview')}
                        onClose={handleClose}
                        onSuccess={handleProgramCreated}
                      />
                    </motion.div>
                  )}

                  {view === 'scratch-config' && (
                    <motion.div
                      key="scratch-config"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="p-8"
                    >
                      {/* Header */}
                      <div className="flex items-center gap-4 mb-6">
                        <button
                          onClick={() => setView('choice')}
                          className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                          <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            Program Structure
                          </h2>
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                            Configure how your program is organized
                          </p>
                        </div>
                        <button
                          onClick={handleClose}
                          className="ml-auto p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Module count selector */}
                      <div className="bg-[#faf8f6] dark:bg-[#1d222b] rounded-xl p-6 mb-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center flex-shrink-0">
                            <Folder className="w-6 h-6 text-brand-accent" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                              Number of Modules
                            </label>
                            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
                              Modules help organize your program into logical sections. Weeks will be distributed evenly across modules.
                            </p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setNumModules(prev => Math.max(1, prev - 1))}
                                disabled={numModules <= 1}
                                className="w-10 h-10 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:border-brand-accent transition-colors"
                              >
                                −
                              </button>
                              <div className="w-16 h-10 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] flex items-center justify-center">
                                <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">{numModules}</span>
                              </div>
                              <button
                                onClick={() => setNumModules(prev => Math.min(12, prev + 1))}
                                disabled={numModules >= 12}
                                className="w-10 h-10 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:border-brand-accent transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info note */}
                      <div className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6">
                        <p>💡 You can always add, remove, or reorganize modules later in the program editor.</p>
                      </div>

                      {/* Continue button */}
                      <div className="flex justify-end">
                        <button
                          onClick={handleFromScratch}
                          className="flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors"
                        >
                          Continue
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Starting Point Selector - Two large cards
interface StartingPointSelectorProps {
  onSelectTemplate: () => void;
  onSelectScratch: () => void;
}

function StartingPointSelector({ onSelectTemplate, onSelectScratch }: StartingPointSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* From Template Card */}
      <motion.button
        onClick={onSelectTemplate}
        className="group relative flex flex-col items-center text-center p-8 rounded-2xl border-2 border-[#e1ddd8] dark:border-[#262b35] bg-gradient-to-b from-white to-[#faf8f6] dark:from-[#1d222b] dark:to-[#171b22] hover:border-brand-accent dark:hover:border-brand-accent transition-all duration-300"
        whileHover={{ y: -4, boxShadow: '0 20px 40px -12px rgba(160, 120, 85, 0.2)' }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Recommended Badge */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-accent text-white text-xs font-medium">
            <Sparkles className="w-3 h-3" />
            Recommended
          </span>
        </div>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-accent/20 to-brand-accent/5 dark:from-[#b8896a]/20 dark:to-[#b8896a]/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
          <LayoutTemplate className="w-8 h-8 text-brand-accent" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Start from Template
        </h3>

        {/* Description */}
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-5">
          Choose from proven programs with pre-built content
        </p>

        {/* Benefits */}
        <ul className="space-y-2 text-left w-full">
          {[
            'Full curriculum ready to customize',
            'Tasks, habits, and daily prompts included',
            'Landing page content pre-written',
          ].map((benefit, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {/* Arrow */}
        <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="w-4 h-4 text-white" />
        </div>
      </motion.button>

      {/* From Scratch Card */}
      <motion.button
        onClick={onSelectScratch}
        className="group relative flex flex-col items-center text-center p-8 rounded-2xl border-2 border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-[#5f5a55] dark:hover:border-[#b2b6c2] transition-all duration-300"
        whileHover={{ y: -4, boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.1)' }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5f5a55]/10 to-transparent dark:from-[#b2b6c2]/10 flex items-center justify-center mb-5 mt-5 group-hover:scale-110 transition-transform duration-300">
          <Sparkles className="w-8 h-8 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Build from Scratch
        </h3>

        {/* Description */}
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-5">
          Create your own custom program from the ground up
        </p>

        {/* Benefits */}
        <ul className="space-y-2 text-left w-full">
          {[
            'Complete creative control',
            'Build your unique methodology',
            'Start with a blank canvas',
          ].map((benefit, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              <CheckCircle2 className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {/* Arrow */}
        <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-[#5f5a55] dark:bg-[#b2b6c2] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="w-4 h-4 text-white dark:text-[#1a1a1a]" />
        </div>
      </motion.button>
    </div>
  );
}

