'use client';

import { useEffect, useState, useMemo } from 'react';
import type { UserRole, UserTier, CoachingStatus } from '@/types';
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
} from '@/lib/admin-utils-shared';
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

interface ClerkAdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  role: UserRole;
  tier: UserTier;
  // Coaching is separate from membership tier
  coachingStatus?: CoachingStatus;
  coaching?: boolean; // Legacy flag
  // Referral tracking
  invitedBy?: string | null;
  invitedByName?: string | null;
  inviteCode?: string | null;
  invitedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminUsersTabProps {
  currentUserRole: UserRole;
}

export function AdminUsersTab({ currentUserRole }: AdminUsersTabProps) {
  const [users, setUsers] = useState<ClerkAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<ClerkAdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingTierUserId, setUpdatingTierUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
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
  }, []);

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
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert">Loading users...</p>
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
            className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white"
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
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Users</h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mt-1">
                {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
                {searchQuery && ' matching search'}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190]"
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
              
              <Button 
                onClick={fetchUsers}
                variant="outline"
                className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Users table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-albert">Avatar</TableHead>
                <TableHead className="font-albert">Name</TableHead>
                <TableHead className="font-albert">Email</TableHead>
                <TableHead className="font-albert">Role</TableHead>
                <TableHead className="font-albert">Tier</TableHead>
                <TableHead className="font-albert">Coaching</TableHead>
                <TableHead className="font-albert">Invited By</TableHead>
                <TableHead className="font-albert">Invited At</TableHead>
                <TableHead className="font-albert">Created</TableHead>
                <TableHead className="font-albert text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const userRole = user.role || 'user';
                const userTier = user.tier || 'free';
                const canModifyThisUser = canModifyUserRole(currentUserRole, userRole, userRole);
                const canDeleteThisUser = canDeleteUser(currentUserRole, userRole);
                const isUpdatingTier = updatingTierUserId === user.id;

                return (
                  <TableRow key={user.id}>
                    {/* Avatar */}
                    <TableCell>
                      {user.imageUrl ? (
                        <img
                          src={user.imageUrl}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a07855] to-[#8c6245] flex items-center justify-center text-white font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </TableCell>
                    
                    {/* Name */}
                    <TableCell className="font-albert font-medium">
                      {user.name || 'Unnamed User'}
                    </TableCell>
                    
                    {/* Email */}
                    <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                      {user.email}
                    </TableCell>
                    
                    {/* Role */}
                    <TableCell>
                      {canModifyThisUser ? (
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
                    
                    {/* Tier - No longer includes "coaching" (coaching is separate) */}
                    <TableCell>
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
                    </TableCell>
                    
                    {/* Coaching Status - Separate from tier */}
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
                    
                    {/* Invited By */}
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
                    
                    {/* Invited At */}
                    <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                      {user.invitedAt ? (
                        new Date(user.invitedAt).toLocaleDateString()
                      ) : (
                        <span className="text-[#8c8c8c] dark:text-[#7d8190]">-</span>
                      )}
                    </TableCell>
                    
                    {/* Created Date */}
                    <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    
                    {/* Actions */}
                    <TableCell className="text-right">
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
                    className="w-8 h-8 text-[#a07855]"
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
                  No users match "{searchQuery}"
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
    </>
  );
}
