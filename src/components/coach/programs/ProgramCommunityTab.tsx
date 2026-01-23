'use client';

import React, { useEffect, useState } from 'react';
import { Users, MessageCircle, Edit2, Loader2 } from 'lucide-react';
import type { Squad, SquadMember } from '@/types';
import { SquadMemberList } from '@/components/squad/SquadMemberList';
import { Button } from '@/components/ui/button';
import { useChatSheet } from '@/contexts/ChatSheetContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SquadWithDetails extends Squad {
  memberCount: number;
  members?: SquadMember[];
}

interface ProgramCommunityTabProps {
  programId: string;
  programType: 'individual' | 'group';
  clientCommunityEnabled?: boolean;
  onCommunityEnabled?: () => void;
}

export function ProgramCommunityTab({
  programId,
  programType,
  clientCommunityEnabled,
  onCommunityEnabled,
}: ProgramCommunityTabProps) {
  const [squads, setSquads] = useState<SquadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<SquadWithDetails | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [squadName, setSquadName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const { openChatSheet } = useChatSheet();

  // Enable community dialog state
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [enabling, setEnabling] = useState(false);

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
        setSquads(data.squads || []);

        // Auto-select first squad if only one exists
        if (data.squads?.length === 1) {
          setSelectedSquad(data.squads[0]);
        }
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
      setSquads(prev => prev.map(s => s.id === selectedSquad.id ? { ...s, name: squadName.trim() } : s));
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
        setSquads(data.squads || []);
        if (data.squads?.length === 1) {
          setSelectedSquad(data.squads[0]);
        }
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

  if (squads.length === 0) {
    return (
      <>
        <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
          <Users className="w-12 h-12 text-[#d1ccc5] dark:text-[#7d8190] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            No community squads yet
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1 max-w-sm mx-auto">
            {programType === 'group'
              ? 'Squads will be created automatically when clients enroll in cohorts'
              : 'Create a shared space for all your clients to connect and support each other'
            }
          </p>
          {programType === 'individual' && !clientCommunityEnabled && (
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

  // Single squad view (most common for individual programs)
  if (squads.length === 1 || selectedSquad) {
    const squad = selectedSquad || squads[0];

    return (
      <div className="space-y-6">
        {/* Squad Header */}
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Squad Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-brand-accent/10 flex items-center justify-center flex-shrink-0">
                {squad.avatarUrl ? (
                  <img
                    src={squad.avatarUrl}
                    alt={squad.name}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  <Users className="w-7 h-7 text-brand-accent" />
                )}
              </div>

              {/* Squad Name (editable) */}
              <div className="flex-1">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={squadName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSquadName(e.target.value)}
                      className="max-w-xs px-3 py-2 text-sm bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-brand-accent/20 font-albert"
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
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      {squad.name}
                    </h3>
                    <button
                      onClick={() => {
                        setSquadName(squad.name);
                        setEditingName(true);
                      }}
                      className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] transition-colors"
                      title="Edit squad name"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                  {squad.memberCount || 0} members
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {squad.chatChannelId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChat(squad)}
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Open Chat
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Squad Stats */}
        {(squad.avgAlignment !== undefined || squad.streak !== undefined) && (
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

        {/* Back button if multiple squads */}
        {squads.length > 1 && (
          <Button
            variant="ghost"
            onClick={() => setSelectedSquad(null)}
            className="text-[#5f5a55] dark:text-[#b2b6c2]"
          >
            ← Back to all squads
          </Button>
        )}
      </div>
    );
  }

  // Multiple squads grid (for group programs with multiple cohorts)
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
        Select a squad to view members and manage community settings
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {squads.map((squad) => (
          <button
            key={squad.id}
            onClick={() => setSelectedSquad(squad)}
            className="text-left bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 hover:border-brand-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center flex-shrink-0">
                {squad.avatarUrl ? (
                  <img
                    src={squad.avatarUrl}
                    alt={squad.name}
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  <Users className="w-5 h-5 text-brand-accent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                  {squad.name}
                </h4>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  {squad.memberCount || 0} members
                </p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {squad.avgAlignment ?? 0}% aligned
              </span>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                🔥 {squad.streak ?? 0}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
