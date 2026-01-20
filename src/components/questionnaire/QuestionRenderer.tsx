'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, File, Image, Video, X, Check } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { QuestionnaireQuestion, QuestionnaireAnswer } from '@/types/questionnaire';

interface QuestionRendererProps {
  question: QuestionnaireQuestion;
  answer?: QuestionnaireAnswer;
  error?: string;
  onChange: (value: QuestionnaireAnswer['value']) => void;
}

export function QuestionRenderer({ question, answer, error, onChange }: QuestionRendererProps) {
  const renderQuestion = () => {
    switch (question.type) {
      case 'single_choice':
        return <SingleChoiceQuestion question={question} answer={answer} onChange={onChange} />;
      case 'multi_choice':
        return <MultiChoiceQuestion question={question} answer={answer} onChange={onChange} />;
      case 'short_text':
        return <ShortTextQuestion question={question} answer={answer} onChange={onChange} />;
      case 'long_text':
        return <LongTextQuestion question={question} answer={answer} onChange={onChange} />;
      case 'number':
        return <NumberQuestion question={question} answer={answer} onChange={onChange} />;
      case 'scale':
        return <ScaleQuestion question={question} answer={answer} onChange={onChange} />;
      case 'file_upload':
        return <FileUploadQuestion question={question} answer={answer} onChange={onChange} />;
      case 'media_upload':
        return <MediaUploadQuestion question={question} answer={answer} onChange={onChange} />;
      case 'info':
        return <InfoStep question={question} />;
      case 'page_break':
        // Page breaks are handled by the form - they don't render as questions
        return null;
      default:
        return <div>Unknown question type</div>;
    }
  };

  // Info steps handle their own layout more compactly
  if (question.type === 'info') {
    return <InfoStep question={question} />;
  }

  return (
    <div className="space-y-6">
      {/* Question title */}
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert leading-snug">
          {question.title}
          {question.required && <span className="text-brand-accent ml-1">*</span>}
        </h2>
        {question.description && (
          <p className="text-[#6b6560] dark:text-[#9ca3af] font-albert text-sm sm:text-base leading-relaxed">
            {question.description}
          </p>
        )}
      </div>

      {/* Question input */}
      {renderQuestion()}

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="text-sm text-red-500 dark:text-red-400 font-albert font-medium"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// Single choice question (radio buttons)
function SingleChoiceQuestion({
  question,
  answer,
  onChange,
}: {
  question: QuestionnaireQuestion;
  answer?: QuestionnaireAnswer;
  onChange: (value: string) => void;
}) {
  const options = question.options || [];
  const selectedValue = answer?.value as string | undefined;

  return (
    <div className="space-y-2.5">
      {options.map((option, index) => (
        <motion.label
          key={option.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
          className={cn(
            'group flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200',
            'bg-white dark:bg-[#171b22] border',
            selectedValue === option.value
              ? 'border-brand-accent shadow-md shadow-brand-accent/10 ring-1 ring-brand-accent/20'
              : 'border-[#e8e4df] dark:border-[#262b35] hover:border-[#d1cdc8] dark:hover:border-[#363c48] hover:shadow-sm'
          )}
        >
          <div
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0',
              selectedValue === option.value
                ? 'border-brand-accent bg-brand-accent'
                : 'border-[#c1bdb8] dark:border-[#4a4f5c] group-hover:border-brand-accent/50'
            )}
          >
            <AnimatePresence>
              {selectedValue === option.value && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-2 h-2 rounded-full bg-white"
                />
              )}
            </AnimatePresence>
          </div>
          <span className={cn(
            'text-base font-albert transition-colors',
            selectedValue === option.value
              ? 'text-[#1a1a1a] dark:text-[#f5f5f8] font-medium'
              : 'text-[#4a4540] dark:text-[#b2b6c2]'
          )}>
            {option.label}
          </span>
          <input
            type="radio"
            className="sr-only"
            checked={selectedValue === option.value}
            onChange={() => onChange(option.value)}
          />
        </motion.label>
      ))}
    </div>
  );
}

// Multi choice question (checkboxes)
function MultiChoiceQuestion({
  question,
  answer,
  onChange,
}: {
  question: QuestionnaireQuestion;
  answer?: QuestionnaireAnswer;
  onChange: (value: string[]) => void;
}) {
  const options = question.options || [];
  const selectedValues = (answer?.value as string[]) || [];

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  return (
    <div className="space-y-2.5">
      {options.map((option, index) => {
        const isSelected = selectedValues.includes(option.value);

        return (
          <motion.label
            key={option.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className={cn(
              'group flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200',
              'bg-white dark:bg-[#171b22] border',
              isSelected
                ? 'border-brand-accent shadow-md shadow-brand-accent/10 ring-1 ring-brand-accent/20'
                : 'border-[#e8e4df] dark:border-[#262b35] hover:border-[#d1cdc8] dark:hover:border-[#363c48] hover:shadow-sm'
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200 shrink-0',
                isSelected
                  ? 'border-brand-accent bg-brand-accent'
                  : 'border-[#c1bdb8] dark:border-[#4a4f5c] group-hover:border-brand-accent/50'
              )}
            >
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className={cn(
              'text-base font-albert transition-colors',
              isSelected
                ? 'text-[#1a1a1a] dark:text-[#f5f5f8] font-medium'
                : 'text-[#4a4540] dark:text-[#b2b6c2]'
            )}>
              {option.label}
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={isSelected}
              onChange={() => toggleOption(option.value)}
            />
          </motion.label>
        );
      })}
    </div>
  );
}

// Short text question
function ShortTextQuestion({
  question,
  answer,
  onChange,
}: {
  question: QuestionnaireQuestion;
  answer?: QuestionnaireAnswer;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      value={(answer?.value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder || 'Type your answer...'}
      className="w-full h-14 px-5 text-base font-albert bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] border border-[#e8e4df] dark:border-[#262b35] focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10 focus:outline-none rounded-2xl transition-all placeholder:text-[#a3a09b] dark:placeholder:text-[#4b5563]"
    />
  );
}

// Long text question
function LongTextQuestion({
  question,
  answer,
  onChange,
}: {
  question: QuestionnaireQuestion;
  answer?: QuestionnaireAnswer;
  onChange: (value: string) => void;
}) {
  return (
    <Textarea
      value={(answer?.value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder || 'Type your answer...'}
      rows={5}
      className="text-base font-albert bg-white dark:bg-[#171b22] border border-[#e8e4df] dark:border-[#262b35] focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10 rounded-2xl resize-none placeholder:text-[#a3a09b] dark:placeholder:text-[#4b5563] p-5"
    />
  );
}

// Number question
function NumberQuestion({
  question,
  answer,
  onChange,
}: {
  question: QuestionnaireQuestion;
  answer?: QuestionnaireAnswer;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        type="number"
        value={answer?.value !== undefined ? String(answer.value) : ''}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={question.minValue}
        max={question.maxValue}
        placeholder={question.placeholder || 'Enter a number...'}
        className="w-full h-14 px-5 text-base font-albert bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] border border-[#e8e4df] dark:border-[#262b35] focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10 focus:outline-none rounded-2xl transition-all placeholder:text-[#a3a09b] dark:placeholder:text-[#4b5563]"
      />
      {(question.minValue !== undefined || question.maxValue !== undefined) && (
        <p className="text-sm text-[#8a857f] dark:text-[#6b7280] font-albert">
          {question.minValue !== undefined && question.maxValue !== undefined
            ? `Enter a number between ${question.minValue} and ${question.maxValue}`
            : question.minValue !== undefined
              ? `Minimum: ${question.minValue}`
              : `Maximum: ${question.maxValue}`}
        </p>
      )}
    </div>
  );
}

// Scale question
function ScaleQuestion({
  question,
  answer,
  onChange,
}: {
  question: QuestionnaireQuestion;
  answer?: QuestionnaireAnswer;
  onChange: (value: number) => void;
}) {
  const min = question.minValue ?? 1;
  const max = question.maxValue ?? 5;
  const selectedValue = answer?.value as number | undefined;

  const scaleValues = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
        {scaleValues.map((value, index) => (
          <motion.button
            key={value}
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03, duration: 0.2 }}
            onClick={() => onChange(value)}
            className={cn(
              'w-12 h-12 sm:w-14 sm:h-14 rounded-xl font-albert font-semibold text-lg transition-all duration-200',
              selectedValue === value
                ? 'bg-brand-accent text-white scale-110 shadow-lg shadow-brand-accent/30'
                : 'bg-white dark:bg-[#171b22] text-[#4a4540] dark:text-[#b2b6c2] border border-[#e8e4df] dark:border-[#262b35] hover:border-brand-accent/50 hover:shadow-sm'
            )}
          >
            {value}
          </motion.button>
        ))}
      </div>
      {question.scaleLabels && (
        <div className="flex justify-between text-sm text-[#8a857f] dark:text-[#6b7280] font-albert px-1">
          <span>{question.scaleLabels.min}</span>
          <span>{question.scaleLabels.max}</span>
        </div>
      )}
    </div>
  );
}

// File upload question
function FileUploadQuestion({
  question,
  answer,
  onChange,
}: {
  question: QuestionnaireQuestion;
  answer?: QuestionnaireAnswer;
  onChange: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const fileUrl = answer?.value as string | undefined;

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setFileName(file.name);

      try {
        // Create form data for upload
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();
        onChange(data.url);
      } catch (err) {
        console.error('Upload error:', err);
        setFileName(null);
        alert('Failed to upload file. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const removeFile = useCallback(() => {
    onChange(null);
    setFileName(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [onChange]);

  const acceptTypes = question.acceptedFileTypes?.join(',') || '*';

  return (
    <div className="space-y-4">
      {!fileUrl ? (
        <label
          className={cn(
            'flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
            'bg-white/50 dark:bg-[#171b22]/50',
            uploading
              ? 'border-brand-accent bg-brand-accent/5'
              : 'border-[#d1cdc8] dark:border-[#363c48] hover:border-brand-accent/50 hover:bg-brand-accent/5'
          )}
        >
          <div className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
            uploading ? 'bg-brand-accent/10' : 'bg-[#f3f1ef] dark:bg-[#262b35]'
          )}>
            <Upload className={cn(
              'w-6 h-6 transition-colors',
              uploading ? 'text-brand-accent' : 'text-[#8a857f] dark:text-[#6b7280]'
            )} />
          </div>
          <div className="text-center">
            <p className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-medium">
              {uploading ? 'Uploading...' : 'Click to upload a file'}
            </p>
            <p className="text-sm text-[#8a857f] dark:text-[#6b7280] font-albert mt-1">
              or drag and drop
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={acceptTypes}
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 rounded-2xl border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#171b22]"
        >
          <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center shrink-0">
            <File className="w-5 h-5 text-brand-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-medium truncate">
              {fileName || 'Uploaded file'}
            </p>
            <p className="text-sm text-[#8a857f] dark:text-[#6b7280] font-albert">
              File uploaded successfully
            </p>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="p-2.5 rounded-xl hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <X className="w-5 h-5 text-[#8a857f] dark:text-[#6b7280]" />
          </button>
        </motion.div>
      )}
    </div>
  );
}

// Media upload question (image/video)
function MediaUploadQuestion({
  question,
  answer,
  onChange,
}: {
  question: QuestionnaireQuestion;
  answer?: QuestionnaireAnswer;
  onChange: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);

  const mediaUrl = answer?.value as string | undefined;

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        alert('Please upload an image or video file');
        return;
      }

      setUploading(true);
      setMediaType(isImage ? 'image' : 'video');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();
        onChange(data.url);
      } catch (err) {
        console.error('Upload error:', err);
        setMediaType(null);
        alert('Failed to upload file. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const removeMedia = useCallback(() => {
    onChange(null);
    setMediaType(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [onChange]);

  return (
    <div className="space-y-4">
      {!mediaUrl ? (
        <label
          className={cn(
            'flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
            'bg-white/50 dark:bg-[#171b22]/50',
            uploading
              ? 'border-brand-accent bg-brand-accent/5'
              : 'border-[#d1cdc8] dark:border-[#363c48] hover:border-brand-accent/50 hover:bg-brand-accent/5'
          )}
        >
          <div className="flex gap-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
              uploading ? 'bg-brand-accent/10' : 'bg-[#f3f1ef] dark:bg-[#262b35]'
            )}>
              <Image className={cn(
                'w-5 h-5 transition-colors',
                uploading ? 'text-brand-accent' : 'text-[#8a857f] dark:text-[#6b7280]'
              )} />
            </div>
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
              uploading ? 'bg-brand-accent/10' : 'bg-[#f3f1ef] dark:bg-[#262b35]'
            )}>
              <Video className={cn(
                'w-5 h-5 transition-colors',
                uploading ? 'text-brand-accent' : 'text-[#8a857f] dark:text-[#6b7280]'
              )} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-medium">
              {uploading ? 'Uploading...' : 'Click to upload image or video'}
            </p>
            <p className="text-sm text-[#8a857f] dark:text-[#6b7280] font-albert mt-1">
              or drag and drop
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept="image/*,video/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative rounded-2xl overflow-hidden border border-[#e8e4df] dark:border-[#262b35]"
        >
          {mediaType === 'video' ? (
            <video src={mediaUrl} controls className="w-full max-h-80 object-contain bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="Uploaded media" className="w-full max-h-80 object-contain bg-[#f3f1ef] dark:bg-[#171b22]" />
          )}
          <button
            type="button"
            onClick={removeMedia}
            className="absolute top-3 right-3 p-2.5 rounded-xl bg-black/60 hover:bg-black/80 transition-colors backdrop-blur-sm"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </motion.div>
      )}
    </div>
  );
}

// Info step (display-only, no input) - compact layout
function InfoStep({ question }: { question: QuestionnaireQuestion }) {
  const hasMedia = !!question.mediaUrl;
  const hasTitle = !!question.title;
  const hasDescription = !!question.description;

  // No content to display
  if (!hasMedia && !hasTitle && !hasDescription) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Title - only if present */}
      {hasTitle && (
        <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {question.title}
        </h3>
      )}

      {/* Description */}
      {hasDescription && (
        <p className={cn(
          "text-[#6b6560] dark:text-[#9ca3af] font-albert leading-relaxed",
          !hasTitle && "text-base"
        )}>
          {question.description}
        </p>
      )}

      {/* Media display */}
      {hasMedia && (
        <div className="rounded-2xl overflow-hidden mt-2 border border-[#e8e4df] dark:border-[#262b35]">
          {question.mediaType === 'video' ? (
            <video
              src={question.mediaUrl}
              controls
              className="w-full max-h-80 object-contain bg-black"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={question.mediaUrl}
              alt={question.title || 'Info image'}
              className="w-full max-h-80 object-contain bg-[#f3f1ef] dark:bg-[#171b22]"
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
