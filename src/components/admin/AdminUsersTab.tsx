'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { UserPlus, RefreshCw } from 'lucide-react';
import { SquadManagerPopover } from './SquadManagerPopover';
import type { UserRole, UserTier, CoachingStatus, OrgRole, Squad, ProgramType } from '@/types';
import { validateSubdomain } from '@/types';
import { 
  canModifyUserRole, 
  canDeleteUser, 
  getAssignableRoles,
  formatRoleName,
  getRoleBadgeColor,
  formatTierName,
  getTierBadgeColor,
  formatCoachingStatus,
  getCoachingStatusBadgeColor,
  // Org role helpers
  isSuperCoach,
  isSuperAdmin,
  formatOrgRoleName,
  getOrgRoleBadgeColor,
  getAssignableOrgRoles,
  getAssignableOrgRolesForAdmin,
} from '@/lib/admin-utils-shared';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Button } from '@/components/ui/button';
import { InviteClientsDialog } from '@/components/coach/InviteClientsDialog';

// Program enrollment info returned from API
interface UserProgramEnrollment {
  programId: string;
  programName: string;
  programType: ProgramType;
  status: 'active' | 'upcoming' | 'completed';
}

interface ClerkAdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  role: UserRole;
  orgRole?: OrgRole; // Organization-level role (for multi-tenant)
  orgRoleForOrg?: OrgRole; // Org role for a specific org (from org-scoped API)
  tier: UserTier;
  // Squad (for multi-tenant) - supports multiple squads
  squadIds?: string[]; // Array of squad IDs user belongs to
  squadId?: string | null; // Legacy single squad field (deprecated)
  premiumSquadId?: string | null;
  // Coaching is separate from membership tier
  coachingStatus?: CoachingStatus;
  coaching?: boolean; // Legacy flag
  // Assigned coach (for displaying in Coach column)
  coachId?: string | null;
  coachName?: string | null;
  // Program enrollments
  programs?: UserProgramEnrollment[];
  // Referral tracking
  invitedBy?: string | null;
  invitedByName?: string | null;
  inviteCode?: string | null;
  invitedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Available column keys for visibility control
export type ColumnKey = 'select' | 'avatar' | 'name' | 'email' | 'role' | 'orgRole' | 'tier' | 'squad' | 'coach' | 'coaching' | 'programs' | 'invitedBy' | 'invitedAt' | 'created' | 'actions';

// Default columns for full access (select column added for bulk operations)
const ALL_COLUMNS: ColumnKey[] = ['select', 'avatar', 'name', 'email', 'role', 'tier', 'squad', 'coaching', 'invitedBy', 'invitedAt', 'created', 'actions'];

// Limited columns for org coaches (read-only, no select)
const LIMITED_COLUMNS: ColumnKey[] = ['avatar', 'name', 'email', 'coach', 'programs', 'created'];

// Simplified squad info for dropdown
interface SquadOption {
  id: string;
  name: string;
}

export interface AdminUsersTabProps {
  currentUserRole: UserRole;
  /** Override API endpoint for multi-tenancy (e.g., '/api/coach/org-users' for coaches) */
  apiEndpoint?: string;
  /** Optional callback when a user is selected - makes rows clickable */
  onSelectUser?: (userId: string) => void;
  /** Custom header title */
  headerTitle?: string;
  /** Show org role column instead of global role (for coach dashboard) */
  showOrgRole?: boolean;
  /** Current user's org role for permission checks */
  currentUserOrgRole?: OrgRole;
  /** Read-only mode - hides all edit controls (role, tier, delete) */
  readOnly?: boolean;
  /** Which columns to show (defaults to ALL_COLUMNS or LIMITED_COLUMNS based on readOnly) */
  visibleColumns?: ColumnKey[];
  /** 
   * Org-scoped mode for viewing/managing users in a specific organization.
   * When set, uses org-scoped API endpoints and shows org role for that specific org.
   */
  orgMode?: { organizationId: string };
  /** Show the "Invite New Clients" button (for coach dashboard) */
  showInviteButton?: boolean;
}

export function AdminUsersTab({ 
  currentUserRole, 
  apiEndpoint: apiEndpointProp, 
  onSelectUser, 
  headerTitle = 'Users',
  showOrgRole = false,
  currentUserOrgRole,
  readOnly = false,
  visibleColumns,
  orgMode,
  showInviteButton = false,
}: AdminUsersTabProps) {
  // Determine API endpoint - use org-scoped endpoint if in orgMode
  const apiEndpoint = apiEndpointProp || (
    orgMode 
      ? `/api/admin/organizations/${orgMode.organizationId}/users`
      : '/api/admin/users'
  );
  // Determine which columns to show
  const columns = visibleColumns || (readOnly ? LIMITED_COLUMNS : ALL_COLUMNS);
  const showColumn = (col: ColumnKey) => columns.includes(col);
  const [users, setUsers] = useState<ClerkAdminUser[]>([]);
  
  // Invite dialog state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<ClerkAdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingTierUserId, setUpdatingTierUserId] = useState<string | null>(null);
  const [updatingOrgRoleUserId, setUpdatingOrgRoleUserId] = useState<string | null>(null);
  
  // Coach subdomain prompt state
  const [subdomainPrompt, setSubdomainPrompt] = useState<{
    userId: string;
    userName: string;
    currentRole: UserRole;
  } | null>(null);
  const [subdomain, setSubdomain] = useState('');
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [subdomainLoading, setSubdomainLoading] = useState(false);
  
  // Squad state for org-scoped mode
  const [squads, setSquads] = useState<SquadOption[]>([]);
  const [updatingSquadUserId, setUpdatingSquadUserId] = useState<string | null>(null);
  
  // Multi-select state for bulk operations
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  
  // Detect if using org-scoped API (coach dashboard)
  const isOrgScopedApi = apiEndpointProp?.includes('/api/coach/org-users');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Fetch squads for org-scoped mode
  useEffect(() => {
    if (!isOrgScopedApi) return;
    
    const fetchSquads = async () => {
      try {
        const squadsRes = await fetch('/api/coach/org-squads');
        
        if (squadsRes.ok) {
          const data = await squadsRes.json();
          setSquads((data.squads || []).map((s: Squad) => ({ id: s.id, name: s.name })));
        }
      } catch (err) {
        console.warn('Failed to fetch squads:', err);
      }
    };
    
    fetchSquads();
  }, [isOrgScopedApi]);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.firstName.toLowerCase().includes(query) ||
        user.lastName.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleRoleChange = async (userId: string, currentRole: UserRole, newRole: UserRole) => {
    if (!canModifyUserRole(currentUserRole, currentRole, newRole)) {
      alert('You do not have permission to make this role change.');
      return;
    }

    // If changing to coach, show subdomain prompt instead
    if (newRole === 'coach') {
      const user = users.find(u => u.id === userId);
      setSubdomainPrompt({
        userId,
        userName: user?.name || user?.email || 'this user',
        currentRole,
      });
      setSubdomain('');
      setSubdomainError(null);
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update role');
      }

      // Refresh users list
      await fetchUsers();
    } catch (err) {
      console.error('Error updating role:', err);
      alert(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleSubdomainSubmit = async () => {
    if (!subdomainPrompt) return;
    
    // Validate subdomain
    const validation = validateSubdomain(subdomain);
    if (!validation.valid) {
      setSubdomainError(validation.error || 'Invalid subdomain');
      return;
    }
    
    setSubdomainLoading(true);
    setSubdomainError(null);
    
    try {
      const response = await fetch(`/api/admin/users/${subdomainPrompt.userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'coach', subdomain: subdomain.toLowerCase().trim() }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role');
      }

      // Success! Show the tenant URL
      if (data.tenantUrl) {
        alert(`Coach role assigned! Their tenant URL is:\n${data.tenantUrl}`);
      }

      // Close dialog and refresh
      setSubdomainPrompt(null);
      setSubdomain('');
      await fetchUsers();
    } catch (err) {
      console.error('Error updating role:', err);
      setSubdomainError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setSubdomainLoading(false);
    }
  };

  const handleTierChange = async (userId: string, newTier: UserTier) => {
    try {
      setUpdatingTierUserId(userId);
      
      const response = await fetch('/api/admin/users/without-squad', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: newTier }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update tier');
      }

      // Update local state optimistically
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, tier: newTier } : user
        )
      );
    } catch (err) {
      console.error('Error updating tier:', err);
      alert(err instanceof Error ? err.message : 'Failed to update tier');
      // Refresh to get correct state
      await fetchUsers();
    } finally {
      setUpdatingTierUserId(null);
    }
  };

  const handleOrgRoleChange = async (userId: string, newOrgRole: OrgRole) => {
    // Check permissions: super_admin can change any org role, super_coach can change coach/member
    const isPlatformAdmin = isSuperAdmin(currentUserRole);
    const isOrgSuperCoach = isSuperCoach(currentUserOrgRole);
    
    if (!isPlatformAdmin && !isOrgSuperCoach) {
      alert('Only Super Admin or Super Coach can change organization roles.');
      return;
    }

    // super_coach cannot assign super_coach role
    if (!isPlatformAdmin && newOrgRole === 'super_coach') {
      alert('Only Super Admin can assign Super Coach role.');
      return;
    }

    try {
      setUpdatingOrgRoleUserId(userId);
      
      // Determine API endpoint based on mode:
      // 1. In orgMode (admin viewing specific org) -> use org-scoped admin API
      // 2. Platform admin not in orgMode -> use generic admin API
      // 3. Super coach -> use coach API
      let orgRoleApiEndpoint: string;
      if (orgMode && isPlatformAdmin) {
        // Org-scoped admin API (best for viewing specific org)
        orgRoleApiEndpoint = `/api/admin/organizations/${orgMode.organizationId}/users/${userId}/org-role`;
      } else if (isPlatformAdmin) {
        // Generic admin API
        orgRoleApiEndpoint = `/api/admin/users/${userId}/org-role`;
      } else {
        // Coach API
        orgRoleApiEndpoint = `/api/coach/org-users/${userId}/org-role`;
      }
      
      const response = await fetch(orgRoleApiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgRole: newOrgRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update organization role');
      }

      // Update local state optimistically - support both orgRole and orgRoleForOrg
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId 
            ? { ...user, orgRole: newOrgRole, orgRoleForOrg: newOrgRole } 
            : user
        )
      );
    } catch (err) {
      console.error('Error updating org role:', err);
      alert(err instanceof Error ? err.message : 'Failed to update organization role');
      // Refresh to get correct state
      await fetchUsers();
    } finally {
      setUpdatingOrgRoleUserId(null);
    }
  };


  // Add user to a squad (proper multi-squad support)
  const handleAddToSquad = async (userId: string, squadId: string) => {
    if (!isOrgScopedApi) return;
    
    try {
      setUpdatingSquadUserId(userId);
      
      const response = await fetch(`/api/coach/org-users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addSquadId: squadId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add to squad');
      }

      // Update local state - add squad to user's squadIds
      setUsers((prev) =>
        prev.map((user) => {
          if (user.id !== userId) return user;
          const currentSquadIds = user.squadIds || [];
          if (currentSquadIds.includes(squadId)) return user;
          return { 
            ...user, 
            squadIds: [...currentSquadIds, squadId],
            squadId: user.squadId || squadId, // Keep legacy field in sync
          };
        })
      );
    } catch (err) {
      console.error('Error adding to squad:', err);
      alert(err instanceof Error ? err.message : 'Failed to add to squad');
      await fetchUsers();
    } finally {
      setUpdatingSquadUserId(null);
    }
  };

  // Remove user from a squad (proper multi-squad support)
  const handleRemoveFromSquad = async (userId: string, squadId: string) => {
    if (!isOrgScopedApi) return;
    
    try {
      setUpdatingSquadUserId(userId);
      
      const response = await fetch(`/api/coach/org-users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeSquadId: squadId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove from squad');
      }

      // Update local state - remove squad from user's squadIds
      setUsers((prev) =>
        prev.map((user) => {
          if (user.id !== userId) return user;
          const currentSquadIds = user.squadIds || [];
          const updatedSquadIds = currentSquadIds.filter(id => id !== squadId);
          return { 
            ...user, 
            squadIds: updatedSquadIds,
            // Update legacy field
            squadId: updatedSquadIds.length > 0 ? updatedSquadIds[0] : null,
          };
        })
      );
    } catch (err) {
      console.error('Error removing from squad:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove from squad');
      await fetchUsers();
    } finally {
      setUpdatingSquadUserId(null);
    }
  };

  // Selection handlers
  const handleSelectUser = (userId: string, selected: boolean) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(userId);
      } else {
        newSet.delete(userId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const isAllSelected = filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length;
  const isSomeSelected = selectedUserIds.size > 0 && selectedUserIds.size < filteredUsers.length;

  // Bulk add users to a squad
  const handleBulkAddToSquad = async (squadId: string) => {
    if (!isOrgScopedApi || selectedUserIds.size === 0) return;
    
    try {
      setBulkUpdating(true);
      
      // Process each user individually (could be batched in a bulk API later)
      const results = { success: 0, failed: 0 };
      for (const userId of selectedUserIds) {
        try {
          const response = await fetch(`/api/coach/org-users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addSquadId: squadId }),
          });
          
          if (response.ok) {
            results.success++;
          } else {
            results.failed++;
          }
        } catch {
          results.failed++;
        }
      }
      
      // Refresh to get updated state
      await fetchUsers();
      
      // Show result
      if (results.failed > 0) {
        alert(`Added ${results.success} users to squad. ${results.failed} failed.`);
      }
      
      // Clear selection after bulk operation
      setSelectedUserIds(new Set());
    } catch (err) {
      console.error('Error bulk adding to squad:', err);
      alert(err instanceof Error ? err.message : 'Failed to update users. Please try again.');
      await fetchUsers();
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (!canDeleteUser(currentUserRole, userToDelete.role || 'user')) {
      alert('You do not have permission to delete this user.');
      setUserToDelete(null);
      return;
    }

    try {
      setDeleteLoading(true);

      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      // Refresh users list
      await fetchUsers();
      setUserToDelete(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
            <div className="h-10 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
          </div>
        </div>
        {/* Search skeleton */}
        <div className="h-10 w-full max-w-md bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl mb-6" />
        {/* User rows skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
              <div className="w-10 h-10 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-3 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                <div className="h-6 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button 
            onClick={fetchUsers} 
            className="mt-4 bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const assignableRoles = getAssignableRoles(currentUserRole);

  return (
    <>
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {/* Header with search and actions */}
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">{headerTitle}</h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mt-1">
                {filteredUsers.length} of {users.length} {headerTitle.toLowerCase()}{users.length !== 1 ? '' : ''}
                {searchQuery && ' matching search'}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-none">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a] dark:focus:ring-[#b8896a] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190]"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:text-[#f5f5f8]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Refresh Icon + Add Button row on mobile */}
              <div className="flex items-center gap-3">
                {/* Refresh Icon */}
                <button 
                  onClick={fetchUsers}
                  className="p-2.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] active:bg-[#e8e5e1] dark:active:bg-[#1a1e27] rounded-lg border border-[#e1ddd8] dark:border-[#262b35] transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                
                {/* Add Clients Button */}
                {showInviteButton && (
                  <Button
                    onClick={() => setShowInviteDialog(true)}
                    className="flex-1 sm:flex-none bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] active:bg-[#7a5639] dark:bg-[#b8896a] dark:hover:bg-[#a07855] dark:active:bg-[#96714d] text-white font-albert"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add New Clients
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedUserIds.size > 0 && isOrgScopedApi && !readOnly && (
          <div className="px-6 py-3 bg-[#a07855]/10 dark:bg-[#b8896a]/10 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 flex items-center gap-4 flex-wrap">
            <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">
              {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
            </span>
            
            <div className="flex items-center gap-2">
              <span className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">Add to Squad:</span>
              <Select
                value=""
                onValueChange={(squadId) => handleBulkAddToSquad(squadId)}
                disabled={bulkUpdating}
              >
                <SelectTrigger className={`w-[150px] font-albert text-sm h-8 ${bulkUpdating ? 'opacity-50' : ''}`}>
                  <SelectValue placeholder="Select squad" />
                </SelectTrigger>
                <SelectContent>
                  {squads.map((squad) => (
                    <SelectItem key={squad.id} value={squad.id} className="font-albert">
                      {squad.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <button
              onClick={() => setSelectedUserIds(new Set())}
              className="ml-auto font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
            >
              Clear selection
            </button>
            
            {bulkUpdating && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin"></div>
                <span className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">Updating...</span>
              </div>
            )}
          </div>
        )}

        {/* Users table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {showColumn('select') && isOrgScopedApi && !readOnly && (
                  <TableHead className="w-[50px]">
                    <BrandedCheckbox
                      checked={isAllSelected}
                      indeterminate={isSomeSelected}
                      onChange={(checked) => handleSelectAll(checked)}
                    />
                  </TableHead>
                )}
                {showColumn('avatar') && <TableHead className="font-albert">Avatar</TableHead>}
                {showColumn('name') && <TableHead className="font-albert">Name</TableHead>}
                {showColumn('email') && <TableHead className="font-albert">Email</TableHead>}
                {showColumn('role') && !showOrgRole && <TableHead className="font-albert">Role</TableHead>}
                {showColumn('role') && showOrgRole && <TableHead className="font-albert">Org Role</TableHead>}
                {showColumn('tier') && <TableHead className="font-albert">Tier</TableHead>}
                {showColumn('squad') && <TableHead className="font-albert">Squad</TableHead>}
                {showColumn('coach') && <TableHead className="font-albert">Coach</TableHead>}
                {showColumn('coaching') && <TableHead className="font-albert">Coaching</TableHead>}
                {showColumn('programs') && <TableHead className="font-albert">Programs</TableHead>}
                {showColumn('invitedBy') && <TableHead className="font-albert">Invited By</TableHead>}
                {showColumn('invitedAt') && <TableHead className="font-albert">Invited At</TableHead>}
                {showColumn('created') && <TableHead className="font-albert">Created</TableHead>}
                {showColumn('actions') && !readOnly && <TableHead className="font-albert text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const userRole = user.role || 'user';
                // Use orgRoleForOrg (from org-scoped API) if available, otherwise fallback to orgRole
                const userOrgRole = user.orgRoleForOrg || user.orgRole || 'member';
                const userTier = user.tier || 'free';
                const canModifyThisUser = canModifyUserRole(currentUserRole, userRole, userRole);
                const canDeleteThisUser = canDeleteUser(currentUserRole, userRole);
                const isUpdatingTier = updatingTierUserId === user.id;
                const isUpdatingOrgRole = updatingOrgRoleUserId === user.id;
                // Super admin can modify any org role; super_coach can modify coach/member (but not super_coach)
                const canModifyOrgRole = isSuperAdmin(currentUserRole) || (isSuperCoach(currentUserOrgRole) && userOrgRole !== 'super_coach');

                return (
                  <TableRow 
                    key={user.id}
                    className={`${onSelectUser ? 'cursor-pointer' : ''} ${selectedUserIds.has(user.id) ? 'bg-[#a07855]/5 dark:bg-[#b8896a]/5' : ''} hover:bg-[#faf8f6] dark:hover:bg-[#11141b]`}
                    onClick={() => onSelectUser?.(user.id)}
                  >
                    {/* Checkbox for selection */}
                    {showColumn('select') && isOrgScopedApi && !readOnly && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <BrandedCheckbox
                          checked={selectedUserIds.has(user.id)}
                          onChange={(checked) => handleSelectUser(user.id, checked)}
                        />
                      </TableCell>
                    )}
                    
                    {/* Avatar */}
                    {showColumn('avatar') && (
                      <TableCell>
                        {user.imageUrl ? (
                          <Image
                            src={user.imageUrl}
                            alt={user.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a07855] to-[#8c6245] flex items-center justify-center text-white font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </TableCell>
                    )}
                    
                    {/* Name */}
                    {showColumn('name') && (
                      <TableCell className="font-albert font-medium">
                        {user.name || 'Unnamed User'}
                      </TableCell>
                    )}
                    
                    {/* Email */}
                    {showColumn('email') && (
                      <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                        {user.email}
                      </TableCell>
                    )}
                    
                    {/* Role (global) - only in admin context */}
                    {showColumn('role') && !showOrgRole && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {!readOnly && canModifyThisUser ? (
                          <Select
                            value={userRole}
                            onValueChange={(newRole) => handleRoleChange(user.id, userRole, newRole as UserRole)}
                          >
                            <SelectTrigger className="w-[140px] font-albert">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {assignableRoles.map((role) => (
                                <SelectItem key={role} value={role} className="font-albert">
                                  {formatRoleName(role)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${getRoleBadgeColor(userRole)}`}>
                            {formatRoleName(userRole)}
                          </span>
                        )}
                      </TableCell>
                    )}

                    {/* Org Role - only in coach dashboard context */}
                    {showColumn('role') && showOrgRole && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {!readOnly && canModifyOrgRole ? (
                          <Select
                            value={userOrgRole}
                            onValueChange={(newOrgRole) => handleOrgRoleChange(user.id, newOrgRole as OrgRole)}
                            disabled={isUpdatingOrgRole}
                          >
                            <SelectTrigger className={`w-[140px] font-albert ${isUpdatingOrgRole ? 'opacity-50' : ''}`}>
                              <SelectValue>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getOrgRoleBadgeColor(userOrgRole)}`}>
                                  {formatOrgRoleName(userOrgRole)}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {/* Super admins can assign all org roles including super_coach */}
                              {(isSuperAdmin(currentUserRole) ? getAssignableOrgRolesForAdmin() : getAssignableOrgRoles()).map((orgRole) => (
                                <SelectItem key={orgRole} value={orgRole} className="font-albert">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getOrgRoleBadgeColor(orgRole)}`}>
                                    {formatOrgRoleName(orgRole)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${getOrgRoleBadgeColor(userOrgRole)}`}>
                            {formatOrgRoleName(userOrgRole)}
                          </span>
                        )}
                      </TableCell>
                    )}
                    
                    {/* Tier - No longer includes "coaching" (coaching is separate) */}
                    {showColumn('tier') && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {!readOnly ? (
                          <Select
                            value={userTier}
                            onValueChange={(newTier) => handleTierChange(user.id, newTier as UserTier)}
                            disabled={isUpdatingTier}
                          >
                            <SelectTrigger className={`w-[130px] font-albert ${isUpdatingTier ? 'opacity-50' : ''}`}>
                              <SelectValue>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTierBadgeColor(userTier)}`}>
                                  {formatTierName(userTier)}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free" className="font-albert">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                  Free
                                </span>
                              </SelectItem>
                              <SelectItem value="standard" className="font-albert">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  Standard
                                </span>
                              </SelectItem>
                              <SelectItem value="premium" className="font-albert">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  Premium
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${getTierBadgeColor(userTier)}`}>
                            {formatTierName(userTier)}
                          </span>
                        )}
                      </TableCell>
                    )}

                    {/* Squad - Compact display with popover for management */}
                    {showColumn('squad') && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <SquadManagerPopover
                          userSquadIds={user.squadIds || (user.squadId ? [user.squadId] : [])}
                          squads={squads}
                          onAddSquad={(squadId) => handleAddToSquad(user.id, squadId)}
                          onRemoveSquad={(squadId) => handleRemoveFromSquad(user.id, squadId)}
                          disabled={updatingSquadUserId === user.id}
                          readOnly={!isOrgScopedApi || readOnly}
                        />
                      </TableCell>
                    )}

                    {/* Coach - shows assigned coach name */}
                    {showColumn('coach') && (
                      <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                        {user.coachName ? (
                          <span>{user.coachName}</span>
                        ) : (
                          <span className="text-[#8c8c8c] dark:text-[#7d8190]">-</span>
                        )}
                      </TableCell>
                    )}
                    
                    {/* Coaching Status - Separate from tier */}
                    {showColumn('coaching') && (
                      <TableCell>
                        {(() => {
                          // Determine coaching status from new field or legacy flag
                          const coachingStatus = user.coachingStatus || (user.coaching ? 'active' : 'none');
                          return (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${getCoachingStatusBadgeColor(coachingStatus as CoachingStatus)}`}>
                              {formatCoachingStatus(coachingStatus as CoachingStatus)}
                            </span>
                          );
                        })()}
                      </TableCell>
                    )}
                    
                    {/* Programs - Shows enrolled programs with (1:1)/(Group) prefix */}
                    {showColumn('programs') && (
                      <TableCell>
                        {user.programs && user.programs.length > 0 ? (
                          <div className="flex flex-col gap-1 max-w-[200px]">
                            {user.programs.map((program) => (
                              <span
                                key={program.programId}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-albert truncate ${
                                  program.programType === 'individual'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                }`}
                                title={`${program.programType === 'individual' ? '(1:1)' : '(Group)'} ${program.programName}`}
                              >
                                {program.programType === 'individual' ? '(1:1)' : '(Group)'} {program.programName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#8c8c8c] dark:text-[#7d8190]">—</span>
                        )}
                      </TableCell>
                    )}
                    
                    {/* Invited By */}
                    {showColumn('invitedBy') && (
                      <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                        {user.invitedByName ? (
                          <span className="inline-flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {user.invitedByName}
                          </span>
                        ) : (
                          <span className="text-[#8c8c8c] dark:text-[#7d8190]">-</span>
                        )}
                      </TableCell>
                    )}
                    
                    {/* Invited At */}
                    {showColumn('invitedAt') && (
                      <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                        {user.invitedAt ? (
                          new Date(user.invitedAt).toLocaleDateString()
                        ) : (
                          <span className="text-[#8c8c8c] dark:text-[#7d8190]">-</span>
                        )}
                      </TableCell>
                    )}
                    
                    {/* Created Date */}
                    {showColumn('created') && (
                      <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                    )}
                    
                    {/* Actions */}
                    {showColumn('actions') && !readOnly && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {canDeleteThisUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUserToDelete(user)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 font-albert"
                          >
                            Delete
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            {searchQuery ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#a07855]/10 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-lg mb-2">No users found</p>
                <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 font-albert text-sm">
                  No users match &quot;{searchQuery}&quot;
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery('')}
                  className="mt-4 border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
                >
                  Clear search
                </Button>
              </>
            ) : (
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No users found</p>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Delete User</AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              Are you sure you want to delete <strong>{userToDelete?.name || userToDelete?.email}</strong>? 
              This action cannot be undone.
              {/* TODO: Integrate with Clerk to also delete from authentication system */}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} className="font-albert">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 font-albert"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subdomain prompt dialog for coach role assignment */}
      <AlertDialog open={!!subdomainPrompt} onOpenChange={(open: boolean) => !open && setSubdomainPrompt(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Assign Coach Role</AlertDialogTitle>
            <AlertDialogDescription className="font-albert" asChild>
              <div>
                <p className="mb-4">
                  Choose a subdomain for <strong>{subdomainPrompt?.userName}</strong>&apos;s organization.
                  This will be their unique URL for their coaching platform.
                </p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Subdomain
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        value={subdomain}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                          setSubdomainError(null);
                        }}
                        placeholder="acme"
                        className="flex-1 h-10 px-3 py-2 rounded-lg border border-[#e1ddd8] dark:border-[#313746] bg-white dark:bg-[#1e222a] text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/20 focus:border-[#a07855] dark:border-[#b8896a] font-albert disabled:opacity-50"
                        disabled={subdomainLoading}
                      />
                      <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-nowrap">
                        .growthaddicts.com
                      </span>
                    </div>
                    {subdomainError && (
                      <p className="text-sm text-red-600 dark:text-red-400 font-albert">{subdomainError}</p>
                    )}
                    <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                      3-30 characters. Letters, numbers, and hyphens only.
                    </p>
                  </div>
                  
                  {subdomain && !subdomainError && (
                    <div className="p-3 bg-[#a07855]/10 dark:bg-[#b8896a]/10 rounded-lg">
                      <p className="text-sm font-medium text-[#a07855] dark:text-[#b8896a] font-albert">
                        Tenant URL Preview:
                      </p>
                      <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-mono">
                        https://{subdomain.toLowerCase()}.growthaddicts.com
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setSubdomainPrompt(null)}
              disabled={subdomainLoading}
              className="font-albert"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                handleSubdomainSubmit();
              }}
              disabled={!subdomain || subdomainLoading}
              className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white font-albert"
            >
              {subdomainLoading ? 'Creating...' : 'Assign Coach Role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite Clients Dialog */}
      {showInviteButton && (
        <InviteClientsDialog
          isOpen={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
        />
      )}
    </>
  );
}
