'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import type { UserRole, UserTier, Squad } from '@/types';
import {
  formatRoleName,
  getRoleBadgeColor,
  formatTierName,
  getTierBadgeColor,
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
import { Button } from '@/components/ui/button';

interface UserWithoutSquad {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  role: UserRole;
  tier: UserTier;
  createdAt: string;
}

type SortField = 'name' | 'role' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface AdminUsersWithoutSquadTabProps {
  currentUserRole: UserRole;
}

export function AdminUsersWithoutSquadTab({ currentUserRole: _currentUserRole }: AdminUsersWithoutSquadTabProps) {
  const [users, setUsers] = useState<UserWithoutSquad[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters and sorting
  const [tierFilter, setTierFilter] = useState<UserTier | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Assignment state
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch users without squad and squads in parallel
      const [usersResponse, squadsResponse] = await Promise.all([
        fetch(`/api/admin/users/without-squad?tier=${tierFilter}`),
        fetch('/api/admin/squads'),
      ]);

      if (!usersResponse.ok) {
        throw new Error('Failed to fetch users');
      }
      if (!squadsResponse.ok) {
        throw new Error('Failed to fetch squads');
      }

      const usersData = await usersResponse.json();
      const squadsData = await squadsResponse.json();

      setUsers(usersData.users || []);
      setSquads(squadsData.squads || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [tierFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sort and filter users
  const sortedAndFilteredUsers = useMemo(() => {
    let filtered = users;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'role':
          comparison = a.role.localeCompare(b.role);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [users, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleAssignToSquad = async (userId: string, squadId: string) => {
    try {
      setAssigningUserId(userId);

      const response = await fetch(`/api/admin/squads/${squadId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roleInSquad: 'member' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign user to squad');
      }

      // Remove user from the list immediately
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error('Error assigning user to squad:', err);
      alert(err instanceof Error ? err.message : 'Failed to assign user to squad');
    } finally {
      setAssigningUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading users without squad...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center text-red-600">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button
            onClick={fetchData}
            className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
      {/* Header with filters */}
      <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Users Without Squad
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
              {sortedAndFilteredUsers.length} user{sortedAndFilteredUsers.length !== 1 ? 's' : ''} without a squad
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
                className="w-64 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert text-sm"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]"
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
            </div>

            {/* Tier Filter - No longer includes "coaching" (coaching is separate) */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Tier:</span>
              <Select
                value={tierFilter}
                onValueChange={(value) => setTierFilter(value as UserTier | 'all')}
              >
                <SelectTrigger className="w-[130px] font-albert">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-albert">All</SelectItem>
                  <SelectItem value="free" className="font-albert">Free</SelectItem>
                  <SelectItem value="standard" className="font-albert">Standard</SelectItem>
                  <SelectItem value="premium" className="font-albert">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Refresh Button */}
            <Button
              onClick={fetchData}
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
              <TableHead
                className="font-albert cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-white/5 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  <span className="text-xs opacity-50">{getSortIcon('name')}</span>
                </div>
              </TableHead>
              <TableHead className="font-albert">Email</TableHead>
              <TableHead
                className="font-albert cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-white/5 transition-colors"
                onClick={() => handleSort('role')}
              >
                <div className="flex items-center gap-1">
                  Role
                  <span className="text-xs opacity-50">{getSortIcon('role')}</span>
                </div>
              </TableHead>
              <TableHead className="font-albert">Tier</TableHead>
              <TableHead
                className="font-albert cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-white/5 transition-colors"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-1">
                  Created
                  <span className="text-xs opacity-50">{getSortIcon('createdAt')}</span>
                </div>
              </TableHead>
              <TableHead className="font-albert">Assign to Squad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredUsers.map((user) => {
              const isAssigning = assigningUserId === user.id;

              return (
                <TableRow key={user.id}>
                  {/* Avatar */}
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
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-accent to-[#8c6245] flex items-center justify-center text-white font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </TableCell>

                  {/* Name */}
                  <TableCell className="font-albert font-medium">
                    {user.name || 'Unnamed User'}
                  </TableCell>

                  {/* Email */}
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {user.email}
                  </TableCell>

                  {/* Role */}
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${getRoleBadgeColor(user.role)}`}
                    >
                      {formatRoleName(user.role)}
                    </span>
                  </TableCell>

                  {/* Tier */}
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${getTierBadgeColor(user.tier)}`}
                    >
                      {formatTierName(user.tier)}
                    </span>
                  </TableCell>

                  {/* Created Date */}
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>

                  {/* Assign to Squad */}
                  <TableCell>
                    <Select
                      disabled={isAssigning}
                      onValueChange={(squadId) => handleAssignToSquad(user.id, squadId)}
                    >
                      <SelectTrigger className="w-[200px] font-albert">
                        <SelectValue placeholder={isAssigning ? 'Assigning...' : 'Select squad...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {squads.length === 0 ? (
                          <SelectItem value="no-squads" disabled className="font-albert">
                            No squads available
                          </SelectItem>
                        ) : (
                          squads.map((squad) => (
                            <SelectItem key={squad.id} value={squad.id} className="font-albert">
                              <div className="flex items-center gap-2">
                                {squad.avatarUrl ? (
                                  <Image
                                    src={squad.avatarUrl}
                                    alt={squad.name}
                                    width={20}
                                    height={20}
                                    className="w-5 h-5 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-[#a07855] flex items-center justify-center text-white text-xs font-bold">
                                    {squad.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span>{squad.name}</span>
                                {squad.isPremium && (
                                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                    Premium
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {sortedAndFilteredUsers.length === 0 && (
        <div className="p-12 text-center">
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-lg mb-2">
            {searchQuery || tierFilter !== 'all'
              ? 'No users match your filters'
              : 'All users are assigned to squads'}
          </p>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 font-albert text-sm">
            {searchQuery || tierFilter !== 'all'
              ? 'Try adjusting your search or tier filter'
              : 'Great job! Everyone has a squad.'}
          </p>
        </div>
      )}
    </div>
  );
}





