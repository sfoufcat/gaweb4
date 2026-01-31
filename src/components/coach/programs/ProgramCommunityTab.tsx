'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { Users, MessageCircle, Loader2, ChevronDown, Check, Pencil } from 'lucide-react';
import type { Squad, SquadMember, UserAlignment, UserAlignmentSummary } from '@/types';
import { SquadMemberList } from '@/components/squad/SquadMemberList';
import { AlignmentGauge } from '@/components/alignment';
import { SquadStreakSheet } from '@/components/squad/SquadStreakSheet';
import { Button } from '@/components/ui/button';
import { CohortSessionCard } from '@/components/program/CohortSessionCard';
import { NextSquadCallCard, type CoachInfo } from '@/components/squad/NextSquadCallCard';
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

  // Streak sheet state
  const [showStreakSheet, setShowStreakSheet] = useState(false);

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

  // Derive squad for display (must be before any early returns for hook consistency)
  const squad = selectedSquad || filteredSquads[0] || null;

  // Create mock alignment data for the AlignmentGauge component
  // Arc shows squad's average alignment, center shows streak
  const squadStreak = squad?.streak ?? 0;
  const avgAlignment = squad?.avgAlignment ?? 0;

  const mockAlignment = useMemo<UserAlignment | null>(() => {
    if (!squad) return null;
    return {
      id: 'squad-mock',
      userId: squad.id,
      organizationId: squad.organizationId || '',
      date: new Date().toISOString().split('T')[0],
      didMorningCheckin: avgAlignment >= 25,
      didSetTasks: avgAlignment >= 50,
      didInteractWithSquad: avgAlignment >= 75,
      hasActiveGoal: avgAlignment === 100,
      alignmentScore: avgAlignment,
      fullyAligned: avgAlignment === 100,
      streakOnThisDay: squadStreak,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [squad, squadStreak, avgAlignment]);

  const mockSummary = useMemo<UserAlignmentSummary | null>(() => {
    if (!squad) return null;
    return {
      id: `${squad.organizationId || ''}_${squad.id}`,
      userId: squad.id,
      organizationId: squad.organizationId || '',
      currentStreak: squadStreak,
      lastAlignedDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    };
  }, [squad, squadStreak]);

  // Get coach info for "Guided by" display in call cards
  const coachInfo: CoachInfo | undefined = useMemo(() => {
    if (!squad?.coachId || !squad.members?.length) return undefined;
    const coach = squad.members.find(m => m.roleInSquad === 'coach');
    if (!coach) return undefined;
    return {
      firstName: coach.firstName,
      lastName: coach.lastName,
      imageUrl: coach.imageUrl,
    };
  }, [squad?.coachId, squad?.members]);

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
      <div className="space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center justify-between w-full pt-3">
          <div className="flex items-center gap-3">
            <div className="w-[50px] h-[50px] sm:w-[62px] sm:h-[62px] rounded-full bg-[#f3f1ef] dark:bg-[#1e222a]" />
            <div className="space-y-2">
              <div className="h-5 w-36 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg" />
              <div className="h-3 w-20 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-[50px] h-[50px] sm:w-[62px] sm:h-[62px] rounded-full bg-[#f3f1ef] dark:bg-[#1e222a]" />
            <div className="w-[50px] h-[50px] sm:w-[62px] sm:h-[62px] rounded-full bg-[#f3f1ef] dark:bg-[#1e222a]" />
          </div>
        </div>

        {/* Call card skeleton */}
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-5">
          <div className="space-y-3">
            <div className="h-4 w-24 bg-[#f3f1ef] dark:bg-[#262b35] rounded-lg" />
            <div className="h-4 w-44 bg-[#f3f1ef] dark:bg-[#262b35] rounded-lg" />
          </div>
          <div className="flex gap-3 mt-5">
            <div className="h-11 w-32 bg-[#f3f1ef] dark:bg-[#262b35] rounded-full" />
            <div className="h-11 w-24 bg-[#f3f1ef] dark:bg-[#262b35] rounded-full" />
          </div>
        </div>

        {/* Members skeleton */}
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#262b35]" />
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-[#f3f1ef] dark:bg-[#262b35] rounded-lg" />
                  <div className="h-3 w-16 bg-[#f3f1ef] dark:bg-[#262b35] rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
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

  return (
    <div className="space-y-6">
      {/* Header - matches client SquadHeader layout */}
      <div className="flex items-center justify-between w-full pt-3">
        {/* Left: Squad Avatar + Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Squad Avatar */}
          <div className="w-[50px] h-[50px] sm:w-[62px] sm:h-[62px] rounded-full overflow-hidden bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] flex items-center justify-center shadow-sm flex-shrink-0">
            {squad?.avatarUrl ? (
              <Image src={squad.avatarUrl} alt={squad.name} width={62} height={62} className="w-full h-full object-cover" />
            ) : (
              <span className="font-albert font-bold text-lg sm:text-xl text-[#4A5D54]">
                {squad?.name?.[0] || 'S'}
              </span>
            )}
          </div>

          {/* Name + Subtitle + Edit */}
          <div className="min-w-0">
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
              <>
                <div className="flex items-center gap-1.5">
                  {/* Squad Selector (when multiple squads) */}
                  {filteredSquads.length > 1 ? (
                    <Popover open={squadSelectorOpen} onOpenChange={setSquadSelectorOpen}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 group min-w-0">
                          <h1 className="font-albert text-[18px] sm:text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1.5px] truncate">
                            {squad?.name || 'Select squad'}
                          </h1>
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary dark:text-[#7d8190] transition-transform flex-shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-1" align="start">
                        {filteredSquads.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedSquad({ ...s, members: undefined });
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
                    <h1 className="font-albert text-[18px] sm:text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[1.3] tracking-[-1.5px] truncate">
                      {squad.name}
                    </h1>
                  )}
                  {/* Edit Button */}
                  {squad && (
                    <button
                      onClick={() => {
                        setSquadName(squad.name);
                        setEditingName(true);
                      }}
                      className="p-1 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors text-text-secondary/60 hover:text-text-primary"
                      aria-label="Edit squad"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {/* Coached squad subtitle */}
                <p className="font-sans text-[12px] font-semibold leading-[1.2]">
                  <span className="bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                    Coached squad
                  </span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right: Chat Button + Streak Gauge */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Chat Button - round icon style */}
          {squad?.chatChannelId && (
            <button
              onClick={() => handleOpenChat(squad)}
              className="w-[50px] h-[50px] sm:w-[62px] sm:h-[62px] rounded-full bg-[#f3f1ef] dark:bg-[#1e222a] flex items-center justify-center hover:bg-[#e9e5e0] dark:hover:bg-[#262b35] transition-colors"
              aria-label="Open squad chat"
            >
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7 text-text-primary dark:text-[#f5f5f8]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
            </button>
          )}

          {/* Streak Gauge */}
          {mockAlignment && mockSummary && (
            <AlignmentGauge
              alignment={mockAlignment}
              summary={mockSummary}
              size="sm"
              responsive
              onPress={() => setShowStreakSheet(true)}
            />
          )}
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
          coachInfo={coachInfo}
        />
      )}
      {programType === 'individual' && squad && (
        <NextSquadCallCard
          squad={squad as Squad}
          isCoach={true}
          coachInfo={coachInfo}
        />
      )}

      {/* Members List - matches client styling with subtle shadow */}
      {squad && (
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.04)]">
          {squad.members ? (
            squad.members.length > 0 ? (
              <SquadMemberList members={squad.members} />
            ) : (
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                No members yet
              </p>
            )
          ) : (
            <div className="space-y-4 py-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#262b35]" />
                  <div className="space-y-2">
                    <div className="h-4 w-28 bg-[#f3f1ef] dark:bg-[#262b35] rounded-lg" />
                    <div className="h-3 w-16 bg-[#f3f1ef] dark:bg-[#262b35] rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Squad Streak Explanation Sheet */}
      <SquadStreakSheet
        isOpen={showStreakSheet}
        onClose={() => setShowStreakSheet(false)}
      />
    </div>
  );
}
