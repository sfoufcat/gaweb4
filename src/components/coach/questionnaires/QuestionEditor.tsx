'use client';

import { useState, useRef } from 'react';
import { Trash2, Copy, X, Loader2, MoreVertical } from 'lucide-react';
import { QuestionOptionEditor } from './QuestionOptionEditor';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  QuestionnaireQuestion,
} from '@/types/questionnaire';

interface QuestionEditorProps {
  question: QuestionnaireQuestion;
  onUpdate: (updates: Partial<QuestionnaireQuestion>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function QuestionEditor({
  question,
  onUpdate,
  onDelete,
  onDuplicate,
}: QuestionEditorProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Render type-specific configuration
  const renderTypeConfig = () => {
    switch (question.type) {
      case 'single_choice':
        return (
          <QuestionOptionEditor
            options={question.options || []}
            onChange={options => onUpdate({ options })}
            allowImages
            isMultiChoice={false}
          />
        );
      case 'multi_choice':
        return (
          <QuestionOptionEditor
            options={question.options || []}
            onChange={options => onUpdate({ options })}
            allowImages
            isMultiChoice={true}
          />
        );

      case 'short_text':
      case 'long_text':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                Placeholder
              </label>
              <input
                type="text"
                value={question.placeholder || ''}
                onChange={e => onUpdate({ placeholder: e.target.value })}
                placeholder="Enter placeholder text..."
                className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Min Length
                </label>
                <input
                  type="number"
                  value={question.minLength || ''}
                  onChange={e =>
                    onUpdate({ minLength: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  placeholder="0"
                  min={0}
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Max Length
                </label>
                <input
                  type="number"
                  value={question.maxLength || ''}
                  onChange={e =>
                    onUpdate({ maxLength: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  placeholder={question.type === 'short_text' ? '500' : '5000'}
                  min={1}
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
                />
              </div>
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                Placeholder
              </label>
              <input
                type="text"
                value={question.placeholder || ''}
                onChange={e => onUpdate({ placeholder: e.target.value })}
                placeholder="Enter a number"
                className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Min Value
                </label>
                <input
                  type="number"
                  value={question.minValue ?? ''}
                  onChange={e =>
                    onUpdate({ minValue: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                  placeholder="No min"
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Max Value
                </label>
                <input
                  type="number"
                  value={question.maxValue ?? ''}
                  onChange={e =>
                    onUpdate({ maxValue: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                  placeholder="No max"
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
                />
              </div>
            </div>
          </div>
        );

      case 'scale':
        return (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Min Value
                </label>
                <input
                  type="number"
                  value={question.minValue ?? 1}
                  onChange={e => onUpdate({ minValue: parseInt(e.target.value) || 1 })}
                  min={0}
                  max={9}
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Max Value
                </label>
                <input
                  type="number"
                  value={question.maxValue ?? 5}
                  onChange={e => onUpdate({ maxValue: parseInt(e.target.value) || 5 })}
                  min={2}
                  max={10}
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  Low Label
                </label>
                <input
                  type="text"
                  value={question.scaleLabels?.min || ''}
                  onChange={e =>
                    onUpdate({
                      scaleLabels: { ...question.scaleLabels, min: e.target.value, max: question.scaleLabels?.max || '' },
                    })
                  }
                  placeholder="e.g., Not satisfied"
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  High Label
                </label>
                <input
                  type="text"
                  value={question.scaleLabels?.max || ''}
                  onChange={e =>
                    onUpdate({
                      scaleLabels: { min: question.scaleLabels?.min || '', max: e.target.value },
                    })
                  }
                  placeholder="e.g., Very satisfied"
                  className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
                />
              </div>
            </div>
            {/* Scale Preview */}
            <div className="mt-2">
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-2 font-albert">Preview</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  {question.scaleLabels?.min || 'Low'}
                </span>
                <div className="flex gap-2">
                  {Array.from(
                    { length: (question.maxValue ?? 5) - (question.minValue ?? 1) + 1 },
                    (_, i) => (question.minValue ?? 1) + i
                  ).map(num => (
                    <div
                      key={num}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e1ddd8] dark:border-[#262b35] text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2]"
                    >
                      {num}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  {question.scaleLabels?.max || 'High'}
                </span>
              </div>
            </div>
          </div>
        );

      case 'file_upload':
      case 'media_upload':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                Accepted File Types
              </label>
              <Select
                value={question.acceptedFileTypes?.join(',') || '*/*'}
                onValueChange={value => {
                  onUpdate({
                    acceptedFileTypes: value === '*/*' ? ['*/*'] : value.split(','),
                  });
                }}
              >
                <SelectTrigger className="w-full px-3 py-2 h-auto text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                  <SelectValue placeholder="Select file types" />
                </SelectTrigger>
                <SelectContent>
                  {question.type === 'media_upload' ? (
                    <>
                      <SelectItem value="image/*,video/*">Images & Videos</SelectItem>
                      <SelectItem value="image/*">Images only</SelectItem>
                      <SelectItem value="video/*">Videos only</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="*/*">All files</SelectItem>
                      <SelectItem value="application/pdf">PDF only</SelectItem>
                      <SelectItem value="image/*">Images only</SelectItem>
                      <SelectItem value="application/pdf,image/*">PDF & Images</SelectItem>
                      <SelectItem value=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                        Word Documents
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                Max File Size (MB)
              </label>
              <input
                type="number"
                value={question.maxFileSizeMB || 10}
                onChange={e => onUpdate({ maxFileSizeMB: parseInt(e.target.value) || 10 })}
                min={1}
                max={100}
                className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
              />
            </div>
          </div>
        );

      case 'info':
        return <InfoStepEditor question={question} onUpdate={onUpdate} />;

      case 'page_break':
        // Page break is handled in QuestionnaireBuilder with inline display
        return null;

      default:
        return null;
    }
  };

  // Desktop Layout
  if (isDesktop) {
    return (
      <div className="flex">
        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Question Title */}
          <input
            type="text"
            value={question.title}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder={question.type === 'info' ? 'Add a title (optional)...' : question.type === 'page_break' ? 'Section title (optional)...' : 'Type your question here...'}
            className="w-full text-base font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert bg-transparent border-none outline-none placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
          />

          {/* Description */}
          <input
            type="text"
            value={question.description || ''}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Add description (optional)"
            className="w-full text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert bg-transparent border-none outline-none placeholder-[#c9cdd4] dark:placeholder-[#4b5563]/60"
          />

          {/* Type-specific configuration */}
          <div className="pt-1">
            {renderTypeConfig()}
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div className="w-40 ml-4 pl-4 border-l border-[#e1ddd8]/40 dark:border-[#262b35]/30 space-y-4">
          {/* Required Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Required</span>
            <button
              type="button"
              onClick={() => onUpdate({ required: !question.required })}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                question.required ? 'bg-brand-accent' : 'bg-[#d1cdc8] dark:bg-[#3a4150]'
              }`}
            >
              <span
                className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  question.required ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-1 pt-2 border-t border-[#e1ddd8]/40 dark:border-[#262b35]/30">
            <button
              onClick={onDuplicate}
              className="p-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
              title="Duplicate"
            >
              <Copy className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-red-500" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mobile Layout
  return (
    <div className="space-y-3">
      {/* Header Row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Question Title */}
          <input
            type="text"
            value={question.title}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder={question.type === 'info' ? 'Add a title (optional)...' : question.type === 'page_break' ? 'Section title (optional)...' : 'Type your question here...'}
            className="w-full text-base font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert bg-transparent border-none outline-none placeholder-[#c9cdd4] dark:placeholder-[#4b5563]"
          />

          {/* Description */}
          <input
            type="text"
            value={question.description || ''}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Add description (optional)"
            className="w-full mt-1 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert bg-transparent border-none outline-none placeholder-[#c9cdd4] dark:placeholder-[#4b5563]/60"
          />
        </div>

        {/* Required Toggle + Overflow Menu */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onUpdate({ required: !question.required })}
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
              question.required ? 'bg-brand-accent' : 'bg-[#d1cdc8] dark:bg-[#3a4150]'
            }`}
            title={question.required ? 'Required' : 'Optional'}
          >
            <span
              className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                question.required ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors">
                <MoreVertical className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-500 focus:text-red-500">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Type-specific configuration */}
      {renderTypeConfig()}
    </div>
  );
}

// Info Step Editor Component
function InfoStepEditor({
  question,
  onUpdate,
}: {
  question: QuestionnaireQuestion;
  onUpdate: (updates: Partial<QuestionnaireQuestion>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMediaUpload = async (file: File, type: 'image' | 'video') => {
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    // Check for HEIC files
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload to your upload endpoint
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (isHeic) {
          throw new Error('HEIC files are not supported. Please convert to JPG or PNG first.');
        }
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      onUpdate({
        mediaUrl: data.url,
        mediaType: type,
      });
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      // For HEIC errors, show a friendly message
      if (isHeic || errorMessage.toLowerCase().includes('heic')) {
        setUploadError('HEIC format is not supported. Please convert your image to JPG or PNG.');
        return;
      }

      // For other errors, try creating a local object URL as fallback
      try {
        const objectUrl = URL.createObjectURL(file);
        onUpdate({
          mediaUrl: objectUrl,
          mediaType: type,
        });
      } catch {
        setUploadError(errorMessage);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveMedia = () => {
    onUpdate({
      mediaUrl: undefined,
      mediaType: undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Media Display/Upload */}
      {question.mediaUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-[#e1ddd8] dark:border-[#262b35]">
          {question.mediaType === 'video' ? (
            <video
              src={question.mediaUrl}
              controls
              className="w-full max-h-64 object-contain bg-black"
            />
          ) : (
            <img
              src={question.mediaUrl}
              alt="Info step media"
              className="w-full max-h-64 object-contain bg-[#f3f1ef] dark:bg-[#262b35]"
            />
          )}
          <button
            onClick={handleRemoveMedia}
            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const isVideo = file.type.startsWith('video/');
                handleMediaUpload(file, isVideo ? 'video' : 'image');
              }
            }}
            className="hidden"
          />
          {uploading ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Uploading...
            </span>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-brand-accent hover:text-brand-accent/80 hover:underline font-albert transition-colors"
            >
              + Insert image or video
            </button>
          )}
          {uploadError && (
            <p className="text-xs text-red-500 font-albert">{uploadError}</p>
          )}
        </div>
      )}

      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
        This step displays information to the user without requiring any input.
      </p>
    </div>
  );
}
