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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Skip Logic Rules
        </h4>
        <button
          type="button"
          onClick={handleAddRule}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-accent bg-brand-accent/10 hover:bg-brand-accent/15 rounded-xl transition-colors font-albert"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Rule
        </button>
      </div>

      {skipLogic.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            No skip logic rules yet.
          </p>
          <p className="text-xs text-[#5f5a55]/70 dark:text-[#b2b6c2]/70 font-albert mt-1">
            Click &quot;Add Rule&quot; to create conditional navigation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {skipLogic.map(rule => (
            <div
              key={rule.id}
              className="flex items-center gap-2 p-4 bg-[#faf9f7] dark:bg-[#1a1f28] rounded-2xl border border-[#e8e5e1] dark:border-[#262b35]"
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
                <SelectTrigger className="w-auto px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
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
                <SelectTrigger className="flex-1 min-w-[100px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
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
                <SelectTrigger className="flex-1 min-w-[120px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
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
                type="button"
                onClick={() => handleDeleteRule(rule.id)}
                className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4 text-red-400 hover:text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[#5f5a55]/80 dark:text-[#b2b6c2]/80 font-albert text-center pt-2">
        Rules are evaluated in order. The first matching rule will be applied.
      </p>
    </div>
  );
}
