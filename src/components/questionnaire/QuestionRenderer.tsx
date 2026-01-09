'use client';

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
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
      default:
        return <div>Unknown question type</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Question title */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {question.title}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h2>
        {question.description && (
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {question.description}
          </p>
        )}
      </div>

      {/* Question input */}
      {renderQuestion()}

      {/* Error message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-500 font-albert"
        >
          {error}
        </motion.p>
      )}
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
    <div className="space-y-3">
      {options.map((option) => (
        <label
          key={option.id}
          className={cn(
            'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
            selectedValue === option.value
              ? 'border-brand-accent bg-brand-accent/5'
              : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
          )}
        >
          <div
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
              selectedValue === option.value
                ? 'border-brand-accent bg-brand-accent'
                : 'border-[#c1bdb8] dark:border-[#4a4f5c]'
            )}
          >
            {selectedValue === option.value && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-2 h-2 rounded-full bg-white"
              />
            )}
          </div>
          <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {option.label}
          </span>
          <input
            type="radio"
            className="sr-only"
            checked={selectedValue === option.value}
            onChange={() => onChange(option.value)}
          />
        </label>
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
    <div className="space-y-3">
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);

        return (
          <label
            key={option.id}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
              isSelected
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                isSelected
                  ? 'border-brand-accent bg-brand-accent'
                  : 'border-[#c1bdb8] dark:border-[#4a4f5c]'
              )}
            >
              {isSelected && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  <Check className="w-3 h-3 text-white" />
                </motion.div>
              )}
            </div>
            <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {option.label}
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={isSelected}
              onChange={() => toggleOption(option.value)}
            />
          </label>
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
      className="w-full h-12 px-4 text-lg font-albert bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] border-2 border-[#e1ddd8] dark:border-[#262b35] focus:border-brand-accent focus:outline-none rounded-xl transition-colors"
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
      className="text-lg font-albert border-2 border-[#e1ddd8] dark:border-[#262b35] focus:border-brand-accent rounded-xl resize-none"
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
        className="w-full h-12 px-4 text-lg font-albert bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] border-2 border-[#e1ddd8] dark:border-[#262b35] focus:border-brand-accent focus:outline-none rounded-xl transition-colors"
      />
      {(question.minValue !== undefined || question.maxValue !== undefined) && (
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
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
      <div className="flex justify-center gap-2 flex-wrap">
        {scaleValues.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={cn(
              'w-12 h-12 rounded-xl font-albert font-semibold text-lg transition-all',
              selectedValue === value
                ? 'bg-brand-accent text-white scale-110 shadow-lg'
                : 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-brand-accent/20'
            )}
          >
            {value}
          </button>
        ))}
      </div>
      {question.scaleLabels && (
        <div className="flex justify-between text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
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
            'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all',
            uploading
              ? 'border-brand-accent bg-brand-accent/5'
              : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
          )}
        >
          <Upload className="w-8 h-8 text-[#5f5a55] dark:text-[#b2b6c2]" />
          <div className="text-center">
            <p className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-medium">
              {uploading ? 'Uploading...' : 'Click to upload a file'}
            </p>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
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
        <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
          <File className="w-8 h-8 text-brand-accent" />
          <div className="flex-1 min-w-0">
            <p className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-medium truncate">
              {fileName || 'Uploaded file'}
            </p>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              File uploaded successfully
            </p>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="p-2 rounded-lg hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] transition-colors"
          >
            <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
        </div>
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
            'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all',
            uploading
              ? 'border-brand-accent bg-brand-accent/5'
              : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
          )}
        >
          <div className="flex gap-2">
            <Image className="w-8 h-8 text-[#5f5a55] dark:text-[#b2b6c2]" />
            <Video className="w-8 h-8 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </div>
          <div className="text-center">
            <p className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-medium">
              {uploading ? 'Uploading...' : 'Click to upload image or video'}
            </p>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
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
        <div className="relative rounded-xl overflow-hidden border-2 border-[#e1ddd8] dark:border-[#262b35]">
          {mediaType === 'video' ? (
            <video src={mediaUrl} controls className="w-full max-h-80 object-contain bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="Uploaded media" className="w-full max-h-80 object-contain" />
          )}
          <button
            type="button"
            onClick={removeMedia}
            className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
