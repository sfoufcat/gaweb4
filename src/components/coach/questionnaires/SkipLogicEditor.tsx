'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuestionnaireQuestion, SkipLogicRule } from '@/types/questionnaire';

interface SkipLogicEditorProps {
  question: QuestionnaireQuestion;
  allQuestions: QuestionnaireQuestion[];
  onUpdate: (skipLogic: SkipLogicRule[]) => void;
}

export function SkipLogicEditor({
  question,
  allQuestions,
  onUpdate,
}: SkipLogicEditorProps) {
  const skipLogic = question.skipLogic || [];
  const options = question.options || [];

  // Get questions that come after this one (for skip-to targets)
  const laterQuestions = allQuestions.filter(q => q.order > question.order);

  // Add new rule
  const handleAddRule = () => {
    const newRule: SkipLogicRule = {
      id: crypto.randomUUID(),
      conditionType: 'equals',
      conditionValue: options[0]?.value || '',
      skipToQuestionId: laterQuestions[0]?.id || null,
    };
    onUpdate([...skipLogic, newRule]);
  };

  // Update rule
  const handleUpdateRule = (ruleId: string, updates: Partial<SkipLogicRule>) => {
    onUpdate(
      skipLogic.map(rule => (rule.id === ruleId ? { ...rule, ...updates } : rule))
    );
  };

  // Delete rule
  const handleDeleteRule = (ruleId: string) => {
    onUpdate(skipLogic.filter(rule => rule.id !== ruleId));
  };

  if (options.length === 0) {
    return (
      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
        Add options to enable skip logic.
      </p>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-[#f9f8f6] dark:bg-[#11141b] rounded-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Skip Logic Rules
        </h4>
        <button
          onClick={handleAddRule}
          className="flex items-center gap-1 px-2 py-1 text-xs text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors font-albert"
        >
          <Plus className="w-3 h-3" />
          Add Rule
        </button>
      </div>

      {skipLogic.length === 0 ? (
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          No skip logic rules. Click &quot;Add Rule&quot; to create conditional navigation.
        </p>
      ) : (
        <div className="space-y-3">
          {skipLogic.map(rule => (
            <div
              key={rule.id}
              className="flex items-center gap-2 p-3 bg-white dark:bg-[#171b22] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]/50"
            >
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-nowrap">If answer</span>

              {/* Condition Type */}
              <Select
                value={rule.conditionType}
                onValueChange={value =>
                  handleUpdateRule(rule.id, {
                    conditionType: value as SkipLogicRule['conditionType'],
                  })
                }
              >
                <SelectTrigger className="w-auto px-2 py-1 h-auto text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">equals</SelectItem>
                  <SelectItem value="not_equals">does not equal</SelectItem>
                  <SelectItem value="contains">contains</SelectItem>
                </SelectContent>
              </Select>

              {/* Condition Value (Option) */}
              <Select
                value={rule.conditionValue}
                onValueChange={value =>
                  handleUpdateRule(rule.id, { conditionValue: value })
                }
              >
                <SelectTrigger className="flex-1 min-w-0 px-2 py-1 h-auto text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map(opt => (
                    <SelectItem key={opt.id} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-nowrap">skip to</span>

              {/* Skip To Question */}
              <Select
                value={rule.skipToQuestionId || 'end'}
                onValueChange={value =>
                  handleUpdateRule(rule.id, {
                    skipToQuestionId: value === 'end' ? null : value,
                  })
                }
              >
                <SelectTrigger className="flex-1 min-w-0 px-2 py-1 h-auto text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {laterQuestions.map(q => (
                    <SelectItem key={q.id} value={q.id}>
                      Q{q.order + 1}: {q.title || 'Untitled'}
                    </SelectItem>
                  ))}
                  <SelectItem value="end">End (Submit)</SelectItem>
                </SelectContent>
              </Select>

              {/* Delete */}
              <button
                onClick={() => handleDeleteRule(rule.id)}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
        Rules are evaluated in order. The first matching rule will be applied.
      </p>
    </div>
  );
}
