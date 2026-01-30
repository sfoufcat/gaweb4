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
import { normalizeSkipLogicRule } from '@/types/questionnaire';

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
  // Normalize all rules to new format
  const skipLogic = (question.skipLogic || []).map(rule =>
    normalizeSkipLogicRule(rule, question.id)
  );
  const options = question.options || [];

  // Get questions that come after this one (for skip-to targets)
  const laterQuestions = allQuestions.filter(q => q.order > question.order);

  // Get questions that come before or are this one (for cross-question conditions)
  // Only include questions with options (single/multi choice)
  const conditionableQuestions = allQuestions.filter(
    q => q.order <= question.order && q.options && q.options.length > 0
  );

  // Get options for a specific question
  const getOptionsForQuestion = (questionId: string) => {
    const q = allQuestions.find(q => q.id === questionId);
    return q?.options || [];
  };

  // Add new rule with one condition
  const handleAddRule = () => {
    const newRule: SkipLogicRule = {
      id: crypto.randomUUID(),
      conditions: [{
        id: crypto.randomUUID(),
        questionId: question.id,
        conditionType: 'equals',
        conditionValue: options[0]?.value || '',
      }],
      operator: 'and',
      skipToQuestionId: laterQuestions[0]?.id || null,
    };
    onUpdate([...skipLogic, newRule]);
  };

  // Add condition to existing rule
  const handleAddCondition = (ruleId: string) => {
    onUpdate(
      skipLogic.map(rule => {
        if (rule.id !== ruleId) return rule;
        const newCondition: SkipLogicCondition = {
          id: crypto.randomUUID(),
          questionId: question.id,
          conditionType: 'equals',
          conditionValue: options[0]?.value || '',
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
      skipLogic.map(rule => {
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
      skipLogic.map(rule => {
        if (rule.id !== ruleId) return rule;
        const newConditions = rule.conditions.filter(c => c.id !== conditionId);
        // If no conditions left, we'll let the user delete the whole rule
        return { ...rule, conditions: newConditions };
      }).filter(rule => rule.conditions.length > 0) // Remove rules with no conditions
    );
  };

  // Update rule operator
  const handleUpdateOperator = (ruleId: string, operator: 'and' | 'or') => {
    onUpdate(
      skipLogic.map(rule => (rule.id === ruleId ? { ...rule, operator } : rule))
    );
  };

  // Update rule skip target
  const handleUpdateSkipTo = (ruleId: string, skipToQuestionId: string | null) => {
    onUpdate(
      skipLogic.map(rule => (rule.id === ruleId ? { ...rule, skipToQuestionId } : rule))
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
          {skipLogic.map(rule => {
            const isSingleCondition = rule.conditions.length === 1;

            return (
              <div
                key={rule.id}
                className="p-4 bg-[#faf9f7] dark:bg-[#1a1f28] rounded-2xl border border-[#e8e5e1] dark:border-[#262b35]"
              >
                {isSingleCondition ? (
                  // Single condition - compact inline view
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-nowrap">If</span>

                    {/* Question selector (only if there are other questions to reference) */}
                    {conditionableQuestions.length > 1 && (
                      <Select
                        value={rule.conditions[0].questionId || question.id}
                        onValueChange={value => {
                          const qOptions = getOptionsForQuestion(value);
                          handleUpdateCondition(rule.id, rule.conditions[0].id, {
                            questionId: value,
                            conditionValue: qOptions[0]?.value || '',
                          });
                        }}
                      >
                        <SelectTrigger className="w-[140px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {conditionableQuestions.map(q => (
                            <SelectItem key={q.id} value={q.id}>
                              {q.id === question.id ? 'this answer' : `Q${q.order + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {conditionableQuestions.length <= 1 && (
                      <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-nowrap">answer</span>
                    )}

                    {/* Condition Type */}
                    <Select
                      value={rule.conditions[0].conditionType}
                      onValueChange={value =>
                        handleUpdateCondition(rule.id, rule.conditions[0].id, {
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
                      value={rule.conditions[0].conditionValue}
                      onValueChange={value =>
                        handleUpdateCondition(rule.id, rule.conditions[0].id, { conditionValue: value })
                      }
                    >
                      <SelectTrigger className="w-[130px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {getOptionsForQuestion(rule.conditions[0].questionId || question.id).map(opt => (
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
                        handleUpdateSkipTo(rule.id, value === 'end' ? null : value)
                      }
                    >
                      <SelectTrigger className="w-[140px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
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

                    {/* Add condition button */}
                    <button
                      type="button"
                      onClick={() => handleAddCondition(rule.id)}
                      className="p-1.5 rounded-lg hover:bg-brand-accent/10 transition-colors"
                      title="Add another condition"
                    >
                      <Plus className="w-4 h-4 text-brand-accent" />
                    </button>

                    {/* Delete rule */}
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0 ml-auto"
                    >
                      <Trash2 className="w-4 h-4 text-red-400 hover:text-red-500" />
                    </button>
                  </div>
                ) : (
                  // Multiple conditions - expanded view
                  <div className="space-y-3">
                    {/* Header with operator */}
                    <div className="flex items-center gap-2">
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

                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto"
                      >
                        <Trash2 className="w-4 h-4 text-red-400 hover:text-red-500" />
                      </button>
                    </div>

                    {/* Conditions list */}
                    <div className="pl-4 space-y-2 border-l-2 border-[#e8e5e1] dark:border-[#262b35]">
                      {rule.conditions.map((condition, idx) => (
                        <div key={condition.id} className="flex items-center gap-2 flex-wrap">
                          {/* Question selector */}
                          <Select
                            value={condition.questionId || question.id}
                            onValueChange={value => {
                              const qOptions = getOptionsForQuestion(value);
                              handleUpdateCondition(rule.id, condition.id, {
                                questionId: value,
                                conditionValue: qOptions[0]?.value || '',
                              });
                            }}
                          >
                            <SelectTrigger className="w-[140px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {conditionableQuestions.map(q => (
                                <SelectItem key={q.id} value={q.id}>
                                  {q.id === question.id ? 'this answer' : `Q${q.order + 1}: ${q.title || 'Untitled'}`}
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
                            <SelectTrigger className="w-[130px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {getOptionsForQuestion(condition.questionId || question.id).map(opt => (
                                <SelectItem key={opt.id} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Delete condition */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCondition(rule.id, condition.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-500" />
                          </button>
                        </div>
                      ))}

                      {/* Add condition */}
                      <button
                        type="button"
                        onClick={() => handleAddCondition(rule.id)}
                        className="flex items-center gap-1 text-xs font-medium text-brand-accent hover:text-brand-accent/80 transition-colors font-albert mt-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add condition
                      </button>
                    </div>

                    {/* Skip to */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#e8e5e1] dark:border-[#262b35]">
                      <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">skip to</span>
                      <Select
                        value={rule.skipToQuestionId || 'end'}
                        onValueChange={value =>
                          handleUpdateSkipTo(rule.id, value === 'end' ? null : value)
                        }
                      >
                        <SelectTrigger className="w-[160px] px-3 py-1.5 h-auto text-sm bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
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
                    </div>
                  </div>
                )}
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
