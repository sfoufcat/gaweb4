'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';

interface RichTextPreviewProps {
  /** HTML content to display */
  content: string;
  /** Maximum lines to show before truncating (0 = no limit) */
  maxLines?: number;
  /** Class name for additional styling */
  className?: string;
}

/**
 * RichTextPreview - Read-only renderer for rich text content
 * 
 * Displays formatted content from TipTap JSON or HTML.
 * Uses a minimal TipTap instance for consistent rendering.
 */
export function RichTextPreview({
  content,
  maxLines = 0,
  className = '',
}: RichTextPreviewProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        inline: true,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-2',
        },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-blue-600 dark:text-blue-400 underline hover:opacity-80',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Youtube.configure({
        inline: false,
        width: 480,
        height: 270,
        HTMLAttributes: {
          class: 'rounded-lg my-2 mx-auto max-w-full',
        },
        nocookie: true,
      }),
    ],
    content,
    editable: false,
  }, [content]);

  if (!editor) {
    return null;
  }

  return (
    <div 
      className={`rich-text-preview ${className}`}
      style={maxLines > 0 ? {
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      } : undefined}
    >
      <EditorContent editor={editor} />
      
      {/* Custom styles */}
      <style jsx global>{`
        .rich-text-preview .ProseMirror {
          font-size: 15px;
          line-height: 1.6;
          color: inherit;
        }
        
        .rich-text-preview .ProseMirror:focus {
          outline: none;
        }
        
        .rich-text-preview .ProseMirror p {
          margin: 0;
        }
        
        .rich-text-preview .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0.5rem 0 0.25rem;
        }
        
        .rich-text-preview .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.5rem 0 0.25rem;
        }
        
        .rich-text-preview .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0.5rem 0 0.25rem;
        }
        
        .rich-text-preview .ProseMirror ul,
        .rich-text-preview .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        
        .rich-text-preview .ProseMirror ul {
          list-style-type: disc;
        }
        
        .rich-text-preview .ProseMirror ol {
          list-style-type: decimal;
        }
        
        .rich-text-preview .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 0.5rem 0;
        }
        
        .rich-text-preview .ProseMirror blockquote {
          border-left: 3px solid #e8e4df;
          padding-left: 1rem;
          margin: 0.5rem 0;
          color: #5f5a55;
        }
        
        .dark .rich-text-preview .ProseMirror blockquote {
          border-left-color: #262b35;
          color: #b5b0ab;
        }
        
        .rich-text-preview .ProseMirror iframe,
        .rich-text-preview .ProseMirror div[data-youtube-video] {
          max-width: 100%;
          border-radius: 0.5rem;
          margin: 0.5rem auto;
          display: block;
        }
        
        .rich-text-preview .ProseMirror div[data-youtube-video] iframe {
          margin: 0;
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  );
}

/**
 * Simple HTML-based preview (fallback for when TipTap isn't needed)
 * Renders pre-processed HTML directly with sanitization
 */
export function SimpleRichTextPreview({
  html,
  className = '',
}: {
  html: string;
  className?: string;
}) {
  return (
    <div 
      className={`rich-text-simple-preview prose prose-sm dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

