'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Filter, Plus, Key, Globe, Users, Clock, ChevronDown, Star, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SquadCard } from './SquadCard';
import { CreateSquadModal } from './CreateSquadModal';
import { JoinPrivateSquadModal } from './JoinPrivateSquadModal';
import type { Squad, UserTier, UserTrack } from '@/types';

/**
 * SquadDiscovery Component
 * 
 * Main discovery page for users without a squad.
 * Shows squads based on user subscription tier and track:
 * - Premium users: See premium squads, can only join private squads via invite code
 * - Standard users: See standard squads, can create and join squads
 * - Track filtering: Shows track-specific squads first, then general squads
 */

type SortOption = 'most_active' | 'most_members' | 'newest' | 'alphabetical';

// Track display labels for section headers
const TRACK_LABELS: Record<UserTrack, string> = {
  content_creator: 'Content Creator',
  saas: 'SaaS Founder',
  coach_consultant: 'Coach / Consultant',
  ecom: 'E-Commerce',
  agency: 'Agency Owner',
  community_builder: 'Community Builder',
  general: 'General Entrepreneur',
};

interface PublicSquad extends Squad {
  memberCount: number;
  memberAvatars: string[];
}

export function SquadDiscovery() {
  const { user } = useUser();
  const router = useRouter();
  
  // State - squads are pre-grouped by the server
  const [trackSquads, setTrackSquads] = useState<PublicSquad[]>([]);
  const [generalSquads, setGeneralSquads] = useState<PublicSquad[]>([]);
  const [otherTrackSquads, setOtherTrackSquads] = useState<PublicSquad[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('most_active');
  const [joiningSquadId, setJoiningSquadId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinPrivateModal, setShowJoinPrivateModal] = useState(false);
  const [userTier, setUserTier] = useState<UserTier>('standard');
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [userTrack, setUserTrack] = useState<UserTrack | null>(null);

  // Fetch squads (pre-grouped by server)
  const fetchSquads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      params.set('sort', sortBy);
      
      const response = await fetch(`/api/squad/discover?${params}`);
      if (!response.ok) throw new Error('Failed to fetch squads');
      
      const data = await response.json();
      // Server returns pre-grouped squads
      setTrackSquads(data.trackSquads || []);
      setGeneralSquads(data.generalSquads || []);
      setOtherTrackSquads(data.otherTrackSquads || []);
      // Store user tier and track info from API response
      if (data.userTier) setUserTier(data.userTier);
      if (typeof data.isPremiumUser === 'boolean') setIsPremiumUser(data.isPremiumUser);
      if (data.userTrack !== undefined) setUserTrack(data.userTrack);
    } catch (err) {
      console.error('Error fetching squads:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortBy]);

  useEffect(() => {
    const debounce = setTimeout(fetchSquads, 300);
    return () => clearTimeout(debounce);
  }, [fetchSquads]);

  // Join a public squad
  const handleJoinSquad = async (squadId: string) => {
    if (!user || joiningSquadId) return;
    
    try {
      setJoiningSquadId(squadId);
      
      const response = await fetch('/api/squad/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join squad');
      }

      // Refresh squad context and redirect
      router.refresh();
      window.location.href = '/squad';
    } catch (err) {
      console.error('Error joining squad:', err);
      alert(err instanceof Error ? err.message : 'Failed to join squad');
    } finally {
      setJoiningSquadId(null);
    }
  };

  // Handle squad creation success
  const handleSquadCreated = () => {
    setShowCreateModal(false);
    router.refresh();
    window.location.href = '/squad';
  };

  // Handle private squad join success
  const handlePrivateJoinSuccess = () => {
    setShowJoinPrivateModal(false);
    router.refresh();
    window.location.href = '/squad';
  };

  // Sort label mapping
  const sortLabels: Record<SortOption, string> = {
    most_active: 'Most Active',
    most_members: 'Most Members',
    newest: 'Newest',
    alphabetical: 'A–Z',
  };

  return (
    <div className="pt-6 pb-32">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-albert text-[36px] text-text-primary leading-[1.2] tracking-[-2px] mb-2">
          {isPremiumUser ? 'Find your premium squad' : 'Find your squad'}
        </h1>
        <p className="font-albert text-[16px] text-text-secondary leading-[1.4]">
          {isPremiumUser 
            ? 'Browse available premium squads or join a private squad using an invite code.'
            : 'Join a community of growth-minded people working toward their goals together.'
          }
        </p>
      </div>

      {/* Search & Filters Row */}
      <div className="flex gap-3 mb-6">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search squads..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-[#e1ddd8] rounded-[16px] font-albert text-[16px] text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 focus:border-[#a07855] transition-all"
          />
        </div>

        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="border-[#e1ddd8] hover:bg-[#faf8f6] rounded-[16px] px-4 gap-2 font-albert"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {(Object.keys(sortLabels) as SortOption[]).map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => setSortBy(option)}
                className={`font-albert cursor-pointer ${sortBy === option ? 'bg-[#a07855]/10 text-[#a07855]' : ''}`}
              >
                {sortLabels[option]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Premium Guided Squad Card - Only show for standard users */}
      {!isPremiumUser && (
        <Link
          href="/upgrade-premium"
          className="group block mb-4 bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#2a2420] dark:to-[#1f1c1a] border border-[#FFE4CC] dark:border-[#3d322a] rounded-[20px] p-5 hover:shadow-lg hover:border-[#FF8A65]/40 dark:hover:border-[#FF8A65]/30 transition-all duration-300"
        >
          <div className="flex items-start gap-4">
            {/* Premium Icon */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF8A65] to-[#FF6B6B] flex items-center justify-center flex-shrink-0 shadow-md">
              <Star className="w-7 h-7 text-white fill-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Premium Badge */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-albert text-[12px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                  Premium
                </span>
              </div>
              
              <h3 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] mb-1">
                Join a guided squad
              </h3>
              
              <p className="font-albert text-[14px] text-text-secondary leading-[1.4] mb-3">
                Get weekly coaching calls, personalized guidance, and achieve your goals 10x faster with expert support.
              </p>

              {/* CTA */}
              <div className="flex items-center gap-2 text-[#FF6B6B] font-albert font-semibold text-[14px] group-hover:gap-3 transition-all">
                <span>Learn more</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Premium User Info Card - Only show for premium users */}
      {isPremiumUser && (
        <div className="mb-4 bg-gradient-to-br from-[#FFF8F0] to-[#FFF3E8] dark:from-[#2a2420] dark:to-[#1f1c1a] border border-[#FFE4CC] dark:border-[#3d322a] rounded-[20px] p-5">
          <div className="flex items-start gap-4">
            {/* Premium Icon */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FF8A65] to-[#FF6B6B] flex items-center justify-center flex-shrink-0 shadow-md">
              <Star className="w-7 h-7 text-white fill-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Premium Badge */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-albert text-[12px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                  Premium Member
                </span>
              </div>
              
              <h3 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] mb-1">
                Your premium benefits
              </h3>
              
              <p className="font-albert text-[14px] text-text-secondary leading-[1.4]">
                As a premium member, you have access to exclusive premium squads with coaching support. Use an invite code to join a private premium squad, or browse available premium squads below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Squad Cards - Pre-grouped by Server */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div 
              key={i}
              className="bg-white/60 border border-[#e1ddd8]/50 rounded-[20px] p-5 h-[200px] animate-pulse"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-[#e1ddd8]/50" />
                <div className="flex-1">
                  <div className="h-5 bg-[#e1ddd8]/50 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-[#e1ddd8]/50 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (trackSquads.length > 0 || generalSquads.length > 0 || otherTrackSquads.length > 0) ? (
        <div className="space-y-8">
          {/* Track-specific squads section */}
          {trackSquads.length > 0 && userTrack && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px]">
                  {TRACK_LABELS[userTrack]} Squads
                </h2>
                <span className="px-2 py-0.5 bg-[#a07855]/10 text-[#a07855] rounded-full text-[12px] font-albert font-medium">
                  For you
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trackSquads.map((squad) => (
                  <SquadCard
                    key={squad.id}
                    squad={squad}
                    onJoin={() => handleJoinSquad(squad.id)}
                    isJoining={joiningSquadId === squad.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Divider - only show if both sections have content */}
          {trackSquads.length > 0 && (generalSquads.length > 0 || otherTrackSquads.length > 0) && (
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#e1ddd8]" />
              <span className="text-[12px] text-text-secondary font-albert">More squads</span>
              <div className="flex-1 h-px bg-[#e1ddd8]" />
            </div>
          )}

          {/* General squads section (trackless) */}
          {generalSquads.length > 0 && (
            <div>
              {(trackSquads.length > 0 || otherTrackSquads.length > 0) && (
                <h2 className="font-albert font-semibold text-[18px] text-text-primary tracking-[-0.5px] mb-4">
                  Open to All
                </h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generalSquads.map((squad) => (
                  <SquadCard
                    key={squad.id}
                    squad={squad}
                    onJoin={() => handleJoinSquad(squad.id)}
                    isJoining={joiningSquadId === squad.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other track squads (not user's track, but not general) */}
          {otherTrackSquads.length > 0 && (
            <div>
              {(trackSquads.length > 0 || generalSquads.length > 0) && (
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 h-px bg-[#e1ddd8]" />
                  <span className="text-[12px] text-text-secondary font-albert">Other communities</span>
                  <div className="flex-1 h-px bg-[#e1ddd8]" />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherTrackSquads.map((squad) => (
                  <SquadCard
                    key={squad.id}
                    squad={squad}
                    onJoin={() => handleJoinSquad(squad.id)}
                    isJoining={joiningSquadId === squad.id}
                    trackLabel={squad.trackId ? TRACK_LABELS[squad.trackId] : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 px-4">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#F5E6A8] via-[#EDD96C] to-[#E8C547] flex items-center justify-center">
            <Users className="w-10 h-10 text-[#4A5D54]" />
          </div>
          <h3 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-2">
            No {isPremiumUser ? 'premium ' : ''}squads found
          </h3>
          <p className="font-albert text-[16px] text-text-secondary mb-6 max-w-[320px] mx-auto">
            {searchQuery 
              ? `No ${isPremiumUser ? 'premium ' : ''}squads match "${searchQuery}". ${isPremiumUser ? 'Try a different search or use an invite code to join a private squad.' : 'Try a different search or create your own!'}`
              : isPremiumUser 
                ? 'No premium squads are currently available. Use an invite code to join a private premium squad.'
                : 'Be the first to create a squad and start building your community.'
            }
          </p>
        </div>
      )}

      {/* Secondary Actions */}
      <div className="mt-8 pt-8 border-t border-[#e1ddd8]/50">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          {/* Create Squad - Only for standard users */}
          {!isPremiumUser && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-3 px-6 py-4 bg-[#a07855] hover:bg-[#8c6245] text-white rounded-[20px] font-albert font-semibold text-[16px] transition-all hover:scale-[1.02] shadow-md w-full sm:w-auto justify-center"
            >
              <Plus className="w-5 h-5" />
              Create a squad
            </button>
          )}

          {/* Join Private Squad - Primary action for premium users, secondary for standard */}
          <button
            onClick={() => setShowJoinPrivateModal(true)}
            className={`flex items-center gap-3 px-6 py-4 rounded-[20px] font-albert font-semibold text-[16px] transition-all hover:scale-[1.02] w-full sm:w-auto justify-center ${
              isPremiumUser 
                ? 'bg-[#a07855] hover:bg-[#8c6245] text-white shadow-md' 
                : 'bg-white border border-[#e1ddd8] hover:bg-[#faf8f6] text-text-primary'
            }`}
          >
            <Key className="w-5 h-5" />
            Join private squad
          </button>
        </div>
      </div>

      {/* Create Squad Modal - Only for standard users */}
      {showCreateModal && !isPremiumUser && (
        <CreateSquadModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleSquadCreated}
        />
      )}

      {/* Join Private Squad Modal */}
      {showJoinPrivateModal && (
        <JoinPrivateSquadModal
          open={showJoinPrivateModal}
          onClose={() => setShowJoinPrivateModal(false)}
          onSuccess={handlePrivateJoinSuccess}
        />
      )}
    </div>
  );
}

