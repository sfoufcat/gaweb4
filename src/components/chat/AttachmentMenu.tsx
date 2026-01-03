'use client';

import { useRef, useEffect } from 'react';
import { useDragToDismiss } from '@/hooks/useDragToDismiss';

/**
 * AttachmentMenu Component
 * 
 * Bottom sheet (mobile) / Popover (desktop) with attachment options:
 * - Gallery: Select images from library
 * - Camera: Take a photo
 * - Poll: Create a new poll
 * 
 * Matches Figma design: node-id=455-1856
 */

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onGalleryClick: () => void;
  onCameraClick: () => void;
  onPollClick: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

// Gallery Icon
function GalleryIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[#1a1a1a] dark:stroke-[#f5f5f8]">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5"/>
      <path d="M21 15L16 10L5 21" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Camera Icon
function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[#1a1a1a] dark:stroke-[#f5f5f8]">
      <path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 3H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="13" r="4" strokeWidth="1.5"/>
    </svg>
  );
}

// Poll/Chart Bar Icon
function PollIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-[#1a1a1a] dark:stroke-[#f5f5f8]">
      <path d="M18 20V10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 20V4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 20V14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function AttachmentMenu({
  isOpen,
  onClose,
  onGalleryClick,
  onCameraClick,
  onPollClick,
  anchorRef,
}: AttachmentMenuProps) {
  const { sheetRef, handleRef, handleProps } = useDragToDismiss({ onClose });
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Don't close if clicking on anchor
        if (anchorRef?.current?.contains(e.target as Node)) return;
        onClose();
      }
    };
    if (isOpen) {
      // Small delay to prevent immediate close
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const menuItems = [
    { icon: <GalleryIcon />, label: 'Gallery', onClick: onGalleryClick },
    { icon: <CameraIcon />, label: 'Camera', onClick: onCameraClick },
    { icon: <PollIcon />, label: 'Poll', onClick: onPollClick },
  ];

  return (
    <>
      {/* Mobile: Bottom Sheet */}
      <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center">
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black/20 backdrop-blur-[6px]"
          onClick={onClose}
        />

        {/* Bottom Sheet */}
        <div
          ref={sheetRef}
          className="relative w-full bg-white dark:bg-[#171b22] rounded-t-[20px] shadow-2xl animate-in slide-in-from-bottom duration-200"
        >
          {/* Grabber (drag handle) */}
          <div ref={handleRef} {...handleProps} className="flex justify-center pt-2 pb-4 touch-none select-none cursor-grab active:cursor-grabbing">
            <div className="w-9 h-[5px] bg-[rgba(30,30,47,0.4)] dark:bg-[#313746] rounded-[2.5px]" />
          </div>

          {/* Menu Items */}
          <div className="flex items-start justify-start gap-3 px-4 pb-6 overflow-x-auto">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                className="flex flex-col items-center gap-1.5 min-w-[80px]"
              >
                {/* Icon Container */}
                <div className="w-[60px] h-[60px] rounded-[20px] bg-white dark:bg-[#1e222a] border border-[rgba(215,210,204,0.5)] dark:border-[#262b35] flex items-center justify-center hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors">
                  {item.icon}
                </div>
                {/* Label */}
                <span className="font-albert text-[14px] text-[#000000] dark:text-[#f5f5f8] capitalize tracking-[-1px] leading-none">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {/* Home Indicator Spacer */}
          <div className="h-8 w-full flex justify-center">
            <div className="w-36 h-[5px] bg-[#1a1a1a] dark:bg-[#f5f5f8] rounded-[100px]" />
          </div>
        </div>
      </div>

      {/* Desktop: Popover anchored to button */}
      <div 
        ref={menuRef}
        className="hidden lg:block absolute bottom-full left-0 mb-2 z-50"
      >
        <div className="bg-white dark:bg-[#171b22] rounded-[16px] shadow-xl border border-[#e1ddd8] dark:border-[#262b35] p-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-[12px] hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] transition-colors"
              >
                {/* Icon Container */}
                <div className="w-[48px] h-[48px] rounded-[16px] bg-[#f3f1ef] dark:bg-[#1e222a] flex items-center justify-center">
                  {item.icon}
                </div>
                {/* Label */}
                <span className="font-albert text-[12px] text-[#1a1a1a] dark:text-[#f5f5f8] capitalize tracking-[-0.5px]">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default AttachmentMenu;

