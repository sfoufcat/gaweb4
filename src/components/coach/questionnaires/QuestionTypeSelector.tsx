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
  Info,
  SeparatorHorizontal,
} from 'lucide-react';
import type { QuestionnaireQuestionType } from '@/types/questionnaire';

interface QuestionTypeSelectorProps {
  onSelect: (type: QuestionnaireQuestionType) => void;
  onCancel: () => void;
}

interface StepOption {
  type: QuestionnaireQuestionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'input' | 'upload' | 'content' | 'layout';
}

const STEP_OPTIONS: StepOption[] = [
  // Input Steps
  {
    type: 'single_choice',
    label: 'Single Choice',
    description: 'Select one option',
    icon: <CircleDot className="w-6 h-6" />,
    category: 'input',
  },
  {
    type: 'multi_choice',
    label: 'Multiple Choice',
    description: 'Select multiple options',
    icon: <CheckSquare className="w-6 h-6" />,
    category: 'input',
  },
  {
    type: 'short_text',
    label: 'Short Text',
    description: 'Single line answer',
    icon: <Type className="w-6 h-6" />,
    category: 'input',
  },
  {
    type: 'long_text',
    label: 'Long Text',
    description: 'Paragraph answer',
    icon: <AlignLeft className="w-6 h-6" />,
    category: 'input',
  },
  {
    type: 'number',
    label: 'Number',
    description: 'Numeric input',
    icon: <Hash className="w-6 h-6" />,
    category: 'input',
  },
  {
    type: 'scale',
    label: 'Scale',
    description: 'Rating scale (1-10)',
    icon: <SlidersHorizontal className="w-6 h-6" />,
    category: 'input',
  },
  // Upload Steps
  {
    type: 'file_upload',
    label: 'File Upload',
    description: 'Upload any file',
    icon: <Paperclip className="w-6 h-6" />,
    category: 'upload',
  },
  {
    type: 'media_upload',
    label: 'Image/Video',
    description: 'Upload media files',
    icon: <Image className="w-6 h-6" />,
    category: 'upload',
  },
  // Content Steps
  {
    type: 'info',
    label: 'Info',
    description: 'Display text or media',
    icon: <Info className="w-6 h-6" />,
    category: 'content',
  },
  // Layout Steps
  {
    type: 'page_break',
    label: 'Page Break',
    description: 'Divide into sections',
    icon: <SeparatorHorizontal className="w-6 h-6" />,
    category: 'layout',
  },
];

const CATEGORY_LABELS: Record<StepOption['category'], string> = {
  input: 'Input',
  upload: 'Upload',
  content: 'Content',
  layout: 'Layout',
};

const containerVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as const,
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: {
      duration: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
    },
  },
};

export function QuestionTypeSelector({ onSelect, onCancel }: QuestionTypeSelectorProps) {
  const inputSteps = STEP_OPTIONS.filter(o => o.category === 'input');
  const uploadSteps = STEP_OPTIONS.filter(o => o.category === 'upload');
  const contentSteps = STEP_OPTIONS.filter(o => o.category === 'content');
  const layoutSteps = STEP_OPTIONS.filter(o => o.category === 'layout');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Add Step
        </h3>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </button>
      </div>

      {/* Options */}
      <div className="p-5 space-y-5">
        {/* Input Steps */}
        <div>
          <motion.p
            variants={itemVariants}
            className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-3 uppercase tracking-wide"
          >
            {CATEGORY_LABELS.input}
          </motion.p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {inputSteps.map((option, index) => (
              <StepButton key={option.type} option={option} onSelect={onSelect} index={index} />
            ))}
          </div>
        </div>

        {/* Upload Steps */}
        <div>
          <motion.p
            variants={itemVariants}
            className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-3 uppercase tracking-wide"
          >
            {CATEGORY_LABELS.upload}
          </motion.p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {uploadSteps.map((option, index) => (
              <StepButton key={option.type} option={option} onSelect={onSelect} index={index} />
            ))}
          </div>
        </div>

        {/* Content & Layout Steps */}
        <div>
          <motion.p
            variants={itemVariants}
            className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-3 uppercase tracking-wide"
          >
            {CATEGORY_LABELS.content} & {CATEGORY_LABELS.layout}
          </motion.p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[...contentSteps, ...layoutSteps].map((option, index) => (
              <StepButton key={option.type} option={option} onSelect={onSelect} index={index} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StepButton({
  option,
  onSelect,
  index,
}: {
  option: StepOption;
  onSelect: (type: QuestionnaireQuestionType) => void;
  index: number;
}) {
  return (
    <motion.button
      variants={itemVariants}
      onClick={() => onSelect(option.type)}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35]/50 hover:border-brand-accent hover:bg-brand-accent/5 transition-all group"
    >
      <div className="text-[#5f5a55] dark:text-[#b2b6c2] group-hover:text-brand-accent transition-colors">
        {option.icon}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {option.label}
        </p>
        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5 hidden sm:block">
          {option.description}
        </p>
      </div>
    </motion.button>
  );
}
