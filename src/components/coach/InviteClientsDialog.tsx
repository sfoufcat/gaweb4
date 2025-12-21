'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  UserPlus, 
  ChevronDown,
  Plus,
  Loader2,
  Layers
} from 'lucide-react';
import type { Funnel, Program } from '@/types';
import { InviteManager } from './funnels/InviteManager';

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

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Auto-create a default funnel
  const autoCreateFunnel = async () => {
    setIsAutoCreating(true);
    setError(null);

    try {
      // First check if we have a program, if not create one
      let programId = programs[0]?.id;
      
      if (!programId) {
        // Create a basic program first
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

      // Create a simple signup funnel
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

      // Add signup and success steps
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

      // Update state
      setFunnels(prev => [...prev, { ...funnelData.funnel, stepCount: 2 }]);
      setSelectedFunnelId(newFunnelId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create funnel');
    } finally {
      setIsAutoCreating(false);
    }
  };

  const selectedFunnel = funnels.find(f => f.id === selectedFunnelId);
  const selectedProgram = selectedFunnel 
    ? programs.find(p => p.id === selectedFunnel.programId) 
    : undefined;

  const getProgramName = (programId: string) => {
    return programs.find(p => p.id === programId)?.name || 'Unknown Program';
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
              <div className="w-10 h-10 rounded-xl bg-[#a07855]/10 dark:bg-[#b8896a]/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Invite New Clients
                </h2>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Create invite links to share with potential clients
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

            {/* Funnel selector and InviteManager */}
            {!isLoading && !error && funnels.length > 0 && (
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

                {/* Invite Manager */}
                {selectedFunnelId && (
                  <InviteManager
                    funnelId={selectedFunnelId}
                    funnel={selectedFunnel}
                    program={selectedProgram}
                  />
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

