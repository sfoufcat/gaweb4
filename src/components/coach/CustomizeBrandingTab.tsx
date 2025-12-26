'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, Upload, RotateCcw, Save, Palette, Type, ImageIcon, Globe, Link2, Trash2, Copy, Check, ExternalLink, RefreshCw, CreditCard, AlertCircle, CheckCircle2, Clock, Mail, Send, Bell, Settings, Moon, GripVertical } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import { FeedSettingsToggle } from './FeedSettingsToggle';
import { CommunitySettingsToggle } from './CommunitySettingsToggle';
import { AlumniDiscountToggle } from './AlumniDiscountToggle';
import { MenuEmptyStateSettings } from './MenuEmptyStateSettings';
import { DailyFocusSettings } from './DailyFocusSettings';
import type { OrgBranding, OrgBrandingColors, OrgMenuTitles, OrgMenuIcons, OrgCustomDomain, CustomDomainStatus, StripeConnectStatus, OrgEmailSettings, EmailDomainStatus, OrgEmailDefaults, MenuItemKey } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_MENU_ORDER, DEFAULT_EMAIL_SETTINGS, DEFAULT_EMAIL_DEFAULTS, validateSubdomain } from '@/types';
import { IconPicker } from './IconPicker';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Menu item configuration for display labels and placeholders
const MENU_ITEM_CONFIG: Record<MenuItemKey, { label: string; placeholder: string }> = {
  home: { label: 'Home', placeholder: 'e.g., Dashboard, Start' },
  program: { label: 'Program', placeholder: 'e.g., Journey, Path, Course' },
  squad: { label: 'Squad', placeholder: 'e.g., Cohort, Team, Group' },
  feed: { label: 'Feed', placeholder: 'e.g., Community, Wall' },
  learn: { label: 'Discover', placeholder: 'e.g., Learn, Content, Resources' },
  chat: { label: 'Chat', placeholder: 'e.g., Messages, Community' },
  coach: { label: 'Coach', placeholder: 'e.g., Mentor, Guide, Support' },
};

// Sortable menu item component
interface SortableMenuItemProps {
  id: MenuItemKey;
  title: string;
  icon: string;
  onTitleChange: (value: string) => void;
  onIconChange: (value: string) => void;
}

function SortableMenuItem({ id, title, icon, onTitleChange, onIconChange }: SortableMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const config = MENU_ITEM_CONFIG[id];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white/80 dark:bg-[#1e222a]/80 border border-[#e1ddd8] dark:border-[#313746] rounded-xl ${
        isDragging ? 'shadow-lg ring-2 ring-[#a07855]/20' : ''
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-grab active:cursor-grabbing touch-none"
        type="button"
      >
        <GripVertical className="w-4 h-4 text-[#a7a39e] dark:text-[#7d8190]" />
      </button>
      
      {/* Label */}
      <span className="flex-shrink-0 w-20 text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
        {config.label}
      </span>
      
      {/* Title Input */}
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={config.placeholder}
        className="flex-1 px-3 py-2 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
      />
      
      {/* Icon Picker */}
      <IconPicker
        value={icon}
        onChange={onIconChange}
        compact
      />
    </div>
  );
}

/**
 * Get DNS record names for a domain
 * For subdomains (e.g., app.porepower.com), returns the subdomain part
 * For root domains (e.g., porepower.com), returns @ for routing
 */
function getDnsRecordNames(domain: string): { routing: string; clerk: string } {
  const parts = domain.split('.');
  // If more than 2 parts (e.g., app.porepower.com), it's a subdomain
  if (parts.length > 2) {
    const subdomain = parts.slice(0, -2).join('.'); // "app" or "app.sub"
    return {
      routing: subdomain,
      clerk: `clerk.${subdomain}`,
    };
  }
  // Root domain (e.g., porepower.com)
  return {
    routing: '@',
    clerk: 'clerk',
  };
}

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
  const [logoUrlDark, setLogoUrlDark] = useState<string | null>(null);
  const [horizontalLogoUrl, setHorizontalLogoUrl] = useState<string | null>(null);
  const [horizontalLogoUrlDark, setHorizontalLogoUrlDark] = useState<string | null>(null);
  const [appTitle, setAppTitle] = useState(DEFAULT_APP_TITLE);
  const [colors, setColors] = useState<OrgBrandingColors>(DEFAULT_BRANDING_COLORS);
  const [menuTitles, setMenuTitles] = useState<OrgMenuTitles>(DEFAULT_MENU_TITLES);
  const [menuIcons, setMenuIcons] = useState<OrgMenuIcons>(DEFAULT_MENU_ICONS);
  const [menuOrder, setMenuOrder] = useState<MenuItemKey[]>(DEFAULT_MENU_ORDER);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingDark, setUploadingDark] = useState(false);
  const [uploadingHorizontal, setUploadingHorizontal] = useState(false);
  const [uploadingHorizontalDark, setUploadingHorizontalDark] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Tenant required state - shown when accessing from platform domain
  const [tenantRequired, setTenantRequired] = useState<{
    tenantUrl: string | null;
    subdomain: string | null;
  } | null>(null);
  
  // Original values for comparison
  const [originalBranding, setOriginalBranding] = useState<OrgBranding | null>(null);
  
  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileDarkInputRef = useRef<HTMLInputElement>(null);
  const horizontalFileInputRef = useRef<HTMLInputElement>(null);
  const horizontalDarkFileInputRef = useRef<HTMLInputElement>(null);
  
  // DnD sensors for menu reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handle menu drag end
  const handleMenuDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setMenuOrder((items) => {
        const oldIndex = items.indexOf(active.id as MenuItemKey);
        const newIndex = items.indexOf(over.id as MenuItemKey);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
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
  
  // Verification status for polling
  const [verificationStatus, setVerificationStatus] = useState<{
    domainId: string;
    domain: string;
    vercelReady: boolean;
    clerkDnsReady: boolean;
    clerkSslReady: boolean;
    fullyReady: boolean;
    polling: boolean;
  } | null>(null);
  const verificationPollRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Email Domain state
  const [emailSettings, setEmailSettings] = useState<OrgEmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [emailDomainLoading, setEmailDomainLoading] = useState(true);
  const [newEmailDomain, setNewEmailDomain] = useState('');
  const [emailDomainError, setEmailDomainError] = useState<string | null>(null);
  const [emailDomainActionLoading, setEmailDomainActionLoading] = useState(false);
  const [emailDomainVerifying, setEmailDomainVerifying] = useState(false);
  const [emailTestLoading, setEmailTestLoading] = useState(false);
  const [emailFromName, setEmailFromName] = useState('');
  const [emailReplyTo, setEmailReplyTo] = useState('');
  const [copiedEmailRecord, setCopiedEmailRecord] = useState<string | null>(null);

  // Email Notification Defaults state
  const [emailDefaults, setEmailDefaults] = useState<OrgEmailDefaults>(DEFAULT_EMAIL_DEFAULTS);
  const [emailDefaultsLoading, setEmailDefaultsLoading] = useState(true);
  const [emailDefaultsSaving, setEmailDefaultsSaving] = useState<string | null>(null);

  // Fetch current branding on mount
  // On tenant domain, branding comes from x-tenant-org-id header
  // On platform domain (without super_admin), this will return default branding
  const fetchBranding = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setTenantRequired(null);
      
      // Fetch branding - tenant mode provides org via header
      // forCoach param removed - now enforced via tenant mode
      const response = await fetch('/api/org/branding');
      
      // Check for tenant_required error (on platform domain for non-super-admins)
      if (response.status === 403) {
        const data = await response.json();
        if (data.error === 'tenant_required') {
          setTenantRequired({
            tenantUrl: data.tenantUrl,
            subdomain: data.subdomain,
          });
          return;
        }
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch branding settings');
      }
      
      const data = await response.json();
      const branding = data.branding as OrgBranding;
      
      setOriginalBranding(branding);
      setLogoUrl(branding.logoUrl);
      setLogoUrlDark(branding.logoUrlDark || null);
      setHorizontalLogoUrl(branding.horizontalLogoUrl || null);
      setHorizontalLogoUrlDark(branding.horizontalLogoUrlDark || null);
      setAppTitle(branding.appTitle);
      setColors(branding.colors);
      setMenuTitles({
        ...DEFAULT_MENU_TITLES,
        ...(branding.menuTitles || {}),
      });
      setMenuIcons({
        ...DEFAULT_MENU_ICONS,
        ...(branding.menuIcons || {}),
      });
      setMenuOrder(branding.menuOrder || DEFAULT_MENU_ORDER);
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

  // Fetch Email Domain settings
  const fetchEmailDomain = useCallback(async () => {
    try {
      setEmailDomainLoading(true);
      const response = await fetch('/api/org/email-domain');
      if (!response.ok) {
        console.error('Failed to fetch email domain settings');
        return;
      }
      
      const data = await response.json();
      setEmailSettings(data.emailSettings || DEFAULT_EMAIL_SETTINGS);
      setEmailFromName(data.emailSettings?.fromName || '');
      setEmailReplyTo(data.emailSettings?.replyTo || '');
    } catch (err) {
      console.error('Error fetching email domain settings:', err);
    } finally {
      setEmailDomainLoading(false);
    }
  }, []);

  // Fetch Email Notification Defaults
  const fetchEmailDefaults = useCallback(async () => {
    try {
      setEmailDefaultsLoading(true);
      const response = await fetch('/api/org/email-defaults');
      if (!response.ok) {
        console.error('Failed to fetch email notification defaults');
        return;
      }
      
      const data = await response.json();
      setEmailDefaults(data.emailDefaults || DEFAULT_EMAIL_DEFAULTS);
    } catch (err) {
      console.error('Error fetching email notification defaults:', err);
    } finally {
      setEmailDefaultsLoading(false);
    }
  }, []);

  // Handle email default toggle
  const handleEmailDefaultToggle = async (key: keyof OrgEmailDefaults, value: boolean) => {
    setEmailDefaultsSaving(key);
    
    try {
      const response = await fetch('/api/org/email-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update email defaults');
      }
      
      const data = await response.json();
      setEmailDefaults(data.emailDefaults);
    } catch (err) {
      console.error('Error updating email defaults:', err);
      setError('Failed to update email notification defaults');
      setTimeout(() => setError(null), 3000);
    } finally {
      setEmailDefaultsSaving(null);
    }
  };
  
  useEffect(() => {
    fetchBranding();
    fetchDomainSettings();
    fetchStripeConnect();
    fetchEmailDomain();
    fetchEmailDefaults();
    
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
  }, [fetchBranding, fetchDomainSettings, fetchStripeConnect, fetchEmailDomain, fetchEmailDefaults]);
  
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
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove domain');
      }
      
      // If we're on the custom domain being removed, redirect FIRST before updating state
      // This prevents being stuck on a broken domain after Vercel removes it
      if (data.redirectUrl && data.removedDomain && typeof window !== 'undefined') {
        const currentHost = window.location.hostname.toLowerCase();
        const removedDomain = data.removedDomain.toLowerCase();
        if (currentHost === removedDomain) {
          // Redirect immediately - don't wait for state update
          window.location.href = data.redirectUrl;
          return; // Exit early, page will redirect
        }
      }
      
      setCustomDomains(prev => prev.filter(d => d.id !== domainId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove domain');
    }
  };
  
  // Handle reverify custom domain with polling until fully ready
  const handleReverifyDomain = async (domainId: string, isPolling = false) => {
    if (!isPolling) {
      setReverifyingDomainId(domainId);
      // Clear any existing poll
      if (verificationPollRef.current) {
        clearTimeout(verificationPollRef.current);
        verificationPollRef.current = null;
      }
    }
    
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
      
      // Update verification status for UI
      setVerificationStatus({
        domainId,
        domain: data.domain.domain,
        vercelReady: data.routingConfigured,
        clerkDnsReady: data.clerkDnsReady,
        clerkSslReady: data.clerkSslReady,
        fullyReady: data.fullyReady,
        polling: !data.fullyReady && data.verified,
      });
      
      if (data.fullyReady) {
        // Everything is ready! Redirect to custom domain
        setSuccessMessage(`Domain fully verified! Redirecting to your new domain...`);
        setReverifyingDomainId(null);
        setVerificationStatus(null);
        
        // Seamless session handoff
        const targetUrl = `https://${data.domain.domain}/coach/customize`;
        const syncUrl = `https://app.growthaddicts.com/auth/sync?target=${encodeURIComponent(targetUrl)}`;
        
        setTimeout(() => {
          window.location.href = syncUrl;
        }, 1500);
      } else if (data.verified) {
        // DNS is verified but SSL/Clerk not ready - start polling
        setSuccessMessage('DNS verified! Waiting for SSL certificate...');
        
        // Poll every 5 seconds
        verificationPollRef.current = setTimeout(() => {
          handleReverifyDomain(domainId, true);
        }, 5000);
      } else {
        // DNS not verified yet
        setReverifyingDomainId(null);
        setVerificationStatus(null);
      }
    } catch (err) {
      setVerificationStatus(null);
      setReverifyingDomainId(null);
      alert(err instanceof Error ? err.message : 'Failed to verify domain');
    }
  };
  
  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (verificationPollRef.current) {
        clearTimeout(verificationPollRef.current);
      }
    };
  }, []);
  
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
  
  // Handle add email domain
  const handleAddEmailDomain = async () => {
    if (!newEmailDomain.trim()) {
      setEmailDomainError('Please enter a domain');
      return;
    }
    
    setEmailDomainActionLoading(true);
    setEmailDomainError(null);
    
    try {
      const response = await fetch('/api/org/email-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: newEmailDomain,
          fromName: emailFromName || appTitle,
          replyTo: emailReplyTo || undefined,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add email domain');
      }
      
      setEmailSettings(data.emailSettings);
      setNewEmailDomain('');
      setSuccessMessage('Email domain added! Configure DNS records below.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setEmailDomainError(err instanceof Error ? err.message : 'Failed to add email domain');
    } finally {
      setEmailDomainActionLoading(false);
    }
  };

  // Handle remove email domain
  const handleRemoveEmailDomain = async () => {
    if (!confirm('Are you sure you want to remove your email domain? Emails will be sent from the platform default.')) {
      return;
    }
    
    setEmailDomainActionLoading(true);
    setEmailDomainError(null);
    
    try {
      const response = await fetch('/api/org/email-domain', {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove email domain');
      }
      
      setEmailSettings(data.emailSettings);
      setNewEmailDomain('');
      setEmailFromName('');
      setEmailReplyTo('');
      setSuccessMessage('Email domain removed.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setEmailDomainError(err instanceof Error ? err.message : 'Failed to remove email domain');
    } finally {
      setEmailDomainActionLoading(false);
    }
  };

  // Handle verify email domain
  const handleVerifyEmailDomain = async () => {
    setEmailDomainVerifying(true);
    setEmailDomainError(null);
    
    try {
      const response = await fetch('/api/org/email-domain/verify', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify email domain');
      }
      
      setEmailSettings(data.emailSettings);
      
      if (data.verified) {
        setSuccessMessage('Email domain verified! You can now send emails from your domain.');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setEmailDomainError('DNS records not yet verified. Please check your DNS configuration.');
      }
    } catch (err) {
      setEmailDomainError(err instanceof Error ? err.message : 'Failed to verify email domain');
    } finally {
      setEmailDomainVerifying(false);
    }
  };

  // Handle send test email
  const handleSendTestEmail = async () => {
    setEmailTestLoading(true);
    setEmailDomainError(null);
    
    try {
      const response = await fetch('/api/org/email-domain/test', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email');
      }
      
      setSuccessMessage(`Test email sent to ${data.sentTo}!`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setEmailDomainError(err instanceof Error ? err.message : 'Failed to send test email');
    } finally {
      setEmailTestLoading(false);
    }
  };

  // Copy email DNS record to clipboard
  const copyEmailRecord = async (text: string, recordId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedEmailRecord(recordId);
      setTimeout(() => setCopiedEmailRecord(null), 2000);
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
    const originalMenuIcons = originalBranding.menuIcons || DEFAULT_MENU_ICONS;
    const originalMenuOrder = originalBranding.menuOrder || DEFAULT_MENU_ORDER;
    const changed = 
      logoUrl !== originalBranding.logoUrl ||
      logoUrlDark !== (originalBranding.logoUrlDark || null) ||
      horizontalLogoUrl !== (originalBranding.horizontalLogoUrl || null) ||
      horizontalLogoUrlDark !== (originalBranding.horizontalLogoUrlDark || null) ||
      appTitle !== originalBranding.appTitle ||
      JSON.stringify(colors) !== JSON.stringify(originalBranding.colors) ||
      JSON.stringify(menuTitles) !== JSON.stringify(originalMenuTitles) ||
      JSON.stringify(menuIcons) !== JSON.stringify(originalMenuIcons) ||
      JSON.stringify(menuOrder) !== JSON.stringify(originalMenuOrder);
    
    setHasChanges(changed);
  }, [logoUrl, logoUrlDark, horizontalLogoUrl, horizontalLogoUrlDark, appTitle, colors, menuTitles, menuIcons, menuOrder, originalBranding]);

  // Build preview branding object
  const getPreviewBranding = useCallback((): OrgBranding => {
    return {
      id: originalBranding?.id || 'preview',
      organizationId: originalBranding?.organizationId || 'preview',
      logoUrl,
      logoUrlDark,
      horizontalLogoUrl,
      horizontalLogoUrlDark,
      appTitle,
      colors,
      menuTitles,
      menuIcons,
      menuOrder,
      createdAt: originalBranding?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [logoUrl, logoUrlDark, horizontalLogoUrl, horizontalLogoUrlDark, appTitle, colors, menuTitles, menuIcons, menuOrder, originalBranding]);

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
  }, [logoUrl, logoUrlDark, horizontalLogoUrl, horizontalLogoUrlDark, appTitle, colors, menuTitles, menuIcons, menuOrder, isPreviewMode, setPreviewMode, getPreviewBranding]);

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

  // Handle dark mode logo upload
  const handleDarkLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    try {
      setUploadingDark(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'dark');

      const response = await fetch('/api/org/branding/logo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload dark mode logo');
      }

      const data = await response.json();
      setLogoUrlDark(data.url);
      setSuccessMessage('Dark mode logo uploaded successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error uploading dark mode logo:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload dark mode logo');
    } finally {
      setUploadingDark(false);
    }
  };

  // Handle dark mode horizontal logo upload
  const handleHorizontalDarkLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    try {
      setUploadingHorizontalDark(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'horizontal-dark');

      const response = await fetch('/api/org/branding/logo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload dark mode horizontal logo');
      }

      const data = await response.json();
      setHorizontalLogoUrlDark(data.url);
      setSuccessMessage('Dark mode horizontal logo uploaded successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error uploading dark mode horizontal logo:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload dark mode horizontal logo');
    } finally {
      setUploadingHorizontalDark(false);
    }
  };

  // Handle color change
  const handleColorChange = (key: keyof OrgBrandingColors, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  // Reset to defaults
  const handleResetToDefaults = () => {
    setLogoUrl(DEFAULT_LOGO_URL);
    setLogoUrlDark(null);
    setHorizontalLogoUrl(null);
    setHorizontalLogoUrlDark(null);
    setAppTitle(DEFAULT_APP_TITLE);
    setColors(DEFAULT_BRANDING_COLORS);
    setMenuTitles(DEFAULT_MENU_TITLES);
    setMenuIcons(DEFAULT_MENU_ICONS);
    setMenuOrder(DEFAULT_MENU_ORDER);
  };

  // Revert changes
  const handleRevertChanges = () => {
    if (originalBranding) {
      setLogoUrl(originalBranding.logoUrl);
      setLogoUrlDark(originalBranding.logoUrlDark || null);
      setHorizontalLogoUrl(originalBranding.horizontalLogoUrl || null);
      setHorizontalLogoUrlDark(originalBranding.horizontalLogoUrlDark || null);
      setAppTitle(originalBranding.appTitle);
      setColors(originalBranding.colors);
      setMenuTitles({
        ...DEFAULT_MENU_TITLES,
        ...(originalBranding.menuTitles || {}),
      });
      setMenuIcons({
        ...DEFAULT_MENU_ICONS,
        ...(originalBranding.menuIcons || {}),
      });
      setMenuOrder(originalBranding.menuOrder || DEFAULT_MENU_ORDER);
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
          logoUrlDark,
          horizontalLogoUrl,
          horizontalLogoUrlDark,
          appTitle,
          colors,
          menuTitles,
          menuIcons,
          menuOrder,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        // Handle tenant_required error
        if (data.error === 'tenant_required') {
          setTenantRequired({
            tenantUrl: data.tenantUrl,
            subdomain: data.subdomain,
          });
          return;
        }
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
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-6 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              <div className="h-4 w-72 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
            </div>
            <div className="h-10 w-28 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
          </div>
        </div>
        {/* Form sections skeleton */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6 space-y-4">
            <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
              <div className="h-10 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Show tenant required message when accessing from platform domain
  if (tenantRequired) {
    return (
      <div className="space-y-6">
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Globe className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
            Access from Your Organization Domain
          </h2>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6 max-w-md mx-auto">
            To customize your branding and settings, please access this page from your organization&apos;s domain.
          </p>
          
          {tenantRequired.tenantUrl ? (
            <a
              href={`${tenantRequired.tenantUrl}/coach?tab=customize`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#a07855] text-white rounded-xl hover:bg-[#8c6245] transition-colors font-albert font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Go to {tenantRequired.subdomain}.growthaddicts.com
            </a>
          ) : (
            <p className="text-[#a7a39e] dark:text-[#7d8190] font-albert text-sm">
              Your organization domain is not yet configured. Please contact support.
            </p>
          )}
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

          {/* Dark Mode Logos Section */}
          <div className="pt-6 border-t border-[#e1ddd8]/50 dark:border-[#313746]/50">
            <div className="flex items-center gap-2 mb-4">
              <Moon className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
              <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Dark Mode Logos (Optional)
              </h4>
            </div>
            <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mb-4">
              Upload alternative logos for dark mode. If not set, the light mode logos will be used.
            </p>
            
            {/* Dark Mode Square Logo */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
                Square Logo (Dark Mode)
              </h4>
              <div className="flex items-center gap-6">
                {/* Dark Logo Preview - with dark background to show how it looks */}
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-[#171b22] border-2 border-dashed border-[#313746]">
                  {logoUrlDark ? (
                    <Image
                      src={logoUrlDark}
                      alt="Organization logo (dark mode)"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-[#5f6775]" />
                    </div>
                  )}
                </div>
                
                {/* Upload/Remove Buttons */}
                <div className="flex-1">
                  <input
                    ref={fileDarkInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleDarkLogoUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileDarkInputRef.current?.click()}
                      disabled={uploadingDark}
                      className="flex items-center gap-2 px-4 py-2 bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] rounded-xl hover:bg-[#e8e5e1] dark:hover:bg-[#313746] transition-colors font-albert text-sm disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingDark ? 'Uploading...' : 'Upload'}
                    </button>
                    {logoUrlDark && (
                      <button
                        onClick={() => setLogoUrlDark(null)}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-albert text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-2 font-albert">
                    Use a light-colored or transparent logo that&apos;s visible on dark backgrounds.
                  </p>
                </div>
              </div>
            </div>

            {/* Dark Mode Horizontal Logo */}
            <div className="pt-4 border-t border-[#e1ddd8]/30 dark:border-[#313746]/30">
              <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
                Horizontal Logo (Dark Mode)
              </h4>
              <div className="flex items-center gap-6">
                {/* Dark Horizontal Logo Preview - with dark background */}
                <div className="relative w-48 h-16 rounded-xl overflow-hidden bg-[#171b22] border-2 border-dashed border-[#313746]">
                  {horizontalLogoUrlDark ? (
                    <Image
                      src={horizontalLogoUrlDark}
                      alt="Horizontal logo (dark mode)"
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-[#5f6775]" />
                    </div>
                  )}
                </div>
                
                {/* Upload/Remove Buttons */}
                <div className="flex-1">
                  <input
                    ref={horizontalDarkFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleHorizontalDarkLogoUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => horizontalDarkFileInputRef.current?.click()}
                      disabled={uploadingHorizontalDark}
                      className="flex items-center gap-2 px-4 py-2 bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] rounded-xl hover:bg-[#e8e5e1] dark:hover:bg-[#313746] transition-colors font-albert text-sm disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingHorizontalDark ? 'Uploading...' : 'Upload'}
                    </button>
                    {horizontalLogoUrlDark && (
                      <button
                        onClick={() => setHorizontalLogoUrlDark(null)}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-albert text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-2 font-albert">
                    Use a light-colored or transparent logo that&apos;s visible on dark backgrounds.
                  </p>
                </div>
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

      {/* Menu Order & Customization Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Type className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Menu Order & Customization</h3>
        </div>
        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mb-4">
          Drag to reorder, customize labels and icons for your navigation menu.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleMenuDragEnd}
        >
          <SortableContext
            items={menuOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {menuOrder.map((key) => (
                <SortableMenuItem
                  key={key}
                  id={key}
                  title={menuTitles[key]}
                  icon={menuIcons[key]}
                  onTitleChange={(value) => setMenuTitles(prev => ({ ...prev, [key]: value }))}
                  onIconChange={(value) => setMenuIcons(prev => ({ ...prev, [key]: value }))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        
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

      {/* Organization Settings Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Organization Settings</h3>
        </div>
        
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-6 font-albert">
          Configure features and settings for your organization.
        </p>

        {/* Enable Social Feed */}
        <FeedSettingsToggle />
        
        {/* Auto-Convert to Community */}
        <div className="mt-4">
          <CommunitySettingsToggle />
        </div>
        
        {/* Alumni Discount */}
        <div className="mt-4">
          <AlumniDiscountToggle />
        </div>
        
        {/* Menu Empty State Settings */}
        <div className="mt-4">
          <MenuEmptyStateSettings />
        </div>
        
        {/* Daily Focus Settings */}
        <div className="mt-4">
          <DailyFocusSettings />
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
          <div className="space-y-6 animate-pulse">
            <div className="space-y-3">
              <div className="h-4 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              <div className="flex gap-3">
                <div className="h-10 flex-1 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
                <div className="h-10 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              <div className="h-10 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Subdomain Section */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Subdomain
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 flex-1 sm:max-w-md">
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
                    .growthaddicts.com
                  </span>
                </div>
                <button
                  onClick={handleSubdomainUpdate}
                  disabled={subdomainLoading || newSubdomain === currentSubdomain}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#a07855] hover:bg-[#8c6245] disabled:bg-[#a07855]/50 text-white rounded-xl font-albert text-sm transition-colors disabled:cursor-not-allowed"
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
                    https://{currentSubdomain}.growthaddicts.com
                  </span>
                  <a
                    href={`https://${currentSubdomain}.growthaddicts.com`}
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
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newCustomDomain}
                  onChange={(e) => {
                    setNewCustomDomain(e.target.value.toLowerCase());
                    setCustomDomainError(null);
                  }}
                  placeholder="app.yourdomain.com"
                  className="flex-1 sm:max-w-md px-4 py-2.5 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
                />
                <button
                  onClick={handleAddCustomDomain}
                  disabled={customDomainLoading || !newCustomDomain.trim()}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e8e5e1] dark:hover:bg-[#313746] disabled:opacity-50 rounded-xl font-albert text-sm transition-colors disabled:cursor-not-allowed"
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
                      
                      {/* Verification Status - shown when verifying */}
                      {verificationStatus && verificationStatus.domainId === domain.id && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300 font-albert">
                              {verificationStatus.fullyReady 
                                ? 'Ready! Redirecting...' 
                                : 'Verification in progress...'}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs font-albert">
                            <div className="flex items-center gap-2">
                              {verificationStatus.vercelReady ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                              )}
                              <span className={verificationStatus.vercelReady ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                                Vercel routing {verificationStatus.vercelReady ? 'ready' : 'pending'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {verificationStatus.clerkDnsReady ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                              )}
                              <span className={verificationStatus.clerkDnsReady ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                                Clerk DNS {verificationStatus.clerkDnsReady ? 'verified' : 'pending'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {verificationStatus.clerkSslReady ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                              )}
                              <span className={verificationStatus.clerkSslReady ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                                SSL certificate {verificationStatus.clerkSslReady ? 'issued' : 'issuing...'}
                              </span>
                            </div>
                          </div>
                          {verificationStatus.polling && !verificationStatus.fullyReady && (
                            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-albert">
                              Checking status every 5 seconds...
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* DNS Records - always visible for reference */}
                      <div className="mt-3 space-y-3">
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          {domain.status === 'verified' 
                            ? 'DNS records configured for this domain:'
                            : 'Add BOTH DNS records to your domain provider:'
                          }
                        </p>
                        
                        {/* DNS Record Cards */}
                        <div className="space-y-3">
                          {/* CNAME for routing */}
                          <div className="p-4 bg-white dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#313746]">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-medium text-[#a07855] dark:text-[#b8896a] uppercase tracking-wide font-albert">
                                CNAME Record
                              </span>
                              <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                                For routing
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">Name</span>
                                <div className="flex items-center gap-1.5">
                                  <code className="text-sm font-mono text-[#1a1a1a] dark:text-[#f5f5f8]">{getDnsRecordNames(domain.domain).routing}</code>
                                  <button
                                    onClick={() => copyToClipboard(getDnsRecordNames(domain.domain).routing, `${domain.id}-cname-name`)}
                                    className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded transition-colors"
                                  >
                                    {copiedToken === `${domain.id}-cname-name` ? (
                                      <Check className="w-3.5 h-3.5 text-green-500" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">Value</span>
                                <div className="flex items-center gap-1.5">
                                  <code className="text-sm font-mono text-[#1a1a1a] dark:text-[#f5f5f8]">cname.vercel-dns.com</code>
                                  <button
                                    onClick={() => copyToClipboard('cname.vercel-dns.com', `${domain.id}-cname-value`)}
                                    className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded transition-colors"
                                  >
                                    {copiedToken === `${domain.id}-cname-value` ? (
                                      <Check className="w-3.5 h-3.5 text-green-500" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* CNAME for Clerk authentication */}
                          <div className="p-4 bg-white dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#313746]">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-medium text-[#a07855] dark:text-[#b8896a] uppercase tracking-wide font-albert">
                                CNAME Record
                              </span>
                              <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                                For authentication
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">Name</span>
                                <div className="flex items-center gap-1.5">
                                  <code className="text-sm font-mono text-[#1a1a1a] dark:text-[#f5f5f8]">{getDnsRecordNames(domain.domain).clerk}</code>
                                  <button
                                    onClick={() => copyToClipboard(getDnsRecordNames(domain.domain).clerk, `${domain.id}-clerk-name`)}
                                    className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded transition-colors"
                                  >
                                    {copiedToken === `${domain.id}-clerk-name` ? (
                                      <Check className="w-3.5 h-3.5 text-green-500" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">Value</span>
                                <div className="flex items-center gap-1.5">
                                  <code className="text-sm font-mono text-[#1a1a1a] dark:text-[#f5f5f8]">frontend-api.clerk.services</code>
                                  <button
                                    onClick={() => copyToClipboard('frontend-api.clerk.services', `${domain.id}-clerk-value`)}
                                    className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded transition-colors"
                                  >
                                    {copiedToken === `${domain.id}-clerk-value` ? (
                                      <Check className="w-3.5 h-3.5 text-green-500" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {domain.status !== 'verified' && (
                          <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
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

      {/* Email Domain Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Email Sending Domain</h3>
        </div>
        
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-6 font-albert">
          Send emails from your own domain (e.g., notifications@yourcompany.com) instead of the platform default.
        </p>
        
        {emailDomainLoading ? (
          <div className="space-y-4 animate-pulse">
            {/* Status card skeleton */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
              <div className="w-5 h-5 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-3 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
            </div>
            {/* DNS records skeleton */}
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
              ))}
            </div>
          </div>
        ) : emailSettings.domain ? (
          // Domain configured - show status and DNS records
          <div className="space-y-6">
            {/* Status Card */}
            <div className={`
              flex items-center gap-3 p-4 rounded-xl border
              ${emailSettings.status === 'verified' 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' 
                : emailSettings.status === 'failed'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
              }
            `}>
              {emailSettings.status === 'verified' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : emailSettings.status === 'failed' ? (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : (
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium font-albert ${
                  emailSettings.status === 'verified' 
                    ? 'text-green-700 dark:text-green-300'
                    : emailSettings.status === 'failed'
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {emailSettings.domain}
                </p>
                <p className={`text-xs font-albert ${
                  emailSettings.status === 'verified' 
                    ? 'text-green-600 dark:text-green-400'
                    : emailSettings.status === 'failed'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {emailSettings.status === 'verified' 
                    ? `Verified • Emails sent from notifications@${emailSettings.domain}`
                    : emailSettings.status === 'failed'
                      ? 'Verification failed. Please check your DNS records.'
                      : 'Pending verification. Add DNS records below.'
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                {emailSettings.status !== 'verified' && (
                  <button
                    onClick={handleVerifyEmailDomain}
                    disabled={emailDomainVerifying}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1e222a] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg text-sm font-albert transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${emailDomainVerifying ? 'animate-spin' : ''}`} />
                    Verify
                  </button>
                )}
                {emailSettings.status === 'verified' && (
                  <button
                    onClick={handleSendTestEmail}
                    disabled={emailTestLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1e222a] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg text-sm font-albert transition-colors disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${emailTestLoading ? 'animate-pulse' : ''}`} />
                    Test
                  </button>
                )}
                <button
                  onClick={handleRemoveEmailDomain}
                  disabled={emailDomainActionLoading}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sender Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Sender Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5">From Name</label>
                  <input
                    type="text"
                    value={emailFromName}
                    onChange={(e) => setEmailFromName(e.target.value)}
                    placeholder={appTitle}
                    className="w-full px-3 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5">Reply-To Email (optional)</label>
                  <input
                    type="email"
                    value={emailReplyTo}
                    onChange={(e) => setEmailReplyTo(e.target.value)}
                    placeholder="support@yourcompany.com"
                    className="w-full px-3 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20"
                  />
                </div>
              </div>
            </div>

            {/* DNS Records */}
            {emailSettings.status !== 'verified' && emailSettings.dnsRecords.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">DNS Records Required</h4>
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                  Add these DNS records to your domain provider, then click Verify.
                </p>
                <div className="space-y-3">
                  {emailSettings.dnsRecords.map((record, index) => (
                    <div 
                      key={index}
                      className="p-4 bg-[#f8f7f5] dark:bg-[#1e222a] rounded-xl border border-[#e1ddd8] dark:border-[#313746]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-[#a07855] dark:text-[#b8896a] uppercase tracking-wide font-albert">
                          {record.type} Record
                        </span>
                        {record.priority !== undefined && (
                          <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                            Priority: {record.priority}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert whitespace-nowrap pt-0.5">Name</span>
                          <div className="flex items-center gap-1.5 flex-1 justify-end">
                            <code className="text-xs font-mono text-[#1a1a1a] dark:text-[#f5f5f8] break-all text-right">
                              {record.name}
                            </code>
                            <button
                              onClick={() => copyEmailRecord(record.name, `${index}-name`)}
                              className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-white dark:hover:bg-[#262b35] rounded transition-colors flex-shrink-0"
                            >
                              {copiedEmailRecord === `${index}-name` ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert whitespace-nowrap pt-0.5">Value</span>
                          <div className="flex items-center gap-1.5 flex-1 justify-end">
                            <code className="text-xs font-mono text-[#1a1a1a] dark:text-[#f5f5f8] break-all text-right max-w-[300px] overflow-hidden">
                              {record.value.length > 50 ? `${record.value.substring(0, 50)}...` : record.value}
                            </code>
                            <button
                              onClick={() => copyEmailRecord(record.value, `${index}-value`)}
                              className="p-1 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-white dark:hover:bg-[#262b35] rounded transition-colors flex-shrink-0"
                            >
                              {copiedEmailRecord === `${index}-value` ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                  DNS changes may take up to 24 hours to propagate.
                </p>
              </div>
            )}

            {emailDomainError && (
              <p className="text-sm text-red-600 dark:text-red-400 font-albert">{emailDomainError}</p>
            )}
          </div>
        ) : (
          // No domain configured - show add form
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Email Domain
              </label>
              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                Enter a subdomain to use for sending emails (e.g., mail.yourcompany.com or notifications.yourcompany.com)
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newEmailDomain}
                  onChange={(e) => {
                    setNewEmailDomain(e.target.value.toLowerCase());
                    setEmailDomainError(null);
                  }}
                  placeholder="mail.yourcompany.com"
                  className="flex-1 sm:max-w-md px-4 py-2.5 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20 dark:focus:ring-[#b8896a]/20 focus:border-[#a07855] dark:focus:border-[#b8896a]"
                />
                <button
                  onClick={handleAddEmailDomain}
                  disabled={emailDomainActionLoading || !newEmailDomain.trim()}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#a07855] hover:bg-[#8c6245] disabled:bg-[#a07855]/50 text-white rounded-xl font-albert text-sm transition-colors disabled:cursor-not-allowed"
                >
                  {emailDomainActionLoading ? 'Adding...' : 'Add Domain'}
                </button>
              </div>
            </div>
            
            {/* Optional: Sender settings before adding */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5">From Name (optional)</label>
                <input
                  type="text"
                  value={emailFromName}
                  onChange={(e) => setEmailFromName(e.target.value)}
                  placeholder={appTitle || 'Your Company'}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5">Reply-To Email (optional)</label>
                <input
                  type="email"
                  value={emailReplyTo}
                  onChange={(e) => setEmailReplyTo(e.target.value)}
                  placeholder="support@yourcompany.com"
                  className="w-full px-3 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-lg text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/20"
                />
              </div>
            </div>

            {emailDomainError && (
              <p className="text-sm text-red-600 dark:text-red-400 font-albert">{emailDomainError}</p>
            )}
            
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-albert">
                <strong>How it works:</strong> After adding your domain, you&apos;ll need to add DNS records to verify ownership. 
                Once verified, all emails (check-ins, welcome emails, notifications) will be sent from your domain.
              </p>
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
          Regular Stripe fees apply + 1% platform fee on each transaction.
        </p>
        
        {stripeConnectLoading ? (
          <div className="space-y-4 animate-pulse">
            {/* Status card skeleton */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
              <div className="w-5 h-5 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-3 w-56 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
            </div>
            <div className="h-10 w-40 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
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

      {/* Email Notification Defaults Section */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Email Notification Defaults</h3>
        </div>
        
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-6 font-albert">
          Set the default email notification preferences for new members in your organization. 
          Members can still customize their own preferences in their settings.
        </p>
        
        {emailDefaultsLoading ? (
          <div className="space-y-1 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                  <div className="h-3 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                </div>
                <div className="w-12 h-7 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Morning Check-in */}
            <div className="flex items-center justify-between py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
              <div>
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Morning check-in</p>
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-0.5">Daily reminder to set focus tasks</p>
              </div>
              <button
                onClick={() => handleEmailDefaultToggle('morningCheckIn', !emailDefaults.morningCheckIn)}
                disabled={emailDefaultsSaving === 'morningCheckIn'}
                className={`
                  relative w-12 h-7 rounded-full transition-colors duration-200 ease-in-out
                  ${emailDefaults.morningCheckIn 
                    ? 'bg-[#3b5998] dark:bg-[#4a6baf]' 
                    : 'bg-[#d1cec9] dark:bg-[#3d4351]'
                  }
                  ${emailDefaultsSaving === 'morningCheckIn' ? 'opacity-50' : ''}
                `}
              >
                <span className={`
                  absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out
                  ${emailDefaults.morningCheckIn ? 'left-6' : 'left-1'}
                `} />
              </button>
            </div>

            {/* Evening Check-in */}
            <div className="flex items-center justify-between py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
              <div>
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Evening check-in</p>
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-0.5">Daily reminder to reflect on completed tasks</p>
              </div>
              <button
                onClick={() => handleEmailDefaultToggle('eveningCheckIn', !emailDefaults.eveningCheckIn)}
                disabled={emailDefaultsSaving === 'eveningCheckIn'}
                className={`
                  relative w-12 h-7 rounded-full transition-colors duration-200 ease-in-out
                  ${emailDefaults.eveningCheckIn 
                    ? 'bg-[#3b5998] dark:bg-[#4a6baf]' 
                    : 'bg-[#d1cec9] dark:bg-[#3d4351]'
                  }
                  ${emailDefaultsSaving === 'eveningCheckIn' ? 'opacity-50' : ''}
                `}
              >
                <span className={`
                  absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out
                  ${emailDefaults.eveningCheckIn ? 'left-6' : 'left-1'}
                `} />
              </button>
            </div>

            {/* Weekly Review */}
            <div className="flex items-center justify-between py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
              <div>
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Weekly review</p>
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-0.5">Weekly reflection and planning email</p>
              </div>
              <button
                onClick={() => handleEmailDefaultToggle('weeklyReview', !emailDefaults.weeklyReview)}
                disabled={emailDefaultsSaving === 'weeklyReview'}
                className={`
                  relative w-12 h-7 rounded-full transition-colors duration-200 ease-in-out
                  ${emailDefaults.weeklyReview 
                    ? 'bg-[#3b5998] dark:bg-[#4a6baf]' 
                    : 'bg-[#d1cec9] dark:bg-[#3d4351]'
                  }
                  ${emailDefaultsSaving === 'weeklyReview' ? 'opacity-50' : ''}
                `}
              >
                <span className={`
                  absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out
                  ${emailDefaults.weeklyReview ? 'left-6' : 'left-1'}
                `} />
              </button>
            </div>

            {/* Squad Call 24h */}
            <div className="flex items-center justify-between py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
              <div>
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Cohort call (24h before)</p>
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-0.5">Reminder 24 hours before scheduled calls</p>
              </div>
              <button
                onClick={() => handleEmailDefaultToggle('squadCall24h', !emailDefaults.squadCall24h)}
                disabled={emailDefaultsSaving === 'squadCall24h'}
                className={`
                  relative w-12 h-7 rounded-full transition-colors duration-200 ease-in-out
                  ${emailDefaults.squadCall24h 
                    ? 'bg-[#3b5998] dark:bg-[#4a6baf]' 
                    : 'bg-[#d1cec9] dark:bg-[#3d4351]'
                  }
                  ${emailDefaultsSaving === 'squadCall24h' ? 'opacity-50' : ''}
                `}
              >
                <span className={`
                  absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out
                  ${emailDefaults.squadCall24h ? 'left-6' : 'left-1'}
                `} />
              </button>
            </div>

            {/* Squad Call 1h */}
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Cohort call (1h before)</p>
                <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-0.5">Reminder 1 hour before scheduled calls</p>
              </div>
              <button
                onClick={() => handleEmailDefaultToggle('squadCall1h', !emailDefaults.squadCall1h)}
                disabled={emailDefaultsSaving === 'squadCall1h'}
                className={`
                  relative w-12 h-7 rounded-full transition-colors duration-200 ease-in-out
                  ${emailDefaults.squadCall1h 
                    ? 'bg-[#3b5998] dark:bg-[#4a6baf]' 
                    : 'bg-[#d1cec9] dark:bg-[#3d4351]'
                  }
                  ${emailDefaultsSaving === 'squadCall1h' ? 'opacity-50' : ''}
                `}
              >
                <span className={`
                  absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out
                  ${emailDefaults.squadCall1h ? 'left-6' : 'left-1'}
                `} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <button
            onClick={handleResetToDefaults}
            className="flex items-center justify-center gap-2 px-4 py-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          
          {hasChanges && (
            <button
              onClick={handleRevertChanges}
              className="flex items-center justify-center gap-2 px-4 py-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert text-sm transition-colors"
            >
              Revert Changes
            </button>
          )}
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-[#a07855] hover:bg-[#8c6245] disabled:bg-[#a07855]/50 text-white rounded-xl font-albert text-sm transition-colors disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

export default CustomizeBrandingTab;
