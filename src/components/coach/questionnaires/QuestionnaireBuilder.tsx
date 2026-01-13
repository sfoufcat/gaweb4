'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Reorder, useDragControls, motion, AnimatePresence } from 'framer-motion';
import { Plus, GripVertical, ArrowLeft, Settings, Copy, Check, Save, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
}

export function QuestionnaireBuilder({
  questionnaire,
  onSave,
  onBack,
  onPreview,
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
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges =
      title !== questionnaire.title ||
      description !== (questionnaire.description || '') ||
      JSON.stringify(questions) !== JSON.stringify(questionnaire.questions) ||
      isActive !== questionnaire.isActive ||
      allowMultipleResponses !== questionnaire.allowMultipleResponses;
    setHasUnsavedChanges(hasChanges);
  }, [title, description, questions, isActive, allowMultipleResponses, questionnaire]);

  // Auto-save debounced
  const debouncedSave = useCallback(
    (data: Partial<Questionnaire>) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await onSave(data);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } catch (error) {
          console.error('Error saving:', error);
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [onSave]
  );

  // Manual save
  const handleManualSave = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSaving(true);
    try {
      await onSave({
        title,
        description,
        questions,
        isActive,
        allowMultipleResponses,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  // Save when title changes
  useEffect(() => {
    if (title !== questionnaire.title) {
      debouncedSave({ title });
    }
  }, [title, questionnaire.title, debouncedSave]);

  // Save when description changes
  useEffect(() => {
    if (description !== (questionnaire.description || '')) {
      debouncedSave({ description });
    }
  }, [description, questionnaire.description, debouncedSave]);

  // Save when questions change
  useEffect(() => {
    if (JSON.stringify(questions) !== JSON.stringify(questionnaire.questions)) {
      debouncedSave({ questions });
    }
  }, [questions, questionnaire.questions, debouncedSave]);

  // Save when settings change
  useEffect(() => {
    if (isActive !== questionnaire.isActive) {
      debouncedSave({ isActive });
    }
  }, [isActive, questionnaire.isActive, debouncedSave]);

  useEffect(() => {
    if (allowMultipleResponses !== questionnaire.allowMultipleResponses) {
      debouncedSave({ allowMultipleResponses });
    }
  }, [allowMultipleResponses, questionnaire.allowMultipleResponses, debouncedSave]);

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
        <div className="max-w-4xl mx-auto px-6 py-4">
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
              {isActive ? 'Active' : 'Draft'}
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

              {/* Settings */}
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

              {/* Save button */}
              <button
                onClick={handleManualSave}
                disabled={saving || !hasUnsavedChanges}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium font-albert ml-1 ${
                  saving
                    ? 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                    : saved
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : hasUnsavedChanges
                    ? 'bg-brand-accent text-white hover:bg-brand-accent/90'
                    : 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                }`}
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Saving
                  </>
                ) : saved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
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

      {/* Settings Panel - Slide down */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-[#e1ddd8] dark:border-[#262b35]/50 bg-white dark:bg-[#171b22]"
          >
            <div className="max-w-4xl mx-auto px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Settings
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                >
                  <X className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Active
                    </h4>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                      When active, the questionnaire can receive responses
                    </p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Allow Multiple Responses
                    </h4>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                      Allow the same user to submit multiple times
                    </p>
                  </div>
                  <Switch
                    checked={allowMultipleResponses}
                    onCheckedChange={setAllowMultipleResponses}
                  />
                </div>
                <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]/50">
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Shareable Link:{' '}
                    <code className="bg-[#f3f1ef] dark:bg-[#262b35] px-2 py-0.5 rounded text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {typeof window !== 'undefined' ? window.location.origin : ''}/q/{questionnaire.slug}
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
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
      className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]/50 overflow-hidden"
    >
      <div className="flex items-start">
        {/* Drag Handle */}
        <div
          onPointerDown={e => dragControls.start(e)}
          className="p-4 cursor-grab active:cursor-grabbing hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <GripVertical className="w-5 h-5 text-[#b2b6c2] dark:text-[#5f5a55]" />
        </div>

        {/* Question Editor */}
        <div className="flex-1 py-4 pr-4">
          <QuestionEditor
            question={question}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            allQuestions={allQuestions}
          />
        </div>
      </div>
    </Reorder.Item>
  );
}
