'use client';

import { motion } from 'framer-motion';
import {
  CircleDot,
  CheckSquare,
  Type,
  AlignLeft,
  Paperclip,
  Image,
  Hash,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { QuestionnaireQuestionType } from '@/types/questionnaire';

interface QuestionTypeSelectorProps {
  onSelect: (type: QuestionnaireQuestionType) => void;
  onCancel: () => void;
}

const QUESTION_TYPE_OPTIONS: {
  type: QuestionnaireQuestionType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    type: 'single_choice',
    label: 'Single Choice',
    description: 'Select one option',
    icon: <CircleDot className="w-5 h-5" />,
  },
  {
    type: 'multi_choice',
    label: 'Multiple Choice',
    description: 'Select multiple options',
    icon: <CheckSquare className="w-5 h-5" />,
  },
  {
    type: 'short_text',
    label: 'Short Text',
    description: 'Single line answer',
    icon: <Type className="w-5 h-5" />,
  },
  {
    type: 'long_text',
    label: 'Long Text',
    description: 'Paragraph answer',
    icon: <AlignLeft className="w-5 h-5" />,
  },
  {
    type: 'number',
    label: 'Number',
    description: 'Numeric input',
    icon: <Hash className="w-5 h-5" />,
  },
  {
    type: 'scale',
    label: 'Scale',
    description: 'Rating scale (1-10)',
    icon: <SlidersHorizontal className="w-5 h-5" />,
  },
  {
    type: 'file_upload',
    label: 'File Upload',
    description: 'Upload any file',
    icon: <Paperclip className="w-5 h-5" />,
  },
  {
    type: 'media_upload',
    label: 'Image/Video',
    description: 'Upload media files',
    icon: <Image className="w-5 h-5" />,
  },
];

export function QuestionTypeSelector({ onSelect, onCancel }: QuestionTypeSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]/50 overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Select Question Type
        </h3>
        <button
          onClick={onCancel}
          className="p-1 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4">
        {QUESTION_TYPE_OPTIONS.map(option => (
          <button
            key={option.type}
            onClick={() => onSelect(option.type)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35]/50 hover:border-brand-accent hover:bg-brand-accent/5 transition-colors group"
          >
            <div className="text-[#5f5a55] dark:text-[#b2b6c2] group-hover:text-brand-accent transition-colors">
              {option.icon}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {option.label}
              </p>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                {option.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
