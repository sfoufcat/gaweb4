'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, Upload, RotateCcw, Save, Palette, Type, ImageIcon, Globe, Link2, Trash2, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import type { OrgBranding, OrgBrandingColors, OrgCustomDomain, CustomDomainStatus } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, validateSubdomain } from '@/types';

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
  
  // Domain settings state
  const [currentSubdomain, setCurrentSubdomain] = useState<string>('');
  const [newSubdomain, setNewSubdomain] = useState('');
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [subdomainLoading, setSubdomainLoading] = useState(false);
  const [subdomainSuccess, setSubdomainSuccess] = useState(false);
  const [customDomains, setCustomDomains] = useState<Array<{
    id: string;
    domain: string;
    status: CustomDomainStatus;
    verificationToken: string;
    verifiedAt?: string;
  }>>([]);
  const [newCustomDomain, setNewCustomDomain] = useState('');
  const [customDomainError, setCustomDomainError] = useState<string | null>(null);
  const [customDomainLoading, setCustomDomainLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [domainSettingsLoading, setDomainSettingsLoading] = useState(true);
  const [reverifyingDomainId, setReverifyingDomainId] = useState<string | null>(null);

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

  // Fetch domain settings
  const fetchDomainSettings = useCallback(async () => {
    try {
      setDomainSettingsLoading(true);
      const response = await fetch('/api/coach/org-domain');
      if (!response.ok) {
        console.error('Failed to fetch domain settings');
        return;
      }
      
      const data = await response.json();
      setCurrentSubdomain(data.subdomain || '');
      setNewSubdomain(data.subdomain || '');
      setCustomDomains(data.customDomains || []);
    } catch (err) {
      console.error('Error fetching domain settings:', err);
    } finally {
      setDomainSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
    fetchDomainSettings();
  }, [fetchBranding, fetchDomainSettings]);
  
  // Handle subdomain update
  const handleSubdomainUpdate = async () => {
    const validation = validateSubdomain(newSubdomain);
    if (!validation.valid) {
      setSubdomainError(validation.error || 'Invalid subdomain');
      return;
    }
    
    if (newSubdomain.toLowerCase() === currentSubdomain) {
      setSubdomainError('This is already your current subdomain');
      return;
    }
    
    setSubdomainLoading(true);
    setSubdomainError(null);
    
    try {
      const response = await fetch('/api/coach/org-domain', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: newSubdomain }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update subdomain');
      }
      
      setCurrentSubdomain(data.subdomain);
      setNewSubdomain(data.subdomain);
      setSubdomainSuccess(true);
      setTimeout(() => setSubdomainSuccess(false), 3000);
    } catch (err) {
      setSubdomainError(err instanceof Error ? err.message : 'Failed to update subdomain');
    } finally {
      setSubdomainLoading(false);
    }
  };
  
  // Handle add custom domain
  const handleAddCustomDomain = async () => {
    if (!newCustomDomain.trim()) {
      setCustomDomainError('Please enter a domain');
      return;
    }
    
    setCustomDomainLoading(true);
    setCustomDomainError(null);
    
    try {
      const response = await fetch('/api/coach/org-domain/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newCustomDomain }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add custom domain');
      }
      
      // Add to list
      setCustomDomains(prev => [data.customDomain, ...prev]);
      setNewCustomDomain('');
    } catch (err) {
      setCustomDomainError(err instanceof Error ? err.message : 'Failed to add custom domain');
    } finally {
      setCustomDomainLoading(false);
    }
  };
  
  // Handle remove custom domain
  const handleRemoveCustomDomain = async (domainId: string) => {
    if (!confirm('Are you sure you want to remove this custom domain?')) return;
    
    try {
      const response = await fetch(`/api/coach/org-domain/custom/${domainId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove domain');
      }
      
      setCustomDomains(prev => prev.filter(d => d.id !== domainId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove domain');
    }
  };
  
  // Handle reverify custom domain
  const handleReverifyDomain = async (domainId: string) => {
    setReverifyingDomainId(domainId);
    
    try {
      const response = await fetch(`/api/coach/org-domain/custom/${domainId}`, {
        method: 'PATCH',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify domain');
      }
      
      // Update the domain in the list
      setCustomDomains(prev => prev.map(d => 
        d.id === domainId 
          ? { ...d, status: data.domain.status, verifiedAt: data.domain.verifiedAt }
          : d
      ));
      
      if (data.verified) {
        setSuccessMessage(`Domain verified successfully via ${data.method?.toUpperCase()}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to verify domain');
    } finally {
      setReverifyingDomainId(null);
    }
  };
  
  // Copy to clipboard
  const copyToClipboard = async (text: string, tokenId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(tokenId);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      alert('Failed to copy to clipboard');
    }
  };

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

      {/* Domain Settings Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Domain Settings</h3>
        </div>
        
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-6 font-albert">
          Configure your subdomain and custom domains for your branded experience.
        </p>
        
        {domainSettingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-3 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Subdomain Section */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Subdomain
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <input
                    type="text"
                    value={newSubdomain}
                    onChange={(e) => {
                      setNewSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setSubdomainError(null);
                    }}
                    placeholder="your-subdomain"
                    className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
                  />
                  <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-nowrap">
                    .growthaddicts.app
                  </span>
                </div>
                <button
                  onClick={handleSubdomainUpdate}
                  disabled={subdomainLoading || newSubdomain === currentSubdomain}
                  className="px-4 py-2.5 bg-[#a07855] hover:bg-[#8c6245] disabled:bg-[#a07855]/50 text-white rounded-xl font-albert text-sm transition-colors disabled:cursor-not-allowed"
                >
                  {subdomainLoading ? 'Saving...' : 'Update'}
                </button>
              </div>
              
              {subdomainError && (
                <p className="text-sm text-red-600 dark:text-red-400 font-albert">{subdomainError}</p>
              )}
              
              {subdomainSuccess && (
                <p className="text-sm text-green-600 dark:text-green-400 font-albert">Subdomain updated successfully!</p>
              )}
              
              {currentSubdomain && (
                <div className="flex items-center gap-2 p-3 bg-[#a07855]/10 dark:bg-[#b8896a]/10 rounded-xl">
                  <Link2 className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
                  <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-mono">
                    https://{currentSubdomain}.growthaddicts.app
                  </span>
                  <a
                    href={`https://${currentSubdomain}.growthaddicts.app`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[#a07855] dark:text-[#b8896a] hover:opacity-70 transition-opacity"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
            
            {/* Divider */}
            <div className="border-t border-[#e1ddd8] dark:border-[#313746]"></div>
            
            {/* Custom Domains Section */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Custom Domains
              </label>
              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                Add your own domain for a fully branded experience (e.g., app.yourdomain.com)
              </p>
              
              {/* Add new domain form */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newCustomDomain}
                  onChange={(e) => {
                    setNewCustomDomain(e.target.value.toLowerCase());
                    setCustomDomainError(null);
                  }}
                  placeholder="app.yourdomain.com"
                  className="flex-1 max-w-md px-4 py-2.5 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
                />
                <button
                  onClick={handleAddCustomDomain}
                  disabled={customDomainLoading || !newCustomDomain.trim()}
                  className="px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e8e5e1] dark:hover:bg-[#313746] disabled:opacity-50 rounded-xl font-albert text-sm transition-colors disabled:cursor-not-allowed"
                >
                  {customDomainLoading ? 'Adding...' : 'Add Domain'}
                </button>
              </div>
              
              {customDomainError && (
                <p className="text-sm text-red-600 dark:text-red-400 font-albert">{customDomainError}</p>
              )}
              
              {/* Custom domains list */}
              {customDomains.length > 0 && (
                <div className="space-y-3 mt-4">
                  {customDomains.map((domain) => (
                    <div
                      key={domain.id}
                      className="p-4 bg-[#f8f7f5] dark:bg-[#1e222a] rounded-xl border border-[#e1ddd8] dark:border-[#313746]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                          <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            {domain.domain}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`
                            px-2 py-0.5 text-xs font-medium rounded-full font-albert
                            ${domain.status === 'verified' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : domain.status === 'failed'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }
                          `}>
                            {domain.status === 'verified' ? 'Verified' : domain.status === 'failed' ? 'Failed' : 'Pending'}
                          </span>
                          {domain.status !== 'verified' && (
                            <button
                              onClick={() => handleReverifyDomain(domain.id)}
                              disabled={reverifyingDomainId === domain.id}
                              className="p-1.5 text-[#a07855] dark:text-[#b8896a] hover:bg-[#a07855]/10 dark:hover:bg-[#b8896a]/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Re-verify domain"
                            >
                              <RefreshCw className={`w-4 h-4 ${reverifyingDomainId === domain.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveCustomDomain(domain.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {domain.status !== 'verified' && (
                        <div className="mt-3 space-y-3">
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                            Add these DNS records to your domain provider:
                          </p>
                          
                          {/* DNS Record Cards */}
                          <div className="space-y-2">
                            {/* CNAME for routing */}
                            <div className="p-3 bg-white dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#313746]">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-medium text-[#a07855] dark:text-[#b8896a] uppercase tracking-wide font-albert">
                                  CNAME Record
                                </span>
                                <span className="text-[10px] text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                                  For routing
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-[#8c8c8c] dark:text-[#7d8190] font-albert">Name</span>
                                  <div className="flex items-center gap-1.5">
                                    <code className="text-xs font-mono text-[#1a1a1a] dark:text-[#f5f5f8]">@</code>
                                    <button
                                      onClick={() => copyToClipboard('@', `${domain.id}-cname-name`)}
                                      className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded transition-colors"
                                    >
                                      {copiedToken === `${domain.id}-cname-name` ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-[#8c8c8c] dark:text-[#7d8190] font-albert">Value</span>
                                  <div className="flex items-center gap-1.5">
                                    <code className="text-xs font-mono text-[#1a1a1a] dark:text-[#f5f5f8]">cname.vercel-dns.com</code>
                                    <button
                                      onClick={() => copyToClipboard('cname.vercel-dns.com', `${domain.id}-cname-value`)}
                                      className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded transition-colors"
                                    >
                                      {copiedToken === `${domain.id}-cname-value` ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* CNAME for Clerk authentication */}
                            <div className="p-3 bg-white dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#313746]">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-medium text-[#a07855] dark:text-[#b8896a] uppercase tracking-wide font-albert">
                                  CNAME Record
                                </span>
                                <span className="text-[10px] text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                                  For authentication
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-[#8c8c8c] dark:text-[#7d8190] font-albert">Name</span>
                                  <div className="flex items-center gap-1.5">
                                    <code className="text-xs font-mono text-[#1a1a1a] dark:text-[#f5f5f8]">clerk</code>
                                    <button
                                      onClick={() => copyToClipboard('clerk', `${domain.id}-clerk-name`)}
                                      className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded transition-colors"
                                    >
                                      {copiedToken === `${domain.id}-clerk-name` ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-[#8c8c8c] dark:text-[#7d8190] font-albert">Value</span>
                                  <div className="flex items-center gap-1.5">
                                    <code className="text-xs font-mono text-[#1a1a1a] dark:text-[#f5f5f8]">frontend-api.clerk.services</code>
                                    <button
                                      onClick={() => copyToClipboard('frontend-api.clerk.services', `${domain.id}-clerk-value`)}
                                      className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded transition-colors"
                                    >
                                      {copiedToken === `${domain.id}-clerk-value` ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="text-[10px] text-[#a7a39e] dark:text-[#7d8190] font-albert">
                            DNS changes may take up to 24 hours to propagate. Click the refresh icon to re-verify.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {customDomains.length === 0 && (
                <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] font-albert py-4">
                  No custom domains added yet.
                </p>
              )}
            </div>
          </div>
        )}
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
