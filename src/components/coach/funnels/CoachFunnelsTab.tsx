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
  Globe
} from 'lucide-react';
import type { Funnel, Program } from '@/types';
import { FunnelEditorDialog } from './FunnelEditorDialog';
import { FunnelStepsEditor } from './FunnelStepsEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ViewMode = 'list' | 'editing';

interface Squad {
  id: string;
  name: string;
  slug?: string;
}

interface CoachFunnelsTabProps {
  /** Optional program ID to filter funnels by */
  programId?: string;
}

export function CoachFunnelsTab({ programId }: CoachFunnelsTabProps) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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

  const fetchFunnels = useCallback(async () => {
    try {
      setIsLoading(true);
      setTenantRequired(null);
      const params = new URLSearchParams();
      if (selectedProgramId) {
        params.append('programId', selectedProgramId);
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
  }, [selectedProgramId]);

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

  useEffect(() => {
    fetchFunnels();
    fetchPrograms();
    fetchSquads();
  }, [fetchFunnels, fetchPrograms, fetchSquads]);

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

  const handleDelete = async (funnel: Funnel) => {
    if (!confirm(`Are you sure you want to delete "${funnel.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/coach/org-funnels/${funnel.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete funnel');
      await fetchFunnels();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete funnel');
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
    // Debug logging to help diagnose issues
    console.log('[DEBUG] Copying funnel link:', {
      funnelId: funnel.id,
      funnelName: funnel.name,
      funnelSquadId: funnel.squadId,
      funnelProgramId: funnel.programId,
      loadedSquadsCount: squads.length,
      loadedSquads: squads.map(s => ({ id: s.id, name: s.name, slug: s.slug })),
      loadedProgramsCount: programs.length,
    });

    let url: string | null = null;
    let errorMessage: string | null = null;
    
    // Check if it's a squad funnel
    if (funnel.squadId) {
      const squad = squads.find(s => s.id === funnel.squadId);
      console.log('[DEBUG] Squad lookup result:', squad ? { id: squad.id, name: squad.name, slug: squad.slug } : 'NOT FOUND');
      if (!squad) {
        errorMessage = `Squad not found. Funnel references squadId "${funnel.squadId}" but only ${squads.length} squads are loaded. Try refreshing.`;
      } else if (!squad.slug) {
        errorMessage = `Squad "${squad.name}" needs a URL slug. Edit the squad to add one.`;
      } else {
        url = `${window.location.origin}/join/squad/${squad.slug}/${funnel.slug}`;
      }
    } else if (funnel.programId) {
      // Program funnel
      const program = programs.find(p => p.id === funnel.programId);
      if (!program) {
        errorMessage = `Program not found. Funnel references programId "${funnel.programId}" but only ${programs.length} programs are loaded. Try refreshing.`;
      } else if (!program.slug) {
        errorMessage = `Program "${program.name}" needs a URL slug. Edit the program to add one.`;
      } else {
        url = `${window.location.origin}/join/${program.slug}/${funnel.slug}`;
      }
    } else {
      errorMessage = 'Funnel is not linked to a program or squad.';
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

  const getProgramName = (programId: string | null | undefined) => {
    if (!programId) return 'Squad Funnel';
    const program = programs.find(p => p.id === programId);
    return program?.name || 'Unknown Program';
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
              className="p-2 rounded-lg hover:bg-[#f5f3f0] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">
                {editingFunnel?.name || 'Edit Funnel Steps'}
              </h2>
              <p className="text-sm text-text-secondary">
                Configure the steps users will go through
              </p>
            </div>
          </div>
          
          {/* Copy link button */}
          {editingFunnel && (
            <button
              onClick={() => copyFunnelLink(editingFunnel)}
              className="p-2 hover:bg-[#f5f3f0] rounded-lg transition-colors"
              title={copiedFunnelId === editingFunnel.id ? "Copied!" : "Copy link"}
            >
              {copiedFunnelId === editingFunnel.id ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Link2 className="w-5 h-5 text-text-secondary" />
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
            className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg px-4 py-3 shadow-lg max-w-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-800">Can&apos;t copy link</p>
                <p className="text-xs text-red-600 mt-0.5">{copyError}</p>
              </div>
              <button
                onClick={() => setCopyError(null)}
                className="flex-shrink-0 text-red-400 hover:text-red-600"
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
          <h2 className="text-xl font-semibold text-text-primary">Funnels</h2>
          <p className="text-sm text-text-secondary">
            Create and manage user acquisition funnels for your programs
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#a07855] text-white rounded-lg hover:bg-[#8c6245] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Funnel
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={selectedProgramId}
          onChange={(e) => setSelectedProgramId(e.target.value)}
          className="px-4 py-2 bg-white border border-[#e1ddd8] rounded-lg text-text-primary focus:outline-none focus:border-[#a07855]"
        >
          <option value="">All Programs</option>
          {programs.map(program => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-[#e1ddd8] rounded-xl p-4">
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Tenant required state */}
      {tenantRequired && (
        <div className="bg-white border border-[#e1ddd8] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <Globe className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Access from Your Organization Domain
          </h3>
          <p className="text-text-secondary mb-6 max-w-md mx-auto">
            To manage funnels, please access this page from your organization&apos;s domain.
          </p>
          
          {tenantRequired.tenantUrl ? (
            <a
              href={`${tenantRequired.tenantUrl}/coach?tab=funnels`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#a07855] text-white rounded-xl hover:bg-[#8c6245] transition-colors font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Go to {tenantRequired.subdomain}.growthaddicts.com
            </a>
          ) : (
            <p className="text-text-muted text-sm">
              Your organization domain is not yet configured. Please contact support.
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !tenantRequired && funnels.length === 0 && (
        <div className="text-center py-12 bg-[#faf8f6] rounded-2xl border border-[#e1ddd8]">
          <Layers className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">No funnels yet</h3>
          <p className="text-text-secondary mb-6">
            Create your first funnel to start acquiring users for your programs.
          </p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-6 py-2 bg-[#a07855] text-white rounded-lg hover:bg-[#8c6245] transition-colors"
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
              className="bg-white border border-[#e1ddd8] rounded-xl p-4 hover:border-[#d4d0cb] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full ${funnel.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-text-primary">{funnel.name}</h3>
                      {funnel.isDefault && (
                        <span className="px-2 py-0.5 text-xs bg-[#a07855]/10 text-[#a07855] rounded-full">
                          Default
                        </span>
                      )}
                      {funnel.accessType === 'invite_only' && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded-full">
                          Invite Only
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">
                      {getProgramName(funnel.programId)} · {funnel.stepCount || 0} steps
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Quick actions */}
                  <button
                    onClick={() => handleEditSteps(funnel)}
                    className="px-3 py-1.5 text-sm text-[#a07855] hover:bg-[#a07855]/5 rounded-lg transition-colors"
                  >
                    Edit Steps
                  </button>
                  
                  <button
                    onClick={() => copyFunnelLink(funnel)}
                    className="p-2 hover:bg-[#f5f3f0] rounded-lg transition-colors"
                    title={copiedFunnelId === funnel.id ? "Copied!" : "Copy link"}
                  >
                    {copiedFunnelId === funnel.id ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Link2 className="w-4 h-4 text-text-secondary" />
                    )}
                  </button>

                  {/* More menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 hover:bg-[#f5f3f0] rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-text-secondary" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-[#e1ddd8]">
                      <DropdownMenuItem 
                        onClick={() => handleEditDetails(funnel)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleToggleActive(funnel)}
                        className="flex items-center gap-2 cursor-pointer"
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
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Users className="w-4 h-4" />
                          Set as Default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="bg-[#e1ddd8]" />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(funnel)}
                        className="flex items-center gap-2 text-red-600 focus:text-red-600 cursor-pointer"
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
    </div>
  );
}

