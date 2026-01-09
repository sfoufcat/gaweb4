'use client';

import { useState } from 'react';
import { Trash2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { QuestionOptionEditor } from './QuestionOptionEditor';
import { SkipLogicEditor } from './SkipLogicEditor';
import type {
  QuestionnaireQuestion,
  QuestionnaireQuestionType,
  QuestionnaireOption,
} from '@/types/questionnaire';
import { getQuestionTypeInfo, QUESTION_TYPES } from '@/types/questionnaire';

interface QuestionEditorProps {
  question: QuestionnaireQuestion;
  onUpdate: (updates: Partial<QuestionnaireQuestion>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  allQuestions: QuestionnaireQuestion[];
}

export function QuestionEditor({
  question,
  onUpdate,
  onDelete,
  onDuplicate,
  allQuestions,
}: QuestionEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const [showSkipLogic, setShowSkipLogic] = useState(
    (question.skipLogic?.length || 0) > 0
  );

  const typeInfo = getQuestionTypeInfo(question.type);

  // Handle type change
  const handleTypeChange = (newType: QuestionnaireQuestionType) => {
    const updates: Partial<QuestionnaireQuestion> = { type: newType };

    // Reset type-specific fields
    if (newType === 'single_choice' || newType === 'multi_choice') {
      if (!question.options?.length) {
        updates.options = [
          { id: crypto.randomUUID(), label: 'Option 1', value: 'option_1', order: 0 },
          { id: crypto.randomUUID(), label: 'Option 2', value: 'option_2', order: 1 },
        ];
      }
    } else if (newType === 'scale') {
      updates.minValue = question.minValue ?? 1;
      updates.maxValue = question.maxValue ?? 5;
      updates.scaleLabels = question.scaleLabels ?? { min: 'Low', max: 'High' };
    }

    onUpdate(updates);
  };

  // Render type-specific configuration
  const renderTypeConfig = () => {
    switch (question.type) {
      case 'single_choice':
      case 'multi_choice':
        return (
          <QuestionOptionEditor
            options={question.options || []}
            onChange={options => onUpdate({ options })}
            allowImages
          />
        );

      case 'short_text':
      case 'long_text':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                Placeholder
              </label>
              <input
                type="text"
                value={question.placeholder || ''}
                onChange={e => onUpdate({ placeholder: e.target.value })}
                placeholder="Enter placeholder text..."
                className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Min Length
                </label>
                <input
                  type="number"
                  value={question.minLength || ''}
                  onChange={e =>
                    onUpdate({ minLength: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  placeholder="0"
                  min={0}
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Max Length
                </label>
                <input
                  type="number"
                  value={question.maxLength || ''}
                  onChange={e =>
                    onUpdate({ maxLength: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  placeholder={question.type === 'short_text' ? '500' : '5000'}
                  min={1}
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                Placeholder
              </label>
              <input
                type="text"
                value={question.placeholder || ''}
                onChange={e => onUpdate({ placeholder: e.target.value })}
                placeholder="Enter a number"
                className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Min Value
                </label>
                <input
                  type="number"
                  value={question.minValue ?? ''}
                  onChange={e =>
                    onUpdate({ minValue: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                  placeholder="No min"
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Max Value
                </label>
                <input
                  type="number"
                  value={question.maxValue ?? ''}
                  onChange={e =>
                    onUpdate({ maxValue: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                  placeholder="No max"
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
            </div>
          </div>
        );

      case 'scale':
        return (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Min Value
                </label>
                <input
                  type="number"
                  value={question.minValue ?? 1}
                  onChange={e => onUpdate({ minValue: parseInt(e.target.value) || 1 })}
                  min={0}
                  max={9}
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Max Value
                </label>
                <input
                  type="number"
                  value={question.maxValue ?? 5}
                  onChange={e => onUpdate({ maxValue: parseInt(e.target.value) || 5 })}
                  min={2}
                  max={10}
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Low Label
                </label>
                <input
                  type="text"
                  value={question.scaleLabels?.min || ''}
                  onChange={e =>
                    onUpdate({
                      scaleLabels: { ...question.scaleLabels, min: e.target.value, max: question.scaleLabels?.max || '' },
                    })
                  }
                  placeholder="e.g., Not satisfied"
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  High Label
                </label>
                <input
                  type="text"
                  value={question.scaleLabels?.max || ''}
                  onChange={e =>
                    onUpdate({
                      scaleLabels: { min: question.scaleLabels?.min || '', max: e.target.value },
                    })
                  }
                  placeholder="e.g., Very satisfied"
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                />
              </div>
            </div>
            {/* Scale Preview */}
            <div className="mt-2">
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-2 font-albert">Preview</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  {question.scaleLabels?.min || 'Low'}
                </span>
                <div className="flex gap-2">
                  {Array.from(
                    { length: (question.maxValue ?? 5) - (question.minValue ?? 1) + 1 },
                    (_, i) => (question.minValue ?? 1) + i
                  ).map(num => (
                    <div
                      key={num}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e1ddd8] dark:border-[#262b35] text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2]"
                    >
                      {num}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  {question.scaleLabels?.max || 'High'}
                </span>
              </div>
            </div>
          </div>
        );

      case 'file_upload':
      case 'media_upload':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                Accepted File Types
              </label>
              <select
                value={question.acceptedFileTypes?.join(',') || '*/*'}
                onChange={e => {
                  const value = e.target.value;
                  onUpdate({
                    acceptedFileTypes: value === '*/*' ? ['*/*'] : value.split(','),
                  });
                }}
                className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
              >
                {question.type === 'media_upload' ? (
                  <>
                    <option value="image/*,video/*">Images & Videos</option>
                    <option value="image/*">Images only</option>
                    <option value="video/*">Videos only</option>
                  </>
                ) : (
                  <>
                    <option value="*/*">All files</option>
                    <option value="application/pdf">PDF only</option>
                    <option value="image/*">Images only</option>
                    <option value="application/pdf,image/*">PDF & Images</option>
                    <option value=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                      Word Documents
                    </option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                Max File Size (MB)
              </label>
              <input
                type="number"
                value={question.maxFileSizeMB || 10}
                onChange={e => onUpdate({ maxFileSizeMB: parseInt(e.target.value) || 10 })}
                min={1}
                max={100}
                className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Question Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Question Title - Inline Editable */}
          <input
            type="text"
            value={question.title}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Type your question here..."
            className="w-full text-base font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert bg-transparent border-none outline-none placeholder-[#b2b6c2]"
          />

          {/* Description */}
          <input
            type="text"
            value={question.description || ''}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Add description (optional)"
            className="w-full mt-1 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert bg-transparent border-none outline-none placeholder-[#b2b6c2]"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            title="Duplicate"
          >
            <Copy className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="space-y-4 pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]/50">
          {/* Type & Required */}
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                Type
              </label>
              <select
                value={question.type}
                onChange={e => handleTypeChange(e.target.value as QuestionnaireQuestionType)}
                className="px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
              >
                {QUESTION_TYPES.map(type => (
                  <option key={type.type} value={type.type}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={question.required}
                onCheckedChange={checked => onUpdate({ required: checked })}
                id={`required-${question.id}`}
              />
              <label
                htmlFor={`required-${question.id}`}
                className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert cursor-pointer"
              >
                Required
              </label>
            </div>
          </div>

          {/* Type-specific configuration */}
          {renderTypeConfig()}

          {/* Skip Logic Toggle */}
          {(question.type === 'single_choice' || question.type === 'multi_choice') && (
            <div className="pt-2">
              <button
                onClick={() => setShowSkipLogic(!showSkipLogic)}
                className="text-sm text-brand-accent hover:underline font-albert"
              >
                {showSkipLogic ? 'Hide skip logic' : 'Add skip logic'}
              </button>

              {showSkipLogic && (
                <div className="mt-4">
                  <SkipLogicEditor
                    question={question}
                    allQuestions={allQuestions}
                    onUpdate={skipLogic => onUpdate({ skipLogic })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
