'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Copy, 
  Mail, 
  Trash2, 
  Upload,
  Check,
  Clock,
  User,
  Link2,
  AlertCircle,
  X
} from 'lucide-react';
import type { ProgramInvite, Funnel, Program } from '@/types';

interface InviteManagerProps {
  funnelId: string;
  funnel?: Funnel;
  program?: Program;
}

export function InviteManager({ funnelId, funnel, program }: InviteManagerProps) {
  const [invites, setInvites] = useState<ProgramInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create invite dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    email: '',
    name: '',
    paymentStatus: 'required' as 'required' | 'pre_paid' | 'free',
    prePaidNote: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  
  // Bulk import state
  const [bulkCsv, setBulkCsv] = useState('');
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    skipped: number;
    errors: Array<{ index: number; error: string }>;
  } | null>(null);

  // Copy feedback state
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/coach/org-invites?funnelId=${funnelId}`);
      if (!response.ok) throw new Error('Failed to fetch invites');
      const data = await response.json();
      setInvites(data.invites || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setIsLoading(false);
    }
  }, [funnelId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch('/api/coach/org-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelId,
          email: createForm.email || undefined,
          name: createForm.name || undefined,
          paymentStatus: createForm.paymentStatus,
          prePaidNote: createForm.prePaidNote || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create invite');
      }

      setShowCreateDialog(false);
      setCreateForm({
        email: '',
        name: '',
        paymentStatus: 'required',
        prePaidNote: '',
      });
      await fetchInvites();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBulkImport = async () => {
    setIsBulkImporting(true);
    setBulkResult(null);

    try {
      // Parse CSV
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
          funnelId,
          entries,
          paymentStatus: createForm.paymentStatus,
          prePaidNote: createForm.prePaidNote || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import');
      }

      setBulkResult({
        created: data.created,
        skipped: data.skipped,
        errors: data.errors || [],
      });

      await fetchInvites();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import');
    } finally {
      setIsBulkImporting(false);
    }
  };

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

  const copyInviteLink = (invite: ProgramInvite) => {
    if (program && funnel) {
      const url = `${window.location.origin}/join/${program.slug}/${funnel.slug}?invite=${invite.id}`;
      navigator.clipboard.writeText(url);
      setCopiedInviteId(invite.id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    }
  };

  const getStatusBadge = (invite: ProgramInvite) => {
    if (invite.usedBy) {
      return (
        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded-full flex items-center gap-1">
          <Check className="w-3 h-3" />
          Used
        </span>
      );
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return (
        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Expired
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
        Active
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-text-primary">Invite Codes</h3>
          <p className="text-sm text-text-secondary">
            Create and manage invite codes for this funnel
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkDialog(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[#e1ddd8] rounded-lg hover:bg-[#f5f3f0] transition-colors"
          >
            <Upload className="w-4 h-4" />
            Bulk Import
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Invite
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white border border-[#e1ddd8] rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#e1ddd8]/50" />
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-[#e1ddd8]/50 rounded" />
                  <div className="h-3 w-24 bg-[#e1ddd8]/50 rounded" />
                </div>
              </div>
              <div className="h-6 w-16 bg-[#e1ddd8]/50 rounded-full" />
          </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && invites.length === 0 && (
        <div className="text-center py-8 bg-[#faf8f6] rounded-xl border border-[#e1ddd8]">
          <Mail className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">No invites yet</p>
        </div>
      )}

      {/* Invites list */}
      {!isLoading && !error && invites.length > 0 && (
        <div className="space-y-2">
          {invites.map(invite => (
            <div
              key={invite.id}
              className="flex items-center justify-between p-4 bg-white border border-[#e1ddd8] rounded-xl"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#faf8f6] flex items-center justify-center">
                  {invite.email ? (
                    <Mail className="w-5 h-5 text-text-secondary" />
                  ) : (
                    <Link2 className="w-5 h-5 text-text-secondary" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text-primary font-mono text-sm">
                      {invite.id}
                    </p>
                    {getStatusBadge(invite)}
                    {invite.paymentStatus === 'pre_paid' && (
                      <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-600 rounded-full">
                        Pre-paid
                      </span>
                    )}
                    {invite.paymentStatus === 'free' && (
                      <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded-full">
                        Free
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary">
                    {invite.email || invite.name || 'General invite'}
                    {invite.maxUses && ` · ${invite.useCount}/${invite.maxUses} uses`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyInviteLink(invite)}
                  className="p-2 hover:bg-[#f5f3f0] rounded-lg transition-colors"
                  title={copiedInviteId === invite.id ? "Copied!" : "Copy invite link"}
                >
                  {copiedInviteId === invite.id ? (
                    <motion.div
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    >
                      <Check className="w-4 h-4 text-green-500" />
                    </motion.div>
                  ) : (
                    <Copy className="w-4 h-4 text-text-secondary" />
                  )}
                </button>
                {!invite.usedBy && (
                  <button
                    onClick={() => handleDeleteInvite(invite.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Create Invite Dialog */}
      <AnimatePresence>
        {showCreateDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setShowCreateDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/10 dark:shadow-black/30"
            >
              <div className="p-6 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8]">Create Invite</h3>
                  <button
                    onClick={() => setShowCreateDialog(false)}
                    className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateInvite} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
                    placeholder="user@example.com"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Leave empty to create a general invite link
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Payment Status
                  </label>
                  <select
                    value={createForm.paymentStatus}
                    onChange={(e) => setCreateForm(prev => ({ 
                      ...prev, 
                      paymentStatus: e.target.value as 'required' | 'pre_paid' | 'free' 
                    }))}
                    className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
                  >
                    <option value="required">Payment Required</option>
                    <option value="pre_paid">Pre-paid (skip payment)</option>
                    <option value="free">Free Access</option>
                  </select>
                </div>

                {createForm.paymentStatus === 'pre_paid' && (
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Pre-paid Note
                    </label>
                    <input
                      type="text"
                      value={createForm.prePaidNote}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, prePaidNote: e.target.value }))}
                      className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
                      placeholder="e.g., Invoice #123"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateDialog(false)}
                    className="flex-1 py-2 px-4 text-text-secondary border border-[#e1ddd8] rounded-lg hover:bg-[#f5f3f0] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 py-2 px-4 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
                  >
                    {isCreating ? 'Creating...' : 'Create Invite'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Import Dialog */}
      <AnimatePresence>
        {showBulkDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setShowBulkDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/10 dark:shadow-black/30"
            >
              <div className="p-6 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8]">Bulk Import</h3>
                  <button
                    onClick={() => {
                      setShowBulkDialog(false);
                      setBulkResult(null);
                    }}
                    className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {!bulkResult ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        CSV Data
                      </label>
                      <textarea
                        value={bulkCsv}
                        onChange={(e) => setBulkCsv(e.target.value)}
                        className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent resize-none font-mono text-sm"
                        rows={8}
                        placeholder="email@example.com, John Doe&#10;another@example.com, Jane Doe&#10;..."
                      />
                      <p className="text-xs text-text-muted mt-1">
                        One entry per line: email, name (name is optional)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Payment Status (for all)
                      </label>
                      <select
                        value={createForm.paymentStatus}
                        onChange={(e) => setCreateForm(prev => ({ 
                          ...prev, 
                          paymentStatus: e.target.value as 'required' | 'pre_paid' | 'free' 
                        }))}
                        className="w-full px-4 py-2 border border-[#e1ddd8] rounded-lg focus:outline-none focus:border-brand-accent"
                      >
                        <option value="required">Payment Required</option>
                        <option value="pre_paid">Pre-paid (skip payment)</option>
                        <option value="free">Free Access</option>
                      </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowBulkDialog(false)}
                        className="flex-1 py-2 px-4 text-text-secondary border border-[#e1ddd8] rounded-lg hover:bg-[#f5f3f0] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleBulkImport}
                        disabled={isBulkImporting || !bulkCsv.trim()}
                        className="flex-1 py-2 px-4 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
                      >
                        {isBulkImporting ? 'Importing...' : 'Import'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center py-4">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                        <Check className="w-6 h-6 text-green-600" />
                      </div>
                      <h4 className="text-lg font-medium text-text-primary mb-2">
                        Import Complete
                      </h4>
                      <p className="text-text-secondary">
                        Created {bulkResult.created} invites
                        {bulkResult.skipped > 0 && `, skipped ${bulkResult.skipped} duplicates`}
                      </p>
                    </div>

                    {bulkResult.errors.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {bulkResult.errors.length} errors
                        </p>
                        <ul className="mt-2 text-sm text-amber-700">
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
                        setShowBulkDialog(false);
                        setBulkResult(null);
                        setBulkCsv('');
                      }}
                      className="w-full py-2 px-4 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

