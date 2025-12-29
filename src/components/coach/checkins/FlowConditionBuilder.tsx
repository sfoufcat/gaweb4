'use client';

import React from 'react';
import { Plus, Trash2, Clock, Calendar, Target, CheckCircle, Sunrise } from 'lucide-react';
import type { FlowShowConditions, FlowShowCondition, FlowShowConditionType } from '@/types';

interface FlowConditionBuilderProps {
  value: FlowShowConditions | undefined;
  onChange: (conditions: FlowShowConditions | undefined) => void;
}

const CONDITION_TYPES: { type: FlowShowConditionType; label: string; icon: React.ElementType; description: string }[] = [
  { type: 'time_window', label: 'Time Window', icon: Clock, description: 'Between specific hours' },
  { type: 'day_of_week', label: 'Days of Week', icon: Calendar, description: 'On specific days' },
  { type: 'habit_completed', label: 'Habit Completed', icon: Target, description: 'After completing a habit' },
  { type: 'tasks_completed', label: 'Tasks Completed', icon: CheckCircle, description: 'After completing tasks' },
  { type: 'flow_completed', label: 'Check-in Completed', icon: Sunrise, description: 'After morning/evening/weekly' },
  { type: 'not_completed_today', label: 'Not Done Today', icon: CheckCircle, description: 'Only show if not completed' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function createDefaultCondition(type: FlowShowConditionType): FlowShowCondition {
  switch (type) {
    case 'time_window':
      return { type: 'time_window', startHour: 12, endHour: 17 };
    case 'day_of_week':
      return { type: 'day_of_week', days: [1, 2, 3, 4, 5] }; // Weekdays
    case 'habit_completed':
      return { type: 'habit_completed', anyHabit: true };
    case 'tasks_completed':
      return { type: 'tasks_completed', minCount: 1 };
    case 'flow_completed':
      return { type: 'flow_completed', flowType: 'morning' };
    case 'not_completed_today':
      return { type: 'not_completed_today' };
    default:
      return { type: 'not_completed_today' };
  }
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function FlowConditionBuilder({ value, onChange }: FlowConditionBuilderProps) {
  const conditions = value?.conditions || [];
  const logic = value?.logic || 'and';

  const addCondition = (type: FlowShowConditionType) => {
    const newCondition = createDefaultCondition(type);
    const newConditions: FlowShowCondition[] = [...conditions, newCondition];
    onChange({
      logic,
      conditions: newConditions,
    });
  };

  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      onChange(undefined);
    } else {
      onChange({
        logic,
        conditions: newConditions,
      });
    }
  };

  const updateCondition = (index: number, updatedCondition: FlowShowCondition) => {
    const newConditions = [...conditions];
    newConditions[index] = updatedCondition;
    onChange({
      logic,
      conditions: newConditions,
    });
  };

  const toggleLogic = () => {
    onChange({
      logic: logic === 'and' ? 'or' : 'and',
      conditions,
    });
  };

  // Render condition-specific inputs
  const renderConditionInputs = (condition: FlowShowCondition, index: number) => {
    switch (condition.type) {
      case 'time_window':
        return (
          <div className="flex items-center gap-2 mt-2">
            <select
              value={condition.startHour}
              onChange={(e) => updateCondition(index, { ...condition, startHour: parseInt(e.target.value) })}
              className="px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-text-primary dark:text-[#f5f5f8]"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{formatHour(i)}</option>
              ))}
            </select>
            <span className="text-text-secondary dark:text-[#b2b6c2] text-sm">to</span>
            <select
              value={condition.endHour}
              onChange={(e) => updateCondition(index, { ...condition, endHour: parseInt(e.target.value) })}
              className="px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-text-primary dark:text-[#f5f5f8]"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{formatHour(i)}</option>
              ))}
            </select>
          </div>
        );
      
      case 'day_of_week':
        return (
          <div className="flex flex-wrap gap-2 mt-2">
            {DAYS_OF_WEEK.map(day => (
              <button
                key={day.value}
                type="button"
                onClick={() => {
                  const currentDays = condition.days || [];
                  const newDays = currentDays.includes(day.value)
                    ? currentDays.filter(d => d !== day.value)
                    : [...currentDays, day.value].sort();
                  updateCondition(index, { ...condition, days: newDays });
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  condition.days?.includes(day.value)
                    ? 'bg-brand-accent text-white'
                    : 'bg-[#f5f3f0] dark:bg-[#0d1015] text-text-secondary dark:text-[#b2b6c2] hover:bg-[#e8e5e1] dark:hover:bg-[#1a1f28]'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        );
      
      case 'habit_completed':
        return (
          <div className="mt-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary dark:text-[#b2b6c2]">
              <input
                type="checkbox"
                checked={condition.anyHabit === true}
                onChange={(e) => updateCondition(index, { ...condition, anyHabit: e.target.checked, habitId: e.target.checked ? undefined : condition.habitId })}
                className="w-4 h-4 text-brand-accent rounded"
              />
              Any habit
            </label>
            {!condition.anyHabit && (
              <input
                type="text"
                value={condition.habitId || ''}
                onChange={(e) => updateCondition(index, { ...condition, habitId: e.target.value || undefined })}
                placeholder="Habit ID (optional)"
                className="mt-2 w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-text-primary dark:text-[#f5f5f8]"
              />
            )}
          </div>
        );
      
      case 'tasks_completed':
        return (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-text-secondary dark:text-[#b2b6c2]">At least</span>
            <input
              type="number"
              min="1"
              value={condition.minCount}
              onChange={(e) => updateCondition(index, { ...condition, minCount: parseInt(e.target.value) || 1 })}
              className="w-16 px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-text-primary dark:text-[#f5f5f8] text-center"
            />
            <span className="text-sm text-text-secondary dark:text-[#b2b6c2]">task(s)</span>
          </div>
        );
      
      case 'flow_completed':
        return (
          <div className="mt-2">
            <select
              value={condition.flowType}
              onChange={(e) => updateCondition(index, { ...condition, flowType: e.target.value as 'morning' | 'evening' | 'weekly' })}
              className="px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-text-primary dark:text-[#f5f5f8]"
            >
              <option value="morning">Morning check-in</option>
              <option value="evening">Evening check-in</option>
              <option value="weekly">Weekly reflection</option>
            </select>
          </div>
        );
      
      case 'not_completed_today':
        return (
          <p className="mt-1 text-xs text-text-muted dark:text-[#666d7c]">
            This flow will only show if the user hasn&apos;t completed it today
          </p>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
          Show Conditions
        </label>
        {conditions.length > 1 && (
          <button
            type="button"
            onClick={toggleLogic}
            className="text-xs font-medium px-2 py-1 rounded-md bg-[#f5f3f0] dark:bg-[#0d1015] text-text-secondary dark:text-[#b2b6c2] hover:bg-[#e8e5e1] dark:hover:bg-[#1a1f28] transition-colors"
          >
            Match {logic === 'and' ? 'ALL' : 'ANY'} condition
          </button>
        )}
      </div>

      {/* Existing conditions */}
      {conditions.length > 0 ? (
        <div className="space-y-3">
          {conditions.map((condition, index) => {
            const conditionInfo = CONDITION_TYPES.find(c => c.type === condition.type);
            const Icon = conditionInfo?.icon || CheckCircle;
            
            return (
              <div
                key={index}
                className="p-4 bg-[#faf8f6] dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-brand-accent" />
                    <span className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
                      {conditionInfo?.label || condition.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="p-1 text-text-muted dark:text-[#666d7c] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {renderConditionInputs(condition, index)}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-text-muted dark:text-[#666d7c] italic">
          No conditions set. This flow will only show through direct links.
        </p>
      )}

      {/* Add condition dropdown */}
      <div className="relative group">
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-accent bg-brand-accent/10 hover:bg-brand-accent/20 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add condition
        </button>
        
        <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
          <div className="p-2">
            {CONDITION_TYPES.map(conditionType => {
              const Icon = conditionType.icon;
              return (
                <button
                  key={conditionType.type}
                  type="button"
                  onClick={() => addCondition(conditionType.type)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#0d1015] transition-colors text-left"
                >
                  <Icon className="w-4 h-4 text-brand-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
                      {conditionType.label}
                    </p>
                    <p className="text-xs text-text-muted dark:text-[#666d7c]">
                      {conditionType.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Logic explanation */}
      {conditions.length > 0 && (
        <p className="text-xs text-text-muted dark:text-[#666d7c]">
          This flow will appear on the homepage when {logic === 'and' ? 'all' : 'any'} of the above conditions are met.
        </p>
      )}
    </div>
  );
}

