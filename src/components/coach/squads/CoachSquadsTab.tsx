'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import type { Squad, SquadMember, ProgramFeature, ProgramTestimonial, ProgramFAQ, ReferralConfig } from '@/types';
import { ProgramLandingPageEditor } from '../programs/ProgramLandingPageEditor';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Users, 
  ChevronRight, 
  UserMinus, 
  FileText, 
  Gift, 
  Globe, 
  Lock, 
  Edit2,
  Trash2,
  ExternalLink,
  Copy,
  X,
  Sparkles
} from 'lucide-react';
import { AIHelperModal } from '@/components/ai';
import type { LandingPageDraft, ProgramContentDraft, AIGenerationContext } from '@/lib/ai/types';
import { ReferralConfigForm } from '@/components/coach/referrals';
import { SquadFormDialog } from '@/components/admin/SquadFormDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Squad with computed stats and program info
interface SquadWithStats extends Squad {
  memberCount?: number;
  programName?: string;
  programType?: 'group' | 'individual';
}

// Squad filter types
type SquadFilterType = 'all' | 'standalone' | 'program-all' | 'program-group' | 'program-individual';

// Member with user info
interface MemberWithUser extends SquadMember {
  email?: string;
  name?: string;
}

interface CoachSquadsTabProps {
  apiBasePath?: string;
}

// Landing page form data type matching ProgramLandingPageEditor
interface LandingPageFormData {
  landingPageCoverImageUrl?: string;
  // Hero section
  heroHeadline?: string;
  heroSubheadline?: string;
  heroCtaText?: string;
  // Coach section
  coachBio: string;
  coachHeadline?: string;
  coachBullets: string[];
  // Other content
  keyOutcomes: string[];
  features: ProgramFeature[];
  testimonials: ProgramTestimonial[];
  faqs: ProgramFAQ[];
  showEnrollmentCount: boolean; // Used as showMemberCount for squads
  showCurriculum: boolean; // Hidden for squads
}

export function CoachSquadsTab({ apiBasePath = '/api/coach/org-squads' }: CoachSquadsTabProps) {
  const [squads, setSquads] = useState<SquadWithStats[]>([]);
  const [selectedSquad, setSelectedSquad] = useState<SquadWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Squad filter
  const [squadFilter, setSquadFilter] = useState<SquadFilterType>('all');
  
  // View mode: 'list' | 'members' | 'landing' | 'referrals'
  const [viewMode, setViewMode] = useState<'list' | 'members' | 'landing' | 'referrals'>('list');
  
  // Members state
  const [squadMembers, setSquadMembers] = useState<MemberWithUser[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [removeConfirmMember, setRemoveConfirmMember] = useState<MemberWithUser | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  
  // Coach assignment state
  const [coaches, setCoaches] = useState<{id: string; name: string; firstName: string; lastName: string; email: string; imageUrl: string}[]>([]);
  const [updatingCoach, setUpdatingCoach] = useState(false);
  
  // Modal states
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [editingSquad, setEditingSquad] = useState<Squad | null>(null);
  const [deleteConfirmSquad, setDeleteConfirmSquad] = useState<Squad | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // AI Helper modal
  const [isAILandingPageModalOpen, setIsAILandingPageModalOpen] = useState(false);
  
  // Landing page form
  const [landingPageFormData, setLandingPageFormData] = useState<LandingPageFormData>({
    landingPageCoverImageUrl: '',
    heroHeadline: '',
    heroSubheadline: '',
    heroCtaText: '',
    coachBio: '',
    coachHeadline: '',
    coachBullets: [],
    keyOutcomes: [],
    features: [],
    testimonials: [],
    faqs: [],
    showEnrollmentCount: false,
    showCurriculum: false,
  });
  
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchSquads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(apiBasePath);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch squads');
      }

      const data = await response.json();
      setSquads(data.squads || []);
    } catch (err) {
      console.error('[CoachSquadsTab] Error fetching squads:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch squads');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    fetchSquads();
  }, [fetchSquads]);

  const fetchSquadMembers = useCallback(async (squadId: string) => {
    try {
      setLoadingMembers(true);
      const response = await fetch(`${apiBasePath}/${squadId}/members`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      setSquadMembers(data.members || []);
    } catch (err) {
      console.error('[CoachSquadsTab] Error fetching members:', err);
      setSquadMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [apiBasePath]);

  // Fetch members when switching to members view
  useEffect(() => {
    if (viewMode === 'members' && selectedSquad) {
      fetchSquadMembers(selectedSquad.id);
    }
  }, [viewMode, selectedSquad, fetchSquadMembers]);

  // Fetch coaches for assignment dropdown
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const response = await fetch('/api/coach/org-coaches');
        if (response.ok) {
          const data = await response.json();
          setCoaches(data.coaches || []);
        }
      } catch (err) {
        console.error('[CoachSquadsTab] Error fetching coaches:', err);
      }
    };
    fetchCoaches();
  }, []);

  // Handler to update coach assignment
  const handleUpdateCoach = async (newCoachId: string | null) => {
    if (!selectedSquad) return;
    
    try {
      setUpdatingCoach(true);
      
      const response = await fetch(`${apiBasePath}/${selectedSquad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId: newCoachId }),
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update coach');
      }
      
      // Refresh squads and update selected squad
      await fetchSquads();
      const updatedSquads = await fetch(apiBasePath).then(r => r.json());
      const updated = (updatedSquads.squads || []).find((s: Squad) => s.id === selectedSquad.id);
      if (updated) setSelectedSquad(updated);
      
      // Also refresh members to show updated coach badge
      fetchSquadMembers(selectedSquad.id);
    } catch (err) {
      console.error('[CoachSquadsTab] Error updating coach:', err);
      alert(err instanceof Error ? err.message : 'Failed to update coach');
    } finally {
      setUpdatingCoach(false);
    }
  };

  // Load landing page data when switching to that view
  useEffect(() => {
    if (viewMode === 'landing' && selectedSquad) {
      setLandingPageFormData({
        landingPageCoverImageUrl: selectedSquad.landingPageCoverImageUrl || '',
        // Hero section
        heroHeadline: selectedSquad.heroHeadline || '',
        heroSubheadline: selectedSquad.heroSubheadline || '',
        heroCtaText: selectedSquad.heroCtaText || '',
        // Coach section
        coachBio: selectedSquad.coachBio || '',
        coachHeadline: selectedSquad.coachHeadline || '',
        coachBullets: selectedSquad.coachBullets || [],
        // Other content
        keyOutcomes: selectedSquad.keyOutcomes || [],
        features: (selectedSquad.features || []).map(f => ({
          title: f.title,
          description: f.description,
          icon: f.icon,
        })),
        testimonials: (selectedSquad.testimonials || []).map(t => ({
          text: t.quote,
          author: t.name,
          role: t.title,
          rating: 5,
        })),
        faqs: (selectedSquad.faqs || []).map(f => ({
          question: f.question,
          answer: f.answer,
        })),
        showEnrollmentCount: selectedSquad.showMemberCount || false,
        showCurriculum: false,
      });
    }
  }, [viewMode, selectedSquad]);

  const handleSelectSquad = (squad: SquadWithStats) => {
    setSelectedSquad(squad);
    setViewMode('members');
  };

  const handleBackToList = () => {
    setSelectedSquad(null);
    setViewMode('list');
    setSquadMembers([]);
  };

  const handleEditSquad = (e: React.MouseEvent, squad: Squad) => {
    e.stopPropagation();
    setEditingSquad(squad);
    setIsSquadModalOpen(true);
  };

  const handleDeleteSquad = async () => {
    if (!deleteConfirmSquad) return;
    
    try {
      setDeleting(true);
      const response = await fetch(`${apiBasePath}/${deleteConfirmSquad.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete squad');
      }

      setDeleteConfirmSquad(null);
      if (selectedSquad?.id === deleteConfirmSquad.id) {
        handleBackToList();
      }
      fetchSquads();
    } catch (err) {
      console.error('[CoachSquadsTab] Error deleting squad:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete squad');
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeConfirmMember || !selectedSquad) return;
    
    try {
      setRemovingMember(true);
      const response = await fetch(
        `${apiBasePath}/${selectedSquad.id}/members?userId=${removeConfirmMember.userId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to remove member');
      }

      setRemoveConfirmMember(null);
      fetchSquadMembers(selectedSquad.id);
    } catch (err) {
      console.error('[CoachSquadsTab] Error removing member:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMember(false);
    }
  };

  const handleSaveLandingPage = async () => {
    if (!selectedSquad) return;
    
    try {
      setSaving(true);
      setSaveError(null);

      const response = await fetch(`${apiBasePath}/${selectedSquad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landingPageCoverImageUrl: landingPageFormData.landingPageCoverImageUrl || null,
          // Hero section
          heroHeadline: landingPageFormData.heroHeadline || null,
          heroSubheadline: landingPageFormData.heroSubheadline || null,
          heroCtaText: landingPageFormData.heroCtaText || null,
          // Coach section
          coachBio: landingPageFormData.coachBio,
          coachHeadline: landingPageFormData.coachHeadline || null,
          coachBullets: landingPageFormData.coachBullets || [],
          // Other content
          keyOutcomes: landingPageFormData.keyOutcomes,
          features: landingPageFormData.features.map((f, i) => ({
            id: `feature-${i}`,
            title: f.title,
            description: f.description || '',
            icon: f.icon,
          })),
          testimonials: landingPageFormData.testimonials.map((t, i) => ({
            id: `testimonial-${i}`,
            name: t.author,
            title: t.role,
            quote: t.text,
          })),
          faqs: landingPageFormData.faqs.map((f, i) => ({
            id: `faq-${i}`,
            question: f.question,
            answer: f.answer,
          })),
          showMemberCount: landingPageFormData.showEnrollmentCount,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save landing page');
      }

      // Refresh squads to get updated data
      await fetchSquads();
      // Update selected squad in state
      const updatedSquads = await fetch(apiBasePath).then(r => r.json());
      const updated = (updatedSquads.squads || []).find((s: Squad) => s.id === selectedSquad.id);
      if (updated) setSelectedSquad(updated);
    } catch (err) {
      console.error('[CoachSquadsTab] Error saving landing page:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const copySquadLink = async (squad: Squad) => {
    const url = `${window.location.origin}/discover/squads/${squad.id}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    } catch {
      alert('Failed to copy link');
    }
  };
  
  // Apply AI-generated landing page content for squad
  const handleApplyAILandingPage = async (draft: ProgramContentDraft | LandingPageDraft) => {
    if (!selectedSquad) return;
    
    const lpDraft = draft as LandingPageDraft;
    
    try {
      setSaving(true);
      setSaveError(null);
      
      // Map AI-generated landing page to squad fields
      const response = await fetch(`${apiBasePath}/${selectedSquad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Hero section
          heroHeadline: lpDraft.hero.title,
          heroSubheadline: lpDraft.hero.subtitle,
          heroCtaText: lpDraft.hero.primaryCta,
          // Coach section
          coachBio: lpDraft.aboutCoach.bio,
          coachHeadline: lpDraft.aboutCoach.headline,
          coachBullets: lpDraft.aboutCoach.bullets || [],
          // Other content
          keyOutcomes: lpDraft.whatYoullLearn.items.map(item => `${item.title}: ${item.description}`),
          features: lpDraft.whatsIncluded.items.map((item, i) => ({
            id: `feature-${i}`,
            title: item.title,
            description: item.description,
            icon: '',
          })),
          testimonials: lpDraft.testimonials.map((t, i) => ({
            id: `testimonial-${i}`,
            name: t.name,
            title: t.role || '',
            quote: t.quote,
          })),
          faqs: lpDraft.faq.map((f, i) => ({
            id: `faq-${i}`,
            question: f.question,
            answer: f.answer,
          })),
        }),
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save landing page');
      }
      
      // Refresh and update form data
      const updatedSquads = await fetch(apiBasePath).then(r => r.json());
      const updated = (updatedSquads.squads || []).find((s: Squad) => s.id === selectedSquad.id);
      if (updated) {
        setSelectedSquad(updated);
        setLandingPageFormData({
          landingPageCoverImageUrl: updated.landingPageCoverImageUrl || '',
          // Hero section
          heroHeadline: updated.heroHeadline || '',
          heroSubheadline: updated.heroSubheadline || '',
          heroCtaText: updated.heroCtaText || '',
          // Coach section
          coachBio: updated.coachBio || '',
          coachHeadline: updated.coachHeadline || '',
          coachBullets: updated.coachBullets || [],
          // Other content
          keyOutcomes: updated.keyOutcomes || [],
          features: (updated.features || []).map((f: { title: string; description: string; icon?: string }) => ({
            title: f.title,
            description: f.description,
            icon: f.icon,
          })),
          testimonials: (updated.testimonials || []).map((t: { quote: string; name: string; title?: string }) => ({
            text: t.quote,
            author: t.name,
            role: t.title,
            rating: 5,
          })),
          faqs: (updated.faqs || []).map((f: { question: string; answer: string }) => ({
            question: f.question,
            answer: f.answer,
          })),
          showEnrollmentCount: updated.showMemberCount || false,
          showCurriculum: false,
        });
      }
      
      setIsAILandingPageModalOpen(false);
    } catch (err) {
      console.error('[CoachSquadsTab] Error applying AI landing page:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to apply AI content');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (loading && squads.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a07855] dark:border-[#b8896a]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-albert">{error}</p>
        <Button onClick={fetchSquads} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  // Filter squads based on selected filter
  const filteredSquads = squads.filter((squad) => {
    switch (squadFilter) {
      case 'standalone':
        return !squad.programId;
      case 'program-all':
        return !!squad.programId;
      case 'program-group':
        return !!squad.programId && squad.programType === 'group';
      case 'program-individual':
        return !!squad.programId && squad.programType === 'individual';
      case 'all':
      default:
        return true;
    }
  });

  // Count squads for filter badges
  const standaloneCount = squads.filter(s => !s.programId).length;
  const programCount = squads.filter(s => !!s.programId).length;
  const programGroupCount = squads.filter(s => !!s.programId && s.programType === 'group').length;
  const programIndividualCount = squads.filter(s => !!s.programId && s.programType === 'individual').length;

  // List view
  if (viewMode === 'list' || !selectedSquad) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Squads
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
              Manage your masterminds and communities
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingSquad(null);
              setIsSquadModalOpen(true);
            }}
            className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white font-albert"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Squad
          </Button>
        </div>

        {/* Filter Tabs */}
        {squads.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {/* Main Filters */}
            <button
              onClick={() => setSquadFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-albert transition-colors ${
                squadFilter === 'all'
                  ? 'bg-[#a07855] dark:bg-[#b8896a] text-white'
                  : 'bg-[#faf8f6] dark:bg-[#11141b] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#171b22]'
              }`}
            >
              All ({squads.length})
            </button>
            <button
              onClick={() => setSquadFilter('standalone')}
              className={`px-3 py-1.5 rounded-lg text-sm font-albert transition-colors ${
                squadFilter === 'standalone'
                  ? 'bg-[#a07855] dark:bg-[#b8896a] text-white'
                  : 'bg-[#faf8f6] dark:bg-[#11141b] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#171b22]'
              }`}
            >
              Masterminds ({standaloneCount})
            </button>
            
            {/* Program Squads with sub-filters */}
            {programCount > 0 && (
              <>
                <div className="w-px h-6 bg-[#e1ddd8] dark:bg-[#262b35] mx-1" />
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Communities:</span>
                <button
                  onClick={() => setSquadFilter('program-all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-albert transition-colors ${
                    squadFilter === 'program-all'
                      ? 'bg-[#a07855] dark:bg-[#b8896a] text-white'
                      : 'bg-[#faf8f6] dark:bg-[#11141b] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#171b22]'
                  }`}
                >
                  All ({programCount})
                </button>
                {programGroupCount > 0 && (
                  <button
                    onClick={() => setSquadFilter('program-group')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-albert transition-colors ${
                      squadFilter === 'program-group'
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    Group ({programGroupCount})
                  </button>
                )}
                {programIndividualCount > 0 && (
                  <button
                    onClick={() => setSquadFilter('program-individual')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-albert transition-colors ${
                      squadFilter === 'program-individual'
                        ? 'bg-purple-500 text-white'
                        : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                    }`}
                  >
                    Individual ({programIndividualCount})
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Squads Grid */}
        {filteredSquads.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
            <Users className="w-12 h-12 text-[#d1ccc5] dark:text-[#7d8190] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {squads.length === 0 ? 'No squads yet' : 'No squads match this filter'}
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1 mb-4">
              {squads.length === 0 
                ? 'Create your first mastermind'
                : 'Try selecting a different filter or create a new squad'
              }
            </p>
            {squads.length === 0 && (
              <Button
                onClick={() => setIsSquadModalOpen(true)}
                className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white font-albert"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Squad
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSquads.map((squad) => (
              <div
                key={squad.id}
                className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 hover:border-[#a07855] dark:border-[#b8896a]/50 transition-colors cursor-pointer group"
                onClick={() => handleSelectSquad(squad)}
              >
                <div className="flex items-start gap-3">
                  {squad.avatarUrl ? (
                    <Image
                      src={squad.avatarUrl}
                      alt={squad.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#a07855]/10 flex items-center justify-center">
                      <Users className="w-6 h-6 text-[#a07855] dark:text-[#b8896a]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                        {squad.name}
                      </h3>
                      {squad.visibility === 'private' ? (
                        <Lock className="w-3.5 h-3.5 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0" />
                      )}
                    </div>
                    {squad.description && (
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert line-clamp-2 mt-1">
                        {squad.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {squad.memberCount || 0} members
                      </span>
                      {squad.priceInCents && squad.priceInCents > 0 && (
                        <span className="text-[#a07855] dark:text-[#b8896a] font-medium">
                          ${(squad.priceInCents / 100).toFixed(0)}
                          {squad.subscriptionEnabled && `/${squad.billingInterval?.slice(0, 2)}`}
                        </span>
                      )}
                    </div>
                    {/* Program Badge */}
                    {squad.programId && squad.programName && (
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                          squad.programType === 'individual'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {squad.programType === 'individual' ? '1:1' : 'Group'}: {squad.programName}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#d1ccc5] dark:text-[#7d8190] group-hover:text-[#a07855] dark:text-[#b8896a] transition-colors flex-shrink-0" />
                </div>
                
                {/* Action buttons (show on hover) */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#e1ddd8] dark:border-[#262b35] opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleEditSquad(e, squad)}
                    className="text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copySquadLink(squad);
                    }}
                    className="text-xs"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/discover/squads/${squad.id}`, '_blank');
                    }}
                    className="text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmSquad(squad);
                    }}
                    className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Squad Form Dialog */}
        <SquadFormDialog
          squad={editingSquad}
          open={isSquadModalOpen}
          onClose={() => {
            setIsSquadModalOpen(false);
            setEditingSquad(null);
          }}
          onSave={() => {
            setIsSquadModalOpen(false);
            setEditingSquad(null);
            fetchSquads();
          }}
          apiBasePath={apiBasePath}
          coachesApiEndpoint="/api/coach/org-coaches"
          uploadEndpoint="/api/coach/org-upload-media"
        />
      </div>
    );
  }

  // Detail view (Members, Landing, Referrals)
  return (
    <div>
      {/* Header with back button and tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToList}
            className="p-2 hover:bg-[#faf8f6] dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] rotate-180" />
          </button>
          <div className="flex items-center gap-3">
            {selectedSquad.avatarUrl ? (
              <Image
                src={selectedSquad.avatarUrl}
                alt={selectedSquad.name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[#a07855]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {selectedSquad.name}
              </h2>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                {selectedSquad.memberCount || 0} members • {selectedSquad.visibility === 'private' ? 'Private' : 'Public'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditSquad({ stopPropagation: () => {} } as React.MouseEvent, selectedSquad)}
            className="border-[#e1ddd8] dark:border-[#262b35]"
          >
            <Edit2 className="w-4 h-4 mr-1" />
            Edit Squad
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDeleteConfirmSquad(selectedSquad);
            }}
            className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[#e1ddd8] dark:border-[#262b35] pb-2">
        <button
          onClick={() => setViewMode('members')}
          className={`px-3 py-1.5 rounded-lg text-sm font-albert ${
            viewMode === 'members'
              ? 'bg-[#a07855]/10 dark:bg-[#b8896a]/10 text-[#a07855] dark:text-[#b8896a]'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
          }`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          Members
        </button>
        <button
          onClick={() => setViewMode('landing')}
          className={`px-3 py-1.5 rounded-lg text-sm font-albert flex items-center gap-1.5 ${
            viewMode === 'landing'
              ? 'bg-[#a07855]/10 dark:bg-[#b8896a]/10 text-[#a07855] dark:text-[#b8896a]'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Landing Page
        </button>
        <button
          onClick={() => setViewMode('referrals')}
          className={`px-3 py-1.5 rounded-lg text-sm font-albert flex items-center gap-1.5 ${
            viewMode === 'referrals'
              ? 'bg-[#a07855]/10 dark:bg-[#b8896a]/10 text-[#a07855] dark:text-[#b8896a]'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-white/5'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          Referrals
        </button>
      </div>

      {/* View Content */}
      {viewMode === 'members' ? (
        // Members View
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              View and manage squad members
            </p>
          </div>

          {/* Coach Assignment Section */}
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                  Squad Coach
                </h4>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Assign or change the coach for this squad
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selectedSquad.coachId && (
                  <div className="flex items-center gap-2 text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {(() => {
                      const currentCoach = coaches.find(c => c.id === selectedSquad.coachId);
                      return currentCoach ? (
                        <>
                          {currentCoach.imageUrl ? (
                            <Image
                              src={currentCoach.imageUrl}
                              alt=""
                              width={28}
                              height={28}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#a07855]/10 flex items-center justify-center text-[#a07855] dark:text-[#b8896a] text-xs font-bold">
                              {currentCoach.firstName?.charAt(0) || '?'}
                            </div>
                          )}
                          <span className="font-medium font-albert">{currentCoach.name}</span>
                        </>
                      ) : (
                        <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Coach not in list</span>
                      );
                    })()}
                  </div>
                )}
                <Select
                  value={selectedSquad.coachId || 'none'}
                  onValueChange={(val) => handleUpdateCoach(val === 'none' ? null : val)}
                  disabled={updatingCoach}
                >
                  <SelectTrigger className="w-[200px] font-albert">
                    <SelectValue placeholder={updatingCoach ? 'Updating...' : 'Change coach'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="font-albert">No coach</SelectItem>
                    {coaches.map((coach) => (
                      <SelectItem key={coach.id} value={coach.id} className="font-albert">
                        {coach.name} ({coach.email.split('@')[0]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {loadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#a07855] dark:border-[#b8896a]" />
            </div>
          ) : squadMembers.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
              <Users className="w-10 h-10 text-[#d1ccc5] dark:text-[#7d8190] mx-auto mb-2" />
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                No members in this squad yet
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {squadMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-4">
                  {member.imageUrl ? (
                    <Image
                      src={member.imageUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#a07855]/10 flex items-center justify-center text-[#a07855] dark:text-[#b8896a] font-bold">
                      {member.firstName?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                      {member.firstName} {member.lastName}
                      {selectedSquad.coachId === member.userId && (
                        <span className="ml-2 text-xs text-[#a07855] dark:text-[#b8896a]">(Coach)</span>
                      )}
                    </p>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                      {member.roleInSquad === 'coach' ? 'Coach' : 'Member'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoveConfirmMember(member)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === 'landing' ? (
        // Landing Page Editor
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Customize your squad&apos;s public landing page
              </p>
              <a
                href={`/discover/squads/${selectedSquad.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#a07855] dark:text-[#b8896a] hover:underline flex items-center gap-1 mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                Preview landing page
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsAILandingPageModalOpen(true)}
                className="border-[#a07855] dark:border-[#b8896a] text-[#a07855] dark:text-[#b8896a] hover:bg-[#a07855]/10 dark:hover:bg-[#b8896a]/10 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </Button>
              <Button
                onClick={handleSaveLandingPage}
                disabled={saving}
                className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white font-albert"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
          
          {saveError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
            </div>
          )}

          <ProgramLandingPageEditor
            formData={landingPageFormData}
            onChange={setLandingPageFormData}
            hideCurriculumOption={true}
            countLabel="member count"
            uploadEndpoint="/api/coach/org-upload-media"
            uploadFolder="squads"
          />
        </div>
      ) : viewMode === 'referrals' ? (
        // Referrals Settings
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
          <ReferralConfigForm
            targetType="squad"
            targetId={selectedSquad.id}
            targetName={selectedSquad.name}
            initialConfig={selectedSquad.referralConfig}
            onSave={() => fetchSquads()}
          />
        </div>
      ) : null}

      {/* Remove Member Confirmation */}
      {removeConfirmMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Full screen backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setRemoveConfirmMember(null)} 
          />
          {/* Modal */}
          <div className="relative bg-white dark:bg-[#171b22] rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Remove Member
              </h3>
              <button
                onClick={() => setRemoveConfirmMember(null)}
                className="p-1 hover:bg-[#faf8f6] dark:hover:bg-white/5 rounded"
              >
                <X className="w-5 h-5 text-[#5f5a55]" />
              </button>
            </div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
              Are you sure you want to remove {removeConfirmMember.firstName} {removeConfirmMember.lastName} from this squad?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRemoveConfirmMember(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRemoveMember}
                disabled={removingMember}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {removingMember ? 'Removing...' : 'Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Squad Confirmation */}
      {deleteConfirmSquad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Full screen backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setDeleteConfirmSquad(null)} 
          />
          {/* Modal */}
          <div className="relative bg-white dark:bg-[#171b22] rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Delete Squad
              </h3>
              <button
                onClick={() => setDeleteConfirmSquad(null)}
                className="p-1 hover:bg-[#faf8f6] dark:hover:bg-white/5 rounded"
              >
                <X className="w-5 h-5 text-[#5f5a55]" />
              </button>
            </div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
              Are you sure you want to delete &quot;{deleteConfirmSquad.name}&quot;? This action cannot be undone and all members will be removed.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmSquad(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteSquad}
                disabled={deleting}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {deleting ? 'Deleting...' : 'Delete Squad'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Squad Form Dialog */}
      <SquadFormDialog
        squad={editingSquad}
        open={isSquadModalOpen}
        onClose={() => {
          setIsSquadModalOpen(false);
          setEditingSquad(null);
        }}
        onSave={async () => {
          setIsSquadModalOpen(false);
          setEditingSquad(null);
          await fetchSquads();
          // Update selected squad
          const updatedSquads = await fetch(apiBasePath).then(r => r.json());
          const updated = (updatedSquads.squads || []).find((s: Squad) => s.id === selectedSquad.id);
          if (updated) setSelectedSquad(updated);
        }}
        apiBasePath={apiBasePath}
        coachesApiEndpoint="/api/coach/org-coaches"
        uploadEndpoint="/api/coach/org-upload-media"
      />
      
      {/* AI Landing Page Modal */}
      <AIHelperModal
        isOpen={isAILandingPageModalOpen}
        onClose={() => setIsAILandingPageModalOpen(false)}
        title="Generate Landing Page"
        description="Create compelling landing page copy for your community"
        useCase="LANDING_PAGE_SQUAD"
        context={{
          squadName: selectedSquad?.name,
          niche: selectedSquad?.description?.slice(0, 100),
        } as AIGenerationContext}
        onApply={handleApplyAILandingPage}
        hasExistingContent={!!(landingPageFormData.coachBio || landingPageFormData.keyOutcomes.length > 0)}
        overwriteWarning="This will replace your existing landing page content."
      />
    </div>
  );
}

