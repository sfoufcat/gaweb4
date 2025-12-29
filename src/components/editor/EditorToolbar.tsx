'use client';

import type { Editor } from '@tiptap/react';

interface EditorToolbarProps {
  editor: Editor;
  onAddImage?: () => void;
  onAddLink?: () => void;
  onAddYoutube?: () => void;
  accentColor?: string;
  isUploading?: boolean;
}

/**
 * EditorToolbar - Formatting toolbar for the rich text editor
 * 
 * Provides buttons for:
 * - Headings (H1, H2, H3)
 * - Bold, Italic, Strike
 * - Bullet list, Ordered list
 * - Link, Image
 */
export function EditorToolbar({
  editor,
  onAddImage,
  onAddLink,
  onAddYoutube,
  accentColor = 'var(--brand-accent-light)',
  isUploading = false,
}: EditorToolbarProps) {
  // Button base classes
  const buttonBase = 'p-1.5 rounded-lg transition-colors';
  const buttonInactive = 'text-[#8a857f] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35]';
  const buttonActive = 'bg-[#f5f3f0] dark:bg-[#262b35]';

  // Get active state style
  const getButtonClass = (isActive: boolean) => 
    `${buttonBase} ${isActive ? buttonActive : buttonInactive}`;

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-2.5 border-b border-[#e8e4df]/60 dark:border-[#262b35]/60 bg-white dark:bg-[#171b22] mb-3">
      {/* Text formatting group */}
      <div className="flex items-center gap-0.5 mr-2">
        {/* Bold */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={getButtonClass(editor.isActive('bold'))}
          title="Bold (Ctrl+B)"
          style={editor.isActive('bold') ? { color: accentColor } : undefined}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={getButtonClass(editor.isActive('italic'))}
          title="Italic (Ctrl+I)"
          style={editor.isActive('italic') ? { color: accentColor } : undefined}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0v16m6-16h-4m-8 16h4" transform="skewX(-10)" />
          </svg>
        </button>

        {/* Strike */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={getButtonClass(editor.isActive('strike'))}
          title="Strikethrough"
          style={editor.isActive('strike') ? { color: accentColor } : undefined}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12M9 6a3 3 0 016 0c0 1.5-1 2-3 3m0 6c2 0 3 1 3 3a3 3 0 01-6 0" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[#e8e4df] dark:bg-[#262b35] mx-1" />

      {/* Heading group */}
      <div className="flex items-center gap-0.5 mr-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={getButtonClass(editor.isActive('heading', { level: 1 }))}
          title="Heading 1"
          style={editor.isActive('heading', { level: 1 }) ? { color: accentColor } : undefined}
        >
          <span className="text-[11px] font-bold">H1</span>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={getButtonClass(editor.isActive('heading', { level: 2 }))}
          title="Heading 2"
          style={editor.isActive('heading', { level: 2 }) ? { color: accentColor } : undefined}
        >
          <span className="text-[11px] font-bold">H2</span>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={getButtonClass(editor.isActive('heading', { level: 3 }))}
          title="Heading 3"
          style={editor.isActive('heading', { level: 3 }) ? { color: accentColor } : undefined}
        >
          <span className="text-[11px] font-bold">H3</span>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[#e8e4df] dark:bg-[#262b35] mx-1" />

      {/* List group */}
      <div className="flex items-center gap-0.5 mr-2">
        {/* Bullet list */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={getButtonClass(editor.isActive('bulletList'))}
          title="Bullet List"
          style={editor.isActive('bulletList') ? { color: accentColor } : undefined}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
        </button>

        {/* Ordered list */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={getButtonClass(editor.isActive('orderedList'))}
          title="Numbered List"
          style={editor.isActive('orderedList') ? { color: accentColor } : undefined}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[#e8e4df] dark:bg-[#262b35] mx-1" />

      {/* Link and Image group */}
      <div className="flex items-center gap-0.5">
        {/* Link */}
        {onAddLink && (
          <button
            type="button"
            onClick={onAddLink}
            className={getButtonClass(editor.isActive('link'))}
            title="Add Link"
            style={editor.isActive('link') ? { color: accentColor } : undefined}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
        )}

        {/* Image */}
        {onAddImage && (
          <button
            type="button"
            onClick={onAddImage}
            disabled={isUploading}
            className={`${buttonBase} ${buttonInactive} disabled:opacity-50`}
            title="Add Image"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        )}

        {/* YouTube Video */}
        {onAddYoutube && (
          <button
            type="button"
            onClick={onAddYoutube}
            className={`${buttonBase} ${buttonInactive}`}
            title="Embed YouTube Video"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={`${buttonBase} ${buttonInactive} disabled:opacity-30`}
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={`${buttonBase} ${buttonInactive} disabled:opacity-30`}
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

