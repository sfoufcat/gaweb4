'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Squad, UserRole } from '@/types';

interface SquadWithDetails extends Squad {
  coachName?: string;
  coachImageUrl?: string;
  memberCount: number;
}
// canManageSquads import removed - using role directly
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { SquadFormDialog } from './SquadFormDialog';

interface AdminSquadsTabProps {
  currentUserRole: UserRole;
  /** Override API endpoint for multi-tenancy (e.g., '/api/coach/org-squads' for coaches) */
  apiEndpoint?: string;
  /** Optional callback when a squad is selected - makes rows clickable */
  onSelectSquad?: (squadId: string) => void;
  /** API endpoint for fetching coaches (default: /api/admin/coaches, use /api/coach/org-coaches for org context) */
  coachesApiEndpoint?: string;
}

export function AdminSquadsTab({ 
  currentUserRole: _currentUserRole, 
  apiEndpoint = '/api/admin/squads', 
  onSelectSquad,
  coachesApiEndpoint = '/api/admin/coaches',
}: AdminSquadsTabProps) {
  const [squads, setSquads] = useState<SquadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [squadToDelete, setSquadToDelete] = useState<SquadWithDetails | null>(null);
  const [squadToEdit, setSquadToEdit] = useState<SquadWithDetails | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchSquads = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch squads');
      }

      const data = await response.json();
      setSquads(data.squads || []);
    } catch (err) {
      console.error('Error fetching squads:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch squads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSquads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteSquad = async () => {
    if (!squadToDelete) return;

    try {
      setDeleteLoading(true);

      const response = await fetch(`${apiEndpoint}/${squadToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete squad');
      }

      // Refresh squads list
      await fetchSquads();
      setSquadToDelete(null);
    } catch (err) {
      console.error('Error deleting squad:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete squad');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSquadSaved = () => {
    setShowCreateDialog(false);
    setSquadToEdit(null);
    fetchSquads();
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          <div className="h-10 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
        </div>
        {/* Squad rows skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
              <div className="w-12 h-12 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-4 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
              <div className="h-6 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
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
            onClick={fetchSquads} 
            className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {/* Header with actions */}
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Squads</h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mt-1">
              {squads.length} total squad{squads.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={fetchSquads}
              variant="outline"
              className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
            >
              Refresh
            </Button>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-[#a07855] hover:bg-[#8c6245] text-white"
            >
              Create Squad
            </Button>
          </div>
        </div>

        {/* Squads table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-albert">Name</TableHead>
                <TableHead className="font-albert">Visibility</TableHead>
                <TableHead className="font-albert">Timezone</TableHead>
                <TableHead className="font-albert">Type</TableHead>
                <TableHead className="font-albert">Coach</TableHead>
                <TableHead className="font-albert">Members</TableHead>
                <TableHead className="font-albert">Created</TableHead>
                <TableHead className="font-albert text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {squads.map((squad) => (
                <TableRow 
                  key={squad.id}
                  className={onSelectSquad ? 'cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-[#11141b]' : ''}
                  onClick={() => onSelectSquad?.(squad.id)}
                >
                  <TableCell className="font-albert font-medium">
                    <div className="flex items-center gap-3">
                      {squad.avatarUrl ? (
                        <Image 
                          src={squad.avatarUrl} 
                          alt={squad.name}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#a07855] to-[#8c6245] flex items-center justify-center text-white text-sm font-bold">
                          {squad.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div>{squad.name}</div>
                        {squad.description && (
                          <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] truncate max-w-[200px]">
                            {squad.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {squad.visibility === 'private' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 font-albert">
                        Private
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 font-albert">
                        Public
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] text-xs">
                    {squad.timezone || 'UTC'}
                  </TableCell>
                  <TableCell>
                    {squad.isClosed ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600 font-albert dark:bg-gray-800 dark:text-gray-400">
                        Closed
                      </span>
                    ) : squad.programId ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 font-albert dark:bg-blue-900/30 dark:text-blue-300">
                        With Program
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 font-albert dark:bg-emerald-900/30 dark:text-emerald-300">
                        Standalone
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {squad.coachId ? (
                      <div className="flex items-center gap-2">
                        {squad.coachImageUrl ? (
                          <Image 
                            src={squad.coachImageUrl} 
                            alt={squad.coachName || 'Coach'}
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                            {squad.coachName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span>{squad.coachName || 'Unknown'}</span>
                      </div>
                    ) : (
                      <span className="text-[#5f5a55]/70 dark:text-[#7d8190]/70 italic">Peer group</span>
                    )}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {squad.memberCount > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#a07855]/10 text-[#a07855]">
                        {squad.memberCount} member{squad.memberCount !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2]/50 dark:text-[#7d8190]">No members</span>
                    )}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {new Date(squad.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSquadToEdit(squad);
                        }}
                        className="text-[#a07855] hover:text-[#8c6245] hover:bg-[#a07855]/10 font-albert"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSquadToDelete(squad);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 font-albert"
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {squads.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mb-4">No squads found</p>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-[#a07855] hover:bg-[#8c6245] text-white"
            >
              Create Your First Squad
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Squad Dialog */}
      {(showCreateDialog || squadToEdit) && (
        <SquadFormDialog
          squad={squadToEdit}
          open={showCreateDialog || !!squadToEdit}
          onClose={() => {
            setShowCreateDialog(false);
            setSquadToEdit(null);
          }}
          onSave={handleSquadSaved}
          apiBasePath={apiEndpoint}
          coachesApiEndpoint={coachesApiEndpoint}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!squadToDelete} onOpenChange={(open) => !open && setSquadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Delete Squad</AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              Are you sure you want to delete <strong>{squadToDelete?.name}</strong>? 
              This will remove all members from the squad. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} className="font-albert">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSquad}
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

