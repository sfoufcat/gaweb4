'use client';

import parse, { DOMNode, Element, domToReact, HTMLReactParserOptions } from 'html-react-parser';
import Image from 'next/image';

interface RichContentProps {
  content: string;
  className?: string;
}

// Check if URL is a video
const isVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

// Parser options for html-react-parser
const parserOptions: HTMLReactParserOptions = {
  replace: (domNode: DOMNode) => {
    if (domNode instanceof Element) {
      const { name, attribs, children } = domNode;

      // Handle images - render video player if URL is a video
      if (name === 'img') {
        const src = attribs.src;
        const alt = attribs.alt || 'Image';
        
        if (!src) return null;
        
        if (isVideoUrl(src)) {
          return (
            <div className="my-6 rounded-xl overflow-hidden bg-black">
              <video
                src={src}
                controls
                className="w-full h-auto"
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          );
        }
        
        return (
          <span className="block my-6 relative w-full aspect-video rounded-xl overflow-hidden">
            <Image
              src={src}
              alt={alt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 700px"
            />
          </span>
        );
      }

      // Handle videos
      if (name === 'video') {
        const src = attribs.src;
        return (
          <div className="my-6 rounded-xl overflow-hidden bg-black">
            <video
              src={src}
              controls
              className="w-full h-auto"
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );
      }

      // Style paragraphs
      if (name === 'p') {
        return (
          <p className="mb-4 last:mb-0 leading-relaxed">
            {domToReact(children as DOMNode[], parserOptions)}
          </p>
        );
      }

      // Style headings
      if (name === 'h1') {
        return (
          <h1 className="font-albert font-bold text-2xl mt-8 mb-4 text-text-primary">
            {domToReact(children as DOMNode[], parserOptions)}
          </h1>
        );
      }
      if (name === 'h2') {
        return (
          <h2 className="font-albert font-semibold text-xl mt-6 mb-3 text-text-primary">
            {domToReact(children as DOMNode[], parserOptions)}
          </h2>
        );
      }
      if (name === 'h3') {
        return (
          <h3 className="font-albert font-semibold text-lg mt-4 mb-2 text-text-primary">
            {domToReact(children as DOMNode[], parserOptions)}
          </h3>
        );
      }

      // Style links
      if (name === 'a') {
        return (
          <a 
            href={attribs.href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-earth-600 dark:text-[#b8896a] hover:text-earth-700 dark:hover:text-[#a07855] dark:text-[#b8896a] underline"
          >
            {domToReact(children as DOMNode[], parserOptions)}
          </a>
        );
      }

      // Style lists - use list-outside with padding for proper bullet alignment
      if (name === 'ul') {
        return (
          <ul className="list-disc pl-5 mb-4 space-y-1">
            {domToReact(children as DOMNode[], parserOptions)}
          </ul>
        );
      }
      if (name === 'ol') {
        return (
          <ol className="list-decimal pl-5 mb-4 space-y-1">
            {domToReact(children as DOMNode[], parserOptions)}
          </ol>
        );
      }
      
      // Style list items - handle TipTap's nested <p> tags inside <li>
      if (name === 'li') {
        return (
          <li className="[&>p]:inline [&>p]:mb-0">
            {domToReact(children as DOMNode[], parserOptions)}
          </li>
        );
      }

      // Style blockquotes
      if (name === 'blockquote') {
        return (
          <blockquote className="border-l-4 border-earth-300 dark:border-[#b8896a] pl-4 my-4 italic text-text-muted">
            {domToReact(children as DOMNode[], parserOptions)}
          </blockquote>
        );
      }

      // Style code
      if (name === 'code') {
        return (
          <code className="bg-earth-100 dark:bg-[#1e222a] px-1.5 py-0.5 rounded text-sm font-mono">
            {domToReact(children as DOMNode[], parserOptions)}
          </code>
        );
      }

      // Style bold
      if (name === 'strong' || name === 'b') {
        return (
          <strong className="font-semibold">
            {domToReact(children as DOMNode[], parserOptions)}
          </strong>
        );
      }

      // Style italic
      if (name === 'em' || name === 'i') {
        return (
          <em className="italic">
            {domToReact(children as DOMNode[], parserOptions)}
          </em>
        );
      }

      // Style strikethrough
      if (name === 's' || name === 'del' || name === 'strike') {
        return (
          <s className="line-through">
            {domToReact(children as DOMNode[], parserOptions)}
          </s>
        );
      }
    }
    return undefined;
  }
};

/**
 * RichContent component for rendering HTML content from the TipTap editor.
 * Handles images, videos, and all common HTML formatting elements.
 */
export function RichContent({ content, className = '' }: RichContentProps) {
  if (!content) return null;
  
  // Check if content looks like HTML (has tags)
  const isHtml = /<[a-z][\s\S]*>/i.test(content);
  
  if (isHtml) {
    return (
      <div className={className}>
        {parse(content, parserOptions)}
      </div>
    );
  }
  
  // Fallback for plain text - preserve line breaks
  return (
    <div className={className}>
      {content.split('\n').map((paragraph, index) => (
        <p key={index} className="mb-4 last:mb-0 leading-relaxed">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

