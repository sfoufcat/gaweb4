'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Globe, Lock, Copy, RefreshCw } from 'lucide-react';
import type { Squad, FirebaseUser, SquadMember, SquadVisibility, UserTrack } from '@/types';

// Track options for squad categorization
// Note: Using 'all_tracks' as value instead of empty string because shadcn Select doesn't handle empty values
const TRACK_OPTIONS: { value: string; label: string }[] = [
  { value: 'all_tracks', label: 'All tracks (visible to everyone)' },
  { value: 'content_creator', label: 'Content Creator' },
  { value: 'saas', label: 'SaaS Founder' },
  { value: 'coach_consultant', label: 'Coach / Consultant' },
  { value: 'ecom', label: 'E-Commerce' },
  { value: 'agency', label: 'Agency Owner' },
  { value: 'community_builder', label: 'Community Builder' },
  { value: 'general', label: 'General Entrepreneur' },
];
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AvailableUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  role: string;
}

interface SquadFormDialogProps {
  squad: Squad | null; // null for create, Squad for edit
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  /** API base path for squad operations (default: /api/admin/squads) */
  apiBasePath?: string;
  /** API endpoint for fetching coaches (default: /api/admin/coaches, use /api/coach/org-coaches for org context) */
  coachesApiEndpoint?: string;
}

// Popular timezones for quick selection
const POPULAR_TIMEZONES = [
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

export function SquadFormDialog({ 
  squad, 
  open, 
  onClose, 
  onSave, 
  apiBasePath = '/api/admin/squads',
  coachesApiEndpoint = '/api/admin/coaches',
}: SquadFormDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [visibility, setVisibility] = useState<SquadVisibility>('public');
  const [timezone, setTimezone] = useState('UTC');
  const [inviteCode, setInviteCode] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [coachId, setCoachId] = useState('');
  const [trackId, setTrackId] = useState<UserTrack | 'all_tracks'>('all_tracks');
  const [loading, setLoading] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [coaches, setCoaches] = useState<FirebaseUser[]>([]);

  // Member management state
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  // Initialize form with squad data if editing
  useEffect(() => {
    if (squad) {
      setName(squad.name);
      setDescription(squad.description || '');
      setAvatarUrl(squad.avatarUrl || '');
      setVisibility(squad.visibility || 'public');
      setTimezone(squad.timezone || 'UTC');
      setInviteCode(squad.inviteCode || '');
      setIsPremium(squad.isPremium);
      setCoachId(squad.coachId || '');
      // Use 'all_tracks' as the value for squads without a track (null)
      setTrackId(squad.trackId || 'all_tracks');
    } else {
      setName('');
      setDescription('');
      setAvatarUrl('');
      setVisibility('public');
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setInviteCode('');
      setIsPremium(false);
      setCoachId('');
      setTrackId('all_tracks');
      setMembers([]);
    }
  }, [squad]);

  // Fetch coaches (from admin endpoint or org-coaches endpoint depending on context)
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const response = await fetch(coachesApiEndpoint);
        if (response.ok) {
          const data = await response.json();
          setCoaches(data.coaches || []);
        }
      } catch (err) {
        console.error('Error fetching coaches:', err);
      }
    };
    fetchCoaches();
  }, [coachesApiEndpoint]);

  const fetchMembers = useCallback(async () => {
    if (!squad) return;
    
    try {
      setMembersLoading(true);
      const response = await fetch(`/api/admin/squads/${squad.id}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setMembersLoading(false);
    }
  }, [squad]);

  // Fetch members when editing a squad
  useEffect(() => {
    if (squad && open) {
      fetchMembers();
    }
  }, [squad, open, fetchMembers]);

  // Search for available users
  useEffect(() => {
    const searchUsers = async () => {
      if (!showUserSearch) return;
      
      try {
        setSearchLoading(true);
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (squad) params.set('excludeSquadId', squad.id);
        
        const response = await fetch(`/api/admin/users/available?${params}`);
        if (response.ok) {
          const data = await response.json();
          setAvailableUsers(data.users || []);
        }
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, showUserSearch, squad]);

  const handleAddMember = async (userId: string) => {
    if (!squad || addingUserId) return;
    
    // Find the user being added
    const userToAdd = availableUsers.find(u => u.id === userId);
    if (!userToAdd) return;

    // Set loading state for this specific user
    setAddingUserId(userId);

    // Optimistic update: immediately add to members list
    const optimisticMember: SquadMember = {
      id: `temp-${userId}`,
      squadId: squad.id,
      userId: userId,
      roleInSquad: 'member',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Include user details for display
      firstName: userToAdd.firstName,
      lastName: userToAdd.lastName,
      imageUrl: userToAdd.imageUrl,
    };

    // Immediately update UI
    setMembers(prev => [...prev, optimisticMember]);
    setAvailableUsers(prev => prev.filter(u => u.id !== userId));
    setAddingUserId(null);
    
    try {
      const response = await fetch(`/api/admin/squads/${squad.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roleInSquad: 'member' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add member');
      }

      // Silently refresh to get correct IDs (don't await, let it happen in background)
      fetchMembers();
    } catch (err) {
      console.error('Error adding member:', err);
      // Rollback optimistic update
      setMembers(prev => prev.filter(m => m.id !== `temp-${userId}`));
      setAvailableUsers(prev => [...prev, userToAdd]);
      alert(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!squad) return;

    // Check if this is the coach
    if (squad.coachId === userId) {
      const confirm = window.confirm(
        'This user is the squad coach. Removing them will clear the coach assignment. Continue?'
      );
      if (!confirm) return;
    }
    
    try {
      const response = await fetch(
        `/api/admin/squads/${squad.id}/members?userId=${userId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove member');
      }

      // If we removed the coach, clear local state
      if (squad.coachId === userId) {
        setCoachId('');
      }

      // Refresh members list
      await fetchMembers();
    } catch (err) {
      console.error('Error removing member:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleCopyInviteCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      alert('Invite code copied to clipboard!');
    } catch {
      // Fallback for browsers that don't support clipboard API
      const input = document.createElement('input');
      input.value = inviteCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      alert('Invite code copied to clipboard!');
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!squad) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to regenerate the invite code? The old code will no longer work.'
    );
    if (!confirmed) return;

    try {
      setRegeneratingCode(true);
      const response = await fetch(`/api/admin/squads/${squad.id}/regenerate-code`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate invite code');
      }

      const data = await response.json();
      setInviteCode(data.inviteCode);
      alert('Invite code regenerated successfully!');
    } catch (err) {
      console.error('Error regenerating invite code:', err);
      alert(err instanceof Error ? err.message : 'Failed to regenerate invite code');
    } finally {
      setRegeneratingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Squad name is required');
      return;
    }

    if (isPremium && !coachId) {
      alert('Premium squads require a coach');
      return;
    }

    try {
      setLoading(true);

      const url = squad ? `${apiBasePath}/${squad.id}` : apiBasePath;
      const method = squad ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          visibility,
          timezone,
          isPremium,
          coachId: coachId || null,
          trackId: trackId === 'all_tracks' ? null : trackId, // null means visible to all tracks
        }),
      });

      if (!response.ok) {
        // Handle both JSON and non-JSON error responses gracefully
        let errorMessage = `Failed to ${squad ? 'update' : 'create'} squad`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response was not JSON (plain text), use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      onSave();
    } catch (err) {
      console.error('Error saving squad:', err);
      alert(err instanceof Error ? err.message : 'Failed to save squad');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-albert">
            {squad ? 'Edit Squad' : 'Create Squad'}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Squad Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Squad Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter squad name"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this squad about?"
              rows={2}
              maxLength={200}
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert resize-none"
            />
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
              {description.length}/200 characters
            </p>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert">
              Visibility
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex-1 flex items-center gap-2 p-3 border rounded-lg transition-all ${
                  visibility === 'public'
                    ? 'border-[#a07855] bg-[#a07855]/5'
                    : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855]/50'
                }`}
              >
                <Globe className={`w-4 h-4 ${visibility === 'public' ? 'text-[#a07855]' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                <span className={`font-albert text-sm ${visibility === 'public' ? 'text-[#a07855] font-medium' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'}`}>
                  Public
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex-1 flex items-center gap-2 p-3 border rounded-lg transition-all ${
                  visibility === 'private'
                    ? 'border-[#a07855] bg-[#a07855]/5'
                    : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855]/50'
                }`}
              >
                <Lock className={`w-4 h-4 ${visibility === 'private' ? 'text-[#a07855]' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                <span className={`font-albert text-sm ${visibility === 'private' ? 'text-[#a07855] font-medium' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'}`}>
                  Private
                </span>
              </button>
            </div>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
              {visibility === 'public' 
                ? 'Squad appears in public discovery list'
                : 'Squad is only joinable via invite code'
              }
            </p>
          </div>

          {/* Invite Code (for private squads or when editing) */}
          {(visibility === 'private' || (squad && inviteCode)) && squad && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                Invite Code
              </label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-[#faf8f6] font-mono text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {inviteCode || 'No code generated'}
                </div>
                {inviteCode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyInviteCode}
                    className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
                    title="Copy invite code"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateInviteCode}
                  disabled={regeneratingCode}
                  className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
                  title="Regenerate invite code"
                >
                  <RefreshCw className={`w-4 h-4 ${regeneratingCode ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
                Share this code with users to let them join the squad
              </p>
            </div>
          )}

          {/* Timezone */}
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Timezone
            </label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full font-albert">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {POPULAR_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value} className="font-albert">
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
              Used to coordinate squad activities
            </p>
          </div>

          {/* Track Selection */}
          <div>
            <label htmlFor="trackId" className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Track
            </label>
            <Select value={trackId} onValueChange={(val) => setTrackId(val as UserTrack | 'all_tracks')}>
              <SelectTrigger className="w-full font-albert">
                <SelectValue placeholder="Select track (optional)" />
              </SelectTrigger>
              <SelectContent>
                {TRACK_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="font-albert">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
              Squads with a track are shown to users in that track first
            </p>
          </div>

          {/* Avatar URL */}
          <div>
            <label htmlFor="avatarUrl" className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
              Avatar URL
            </label>
            <input
              id="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert"
            />
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1 font-albert">
              Optional: URL to squad profile picture
            </p>
          </div>

          {/* Premium Toggle */}
          <div className="flex items-center gap-2">
            <input
              id="isPremium"
              type="checkbox"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
              className="w-4 h-4 text-[#a07855] border-[#e1ddd8] dark:border-[#262b35] rounded focus:ring-[#a07855]"
            />
            <label htmlFor="isPremium" className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Premium Squad
            </label>
          </div>

          {/* Coach Selection */}
          {isPremium && (
            <div>
              <label htmlFor="coach" className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                Coach *
              </label>
              <Select value={coachId} onValueChange={setCoachId}>
                <SelectTrigger className="w-full font-albert">
                  <SelectValue placeholder="Select a coach" />
                </SelectTrigger>
                <SelectContent>
                  {coaches.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id} className="font-albert">
                      {coach.name || `${coach.firstName} ${coach.lastName}`} ({coach.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {coaches.length === 0 && (
                <p className="text-xs text-red-600 mt-1 font-albert">
                  No coaches available. Create a coach user first.
                </p>
              )}
            </div>
          )}

          {/* Members Section - Only show when editing */}
          {squad && (
            <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Members ({members.length})
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUserSearch(!showUserSearch)}
                  className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5 font-albert text-xs"
                >
                  {showUserSearch ? 'Cancel' : '+ Add Member'}
                </Button>
              </div>

              {/* Add Member Search */}
              {showUserSearch && (
                <div className="mb-3 p-3 bg-[#faf8f6] rounded-lg">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-sm"
                    autoFocus
                  />
                  
                  {searchLoading ? (
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2 font-albert">Searching...</p>
                  ) : availableUsers.length > 0 ? (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {availableUsers.map((user) => {
                        const isAdding = addingUserId === user.id;
                        return (
                          <div
                            key={user.id}
                            onClick={() => !isAdding && handleAddMember(user.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                              isAdding 
                                ? 'opacity-50 cursor-wait' 
                                : 'cursor-pointer hover:bg-white'
                            }`}
                          >
                            {user.imageUrl ? (
                              <Image src={user.imageUrl} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#a07855] flex items-center justify-center text-white text-xs font-bold">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate font-albert">{user.name}</p>
                              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate font-albert">{user.email}</p>
                            </div>
                            {isAdding ? (
                              <svg className="w-4 h-4 animate-spin text-[#a07855]" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <span className="text-xs text-[#a07855] font-albert">Add</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : searchQuery ? (
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2 font-albert">No available users found</p>
                  ) : (
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2 font-albert">Type to search users not in a squad</p>
                  )}
                </div>
              )}

              {/* Members List */}
              {membersLoading ? (
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading members...</p>
              ) : members.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 bg-[#faf8f6] rounded-lg"
                    >
                      {member.imageUrl ? (
                        <Image src={member.imageUrl} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#a07855] flex items-center justify-center text-white text-sm font-bold">
                          {member.firstName?.charAt(0) || member.lastName?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate font-albert">
                          {member.firstName} {member.lastName}
                          {squad.coachId === member.userId && (
                            <span className="ml-2 text-xs text-[#a07855] font-normal">(Coach)</span>
                          )}
                        </p>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate font-albert">
                          {member.roleInSquad}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove member"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No members yet. Add members using the button above.</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5 font-albert"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || (isPremium && !coachId)}
              className="bg-[#a07855] hover:bg-[#8c6245] text-white font-albert"
            >
              {loading ? 'Saving...' : squad ? 'Update Squad' : 'Create Squad'}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
