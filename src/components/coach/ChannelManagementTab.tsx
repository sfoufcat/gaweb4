'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Pin,
  MessageSquare,
  Phone,
  Megaphone,
  Hash,
  Sparkles,
  X,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { OrgChannel, OrgChannelType } from '@/lib/org-channels';

// Icon map for channel types
const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  megaphone: <Megaphone className="w-5 h-5" />,
  chat: <MessageSquare className="w-5 h-5" />,
  sparkles: <Sparkles className="w-5 h-5" />,
  hash: <Hash className="w-5 h-5" />,
};

const ICON_OPTIONS = [
  { value: 'megaphone', label: 'Megaphone', icon: <Megaphone className="w-5 h-5" /> },
  { value: 'chat', label: 'Chat', icon: <MessageSquare className="w-5 h-5" /> },
  { value: 'sparkles', label: 'Sparkles', icon: <Sparkles className="w-5 h-5" /> },
  { value: 'hash', label: 'Hash', icon: <Hash className="w-5 h-5" /> },
];

interface EditChannelModalProps {
  channel: OrgChannel | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<OrgChannel>) => Promise<void>;
  isNew?: boolean;
}

function EditChannelModal({ channel, isOpen, onClose, onSave, isNew }: EditChannelModalProps) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [icon, setIcon] = useState('hash');
  const [isPinned, setIsPinned] = useState(false);
  const [allowMemberMessages, setAllowMemberMessages] = useState(true);
  const [allowCalling, setAllowCalling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<OrgChannelType>('custom');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && channel) {
      setTitle(channel.title);
      setSubtitle(channel.subtitle || '');
      setIcon(channel.icon || 'hash');
      setIsPinned(channel.isPinned);
      setAllowMemberMessages(channel.allowMemberMessages);
      setAllowCalling(channel.allowCalling);
      setType(channel.type);
    } else if (isOpen && isNew) {
      setTitle('');
      setSubtitle('');
      setIcon('hash');
      setIsPinned(false);
      setAllowMemberMessages(true);
      setAllowCalling(false);
      setType('custom');
    }
  }, [isOpen, channel, isNew]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        icon,
        isPinned,
        allowMemberMessages,
        allowCalling,
        ...(isNew && { type }),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-[#11141b] rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h2 className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
            {isNew ? 'Add Channel' : 'Edit Channel'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] transition-colors"
          >
            <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block font-albert text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Channel name"
              className="w-full px-4 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#05070b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855]/50"
              required
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block font-albert text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              Subtitle <span className="text-[#8c8c8c] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Brief description"
              className="w-full px-4 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#05070b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855]/50"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block font-albert text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              Icon
            </label>
            <div className="flex gap-2">
              {ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIcon(opt.value)}
                  className={`p-3 rounded-xl border transition-colors ${
                    icon === opt.value
                      ? 'border-[#a07855] bg-[#a07855]/10 text-[#a07855]'
                      : 'border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:border-[#a07855]/50'
                  }`}
                >
                  {opt.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {/* Pin to top */}
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-3">
                <Pin className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">Pin to top</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isPinned ? 'bg-[#a07855]' : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    isPinned ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            {/* Allow member messages */}
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">Allow members to send messages</span>
              </div>
              <button
                type="button"
                onClick={() => setAllowMemberMessages(!allowMemberMessages)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  allowMemberMessages ? 'bg-[#a07855]' : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    allowMemberMessages ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            {/* Allow calling */}
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">Allow audio/video calls</span>
              </div>
              <button
                type="button"
                onClick={() => setAllowCalling(!allowCalling)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  allowCalling ? 'bg-[#a07855]' : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    allowCalling ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#a07855] font-albert font-medium text-white hover:bg-[#8c6847] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  channel: OrgChannel | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function DeleteConfirmModal({ channel, isOpen, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !channel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-[#11141b] rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
            Delete Channel?
          </h3>
          <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-6">
            Are you sure you want to delete &quot;{channel.title}&quot;? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 font-albert font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ChannelManagementTab
 * 
 * Allows coaches to manage their organization's chat channels:
 * - View all channels
 * - Reorder channels (drag and drop)
 * - Edit channel settings (title, subtitle, icon, permissions)
 * - Add new channels
 * - Delete channels
 */
export function ChannelManagementTab() {
  const [channels, setChannels] = useState<OrgChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<OrgChannel | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState<OrgChannel | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/coach/org-channels');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch channels');
      }

      const data = await response.json();
      setChannels(data.channels || []);
    } catch (err) {
      console.error('Error fetching channels:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Setup default channels
  const handleSetupDefaults = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/coach/org-channels/setup-defaults', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to setup channels');
      }

      await fetchChannels();
    } catch (err) {
      console.error('Error setting up defaults:', err);
      setError(err instanceof Error ? err.message : 'Failed to setup channels');
    } finally {
      setLoading(false);
    }
  };

  // Handle edit save
  const handleEditSave = async (updates: Partial<OrgChannel>) => {
    if (!editingChannel) return;

    const response = await fetch(`/api/coach/org-channels/${editingChannel.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update channel');
    }

    await fetchChannels();
  };

  // Handle add new
  const handleAddNew = async (data: Partial<OrgChannel>) => {
    const response = await fetch('/api/coach/org-channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const responseData = await response.json();
      throw new Error(responseData.error || 'Failed to create channel');
    }

    await fetchChannels();
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingChannel) return;

    const response = await fetch(`/api/coach/org-channels/${deletingChannel.id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete channel');
    }

    await fetchChannels();
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newChannels = [...channels];
    const [draggedChannel] = newChannels.splice(draggedIndex, 1);
    newChannels.splice(index, 0, draggedChannel);
    
    setChannels(newChannels);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;
    setDraggedIndex(null);

    // Send new order to server
    const channelOrder = channels.map((channel, index) => ({
      channelId: channel.id,
      order: index,
    }));

    try {
      const response = await fetch('/api/coach/org-channels/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelOrder }),
      });

      if (!response.ok) {
        // Revert on error
        await fetchChannels();
      }
    } catch {
      // Revert on error
      await fetchChannels();
    }
  };

  // Loading state
  if (loading && channels.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg" />
            <div className="h-4 w-64 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg" />
            <div className="space-y-3 mt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-[#e1ddd8] dark:bg-[#262b35] rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no channels set up
  if (!loading && channels.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="w-16 h-16 rounded-full bg-[#a07855]/10 dark:bg-[#b8896a]/15 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]" />
          </div>
          <h3 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
            No Channels Yet
          </h3>
          <p className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] mb-6 max-w-md mx-auto">
            Set up your organization&apos;s chat channels to communicate with your members.
          </p>
          <button
            onClick={handleSetupDefaults}
            className="px-6 py-3 rounded-xl bg-[#a07855] font-albert font-medium text-white hover:bg-[#8c6847] transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Setup Default Channels
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
              Chat Channels
            </h2>
            <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
              Manage your organization&apos;s chat channels
            </p>
          </div>
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-4 py-2 rounded-xl bg-[#a07855] font-albert font-medium text-white hover:bg-[#8c6847] transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Channel
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="font-albert text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Channel List */}
        <div className="space-y-2">
          {channels.map((channel, index) => (
            <div
              key={channel.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-move ${
                draggedIndex === index
                  ? 'border-[#a07855] bg-[#a07855]/5 shadow-lg'
                  : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] hover:border-[#a07855]/50'
              }`}
            >
              {/* Drag Handle */}
              <GripVertical className="w-5 h-5 text-[#8c8c8c] dark:text-[#7d8190] flex-shrink-0" />

              {/* Icon */}
              <div className="w-10 h-10 rounded-full bg-[#a07855]/10 dark:bg-[#b8896a]/15 flex items-center justify-center flex-shrink-0 text-[#a07855] dark:text-[#b8896a]">
                {CHANNEL_ICONS[channel.icon || 'hash'] || CHANNEL_ICONS.hash}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                    {channel.title}
                  </span>
                  {channel.isPinned && (
                    <Pin className="w-3.5 h-3.5 text-[#a07855]" />
                  )}
                  {!channel.allowMemberMessages && (
                    <span className="px-2 py-0.5 rounded-full bg-[#f3f1ef] dark:bg-[#171b22] text-[10px] font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
                      Coach only
                    </span>
                  )}
                </div>
                {channel.subtitle && (
                  <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                    {channel.subtitle}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setEditingChannel(channel)}
                  className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#171b22] transition-colors text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#a07855]"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingChannel(channel)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-[#5f5a55] dark:text-[#b2b6c2] hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Hint */}
        <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] mt-4 text-center">
          Drag channels to reorder them
        </p>
      </div>

      {/* Edit Modal */}
      <EditChannelModal
        channel={editingChannel}
        isOpen={!!editingChannel}
        onClose={() => setEditingChannel(null)}
        onSave={handleEditSave}
      />

      {/* Add New Modal */}
      <EditChannelModal
        channel={null}
        isOpen={isAddingNew}
        onClose={() => setIsAddingNew(false)}
        onSave={handleAddNew}
        isNew
      />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        channel={deletingChannel}
        isOpen={!!deletingChannel}
        onClose={() => setDeletingChannel(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default ChannelManagementTab;
