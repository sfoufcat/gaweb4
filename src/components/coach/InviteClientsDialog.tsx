'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  UserPlus, 
  ChevronDown,
  ChevronLeft,
  Plus,
  Loader2,
  Layers,
  Upload,
  Mail,
  Send,
  Copy,
  Trash2,
  Check,
  Clock,
  Link2,
  AlertCircle
} from 'lucide-react';
import type { Funnel, Program, ProgramInvite } from '@/types';

type DialogView = 'list' | 'create' | 'bulk';

interface InviteClientsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteClientsDialog({ isOpen, onClose }: InviteClientsDialogProps) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected funnel
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  
  // Auto-create state
  const [isAutoCreating, setIsAutoCreating] = useState(false);

  // View state
  const [currentView, setCurrentView] = useState<DialogView>('list');

  // Invites state
  const [invites, setInvites] = useState<ProgramInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    email: '',
    name: '',
    paymentStatus: 'required' as 'required' | 'pre_paid' | 'free',
    prePaidNote: '',
    sendEmail: true,
  });
  const [isCreating, setIsCreating] = useState(false);

  // Bulk import state
  const [bulkCsv, setBulkCsv] = useState('');
  const [bulkPaymentStatus, setBulkPaymentStatus] = useState<'required' | 'pre_paid' | 'free'>('required');
  const [bulkSendEmails, setBulkSendEmails] = useState(true);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    skipped: number;
    emailsSent: number;
    errors: Array<{ index: number; error: string }>;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch funnels and programs in parallel
      const [funnelsRes, programsRes] = await Promise.all([
        fetch('/api/coach/org-funnels'),
        fetch('/api/coach/org-programs'),
      ]);

      if (!funnelsRes.ok) throw new Error('Failed to fetch funnels');
      if (!programsRes.ok) throw new Error('Failed to fetch programs');

      const funnelsData = await funnelsRes.json();
      const programsData = await programsRes.json();

      setFunnels(funnelsData.funnels || []);
      setPrograms(programsData.programs || []);

      // Auto-select first funnel if exists
      if (funnelsData.funnels?.length > 0) {
        setSelectedFunnelId(funnelsData.funnels[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchInvites = useCallback(async () => {
    if (!selectedFunnelId) return;
    
    try {
      setInvitesLoading(true);
      const response = await fetch(`/api/coach/org-invites?funnelId=${selectedFunnelId}`);
      if (!response.ok) throw new Error('Failed to fetch invites');
      const data = await response.json();
      setInvites(data.invites || []);
      setInvitesError(null);
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setInvitesLoading(false);
    }
  }, [selectedFunnelId]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setCurrentView('list');
    }
  }, [isOpen, fetchData]);

  useEffect(() => {
    if (selectedFunnelId) {
      fetchInvites();
    }
  }, [selectedFunnelId, fetchInvites]);

  // Auto-create a default funnel
  const autoCreateFunnel = async () => {
    setIsAutoCreating(true);
    setError(null);

    try {
      let programId = programs[0]?.id;
      
      if (!programId) {
        const programRes = await fetch('/api/coach/org-programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Default Program',
            slug: 'default',
            description: 'Default program for client enrollment',
            type: 'evergreen',
            lengthDays: 90,
            priceInCents: 0,
            currency: 'USD',
            isActive: true,
          }),
        });

        if (!programRes.ok) {
          throw new Error('Failed to create program');
        }

        const programData = await programRes.json();
        programId = programData.program.id;
        setPrograms(prev => [...prev, programData.program]);
      }

      const funnelRes = await fetch('/api/coach/org-funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Client Signup',
          slug: 'signup',
          programId,
          accessType: 'invite_only',
          isActive: true,
          isDefault: true,
        }),
      });

      if (!funnelRes.ok) {
        throw new Error('Failed to create funnel');
      }

      const funnelData = await funnelRes.json();
      const newFunnelId = funnelData.funnel.id;

      await fetch(`/api/coach/org-funnels/${newFunnelId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'signup',
          config: { showSocialLogin: true },
        }),
      });

      await fetch(`/api/coach/org-funnels/${newFunnelId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'success',
          config: { showConfetti: true, redirectDelay: 3000 },
        }),
      });

      setFunnels(prev => [...prev, { ...funnelData.funnel, stepCount: 2 }]);
      setSelectedFunnelId(newFunnelId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create funnel');
    } finally {
      setIsAutoCreating(false);
    }
  };

  // Create invite
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunnelId) return;
    
    setIsCreating(true);

    try {
      const response = await fetch('/api/coach/org-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelId: selectedFunnelId,
          email: createForm.email || undefined,
          name: createForm.name || undefined,
          paymentStatus: createForm.paymentStatus,
          prePaidNote: createForm.prePaidNote || undefined,
          sendEmail: createForm.sendEmail && !!createForm.email,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create invite');
      }

      setCreateForm({
        email: '',
        name: '',
        paymentStatus: 'required',
        prePaidNote: '',
        sendEmail: true,
      });
      setCurrentView('list');
      await fetchInvites();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setIsCreating(false);
    }
  };

  // Bulk import
  const handleBulkImport = async () => {
    if (!selectedFunnelId) return;
    
    setIsBulkImporting(true);
    setBulkResult(null);

    try {
      const lines = bulkCsv.trim().split('\n');
      const entries = lines.map(line => {
        const [email, name] = line.split(',').map(s => s.trim());
        return { email, name };
      }).filter(e => e.email);

      if (entries.length === 0) {
        throw new Error('No valid entries found');
      }

      const response = await fetch('/api/coach/org-invites/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelId: selectedFunnelId,
          entries,
          paymentStatus: bulkPaymentStatus,
          sendEmails: bulkSendEmails,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import');
      }

      setBulkResult({
        created: data.created,
        skipped: data.skipped,
        emailsSent: data.emailsSent || 0,
        errors: data.errors || [],
      });

      await fetchInvites();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import');
    } finally {
      setIsBulkImporting(false);
    }
  };

  // Delete invite
  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to delete this invite?')) return;

    try {
      const response = await fetch(`/api/coach/org-invites/${inviteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      await fetchInvites();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // Copy invite link
  const copyInviteLink = (invite: ProgramInvite) => {
    const funnel = funnels.find(f => f.id === selectedFunnelId);
    const program = funnel ? programs.find(p => p.id === funnel.programId) : null;
    
    if (program && funnel) {
      const url = `${window.location.origin}/join/${program.slug}/${funnel.slug}?invite=${invite.id}`;
      navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  };

  const selectedFunnel = funnels.find(f => f.id === selectedFunnelId);
  const selectedProgram = selectedFunnel 
    ? programs.find(p => p.id === selectedFunnel.programId) 
    : undefined;

  const getProgramName = (programId: string | null | undefined) => {
    if (!programId) return 'Squad Funnel';
    return programs.find(p => p.id === programId)?.name || 'Unknown Program';
  };

  const getStatusBadge = (invite: ProgramInvite) => {
    if (invite.usedBy) {
      return (
        <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center gap-1">
          <Check className="w-3 h-3" />
          Used
        </span>
      );
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return (
        <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Expired
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
        Active
      </span>
    );
  };

  const getHeaderTitle = () => {
    switch (currentView) {
      case 'create': return 'Create Invite';
      case 'bulk': return 'Bulk Import';
      default: return 'Invite New Clients';
    }
  };

  const getHeaderSubtitle = () => {
    switch (currentView) {
      case 'create': return 'Create an invite link for a client';
      case 'bulk': return 'Import multiple invites at once';
      default: return 'Create invite links to share with potential clients';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-[#1a1f2b] rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {currentView !== 'list' && (
                <button
                  onClick={() => {
                    setCurrentView('list');
                    setBulkResult(null);
                  }}
                  className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors -ml-2"
                >
                  <ChevronLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                </button>
              )}
              <div className="w-10 h-10 rounded-xl bg-[#a07855]/10 dark:bg-[#b8896a]/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {getHeaderTitle()}
                </h2>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  {getHeaderSubtitle()}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-[#a07855] dark:text-[#b8896a] animate-spin mx-auto mb-3" />
                  <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading...</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && !isLoading && (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 mb-4">
                {error}
              </div>
            )}

            {/* No funnels - offer to create one */}
            {!isLoading && !error && funnels.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]" />
                </div>
                <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  No Funnels Yet
                </h3>
                <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6 max-w-sm mx-auto">
                  Create a signup funnel to start inviting clients. We&apos;ll set up a simple signup flow for you.
                </p>
                <button
                  onClick={autoCreateFunnel}
                  disabled={isAutoCreating}
                  className="px-6 py-3 bg-[#a07855] dark:bg-[#b8896a] text-white rounded-xl font-albert font-medium hover:bg-[#8c6245] dark:hover:bg-[#a07855] disabled:opacity-50 transition-colors flex items-center gap-2 mx-auto"
                >
                  {isAutoCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Signup Funnel
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Main content when funnels exist */}
            {!isLoading && !error && funnels.length > 0 && (
              <>
                {/* LIST VIEW */}
                {currentView === 'list' && (
                  <div className="space-y-6">
                    {/* Funnel Selector */}
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Select Funnel
                      </label>
                      <div className="relative">
                        <select
                          value={selectedFunnelId || ''}
                          onChange={(e) => setSelectedFunnelId(e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:border-[#a07855] dark:focus:border-[#b8896a] appearance-none cursor-pointer"
                        >
                          {funnels.map(funnel => (
                            <option key={funnel.id} value={funnel.id}>
                              {funnel.name} ({getProgramName(funnel.programId)})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] pointer-events-none" />
                      </div>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1.5">
                        Invites will direct users through this funnel
                      </p>
                    </div>

                    {/* Invite Codes Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Invite Codes</h3>
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          Create and manage invite codes for this funnel
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentView('bulk')}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        >
                          <Upload className="w-4 h-4" />
                          Bulk Import
                        </button>
                        <button
                          onClick={() => setCurrentView('create')}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#a07855] dark:bg-[#b8896a] text-white rounded-lg hover:bg-[#8c6245] dark:hover:bg-[#a07855] transition-colors font-albert"
                        >
                          <Plus className="w-4 h-4" />
                          New Invite
                        </button>
                      </div>
                    </div>

                    {/* Invites Loading */}
                    {invitesLoading && (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-[#a07855] dark:text-[#b8896a] animate-spin" />
                      </div>
                    )}

                    {/* Invites Error */}
                    {invitesError && (
                      <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                        {invitesError}
                      </div>
                    )}

                    {/* Empty state */}
                    {!invitesLoading && !invitesError && invites.length === 0 && (
                      <div className="text-center py-8 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
                        <Mail className="w-10 h-10 text-[#a07855]/50 dark:text-[#b8896a]/50 mx-auto mb-3" />
                        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No invites yet</p>
                        <p className="text-sm text-[#5f5a55]/70 dark:text-[#b2b6c2]/70 font-albert mt-1">
                          Create your first invite to get started
                        </p>
                      </div>
                    )}

                    {/* Invites list */}
                    {!invitesLoading && !invitesError && invites.length > 0 && (
                      <div className="space-y-2">
                        {invites.map(invite => (
                          <div
                            key={invite.id}
                            className="flex items-center justify-between p-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-[#faf8f6] dark:bg-[#262b35] flex items-center justify-center">
                                {invite.email ? (
                                  <Mail className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                                ) : (
                                  <Link2 className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-mono text-sm">
                                    {invite.id}
                                  </p>
                                  {getStatusBadge(invite)}
                                  {invite.paymentStatus === 'pre_paid' && (
                                    <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
                                      Pre-paid
                                    </span>
                                  )}
                                  {invite.paymentStatus === 'free' && (
                                    <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                                      Free
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                                  {invite.email || invite.name || 'General invite'}
                                  {invite.maxUses && ` · ${invite.useCount}/${invite.maxUses} uses`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyInviteLink(invite)}
                                className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                                title="Copy invite link"
                              >
                                <Copy className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                              </button>
                              {!invite.usedBy && (
                                <button
                                  onClick={() => handleDeleteInvite(invite.id)}
                                  className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                  title="Delete invite"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* CREATE VIEW */}
                {currentView === 'create' && (
                  <form onSubmit={handleCreateInvite} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Email (optional)
                      </label>
                      <input
                        type="email"
                        value={createForm.email}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:focus:border-[#b8896a] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        placeholder="user@example.com"
                      />
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                        Leave empty to create a general invite link
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Name (optional)
                      </label>
                      <input
                        type="text"
                        value={createForm.name}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:focus:border-[#b8896a] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Payment Status
                      </label>
                      <select
                        value={createForm.paymentStatus}
                        onChange={(e) => setCreateForm(prev => ({ 
                          ...prev, 
                          paymentStatus: e.target.value as 'required' | 'pre_paid' | 'free' 
                        }))}
                        className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:focus:border-[#b8896a] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      >
                        <option value="required">Payment Required</option>
                        <option value="pre_paid">Pre-paid (skip payment)</option>
                        <option value="free">Free Access</option>
                      </select>
                    </div>

                    {createForm.paymentStatus === 'pre_paid' && (
                      <div>
                        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                          Pre-paid Note
                        </label>
                        <input
                          type="text"
                          value={createForm.prePaidNote}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, prePaidNote: e.target.value }))}
                          className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:focus:border-[#b8896a] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                          placeholder="e.g., Invoice #123"
                        />
                      </div>
                    )}

                    {/* Send Email Toggle */}
                    {createForm.email && (
                      <div className="flex items-center gap-3 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
                        <input
                          type="checkbox"
                          id="sendEmail"
                          checked={createForm.sendEmail}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, sendEmail: e.target.checked }))}
                          className="w-4 h-4 rounded border-[#e1ddd8] dark:border-[#262b35] text-[#a07855] focus:ring-[#a07855]"
                        />
                        <label htmlFor="sendEmail" className="flex items-center gap-2 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer">
                          <Send className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
                          Send invite email to {createForm.email}
                        </label>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentView('list')}
                        className="flex-1 py-2.5 px-4 text-[#5f5a55] dark:text-[#b2b6c2] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors font-albert"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreating}
                        className="flex-1 py-2.5 px-4 bg-[#a07855] dark:bg-[#b8896a] text-white rounded-lg hover:bg-[#8c6245] dark:hover:bg-[#a07855] disabled:opacity-50 transition-colors font-albert flex items-center justify-center gap-2"
                      >
                        {isCreating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Invite'
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* BULK VIEW */}
                {currentView === 'bulk' && (
                  <div className="space-y-4">
                    {!bulkResult ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                            CSV Data
                          </label>
                          <textarea
                            value={bulkCsv}
                            onChange={(e) => setBulkCsv(e.target.value)}
                            className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:focus:border-[#b8896a] text-[#1a1a1a] dark:text-[#f5f5f8] resize-none font-mono text-sm"
                            rows={8}
                            placeholder={`email@example.com, John Doe\nanother@example.com, Jane Doe\n...`}
                          />
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                            One entry per line: email, name (name is optional)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                            Payment Status (for all)
                          </label>
                          <select
                            value={bulkPaymentStatus}
                            onChange={(e) => setBulkPaymentStatus(e.target.value as 'required' | 'pre_paid' | 'free')}
                            className="w-full px-4 py-2 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-lg focus:outline-none focus:border-[#a07855] dark:focus:border-[#b8896a] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                          >
                            <option value="required">Payment Required</option>
                            <option value="pre_paid">Pre-paid (skip payment)</option>
                            <option value="free">Free Access</option>
                          </select>
                        </div>

                        {/* Send Emails Toggle */}
                        <div className="flex items-center gap-3 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
                          <input
                            type="checkbox"
                            id="bulkSendEmails"
                            checked={bulkSendEmails}
                            onChange={(e) => setBulkSendEmails(e.target.checked)}
                            className="w-4 h-4 rounded border-[#e1ddd8] dark:border-[#262b35] text-[#a07855] focus:ring-[#a07855]"
                          />
                          <label htmlFor="bulkSendEmails" className="flex items-center gap-2 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer">
                            <Send className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
                            Send invite emails to all addresses
                          </label>
                        </div>

                        <div className="flex gap-3 pt-4">
                          <button
                            type="button"
                            onClick={() => setCurrentView('list')}
                            className="flex-1 py-2.5 px-4 text-[#5f5a55] dark:text-[#b2b6c2] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors font-albert"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleBulkImport}
                            disabled={isBulkImporting || !bulkCsv.trim()}
                            className="flex-1 py-2.5 px-4 bg-[#a07855] dark:bg-[#b8896a] text-white rounded-lg hover:bg-[#8c6245] dark:hover:bg-[#a07855] disabled:opacity-50 transition-colors font-albert flex items-center justify-center gap-2"
                          >
                            {isBulkImporting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Importing...
                              </>
                            ) : (
                              'Import'
                            )}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-center py-4">
                          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                            <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                          </div>
                          <h4 className="text-lg font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                            Import Complete
                          </h4>
                          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                            Created {bulkResult.created} invites
                            {bulkResult.skipped > 0 && `, skipped ${bulkResult.skipped} duplicates`}
                          </p>
                          {bulkResult.emailsSent > 0 && (
                            <p className="text-sm text-[#a07855] dark:text-[#b8896a] font-albert mt-1">
                              {bulkResult.emailsSent} invite emails sent
                            </p>
                          )}
                        </div>

                        {bulkResult.errors.length > 0 && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-400 flex items-center gap-2 font-albert">
                              <AlertCircle className="w-4 h-4" />
                              {bulkResult.errors.length} errors
                            </p>
                            <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 font-albert">
                              {bulkResult.errors.slice(0, 5).map((err, i) => (
                                <li key={i}>Line {err.index + 1}: {err.error}</li>
                              ))}
                              {bulkResult.errors.length > 5 && (
                                <li>... and {bulkResult.errors.length - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setCurrentView('list');
                            setBulkResult(null);
                            setBulkCsv('');
                          }}
                          className="w-full py-2.5 px-4 bg-[#a07855] dark:bg-[#b8896a] text-white rounded-lg hover:bg-[#8c6245] dark:hover:bg-[#a07855] transition-colors font-albert"
                        >
                          Done
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
