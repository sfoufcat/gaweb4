'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface AISuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalStatement: string;
  aiReasoning: string;
  aiSuggestion: string;
  onUseSuggestion: () => void;
  onEditOriginal: () => void;
  onProceedAnyway: () => void;
}

export function AISuggestionModal({
  isOpen,
  onClose,
  originalStatement,
  aiReasoning,
  aiSuggestion,
  onUseSuggestion,
  onEditOriginal,
  onProceedAnyway,
}: AISuggestionModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-md" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-full sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-full sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-[402px] sm:max-w-2xl transform overflow-hidden bg-app-bg sm:rounded-[32px] text-left align-middle shadow-2xl transition-all">
                {/* Header */}
                <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-[#e1ddd8]/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Dialog.Title
                        as="h3"
                        className="font-albert text-3xl sm:text-4xl text-text-primary tracking-[-2px] leading-[1.2] mb-2"
                      >
                        Let&apos;s refine this
                      </Dialog.Title>
                      <p className="font-sans text-sm text-text-secondary leading-[1.4]">
                        Our AI noticed something about your statement
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="ml-4 w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-[#f3f1ef] rounded-full transition-all duration-200"
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 sm:px-8 py-6 space-y-6">
                  {/* Original Statement */}
                  <div>
                    <label className="block font-sans text-xs font-medium text-text-secondary mb-2">
                      Your statement:
                    </label>
                    <div className="bg-white/50 backdrop-blur-sm border border-[#e1ddd8]/50 rounded-2xl p-4">
                      <p className="font-sans text-xl text-text-primary tracking-[-0.5px] leading-[1.3]">
                        I am {originalStatement}
                      </p>
                    </div>
                  </div>

                  {/* AI Feedback */}
                  <div className="bg-gradient-to-br from-[#f3f1ef] to-white/50 backdrop-blur-sm border border-[#e1ddd8]/50 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-[#a07855] dark:bg-[#b8896a] flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-albert font-medium text-lg text-text-primary tracking-[-1px] leading-[1.3] mb-2">
                          ⚠️ Suggestion
                        </h4>
                        <p className="font-sans text-sm text-text-secondary leading-[1.5]">
                          {aiReasoning}
                        </p>
                      </div>
                    </div>
                    
                    {aiSuggestion && (
                      <div className="mt-4 pt-4 border-t border-[#e1ddd8]/30">
                        <p className="font-sans text-xs font-medium text-text-secondary mb-2">
                          Try this instead:
                        </p>
                        <p className="font-sans text-base font-medium text-[#a07855] dark:text-[#b8896a] leading-[1.4]">
                          &quot;I am {aiSuggestion}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 sm:px-8 pb-8 space-y-3">
                  <button
                    onClick={onEditOriginal}
                    className="w-full py-4 px-6 bg-button-primary text-white rounded-full font-sans font-bold text-base tracking-[-0.5px] leading-[1.4] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:shadow-[0px_8px_20px_0px_rgba(0,0,0,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    Edit my statement
                  </button>
                  
                  <button
                    onClick={onProceedAnyway}
                    className="w-full py-4 px-6 bg-white/80 backdrop-blur-sm text-button-primary rounded-full font-sans font-bold text-base tracking-[-0.5px] leading-[1.4] border border-[#e1ddd8]/50 hover:bg-white hover:border-[#e1ddd8] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                  >
                    Continue with my statement
                  </button>

                  {aiSuggestion && (
                    <button
                      onClick={onUseSuggestion}
                      className="w-full py-3 text-[#a07855] dark:text-[#b8896a] hover:text-[#8a6649] font-sans font-medium text-sm transition-colors duration-200"
                    >
                      Use AI suggestion instead
                    </button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
