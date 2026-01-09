'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { Plus, GripVertical, ArrowLeft, Settings, Eye, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

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
        } catch (error) {
          console.error('Error saving:', error);
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [onSave]
  );

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
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[#171b22] border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                }`}
              >
                {isActive ? 'Active' : 'Draft'}
              </span>
              {saving && (
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Saving...
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2]"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>

            {/* Preview */}
            {onPreview && (
              <button
                onClick={onPreview}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2]"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-albert ${
                showSettings
                  ? 'bg-brand-accent text-white'
                  : 'hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-t border-[#e1ddd8] dark:border-[#262b35]/50 bg-[#f9f8f6] dark:bg-[#11141b]">
            <div className="max-w-4xl mx-auto px-6 py-4 space-y-4">
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
              <div className="pt-2">
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Shareable Link:{' '}
                  <code className="bg-[#f3f1ef] dark:bg-[#262b35] px-2 py-0.5 rounded text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {window.location.origin}/q/{questionnaire.slug}
                  </code>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Title */}
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Untitled Questionnaire"
          className="w-full text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert bg-transparent border-none outline-none placeholder-[#b2b6c2] dark:placeholder-[#5f5a55]"
        />

        {/* Description */}
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Add a description (optional)"
          rows={2}
          className="w-full mt-4 text-[#5f5a55] dark:text-[#b2b6c2] font-albert bg-transparent border-none outline-none resize-none placeholder-[#b2b6c2] dark:placeholder-[#5f5a55]"
        />

        {/* Questions */}
        <div className="mt-8 space-y-4">
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
                No questions yet. Add your first question to get started.
              </p>
            </div>
          )}

          {/* Add Question Button */}
          {showTypeSelector ? (
            <QuestionTypeSelector
              onSelect={handleAddQuestion}
              onCancel={() => setShowTypeSelector(false)}
            />
          ) : (
            <button
              onClick={() => setShowTypeSelector(true)}
              className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:border-brand-accent hover:bg-brand-accent/5 transition-colors text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent font-albert"
            >
              <Plus className="w-5 h-5" />
              Add Question
            </button>
          )}
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
