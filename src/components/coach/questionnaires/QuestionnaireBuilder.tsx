'use client';

import { useState, useEffect, useRef } from 'react';
import { Reorder, useDragControls, motion, AnimatePresence } from 'framer-motion';
import { Plus, GripVertical, ArrowLeft, Settings, Copy, Check, Send, X, CheckCircle2, BarChart3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { QuestionEditor } from './QuestionEditor';
import { QuestionTypeSelector } from './QuestionTypeSelector';
import type {
  Questionnaire,
  QuestionnaireQuestion,
  QuestionnaireQuestionType,
} from '@/types/questionnaire';
import { createEmptyQuestion } from '@/types/questionnaire';

interface QuestionnaireBuilderProps {
  questionnaire: Questionnaire;
  onSave: (data: Partial<Questionnaire>) => Promise<void>;
  onBack: () => void;
  onPreview?: () => void;
  onViewResponses?: () => void;
  responseCount?: number;
}

export function QuestionnaireBuilder({
  questionnaire,
  onSave,
  onBack,
  onPreview,
  onViewResponses,
  responseCount = 0,
}: QuestionnaireBuilderProps) {
  const [title, setTitle] = useState(questionnaire.title);
  const [description, setDescription] = useState(questionnaire.description || '');
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>(
    questionnaire.questions || []
  );
  const [isActive, setIsActive] = useState(questionnaire.isActive);
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(
    questionnaire.allowMultipleResponses
  );
  const [programIds, setProgramIds] = useState<string[]>(questionnaire.programIds || []);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [justPublished, setJustPublished] = useState(false);

  // Track if questionnaire was already published when loaded
  const [wasActiveOnLoad] = useState(questionnaire.isActive);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges =
      title !== questionnaire.title ||
      description !== (questionnaire.description || '') ||
      JSON.stringify(questions) !== JSON.stringify(questionnaire.questions) ||
      isActive !== questionnaire.isActive ||
      allowMultipleResponses !== questionnaire.allowMultipleResponses ||
      JSON.stringify(programIds) !== JSON.stringify(questionnaire.programIds || []);
    setHasUnsavedChanges(hasChanges);
  }, [title, description, questions, isActive, allowMultipleResponses, programIds, questionnaire]);

  // Determine if this is a draft (not yet published)
  const isDraft = !isActive && !wasActiveOnLoad;

  // Manual save - saves all current state
  // For drafts, this acts as "Publish" and auto-activates
  const handleManualSave = async () => {
    setSaving(true);
    const isPublishing = isDraft;
    try {
      await onSave({
        title,
        description,
        questions,
        isActive: isPublishing ? true : isActive,
        allowMultipleResponses,
        programIds,
      });
      if (isPublishing) {
        setIsActive(true);
        setJustPublished(true);
        setTimeout(() => setJustPublished(false), 2000);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  // Add new question
  const handleAddQuestion = (type: QuestionnaireQuestionType) => {
    const newQuestion = createEmptyQuestion(type, questions.length);
    setQuestions([...questions, newQuestion]);
    setShowTypeSelector(false);
  };

  // Update question
  const handleUpdateQuestion = (questionId: string, updates: Partial<QuestionnaireQuestion>) => {
    setQuestions(prev =>
      prev.map(q => (q.id === questionId ? { ...q, ...updates } : q))
    );
  };

  // Delete question
  const handleDeleteQuestion = (questionId: string) => {
    setQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  // Reorder questions
  const handleReorder = (newOrder: QuestionnaireQuestion[]) => {
    // Update order values
    const reordered = newOrder.map((q, index) => ({ ...q, order: index }));
    setQuestions(reordered);
  };

  // Duplicate question
  const handleDuplicateQuestion = (question: QuestionnaireQuestion) => {
    const duplicated: QuestionnaireQuestion = {
      ...question,
      id: crypto.randomUUID(),
      title: `${question.title} (copy)`,
      order: questions.length,
    };
    setQuestions([...questions, duplicated]);
  };

  // Copy link
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/q/${questionnaire.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f8f6] dark:bg-[#11141b]">
      {/* Header - Redesigned */}
      <div className="sticky top-0 z-10 bg-[#f9f8f6]/95 dark:bg-[#11141b]/95 backdrop-blur-sm border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <div className="px-6 py-4">
          {/* Row 1: Back, Title, Status, Actions */}
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-lg hover:bg-[#e1ddd8]/50 dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>

            {/* Title input */}
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Untitled Questionnaire"
              className="flex-1 text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert bg-transparent border-none outline-none placeholder-[#b2b6c2] dark:placeholder-[#5f5a55]"
            />

            {/* Status badge */}
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                isActive
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
              }`}
            >
              {isActive ? 'Published' : 'Draft'}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-2">
              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg hover:bg-[#e1ddd8]/50 dark:hover:bg-[#262b35] transition-colors"
                title="Copy link"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                )}
              </button>

              {/* Stats / View Responses */}
              {onViewResponses && (
                <button
                  onClick={onViewResponses}
                  className="relative p-2 rounded-lg hover:bg-[#e1ddd8]/50 dark:hover:bg-[#262b35] transition-colors"
                  title="View responses"
                >
                  <BarChart3 className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                  {responseCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-medium bg-brand-accent text-white rounded-full">
                      {responseCount > 99 ? '99+' : responseCount}
                    </span>
                  )}
                </button>
              )}

              {/* Settings - only show button on mobile, desktop has sidebar */}
              {!isDesktop && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-colors ${
                    showSettings
                      ? 'bg-brand-accent text-white'
                      : 'hover:bg-[#e1ddd8]/50 dark:hover:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`}
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              {/* Save/Publish button */}
              <button
                onClick={handleManualSave}
                disabled={saving || !hasUnsavedChanges}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium font-albert ml-1 ${
                  saving
                    ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                    : justPublished
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : !hasUnsavedChanges
                    ? 'bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 text-[#5f5a55]/60 dark:text-[#b2b6c2]/60'
                    : 'bg-brand-accent text-white hover:bg-brand-accent/90'
                }`}
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {isDraft ? 'Publishing' : 'Saving'}
                  </>
                ) : justPublished ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Published!
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Saved
                  </>
                ) : isDraft ? (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Publish
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: Description */}
          <div className="mt-2 pl-10">
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a description (optional)"
              className="w-full text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert bg-transparent border-none outline-none placeholder-[#b2b6c2]/60 dark:placeholder-[#5f5a55]/60"
            />
          </div>
        </div>
      </div>

      {/* Settings Modal - Only for mobile, desktop uses sidebar */}
      {!isDesktop && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          isActive={isActive}
          setIsActive={setIsActive}
          wasActiveOnLoad={wasActiveOnLoad}
          allowMultipleResponses={allowMultipleResponses}
          setAllowMultipleResponses={setAllowMultipleResponses}
          programIds={programIds}
          setProgramIds={setProgramIds}
          shareableLink={typeof window !== 'undefined' ? `${window.location.origin}/q/${questionnaire.slug}` : `/q/${questionnaire.slug}`}
        />
      )}

      {/* Content with Desktop Sidebar */}
      <div className="flex items-start gap-6 p-6">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <div className={`${isDesktop ? 'max-w-4xl' : 'max-w-3xl'} mx-auto`}>
            {/* Questions */}
            <div className="space-y-4">
              {questions.length > 0 ? (
                <Reorder.Group
                  axis="y"
                  values={questions}
                  onReorder={handleReorder}
                  className="space-y-4"
                >
                  {questions.map(question => (
                    <QuestionItem
                      key={question.id}
                      question={question}
                      onUpdate={updates => handleUpdateQuestion(question.id, updates)}
                      onDelete={() => handleDeleteQuestion(question.id)}
                      onDuplicate={() => handleDuplicateQuestion(question)}
                      allQuestions={questions}
                    />
                  ))}
                </Reorder.Group>
              ) : (
                <div className="text-center py-12">
                  <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
                    No steps yet. Add your first step to get started.
                  </p>
                </div>
              )}

              {/* Add Step Button */}
              <AnimatePresence mode="wait">
                {showTypeSelector ? (
                  <QuestionTypeSelector
                    key="selector"
                    onSelect={handleAddQuestion}
                    onCancel={() => setShowTypeSelector(false)}
                  />
                ) : (
                  <motion.button
                    key="add-button"
                    ref={addButtonRef}
                    onClick={() => setShowTypeSelector(true)}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:border-brand-accent hover:bg-brand-accent/5 transition-colors text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent font-albert"
                  >
                    <Plus className="w-5 h-5" />
                    Add Step
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Desktop Sidebar */}
        {isDesktop && (
          <div className="w-80 flex-shrink-0 sticky top-24 self-start bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8]/60 dark:border-[#262b35]/40">
            <div className="p-5 space-y-5">
              {/* Published toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    Published
                  </h4>
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                    Allow responses
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <hr className="border-[#e1ddd8] dark:border-[#262b35]" />

              {/* Allow Multiple Responses toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    Multiple Responses
                  </h4>
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                    Same user can submit multiple times
                  </p>
                </div>
                <Switch checked={allowMultipleResponses} onCheckedChange={setAllowMultipleResponses} />
              </div>

              <hr className="border-[#e1ddd8] dark:border-[#262b35]" />

              {/* Program Association */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                  Programs
                </label>
                <ProgramSelector
                  value={programIds}
                  onChange={setProgramIds}
                  placeholder="Select programs..."
                  programsApiEndpoint="/api/coach/org-programs"
                />
              </div>

              <hr className="border-[#e1ddd8] dark:border-[#262b35]" />

              {/* Shareable Link */}
              <div>
                <p className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                  Shareable Link
                </p>
                <code className="block w-full bg-[#f3f1ef] dark:bg-[#262b35] px-3 py-2 rounded-lg text-xs text-[#1a1a1a] dark:text-[#f5f5f8] break-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/q/${questionnaire.slug}` : `/q/${questionnaire.slug}`}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Settings Modal Component - Mobile only (desktop uses sidebar)
function SettingsModal({
  isOpen,
  onClose,
  isActive,
  setIsActive,
  wasActiveOnLoad,
  allowMultipleResponses,
  setAllowMultipleResponses,
  programIds,
  setProgramIds,
  shareableLink,
}: {
  isOpen: boolean;
  onClose: () => void;
  isActive: boolean;
  setIsActive: (value: boolean) => void;
  wasActiveOnLoad: boolean;
  allowMultipleResponses: boolean;
  setAllowMultipleResponses: (value: boolean) => void;
  programIds: string[];
  setProgramIds: (value: string[]) => void;
  shareableLink: string;
}) {
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Settings
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Published toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Published
                </h4>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                  When published, the questionnaire can receive responses
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {/* Allow Multiple Responses toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Allow Multiple Responses
                </h4>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                  Allow the same user to submit multiple times
                </p>
              </div>
              <Switch checked={allowMultipleResponses} onCheckedChange={setAllowMultipleResponses} />
            </div>

            {/* Program Association */}
            <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]/50">
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
                Programs
              </label>
              <ProgramSelector
                value={programIds}
                onChange={setProgramIds}
                placeholder="Select programs for this questionnaire..."
                programsApiEndpoint="/api/coach/org-programs"
              />
            </div>

            {/* Shareable Link */}
            <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]/50">
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Shareable Link:{' '}
                <code className="bg-[#f3f1ef] dark:bg-[#262b35] px-2 py-0.5 rounded text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {shareableLink}
                </code>
              </p>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Question Item wrapper for Reorder
function QuestionItem({
  question,
  onUpdate,
  onDelete,
  onDuplicate,
  allQuestions,
}: {
  question: QuestionnaireQuestion;
  onUpdate: (updates: Partial<QuestionnaireQuestion>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  allQuestions: QuestionnaireQuestion[];
}) {
  const dragControls = useDragControls();

  // Page break has a special inline appearance
  if (question.type === 'page_break') {
    return (
      <Reorder.Item
        value={question}
        dragListener={false}
        dragControls={dragControls}
        className="group"
      >
        <div className="flex items-center gap-3 py-2">
          {/* Drag Handle */}
          <div
            onPointerDown={e => dragControls.start(e)}
            className="p-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-4 h-4 text-[#b2b6c2] dark:text-[#5f5a55]" />
          </div>

          {/* Page Break Line */}
          <div className="flex-1 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={question.title || ''}
                onChange={e => onUpdate({ title: e.target.value })}
                placeholder="New Page"
                className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] bg-transparent border-none outline-none text-center placeholder-[#b2b6c2] dark:placeholder-[#5f5a55] w-24"
              />
            </div>
            <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
          </div>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </Reorder.Item>
    );
  }

  return (
    <Reorder.Item
      value={question}
      dragListener={false}
      dragControls={dragControls}
      className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8]/60 dark:border-[#262b35]/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
    >
      <div className="p-4">
        {/* Header with drag handle */}
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <div
            onPointerDown={e => dragControls.start(e)}
            className="mt-1 cursor-grab active:cursor-grabbing opacity-40 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-5 h-5 text-[#b2b6c2] dark:text-[#5f5a55]" />
          </div>

          {/* Question Editor */}
          <div className="flex-1 min-w-0">
            <QuestionEditor
              question={question}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              allQuestions={allQuestions}
            />
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}
