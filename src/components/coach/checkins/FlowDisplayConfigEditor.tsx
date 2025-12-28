'use client';

import React, { useState } from 'react';
import { Sparkles, Sun, Moon, Coffee, Zap, Heart, Star, Flame, Target, Music, BookOpen, Lightbulb, Smile, Brain, Palette } from 'lucide-react';
import type { FlowDisplayConfig } from '@/types';

interface FlowDisplayConfigEditorProps {
  value: FlowDisplayConfig | undefined;
  onChange: (config: FlowDisplayConfig) => void;
}

// Preset icon options
const ICON_OPTIONS: { name: string; icon: React.ElementType }[] = [
  { name: 'sparkles', icon: Sparkles },
  { name: 'sun', icon: Sun },
  { name: 'moon', icon: Moon },
  { name: 'coffee', icon: Coffee },
  { name: 'zap', icon: Zap },
  { name: 'heart', icon: Heart },
  { name: 'star', icon: Star },
  { name: 'flame', icon: Flame },
  { name: 'target', icon: Target },
  { name: 'music', icon: Music },
  { name: 'book-open', icon: BookOpen },
  { name: 'lightbulb', icon: Lightbulb },
  { name: 'smile', icon: Smile },
  { name: 'brain', icon: Brain },
];

// Preset gradient options
const GRADIENT_PRESETS = [
  { name: 'Purple Indigo', value: 'from-purple-500 to-indigo-600' },
  { name: 'Blue Cyan', value: 'from-blue-500 to-cyan-500' },
  { name: 'Green Teal', value: 'from-emerald-500 to-teal-600' },
  { name: 'Orange Red', value: 'from-orange-500 to-red-600' },
  { name: 'Pink Rose', value: 'from-pink-500 to-rose-600' },
  { name: 'Amber Yellow', value: 'from-amber-500 to-yellow-500' },
  { name: 'Slate Gray', value: 'from-slate-600 to-slate-800' },
  { name: 'Violet Purple', value: 'from-violet-500 to-purple-700' },
  { name: 'Lime Green', value: 'from-lime-500 to-green-600' },
  { name: 'Sky Blue', value: 'from-sky-400 to-blue-600' },
];

// Common emoji options
const EMOJI_OPTIONS = ['🧘', '💪', '🎯', '🌟', '💫', '🔥', '🌈', '🎵', '📚', '💡', '🙏', '☕'];

export function FlowDisplayConfigEditor({ value, onChange }: FlowDisplayConfigEditorProps) {
  const [iconMode, setIconMode] = useState<'icon' | 'emoji'>(
    value?.icon && EMOJI_OPTIONS.includes(value.icon) ? 'emoji' : 'icon'
  );
  
  const config: FlowDisplayConfig = {
    title: value?.title || '',
    subtitle: value?.subtitle || '',
    icon: value?.icon || 'sparkles',
    gradient: value?.gradient || GRADIENT_PRESETS[0].value,
  };

  const updateConfig = (updates: Partial<FlowDisplayConfig>) => {
    onChange({ ...config, ...updates });
  };

  // Get current icon component for preview
  const CurrentIcon = iconMode === 'icon' 
    ? ICON_OPTIONS.find(i => i.name === config.icon)?.icon || Sparkles
    : null;

  return (
    <div className="space-y-6">
      <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
        Homepage Card Display
      </label>

      {/* Preview Card */}
      <div className="relative">
        <p className="text-xs text-text-muted dark:text-[#666d7c] mb-2">Preview</p>
        <div 
          className={`h-[120px] rounded-2xl overflow-hidden relative flex flex-col items-center justify-center bg-gradient-to-br ${config.gradient}`}
        >
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 text-center">
            {iconMode === 'emoji' && config.icon ? (
              <span className="text-[28px] mb-2 block">{config.icon}</span>
            ) : CurrentIcon && (
              <CurrentIcon className="w-8 h-8 text-white mb-2 mx-auto" />
            )}
            <p className="text-lg font-medium text-white leading-tight">
              {config.title || 'Card Title'}
            </p>
            {config.subtitle && (
              <p className="text-sm text-white/80 mt-1">
                {config.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs text-text-secondary dark:text-[#b2b6c2] mb-1.5">
          Card Title
        </label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => updateConfig({ title: e.target.value })}
          placeholder="e.g., Midday Reset"
          className="w-full px-4 py-2.5 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#666d7c] focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:focus:border-[#b8896a]"
        />
      </div>

      {/* Subtitle */}
      <div>
        <label className="block text-xs text-text-secondary dark:text-[#b2b6c2] mb-1.5">
          Card Subtitle (optional)
        </label>
        <input
          type="text"
          value={config.subtitle || ''}
          onChange={(e) => updateConfig({ subtitle: e.target.value || undefined })}
          placeholder="e.g., Take a mindful break"
          className="w-full px-4 py-2.5 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#666d7c] focus:outline-none focus:border-[#a07855] dark:border-[#b8896a] dark:focus:border-[#b8896a]"
        />
      </div>

      {/* Icon Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs text-text-secondary dark:text-[#b2b6c2]">
            Icon
          </label>
          <div className="flex gap-1 bg-[#f5f3f0] dark:bg-[#0d1015] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setIconMode('icon')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                iconMode === 'icon' 
                  ? 'bg-white dark:bg-[#1a1f28] text-text-primary dark:text-[#f5f5f8] shadow-sm' 
                  : 'text-text-muted dark:text-[#666d7c]'
              }`}
            >
              Icons
            </button>
            <button
              type="button"
              onClick={() => setIconMode('emoji')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                iconMode === 'emoji' 
                  ? 'bg-white dark:bg-[#1a1f28] text-text-primary dark:text-[#f5f5f8] shadow-sm' 
                  : 'text-text-muted dark:text-[#666d7c]'
              }`}
            >
              Emoji
            </button>
          </div>
        </div>

        {iconMode === 'icon' ? (
          <div className="flex flex-wrap gap-2">
            {ICON_OPTIONS.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => updateConfig({ icon: name })}
                className={`p-2.5 rounded-xl transition-all ${
                  config.icon === name
                    ? 'bg-[#a07855] text-white scale-110'
                    : 'bg-[#f5f3f0] dark:bg-[#0d1015] text-text-secondary dark:text-[#b2b6c2] hover:bg-[#e8e5e1] dark:hover:bg-[#1a1f28]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => updateConfig({ icon: emoji })}
                  className={`p-2 text-xl rounded-xl transition-all ${
                    config.icon === emoji
                      ? 'bg-[#a07855]/20 scale-110 ring-2 ring-[#a07855] dark:ring-[#b8896a]'
                      : 'bg-[#f5f3f0] dark:bg-[#0d1015] hover:bg-[#e8e5e1] dark:hover:bg-[#1a1f28]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={!EMOJI_OPTIONS.includes(config.icon || '') ? config.icon : ''}
              onChange={(e) => updateConfig({ icon: e.target.value || 'sparkles' })}
              placeholder="Or type custom emoji..."
              maxLength={4}
              className="w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-sm text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#666d7c]"
            />
          </div>
        )}
      </div>

      {/* Gradient Selection */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-4 h-4 text-text-muted dark:text-[#666d7c]" />
          <label className="block text-xs text-text-secondary dark:text-[#b2b6c2]">
            Background Color
          </label>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => updateConfig({ gradient: preset.value })}
              title={preset.name}
              className={`h-10 rounded-lg bg-gradient-to-br ${preset.value} transition-all ${
                config.gradient === preset.value
                  ? 'ring-2 ring-[#a07855] dark:ring-[#b8896a] ring-offset-2 ring-offset-white dark:ring-offset-[#171b22] scale-105'
                  : 'hover:scale-105'
              }`}
            />
          ))}
        </div>
        <input
          type="text"
          value={!GRADIENT_PRESETS.find(p => p.value === config.gradient) ? config.gradient : ''}
          onChange={(e) => updateConfig({ gradient: e.target.value || GRADIENT_PRESETS[0].value })}
          placeholder="Or enter custom Tailwind gradient classes..."
          className="mt-2 w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-xs text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#666d7c]"
        />
      </div>
    </div>
  );
}

