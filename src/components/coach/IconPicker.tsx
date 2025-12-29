'use client';

import { useState, useRef, useEffect } from 'react';

// Available predefined icons with their display names
export const AVAILABLE_ICONS = [
  { id: 'home', name: 'Home' },
  { id: 'users', name: 'Users' },
  { id: 'rocket', name: 'Rocket' },
  { id: 'search', name: 'Search' },
  { id: 'message', name: 'Message' },
  { id: 'user', name: 'User' },
  { id: 'shield', name: 'Shield' },
  { id: 'book', name: 'Book' },
  { id: 'chart', name: 'Chart' },
  { id: 'compass', name: 'Compass' },
  { id: 'flag', name: 'Flag' },
  { id: 'calendar', name: 'Calendar' },
  { id: 'star', name: 'Star' },
  { id: 'heart', name: 'Heart' },
  { id: 'lightning', name: 'Lightning' },
  { id: 'fire', name: 'Fire' },
  { id: 'globe', name: 'Globe' },
  { id: 'sparkles', name: 'Sparkles' },
] as const;

// Icon SVG paths (same as in Sidebar.tsx)
const ICON_PATHS: Record<string, string> = {
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  rocket: "M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z",
  search: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
  message: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  compass: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  flag: "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  star: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  heart: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  lightning: "M13 10V3L4 14h7v7l9-11h-7z",
  fire: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z",
  globe: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  sparkles: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
};

// Common emojis for quick selection
const COMMON_EMOJIS = ['🏠', '👥', '🚀', '🔍', '💬', '👤', '🛡️', '📚', '📊', '🧭', '🚩', '📅', '⭐', '❤️', '⚡', '🔥', '🌍', '✨', '🎯', '💡', '🎓', '🏆', '💪', '🌟'];

// Helper function to check if a string is an emoji
function isEmoji(str: string): boolean {
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?)+$/u;
  return emojiRegex.test(str);
}

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  compact?: boolean; // Compact mode - just icon + chevron, no label text
}

export function IconPicker({ value, onChange, label, className = '', compact = false }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'icons' | 'emoji'>('icons');
  const [customEmoji, setCustomEmoji] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectIcon = (iconId: string) => {
    onChange(iconId);
    setIsOpen(false);
  };

  const handleSelectEmoji = (emoji: string) => {
    onChange(emoji);
    setIsOpen(false);
    setCustomEmoji('');
  };

  const handleCustomEmojiSubmit = () => {
    if (customEmoji && isEmoji(customEmoji)) {
      onChange(customEmoji);
      setIsOpen(false);
      setCustomEmoji('');
    }
  };

  // Render the current value as preview
  const renderPreview = () => {
    if (isEmoji(value)) {
      return <span className="text-xl">{value}</span>;
    }
    const path = ICON_PATHS[value];
    if (!path) {
      return <span className="text-xl">?</span>;
    }
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    );
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert hover:border-brand-accent dark:hover:border-brand-accent transition-colors ${
          compact ? 'px-3 py-3' : 'px-4 py-3 w-full'
        }`}
      >
        <span className="flex items-center justify-center w-6 h-6">
          {renderPreview()}
        </span>
        {!compact && (
          <span className="flex-1 text-left text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            {isEmoji(value) ? 'Custom emoji' : AVAILABLE_ICONS.find(i => i.id === value)?.name || 'Select icon'}
          </span>
        )}
        <svg className={`w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-72 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#e1ddd8] dark:border-[#313746]">
            <button
              type="button"
              onClick={() => setActiveTab('icons')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium font-albert transition-colors ${
                activeTab === 'icons'
                  ? 'text-brand-accent border-b-2 border-brand-accent'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
              }`}
            >
              Icons
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('emoji')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium font-albert transition-colors ${
                activeTab === 'emoji'
                  ? 'text-brand-accent border-b-2 border-brand-accent'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
              }`}
            >
              Emoji
            </button>
          </div>

          {/* Content */}
          <div className="p-3 max-h-64 overflow-y-auto">
            {activeTab === 'icons' ? (
              <div className="grid grid-cols-6 gap-1">
                {AVAILABLE_ICONS.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => handleSelectIcon(icon.id)}
                    title={icon.name}
                    className={`p-2 rounded-lg transition-colors ${
                      value === icon.id
                        ? 'bg-brand-accent/20 text-brand-accent'
                        : 'hover:bg-[#f5f5f8] dark:hover:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[icon.id]} />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Quick emoji selection */}
                <div className="grid grid-cols-8 gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSelectEmoji(emoji)}
                      className={`p-2 text-lg rounded-lg transition-colors ${
                        value === emoji
                          ? 'bg-brand-accent/20'
                          : 'hover:bg-[#f5f5f8] dark:hover:bg-[#262b35]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                
                {/* Custom emoji input */}
                <div className="pt-2 border-t border-[#e1ddd8] dark:border-[#313746]">
                  <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5">
                    Or enter any emoji:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customEmoji}
                      onChange={(e) => setCustomEmoji(e.target.value)}
                      placeholder="Paste emoji..."
                      className="flex-1 px-3 py-2 bg-[#f5f5f8] dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#313746] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] text-sm font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent"
                    />
                    <button
                      type="button"
                      onClick={handleCustomEmojiSubmit}
                      disabled={!customEmoji || !isEmoji(customEmoji)}
                      className="px-3 py-2 bg-brand-accent text-white rounded-lg text-sm font-albert font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#8a6647] dark:hover:bg-brand-accent/90 transition-colors"
                    >
                      Use
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

