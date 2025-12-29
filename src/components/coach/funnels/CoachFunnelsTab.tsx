'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Link as LinkIcon
} from 'lucide-react';
import type { Funnel, Program, FunnelTargetType, FunnelContentType, CoachTier } from '@/types';
import { FunnelEditorDialog } from './FunnelEditorDialog';
import { FunnelStepsEditor } from './FunnelStepsEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

type ViewMode = 'list' | 'editing';

interface Squad {
  id: string;
  name: string;
  slug?: string;
}

interface ContentItem {
  id: string;
  title: string;
}

interface CoachFunnelsTabProps {
  /** Optional program ID to filter funnels by */
  programId?: string;
}

const CONTENT_TYPE_OPTIONS: { value: FunnelContentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'article', label: 'Articles', icon: FileText },
  { value: 'course', label: 'Courses', icon: BookOpen },
  { value: 'event', label: 'Events', icon: Calendar },
  { value: 'download', label: 'Downloads', icon: Download },
  { value: 'link', label: 'Links', icon: LinkIcon },
];

export function CoachFunnelsTab({ programId }: CoachFunnelsTabProps) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [contentItems, setContentItems] = useState<Record<FunnelContentType, ContentItem[]>>({
    article: [],
    course: [],
    event: [],
    download: [],
    link: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<FunnelTargetType>('program');
  const [selectedContentType, setSelectedContentType] = useState<FunnelContentType>('article');
  
  // Tenant required state - shown when accessing from platform domain
  const [tenantRequired, setTenantRequired] = useState<{
    tenantUrl: string | null;
    subdomain: string | null;
  } | null>(null);
  
  // Dialogs & editing
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [funnelToEdit, setFunnelToEdit] = useState<Funnel | null>(null);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programId || '');
  
  // Copy link feedback state
  const [copiedFunnelId, setCopiedFunnelId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  
  // Delete confirmation state
  const [funnelToDelete, setFunnelToDelete] = useState<Funnel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Plan tier for limit checking
  const [currentTier, setCurrentTier] = useState<CoachTier>('starter');
  const { checkLimit, showLimitModal, modalProps } = useLimitCheck(currentTier);

  const fetchFunnels = useCallback(async () => {
    try {
      setIsLoading(true);
      setTenantRequired(null);
      const params = new URLSearchParams();
      
      // Filter by target type
      params.append('targetType', activeTab);
      
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
  }, [activeTab, selectedProgramId, selectedContentType]);

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

  const fetchSquads = useCallback(async () => {
    try {
      const response = await fetch('/api/coach/org-squads');
      if (!response.ok) throw new Error('Failed to fetch squads');
      const data = await response.json();
      setSquads(data.squads || []);
    } catch (err) {
      console.error('Failed to fetch squads:', err);
    }
  }, []);

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
    fetchSquads();
  }, [fetchFunnels, fetchPrograms, fetchSquads]);

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

  const handleToggleActive = async (funnel: Funnel) => {
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
    setFunnelToDelete(funnel);
  };

  const confirmDelete = async () => {
    if (!funnelToDelete) return;
    
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
    setFunnelToEdit(funnel);
    setShowEditDialog(true);
  };

  const handleEditSteps = (funnel: Funnel) => {
    setEditingFunnelId(funnel.id);
    setViewMode('editing');
  };

  const handleBackToList = () => {
    setEditingFunnelId(null);
    setViewMode('list');
    fetchFunnels();
  };

  const copyFunnelLink = (funnel: Funnel) => {
    let url: string | null = null;
    let errorMessage: string | null = null;
    
    // Check funnel target type
    if (funnel.targetType === 'squad' && funnel.squadId) {
      const squad = squads.find(s => s.id === funnel.squadId);
      if (!squad) {
        errorMessage = `Squad not found. Try refreshing.`;
      } else if (!squad.slug) {
        errorMessage = `Squad "${squad.name}" needs a URL slug. Edit the squad to add one.`;
      } else {
        url = `${window.location.origin}/join/squad/${squad.slug}/${funnel.slug}`;
      }
    } else if (funnel.targetType === 'program' && funnel.programId) {
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
    if (funnel.targetType === 'squad') {
      const squad = squads.find(s => s.id === funnel.squadId);
      return squad?.name || 'Unknown Squad';
    }
    if (funnel.targetType === 'content' && funnel.contentType && funnel.contentId) {
      const items = contentItems[funnel.contentType] || [];
      const item = items.find(i => i.id === funnel.contentId);
      return item?.title || `Unknown ${funnel.contentType}`;
    }
    return 'Unknown';
  };

  // If editing a funnel's steps, show the step editor
  if (viewMode === 'editing' && editingFunnelId) {
    const editingFunnel = funnels.find(f => f.id === editingFunnelId);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">Funnels</h2>
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
            Create and manage user acquisition funnels
          </p>
        </div>
        <button
          onClick={() => {
            // Check funnel limit per target before opening modal
            if (checkLimit('max_funnels_per_target', funnels.length)) {
              showLimitModal('max_funnels_per_target', funnels.length);
              return;
            }
            setShowCreateDialog(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Funnel
        </button>
      </div>

      {/* Target Type Tabs */}
      <div className="flex gap-2 p-1 bg-[#f5f3f0] dark:bg-[#1a1f27] rounded-lg w-fit">
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
        <button
          onClick={() => setActiveTab('squad')}
          className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'squad'
              ? 'bg-white dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] shadow-sm'
              : 'text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8]'
          }`}
        >
          <UsersRound className="w-4 h-4" />
          Squads
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'content'
              ? 'bg-white dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] shadow-sm'
              : 'text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8]'
          }`}
        >
          <FileText className="w-4 h-4" />
          Content
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        {activeTab === 'program' && (
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-[#a07855]"
          >
            <option value="">All Programs</option>
            {programs.map(program => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        )}
        
        {activeTab === 'content' && (
          <div className="flex gap-2">
            {CONTENT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSelectedContentType(value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedContentType === value
                    ? 'bg-brand-accent/10 text-[#a07855] dark:bg-brand-accent/10 dark:text-brand-accent border border-brand-accent/30'
                    : 'bg-white dark:bg-[#1a1f27] border border-[#e1ddd8] dark:border-[#262b35] text-text-secondary dark:text-[#b2b6c2] hover:border-brand-accent/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

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
              Go to {tenantRequired.subdomain}.growthaddicts.com
            </a>
          ) : (
            <p className="text-text-muted dark:text-[#7f8694] text-sm">
              Your organization domain is not yet configured. Please contact support.
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !tenantRequired && funnels.length === 0 && (
        <div className="text-center py-12 bg-[#faf8f6] dark:bg-[#11141b] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]">
          <Layers className="w-12 h-12 text-text-muted dark:text-[#7f8694] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
            No {activeTab === 'content' ? `${selectedContentType} ` : ''}funnels yet
          </h3>
          <p className="text-text-secondary dark:text-[#b2b6c2] mb-6">
            {activeTab === 'program' && 'Create your first funnel to start acquiring users for your programs.'}
            {activeTab === 'squad' && 'Create a funnel to let users join squads directly.'}
            {activeTab === 'content' && `Create a funnel to sell or gate access to your ${selectedContentType}s.`}
          </p>
          <button
            onClick={() => {
              // Check funnel limit per target before opening modal
              if (checkLimit('max_funnels_per_target', funnels.length)) {
                showLimitModal('max_funnels_per_target', funnels.length);
                return;
              }
              setShowCreateDialog(true);
            }}
            className="px-6 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
          >
            Create Funnel
          </button>
        </div>
      )}

      {/* Funnels list */}
      {!isLoading && !error && !tenantRequired && funnels.length > 0 && (
        <div className="space-y-3">
          {funnels.map(funnel => (
            <motion.div
              key={funnel.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 hover:border-[#d4d0cb] dark:hover:border-[#363c49] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full ${funnel.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-text-primary dark:text-[#f5f5f8]">{funnel.name}</h3>
                      {funnel.isDefault && (
                        <span className="px-2 py-0.5 text-xs bg-brand-accent/10 text-[#a07855] dark:bg-brand-accent/10 dark:text-brand-accent rounded-full">
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

                <div className="flex items-center gap-2">
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

      {/* Create Dialog */}
      {showCreateDialog && (
        <FunnelEditorDialog
          mode="create"
          programs={programs}
          squads={squads}
          initialContentType={activeTab === 'content' ? selectedContentType : undefined}
          onClose={() => setShowCreateDialog(false)}
          onSaved={() => {
            setShowCreateDialog(false);
            fetchFunnels();
          }}
        />
      )}

      {/* Edit Dialog */}
      {showEditDialog && funnelToEdit && (
        <FunnelEditorDialog
          mode="edit"
          funnel={funnelToEdit}
          programs={programs}
          squads={squads}
          onClose={() => {
            setShowEditDialog(false);
            setFunnelToEdit(null);
          }}
          onSaved={() => {
            setShowEditDialog(false);
            setFunnelToEdit(null);
            fetchFunnels();
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
