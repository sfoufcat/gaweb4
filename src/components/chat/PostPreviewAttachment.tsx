'use client';

import Image from 'next/image';
import Link from 'next/link';

interface PostPreviewAttachmentProps {
  title: string;
  text?: string;
  imageUrl?: string;
  linkUrl: string;
  authorName?: string;
  authorIcon?: string;
  isMine: boolean;
}

/**
 * PostPreviewAttachment - Renders a rich preview card for shared feed posts
 * 
 * - Shows post title, preview text, and optional image
 * - Clickable card that navigates to the post
 * - Styled appropriately for sender/receiver messages
 */
export function PostPreviewAttachment({
  title,
  text,
  imageUrl,
  linkUrl,
  authorName,
  authorIcon,
  isMine,
}: PostPreviewAttachmentProps) {
  return (
    <Link
      href={linkUrl}
      className={`block rounded-xl overflow-hidden border transition-all hover:opacity-90 ${
        isMine
          ? 'bg-white/10 border-white/20 hover:bg-white/15'
          : 'bg-[#f9f7f5] dark:bg-[#1a1e26] border-[#e8e4df] dark:border-[#262b35] hover:border-brand-accent/30'
      }`}
    >
      {/* Post Image (if available) */}
      {imageUrl && (
        <div className="relative w-full h-32 overflow-hidden">
          <Image
            src={imageUrl}
            alt="Post preview"
            fill
            className="object-cover"
          />
        </div>
      )}
      
      <div className="p-3">
        {/* Author info (if available) */}
        {(authorName || authorIcon) && (
          <div className="flex items-center gap-2 mb-2">
            {authorIcon ? (
              <Image
                src={authorIcon}
                alt={authorName || 'Author'}
                width={20}
                height={20}
                className="rounded-full object-cover"
              />
            ) : (
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                isMine 
                  ? 'bg-white/20 text-white' 
                  : 'bg-brand-accent text-white'
              }`}>
                {(authorName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            {authorName && (
              <span className={`text-[12px] font-medium ${
                isMine ? 'text-white/80' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`}>
                {authorName}
              </span>
            )}
          </div>
        )}
        
        {/* Title */}
        <p className={`text-[13px] font-semibold leading-tight mb-1 ${
          isMine ? 'text-white' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
        }`}>
          {title}
        </p>
        
        {/* Preview text */}
        {text && (
          <p className={`text-[12px] leading-[1.4] line-clamp-2 ${
            isMine ? 'text-white/70' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
          }`}>
            {text}
          </p>
        )}
        
        {/* Link indicator */}
        <div className={`flex items-center gap-1.5 mt-2 ${
          isMine ? 'text-white/60' : 'text-brand-accent'
        }`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span className="text-[11px] font-medium">View post</span>
        </div>
      </div>
    </Link>
  );
}









