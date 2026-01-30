'use client';

import { Plus, X, GripVertical } from 'lucide-react';
import { Reorder, useDragControls, motion, AnimatePresence } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
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
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        <Reorder.Group
          axis="y"
          values={options}
          onReorder={handleReorder}
          className="space-y-2"
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
      </AnimatePresence>

      <button
        onClick={handleAddOption}
        className="flex items-center gap-1.5 py-2 text-sm text-brand-accent hover:text-brand-accent/80 transition-colors font-albert"
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
  const isMobile = !useMediaQuery('(min-width: 768px)');

  return (
    <Reorder.Item
      value={option}
      dragListener={false}
      dragControls={dragControls}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-2 group py-2.5 px-3 bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-xl transition-colors"
    >
      {/* Drag Handle */}
      <div
        onPointerDown={e => dragControls.start(e)}
        className={`cursor-grab active:cursor-grabbing transition-opacity ${isMobile ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'}`}
      >
        <GripVertical className="w-4 h-4 text-[#b2b6c2] dark:text-[#5f5a55]" />
      </div>

      {/* Radio/Checkbox indicator */}
      {isMultiChoice ? (
        <div className="w-4 h-4 rounded border-2 border-[#d1cdc8] dark:border-[#3a4150] flex-shrink-0" />
      ) : (
        <div className="w-4 h-4 rounded-full border-2 border-[#d1cdc8] dark:border-[#3a4150] flex-shrink-0" />
      )}

      {/* Option Input - clean style without underline */}
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
        className="flex-1 min-w-0 py-0.5 text-sm bg-transparent border-none outline-none font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#b2b6c2]"
      />

      {/* Delete Button - X icon, always visible on mobile */}
      <button
        onClick={onDelete}
        disabled={!canDelete}
        className={`p-1 rounded-lg transition-all flex-shrink-0 ${
          canDelete
            ? isMobile
              ? 'opacity-50 hover:opacity-100 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
              : 'opacity-0 group-hover:opacity-100 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
            : 'opacity-0 cursor-not-allowed'
        }`}
      >
        <X className="w-4 h-4 text-[#b2b6c2] dark:text-[#5f5a55]" />
      </button>
    </Reorder.Item>
  );
}
