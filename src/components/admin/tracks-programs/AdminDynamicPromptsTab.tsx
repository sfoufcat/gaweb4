'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { DynamicPrompt, DynamicPromptType, DynamicPromptSlot, Track } from '@/types';
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

const PROMPT_TYPES: DynamicPromptType[] = ['morning', 'evening', 'weekly'];
const PROMPT_SLOTS: DynamicPromptSlot[] = ['goal', 'prompt', 'quote'];

const TYPE_LABELS: Record<DynamicPromptType, string> = {
  morning: 'Morning',
  evening: 'Evening',
  weekly: 'Weekly',
};

const SLOT_LABELS: Record<DynamicPromptSlot, string> = {
  goal: 'Goal',
  prompt: 'Prompt',
  quote: 'Quote',
};

interface PromptFormData {
  trackId: string | null;
  type: DynamicPromptType;
  slot: DynamicPromptSlot;
  title: string;
  body: string;
  priority: number;
  isActive: boolean;
}

const DEFAULT_FORM_DATA: PromptFormData = {
  trackId: null,
  type: 'morning',
  slot: 'prompt',
  title: '',
  body: '',
  priority: 100,
  isActive: true,
};

interface AdminDynamicPromptsTabProps {
  apiBasePath?: string;
}

export function AdminDynamicPromptsTab({ apiBasePath = '/api/admin/dynamic-prompts' }: AdminDynamicPromptsTabProps) {
  const [prompts, setPrompts] = useState<DynamicPrompt[]>([]);
  const [tracks, setTracks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [filterTrackId, setFilterTrackId] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSlot, setFilterSlot] = useState<string>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<DynamicPrompt | null>(null);
  const [formData, setFormData] = useState<PromptFormData>(DEFAULT_FORM_DATA);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(apiBasePath);
      if (!response.ok) {
        throw new Error('Failed to fetch prompts');
      }

      const data = await response.json();
      setPrompts(data.prompts || []);
      setTracks(data.tracks || {});
    } catch (err) {
      console.error('Error fetching prompts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prompts');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  const fetchTracks = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tracks');
      if (response.ok) {
        const data = await response.json();
        const trackMap: Record<string, string> = {};
        (data.tracks || []).forEach((track: Track) => {
          trackMap[track.id] = track.name;
        });
        setTracks(trackMap);
      }
    } catch (err) {
      console.error('Error fetching tracks:', err);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
    fetchTracks();
  }, [fetchPrompts, fetchTracks]);

  // Filter prompts
  const filteredPrompts = useMemo(() => {
    return prompts.filter(prompt => {
      if (filterTrackId !== 'all') {
        if (filterTrackId === 'generic') {
          if (prompt.trackId !== null) return false;
        } else {
          if (prompt.trackId !== filterTrackId) return false;
        }
      }
      if (filterType !== 'all' && prompt.type !== filterType) return false;
      if (filterSlot !== 'all' && prompt.slot !== filterSlot) return false;
      return true;
    });
  }, [prompts, filterTrackId, filterType, filterSlot]);

  const handleOpenModal = (prompt?: DynamicPrompt) => {
    if (prompt) {
      setEditingPrompt(prompt);
      setFormData({
        trackId: prompt.trackId,
        type: prompt.type,
        slot: prompt.slot,
        title: prompt.title || '',
        body: prompt.body,
        priority: prompt.priority,
        isActive: prompt.isActive,
      });
    } else {
      setEditingPrompt(null);
      setFormData(DEFAULT_FORM_DATA);
    }
    setSaveError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPrompt(null);
    setFormData(DEFAULT_FORM_DATA);
    setSaveError(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError(null);

      const url = editingPrompt 
        ? `/api/admin/dynamic-prompts/${editingPrompt.id}`
        : '/api/admin/dynamic-prompts';
      
      const payload = {
        ...formData,
        trackId: formData.trackId === 'null' || !formData.trackId ? null : formData.trackId,
      };
      
      const response = await fetch(url, {
        method: editingPrompt ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save prompt');
      }

      await fetchPrompts();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving prompt:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingPrompt) return;
    
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    
    try {
      setDeleting(true);
      setSaveError(null);

      const response = await fetch(`/api/admin/dynamic-prompts/${editingPrompt.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete prompt');
      }

      await fetchPrompts();
      handleCloseModal();
    } catch (err) {
      console.error('Error deleting prompt:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to delete prompt');
    } finally {
      setDeleting(false);
    }
  };

  const getTrackName = (trackId: string | null) => {
    if (!trackId) return 'All tracks';
    return tracks[trackId] || trackId;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-[#a07855] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading prompts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-albert font-semibold mb-2">Error</p>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm">{error}</p>
        <Button 
          onClick={fetchPrompts} 
          className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Header with Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Dynamic Prompts
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {filteredPrompts.length} of {prompts.length} prompts
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Track filter */}
          <select
            value={filterTrackId}
            onChange={(e) => setFilterTrackId(e.target.value)}
            className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
          >
            <option value="all">All Tracks</option>
            <option value="generic">Generic (fallback)</option>
            {Object.entries(tracks).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          
          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
          >
            <option value="all">All Types</option>
            {PROMPT_TYPES.map((type) => (
              <option key={type} value={type}>{TYPE_LABELS[type]}</option>
            ))}
          </select>
          
          {/* Slot filter */}
          <select
            value={filterSlot}
            onChange={(e) => setFilterSlot(e.target.value)}
            className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm"
          >
            <option value="all">All Slots</option>
            {PROMPT_SLOTS.map((slot) => (
              <option key={slot} value={slot}>{SLOT_LABELS[slot]}</option>
            ))}
          </select>
          
          <Button 
            onClick={fetchPrompts}
            variant="outline"
            className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
          >
            Refresh
          </Button>
          
          <Button 
            onClick={() => handleOpenModal()}
            className="bg-[#a07855] hover:bg-[#8c6245] text-white"
          >
            Add Prompt
          </Button>
        </div>
      </div>

      {/* Prompts Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-albert">Track</TableHead>
              <TableHead className="font-albert">Type</TableHead>
              <TableHead className="font-albert">Slot</TableHead>
              <TableHead className="font-albert">Title</TableHead>
              <TableHead className="font-albert">Body Preview</TableHead>
              <TableHead className="font-albert">Priority</TableHead>
              <TableHead className="font-albert">Status</TableHead>
              <TableHead className="font-albert w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPrompts.map((prompt) => (
              <TableRow key={prompt.id}>
                <TableCell className="font-albert">
                  <span className={`px-2 py-1 rounded text-xs ${
                    prompt.trackId 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {getTrackName(prompt.trackId)}
                  </span>
                </TableCell>
                <TableCell className="font-albert">
                  <span className={`px-2 py-1 rounded text-xs ${
                    prompt.type === 'morning' ? 'bg-amber-100 text-amber-700' :
                    prompt.type === 'evening' ? 'bg-purple-100 text-purple-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {TYPE_LABELS[prompt.type]}
                  </span>
                </TableCell>
                <TableCell className="font-albert text-sm">
                  {SLOT_LABELS[prompt.slot]}
                </TableCell>
                <TableCell className="font-albert font-medium max-w-[150px] truncate">
                  {prompt.title || '-'}
                </TableCell>
                <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] text-sm max-w-[200px] truncate">
                  {prompt.body.substring(0, 50)}{prompt.body.length > 50 ? '...' : ''}
                </TableCell>
                <TableCell className="font-albert text-sm">
                  {prompt.priority}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-albert ${
                    prompt.isActive 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {prompt.isActive ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenModal(prompt)}
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

      {filteredPrompts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {prompts.length === 0 
              ? 'No prompts configured yet. Add your first prompt.'
              : 'No prompts match the current filters.'}
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
                    {editingPrompt ? 'Edit Prompt' : 'Add Prompt'}
                  </Dialog.Title>

                  <div className="space-y-4">
                    {/* Track */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Track
                      </label>
                      <select
                        value={formData.trackId || 'null'}
                        onChange={(e) => setFormData({ ...formData, trackId: e.target.value === 'null' ? null : e.target.value })}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      >
                        <option value="null">All tracks (generic fallback)</option>
                        {Object.entries(tracks).map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                        Track-specific prompts take priority; generic prompts are fallbacks
                      </p>
                    </div>

                    {/* Type & Slot */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Type
                        </label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value as DynamicPromptType })}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        >
                          {PROMPT_TYPES.map((type) => (
                            <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Slot
                        </label>
                        <select
                          value={formData.slot}
                          onChange={(e) => setFormData({ ...formData, slot: e.target.value as DynamicPromptSlot })}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        >
                          {PROMPT_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>{SLOT_LABELS[slot]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Title (optional)
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., Post + Iterate"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    {/* Body */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Body
                      </label>
                      <textarea
                        value={formData.body}
                        onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                        placeholder="The prompt content..."
                        rows={4}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none"
                      />
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Priority (lower = higher priority)
                      </label>
                      <input
                        type="number"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                        min={1}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
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

                  <div className="flex justify-between mt-6">
                    <div>
                      {editingPrompt && (
                        <Button
                          variant="outline"
                          onClick={handleDelete}
                          disabled={saving || deleting}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={handleCloseModal}
                        disabled={saving || deleting}
                        className="border-[#e1ddd8] dark:border-[#262b35]"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={saving || deleting || !formData.body}
                        className="bg-[#a07855] hover:bg-[#8c6245] text-white"
                      >
                        {saving ? 'Saving...' : (editingPrompt ? 'Update' : 'Create')}
                      </Button>
                    </div>
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



