'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DiscoverEvent } from '@/types/discover';
import type { UserTrack } from '@/types';
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
import { Button } from '@/components/ui/button';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { ProgramSelector } from '@/components/admin/ProgramSelector';

// Track options for dropdown
const TRACK_OPTIONS: { value: UserTrack | ''; label: string }[] = [
  { value: '', label: 'All Tracks (No specific track)' },
  { value: 'content_creator', label: 'Creator' },
  { value: 'saas', label: 'SaaS' },
  { value: 'coach_consultant', label: 'Coach/Consultant' },
  { value: 'ecom', label: 'Ecom' },
  { value: 'agency', label: 'Agency' },
  { value: 'community_builder', label: 'Community Builder' },
  { value: 'general', label: 'General' },
];

// Helper to get track display name
const getTrackDisplayName = (track: UserTrack | null | undefined): string => {
  if (!track) return '—';
  const option = TRACK_OPTIONS.find(t => t.value === track);
  return option?.label || track;
};

// Event Form Dialog
function EventFormDialog({
  event,
  isOpen,
  onClose,
  onSave,
  uploadEndpoint,
}: {
  event: DiscoverEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  uploadEndpoint: string;
}) {
  const isEditing = !!event;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    coverImageUrl: '',
    date: '',
    startTime: '18:00',
    endTime: '20:00',
    timezone: 'CET',
    locationType: 'online' as 'online' | 'in_person',
    locationLabel: '',
    shortDescription: '',
    longDescription: '',
    bulletPoints: [''],
    additionalInfo: { type: '', language: 'English', difficulty: 'All levels' },
    zoomLink: '',
    recordingUrl: '',
    hostName: '',
    hostAvatarUrl: '',
    featured: false,
    category: '',
    track: '' as UserTrack | '',
    programIds: [] as string[],
    maxAttendees: '',
  });

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        coverImageUrl: event.coverImageUrl || '',
        date: event.date || '',
        startTime: event.startTime || '18:00',
        endTime: event.endTime || '20:00',
        timezone: event.timezone || 'CET',
        locationType: event.locationType || 'online',
        locationLabel: event.locationLabel || '',
        shortDescription: event.shortDescription || '',
        longDescription: event.longDescription || '',
        bulletPoints: event.bulletPoints?.length ? event.bulletPoints : [''],
        additionalInfo: event.additionalInfo || { type: '', language: 'English', difficulty: 'All levels' },
        zoomLink: event.zoomLink || '',
        recordingUrl: event.recordingUrl || '',
        hostName: event.hostName || '',
        hostAvatarUrl: event.hostAvatarUrl || '',
        featured: event.featured || false,
        category: event.category || '',
        track: event.track || '',
        programIds: event.programIds || [],
        maxAttendees: event.maxAttendees?.toString() || '',
      });
    } else {
      setFormData({
        title: '',
        coverImageUrl: '',
        date: '',
        startTime: '18:00',
        endTime: '20:00',
        timezone: 'CET',
        locationType: 'online',
        locationLabel: 'Online via Zoom',
        shortDescription: '',
        longDescription: '',
        bulletPoints: [''],
        additionalInfo: { type: 'Live workshop', language: 'English', difficulty: 'All levels' },
        zoomLink: '',
        recordingUrl: '',
        hostName: '',
        hostAvatarUrl: '',
        featured: false,
        category: '',
        track: '',
        programIds: [],
        maxAttendees: '',
      });
    }
  }, [event, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        bulletPoints: formData.bulletPoints.filter(bp => bp.trim()),
        maxAttendees: formData.maxAttendees ? parseInt(formData.maxAttendees) : null,
        track: formData.track || null, // Convert empty string to null (deprecated)
        programIds: formData.programIds, // New program association
      };

      const url = isEditing 
        ? `/api/admin/discover/events/${event.id}`
        : '/api/admin/discover/events';
      
      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save event');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving event:', err);
      alert(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const addBulletPoint = () => {
    setFormData(prev => ({ ...prev, bulletPoints: [...prev.bulletPoints, ''] }));
  };

  const removeBulletPoint = (index: number) => {
    setFormData(prev => ({
      ...prev,
      bulletPoints: prev.bulletPoints.filter((_, i) => i !== index),
    }));
  };

  const updateBulletPoint = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      bulletPoints: prev.bulletPoints.map((bp, i) => i === index ? value : bp),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl shadow-black/10 dark:shadow-black/30 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {isEditing ? 'Edit Event' : 'Create Event'}
            </h2>
          </div>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
              />
            </div>

            {/* Cover Image */}
            <MediaUpload
              value={formData.coverImageUrl}
              onChange={(url) => setFormData(prev => ({ ...prev, coverImageUrl: url }))}
              folder="events"
              type="image"
              label="Cover Image"
              required
              uploadEndpoint={uploadEndpoint}
            />

            {/* Date & Time Row */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Start Time *</label>
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">End Time *</label>
                <input
                  type="time"
                  required
                  value={formData.endTime}
                  onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Timezone *</label>
                <select
                  value={formData.timezone}
                  onChange={e => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                >
                  <option value="CET">CET</option>
                  <option value="EST">EST</option>
                  <option value="PST">PST</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>

            {/* Location Type & Label */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Location Type *</label>
                <select
                  value={formData.locationType}
                  onChange={e => setFormData(prev => ({ ...prev, locationType: e.target.value as 'online' | 'in_person' }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                >
                  <option value="online">Online</option>
                  <option value="in_person">In Person</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Location Label *</label>
                <input
                  type="text"
                  required
                  value={formData.locationLabel}
                  onChange={e => setFormData(prev => ({ ...prev, locationLabel: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                  placeholder="Online via Zoom or City, Country"
                />
              </div>
            </div>

            {/* Short Description */}
            <RichTextEditor
              value={formData.shortDescription}
              onChange={(shortDescription) => setFormData(prev => ({ ...prev, shortDescription }))}
              label="Short Description"
              required
              rows={3}
              placeholder="Brief summary of the event..."
              showMediaToolbar={false}
              mediaFolder="events"
              uploadEndpoint={uploadEndpoint}
            />

            {/* Long Description with Multimedia Support */}
            <RichTextEditor
              value={formData.longDescription}
              onChange={(longDescription) => setFormData(prev => ({ ...prev, longDescription }))}
              label="Long Description"
              rows={6}
              placeholder="Detailed event description. Use formatting and add images/videos to make it engaging..."
              showMediaToolbar={true}
              mediaFolder="events"
              uploadEndpoint={uploadEndpoint}
            />

            {/* Bullet Points */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Bullet Points</label>
              <div className="space-y-2">
                {formData.bulletPoints.map((bp, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={bp}
                      onChange={e => updateBulletPoint(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                      placeholder="What attendees will learn..."
                    />
                    <button
                      type="button"
                      onClick={() => removeBulletPoint(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBulletPoint}
                  className="text-sm text-[#a07855] hover:text-[#8c6245] font-albert"
                >
                  + Add bullet point
                </button>
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Event Type</label>
                <input
                  type="text"
                  value={formData.additionalInfo.type}
                  onChange={e => setFormData(prev => ({ ...prev, additionalInfo: { ...prev.additionalInfo, type: e.target.value } }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                  placeholder="Live workshop + Q&A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Language</label>
                <input
                  type="text"
                  value={formData.additionalInfo.language}
                  onChange={e => setFormData(prev => ({ ...prev, additionalInfo: { ...prev.additionalInfo, language: e.target.value } }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Difficulty</label>
                <input
                  type="text"
                  value={formData.additionalInfo.difficulty}
                  onChange={e => setFormData(prev => ({ ...prev, additionalInfo: { ...prev.additionalInfo, difficulty: e.target.value } }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                />
              </div>
            </div>

            {/* Host Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Host Name *</label>
                <input
                  type="text"
                  required
                  value={formData.hostName}
                  onChange={e => setFormData(prev => ({ ...prev, hostName: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Host Avatar URL</label>
                <input
                  type="url"
                  value={formData.hostAvatarUrl}
                  onChange={e => setFormData(prev => ({ ...prev, hostAvatarUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Zoom Link & Recording URL */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Zoom/Meeting Link</label>
                <input
                  type="url"
                  value={formData.zoomLink}
                  onChange={e => setFormData(prev => ({ ...prev, zoomLink: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                  placeholder="https://zoom.us/j/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Recording URL (for past events)</label>
                <input
                  type="url"
                  value={formData.recordingUrl}
                  onChange={e => setFormData(prev => ({ ...prev, recordingUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Max Attendees */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1 font-albert">Max Attendees</label>
                <input
                  type="number"
                  value={formData.maxAttendees}
                  onChange={e => setFormData(prev => ({ ...prev, maxAttendees: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]"
                  placeholder="Leave empty for unlimited"
                />
              </div>
              <div />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                placeholder="e.g., Habits, Productivity"
              />
            </div>

            {/* Programs (replaces Track) */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 font-albert">
                Programs
              </label>
              <ProgramSelector
                value={formData.programIds}
                onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
                placeholder="Select programs for this event..."
              />
            </div>

            {/* Featured */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <BrandedCheckbox
                  checked={formData.featured}
                  onChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
                />
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Featured Event</span>
              </label>
            </div>
          </div>

          <div className="p-6 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5 font-albert"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#a07855] hover:bg-[#8c6245] text-white font-albert"
            >
              {saving ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AdminEventsSectionProps {
  apiEndpoint?: string;
}

export function AdminEventsSection({ apiEndpoint = '/api/admin/discover/events' }: AdminEventsSectionProps) {
  const [events, setEvents] = useState<DiscoverEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [eventToEdit, setEventToEdit] = useState<DiscoverEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<DiscoverEvent | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derive upload endpoint from API endpoint - use coach upload for coach routes
  const uploadEndpoint = apiEndpoint.includes('/coach/') 
    ? '/api/coach/org-upload-media' 
    : '/api/admin/upload-media';

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch events');
      }
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEvents = useMemo(() => {
    let filtered = events;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.hostName.toLowerCase().includes(query)
      );
    }
    
    if (trackFilter) {
      if (trackFilter === 'none') {
        filtered = filtered.filter(event => !event.track);
      } else {
        filtered = filtered.filter(event => event.track === trackFilter);
      }
    }
    
    return filtered;
  }, [events, searchQuery, trackFilter]);

  const handleDelete = async () => {
    if (!eventToDelete) return;
    
    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/admin/discover/events/${eventToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event');
      }
      
      await fetchEvents();
      setEventToDelete(null);
    } catch (err) {
      console.error('Error deleting event:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          <div className="h-10 w-28 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
              <div className="w-16 h-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-4 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-4 w-40 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
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
          <Button onClick={fetchEvents} className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Events</h2>
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mt-1">
                {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-64 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-sm"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Track Filter */}
              <select
                value={trackFilter}
                onChange={e => setTrackFilter(e.target.value)}
                className="px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]"
              >
                <option value="">All Tracks</option>
                <option value="none">No Track</option>
                {TRACK_OPTIONS.filter(t => t.value).map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              
              <Button
                onClick={() => { setEventToEdit(null); setIsFormOpen(true); }}
                className="bg-[#a07855] hover:bg-[#8c6245] text-white font-albert"
              >
                + Create Event
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-albert">Title</TableHead>
                <TableHead className="font-albert">Date</TableHead>
                <TableHead className="font-albert">Time</TableHead>
                <TableHead className="font-albert">Location</TableHead>
                <TableHead className="font-albert">Host</TableHead>
                <TableHead className="font-albert">Track</TableHead>
                <TableHead className="font-albert">Featured</TableHead>
                <TableHead className="font-albert text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map(event => (
                <TableRow key={event.id}>
                  <TableCell className="font-albert font-medium max-w-[200px] truncate">
                    {event.title}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {formatDate(event.date)}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {event.startTime}–{event.endTime} {event.timezone}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {event.locationLabel}
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {event.hostName}
                  </TableCell>
                  <TableCell>
                    {event.track ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 font-albert">
                        {getTrackDisplayName(event.track)}
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-albert">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {event.featured ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 font-albert">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Featured
                      </span>
                    ) : (
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] text-sm font-albert">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEventToEdit(event); setIsFormOpen(true); }}
                        className="text-[#a07855] hover:text-[#8c6245] hover:bg-[#a07855]/10 font-albert"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEventToDelete(event)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 font-albert"
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

        {filteredEvents.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert">No events found</p>
          </div>
        )}
      </div>

      {/* Event Form Dialog */}
      <EventFormDialog
        event={eventToEdit}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEventToEdit(null); }}
        onSave={fetchEvents}
        uploadEndpoint={uploadEndpoint}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!eventToDelete} onOpenChange={open => !open && setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Delete Event</AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              Are you sure you want to delete &quot;<strong>{eventToDelete?.title}</strong>&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} className="font-albert">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

