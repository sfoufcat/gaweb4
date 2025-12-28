'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Pencil, Camera, X, ChevronDown } from 'lucide-react';
import type { Squad, UserAlignment, UserAlignmentSummary } from '@/types';
import { AlignmentGauge } from '@/components/alignment';
import { SquadStreakSheet } from './SquadStreakSheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * SquadHeader Component
 * 
 * Shows squad avatar, name, subtitle (Premium Squad or Squad), 
 * message icon, and squad streak gauge (reusing the AlignmentGauge component).
 * 
 * The gauge shows the squad streak (number of consecutive days
 * where >=50% of members were fully aligned).
 * Uses the SAME AlignmentGauge component as the personal alignment on Home page.
 * Arc is always full (100%) since streak is a count, not a percentage.
 * 
 * Features:
 * - Optional squad switcher dropdown (for users with multiple standalone squads)
 * - Edit button only visible to coaches (isCoach prop)
 */

interface SquadHeaderProps {
  squad: Squad;
  onSquadUpdated?: () => void;
  /** Only show edit button when user is the coach */
  isCoach?: boolean;
  /** For squad switcher - list of standalone squads user belongs to */
  standaloneSquads?: Squad[];
  /** For squad switcher - currently active squad ID */
  activeSquadId?: string;
  /** For squad switcher - callback when user switches squad */
  onSquadSwitch?: (squadId: string) => void;
  /** For squad switcher - member counts by squad ID */
  memberCountsBySquad?: Record<string, number>;
}

export function SquadHeader({ 
  squad, 
  onSquadUpdated,
  isCoach = false,
  standaloneSquads,
  activeSquadId,
  onSquadSwitch,
  memberCountsBySquad,
}: SquadHeaderProps) {
  const router = useRouter();
  const [showSquadSheet, setShowSquadSheet] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSquadSwitcher, setShowSquadSwitcher] = useState(false);
  const [editName, setEditName] = useState(squad.name);
  const [editAvatarUrl, setEditAvatarUrl] = useState(squad.avatarUrl || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  
  // Check if we should show the squad switcher
  const hasMultipleSquads = standaloneSquads && standaloneSquads.length > 1;
  
  // Close switcher when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setShowSquadSwitcher(false);
      }
    }
    
    if (showSquadSwitcher) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSquadSwitcher]);
  
  // Handle squad switch
  const handleSquadSwitch = (squadId: string) => {
    if (onSquadSwitch) {
      onSquadSwitch(squadId);
    }
    setShowSquadSwitcher(false);
  };

  const handleOpenEditModal = () => {
    setEditName(squad.name);
    setEditAvatarUrl(squad.avatarUrl || '');
    setAvatarPreview(null);
    setShowEditModal(true);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/squad/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const data = await response.json();
      setEditAvatarUrl(data.avatarUrl);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      alert(err instanceof Error ? err.message : 'Failed to upload image. Please try again.');
      setAvatarPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);

      const response = await fetch('/api/squad/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          squadId: squad.id,
          name: editName.trim(),
          avatarUrl: editAvatarUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update squad');
      }

      setShowEditModal(false);
      
      // Refresh the page to show updated data
      if (onSquadUpdated) {
        onSquadUpdated();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('Error updating squad:', err);
      alert(err instanceof Error ? err.message : 'Failed to update squad');
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatarUrl = avatarPreview || editAvatarUrl;
  
  // Check if stats are still loading (null = loading)
  const isStatsLoading = squad.avgAlignment === null || squad.avgAlignment === undefined;
  
  // Use real computed values from squad (defaults to 0 if not available)
  const squadStreak = squad.streak ?? 0;
  const avgAlignment = squad.avgAlignment ?? 0;

  // Create mock alignment and summary objects for the AlignmentGauge component
  // The gauge arc shows the squad's average alignment (0-100)
  // The center number shows the squad streak
  const mockAlignment = useMemo<UserAlignment>(() => ({
    id: 'squad-mock',
    userId: squad.id,
    organizationId: squad.organizationId || '',
    date: new Date().toISOString().split('T')[0],
    didMorningCheckin: avgAlignment >= 25,
    didSetTasks: avgAlignment >= 50,
    didInteractWithSquad: avgAlignment >= 75,
    hasActiveGoal: avgAlignment === 100,
    alignmentScore: avgAlignment, // Use actual squad avg alignment for arc
    fullyAligned: avgAlignment === 100,
    streakOnThisDay: squadStreak,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [squad.id, squad.organizationId, squadStreak, avgAlignment]);

  const mockSummary = useMemo<UserAlignmentSummary>(() => ({
    id: `${squad.organizationId || ''}_${squad.id}`,
    userId: squad.id,
    organizationId: squad.organizationId || '',
    currentStreak: squadStreak,
    lastAlignedDate: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString(),
  }), [squad.id, squad.organizationId, squadStreak]);

  const handleMessageClick = () => {
    if (squad.chatChannelId) {
      router.push(`/chat?channel=${squad.chatChannelId}`);
    }
  };

  return (
    <div className="flex items-center justify-between w-full">
      {/* Left: Squad Avatar + Name */}
      <div className="flex items-center gap-3">
        {/* Squad Avatar */}
        <div className="w-[62px] h-[62px] rounded-full overflow-hidden bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] flex items-center justify-center shadow-sm">
          {squad.avatarUrl ? (
            <Image src={squad.avatarUrl} alt={squad.name} width={62} height={62} className="w-full h-full object-cover" />
          ) : (
            <span className="font-albert font-bold text-xl text-[#4A5D54]">
              {squad.name[0]}
            </span>
          )}
        </div>

        {/* Name + Subtitle + Edit Button + Squad Switcher */}
        <div className="relative" ref={switcherRef}>
          <div className="flex items-center gap-1.5">
            {hasMultipleSquads ? (
              // Clickable name with dropdown for multiple squads
              <button
                onClick={() => setShowSquadSwitcher(!showSquadSwitcher)}
                className="flex items-center gap-1 group"
              >
                <h1 className="font-albert text-[24px] font-medium text-text-primary leading-[1.3] tracking-[-1.5px]">
                  {squad.name}
                </h1>
                <ChevronDown 
                  className={`w-5 h-5 text-text-secondary dark:text-[#7d8190] transition-transform ${
                    showSquadSwitcher ? 'rotate-180' : ''
                  }`} 
                />
              </button>
            ) : (
              // Static name for single squad
              <h1 className="font-albert text-[24px] font-medium text-text-primary leading-[1.3] tracking-[-1.5px]">
                {squad.name}
              </h1>
            )}
            {/* Edit Button - only visible to coaches */}
            {isCoach && (
              <button
                onClick={handleOpenEditModal}
                className="p-1 rounded-full hover:bg-[#f3f1ef] transition-colors text-text-secondary/60 hover:text-text-primary"
                aria-label="Edit squad"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
          {squad.hasCoach ? (
            <p className="font-sans text-[12px] font-semibold leading-[1.2]">
              <span className="bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                Coached squad
              </span>
            </p>
          ) : squad.visibility === 'private' ? (
            <p className="font-sans text-[12px] text-text-secondary leading-[1.2]">
              🔒 Private squad
            </p>
          ) : (
            <p className="font-sans text-[12px] text-text-secondary leading-[1.2]">
              🌍 Public squad
            </p>
          )}
          
          {/* Squad Switcher Dropdown */}
          {showSquadSwitcher && hasMultipleSquads && standaloneSquads && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#171b22] rounded-xl shadow-lg border border-[#e1ddd8] dark:border-[#262b35] z-50 overflow-hidden">
              <div className="p-2">
                <p className="px-3 py-2 text-xs font-medium text-text-secondary dark:text-[#7d8190] uppercase tracking-wide">
                  Switch squad
                </p>
                {standaloneSquads.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSquadSwitch(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      s.id === activeSquadId
                        ? 'bg-[#f3f1ef] dark:bg-[#262b35]'
                        : 'hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                    }`}
                  >
                    {/* Squad Avatar */}
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f3f1ef] dark:bg-[#11141b] flex-shrink-0">
                      {s.avatarUrl ? (
                        <Image
                          src={s.avatarUrl}
                          alt={s.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C]">
                          <span className="font-albert font-semibold text-sm text-[#4A5D54]">
                            {s.name[0]}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-albert font-semibold text-[15px] text-text-primary dark:text-[#f5f5f8] truncate">
                        {s.name}
                      </p>
                      <p className="text-xs text-text-secondary dark:text-[#7d8190]">
                        {memberCountsBySquad?.[s.id] || 0} members
                        {s.hasCoach && ' • Coached'}
                      </p>
                    </div>
                    
                    {/* Active indicator */}
                    {s.id === activeSquadId && (
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Message Icon + Squad Streak Gauge */}
      <div className="flex items-center gap-3">
        {/* Message Icon - sized to match AlignmentGauge (62x62) */}
        {squad.chatChannelId && (
          <button
            onClick={handleMessageClick}
            className="w-[62px] h-[62px] rounded-full bg-[#f3f1ef] dark:bg-[#1e222a] flex items-center justify-center hover:bg-[#e9e5e0] dark:hover:bg-[#262b35] transition-colors"
            aria-label="Open squad chat"
          >
            <svg
              className="w-7 h-7 text-text-primary dark:text-[#f5f5f8]"
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

        {/* Squad Streak Gauge - Reusing AlignmentGauge component */}
        <AlignmentGauge
          alignment={mockAlignment}
          summary={mockSummary}
          size="sm"
          isLoading={isStatsLoading}
          onPress={() => setShowSquadSheet(true)}
        />
      </div>

      {/* Squad Streak Explanation Sheet */}
      <SquadStreakSheet
        isOpen={showSquadSheet}
        onClose={() => setShowSquadSheet(false)}
      />

      {/* Edit Squad Modal */}
      <AlertDialog open={showEditModal} onOpenChange={setShowEditModal}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center justify-between">
              <AlertDialogTitle className="font-albert text-[20px] tracking-[-0.5px]">
                Edit squad
              </AlertDialogTitle>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-full hover:bg-[#f3f1ef] transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
          </AlertDialogHeader>

          <div className="space-y-5 py-2">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] flex items-center justify-center cursor-pointer group"
              >
                {displayAvatarUrl ? (
                  <Image src={displayAvatarUrl} alt="Squad avatar" width={96} height={96} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-albert font-bold text-3xl text-[#4A5D54]">
                    {editName[0] || 'S'}
                  </span>
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
              <p className="text-[12px] text-text-secondary mt-2 font-albert">
                Click to change photo
              </p>
            </div>

            {/* Squad Name */}
            <div>
              <label className="block font-albert font-medium text-[14px] text-text-primary mb-2">
                Squad name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter squad name"
                maxLength={50}
                className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-[12px] font-albert text-[16px] text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30 focus:border-[#a07855] dark:border-[#b8896a] transition-all"
              />
            </div>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel 
              disabled={isSaving}
              className="font-albert rounded-full border-[#e1ddd8]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveChanges}
              disabled={isSaving || !editName.trim() || isUploading}
              className="font-albert rounded-full bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

