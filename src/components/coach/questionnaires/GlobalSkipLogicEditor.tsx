'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuestionnaireQuestion, SkipLogicRule, SkipLogicCondition } from '@/types/questionnaire';

interface GlobalSkipLogicEditorProps {
  questions: QuestionnaireQuestion[];
  rules: SkipLogicRule[];
  onUpdate: (rules: SkipLogicRule[]) => void;
}

export function GlobalSkipLogicEditor({
  questions,
  rules,
  onUpdate,
}: GlobalSkipLogicEditorProps) {
  // Get questions that have options (single/multi choice) - these can be used in conditions
  const conditionableQuestions = questions.filter(
    q => (q.type === 'single_choice' || q.type === 'multi_choice') && q.options && q.options.length > 0
  );

  // Get all questions that can be skip targets (any question)
  const targetQuestions = questions.filter(q => q.type !== 'page_break');

  // Get options for a specific question
  const getOptionsForQuestion = (questionId: string) => {
    const q = questions.find(q => q.id === questionId);
    return q?.options || [];
  };

  // Get question label for display
  const getQuestionLabel = (questionId: string) => {
    const q = questions.find(q => q.id === questionId);
    if (!q) return 'Unknown';
    const index = questions.indexOf(q);
    return `Q${index + 1}: ${q.title || 'Untitled'}`;
  };

  // Add new rule with one condition
  const handleAddRule = () => {
    if (conditionableQuestions.length === 0) return;

    const firstQuestion = conditionableQuestions[0];
    const newRule: SkipLogicRule = {
      id: crypto.randomUUID(),
      conditions: [{
        id: crypto.randomUUID(),
        questionId: firstQuestion.id,
        conditionType: 'equals',
        conditionValue: firstQuestion.options?.[0]?.value || '',
      }],
      operator: 'and',
      skipToQuestionId: targetQuestions.length > 1 ? targetQuestions[1]?.id : null,
    };
    onUpdate([...rules, newRule]);
  };

  // Add condition to existing rule
  const handleAddCondition = (ruleId: string) => {
    if (conditionableQuestions.length === 0) return;

    const firstQuestion = conditionableQuestions[0];
    onUpdate(
      rules.map(rule => {
        if (rule.id !== ruleId) return rule;
        const newCondition: SkipLogicCondition = {
          id: crypto.randomUUID(),
          questionId: firstQuestion.id,
          conditionType: 'equals',
          conditionValue: firstQuestion.options?.[0]?.value || '',
        };
        return {
          ...rule,
          conditions: [...rule.conditions, newCondition],
        };
      })
    );
  };

  // Update a specific condition within a rule
  const handleUpdateCondition = (
    ruleId: string,
    conditionId: string,
    updates: Partial<SkipLogicCondition>
  ) => {
    onUpdate(
      rules.map(rule => {
        if (rule.id !== ruleId) return rule;
        return {
          ...rule,
          conditions: rule.conditions.map(c =>
            c.id === conditionId ? { ...c, ...updates } : c
          ),
        };
      })
    );
  };

  // Delete a condition from a rule
  const handleDeleteCondition = (ruleId: string, conditionId: string) => {
    onUpdate(
      rules.map(rule => {
        if (rule.id !== ruleId) return rule;
        const newConditions = rule.conditions.filter(c => c.id !== conditionId);
        return { ...rule, conditions: newConditions };
      }).filter(rule => rule.conditions.length > 0)
    );
  };

  // Update rule operator
  const handleUpdateOperator = (ruleId: string, operator: 'and' | 'or') => {
    onUpdate(
      rules.map(rule => (rule.id === ruleId ? { ...rule, operator } : rule))
    );
  };

  // Update rule skip target
  const handleUpdateSkipTo = (ruleId: string, skipToQuestionId: string | null) => {
    onUpdate(
      rules.map(rule => (rule.id === ruleId ? { ...rule, skipToQuestionId } : rule))
    );
  };

  // Delete rule
  const handleDeleteRule = (ruleId: string) => {
    onUpdate(rules.filter(rule => rule.id !== ruleId));
  };

  if (conditionableQuestions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          Add choice questions to enable skip logic.
        </p>
        <p className="text-xs text-[#5f5a55]/70 dark:text-[#b2b6c2]/70 font-albert mt-1">
          Skip logic requires single or multiple choice questions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          Create rules to skip questions based on answers.
        </p>
        <button
          type="button"
          onClick={handleAddRule}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-accent bg-brand-accent/10 hover:bg-brand-accent/15 rounded-xl transition-colors font-albert"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            No skip logic rules yet.
          </p>
          <p className="text-xs text-[#5f5a55]/70 dark:text-[#b2b6c2]/70 font-albert mt-1">
            Click &quot;Add Rule&quot; to create conditional navigation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, ruleIndex) => {
            const isSingleCondition = rule.conditions.length === 1;

            return (
              <div
                key={rule.id}
                className="p-4 bg-[#faf9f7] dark:bg-[#1a1f28] rounded-2xl border border-[#e8e5e1] dark:border-[#262b35]"
              >
                {/* Rule header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Rule {ruleIndex + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-500" />
                  </button>
                </div>

                {/* Operator selector for multiple conditions */}
                {!isSingleCondition && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">If</span>
                    <Select
                      value={rule.operator}
                      onValueChange={value => handleUpdateOperator(rule.id, value as 'and' | 'or')}
                    >
                      <SelectTrigger className="w-[80px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="and">ALL</SelectItem>
                        <SelectItem value="or">ANY</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">of these match:</span>
                  </div>
                )}

                {/* Conditions */}
                <div className={`space-y-2 ${!isSingleCondition ? 'pl-4 border-l-2 border-[#e8e5e1] dark:border-[#262b35]' : ''}`}>
                  {rule.conditions.map((condition, condIndex) => (
                    <div key={condition.id} className="flex items-center gap-2 flex-wrap">
                      {isSingleCondition && (
                        <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-nowrap">If</span>
                      )}

                      {/* Question selector */}
                      <Select
                        value={condition.questionId || conditionableQuestions[0]?.id}
                        onValueChange={value => {
                          const qOptions = getOptionsForQuestion(value);
                          handleUpdateCondition(rule.id, condition.id, {
                            questionId: value,
                            conditionValue: qOptions[0]?.value || '',
                          });
                        }}
                      >
                        <SelectTrigger className="w-[200px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-60">
                          {conditionableQuestions.map(q => (
                            <SelectItem key={q.id} value={q.id}>
                              Q{questions.indexOf(q) + 1} answer
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Condition Type */}
                      <Select
                        value={condition.conditionType}
                        onValueChange={value =>
                          handleUpdateCondition(rule.id, condition.id, {
                            conditionType: value as SkipLogicCondition['conditionType'],
                          })
                        }
                      >
                        <SelectTrigger className="w-[130px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="equals">equals</SelectItem>
                          <SelectItem value="not_equals">doesn&apos;t equal</SelectItem>
                          <SelectItem value="contains">contains</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Condition Value */}
                      <Select
                        value={condition.conditionValue}
                        onValueChange={value =>
                          handleUpdateCondition(rule.id, condition.id, { conditionValue: value })
                        }
                      >
                        <SelectTrigger className="w-[150px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-60">
                          {getOptionsForQuestion(condition.questionId || '').map(opt => (
                            <SelectItem key={opt.id} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Delete condition (only if multiple) */}
                      {!isSingleCondition && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCondition(rule.id, condition.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Add condition button */}
                  <button
                    type="button"
                    onClick={() => handleAddCondition(rule.id)}
                    className="flex items-center gap-1 text-xs font-medium text-brand-accent hover:text-brand-accent/80 transition-colors font-albert mt-2"
                  >
                    <Plus className="w-3 h-3" />
                    Add condition
                  </button>
                </div>

                {/* Skip to target */}
                <div className="mt-3 pt-3 border-t border-[#e8e5e1] dark:border-[#262b35]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">then skip to</span>
                    <Select
                      value={rule.skipToQuestionId || 'end'}
                      onValueChange={value =>
                        handleUpdateSkipTo(rule.id, value === 'end' ? null : value)
                      }
                    >
                      <SelectTrigger className="w-[200px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-60">
                        {targetQuestions.map(q => (
                          <SelectItem key={q.id} value={q.id}>
                            Q{questions.indexOf(q) + 1}: {q.title || 'Untitled'}
                          </SelectItem>
                        ))}
                        <SelectItem value="end">End (Submit)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-[#5f5a55]/60 dark:text-[#b2b6c2]/60 font-albert mt-1.5">
                    All questions between the condition and target will be hidden.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[#5f5a55]/80 dark:text-[#b2b6c2]/80 font-albert text-center pt-2">
        Rules are evaluated in order. The first matching rule will be applied.
      </p>
    </div>
  );
}
