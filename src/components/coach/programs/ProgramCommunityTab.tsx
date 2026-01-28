'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Users, MessageCircle, Edit2, Loader2, ChevronDown, Check } from 'lucide-react';
import type { Squad, SquadMember } from '@/types';
import { SquadMemberList } from '@/components/squad/SquadMemberList';
import { Button } from '@/components/ui/button';
import { CohortSessionCard } from '@/components/program/CohortSessionCard';
import { NextSquadCallCard } from '@/components/squad/NextSquadCallCard';
import { useChatSheet } from '@/contexts/ChatSheetContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface SquadWithDetails extends Squad {
  memberCount: number;
  members?: SquadMember[];
}

interface ProgramCommunityTabProps {
  programId: string;
  programType: 'individual' | 'group';
  clientCommunityEnabled?: boolean;
  onCommunityEnabled?: () => void;
  /** Selected cohort ID from parent (for group programs) */
  selectedCohortId?: string | null;
  /** Program name for schedule modal */
  programName?: string;
  /** Cohort name for schedule modal (group programs) */
  cohortName?: string;
}

export function ProgramCommunityTab({
  programId,
  programType,
  clientCommunityEnabled,
  onCommunityEnabled,
  selectedCohortId,
  programName,
  cohortName,
}: ProgramCommunityTabProps) {
  const [allSquads, setAllSquads] = useState<SquadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<SquadWithDetails | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [squadName, setSquadName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const { openChatSheet } = useChatSheet();

  // Squad selector state (when multiple squads)
  const [squadSelectorOpen, setSquadSelectorOpen] = useState(false);

  // Enable community dialog state
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [enabling, setEnabling] = useState(false);

  // Filter squads by selected cohort (for group programs)
  const filteredSquads = useMemo(() => {
    if (programType === 'individual') {
      return allSquads;
    }
    if (!selectedCohortId) {
      return [];
    }
    return allSquads.filter(s => s.cohortId === selectedCohortId);
  }, [allSquads, selectedCohortId, programType]);

  // Auto-select first squad when filtered squads change
  useEffect(() => {
    if (filteredSquads.length > 0 && !selectedSquad) {
      setSelectedSquad(filteredSquads[0]);
    } else if (filteredSquads.length > 0 && selectedSquad && !filteredSquads.find(s => s.id === selectedSquad.id)) {
      // Selected squad not in filtered list, reset to first
      setSelectedSquad(filteredSquads[0]);
    } else if (filteredSquads.length === 0) {
      setSelectedSquad(null);
    }
  }, [filteredSquads]);

  // Fetch squads for this program
  useEffect(() => {
    async function fetchSquads() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/coach/org-squads?programId=${programId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch squads');
        }

        const data = await response.json();
        setAllSquads(data.squads || []);
      } catch (err) {
        console.error('Error fetching program squads:', err);
        setError(err instanceof Error ? err.message : 'Failed to load squads');
      } finally {
        setLoading(false);
      }
    }

    fetchSquads();
  }, [programId]);

  // Fetch squad members when a squad is selected
  useEffect(() => {
    async function fetchMembers() {
      if (!selectedSquad) return;

      try {
        const response = await fetch(`/api/coach/org-squads/${selectedSquad.id}/members`);
        if (!response.ok) {
          throw new Error('Failed to fetch members');
        }

        const data = await response.json();
        setSelectedSquad(prev => prev ? { ...prev, members: data.members || [] } : null);
      } catch (err) {
        console.error('Error fetching squad members:', err);
      }
    }

    if (selectedSquad && !selectedSquad.members) {
      fetchMembers();
    }
  }, [selectedSquad?.id]);

  // Handle squad name edit
  const handleSaveName = async () => {
    if (!selectedSquad || !squadName.trim()) return;

    try {
      setSavingName(true);

      const response = await fetch(`/api/coach/org-squads/${selectedSquad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: squadName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update squad name');
      }

      // Update local state
      setSelectedSquad(prev => prev ? { ...prev, name: squadName.trim() } : null);
      setAllSquads(prev => prev.map(s => s.id === selectedSquad.id ? { ...s, name: squadName.trim() } : s));
      setEditingName(false);
    } catch (err) {
      console.error('Error updating squad name:', err);
    } finally {
      setSavingName(false);
    }
  };

  // Open chat for squad
  const handleOpenChat = (squad: SquadWithDetails) => {
    if (squad.chatChannelId) {
      openChatSheet(squad.chatChannelId);
    }
  };

  // Enable community for individual programs
  const handleEnableCommunity = async () => {
    try {
      setEnabling(true);

      const response = await fetch(`/api/coach/org-programs/${programId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientCommunityEnabled: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to enable community');
      }

      setShowEnableDialog(false);

      // Callback to refresh parent state and refetch squads
      onCommunityEnabled?.();

      // Refetch squads locally as well
      setLoading(true);
      const squadsResponse = await fetch(`/api/coach/org-squads?programId=${programId}`);
      if (squadsResponse.ok) {
        const data = await squadsResponse.json();
        setAllSquads(data.squads || []);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error enabling community:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable community');
    } finally {
      setEnabling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 dark:text-red-400 font-albert">{error}</p>
      </div>
    );
  }

  // For group programs - cohort selected but no squads yet
  if (programType === 'group' && selectedCohortId && filteredSquads.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
        <Users className="w-12 h-12 text-[#d1ccc5] dark:text-[#7d8190] mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          No squads in this cohort yet
        </h3>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1 max-w-sm mx-auto">
          Squads will be created automatically when clients enroll in this cohort
        </p>
      </div>
    );
  }

  // For group programs - no cohort selected
  if (programType === 'group' && !selectedCohortId) {
    return (
      <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
        <Users className="w-12 h-12 text-[#d1ccc5] dark:text-[#7d8190] mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Select a cohort
        </h3>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1 max-w-sm mx-auto">
          Use the cohort selector above to view squads for a specific cohort
        </p>
      </div>
    );
  }

  // For individual programs without community enabled
  if (programType === 'individual' && filteredSquads.length === 0) {
    return (
      <>
        <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
          <Users className="w-12 h-12 text-[#d1ccc5] dark:text-[#7d8190] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            No community squads yet
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1 max-w-sm mx-auto">
            Create a shared space for all your clients to connect and support each other
          </p>
          {!clientCommunityEnabled && (
            <Button
              onClick={() => setShowEnableDialog(true)}
              className="mt-4"
            >
              <Users className="w-4 h-4 mr-2" />
              Enable Community
            </Button>
          )}
        </div>

        {/* Enable Community Dialog */}
        <Dialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-albert">Enable Client Community</DialogTitle>
              <DialogDescription className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                Create a shared group chat for all clients in this program
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="w-4 h-4 text-brand-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Peer accountability
                    </p>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      Clients can see each other&apos;s progress and stay motivated
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageCircle className="w-4 h-4 text-brand-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Group chat
                    </p>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      Clients can connect, share wins, and support each other
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="w-4 h-4 text-brand-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Optional for clients
                    </p>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      Clients can choose to join during enrollment
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                You can disable the community later in program settings
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEnableDialog(false)}
                disabled={enabling}
              >
                Cancel
              </Button>
              <Button onClick={handleEnableCommunity} disabled={enabling}>
                {enabling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  'Enable Community'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const squad = selectedSquad || filteredSquads[0];

  return (
    <div className="space-y-6">
      {/* Header with squad info */}
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            {/* Squad Avatar */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand-accent/10 flex items-center justify-center flex-shrink-0">
              {squad?.avatarUrl ? (
                <img
                  src={squad.avatarUrl}
                  alt={squad.name}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                <Users className="w-6 h-6 sm:w-7 sm:h-7 text-brand-accent" />
              )}
            </div>

            {/* Squad Name / Selector */}
            <div className="flex-1 min-w-0">
              {editingName && squad ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={squadName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSquadName(e.target.value)}
                    className="max-w-[200px] sm:max-w-xs px-3 py-2 text-sm bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-brand-accent/20 font-albert"
                    autoFocus
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') {
                        setEditingName(false);
                        setSquadName(squad.name);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={savingName || !squadName.trim()}
                  >
                    {savingName ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingName(false);
                      setSquadName(squad.name);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {/* Squad Selector (when multiple squads) */}
                  {filteredSquads.length > 1 ? (
                    <Popover open={squadSelectorOpen} onOpenChange={setSquadSelectorOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="h-8 sm:h-9 justify-between border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] max-w-[180px] sm:max-w-none"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate">{squad?.name || 'Select squad'}</span>
                          </div>
                          <ChevronDown className="w-3.5 h-3.5 opacity-50 ml-2 flex-shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-1" align="start">
                        {filteredSquads.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedSquad({ ...s, members: undefined }); // Reset members to refetch
                              setSquadSelectorOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] text-left"
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              selectedSquad?.id === s.id
                                ? 'bg-brand-accent border-brand-accent'
                                : 'border-[#d1cdc8] dark:border-[#3a4150]'
                            }`}>
                              {selectedSquad?.id === s.id && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">{s.name}</span>
                                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                                  {s.memberCount || 0} members
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  ) : squad && (
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                        {squad.name}
                      </h3>
                      <button
                        onClick={() => {
                          setSquadName(squad.name);
                          setEditingName(true);
                        }}
                        className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] transition-colors flex-shrink-0"
                        title="Edit squad name"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 mt-1">
                {squad && (
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    {squad.memberCount || 0} members
                  </p>
                )}
                {/* Mobile: Chat icon below title */}
                {squad?.chatChannelId && (
                  <button
                    onClick={() => handleOpenChat(squad)}
                    className="sm:hidden inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand-accent hover:bg-brand-accent/90 rounded-full font-albert text-[13px] font-medium text-white transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Chat
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop: Actions */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            {squad?.chatChannelId && (
              <button
                onClick={() => handleOpenChat(squad)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-accent hover:bg-brand-accent/90 rounded-full font-albert text-[14px] font-medium text-white transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Go to chat
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Call Card */}
      {programType === 'group' && selectedCohortId && squad && (
        <CohortSessionCard
          cohortId={selectedCohortId}
          programId={programId}
          programName={programName}
          cohortName={cohortName || squad.name}
          chatChannelId={squad.chatChannelId || undefined}
          isCoach={true}
        />
      )}
      {programType === 'individual' && squad && (
        <NextSquadCallCard
          squad={squad as Squad}
          isCoach={true}
        />
      )}

      {/* Squad Stats */}
      {squad && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 text-center">
            <p className="text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {squad.avgAlignment ?? 0}%
            </p>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Avg. Alignment
            </p>
          </div>
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 text-center">
            <p className="text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              🔥 {squad.streak ?? 0}
            </p>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Day Streak
            </p>
          </div>
        </div>
      )}

      {/* Members List */}
      {squad && (
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
          <h4 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
            Members
          </h4>
          {squad.members ? (
            squad.members.length > 0 ? (
              <SquadMemberList members={squad.members} />
            ) : (
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                No members yet
              </p>
            )
          ) : (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
