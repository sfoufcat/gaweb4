'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, Upload, RotateCcw, Save, Palette, Type, ImageIcon } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import type { OrgBranding, OrgBrandingColors } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL } from '@/types';

/**
 * CustomizeBrandingTab
 * 
 * Allows coaches to customize their organization's branding:
 * - Logo upload
 * - App title
 * - Colors (menu, background, accent) for light and dark modes
 * - Preview mode to see changes before saving
 */
export function CustomizeBrandingTab() {
  const { setPreviewMode, isPreviewMode, refetch } = useBranding();
  
  // Form state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [appTitle, setAppTitle] = useState(DEFAULT_APP_TITLE);
  const [colors, setColors] = useState<OrgBrandingColors>(DEFAULT_BRANDING_COLORS);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Original values for comparison
  const [originalBranding, setOriginalBranding] = useState<OrgBranding | null>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current branding on mount
  const fetchBranding = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/org/branding');
      if (!response.ok) {
        throw new Error('Failed to fetch branding settings');
      }
      
      const data = await response.json();
      const branding = data.branding as OrgBranding;
      
      setOriginalBranding(branding);
      setLogoUrl(branding.logoUrl);
      setAppTitle(branding.appTitle);
      setColors(branding.colors);
    } catch (err) {
      console.error('Error fetching branding:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch branding');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  // Check for changes
  useEffect(() => {
    if (!originalBranding) return;
    
    const changed = 
      logoUrl !== originalBranding.logoUrl ||
      appTitle !== originalBranding.appTitle ||
      JSON.stringify(colors) !== JSON.stringify(originalBranding.colors);
    
    setHasChanges(changed);
  }, [logoUrl, appTitle, colors, originalBranding]);

  // Build preview branding object
  const getPreviewBranding = useCallback((): OrgBranding => {
    return {
      id: originalBranding?.id || 'preview',
      organizationId: originalBranding?.organizationId || 'preview',
      logoUrl,
      appTitle,
      colors,
      createdAt: originalBranding?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [logoUrl, appTitle, colors, originalBranding]);

  // Toggle preview mode
  const handleTogglePreview = () => {
    if (isPreviewMode) {
      setPreviewMode(false);
    } else {
      setPreviewMode(true, getPreviewBranding());
    }
  };

  // Update preview when values change (if preview is enabled)
  useEffect(() => {
    if (isPreviewMode) {
      setPreviewMode(true, getPreviewBranding());
    }
  }, [logoUrl, appTitle, colors, isPreviewMode, setPreviewMode, getPreviewBranding]);

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/org/branding/logo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload logo');
      }

      const data = await response.json();
      setLogoUrl(data.url);
      setSuccessMessage('Logo uploaded successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error uploading logo:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  // Handle color change
  const handleColorChange = (key: keyof OrgBrandingColors, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  // Reset to defaults
  const handleResetToDefaults = () => {
    setLogoUrl(DEFAULT_LOGO_URL);
    setAppTitle(DEFAULT_APP_TITLE);
    setColors(DEFAULT_BRANDING_COLORS);
  };

  // Revert changes
  const handleRevertChanges = () => {
    if (originalBranding) {
      setLogoUrl(originalBranding.logoUrl);
      setAppTitle(originalBranding.appTitle);
      setColors(originalBranding.colors);
    }
  };

  // Save branding
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/org/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl,
          appTitle,
          colors,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save branding');
      }

      const data = await response.json();
      setOriginalBranding(data.branding);
      setSuccessMessage('Branding saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Refetch branding in context
      await refetch();
      
      // Disable preview mode after saving
      setPreviewMode(false);
    } catch (err) {
      console.error('Error saving branding:', err);
      setError(err instanceof Error ? err.message : 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading branding settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert tracking-[-0.5px]">
              Customize Your Branding
            </h2>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm">
              Personalize the look and feel of your app. These settings will apply to your organization
              when custom domains or subdomains are configured.
            </p>
          </div>
          
          {/* Preview Toggle */}
          <button
            onClick={handleTogglePreview}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full font-albert text-sm transition-all
              ${isPreviewMode 
                ? 'bg-[#a07855] text-white hover:bg-[#8c6245]' 
                : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e8e5e1] dark:hover:bg-[#313746]'
              }
            `}
          >
            {isPreviewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isPreviewMode ? 'Exit Preview' : 'Preview'}
          </button>
        </div>
        
        {isPreviewMode && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl">
            <p className="text-amber-700 dark:text-amber-300 text-sm font-albert">
              Preview mode is active. The sidebar is showing your customized branding.
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <p className="text-red-600 dark:text-red-300 font-albert">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl p-4">
          <p className="text-green-600 dark:text-green-300 font-albert">{successMessage}</p>
        </div>
      )}

      {/* Logo Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Logo</h3>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Logo Preview */}
          <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-white dark:bg-[#262b35] border-2 border-dashed border-[#e1ddd8] dark:border-[#313746]">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Organization logo"
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-[#a7a39e] dark:text-[#5f6775]" />
              </div>
            )}
          </div>
          
          {/* Upload Button */}
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] rounded-xl hover:bg-[#e8e5e1] dark:hover:bg-[#313746] transition-colors font-albert text-sm disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload Logo'}
            </button>
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-2 font-albert">
              Recommended: Square image, at least 512×512px. Max 5MB.
            </p>
          </div>
        </div>
      </div>

      {/* App Title Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">App Title</h3>
        </div>
        
        <input
          type="text"
          value={appTitle}
          onChange={(e) => setAppTitle(e.target.value)}
          placeholder="Enter app title"
          className="w-full max-w-md px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
        />
        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-2 font-albert">
          This appears in the sidebar next to your logo.
        </p>
      </div>

      {/* Colors Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Colors</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Light Mode Colors */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert uppercase tracking-wide">
              Light Mode
            </h4>
            
            <ColorPicker
              label="Menu Background"
              value={colors.menuLight}
              onChange={(v) => handleColorChange('menuLight', v)}
            />
            <ColorPicker
              label="Page Background"
              value={colors.bgLight}
              onChange={(v) => handleColorChange('bgLight', v)}
            />
            <ColorPicker
              label="Accent Color"
              value={colors.accentLight}
              onChange={(v) => handleColorChange('accentLight', v)}
            />
          </div>
          
          {/* Dark Mode Colors */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert uppercase tracking-wide">
              Dark Mode
            </h4>
            
            <ColorPicker
              label="Menu Background"
              value={colors.menuDark}
              onChange={(v) => handleColorChange('menuDark', v)}
            />
            <ColorPicker
              label="Page Background"
              value={colors.bgDark}
              onChange={(v) => handleColorChange('bgDark', v)}
            />
            <ColorPicker
              label="Accent Color"
              value={colors.accentDark}
              onChange={(v) => handleColorChange('accentDark', v)}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-2 px-4 py-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          
          {hasChanges && (
            <button
              onClick={handleRevertChanges}
              className="flex items-center gap-2 px-4 py-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert text-sm transition-colors"
            >
              Revert Changes
            </button>
          )}
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#a07855] hover:bg-[#8c6245] disabled:bg-[#a07855]/50 text-white rounded-xl font-albert text-sm transition-colors disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

/**
 * Color Picker Component
 */
interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2 py-1.5 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg text-xs text-[#1a1a1a] dark:text-[#f5f5f8] font-mono focus:outline-none focus:ring-1 focus:ring-[#a07855]/20"
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="w-10 h-10 rounded-lg border-2 border-[#e1ddd8] dark:border-[#313746] overflow-hidden cursor-pointer hover:border-[#a07855] dark:hover:border-[#b8896a] transition-colors"
          style={{ backgroundColor: value }}
        >
          <input
            ref={inputRef}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="opacity-0 w-full h-full cursor-pointer"
          />
        </button>
      </div>
    </div>
  );
}

export default CustomizeBrandingTab;
