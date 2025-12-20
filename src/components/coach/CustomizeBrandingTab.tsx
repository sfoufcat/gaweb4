'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, Upload, RotateCcw, Save, Palette, Type, ImageIcon, Globe, Link2, Trash2, Copy, Check, ExternalLink, RefreshCw, CreditCard, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import type { OrgBranding, OrgBrandingColors, OrgMenuTitles, OrgCustomDomain, CustomDomainStatus, StripeConnectStatus } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES, validateSubdomain } from '@/types';

/**
 * CustomizeBrandingTab
 * 
 * Allows coaches to customize their organization's branding:
 * - Square logo upload
 * - Horizontal logo upload (replaces square logo + title)
 * - App title
 * - Accent colors for light and dark modes
 * - Preview mode to see changes before saving
 */
export function CustomizeBrandingTab() {
  const { setPreviewMode, isPreviewMode, refetch } = useBranding();
  
  // Form state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [horizontalLogoUrl, setHorizontalLogoUrl] = useState<string | null>(null);
  const [appTitle, setAppTitle] = useState(DEFAULT_APP_TITLE);
  const [colors, setColors] = useState<OrgBrandingColors>(DEFAULT_BRANDING_COLORS);
  const [menuTitles, setMenuTitles] = useState<OrgMenuTitles>(DEFAULT_MENU_TITLES);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingHorizontal, setUploadingHorizontal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Original values for comparison
  const [originalBranding, setOriginalBranding] = useState<OrgBranding | null>(null);
  
  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const horizontalFileInputRef = useRef<HTMLInputElement>(null);
  
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
  
  // Stripe Connect state
  const [stripeConnectStatus, setStripeConnectStatus] = useState<StripeConnectStatus>('not_connected');
  const [stripeConnectLoading, setStripeConnectLoading] = useState(true);
  const [stripeConnectActionLoading, setStripeConnectActionLoading] = useState(false);
  const [stripeAccountDetails, setStripeAccountDetails] = useState<{
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    detailsSubmitted?: boolean;
    platformFeePercent?: number;
  }>({});

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
      setHorizontalLogoUrl(branding.horizontalLogoUrl || null);
      setAppTitle(branding.appTitle);
      setColors(branding.colors);
      setMenuTitles(branding.menuTitles || DEFAULT_MENU_TITLES);
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

  // Fetch Stripe Connect status
  const fetchStripeConnect = useCallback(async () => {
    try {
      setStripeConnectLoading(true);
      const response = await fetch('/api/coach/stripe-connect');
      if (!response.ok) {
        console.error('Failed to fetch Stripe Connect status');
        return;
      }
      
      const data = await response.json();
      setStripeConnectStatus(data.stripeConnectStatus || 'not_connected');
      setStripeAccountDetails({
        chargesEnabled: data.chargesEnabled,
        payoutsEnabled: data.payoutsEnabled,
        detailsSubmitted: data.detailsSubmitted,
        platformFeePercent: data.platformFeePercent,
      });
    } catch (err) {
      console.error('Error fetching Stripe Connect status:', err);
    } finally {
      setStripeConnectLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchBranding();
    fetchDomainSettings();
    fetchStripeConnect();
    
    // Check URL for Stripe callback status
    const urlParams = new URLSearchParams(window.location.search);
    const stripeStatus = urlParams.get('stripe');
    if (stripeStatus === 'success') {
      setSuccessMessage('Stripe account connected successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (stripeStatus === 'pending') {
      setSuccessMessage('Stripe account setup in progress. Verification may take a few minutes.');
      setTimeout(() => setSuccessMessage(null), 5000);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (stripeStatus === 'error') {
      setError('Failed to connect Stripe account. Please try again.');
      setTimeout(() => setError(null), 5000);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (stripeStatus === 'refresh') {
      // User was redirected back, refresh the status
      fetchStripeConnect();
    }
  }, [fetchBranding, fetchDomainSettings, fetchStripeConnect]);
  
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
  
  // Handle Stripe Connect onboarding
  const handleStripeConnect = async () => {
    try {
      setStripeConnectActionLoading(true);
      const response = await fetch('/api/coach/stripe-connect', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create Stripe Connect link');
      }
      
      // Redirect to Stripe onboarding
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Error connecting Stripe:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect Stripe');
    } finally {
      setStripeConnectActionLoading(false);
    }
  };

  // Check for changes
  useEffect(() => {
    if (!originalBranding) return;
    
    const originalMenuTitles = originalBranding.menuTitles || DEFAULT_MENU_TITLES;
    const changed = 
      logoUrl !== originalBranding.logoUrl ||
      horizontalLogoUrl !== (originalBranding.horizontalLogoUrl || null) ||
      appTitle !== originalBranding.appTitle ||
      JSON.stringify(colors) !== JSON.stringify(originalBranding.colors) ||
      JSON.stringify(menuTitles) !== JSON.stringify(originalMenuTitles);
    
    setHasChanges(changed);
  }, [logoUrl, horizontalLogoUrl, appTitle, colors, menuTitles, originalBranding]);

  // Build preview branding object
  const getPreviewBranding = useCallback((): OrgBranding => {
    return {
      id: originalBranding?.id || 'preview',
      organizationId: originalBranding?.organizationId || 'preview',
      logoUrl,
      horizontalLogoUrl,
      appTitle,
      colors,
      menuTitles,
      createdAt: originalBranding?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [logoUrl, horizontalLogoUrl, appTitle, colors, menuTitles, originalBranding]);

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
  }, [logoUrl, horizontalLogoUrl, appTitle, colors, menuTitles, isPreviewMode, setPreviewMode, getPreviewBranding]);

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

  // Handle horizontal logo upload
  const handleHorizontalLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setUploadingHorizontal(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'horizontal');

      const response = await fetch('/api/org/branding/logo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload horizontal logo');
      }

      const data = await response.json();
      setHorizontalLogoUrl(data.url);
      setSuccessMessage('Horizontal logo uploaded successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error uploading horizontal logo:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload horizontal logo');
    } finally {
      setUploadingHorizontal(false);
    }
  };

  // Handle color change
  const handleColorChange = (key: keyof OrgBrandingColors, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  // Reset to defaults
  const handleResetToDefaults = () => {
    setLogoUrl(DEFAULT_LOGO_URL);
    setHorizontalLogoUrl(null);
    setAppTitle(DEFAULT_APP_TITLE);
    setColors(DEFAULT_BRANDING_COLORS);
    setMenuTitles(DEFAULT_MENU_TITLES);
  };

  // Revert changes
  const handleRevertChanges = () => {
    if (originalBranding) {
      setLogoUrl(originalBranding.logoUrl);
      setHorizontalLogoUrl(originalBranding.horizontalLogoUrl || null);
      setAppTitle(originalBranding.appTitle);
      setColors(originalBranding.colors);
      setMenuTitles(originalBranding.menuTitles || DEFAULT_MENU_TITLES);
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
          horizontalLogoUrl,
          appTitle,
          colors,
          menuTitles,
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
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Logos</h3>
        </div>
        
        <div className="space-y-6">
          {/* Square Logo */}
          <div>
            <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
              Square Logo
            </h4>
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

          {/* Horizontal Logo */}
          <div className="pt-4 border-t border-[#e1ddd8]/50 dark:border-[#313746]/50">
            <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
              Horizontal Logo (Optional)
            </h4>
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mb-3">
              Upload a wide logo to replace the square logo + app title combination in the sidebar.
            </p>
            <div className="flex items-center gap-6">
              {/* Horizontal Logo Preview */}
              <div className="relative w-48 h-16 rounded-xl overflow-hidden bg-white dark:bg-[#262b35] border-2 border-dashed border-[#e1ddd8] dark:border-[#313746]">
                {horizontalLogoUrl ? (
                  <Image
                    src={horizontalLogoUrl}
                    alt="Horizontal logo"
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6775]" />
                  </div>
                )}
              </div>
              
              {/* Upload/Remove Buttons */}
              <div className="flex-1">
                <input
                  ref={horizontalFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleHorizontalLogoUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => horizontalFileInputRef.current?.click()}
                    disabled={uploadingHorizontal}
                    className="flex items-center gap-2 px-4 py-2 bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] rounded-xl hover:bg-[#e8e5e1] dark:hover:bg-[#313746] transition-colors font-albert text-sm disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingHorizontal ? 'Uploading...' : 'Upload'}
                  </button>
                  {horizontalLogoUrl && (
                    <button
                      onClick={() => setHorizontalLogoUrl(null)}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-albert text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-2 font-albert">
                  Recommended: 400×100px or similar wide aspect ratio. Max 5MB.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Name Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Business Name</h3>
        </div>
        
        <input
          type="text"
          value={appTitle}
          onChange={(e) => setAppTitle(e.target.value)}
          placeholder="Enter business name"
          className="w-full max-w-md px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
        />
        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-2 font-albert">
          This appears in the sidebar next to your logo.
        </p>
      </div>

      {/* Menu Titles Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Type className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Menu Titles</h3>
        </div>
        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mb-4">
          Customize how navigation items are labeled throughout your app.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Home Title */}
          <div>
            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
              Home
            </label>
            <input
              type="text"
              value={menuTitles.home}
              onChange={(e) => setMenuTitles(prev => ({ ...prev, home: e.target.value }))}
              placeholder="e.g., Dashboard, Start"
              className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
            />
          </div>

          {/* Squad Title */}
          <div>
            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
              Squad
            </label>
            <input
              type="text"
              value={menuTitles.squad}
              onChange={(e) => setMenuTitles(prev => ({ ...prev, squad: e.target.value }))}
              placeholder="e.g., Cohort, Team, Group"
              className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
            />
          </div>

          {/* Learn Title */}
          <div>
            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
              Learn
            </label>
            <input
              type="text"
              value={menuTitles.learn}
              onChange={(e) => setMenuTitles(prev => ({ ...prev, learn: e.target.value }))}
              placeholder="e.g., Discover, Content, Resources"
              className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
            />
          </div>

          {/* Chat Title */}
          <div>
            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
              Chat
            </label>
            <input
              type="text"
              value={menuTitles.chat}
              onChange={(e) => setMenuTitles(prev => ({ ...prev, chat: e.target.value }))}
              placeholder="e.g., Messages, Community"
              className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
            />
          </div>

          {/* Coach Title */}
          <div>
            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
              Coach
            </label>
            <input
              type="text"
              value={menuTitles.coach}
              onChange={(e) => setMenuTitles(prev => ({ ...prev, coach: e.target.value }))}
              placeholder="e.g., Mentor, Guide, Support"
              className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
            />
          </div>
        </div>
        
        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-4 font-albert">
          Changes apply to navigation menu items. &ldquo;Squad&rdquo; also updates throughout the app (e.g., &ldquo;My Squad&rdquo;, upgrade pages).
        </p>
      </div>

      {/* Accent Color Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Accent Color</h3>
        </div>
        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mb-4">
          Your accent color is used for buttons, links, active states, and other interactive elements.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Light Mode Accent */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Light Mode
            </h4>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={colors.accentLight}
                onChange={(e) => handleColorChange('accentLight', e.target.value)}
                className="w-14 h-14 rounded-xl border-2 border-[#e1ddd8] dark:border-[#313746] cursor-pointer hover:border-[#a07855] dark:hover:border-[#b8896a] transition-colors"
                style={{ padding: 0 }}
              />
              <input
                type="text"
                value={colors.accentLight}
                onChange={(e) => handleColorChange('accentLight', e.target.value)}
                className="w-28 px-3 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-mono focus:outline-none focus:ring-1 focus:ring-[#a07855]/20"
                placeholder="#a07855"
              />
            </div>
          </div>
          
          {/* Dark Mode Accent */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Dark Mode
            </h4>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={colors.accentDark}
                onChange={(e) => handleColorChange('accentDark', e.target.value)}
                className="w-14 h-14 rounded-xl border-2 border-[#e1ddd8] dark:border-[#313746] cursor-pointer hover:border-[#a07855] dark:hover:border-[#b8896a] transition-colors"
                style={{ padding: 0 }}
              />
              <input
                type="text"
                value={colors.accentDark}
                onChange={(e) => handleColorChange('accentDark', e.target.value)}
                className="w-28 px-3 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-mono focus:outline-none focus:ring-1 focus:ring-[#a07855]/20"
                placeholder="#b8896a"
              />
            </div>
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
                      
                      {/* DNS Records - always visible for reference */}
                      <div className="mt-3 space-y-3">
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          {domain.status === 'verified' 
                            ? 'DNS records configured for this domain:'
                            : 'Add BOTH DNS records to your domain provider:'
                          }
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

                        {domain.status !== 'verified' && (
                          <p className="text-[10px] text-[#a7a39e] dark:text-[#7d8190] font-albert">
                            DNS changes may take up to 24 hours to propagate. Click the refresh icon to re-verify.
                          </p>
                        )}
                      </div>
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

      {/* Stripe Connect Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Stripe Connect</h3>
        </div>
        
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-6 font-albert">
          Connect your Stripe account to receive payments directly from your clients. 
          A {stripeAccountDetails.platformFeePercent ?? 10}% platform fee applies to each transaction.
        </p>
        
        {stripeConnectLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-3 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Display */}
            <div className={`
              flex items-center gap-3 p-4 rounded-xl border
              ${stripeConnectStatus === 'connected' 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' 
                : stripeConnectStatus === 'pending'
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
                  : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700/50'
              }
            `}>
              {stripeConnectStatus === 'connected' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300 font-albert">
                      Stripe Connected
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 font-albert">
                      {stripeAccountDetails.chargesEnabled && stripeAccountDetails.payoutsEnabled 
                        ? 'Your account is fully set up and ready to accept payments.'
                        : 'Account connected but verification may still be in progress.'
                      }
                    </p>
                  </div>
                </>
              ) : stripeConnectStatus === 'pending' ? (
                <>
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300 font-albert">
                      Setup In Progress
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-albert">
                      {stripeAccountDetails.detailsSubmitted 
                        ? 'Your details are under review. This usually takes a few minutes.'
                        : 'Please complete the onboarding process to start accepting payments.'
                      }
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 font-albert">
                      Not Connected
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-albert">
                      Connect your Stripe account to start receiving payments from your clients.
                    </p>
                  </div>
                </>
              )}
            </div>
            
            {/* Action Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleStripeConnect}
                disabled={stripeConnectActionLoading}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-xl font-albert text-sm transition-colors
                  ${stripeConnectStatus === 'connected'
                    ? 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e8e5e1] dark:hover:bg-[#313746]'
                    : 'bg-[#635bff] hover:bg-[#5048cc] text-white'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {stripeConnectActionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                  </>
                ) : stripeConnectStatus === 'connected' ? (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Manage Stripe Account
                  </>
                ) : stripeConnectStatus === 'pending' ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Continue Setup
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Connect Stripe
                  </>
                )}
              </button>
              
              {stripeConnectStatus !== 'not_connected' && (
                <button
                  onClick={fetchStripeConnect}
                  className="p-2.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-xl transition-colors"
                  title="Refresh status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Additional info */}
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
              Powered by Stripe Connect. You&apos;ll be redirected to Stripe to complete setup securely.
            </p>
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

export default CustomizeBrandingTab;
