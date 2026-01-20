'use client';

import { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { MediaUpload } from './MediaUpload';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  label?: string;
  showMediaToolbar?: boolean;
  mediaFolder?: 'events' | 'articles' | 'courses' | 'courses/lessons';
  /** Custom upload endpoint URL (defaults to /api/admin/upload-media) */
  uploadEndpoint?: string;
  /** Variant style: 'default' has bordered container, 'inline' is Notion-like with no background */
  variant?: 'default' | 'inline';
}

// Media Insert Dialog for inline content
function MediaInsertDialog({
  isOpen,
  mediaType,
  onClose,
  onInsert,
  folder,
  uploadEndpoint,
}: {
  isOpen: boolean;
  mediaType: 'image' | 'video';
  onClose: () => void;
  onInsert: (url: string) => void;
  folder: 'events' | 'articles' | 'courses' | 'courses/lessons';
  uploadEndpoint: string;
}) {
  const [url, setUrl] = useState('');

  const handleInsert = () => {
    if (url) {
      onInsert(url);
      setUrl('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-white dark:bg-[#171b22] rounded-2xl w-full max-w-md mx-4 shadow-xl">
        <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Insert {mediaType === 'image' ? 'Image' : 'Video'}
          </h3>
        </div>
        <div className="p-4">
          <MediaUpload
            value={url}
            onChange={setUrl}
            folder={folder}
            type={mediaType}
            label={mediaType === 'image' ? 'Upload Image' : 'Upload Video'}
            uploadEndpoint={uploadEndpoint}
          />
        </div>
        <div className="p-4 border-t border-[#e1ddd8] dark:border-[#262b35] flex justify-end gap-3">
          <button
            type="button"
            onClick={() => { setUrl(''); onClose(); }}
            className="px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:bg-[#faf8f6] dark:hover:bg-white/5 font-albert text-sm font-medium transition-colors text-[#1a1a1a] dark:text-[#f5f5f8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!url}
            className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-lg font-albert text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

// Link Insert Dialog
function LinkInsertDialog({
  isOpen,
  onClose,
  onInsert,
  initialText,
}: {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (url: string, text: string) => void;
  initialText: string;
}) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState(initialText);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  const handleInsert = () => {
    if (url) {
      onInsert(url, text || url);
      setUrl('');
      setText('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-white dark:bg-[#171b22] rounded-2xl w-full max-w-md mx-4 shadow-xl">
        <div className="p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Insert Link
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Link Text
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Display text"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
            />
          </div>
        </div>
        <div className="p-4 border-t border-[#e1ddd8] dark:border-[#262b35] flex justify-end gap-3">
          <button
            type="button"
            onClick={() => { setUrl(''); setText(''); onClose(); }}
            className="px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:bg-[#faf8f6] dark:hover:bg-white/5 font-albert text-sm font-medium transition-colors text-[#1a1a1a] dark:text-[#f5f5f8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!url}
            className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-lg font-albert text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

// Toolbar button component
function ToolbarButton({
  onClick,
  title,
  active,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`
        p-1.5 rounded transition-colors
        ${active
          ? 'bg-brand-accent text-white'
          : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-brand-accent/10 hover:text-brand-accent dark:hover:text-brand-accent'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
}

// Toolbar separator
function ToolbarSeparator() {
  return <div className="w-px h-5 bg-[#e1ddd8] dark:bg-[#262b35] mx-1" />;
}

// Editor Toolbar Component
function EditorToolbar({
  editor,
  showMediaToolbar,
  onImageClick,
  onVideoClick,
  onLinkClick,
  isExpanded,
  onToggleExpand,
  isInline = false,
}: {
  editor: Editor | null;
  showMediaToolbar: boolean;
  onImageClick: () => void;
  onVideoClick: () => void;
  onLinkClick: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isInline?: boolean;
}) {
  if (!editor) return null;

  return (
    <div className={`flex flex-wrap items-center gap-0.5 p-2 ${
      isInline
        ? 'bg-transparent border-b border-[#e1ddd8]/60 dark:border-[#262b35]/60'
        : 'bg-[#faf8f6] dark:bg-[#11141b] rounded-t-lg border border-[#e1ddd8] dark:border-[#262b35] border-b-0'
    }`}>
      {/* Text Formatting */}
      <ToolbarButton 
        onClick={() => editor.chain().focus().toggleBold().run()} 
        title="Bold (Ctrl+B)"
        active={editor.isActive('bold')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
      </ToolbarButton>
      
      <ToolbarButton 
        onClick={() => editor.chain().focus().toggleItalic().run()} 
        title="Italic (Ctrl+I)"
        active={editor.isActive('italic')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0v16m-4 0h8" transform="skewX(-10)" />
        </svg>
      </ToolbarButton>

      <ToolbarButton 
        onClick={() => editor.chain().focus().toggleStrike().run()} 
        title="Strikethrough"
        active={editor.isActive('strike')}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 12h18v2H3v-2zm6-7h6v3H9V5zm0 14h6v-3H9v3z" />
        </svg>
      </ToolbarButton>
      
      <ToolbarSeparator />
      
      {/* Headings */}
      <ToolbarButton 
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
        title="Heading 1"
        active={editor.isActive('heading', { level: 1 })}
      >
        <span className="font-bold text-xs font-albert">H1</span>
      </ToolbarButton>
      
      <ToolbarButton 
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
        title="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
      >
        <span className="font-bold text-xs font-albert">H2</span>
      </ToolbarButton>
      
      <ToolbarButton 
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} 
        title="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
      >
        <span className="font-bold text-xs font-albert">H3</span>
      </ToolbarButton>
      
      <ToolbarSeparator />
      
      {/* Lists */}
      <ToolbarButton 
        onClick={() => editor.chain().focus().toggleBulletList().run()} 
        title="Bullet List"
        active={editor.isActive('bulletList')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h.01M8 6h12M4 12h.01M8 12h12M4 18h.01M8 18h12" />
        </svg>
      </ToolbarButton>
      
      <ToolbarButton 
        onClick={() => editor.chain().focus().toggleOrderedList().run()} 
        title="Numbered List"
        active={editor.isActive('orderedList')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h.01M4 12h.01M4 18h.01M8 6h12M8 12h12M8 18h12" />
          <text x="2" y="8" fontSize="6" fill="currentColor" className="font-bold">1</text>
          <text x="2" y="14" fontSize="6" fill="currentColor" className="font-bold">2</text>
          <text x="2" y="20" fontSize="6" fill="currentColor" className="font-bold">3</text>
        </svg>
      </ToolbarButton>
      
      <ToolbarSeparator />
      
      {/* Quote & Link */}
      <ToolbarButton 
        onClick={() => editor.chain().focus().toggleBlockquote().run()} 
        title="Blockquote"
        active={editor.isActive('blockquote')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </ToolbarButton>
      
      <ToolbarButton 
        onClick={onLinkClick} 
        title="Insert Link"
        active={editor.isActive('link')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </ToolbarButton>
      
      {showMediaToolbar && (
        <>
          <ToolbarSeparator />
          
          {/* Media */}
          <ToolbarButton onClick={onImageClick} title="Insert Image">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </ToolbarButton>
          
          <ToolbarButton onClick={onVideoClick} title="Insert Video">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </ToolbarButton>
        </>
      )}
      
      {/* Expand toggle - always show on right */}
      <div className="ml-auto flex items-center gap-1">
        <ToolbarButton 
          onClick={onToggleExpand} 
          title={isExpanded ? "Collapse editor (Esc)" : "Expand editor"}
          active={isExpanded}
        >
          {isExpanded ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </ToolbarButton>
      </div>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your content here...',
  rows = 12,
  required = false,
  label,
  showMediaToolbar = true,
  mediaFolder = 'articles',
  uploadEndpoint = '/api/admin/upload-media',
  variant = 'default',
}: RichTextEditorProps) {
  const isInline = variant === 'inline';
  const [mediaInsertType, setMediaInsertType] = useState<'image' | 'video' | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  // Calculate min-height based on rows
  const minHeight = rows * 24; // ~24px per row

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full rounded-lg my-4',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-brand-accent underline hover:text-brand-accent/90',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none font-albert text-[#1a1a1a] dark:text-[#f5f5f8]`,
      },
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Prevent body scroll when expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  const handleLinkClick = useCallback(() => {
    if (editor) {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, '');
      setSelectedText(text);
      setShowLinkDialog(true);
    }
  }, [editor]);

  const insertLink = useCallback((url: string, text: string) => {
    if (editor) {
      if (text) {
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${url}">${text}</a>`)
          .run();
      } else {
        editor
          .chain()
          .focus()
          .setLink({ href: url })
          .run();
      }
    }
  }, [editor]);

  const insertImage = useCallback((url: string) => {
    if (editor) {
      editor
        .chain()
        .focus()
        .setImage({ src: url })
        .run();
    }
  }, [editor]);

  const insertVideo = useCallback((url: string) => {
    if (editor) {
      // Insert video as HTML - TipTap will handle it as raw HTML
      editor
        .chain()
        .focus()
        .insertContent(`<video src="${url}" controls class="max-w-full rounded-lg my-4"></video>`)
        .run();
    }
  }, [editor]);

  const editorContent = (
    <div>
      {label && !isExpanded && (
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 font-albert">
          {label} {required && '*'}
        </label>
      )}

      {/* Formatting Toolbar */}
      <EditorToolbar
        editor={editor}
        showMediaToolbar={showMediaToolbar}
        onImageClick={() => setMediaInsertType('image')}
        onVideoClick={() => setMediaInsertType('video')}
        onLinkClick={handleLinkClick}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        isInline={isInline}
      />
      
      {/* Editor Content Area */}
      <div
        className={`
          w-full
          ${isInline
            ? 'py-4'
            : 'px-4 py-3 border border-[#e1ddd8] dark:border-[#262b35] rounded-b-lg bg-white dark:bg-[#171b22] overflow-auto focus-within:ring-2 focus-within:ring-brand-accent'
          }
          ${isExpanded ? 'flex-1' : ''}
        `}
        style={{ minHeight: isInline ? undefined : (isExpanded ? undefined : `${minHeight}px`) }}
      >
        <EditorContent editor={editor} className={isInline ? '' : 'min-h-full'} />
      </div>

      {/* Help text - only for default variant */}
      {!isExpanded && !isInline && (
        <p className="mt-1.5 text-xs text-[#5f5a55] dark:text-[#7d8190] font-albert">
          Supports Markdown formatting. Use the toolbar or keyboard shortcuts (Ctrl+B for bold, Ctrl+I for italic).
        </p>
      )}
    </div>
  );

  // Fullscreen overlay wrapper
  if (isExpanded) {
    return (
      <>
        <div className="fixed inset-0 bg-black/80 z-[60]" onClick={() => setIsExpanded(false)} />
        <div className="fixed inset-4 md:inset-8 lg:inset-12 bg-white dark:bg-[#171b22] rounded-2xl z-[61] flex flex-col shadow-2xl overflow-hidden">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
            <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {label || 'Edit Content'}
            </h3>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-2 rounded-lg hover:bg-[#e1ddd8]/50 dark:hover:bg-[#262b35]/50 transition-colors"
              title="Close (Esc)"
            >
              <svg className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Toolbar in fullscreen */}
          <EditorToolbar
            editor={editor}
            showMediaToolbar={showMediaToolbar}
            onImageClick={() => setMediaInsertType('image')}
            onVideoClick={() => setMediaInsertType('video')}
            onLinkClick={handleLinkClick}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
          />
          
          {/* Editor Content in fullscreen */}
          <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <EditorContent 
              editor={editor} 
              className="min-h-full prose prose-lg dark:prose-invert max-w-4xl mx-auto"
            />
          </div>
        </div>
        
        {/* Dialogs */}
        <MediaInsertDialog
          isOpen={mediaInsertType !== null}
          mediaType={mediaInsertType || 'image'}
          onClose={() => setMediaInsertType(null)}
          onInsert={mediaInsertType === 'video' ? insertVideo : insertImage}
          folder={mediaFolder}
          uploadEndpoint={uploadEndpoint}
        />
        
        <LinkInsertDialog
          isOpen={showLinkDialog}
          onClose={() => setShowLinkDialog(false)}
          onInsert={insertLink}
          initialText={selectedText}
        />
      </>
    );
  }

  return (
    <>
      {editorContent}
      
      {/* Media Insert Dialog */}
      <MediaInsertDialog
        isOpen={mediaInsertType !== null}
        mediaType={mediaInsertType || 'image'}
        onClose={() => setMediaInsertType(null)}
        onInsert={mediaInsertType === 'video' ? insertVideo : insertImage}
        folder={mediaFolder}
        uploadEndpoint={uploadEndpoint}
      />
      
      {/* Link Insert Dialog */}
      <LinkInsertDialog
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        onInsert={insertLink}
        initialText={selectedText}
      />
    </>
  );
}
