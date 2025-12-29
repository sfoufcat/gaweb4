'use client';

import { ComponentConfig } from '@measured/puck';

export interface RichTextProps {
  content: string;
  alignment: 'left' | 'center' | 'right';
  maxWidth: 'sm' | 'md' | 'lg' | 'full';
}

export const RichText = ({
  content = '<p>Add your content here. You can use <strong>bold</strong>, <em>italic</em>, and other formatting.</p>',
  alignment = 'left',
  maxWidth = 'md',
}: RichTextProps) => {
  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center mx-auto',
    right: 'text-right ml-auto',
  };

  const maxWidthClasses = {
    sm: 'max-w-lg',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    full: 'max-w-none',
  };

  return (
    <section className="py-8 px-6">
      <div className={`${maxWidthClasses[maxWidth]} ${alignmentClasses[alignment]}`}>
        <div
          className="prose prose-gray dark:prose-invert max-w-none
            prose-headings:text-foreground
            prose-p:text-muted-foreground
            prose-strong:text-foreground
            prose-a:text-brand-accent prose-a:no-underline hover:prose-a:underline
            prose-ul:text-muted-foreground
            prose-ol:text-muted-foreground
            prose-li:text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </section>
  );
};

export const RichTextConfig: ComponentConfig<RichTextProps> = {
  label: 'Rich Text',
  fields: {
    content: {
      type: 'textarea',
      label: 'Content (HTML supported)',
    },
    alignment: {
      type: 'select',
      label: 'Alignment',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    maxWidth: {
      type: 'select',
      label: 'Max Width',
      options: [
        { label: 'Small', value: 'sm' },
        { label: 'Medium', value: 'md' },
        { label: 'Large', value: 'lg' },
        { label: 'Full', value: 'full' },
      ],
    },
  },
  defaultProps: {
    content: '<p>Add your content here. You can use <strong>bold</strong>, <em>italic</em>, and other formatting.</p>',
    alignment: 'left',
    maxWidth: 'md',
  },
  render: RichText,
};

