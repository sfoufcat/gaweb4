'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ArrowLeft,
  Copy,
  ExternalLink,
  MoreVertical,
  Pencil,
  Trash2,
  Layers,
  Eye,
  EyeOff,
  Link2,
  Users,
  Check,
  Globe,
  UsersRound,
  FileText,
  BookOpen,
  Calendar,
  Download,
  Link as LinkIcon,
  ChevronDown,
  PhoneIncoming,
  Code,
  LayoutGrid,
} from 'lucide-react';
import type { Funnel, Program, FunnelTargetType, FunnelTabType, FunnelContentType, CoachTier } from '@/types';
import { FunnelEditorDialog } from './FunnelEditorDialog';
import { FunnelWizardModal } from './FunnelWizardModal';
import { GlobalPixelsModal } from './GlobalPixelsModal';
import { FunnelStepsEditor } from './FunnelStepsEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LimitReachedModal, useLimitCheck } from '@/components/coach';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useDemoSession } from '@/contexts/DemoSessionContext';
import { generateDemoFunnels } from '@/lib/demo-data';

type ViewMode = 'list' | 'editing';

// DEPRECATED: Squad funnels disabled. Squads now managed via Program > Community
// interface Squad {
//   id: string;
//   name: string;
//   slug?: string;
// }

interface ContentItem {
  id: string;
  title: string;
}

interface CoachFunnelsTabProps {
  /** Optional program ID to filter funnels by */
  programId?: string;
  /** Optional funnel ID to restore selection from URL */
  initialFunnelId?: string | null;
  /** Callback when funnel selection changes (for URL persistence) */
  onFunnelSelect?: (funnelId: string | null) => void;
}

const CONTENT_TYPE_OPTIONS: { value: FunnelContentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'course', label: 'Courses', icon: BookOpen },
  { value: 'article', label: 'Articles', icon: FileText },
  { value: 'event', label: 'Events', icon: Calendar },
  { value: 'download', label: 'Downloads', icon: Download },
  { value: 'link', label: 'Links', icon: LinkIcon },
];

export function CoachFunnelsTab({ programId, initialFunnelId, onFunnelSelect }: CoachFunnelsTabProps) {
  const { isDemoMode, openSignupModal } = useDemoMode();
  const demoSession = useDemoSession();
  
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  // DEPRECATED: Squad funnels disabled. Squads now managed via Program > Community
  // const [squads, setSquads] = useState<Squad[]>([]);
  const [contentItems, setContentItems] = useState<Record<FunnelContentType, ContentItem[]>>({
    article: [],
    course: [],
    event: [],
    download: [],
    link: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Demo data (memoized)
  const demoFunnels = useMemo(() => generateDemoFunnels(), []);
  
  // Tab state - default to 'all' to show all funnels
  const [activeTab, setActiveTab] = useState<FunnelTabType>('all');
  const [selectedContentType, setSelectedContentType] = useState<FunnelContentType>('course');
  
  // Tenant required state - shown when accessing from platform domain
  const [tenantRequired, setTenantRequired] = useState<{
    tenantUrl: string | null;
    subdomain: string | null;
  } | null>(null);
  
  // Dialogs & editing
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showPixelsModal, setShowPixelsModal] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [funnelToEdit, setFunnelToEdit] = useState<Funnel | null>(null);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programId || '');
  // Track whether user explicitly navigated back (to prevent re-selection from URL)
  const hasNavigatedBackRef = useRef(false);
  
  // Copy link feedback state
  const [copiedFunnelId, setCopiedFunnelId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  
  // Delete confirmation state
  const [funnelToDelete, setFunnelToDelete] = useState<Funnel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Plan tier for limit checking
  const [currentTier, setCurrentTier] = useState<CoachTier>('starter');
  const { checkLimit, showLimitModal, modalProps } = useLimitCheck(currentTier);

  // Content type dropdown (mobile)
  const [isContentTypeDropdownOpen, setIsContentTypeDropdownOpen] = useState(false);
  const contentTypeDropdownRef = useRef<HTMLDivElement>(null);

  // Close content type dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contentTypeDropdownRef.current && !contentTypeDropdownRef.current.contains(event.target as Node)) {
        setIsContentTypeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFunnels = useCallback(async () => {
    // Skip API call in demo mode
    if (isDemoMode) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setTenantRequired(null);
      const params = new URLSearchParams();

      // Filter by target type (skip if 'all' to get all funnels)
      if (activeTab !== 'all') {
        params.append('targetType', activeTab);
      }

      if (activeTab === 'program' && selectedProgramId) {
        params.append('programId', selectedProgramId);
      }
      if (activeTab === 'content') {
        params.append('contentType', selectedContentType);
      }
      
      const response = await fetch(`/api/coach/org-funnels?${params}`);
      
      // Check for tenant_required error
      if (response.status === 403) {
        const data = await response.json();
        if (data.error === 'tenant_required') {
          setTenantRequired({
            tenantUrl: data.tenantUrl,
            subdomain: data.subdomain,
          });
          setIsLoading(false);
          return;
        }
      }
      
      if (!response.ok) throw new Error('Failed to fetch funnels');
      const data = await response.json();
      setFunnels(data.funnels || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load funnels');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedProgramId, selectedContentType, isDemoMode]);
  
  // Use demo data when in demo mode (from session context for interactivity)
  const displayFunnels: Funnel[] = useMemo(() => {
    if (isDemoMode) {
      let filtered = demoSession.funnels.map(df => ({
        id: df.id,
        organizationId: 'demo-org',
        name: df.name,
        slug: df.slug,
        targetType: df.targetType as FunnelTargetType,
        programId: df.targetType === 'program' ? df.targetId ?? null : null,
        squadId: df.targetType === 'squad' ? df.targetId ?? null : null,
        contentType: df.targetType === 'content' ? 'course' as FunnelContentType : undefined,
        contentId: df.targetType === 'content' ? df.targetId : undefined,
        isDefault: false,
        isActive: df.isActive,
        accessType: 'public' as const,
        defaultPaymentStatus: 'required' as const,
        stepCount: df.steps.length,
        createdAt: df.createdAt,
        updatedAt: df.updatedAt,
      }));
      
      // Filter by target type (skip if 'all')
      if (activeTab !== 'all') {
        if (activeTab === 'program') {
          filtered = filtered.filter(f => f.targetType === 'program');
        } else if (activeTab === 'content') {
          filtered = filtered.filter(f => f.targetType === 'content');
        } else if (activeTab === 'intake') {
          filtered = filtered.filter(f => f.targetType === 'intake');
        }
        // DEPRECATED: Squad funnels disabled
      }
      
      return filtered;
    }
    return funnels;
  }, [isDemoMode, demoSession.funnels, funnels, activeTab]);

  const fetchPrograms = useCallback(async () => {
    try {
      const response = await fetch('/api/coach/org-programs');
      if (!response.ok) throw new Error('Failed to fetch programs');
      const data = await response.json();
      setPrograms(data.programs || []);
    } catch (err) {
      console.error('Failed to fetch programs:', err);
    }
  }, []);

  // DEPRECATED: Squad funnels disabled. Squads now managed via Program > Community
  // const fetchSquads = useCallback(async () => {
  //   try {
  //     const response = await fetch('/api/coach/org-squads');
  //     if (!response.ok) throw new Error('Failed to fetch squads');
  //     const data = await response.json();
  //     setSquads(data.squads || []);
  //   } catch (err) {
  //     console.error('Failed to fetch squads:', err);
  //   }
  // }, []);

  const fetchContentItems = useCallback(async (contentType: FunnelContentType) => {
    try {
      const endpointMap: Record<FunnelContentType, string> = {
        article: '/api/coach/org-discover/articles',
        course: '/api/coach/org-discover/courses',
        event: '/api/coach/org-discover/events',
        download: '/api/coach/org-discover/downloads',
        link: '/api/coach/org-discover/links',
      };
      
      const response = await fetch(endpointMap[contentType]);
      if (!response.ok) throw new Error('Failed to fetch content');
      const data = await response.json();
      
      // Normalize the response
      let items: ContentItem[] = [];
      if (data.articles) items = data.articles.map((a: { id: string; title: string }) => ({ id: a.id, title: a.title }));
      else if (data.courses) items = data.courses.map((c: { id: string; title: string }) => ({ id: c.id, title: c.title }));
      else if (data.events) items = data.events.map((e: { id: string; title: string }) => ({ id: e.id, title: e.title }));
      else if (data.downloads) items = data.downloads.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title }));
      else if (data.links) items = data.links.map((l: { id: string; title: string }) => ({ id: l.id, title: l.title }));
      
      setContentItems(prev => ({ ...prev, [contentType]: items }));
    } catch (err) {
      console.error(`Failed to fetch ${contentType}s:`, err);
    }
  }, []);

  useEffect(() => {
    fetchFunnels();
    fetchPrograms();
    // DEPRECATED: Squad funnels disabled
    // fetchSquads();
  }, [fetchFunnels, fetchPrograms]);

  // Fetch current tier for limit checking
  useEffect(() => {
    const fetchTier = async () => {
      try {
        const response = await fetch('/api/coach/subscription');
        if (response.ok) {
          const data = await response.json();
          if (data.tier) {
            setCurrentTier(data.tier);
          }
        }
      } catch (err) {
        console.error('[CoachFunnelsTab] Error fetching tier:', err);
      }
    };
    fetchTier();
  }, []);

  // Fetch content items when content tab is active
  useEffect(() => {
    if (activeTab === 'content') {
      fetchContentItems(selectedContentType);
    }
  }, [activeTab, selectedContentType, fetchContentItems]);

  // Restore funnel selection from URL param on mount
  useEffect(() => {
    // Skip if user explicitly navigated back
    if (hasNavigatedBackRef.current) {
      return;
    }
    if (initialFunnelId && displayFunnels.length > 0 && !editingFunnelId) {
      const funnel = displayFunnels.find(f => f.id === initialFunnelId);
      if (funnel) {
        setEditingFunnelId(funnel.id);
        setViewMode('editing');
      }
    }
  }, [initialFunnelId, displayFunnels, editingFunnelId]);

  // Notify parent when funnel selection changes (for URL persistence)
  useEffect(() => {
    onFunnelSelect?.(editingFunnelId);
  }, [editingFunnelId, onFunnelSelect]);

  const handleToggleActive = async (funnel: Funnel) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    try {
      const response = await fetch(`/api/coach/org-funnels/${funnel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !funnel.isActive }),
      });
      if (!response.ok) throw new Error('Failed to update funnel');
      await fetchFunnels();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update funnel');
    }
  };

  const handleSetDefault = async (funnel: Funnel) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    try {
      const response = await fetch(`/api/coach/org-funnels/${funnel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!response.ok) throw new Error('Failed to set default');
      await fetchFunnels();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to set default');
    }
  };

  const handleDelete = (funnel: Funnel) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    setFunnelToDelete(funnel);
  };

  const confirmDelete = async () => {
    if (!funnelToDelete) return;
    
    // In demo mode, delete from session store
    if (isDemoMode) {
      demoSession.deleteFunnel(funnelToDelete.id);
      setFunnelToDelete(null);
      return;
    }
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/coach/org-funnels/${funnelToDelete.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete funnel');
      setFunnelToDelete(null);
      await fetchFunnels();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete funnel');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditDetails = (funnel: Funnel) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    setFunnelToEdit(funnel);
    setShowEditDialog(true);
  };

  const handleEditSteps = (funnel: Funnel) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    setEditingFunnelId(funnel.id);
    setViewMode('editing');
  };

  const handleBackToList = () => {
    hasNavigatedBackRef.current = true;
    setEditingFunnelId(null);
    setViewMode('list');
    fetchFunnels();
  };

  const copyFunnelLink = (funnel: Funnel) => {
    let url: string | null = null;
    let errorMessage: string | null = null;
    
    // Check funnel target type
    // DEPRECATED: Squad funnels disabled. Squads now managed via Program > Community
    // if (funnel.targetType === 'squad' && funnel.squadId) {
    //   const squad = squads.find(s => s.id === funnel.squadId);
    //   if (!squad) {
    //     errorMessage = `Squad not found. Try refreshing.`;
    //   } else if (!squad.slug) {
    //     errorMessage = `Squad "${squad.name}" needs a URL slug. Edit the squad to add one.`;
    //   } else {
    //     url = `${window.location.origin}/join/squad/${squad.slug}/${funnel.slug}`;
    //   }
    // } else
    if (funnel.targetType === 'program' && funnel.programId) {
      const program = programs.find(p => p.id === funnel.programId);
      if (!program) {
        errorMessage = `Program not found. Try refreshing.`;
      } else if (!program.slug) {
        errorMessage = `Program "${program.name}" needs a URL slug. Edit the program to add one.`;
      } else {
        url = `${window.location.origin}/join/${program.slug}/${funnel.slug}`;
      }
    } else if (funnel.targetType === 'content' && funnel.contentType && funnel.contentId) {
      // Content funnels use a different URL structure
      url = `${window.location.origin}/join/content/${funnel.contentType}/${funnel.contentId}/${funnel.slug}`;
    } else if (funnel.targetType === 'intake' && funnel.intakeConfigId) {
      // Intake funnels use /book/ path
      url = `${window.location.origin}/book/${funnel.slug}`;
    } else {
      errorMessage = 'Funnel is not linked to a program, squad, or content.';
    }
    
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedFunnelId(funnel.id);
      setCopyError(null);
      setTimeout(() => setCopiedFunnelId(null), 2000);
    } else if (errorMessage) {
      console.error('[DEBUG] Copy link error:', errorMessage);
      setCopyError(errorMessage);
      setTimeout(() => setCopyError(null), 4000);
    }
  };

  const getTargetName = (funnel: Funnel) => {
    if (funnel.targetType === 'program') {
      const program = programs.find(p => p.id === funnel.programId);
      return program?.name || 'Unknown Program';
    }
    // DEPRECATED: Squad funnels disabled. Squads now managed via Program > Community
    if (funnel.targetType === 'squad') {
      // const squad = squads.find(s => s.id === funnel.squadId);
      // return squad?.name || 'Unknown Squad';
      return 'Squad (Deprecated)';
    }
    if (funnel.targetType === 'content' && funnel.contentType && funnel.contentId) {
      const items = contentItems[funnel.contentType] || [];
      const item = items.find(i => i.id === funnel.contentId);
      return item?.title || `Unknown ${funnel.contentType}`;
    }
    if (funnel.targetType === 'intake') {
      return funnel.name || 'Intake Call';
    }
    return 'Unknown';
  };

  // If editing a funnel's steps, show the step editor
  if (viewMode === 'editing' && editingFunnelId) {
    const editingFunnel = displayFunnels.find(f => f.id === editingFunnelId);
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToList}
              className="p-2 rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">
                {editingFunnel?.name || 'Edit Funnel Steps'}
              </h2>
              <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
                Configure the steps users will go through
              </p>
            </div>
          </div>
          
          {/* Copy link button */}
          {editingFunnel && (
            <button
              onClick={() => copyFunnelLink(editingFunnel)}
              className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-white/10 rounded-lg transition-colors"
              title={copiedFunnelId === editingFunnel.id ? "Copied!" : "Copy link"}
            >
              {copiedFunnelId === editingFunnel.id ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Link2 className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
              )}
            </button>
          )}
        </div>

        <FunnelStepsEditor 
          funnelId={editingFunnelId}
          onBack={handleBackToList}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Copy Error Toast */}
      <AnimatePresence>
        {copyError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 shadow-lg max-w-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Can&apos;t copy link</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{copyError}</p>
              </div>
              <button
                onClick={() => setCopyError(null)}
                className="flex-shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="px-4 py-3 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-3">
          <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-albert">
              Demo Mode Active
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-albert">
              Showing sample funnel data for demonstration purposes
            </p>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">Funnels</h2>
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
            Create and manage user acquisition funnels
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Global Pixels Button */}
          <button
            onClick={() => {
              if (isDemoMode) {
                openSignupModal();
                return;
              }
              setShowPixelsModal(true);
            }}
            title="Global Tracking Pixels"
            className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white rounded-lg transition-colors duration-200"
          >
            <Code className="w-4 h-4" />
          </button>
          {/* New Funnel Button */}
          <button
            onClick={() => {
              if (isDemoMode) {
                openSignupModal();
                return;
              }
              // Check funnel limit per target before opening modal
              if (checkLimit('max_funnels_per_target', displayFunnels.length)) {
                showLimitModal('max_funnels_per_target', displayFunnels.length);
                return;
              }
              setShowCreateWizard(true);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-[15px] text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white font-medium rounded-lg transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Funnel</span>
          </button>
        </div>
      </div>

      {/* Target Type Tabs */}
      <div className="flex gap-2 p-1 bg-[#f5f3f0] dark:bg-[#1a1f27] rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'all'
              ? 'bg-white dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] shadow-sm'
              : 'text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8]'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          All
        </button>
        <button
          onClick={() => setActiveTab('intake')}
          className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'intake'
              ? 'bg-white dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] shadow-sm'
              : 'text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8]'
          }`}
        >
          <PhoneIncoming className="w-4 h-4" />
          Intake
        </button>
        <button
          onClick={() => setActiveTab('program')}
          className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'program'
              ? 'bg-white dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] shadow-sm'
              : 'text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Programs
        </button>
        {/* HIDDEN: Standalone squads disabled - squads now managed via Program > Community */}
        <button
          onClick={() => setActiveTab('content')}
          className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'content'
              ? 'bg-white dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] shadow-sm'
              : 'text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8]'
          }`}
        >
          <FileText className="w-4 h-4" />
          Resources
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        {activeTab === 'program' && (
          <Select
            value={selectedProgramId || 'all'}
            onValueChange={(value) => setSelectedProgramId(value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-[200px] bg-white dark:bg-[#1a1f27] border-[#e1ddd8] dark:border-[#262b35] text-text-primary dark:text-[#f5f5f8]">
              <SelectValue placeholder="All Programs" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#1a1f27] border-[#e1ddd8] dark:border-[#262b35]">
              <SelectItem value="all" className="text-text-primary dark:text-[#f5f5f8]">
                All Programs
              </SelectItem>
              {programs.map(program => (
                <SelectItem key={program.id} value={program.id} className="text-text-primary dark:text-[#f5f5f8]">
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {activeTab === 'content' && (
          <>
            {/* Mobile Dropdown */}
            <div className="relative sm:hidden" ref={contentTypeDropdownRef}>
              <button
                onClick={() => setIsContentTypeDropdownOpen(!isContentTypeDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-brand-accent/10 text-brand-accent border border-brand-accent/30 rounded-lg text-sm font-medium"
              >
                {(() => {
                  const current = CONTENT_TYPE_OPTIONS.find(o => o.value === selectedContentType);
                  const Icon = current?.icon;
                  return (
                    <>
                      {Icon && <Icon className="w-4 h-4" />}
                      {current?.label}
                    </>
                  );
                })()}
                <ChevronDown className={`w-4 h-4 transition-transform ${isContentTypeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isContentTypeDropdownOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-[#1a1f27] rounded-xl shadow-lg border border-[#e1ddd8] dark:border-[#262b35] py-1 z-50">
                  {CONTENT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setSelectedContentType(value);
                        setIsContentTypeDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm font-medium flex items-center gap-2 ${
                        selectedContentType === value
                          ? 'bg-brand-accent/10 text-brand-accent'
                          : 'text-text-secondary dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop Horizontal Buttons */}
            <div className="hidden sm:flex gap-2">
              {CONTENT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setSelectedContentType(value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedContentType === value
                      ? 'bg-brand-accent/10 text-brand-accent dark:bg-brand-accent/10 dark:text-brand-accent border border-brand-accent/30'
                      : 'bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] text-text-secondary dark:text-[#b2b6c2] hover:border-brand-accent/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Tab Content */}
      <div key={activeTab} className="animate-fadeIn">
      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
                  <div className="space-y-2">
                    <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                    <div className="h-4 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                  <div className="h-8 w-8 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                </div>
              </div>
          </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tenant required state */}
      {tenantRequired && (
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Globe className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8] mb-2">
            Access from Your Organization Domain
          </h3>
          <p className="text-text-secondary dark:text-[#b2b6c2] mb-6 max-w-md mx-auto">
            To manage funnels, please access this page from your organization&apos;s domain.
          </p>
          
          {tenantRequired.tenantUrl ? (
            <a
              href={`${tenantRequired.tenantUrl}/coach?tab=funnels`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl hover:bg-brand-accent/90 transition-colors font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Go to {tenantRequired.subdomain}.coachful.co
            </a>
          ) : (
            <p className="text-text-muted dark:text-[#7f8694] text-sm">
              Your organization domain is not yet configured. Please contact support.
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !tenantRequired && displayFunnels.length === 0 && !isDemoMode && (
        <div className="text-center py-12 bg-[#faf8f6] dark:bg-[#11141b] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]">
          <Layers className="w-12 h-12 text-text-muted dark:text-[#7f8694] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
            No {activeTab === 'content' ? `${selectedContentType} ` : ''}funnels yet
          </h3>
          <p className="text-text-secondary dark:text-[#b2b6c2] mb-6">
            {activeTab === 'program' && 'Create your first funnel to start acquiring users for your programs.'}
            {/* HIDDEN: Standalone squads disabled */}
            {activeTab === 'content' && `Create a funnel to sell or gate access to your ${selectedContentType}s.`}
          </p>
          <button
            onClick={() => {
              // Check funnel limit per target before opening modal
              if (checkLimit('max_funnels_per_target', displayFunnels.length)) {
                showLimitModal('max_funnels_per_target', displayFunnels.length);
                return;
              }
              setShowCreateWizard(true);
            }}
            className="px-6 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
          >
            Create Funnel
          </button>
        </div>
      )}

      {/* Funnels list */}
      {!isLoading && !error && !tenantRequired && displayFunnels.length > 0 && (
        <div className="space-y-3">
          {displayFunnels.map(funnel => (
            <motion.div
              key={funnel.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 hover:border-[#d4d0cb] dark:hover:border-[#363c49] transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full mt-1.5 sm:mt-0 ${funnel.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-text-primary dark:text-[#f5f5f8]">{funnel.name}</h3>
                      {funnel.isDefault && (
                        <span className="px-2 py-0.5 text-xs bg-brand-accent/10 text-brand-accent dark:bg-brand-accent/10 dark:text-brand-accent rounded-full">
                          Default
                        </span>
                      )}
                      {funnel.accessType === 'invite_only' && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                          Invite Only
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
                      {getTargetName(funnel)} · {funnel.stepCount || 0} steps
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* Quick actions */}
                  <button
                    onClick={() => handleEditSteps(funnel)}
                    className="px-3 py-1.5 text-sm text-brand-accent hover:bg-brand-accent/5 dark:hover:bg-brand-accent/5 rounded-lg transition-colors"
                  >
                    Edit Steps
                  </button>
                  
                  <button
                    onClick={() => copyFunnelLink(funnel)}
                    className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-white/5 rounded-lg transition-colors"
                    title={copiedFunnelId === funnel.id ? "Copied!" : "Copy link"}
                  >
                    {copiedFunnelId === funnel.id ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Link2 className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
                    )}
                  </button>

                  {/* More menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-white/5 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
                      <DropdownMenuItem 
                        onClick={() => handleEditDetails(funnel)}
                        className="flex items-center gap-2 cursor-pointer text-text-primary dark:text-[#f5f5f8]"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleToggleActive(funnel)}
                        className="flex items-center gap-2 cursor-pointer text-text-primary dark:text-[#f5f5f8]"
                      >
                        {funnel.isActive ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      {!funnel.isDefault && (
                        <DropdownMenuItem 
                          onClick={() => handleSetDefault(funnel)}
                          className="flex items-center gap-2 cursor-pointer text-text-primary dark:text-[#f5f5f8]"
                        >
                          <Users className="w-4 h-4" />
                          Set as Default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="bg-[#e1ddd8] dark:bg-[#262b35]" />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(funnel)}
                        className="flex items-center gap-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      </div>

      {/* Create Wizard */}
      {showCreateWizard && (
        <FunnelWizardModal
          isOpen={showCreateWizard}
          onClose={() => setShowCreateWizard(false)}
          programs={programs}
          initialTargetType={activeTab !== 'content' ? activeTab : undefined}
          initialContentType={activeTab === 'content' ? selectedContentType : undefined}
          onSaved={() => {
            setShowCreateWizard(false);
            if (!isDemoMode) fetchFunnels();
          }}
          onRefreshPrograms={fetchPrograms}
        />
      )}

      {/* Global Pixels Modal */}
      {showPixelsModal && (
        <GlobalPixelsModal
          isOpen={showPixelsModal}
          onClose={() => setShowPixelsModal(false)}
        />
      )}

      {/* Edit Dialog */}
      {showEditDialog && funnelToEdit && (
        <FunnelEditorDialog
          mode="edit"
          funnel={funnelToEdit}
          programs={programs}
          // DEPRECATED: Squad funnels disabled
          // squads={squads}
          onClose={() => {
            setShowEditDialog(false);
            setFunnelToEdit(null);
          }}
          onSaved={() => {
            setShowEditDialog(false);
            setFunnelToEdit(null);
            if (!isDemoMode) fetchFunnels();
          }}
          demoMode={isDemoMode}
          onRefreshPrograms={fetchPrograms}
          onDemoSave={(formData) => {
            let targetName = '';
            if (formData.targetType === 'program') {
              targetName = programs.find(p => p.id === formData.programId)?.name || 'Program';
            // DEPRECATED: Squad funnels disabled
            // } else if (formData.targetType === 'squad') {
            //   targetName = squads.find(s => s.id === formData.squadId)?.name || 'Squad';
            } else {
              targetName = 'Content';
            }

            demoSession.updateFunnel(funnelToEdit.id, {
              name: formData.name,
              slug: formData.slug,
              targetType: formData.targetType,
              targetId: formData.programId || formData.contentId,
              targetName,
              updatedAt: new Date().toISOString(),
            });
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!funnelToDelete} onOpenChange={(open) => !open && setFunnelToDelete(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert text-[20px] tracking-[-0.5px] text-text-primary dark:text-[#f5f5f8]">
              Delete funnel?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-albert text-[15px] text-text-secondary dark:text-[#b2b6c2]">
              Are you sure you want to delete &ldquo;{funnelToDelete?.name}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel 
              disabled={isDeleting}
              className="font-albert rounded-full border-[#e1ddd8] dark:border-[#262b35] text-text-primary dark:text-[#f5f5f8]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="font-albert rounded-full bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Limit Reached Modal */}
      <LimitReachedModal {...modalProps} />

    </div>
  );
}
