'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Youtube from '@tiptap/extension-youtube';
import { EditorToolbar } from './EditorToolbar';

interface RichTextEditorProps {
  /** Initial content (TipTap JSON or HTML string) */
  initialContent?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Callback when content changes */
  onChange?: (content: { json: object; html: string; text: string }) => void;
  /** Callback for file upload */
  onUploadImage?: (file: File) => Promise<string>;
  /** Whether to auto focus the editor */
  autoFocus?: boolean;
  /** Min height of the editor */
  minHeight?: string;
  /** Max height of the editor */
  maxHeight?: string;
  /** Accent color for toolbar buttons */
  accentColor?: string;
  /** Whether the editor is in read-only mode */
  readOnly?: boolean;
}

/**
 * RichTextEditor - TipTap-based rich text editor for feed posts
 * 
 * Features:
 * - Headings (H1, H2, H3)
 * - Bold, Italic, Strike
 * - Bullet and numbered lists
 * - Links
 * - Inline images
 * - Placeholder support
 */
export function RichTextEditor({
  initialContent,
  placeholder = "What's on your mind?",
  onChange,
  onUploadImage,
  autoFocus = true,
  minHeight = '120px',
  maxHeight = '400px',
  accentColor = 'var(--brand-accent-light)',
  readOnly = false,
}: RichTextEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-2',
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          class: 'text-blue-600 dark:text-blue-400 underline',
        },
      }),
      Youtube.configure({
        inline: false,
        width: 480,
        height: 270,
        HTMLAttributes: {
          class: 'rounded-lg my-2 mx-auto',
        },
        modestBranding: true,
        nocookie: true,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: initialContent || '',
    editable: !readOnly,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange({
          json: editor.getJSON(),
          html: editor.getHTML(),
          text: editor.getText(),
        });
      }
    },
  });

  // Handle image upload
  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor || !onUploadImage) return;

    setIsUploading(true);
    try {
      const url = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setIsUploading(false);
    }
  }, [editor, onUploadImage]);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleImageUpload]);

  // Trigger file input click
  const triggerImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle paste for images
  useEffect(() => {
    if (!editor) return;

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImageUpload(file);
          }
          break;
        }
      }
    };

    const editorElement = document.querySelector('.ProseMirror');
    editorElement?.addEventListener('paste', handlePaste as EventListener);

    return () => {
      editorElement?.removeEventListener('paste', handlePaste as EventListener);
    };
  }, [editor, handleImageUpload]);

  // Handle link addition
  const handleSetLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  // Handle YouTube video addition
  const handleAddYoutube = useCallback(() => {
    if (!editor) return;

    const url = window.prompt('Enter YouTube URL:');
    if (!url) return;

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    if (!youtubeRegex.test(url)) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    editor.commands.setYoutubeVideo({
      src: url,
    });
  }, [editor]);

  if (!editor) {
    return (
      <div 
        className="animate-pulse bg-[#f5f3f0] dark:bg-[#1a1f2a] rounded-xl"
        style={{ minHeight }}
      />
    );
  }

  return (
    <div className="relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Toolbar */}
      {!readOnly && (
        <EditorToolbar
          editor={editor}
          onAddImage={onUploadImage ? triggerImageUpload : undefined}
          onAddLink={handleSetLink}
          onAddYoutube={handleAddYoutube}
          accentColor={accentColor}
          isUploading={isUploading}
        />
      )}

      {/* Editor content */}
      <div 
        className="relative overflow-y-auto"
        style={{ minHeight, maxHeight }}
      >
        <EditorContent 
          editor={editor}
          className="rich-text-editor"
        />
      </div>

      {/* Upload indicator */}
      {isUploading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[14px] text-[#8a857f]">
            <div 
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
              style={{ borderColor: accentColor }}
            />
            Uploading...
          </div>
        </div>
      )}

      {/* Custom styles */}
      <style jsx global>{`
        .rich-text-editor .ProseMirror {
          min-height: ${minHeight};
          padding: 0.75rem 0;
        }
        
        .rich-text-editor .ProseMirror:focus {
          outline: none;
        }
        
        .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #8a857f;
          pointer-events: none;
          height: 0;
        }
        
        .rich-text-editor .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 0.5rem;
          margin-bottom: 0.25rem;
        }
        
        .rich-text-editor .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 0.5rem;
          margin-bottom: 0.25rem;
        }
        
        .rich-text-editor .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 0.5rem;
          margin-bottom: 0.25rem;
        }
        
        .rich-text-editor .ProseMirror ul,
        .rich-text-editor .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        
        .rich-text-editor .ProseMirror ul {
          list-style-type: disc;
        }
        
        .rich-text-editor .ProseMirror ol {
          list-style-type: decimal;
        }
        
        .rich-text-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 0.5rem 0;
        }
        
        .rich-text-editor .ProseMirror blockquote {
          border-left: 3px solid #e8e4df;
          padding-left: 1rem;
          margin: 0.5rem 0;
          color: #5f5a55;
        }
        
        .dark .rich-text-editor .ProseMirror blockquote {
          border-left-color: #262b35;
          color: #b5b0ab;
        }
        
        .rich-text-editor .ProseMirror iframe,
        .rich-text-editor .ProseMirror div[data-youtube-video] {
          max-width: 100%;
          border-radius: 0.5rem;
          margin: 0.5rem auto;
          display: block;
        }
        
        .rich-text-editor .ProseMirror div[data-youtube-video] iframe {
          margin: 0;
        }
      `}</style>
    </div>
  );
}

// Export a way to get editor content programmatically
export function getEditorContent(editor: Editor | null): { json: object; html: string; text: string } | null {
  if (!editor) return null;
  return {
    json: editor.getJSON(),
    html: editor.getHTML(),
    text: editor.getText(),
  };
}

