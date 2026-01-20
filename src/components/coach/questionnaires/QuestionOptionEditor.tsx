'use client';

import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import type { QuestionnaireOption } from '@/types/questionnaire';

interface QuestionOptionEditorProps {
  options: QuestionnaireOption[];
  onChange: (options: QuestionnaireOption[]) => void;
  allowImages?: boolean;
  isMultiChoice?: boolean;
}

export function QuestionOptionEditor({
  options,
  onChange,
  allowImages = false,
  isMultiChoice = false,
}: QuestionOptionEditorProps) {
  // Add new option
  const handleAddOption = () => {
    const newOption: QuestionnaireOption = {
      id: crypto.randomUUID(),
      label: `Option ${options.length + 1}`,
      value: `option_${options.length + 1}`,
      order: options.length,
    };
    onChange([...options, newOption]);
  };

  // Update option
  const handleUpdateOption = (optionId: string, updates: Partial<QuestionnaireOption>) => {
    onChange(
      options.map(opt => (opt.id === optionId ? { ...opt, ...updates } : opt))
    );
  };

  // Delete option
  const handleDeleteOption = (optionId: string) => {
    if (options.length <= 2) {
      alert('A choice question must have at least 2 options');
      return;
    }
    onChange(options.filter(opt => opt.id !== optionId));
  };

  // Reorder options
  const handleReorder = (newOrder: QuestionnaireOption[]) => {
    const reordered = newOrder.map((opt, index) => ({ ...opt, order: index }));
    onChange(reordered);
  };

  return (
    <div className="space-y-1">
      <Reorder.Group
        axis="y"
        values={options}
        onReorder={handleReorder}
        className="space-y-1"
      >
        {options.map(option => (
          <OptionItem
            key={option.id}
            option={option}
            onUpdate={updates => handleUpdateOption(option.id, updates)}
            onDelete={() => handleDeleteOption(option.id)}
            canDelete={options.length > 2}
            isMultiChoice={isMultiChoice}
          />
        ))}
      </Reorder.Group>

      <button
        onClick={handleAddOption}
        className="flex items-center gap-1.5 py-1.5 text-sm text-brand-accent hover:text-brand-accent/80 transition-colors font-albert"
      >
        <Plus className="w-4 h-4" />
        Add Option
      </button>
    </div>
  );
}

function OptionItem({
  option,
  onUpdate,
  onDelete,
  canDelete,
  isMultiChoice,
}: {
  option: QuestionnaireOption;
  onUpdate: (updates: Partial<QuestionnaireOption>) => void;
  onDelete: () => void;
  canDelete: boolean;
  isMultiChoice: boolean;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={option}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-2 group py-1 hover:bg-[#f9f8f6]/50 dark:hover:bg-[#1d222b]/50 -mx-2 px-2 rounded-lg transition-colors"
    >
      {/* Drag Handle */}
      <div
        onPointerDown={e => dragControls.start(e)}
        className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="w-4 h-4 text-[#b2b6c2] dark:text-[#5f5a55]" />
      </div>

      {/* Radio/Checkbox indicator */}
      {isMultiChoice ? (
        <div className="w-4 h-4 rounded border-2 border-[#d1cdc8] dark:border-[#3a4150] flex-shrink-0" />
      ) : (
        <div className="w-4 h-4 rounded-full border-2 border-[#d1cdc8] dark:border-[#3a4150] flex-shrink-0" />
      )}

      {/* Option Input - borderless */}
      <input
        type="text"
        value={option.label}
        onChange={e => {
          const label = e.target.value;
          const value = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
          onUpdate({ label, value: value || option.value });
        }}
        placeholder="Option label"
        className="flex-1 min-w-0 py-1 text-sm bg-transparent border-b border-transparent hover:border-[#e1ddd8]/50 dark:hover:border-[#262b35]/50 focus:border-brand-accent outline-none transition-colors font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#b2b6c2]"
      />

      {/* Delete Button */}
      <button
        onClick={onDelete}
        disabled={!canDelete}
        className={`p-1 rounded transition-all flex-shrink-0 ${
          canDelete
            ? 'opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20'
            : 'opacity-0 cursor-not-allowed'
        }`}
      >
        <Trash2 className="w-3.5 h-3.5 text-red-500" />
      </button>
    </Reorder.Item>
  );
}
