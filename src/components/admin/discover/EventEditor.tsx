'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import type { DiscoverEvent } from '@/types/discover';
import type { RecurrenceFrequency } from '@/types';
import { Button } from '@/components/ui/button';
import { MediaUpload } from '@/components/admin/MediaUpload';
import { getDefaultPricingData, type ContentPricingData, ContentPricingFields } from '@/components/admin/ContentPricingFields';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { MeetingProviderSelector, type MeetingProviderType } from '@/components/scheduling/MeetingProviderSelector';
import { useCoachIntegrations } from '@/hooks/useCoachIntegrations';
import { PastEventEditor } from './PastEventEditor';
import { DatePicker } from '@/components/ui/date-picker';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  ExternalLink,
  Settings2,
  Trash2,
  Plus,
  X,
  Copy,
  Check,
  Video,
  DollarSign,
  Repeat,
  Sparkles,
  Globe,
  Star,
  ChevronDown,
  Loader2,
  Link as LinkIcon,
  Bold,
  Italic,
  List,
  ListOrdered,
  Image as ImageIcon,
} from 'lucide-react';

// Common timezones
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC' },
];

// Recurrence options
const RECURRENCE_OPTIONS: { value: RecurrenceFrequency | 'none'; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

const DAY_NAMES_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

// Coach type
interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
}

// Attendee with profile info
interface AttendeeProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}

// Helper functions
function formatTime12Hour(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

function getDayOfWeekFromDate(dateStr: string): number {
  if (!dateStr) return 1;
  const date = new Date(dateStr + 'T12:00:00');
  return date.getDay();
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime) return '';
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// Inline TipTap description editor - truly inline like title, always-visible formatting
function InlineDescriptionEditor({
  value,
  onChange,
  placeholder = 'Add a description...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none font-albert text-[#1a1a1a] dark:text-[#f5f5f8] min-h-[60px] prose prose-sm dark:prose-invert max-w-none [&_.is-editor-empty:first-child::before]:text-[#a7a39e] [&_.is-editor-empty:first-child::before]:dark:text-[#5f6470] [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:pointer-events-none',
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  const buttonClass = (isActive: boolean) =>
    `p-1.5 rounded transition-colors ${
      isActive
        ? 'bg-brand-accent text-white'
        : 'text-[#9a958f] dark:text-[#6b7280] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
    }`;

  return (
    <div>
      {/* Always-visible formatting toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 mb-3">
        {/* Text formatting */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBold().run();
          }}
          className={buttonClass(editor.isActive('bold'))}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleItalic().run();
          }}
          className={buttonClass(editor.isActive('italic'))}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleStrike().run();
          }}
          className={buttonClass(editor.isActive('strike'))}
          title="Strikethrough"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 12h18v2H3v-2zm6-7h6v3H9V5zm0 14h6v-3H9v3z" />
          </svg>
        </button>

        <div className="w-px h-4 bg-[#e8e4df] dark:bg-[#3a3f4b] mx-1" />

        {/* Headings */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 2 }).run();
          }}
          className={buttonClass(editor.isActive('heading', { level: 2 }))}
          title="Heading 2"
        >
          <span className="font-bold text-xs font-albert">H2</span>
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 3 }).run();
          }}
          className={buttonClass(editor.isActive('heading', { level: 3 }))}
          title="Heading 3"
        >
          <span className="font-bold text-xs font-albert">H3</span>
        </button>

        <div className="w-px h-4 bg-[#e8e4df] dark:bg-[#3a3f4b] mx-1" />

        {/* Lists */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBulletList().run();
          }}
          className={buttonClass(editor.isActive('bulletList'))}
          title="Bullet list"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleOrderedList().run();
          }}
          className={buttonClass(editor.isActive('orderedList'))}
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-[#e8e4df] dark:bg-[#3a3f4b] mx-1" />

        {/* Quote */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBlockquote().run();
          }}
          className={buttonClass(editor.isActive('blockquote'))}
          title="Blockquote"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      </div>
      {/* Editor content - truly inline, no box */}
      <EditorContent editor={editor} />
    </div>
  );
}

export interface EventEditorProps {
  event: DiscoverEvent | null;
  onClose: () => void;
  onSave: () => void;
  uploadEndpoint: string;
  programsApiEndpoint: string;
  apiEndpoint: string;
}

export function EventEditor({
  event,
  onClose,
  onSave,
  uploadEndpoint,
  programsApiEndpoint,
  apiEndpoint,
}: EventEditorProps) {
  const isEditing = !!event;

  // All hooks must be called before any conditional returns (Rules of Hooks)
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [attendeeProfiles, setAttendeeProfiles] = useState<AttendeeProfile[]>([]);

  // Get coach integrations for meeting auto-creation
  const { zoom, googleMeet } = useCoachIntegrations();

  // Derive API context
  const isCoachContext = apiEndpoint.includes('/coach/');
  const coachesApiEndpoint = '/api/coach/org-coaches';

  const [formData, setFormData] = useState({
    title: '',
    coverImageUrl: '',
    date: '',
    time: '10:00',
    durationMinutes: 60,
    timezone: 'America/New_York',
    meetingProvider: 'zoom' as MeetingProviderType,
    manualMeetingLink: '',
    locationType: 'online' as 'online' | 'in_person',
    locationLabel: '',
    description: '',
    bulletPoints: [''],
    additionalInfo: { type: '', language: 'English', difficulty: 'All levels' },
    hostUserId: '',
    hostName: '',
    hostAvatarUrl: '',
    featured: false,
    category: '',
    programIds: [] as string[],
    maxAttendees: '',
    recurrence: 'none' as RecurrenceFrequency | 'none',
    recurrenceDayOfWeek: 1,
    recurrenceEndDate: '',
    pricing: getDefaultPricingData() as ContentPricingData,
    attendeeIds: [] as string[],
  });

  // Check if this is a past event (event date + end time has passed)
  const isPastEvent = useMemo(() => {
    if (!event?.date) return false;
    // Create date from event date and end time (or start time if no end time)
    const eventTime = event.endTime || event.startTime || '23:59';
    const eventDateTime = new Date(`${event.date}T${eventTime}`);
    return eventDateTime < new Date();
  }, [event?.date, event?.endTime, event?.startTime]);

  // Fetch coaches on mount
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const response = await fetch(coachesApiEndpoint);
        if (response.ok) {
          const data = await response.json();
          setCoaches(data.coaches || []);
        }
      } catch (error) {
        console.error('Failed to fetch coaches:', error);
      } finally {
        setLoadingCoaches(false);
      }
    };
    fetchCoaches();
  }, [coachesApiEndpoint]);

  // Fetch attendee profiles when event has attendees
  useEffect(() => {
    const fetchAttendeeProfiles = async () => {
      if (!event?.attendeeIds?.length) {
        setAttendeeProfiles([]);
        return;
      }

      try {
        // Fetch user profiles for attendees
        const response = await fetch('/api/users/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: event.attendeeIds.slice(0, 20) }),
        });

        if (response.ok) {
          const data = await response.json();
          setAttendeeProfiles(data.users || []);
        } else {
          // Fallback: create placeholder profiles
          setAttendeeProfiles(event.attendeeIds.slice(0, 20).map((id, i) => ({
            id,
            firstName: `User`,
            lastName: `${i + 1}`,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch attendee profiles:', error);
        // Fallback: create placeholder profiles
        setAttendeeProfiles(event.attendeeIds.slice(0, 20).map((id, i) => ({
          id,
          firstName: `User`,
          lastName: `${i + 1}`,
        })));
      }
    };

    fetchAttendeeProfiles();
  }, [event?.attendeeIds]);

  // Auto-sync recurrence day when date changes
  useEffect(() => {
    if (formData.date && (formData.recurrence === 'weekly' || formData.recurrence === 'biweekly')) {
      setFormData(prev => ({ ...prev, recurrenceDayOfWeek: getDayOfWeekFromDate(prev.date) }));
    }
  }, [formData.date, formData.recurrence]);

  // Initialize form data from event
  useEffect(() => {
    if (event) {
      const startTime = event.startTime || '10:00';
      const endTime = event.endTime || '11:00';
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const durationMinutes = ((endH * 60 + endM) - (startH * 60 + startM)) || 60;

      let meetingProvider: MeetingProviderType = 'manual';
      const label = (event.locationLabel || '').toLowerCase();
      if (label.includes('zoom')) meetingProvider = 'zoom';
      else if (label.includes('google') || label.includes('meet')) meetingProvider = 'google_meet';

      setFormData({
        title: event.title || '',
        coverImageUrl: event.coverImageUrl || '',
        date: event.date || '',
        time: startTime,
        durationMinutes,
        timezone: event.timezone || 'America/New_York',
        meetingProvider,
        manualMeetingLink: event.meetingLink || event.zoomLink || '',
        locationType: event.locationType || 'online',
        locationLabel: event.locationLabel || '',
        description: event.longDescription || event.shortDescription || '',
        bulletPoints: event.bulletPoints?.length ? event.bulletPoints : [''],
        additionalInfo: event.additionalInfo || { type: '', language: 'English', difficulty: 'All levels' },
        hostUserId: '',
        hostName: event.hostName || '',
        hostAvatarUrl: event.hostAvatarUrl || '',
        featured: event.featured || false,
        category: event.category || '',
        programIds: event.programIds || [],
        maxAttendees: event.maxAttendees?.toString() || '',
        recurrence: 'none',
        recurrenceDayOfWeek: 1,
        recurrenceEndDate: '',
        pricing: {
          priceInCents: event.priceInCents ?? null,
          currency: event.currency || 'USD',
          purchaseType: event.purchaseType || 'popup',
          isPublic: event.isPublic !== false,
        },
        attendeeIds: event.attendeeIds || [],
      });
    } else {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setFormData({
        title: '',
        coverImageUrl: '',
        date: nextWeek.toISOString().split('T')[0],
        time: '10:00',
        durationMinutes: 60,
        timezone: 'America/New_York',
        meetingProvider: 'zoom',
        manualMeetingLink: '',
        locationType: 'online',
        locationLabel: '',
        description: '',
        bulletPoints: [''],
        additionalInfo: { type: '', language: 'English', difficulty: 'All levels' },
        hostUserId: '',
        hostName: '',
        hostAvatarUrl: '',
        featured: false,
        category: '',
        programIds: [],
        maxAttendees: '',
        recurrence: 'none',
        recurrenceDayOfWeek: 1,
        recurrenceEndDate: '',
        pricing: getDefaultPricingData(),
        attendeeIds: [],
      });
    }
  }, [event]);

  // For past events being edited, render simplified PastEventEditor
  // This must come after all hooks to comply with Rules of Hooks
  if (isPastEvent && isEditing && event) {
    return (
      <PastEventEditor
        event={event}
        onClose={onClose}
        onSave={onSave}
        apiEndpoint={apiEndpoint}
      />
    );
  }

  // Get location label from meeting provider
  const getLocationLabel = (): string => {
    switch (formData.meetingProvider) {
      case 'zoom': return 'Zoom';
      case 'google_meet': return 'Google Meet';
      case 'manual': return 'Online';
      default: return 'Online';
    }
  };

  // Get recurrence summary
  const getRecurrenceSummary = (): string => {
    if (formData.recurrence === 'none') return '';
    const timeStr = formatTime12Hour(formData.time);
    const dayName = DAY_NAMES_PLURAL[formData.recurrenceDayOfWeek];
    switch (formData.recurrence) {
      case 'daily': return `Repeats daily at ${timeStr}`;
      case 'weekly': return `Repeats ${dayName} at ${timeStr}`;
      case 'biweekly': return `Repeats every 2 weeks on ${dayName} at ${timeStr}`;
      case 'monthly': return `Repeats monthly at ${timeStr}`;
      default: return '';
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }

    setSaving(true);

    try {
      const selectedHost = coaches.find(c => c.id === formData.hostUserId);

      let finalMeetingLink = formData.manualMeetingLink || null;
      let externalMeetingId: string | null = null;

      // Auto-create Zoom meeting if connected (only for new events)
      if (formData.meetingProvider === 'zoom' && zoom.connected && !isEditing) {
        try {
          const startDateTime = `${formData.date}T${formData.time}:00`;
          const zoomResponse = await fetch('/api/coach/integrations/zoom/meetings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: formData.title,
              startTime: startDateTime,
              duration: formData.durationMinutes,
              timezone: formData.timezone,
            }),
          });
          if (zoomResponse.ok) {
            const zoomData = await zoomResponse.json();
            finalMeetingLink = zoomData.meetingUrl || zoomData.join_url;
            externalMeetingId = zoomData.meetingId?.toString() || zoomData.id?.toString();
          }
        } catch (err) {
          console.error('Failed to create Zoom meeting:', err);
        }
      }

      // Auto-create Google Meet if connected (only for new events)
      if (formData.meetingProvider === 'google_meet' && googleMeet.connected && !isEditing) {
        try {
          const startDateTime = `${formData.date}T${formData.time}:00`;
          const endTime = calculateEndTime(formData.time, formData.durationMinutes);
          const endDateTime = `${formData.date}T${endTime}:00`;
          const meetResponse = await fetch('/api/coach/integrations/google_meet/meetings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: formData.title,
              startTime: startDateTime,
              endTime: endDateTime,
              timezone: formData.timezone,
              description: formData.description,
            }),
          });
          if (meetResponse.ok) {
            const meetData = await meetResponse.json();
            finalMeetingLink = meetData.meetingUrl;
            externalMeetingId = meetData.eventId;
          }
        } catch (err) {
          console.error('Failed to create Google Meet:', err);
        }
      }

      const payload = {
        title: formData.title,
        coverImageUrl: formData.coverImageUrl || null,
        date: formData.date,
        startTime: formData.time,
        endTime: calculateEndTime(formData.time, formData.durationMinutes),
        timezone: formData.timezone,
        durationMinutes: formData.durationMinutes,
        locationType: formData.locationType,
        locationLabel: formData.locationLabel || getLocationLabel(),
        meetingLink: finalMeetingLink,
        meetingProvider: formData.meetingProvider,
        externalMeetingId,
        shortDescription: formData.description.substring(0, 200),
        longDescription: formData.description,
        bulletPoints: formData.bulletPoints.filter(bp => bp.trim()),
        additionalInfo: formData.additionalInfo,
        hostUserId: formData.hostUserId || null,
        hostName: selectedHost ? `${selectedHost.firstName} ${selectedHost.lastName}`.trim() : formData.hostName,
        hostAvatarUrl: selectedHost?.imageUrl || formData.hostAvatarUrl || null,
        featured: formData.featured,
        category: formData.category || null,
        programIds: formData.programIds,
        maxAttendees: formData.maxAttendees ? parseInt(formData.maxAttendees) : null,
        isRecurring: formData.recurrence !== 'none',
        recurrence: formData.recurrence !== 'none' ? {
          frequency: formData.recurrence,
          dayOfWeek: (formData.recurrence === 'weekly' || formData.recurrence === 'biweekly')
            ? formData.recurrenceDayOfWeek : undefined,
          time: formData.time,
          timezone: formData.timezone,
          startDate: formData.date,
          endDate: formData.recurrenceEndDate || undefined,
        } : null,
        priceInCents: formData.pricing.priceInCents,
        currency: formData.pricing.currency,
        purchaseType: formData.pricing.purchaseType,
        isPublic: formData.pricing.isPublic,
      };

      const url = isEditing ? `${apiEndpoint}/${event!.id}` : apiEndpoint;
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

  const handleDelete = async () => {
    if (!event) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}/${event.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error deleting event:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
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

  const copyMeetingLink = () => {
    const link = formData.manualMeetingLink;
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const isFree = !formData.pricing.priceInCents || formData.pricing.priceInCents === 0;
  const meetingLink = formData.manualMeetingLink || event?.meetingLink || event?.zoomLink;

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#faf8f6] dark:bg-[#0d0f14]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6]/80 dark:bg-[#0d0f14]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
              {formData.title || 'New Event'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Event Type Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              <Globe className="w-3.5 h-3.5" />
              Community Event
            </span>

            {/* External Link (only for existing events) */}
            {isEditing && event && (
              <a
                href={`/discover/events/${event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors"
                title="View event page"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            )}

            {/* Settings Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-white hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                >
                  <Settings2 className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => setFormData(prev => ({ ...prev, featured: !prev.featured }))}
                  className="flex items-center gap-2"
                >
                  <Star className={`w-4 h-4 ${formData.featured ? 'fill-amber-400 text-amber-400' : ''}`} />
                  <span>{formData.featured ? 'Unmark as Featured' : 'Mark as Featured'}</span>
                </DropdownMenuItem>
                {isEditing && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Event
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Save Button */}
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Left Column - Main Content */}
            <div className="flex-1 space-y-6">

              {/* Hero Section - Cover Image + Title + Description */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
                {/* Cover Image */}
                <div className="relative aspect-[16/7] bg-gradient-to-br from-[#f3f1ef] to-[#e8e4df] dark:from-[#1e222a] dark:to-[#262b35] group">
                  {formData.coverImageUrl ? (
                    <>
                      <Image
                        src={formData.coverImageUrl}
                        alt={formData.title || 'Event cover'}
                        fill
                        className="object-cover"
                      />
                      {/* Subtle gradient overlay for better button visibility */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-[#8a8580] dark:text-[#6b7280]" />
                      </div>
                      <span className="text-sm text-[#8a8580] dark:text-[#6b7280] font-medium">Add a cover image</span>
                    </div>
                  )}

                  {/* Top-right action buttons */}
                  <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          // Create form data and upload
                          const uploadFormData = new FormData();
                          uploadFormData.append('file', file);
                          uploadFormData.append('folder', 'events');

                          try {
                            const response = await fetch(uploadEndpoint, {
                              method: 'POST',
                              body: uploadFormData,
                            });
                            const data = await response.json();
                            if (data.url) {
                              setFormData(prev => ({ ...prev, coverImageUrl: data.url }));
                            }
                          } catch (error) {
                            console.error('Upload failed:', error);
                          }
                        }}
                      />
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/90 dark:bg-[#1e222a]/90 text-[#1a1a1a] dark:text-[#f5f5f8] backdrop-blur-sm shadow-sm hover:bg-white dark:hover:bg-[#1e222a] transition-colors cursor-pointer">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {formData.coverImageUrl ? 'Change' : 'Upload'}
                      </span>
                    </label>
                    {formData.coverImageUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, coverImageUrl: '' }))}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/90 dark:bg-[#1e222a]/90 text-[#5f5a55] dark:text-[#b2b6c2] backdrop-blur-sm shadow-sm hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Badges - bottom left */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    {formData.featured && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100/90 text-amber-700 backdrop-blur-sm">
                        <Star className="w-3 h-3 fill-current" />
                        Featured
                      </span>
                    )}
                    {formData.recurrence !== 'none' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100/90 text-blue-700 backdrop-blur-sm">
                        <Repeat className="w-3 h-3" />
                        Recurring
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Description - Inline Editable */}
                <div className="p-6">
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Event title..."
                    className="w-full text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert bg-transparent border-0 outline-none placeholder:text-[#a7a39e] dark:placeholder:text-[#5f6470] focus:ring-0"
                  />
                  <div className="mt-4">
                    <InlineDescriptionEditor
                      value={formData.description}
                      onChange={(description) => setFormData(prev => ({ ...prev, description }))}
                      placeholder="Add a description..."
                    />
                  </div>
                </div>
              </div>

              {/* Schedule Section */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Schedule</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Date</label>
                    <DatePicker
                      value={formData.date}
                      onChange={(date) => setFormData(prev => ({ ...prev, date }))}
                      minDate={new Date()}
                      placeholder="Select date"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Time</label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Duration</label>
                    <Select
                      value={formData.durationMinutes.toString()}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, durationMinutes: parseInt(value) }))}
                    >
                      <SelectTrigger className="w-full px-3 py-2.5 h-auto border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-xl focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="180">3 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Timezone</label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
                    >
                      <SelectTrigger className="w-full px-3 py-2.5 h-auto border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-xl focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_TIMEZONES.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Repeat</label>
                    <Select
                      value={formData.recurrence}
                      onValueChange={(value) => {
                        const newValue = value as RecurrenceFrequency | 'none';
                        setFormData(prev => ({
                          ...prev,
                          recurrence: newValue,
                          recurrenceDayOfWeek: (newValue === 'weekly' || newValue === 'biweekly') && prev.date
                            ? getDayOfWeekFromDate(prev.date)
                            : prev.recurrenceDayOfWeek
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full px-3 py-2.5 h-auto border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-xl focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRENCE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.recurrence !== 'none' && (
                  <div className="mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-albert flex items-center gap-2">
                      <Repeat className="w-4 h-4" />
                      {getRecurrenceSummary()}
                    </p>
                  </div>
                )}

                {formData.date && (
                  <p className="mt-3 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    {formatDateDisplay(formData.date)} at {formatTime12Hour(formData.time)} – {formatTime12Hour(calculateEndTime(formData.time, formData.durationMinutes))}
                  </p>
                )}
              </div>

              {/* Location Section */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Video className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Location</h3>
                </div>

                <MeetingProviderSelector
                  allowInApp={false}
                  value={formData.meetingProvider}
                  onChange={(provider) => setFormData(prev => ({ ...prev, meetingProvider: provider }))}
                  manualLink={formData.manualMeetingLink}
                  onManualLinkChange={(link) => setFormData(prev => ({ ...prev, manualMeetingLink: link }))}
                  savedMeetingLink={meetingLink}
                />

                {/* Show meeting link on mobile only (desktop shows in sidebar) */}
                {meetingLink && (
                  <div className="lg:hidden mt-4 flex items-center gap-2 p-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]">
                    <LinkIcon className="w-4 h-4 text-brand-accent flex-shrink-0" />
                    <a
                      href={meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-sm text-brand-accent font-albert truncate hover:underline"
                    >
                      {meetingLink}
                    </a>
                    <button
                      onClick={copyMeetingLink}
                      className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors"
                      title="Copy link"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Pricing Section */}
              <ContentPricingFields
                value={formData.pricing}
                onChange={(pricing) => setFormData(prev => ({ ...prev, pricing }))}
              />

              {/* Key Takeaways Section */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Key Takeaways</h3>
                </div>

                <div className="space-y-2">
                  {formData.bulletPoints.map((bp, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-accent flex-shrink-0" />
                      <input
                        type="text"
                        value={bp}
                        onChange={(e) => updateBulletPoint(index, e.target.value)}
                        placeholder="What attendees will learn..."
                        className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                      />
                      <button
                        type="button"
                        onClick={() => removeBulletPoint(index)}
                        className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        disabled={formData.bulletPoints.length === 1}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addBulletPoint}
                    className="flex items-center gap-2 text-sm text-brand-accent hover:text-brand-accent/80 font-albert font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add takeaway
                  </button>
                </div>
              </div>

              {/* Additional Info (Collapsed) */}
              <details className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden group">
                <summary className="flex items-center gap-2 p-6 cursor-pointer list-none">
                  <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] group-open:rotate-180 transition-transform" />
                  <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Additional Details</span>
                </summary>
                <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">Event Type</label>
                    <input
                      type="text"
                      value={formData.additionalInfo.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: { ...prev.additionalInfo, type: e.target.value } }))}
                      placeholder="Live workshop"
                      className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">Language</label>
                    <input
                      type="text"
                      value={formData.additionalInfo.language}
                      onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: { ...prev.additionalInfo, language: e.target.value } }))}
                      className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">Difficulty</label>
                    <input
                      type="text"
                      value={formData.additionalInfo.difficulty}
                      onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: { ...prev.additionalInfo, difficulty: e.target.value } }))}
                      className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]"
                    />
                  </div>
                </div>
              </details>
            </div>

            {/* Right Sidebar */}
            <div className="lg:w-[340px] xl:w-96 space-y-6 flex-shrink-0">

              {/* Event Link Section - Desktop only, shows when link exists */}
              {meetingLink && (
                <div className="hidden lg:block bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-5">
                  <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">Event Link</h3>
                  <div className="flex items-center gap-2 p-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl">
                    <LinkIcon className="w-4 h-4 text-brand-accent flex-shrink-0" />
                    <a
                      href={meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-sm text-brand-accent font-albert truncate hover:underline"
                    >
                      {meetingLink}
                    </a>
                    <button
                      onClick={copyMeetingLink}
                      className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors"
                      title="Copy link"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Host Section */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-5">
                <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">Host</h3>

                {/* Show current host if set */}
                {(formData.hostName || formData.hostAvatarUrl) && (
                  <div className="flex items-center gap-3 mb-4 p-3 bg-[#f9f7f5] dark:bg-[#1c2028] rounded-xl">
                    {formData.hostAvatarUrl ? (
                      <img src={formData.hostAvatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-brand-accent/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-brand-accent">
                          {(formData.hostName || '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || 'H'}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{formData.hostName}</p>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Event Host</p>
                    </div>
                  </div>
                )}

                <Select
                  value={formData.hostUserId || undefined}
                  onValueChange={(value) => {
                    const coach = coaches.find(c => c.id === value);
                    setFormData(prev => ({
                      ...prev,
                      hostUserId: value,
                      hostName: coach ? `${coach.firstName} ${coach.lastName}`.trim() : '',
                      hostAvatarUrl: coach?.imageUrl || '',
                    }));
                  }}
                  disabled={loadingCoaches}
                >
                  <SelectTrigger className="w-full px-3 py-2.5 h-auto border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-xl focus:ring-2 focus:ring-brand-accent font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                    <SelectValue placeholder={loadingCoaches ? 'Loading...' : 'Change host...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {coaches.map(coach => (
                      <SelectItem key={coach.id} value={coach.id}>
                        <div className="flex items-center gap-2">
                          {coach.imageUrl && (
                            <img src={coach.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                          )}
                          {coach.firstName} {coach.lastName}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* RSVPs Section */}
              {isEditing && formData.attendeeIds.length > 0 && (
                <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">RSVPs</h3>
                    <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      {formData.attendeeIds.length} going
                      {formData.maxAttendees && ` / ${formData.maxAttendees}`}
                    </span>
                  </div>

                  {/* Attendee avatars grid */}
                  <div className="flex flex-wrap gap-2">
                    {attendeeProfiles.slice(0, 12).map((attendee, i) => (
                      <div
                        key={attendee.id}
                        className="relative group"
                        title={`${attendee.firstName || ''} ${attendee.lastName || ''}`.trim() || 'Attendee'}
                      >
                        {attendee.imageUrl ? (
                          <img
                            src={attendee.imageUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-[#171b22] shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-accent/30 to-brand-accent/50 border-2 border-white dark:border-[#171b22] shadow-sm flex items-center justify-center">
                            <span className="text-xs font-medium text-brand-accent">
                              {(attendee.firstName?.[0] || '') + (attendee.lastName?.[0] || '') || (i + 1)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {formData.attendeeIds.length > 12 && (
                      <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] border-2 border-white dark:border-[#171b22] flex items-center justify-center">
                        <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
                          +{formData.attendeeIds.length - 12}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Organization Section */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-5">
                <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">Organization</h3>

                <div className="space-y-4">
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Category</label>
                    <CategorySelector
                      value={formData.category}
                      onChange={(category) => setFormData(prev => ({ ...prev, category }))}
                      placeholder="Select category..."
                    />
                  </div>

                  {/* Programs */}
                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Programs</label>
                    <ProgramSelector
                      value={formData.programIds}
                      onChange={(programIds) => setFormData(prev => ({ ...prev, programIds }))}
                      placeholder="Select programs..."
                      programsApiEndpoint={programsApiEndpoint}
                    />
                  </div>

                  {/* Max Attendees */}
                  <div>
                    <label className="block text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 font-albert">Max Attendees</label>
                    <input
                      type="number"
                      value={formData.maxAttendees}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxAttendees: e.target.value }))}
                      placeholder="Unlimited"
                      className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8]"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert">Delete Event</AlertDialogTitle>
            <AlertDialogDescription className="font-albert">
              Are you sure you want to delete &quot;{event?.title}&quot;? This action cannot be undone.
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
    </div>
  );
}
