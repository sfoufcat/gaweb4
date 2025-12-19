'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { Track, UserTrack, WeeklyFocusDefaults } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

const TRACK_SLUG_OPTIONS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'community_builder',
  'general',
];

const TRACK_SLUG_LABELS: Record<UserTrack, string> = {
  content_creator: 'Content Creator',
  saas: 'SaaS Founder',
  coach_consultant: 'Coach/Consultant',
  ecom: 'E-Commerce',
  agency: 'Agency',
  community_builder: 'Community Builder',
  general: 'General',
};

interface TrackFormData {
  slug: UserTrack;
  name: string;
  description: string;
  habitLabel: string;
  programBadgeLabel: string;
  isActive: boolean;
  weeklyFocusDefaults: WeeklyFocusDefaults;
}

const DEFAULT_FORM_DATA: TrackFormData = {
  slug: 'general',
  name: '',
  description: '',
  habitLabel: '',
  programBadgeLabel: '',
  isActive: true,
  weeklyFocusDefaults: {
    1: '',
    2: '',
    3: '',
    4: '',
  },
};

interface AdminTracksTabProps {
  apiBasePath?: string;
}

export function AdminTracksTab({ apiBasePath = '/api/admin/tracks' }: AdminTracksTabProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [formData, setFormData] = useState<TrackFormData>(DEFAULT_FORM_DATA);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchTracks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(apiBasePath);
      if (!response.ok) {
        throw new Error('Failed to fetch tracks');
      }

      const data = await response.json();
      setTracks(data.tracks || []);
    } catch (err) {
      console.error('Error fetching tracks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tracks');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const handleOpenModal = (track?: Track) => {
    if (track) {
      setEditingTrack(track);
      setFormData({
        slug: track.slug,
        name: track.name,
        description: track.description,
        habitLabel: track.habitLabel,
        programBadgeLabel: track.programBadgeLabel,
        isActive: track.isActive,
        weeklyFocusDefaults: track.weeklyFocusDefaults || { 1: '', 2: '', 3: '', 4: '' },
      });
    } else {
      setEditingTrack(null);
      setFormData(DEFAULT_FORM_DATA);
    }
    setSaveError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTrack(null);
    setFormData(DEFAULT_FORM_DATA);
    setSaveError(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError(null);

      const url = editingTrack 
        ? `${apiBasePath}/${editingTrack.id}`
        : apiBasePath;
      
      const response = await fetch(url, {
        method: editingTrack ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save track');
      }

      await fetchTracks();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving track:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save track');
    } finally {
      setSaving(false);
    }
  };

  // Check which slugs are already in use
  const usedSlugs = tracks.map(t => t.slug);
  const availableSlugs = editingTrack 
    ? TRACK_SLUG_OPTIONS 
    : TRACK_SLUG_OPTIONS.filter(s => !usedSlugs.includes(s));

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-[#a07855] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading tracks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-albert font-semibold mb-2">Error</p>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm">{error}</p>
        <Button 
          onClick={fetchTracks} 
          className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Tracks
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Manage business track types and their labels
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={fetchTracks}
            variant="outline"
            className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
          >
            Refresh
          </Button>
          {availableSlugs.length > 0 && (
            <Button 
              onClick={() => handleOpenModal()}
              className="bg-[#a07855] hover:bg-[#8c6245] text-white"
            >
              Add Track
            </Button>
          )}
        </div>
      </div>

      {/* Tracks Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-albert">Slug</TableHead>
              <TableHead className="font-albert">Name</TableHead>
              <TableHead className="font-albert">Habit Label</TableHead>
              <TableHead className="font-albert">Program Badge</TableHead>
              <TableHead className="font-albert">Status</TableHead>
              <TableHead className="font-albert w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tracks.map((track) => (
              <TableRow key={track.id}>
                <TableCell className="font-albert font-mono text-sm">
                  {track.slug}
                </TableCell>
                <TableCell className="font-albert font-medium">
                  {track.name}
                </TableCell>
                <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                  {track.habitLabel}
                </TableCell>
                <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                  {track.programBadgeLabel}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${
                    track.isActive 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {track.isActive ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenModal(track)}
                    className="text-[#a07855] hover:text-[#8c6245]"
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {tracks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            No tracks configured yet. Add your first track to get started.
          </p>
        </div>
      )}

      {/* Edit/Create Modal */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
                    {editingTrack ? 'Edit Track' : 'Add Track'}
                  </Dialog.Title>

                  <div className="space-y-4">
                    {/* Slug */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Track Slug
                      </label>
                      <select
                        value={formData.slug}
                        onChange={(e) => {
                          const newSlug = e.target.value as UserTrack;
                          setFormData({
                            ...formData,
                            slug: newSlug,
                            name: formData.name || TRACK_SLUG_LABELS[newSlug],
                            habitLabel: formData.habitLabel || `${TRACK_SLUG_LABELS[newSlug]} habits`,
                            programBadgeLabel: formData.programBadgeLabel || `${TRACK_SLUG_LABELS[newSlug]} starter program`,
                          });
                        }}
                        disabled={!!editingTrack}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert disabled:opacity-50"
                      >
                        {(editingTrack ? TRACK_SLUG_OPTIONS : availableSlugs).map((slug) => (
                          <option key={slug} value={slug}>
                            {slug} ({TRACK_SLUG_LABELS[slug]})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Content Creator"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Description (admin only)
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Short description for admin reference..."
                        rows={2}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
                      />
                    </div>

                    {/* Habit Label */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Habit Section Label
                      </label>
                      <input
                        type="text"
                        value={formData.habitLabel}
                        onChange={(e) => setFormData({ ...formData, habitLabel: e.target.value })}
                        placeholder="e.g., Creator habits"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                        Shows as the header in the Habits section on Home
                      </p>
                    </div>

                    {/* Program Badge Label */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Program Badge Label
                      </label>
                      <input
                        type="text"
                        value={formData.programBadgeLabel}
                        onChange={(e) => setFormData({ ...formData, programBadgeLabel: e.target.value })}
                        placeholder="e.g., Creator starter program"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                        Shows near Daily Focus during program enrollment
                      </p>
                    </div>

                    {/* Weekly Focus Defaults */}
                    <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-4">
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                        Weekly Focus Suggestions (4-week cycle)
                      </label>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
                        These are shown as suggestions during weekly check-ins
                      </p>
                      <div className="space-y-3">
                        {[1, 2, 3, 4].map((week) => (
                          <div key={week} className="flex items-center gap-3">
                            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert w-16">
                              Week {week}
                            </span>
                            <input
                              type="text"
                              value={formData.weeklyFocusDefaults[week as 1 | 2 | 3 | 4] || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                weeklyFocusDefaults: {
                                  ...formData.weeklyFocusDefaults,
                                  [week]: e.target.value,
                                },
                              })}
                              placeholder={`Week ${week} focus suggestion...`}
                              className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4 rounded border-[#e1ddd8] dark:border-[#262b35] text-[#a07855] focus:ring-[#a07855]"
                      />
                      <label htmlFor="isActive" className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        Active
                      </label>
                    </div>

                    {saveError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 font-albert">{saveError}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={handleCloseModal}
                      disabled={saving}
                      className="border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving || !formData.name || !formData.habitLabel || !formData.programBadgeLabel}
                      className="bg-[#a07855] hover:bg-[#8c6245] text-white"
                    >
                      {saving ? 'Saving...' : (editingTrack ? 'Update' : 'Create')}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

