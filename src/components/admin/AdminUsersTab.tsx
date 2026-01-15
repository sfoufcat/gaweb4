'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { UserPlus, RefreshCw, Eye, MessageCircle, Send, Trash2, Download } from 'lucide-react';
import { SquadManagerPopover } from './SquadManagerPopover';
import { ProgramManagerPopover } from './ProgramManagerPopover';
import { ComplimentaryAccessConfirmation } from './ComplimentaryAccessConfirmation';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { generateDemoUsers, getDemoSquads } from '@/lib/demo-data';
import { SendDMModal, type DMRecipient } from '@/components/coach/SendDMModal';
import type { UserRole, UserTier, CoachingStatus, OrgRole, Squad, ProgramType, CoachTier } from '@/types';
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
  
  // Manual tier assignment state (for admin coach creation)
  const [coachTier, setCoachTier] = useState<CoachTier>('starter');
  const [manualBilling, setManualBilling] = useState(true);
  const [manualExpiresAt, setManualExpiresAt] = useState<string>(''); // ISO date string
  
  // Squad state for org-scoped mode
  const [squads, setSquads] = useState<SquadOption[]>([]);
  const [updatingSquadUserId, setUpdatingSquadUserId] = useState<string | null>(null);

  // Program state for org-scoped mode
  const [availablePrograms, setAvailablePrograms] = useState<Array<{
    id: string;
    name: string;
    type: ProgramType;
    priceInCents: number;
    currency?: string;
  }>>([]);
  const [cohortsByProgram, setCohortsByProgram] = useState<Record<string, Array<{
    id: string;
    name: string;
    programId: string;
    status: 'upcoming' | 'active' | 'completed' | 'archived';
    startDate: string;
  }>>>({});
  const [enrollingUserId, setEnrollingUserId] = useState<string | null>(null);
  const [pendingEnrollment, setPendingEnrollment] = useState<{
    userId: string;
    userName: string;
    programId: string;
    cohortId?: string;
  } | null>(null);
  const [showPaidConfirmation, setShowPaidConfirmation] = useState(false);
  
  // Multi-select state for bulk operations
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  
  // DM Modal state
  const [dmRecipients, setDmRecipients] = useState<DMRecipient[]>([]);
  const [showDmModal, setShowDmModal] = useState(false);

  // Table scroll ref for horizontal scroll on vertical wheel
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Handle wheel event to convert vertical scroll to horizontal when hovering over table
  const handleTableWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const container = tableContainerRef.current;
    if (!container) return;

    // Check if there's horizontal overflow
    const hasHorizontalScroll = container.scrollWidth > container.clientWidth;
    if (!hasHorizontalScroll) return;

    // Only intercept if we're scrolling vertically and there's room to scroll horizontally
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      const atLeftEdge = container.scrollLeft === 0;
      const atRightEdge = container.scrollLeft >= container.scrollWidth - container.clientWidth - 1;

      // Don't prevent default if we're at the edge and trying to scroll past it
      if ((e.deltaY < 0 && atLeftEdge) || (e.deltaY > 0 && atRightEdge)) {
        return;
      }

      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  }, []);
  
  // Detected org role from API response (used as fallback when prop isn't provided)
  const [detectedOrgRole, setDetectedOrgRole] = useState<OrgRole | undefined>(undefined);
  
  // Detect if using org-scoped API (coach dashboard)
  const isOrgScopedApi = apiEndpointProp?.includes('/api/coach/org-users');
  
  // Demo mode - only active for coach dashboard context
  const { isDemoMode, openSignupModal } = useDemoMode();
  const isCoachContext = isOrgScopedApi || apiEndpointProp?.includes('/api/coach/');
  const showDemoData = isDemoMode && isCoachContext;
  
  // Generate demo data (memoized)
  const demoUsers = useMemo(() => generateDemoUsers(18), []);
  const demoSquadOptions = useMemo(() => getDemoSquads().map(s => ({ id: s.id, name: s.name })), []);
  
  // Effective org role: use prop if provided, fallback to detected from API
  const effectiveOrgRole = currentUserOrgRole || detectedOrgRole;

  const fetchUsers = async () => {
    // Skip API call in demo mode
    if (showDemoData) {
      setLoading(false);
      return;
    }
    
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
      
      // Store detected org role from API response (helps with org:admin detection)
      if (data.currentUserOrgRole) {
        setDetectedOrgRole(data.currentUserOrgRole as OrgRole);
      }
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
  }, [showDemoData]);
  
  // Use demo data when in demo mode
  const displayUsers: ClerkAdminUser[] = useMemo(() => {
    if (showDemoData) {
      return demoUsers.map(u => ({
        ...u,
        role: u.role as UserRole,
        orgRole: u.orgRole as OrgRole,
        tier: u.tier as UserTier,
        coachingStatus: u.coachingStatus as CoachingStatus,
        updatedAt: u.updatedAt,
      }));
    }
    return users;
  }, [showDemoData, demoUsers, users]);
  
  // Use demo squads when in demo mode
  const displaySquads = showDemoData ? demoSquadOptions : squads;
  
  // Fetch squads for org-scoped mode
  useEffect(() => {
    if (!isOrgScopedApi || showDemoData) return;
    
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
  }, [isOrgScopedApi, showDemoData]);

  // Fetch programs for org-scoped mode
  useEffect(() => {
    if (!isOrgScopedApi || showDemoData) return;

    const fetchPrograms = async () => {
      try {
        const res = await fetch('/api/coach/org-programs');
        if (res.ok) {
          const data = await res.json();
          setAvailablePrograms((data.programs || []).map((p: { id: string; name: string; type: ProgramType; priceInCents?: number; currency?: string }) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            priceInCents: p.priceInCents || 0,
            currency: p.currency,
          })));
        }
      } catch (err) {
        console.warn('Failed to fetch programs:', err);
      }
    };

    fetchPrograms();
  }, [isOrgScopedApi, showDemoData]);

  // Check for openInvite query param to auto-open invite dialog
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('openInvite') === 'true' && showInviteButton) {
      setShowInviteDialog(true);
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [showInviteButton]);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return displayUsers;
    
    const query = searchQuery.toLowerCase();
    return displayUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.firstName.toLowerCase().includes(query) ||
        user.lastName.toLowerCase().includes(query)
    );
  }, [displayUsers, searchQuery]);

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
        body: JSON.stringify({ 
          role: 'coach', 
          subdomain: subdomain.toLowerCase().trim(),
          // Manual tier assignment fields
          tier: coachTier,
          manualBilling,
          manualExpiresAt: manualExpiresAt || null,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role');
      }

      // Success! Show the tenant URL and tier info
      if (data.tenantUrl) {
        const tierInfo = coachTier ? ` with ${coachTier.charAt(0).toUpperCase() + coachTier.slice(1)} tier` : '';
        const billingInfo = manualBilling ? ' (manual billing)' : '';
        alert(`Coach role assigned${tierInfo}${billingInfo}!\n\nTheir tenant URL is:\n${data.tenantUrl}`);
      }

      // Close dialog and reset all fields
      setSubdomainPrompt(null);
      setSubdomain('');
      setCoachTier('starter');
      setManualBilling(true);
      setManualExpiresAt('');
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
    // Use effectiveOrgRole which includes detection from API response for org:admin users
    const isPlatformAdmin = isSuperAdmin(currentUserRole);
    const isOrgSuperCoach = isSuperCoach(effectiveOrgRole);
    
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

  // Load cohorts for a group program
  const loadCohortsForProgram = async (programId: string) => {
    if (cohortsByProgram[programId]) return; // Already loaded

    try {
      const res = await fetch(`/api/coach/org-programs/${programId}/cohorts`);
      if (res.ok) {
        const data = await res.json();
        setCohortsByProgram(prev => ({
          ...prev,
          [programId]: (data.cohorts || []).map((c: { id: string; name: string; status: string; startDate: string }) => ({
            id: c.id,
            name: c.name,
            programId,
            status: c.status as 'upcoming' | 'active' | 'completed' | 'archived',
            startDate: c.startDate,
          })),
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch cohorts:', err);
    }
  };

  // Handle adding user to a program
  const handleAddToProgram = async (userId: string, userName: string, programId: string, cohortId?: string) => {
    const program = availablePrograms.find(p => p.id === programId);
    if (!program) return;

    // For paid programs, show confirmation dialog first
    if (program.priceInCents > 0) {
      setPendingEnrollment({ userId, userName, programId, cohortId });
      setShowPaidConfirmation(true);
      return;
    }

    // For free programs, enroll directly
    await executeEnrollment(userId, programId, cohortId);
  };

  // Execute the actual enrollment
  const executeEnrollment = async (userId: string, programId: string, cohortId?: string) => {
    try {
      setEnrollingUserId(userId);

      const response = await fetch('/api/programs/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId,
          cohortId,
          targetUserId: userId, // Coach-initiated enrollment
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to enroll in program');
      }

      // Update local state to show new enrollment
      const program = availablePrograms.find(p => p.id === programId);
      if (program) {
        setUsers((prev) =>
          prev.map((user) => {
            if (user.id !== userId) return user;
            const currentPrograms = user.programs || [];
            return {
              ...user,
              programs: [
                ...currentPrograms,
                {
                  programId,
                  programName: program.name,
                  programType: program.type,
                  status: 'active' as const,
                },
              ],
            };
          })
        );
      }

      alert('Client enrolled in program successfully');
    } catch (err) {
      console.error('Error enrolling in program:', err);
      alert(err instanceof Error ? err.message : 'Failed to enroll in program');
    } finally {
      setEnrollingUserId(null);
      setPendingEnrollment(null);
      setShowPaidConfirmation(false);
    }
  };

  // Handle paid program confirmation
  const handleConfirmPaidEnrollment = async () => {
    if (!pendingEnrollment) return;
    await executeEnrollment(
      pendingEnrollment.userId,
      pendingEnrollment.programId,
      pendingEnrollment.cohortId
    );
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

    // Check permission based on context
    const userOrgRole = userToDelete.orgRoleForOrg || userToDelete.orgRole || 'member';
    const hasPermission = canDeleteUser(currentUserRole, userToDelete.role || 'user') ||
      (isCoachContext && isSuperCoach(effectiveOrgRole) && userOrgRole !== 'super_coach');

    if (!hasPermission) {
      alert('You do not have permission to remove this user.');
      setUserToDelete(null);
      return;
    }

    try {
      setDeleteLoading(true);

      // Use coach endpoint when in coach context, otherwise admin endpoint
      const deleteEndpoint = isCoachContext
        ? `/api/coach/org-users/${userToDelete.id}`
        : `/api/admin/users/${userToDelete.id}`;

      const response = await fetch(deleteEndpoint, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove user');
      }

      // Refresh users list
      await fetchUsers();
      setUserToDelete(null);
    } catch (err) {
      console.error('Error removing user:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove user');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Export selected users to CSV
  const handleExportCSV = useCallback(() => {
    const selectedUsers = filteredUsers.filter(u => selectedUserIds.has(u.id));
    if (selectedUsers.length === 0) {
      alert('Please select users to export');
      return;
    }

    // Helper to get squad names from IDs
    const getSquadNames = (user: ClerkAdminUser): string => {
      const squadIds = user.squadIds || (user.squadId ? [user.squadId] : []);
      if (squadIds.length === 0) return '';
      const squadMap = new Map(displaySquads.map(s => [s.id, s.name]));
      return squadIds.map(id => squadMap.get(id) || 'Unknown').join('; ');
    };

    // Helper to get program names
    const getProgramNames = (user: ClerkAdminUser): string => {
      if (!user.programs || user.programs.length === 0) return '';
      return user.programs.map(p => p.programName).join('; ');
    };

    // Helper to escape CSV values
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // CSV headers
    const headers = ['Name', 'Email', 'Role', 'Squad', 'Programs', 'Joined'];

    // CSV rows
    const rows = selectedUsers.map(user => [
      escapeCSV(user.name || 'Unnamed'),
      escapeCSV(user.email || ''),
      escapeCSV(formatOrgRoleName(user.orgRoleForOrg || user.orgRole || 'member')),
      escapeCSV(getSquadNames(user)),
      escapeCSV(getProgramNames(user)),
      new Date(user.createdAt).toLocaleDateString(),
    ]);

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `${(headerTitle || 'clients').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [filteredUsers, selectedUserIds, headerTitle, displaySquads]);

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-6 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded mb-1" />
            <div className="h-4 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-10 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
            <div className="h-10 w-10 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg" />
          </div>
        </div>
        {/* Search skeleton */}
        <div className="h-10 w-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl mb-6" />
        {/* User rows skeleton - fewer rows, contained within view */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
              <div className="w-10 h-10 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-3 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
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
            className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white"
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
      {/* Demo Mode Banner */}
      {showDemoData && (
        <div className="mb-4 px-4 py-3 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-3">
          <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-albert">
              Demo Mode Active
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-albert">
              Showing sample client data for demonstration purposes
            </p>
          </div>
        </div>
      )}
      
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {/* Header with search and actions */}
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">{headerTitle}</h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mt-1">
                {filteredUsers.length} of {displayUsers.length} {headerTitle.toLowerCase()}{displayUsers.length !== 1 ? '' : ''}
                {searchQuery && ' matching search'}
              </p>
            </div>
            
            <div className="flex flex-row flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-none">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-4 py-1.5 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border border-transparent focus:border-[#e1ddd8] dark:focus:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9ca3af] focus:outline-none font-albert"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#7d8190]"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Refresh Icon + Export + Add Button row */}
              <div className="flex items-center gap-2">
                {/* Refresh Icon */}
                <button
                  onClick={fetchUsers}
                  className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                {/* Export CSV Button */}
                {isCoachContext && (
                  <button
                    onClick={handleExportCSV}
                    disabled={selectedUserIds.size === 0}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white rounded-lg font-albert font-medium text-[15px] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={selectedUserIds.size === 0 ? 'Select users to export' : 'Export selected users to CSV'}
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                )}

                {/* Add Clients Button */}
                {showInviteButton && (
                  <button
                    onClick={() => {
                      if (isDemoMode) {
                        openSignupModal();
                        return;
                      }
                      setShowInviteDialog(true);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white rounded-lg font-albert font-medium text-[15px] transition-colors duration-200"
                    title="Add New Clients"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add New Clients</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedUserIds.size > 0 && isOrgScopedApi && !readOnly && (
          <div className="px-6 py-3 bg-brand-accent/10 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 flex items-center gap-4 flex-wrap">
            <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">
              {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
            </span>
            
            {/* Message Selected Button */}
            <button
              onClick={() => {
                if (isDemoMode) {
                  openSignupModal();
                  return;
                }
                const recipients: DMRecipient[] = displayUsers
                  .filter(u => selectedUserIds.has(u.id))
                  .map(u => ({
                    userId: u.id,
                    name: u.name,
                    email: u.email,
                    avatarUrl: u.imageUrl,
                  }));
                setDmRecipients(recipients);
                setShowDmModal(true);
              }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 font-albert"
            >
              <Send className="w-4 h-4" />
              Message ({selectedUserIds.size})
            </button>
            
            <div className="flex items-center gap-2">
              <span className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">Add to Squad:</span>
              <Select
                value=""
                onValueChange={(squadId) => {
                  if (isDemoMode) {
                    openSignupModal();
                    return;
                  }
                  handleBulkAddToSquad(squadId);
                }}
                disabled={bulkUpdating}
              >
                <SelectTrigger className={`w-[150px] font-albert text-sm h-8 ${bulkUpdating ? 'opacity-50' : ''}`}>
                  <SelectValue placeholder="Select squad" />
                </SelectTrigger>
                <SelectContent>
                  {displaySquads.map((squad) => (
                    <SelectItem key={squad.id} value={squad.id} className="font-albert">
                      {squad.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export CSV button */}
            <button
              onClick={handleExportCSV}
              className="ml-auto inline-flex items-center gap-1.5 font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
              title="Export selected users to CSV"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>

            <button
              onClick={() => setSelectedUserIds(new Set())}
              className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
            >
              Clear selection
            </button>
            
            {bulkUpdating && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                <span className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">Updating...</span>
              </div>
            )}
          </div>
        )}

        {/* Users table */}
        <div
          ref={tableContainerRef}
          onWheel={handleTableWheel}
          className="overflow-x-auto"
        >
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
                {showColumn('role') && showOrgRole && <TableHead className="font-albert">Role</TableHead>}
                {showColumn('tier') && <TableHead className="font-albert">Tier</TableHead>}
                {showColumn('squad') && <TableHead className="font-albert">Squad</TableHead>}
                {showColumn('coach') && <TableHead className="font-albert">Coach</TableHead>}
                {showColumn('coaching') && <TableHead className="font-albert">Coaching</TableHead>}
                {showColumn('programs') && <TableHead className="font-albert">Programs</TableHead>}
                {showColumn('invitedBy') && <TableHead className="font-albert whitespace-nowrap">Invited By</TableHead>}
                {showColumn('invitedAt') && <TableHead className="font-albert">Invited At</TableHead>}
                {showColumn('created') && <TableHead className="font-albert">Joined</TableHead>}
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
                // Allow deletion if:
                // 1. Platform admin can delete (via canDeleteUser)
                // 2. In coach context: super_coach can delete members/coaches (but not other super_coach)
                const canDeleteThisUser = canDeleteUser(currentUserRole, userRole) ||
                  (isCoachContext && isSuperCoach(effectiveOrgRole) && userOrgRole !== 'super_coach');
                const isUpdatingTier = updatingTierUserId === user.id;
                const isUpdatingOrgRole = updatingOrgRoleUserId === user.id;
                // Super admin can modify any org role; super_coach can modify coach/member (but not super_coach)
                // Use effectiveOrgRole which includes detection from API response for org:admin users
                const canModifyOrgRole = isSuperAdmin(currentUserRole) || (isSuperCoach(effectiveOrgRole) && userOrgRole !== 'super_coach');

                return (
                  <TableRow 
                    key={user.id}
                    className={`${onSelectUser ? 'cursor-pointer' : ''} ${selectedUserIds.has(user.id) ? 'bg-brand-accent/5 dark:bg-brand-accent/5' : ''} hover:bg-[#faf8f6] dark:hover:bg-[#11141b]`}
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
                            unoptimized
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-accent to-[#8c6245] flex items-center justify-center text-white font-bold">
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
                            <SelectTrigger className={`w-auto font-albert border-none bg-transparent shadow-none h-auto p-0 gap-1 ${isUpdatingOrgRole ? 'opacity-50' : ''}`}>
                              <SelectValue>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getOrgRoleBadgeColor(userOrgRole)}`}>
                                  {formatOrgRoleName(userOrgRole)}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {/* Super admins can assign all org roles including super_coach */}
                              {(isSuperAdmin(currentUserRole) ? getAssignableOrgRolesForAdmin() : getAssignableOrgRoles()).map((orgRole) => (
                                <SelectItem key={orgRole} value={orgRole} className="font-albert">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getOrgRoleBadgeColor(orgRole)}`}>
                                    {formatOrgRoleName(orgRole)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium font-albert ${getOrgRoleBadgeColor(userOrgRole)}`}>
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
                          squads={displaySquads}
                          onAddSquad={(squadId) => handleAddToSquad(user.id, squadId)}
                          onRemoveSquad={(squadId) => handleRemoveFromSquad(user.id, squadId)}
                          disabled={updatingSquadUserId === user.id || showDemoData}
                          readOnly={!isOrgScopedApi || readOnly || showDemoData}
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
                    
                    {/* Programs - Shows enrolled programs with (1:1)/(Group) prefix in dropdown */}
                    {showColumn('programs') && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ProgramManagerPopover
                          programs={user.programs || []}
                          userId={user.id}
                          availablePrograms={
                            isOrgScopedApi && !showDemoData
                              ? availablePrograms.filter(p =>
                                  !(user.programs || []).some(up => up.programId === p.id)
                                )
                              : []
                          }
                          cohortsByProgram={cohortsByProgram}
                          onAddToProgram={async (programId, cohortId) => {
                            await handleAddToProgram(user.id, user.name, programId, cohortId);
                          }}
                          onLoadCohorts={loadCohortsForProgram}
                          disabled={showDemoData}
                          readOnly={!isOrgScopedApi || showDemoData}
                          isEnrolling={enrollingUserId === user.id}
                        />
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
                        <div className="flex items-center justify-end gap-1">
                          {/* Message Icon Button - only in coach context */}
                          {isCoachContext && !showDemoData && (
                            <button
                              onClick={() => {
                                setDmRecipients([{
                                  userId: user.id,
                                  name: user.name,
                                  email: user.email,
                                  avatarUrl: user.imageUrl,
                                }]);
                                setShowDmModal(true);
                              }}
                              className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                              title={`Message ${user.name}`}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
                          {/* Delete Icon Button - always visible, grayed out when no permission */}
                          <button
                            onClick={() => canDeleteThisUser && setUserToDelete(user)}
                            disabled={deleteLoading || !canDeleteThisUser}
                            className={`h-8 w-8 p-0 inline-flex items-center justify-center rounded-lg transition-colors ${
                              canDeleteThisUser
                                ? 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            } disabled:opacity-50`}
                            title={
                              canDeleteThisUser
                                ? (isCoachContext ? `Remove ${user.name} from organization` : `Delete ${user.name}`)
                                : 'You cannot remove this user'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-accent/10 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-brand-accent"
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

      {/* Delete/Remove confirmation dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">
              {isCoachContext ? 'Remove from Organization' : 'Delete User'}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              {isCoachContext ? (
                <>
                  Are you sure you want to remove <strong>{userToDelete?.name || userToDelete?.email}</strong> from your organization?
                  They will lose access to all squads and programs in this organization.
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong>{userToDelete?.name || userToDelete?.email}</strong>?
                  This action cannot be undone.
                </>
              )}
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
              {deleteLoading ? (isCoachContext ? 'Removing...' : 'Deleting...') : (isCoachContext ? 'Remove' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subdomain prompt dialog for coach role assignment */}
      <AlertDialog open={!!subdomainPrompt} onOpenChange={(open: boolean) => {
        if (!open) {
          setSubdomainPrompt(null);
          setCoachTier('starter');
          setManualBilling(true);
          setManualExpiresAt('');
        }
      }}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Assign Coach Role</AlertDialogTitle>
            <AlertDialogDescription className="font-albert" asChild>
              <div>
                <p className="mb-4">
                  Choose a subdomain and plan tier for <strong>{subdomainPrompt?.userName}</strong>&apos;s organization.
                </p>
                
                <div className="space-y-4">
                  {/* Subdomain */}
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
                        className="flex-1 h-10 px-3 py-2 rounded-lg border border-[#e1ddd8] dark:border-[#313746] bg-white dark:bg-[#1e222a] text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/20 focus:border-brand-accent font-albert disabled:opacity-50"
                        disabled={subdomainLoading}
                      />
                      <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert whitespace-nowrap">
                        .coachful.co
                      </span>
                    </div>
                    {subdomainError && (
                      <p className="text-sm text-red-600 dark:text-red-400 font-albert">{subdomainError}</p>
                    )}
                    <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                      3-30 characters. Letters, numbers, and hyphens only.
                    </p>
                  </div>
                  
                  {/* Plan Tier Selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Plan Tier
                    </label>
                    <Select
                      value={coachTier}
                      onValueChange={(value: string) => setCoachTier(value as CoachTier)}
                      disabled={subdomainLoading}
                    >
                      <SelectTrigger className="w-full font-albert">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter" className="font-albert">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            Starter ($49/mo) - 15 clients, 2 programs
                          </span>
                        </SelectItem>
                        <SelectItem value="pro" className="font-albert">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Pro ($129/mo) - 150 clients, custom domain
                          </span>
                        </SelectItem>
                        <SelectItem value="scale" className="font-albert">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            Scale ($299/mo) - 500 clients, team features
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Manual Billing Toggle */}
                  <div className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]">
                    <BrandedCheckbox
                      checked={manualBilling}
                      onChange={(checked) => setManualBilling(checked)}
                      disabled={subdomainLoading}
                    />
                    <div>
                      <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Manual billing (no Stripe payment required)
                      </label>
                      <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                        Grant plan access without going through payment flow
                      </p>
                    </div>
                  </div>
                  
                  {/* Expiration Date (only if manual billing) */}
                  {manualBilling && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Expiration Date (optional)
                      </label>
                      <input
                        type="date"
                        value={manualExpiresAt}
                        onChange={(e) => setManualExpiresAt(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-[#e1ddd8] dark:border-[#313746] bg-white dark:bg-[#1e222a] text-sm text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/20 focus:border-brand-accent font-albert disabled:opacity-50"
                        disabled={subdomainLoading}
                      />
                      <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                        Leave empty for unlimited access. Subscription will expire at end of this date.
                      </p>
                    </div>
                  )}
                  
                  {subdomain && !subdomainError && (
                    <div className="p-3 bg-brand-accent/10 rounded-lg">
                      <p className="text-sm font-medium text-brand-accent font-albert">
                        Preview:
                      </p>
                      <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-mono">
                        https://{subdomain.toLowerCase()}.coachful.co
                      </p>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                        {coachTier.charAt(0).toUpperCase() + coachTier.slice(1)} tier
                        {manualBilling ? ' (manual billing)' : ''}
                        {manualExpiresAt ? ` until ${new Date(manualExpiresAt).toLocaleDateString()}` : ''}
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
              className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
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
      
      {/* Send DM Modal */}
      {showDmModal && dmRecipients.length > 0 && (
        <SendDMModal
          recipients={dmRecipients}
          onClose={() => {
            setShowDmModal(false);
            setDmRecipients([]);
          }}
          onSuccess={(count) => {
            console.log(`Successfully sent ${count} messages`);
          }}
        />
      )}

      {/* Complimentary Access Confirmation */}
      <ComplimentaryAccessConfirmation
        isOpen={showPaidConfirmation}
        onClose={() => {
          setShowPaidConfirmation(false);
          setPendingEnrollment(null);
        }}
        onConfirm={handleConfirmPaidEnrollment}
        program={pendingEnrollment ? availablePrograms.find(p => p.id === pendingEnrollment.programId) || null : null}
        clientName={pendingEnrollment?.userName}
        isLoading={enrollingUserId !== null}
      />
    </>
  );
}
