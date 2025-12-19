'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Calendar,
  MessageCircle,
  Target,
  ClipboardList,
  Plus,
  Trash2,
  Save,
  History,
  BookOpen,
  FileText,
  Clock,
  MapPin,
  X,
  Pencil,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { 
  ClientCoachingData, 
  FirebaseUser, 
  Coach,
  CoachingActionItem,
  CoachingSessionHistory,
  CoachingResource,
  CoachPrivateNotes,
} from '@/types';

// Common timezones for the dropdown
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

const LOCATION_PRESETS = ['Chat', 'Zoom', 'Google Meet', 'Microsoft Teams'];

interface CoachingClientViewProps {
  clientId: string;
  onBack: () => void;
}

/**
 * CoachingClientView
 * 
 * Detailed view of a coaching client for the coach to manage:
 * - Client info
 * - Schedule/edit next call
 * - Edit focus areas
 * - Edit action items
 * - Add session notes
 * - Create session history entries
 * - Add resources
 */
export function CoachingClientView({ clientId, onBack }: CoachingClientViewProps) {
  const router = useRouter();
  
  // Data states
  const [coachingData, setCoachingData] = useState<ClientCoachingData | null>(null);
  const [user, setUser] = useState<Partial<FirebaseUser> | null>(null);
  const [_coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit states
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<CoachingActionItem[]>([]);
  const [resources, setResources] = useState<CoachingResource[]>([]);
  const [privateNotes, setPrivateNotes] = useState<CoachPrivateNotes[]>([]);
  
  // New item inputs
  const [newFocusArea, setNewFocusArea] = useState('');
  const [newActionItem, setNewActionItem] = useState('');
  const [newResourceTitle, setNewResourceTitle] = useState('');
  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [newResourceDescription, setNewResourceDescription] = useState('');

  // Call scheduling modal
  const [showCallModal, setShowCallModal] = useState(false);
  const [callDate, setCallDate] = useState('');
  const [callTime, setCallTime] = useState('10:00');
  const [callTimezone, setCallTimezone] = useState('America/New_York');
  const [callLocation, setCallLocation] = useState('Chat');
  const [customLocation, setCustomLocation] = useState('');
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [schedulingCall, setSchedulingCall] = useState(false);

  // Session history modal
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionSummary, setSessionSummary] = useState('');
  const [sessionTakeaways, setSessionTakeaways] = useState<string[]>(['']);
  const [addingSession, setAddingSession] = useState(false);

  // Private notes modal
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [currentNotes, setCurrentNotes] = useState('');
  const [plannedTopics, setPlannedTopics] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchClientData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/coaching/clients/${clientId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch client data');
      }

      const data = await response.json();
      setCoachingData(data.data);
      setUser(data.user);
      setCoach(data.coach);

      // Initialize edit states
      if (data.data) {
        setFocusAreas(data.data.focusAreas || []);
        setActionItems(data.data.actionItems || []);
        setResources(data.data.resources || []);
        setPrivateNotes(data.data.privateNotes || []);
        
        // Initialize call modal with existing data
        if (data.data.nextCall?.datetime) {
          const callDateObj = new Date(data.data.nextCall.datetime);
          const tz = data.data.nextCall.timezone || 'America/New_York';
          
          // Format date in call's timezone
          const dateFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          setCallDate(dateFormatter.format(callDateObj));
          
          // Format time in call's timezone
          const timeFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          const timeParts = timeFormatter.formatToParts(callDateObj);
          const hour = timeParts.find(p => p.type === 'hour')?.value || '10';
          const minute = timeParts.find(p => p.type === 'minute')?.value || '00';
          setCallTime(`${hour}:${minute}`);
          
          setCallTimezone(tz);
          
          const loc = data.data.nextCall.location || 'Chat';
          if (LOCATION_PRESETS.includes(loc)) {
            setCallLocation(loc);
            setUseCustomLocation(false);
          } else {
            setUseCustomLocation(true);
            setCustomLocation(loc);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching client data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load client data');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  // Save focus areas and action items
  const handleSaveChanges = async () => {
    if (!coachingData) return;

    try {
      setSaving(true);

      const response = await fetch(`/api/coaching/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusAreas,
          actionItems,
          resources,
          privateNotes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      // Refresh data
      await fetchClientData();
    } catch (err) {
      console.error('Error saving changes:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Schedule or update call
  const handleScheduleCall = async () => {
    if (!callDate || !callTime) return;

    try {
      setSchedulingCall(true);

      // Construct the datetime in the selected timezone
      const [year, month, day] = callDate.split('-').map(Number);
      const [hours, minutes] = callTime.split(':').map(Number);
      const localDate = new Date(year, month - 1, day, hours, minutes);
      
      // Convert to UTC
      const dateInTz = new Date(localDate.toLocaleString('en-US', { timeZone: callTimezone }));
      const utcDate = new Date(localDate.getTime() - (dateInTz.getTime() - localDate.getTime()));

      const finalLocation = useCustomLocation ? customLocation.trim() : callLocation;

      const response = await fetch(`/api/coaching/clients/${clientId}/call`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateTime: utcDate.toISOString(),
          timezone: callTimezone,
          location: finalLocation,
          title: 'Coaching Call',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to schedule call');
      }

      setShowCallModal(false);
      await fetchClientData();
    } catch (err) {
      console.error('Error scheduling call:', err);
      setError(err instanceof Error ? err.message : 'Failed to schedule call');
    } finally {
      setSchedulingCall(false);
    }
  };

  // Delete scheduled call
  const handleDeleteCall = async () => {
    try {
      setSchedulingCall(true);

      const response = await fetch(`/api/coaching/clients/${clientId}/call`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove call');
      }

      setShowCallModal(false);
      await fetchClientData();
    } catch (err) {
      console.error('Error deleting call:', err);
    } finally {
      setSchedulingCall(false);
    }
  };

  // Add focus area
  const handleAddFocusArea = () => {
    if (newFocusArea.trim()) {
      setFocusAreas([...focusAreas, newFocusArea.trim()]);
      setNewFocusArea('');
    }
  };

  // Remove focus area
  const handleRemoveFocusArea = (index: number) => {
    setFocusAreas(focusAreas.filter((_, i) => i !== index));
  };

  // Add action item
  const handleAddActionItem = () => {
    if (newActionItem.trim()) {
      const now = new Date().toISOString();
      setActionItems([
        ...actionItems,
        {
          id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: newActionItem.trim(),
          completed: false,
          createdAt: now,
        },
      ]);
      setNewActionItem('');
    }
  };

  // Remove action item
  const handleRemoveActionItem = (id: string) => {
    setActionItems(actionItems.filter(item => item.id !== id));
  };

  // Add resource
  const handleAddResource = () => {
    if (newResourceTitle.trim() && newResourceUrl.trim()) {
      const now = new Date().toISOString();
      setResources([
        ...resources,
        {
          id: `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: newResourceTitle.trim(),
          url: newResourceUrl.trim(),
          description: newResourceDescription.trim() || undefined,
          createdAt: now,
        },
      ]);
      setNewResourceTitle('');
      setNewResourceUrl('');
      setNewResourceDescription('');
    }
  };

  // Remove resource
  const handleRemoveResource = (id: string) => {
    setResources(resources.filter(r => r.id !== id));
  };

  // Add session history entry
  const handleAddSession = async () => {
    if (!sessionTitle.trim() || !sessionDate) return;

    try {
      setAddingSession(true);
      const now = new Date().toISOString();

      const newSession: CoachingSessionHistory = {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: sessionDate,
        title: sessionTitle.trim(),
        summary: sessionSummary.trim(),
        takeaways: sessionTakeaways.filter(t => t.trim()),
        createdAt: now,
        updatedAt: now,
      };

      const updatedSessions = [...(coachingData?.sessionHistory || []), newSession];

      const response = await fetch(`/api/coaching/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionHistory: updatedSessions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add session');
      }

      setShowSessionModal(false);
      setSessionDate('');
      setSessionTitle('');
      setSessionSummary('');
      setSessionTakeaways(['']);
      await fetchClientData();
    } catch (err) {
      console.error('Error adding session:', err);
    } finally {
      setAddingSession(false);
    }
  };

  // Save private notes
  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true);
      const now = new Date().toISOString();

      // Find or create the general notes entry
      const updatedNotes = [...privateNotes];
      const generalNotesIndex = updatedNotes.findIndex(n => n.sessionId === 'general');
      
      if (generalNotesIndex >= 0) {
        updatedNotes[generalNotesIndex] = {
          ...updatedNotes[generalNotesIndex],
          notes: currentNotes,
          plannedTopics,
          updatedAt: now,
        };
      } else {
        updatedNotes.push({
          sessionId: 'general',
          notes: currentNotes,
          plannedTopics,
          tags: [],
          createdAt: now,
          updatedAt: now,
        });
      }

      const response = await fetch(`/api/coaching/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateNotes: updatedNotes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      setShowNotesModal(false);
      await fetchClientData();
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setSavingNotes(false);
    }
  };

  // Open notes modal with existing data
  const handleOpenNotesModal = () => {
    const generalNotes = privateNotes.find(n => n.sessionId === 'general');
    setCurrentNotes(generalNotes?.notes || '');
    setPlannedTopics(generalNotes?.plannedTopics || '');
    setShowNotesModal(true);
  };

  // Go to chat
  const handleGoToChat = () => {
    if (coachingData?.chatChannelId) {
      router.push(`/chat?channel=${coachingData.chatChannelId}`);
    }
  };

  // Format call time for display
  const formatCallTime = (datetime: string, timezone: string) => {
    try {
      const date = new Date(datetime);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      });
      return formatter.format(date);
    } catch {
      return new Date(datetime).toLocaleString();
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] font-albert">Loading client data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <p className="text-red-600 font-albert mb-4">{error}</p>
        <button
          onClick={fetchClientData}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-albert"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to clients
      </button>

      {/* Client Header */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar */}
          <div className="shrink-0">
            {user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={user.firstName || 'Client'}
                width={80}
                height={80}
                className="w-20 h-20 rounded-2xl object-cover"
                unoptimized
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#a07855] to-[#7d5c3e] flex items-center justify-center text-white text-2xl font-albert font-bold">
                {user?.firstName?.charAt(0) || 'C'}
              </div>
            )}
          </div>
          
          {/* Client Info */}
          <div className="flex-1">
            <h2 className="font-albert text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">{user?.email}</p>
            {user?.timezone && (
              <p className="font-albert text-sm text-[#8c8c8c] dark:text-[#7d8190] mt-1">
                Timezone: {user.timezone}
              </p>
            )}
            {coachingData?.coachingPlan && (
              <span className={`inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${
                coachingData.coachingPlan === 'quarterly' 
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              }`}>
                {coachingData.coachingPlan === 'monthly' ? 'Monthly Plan' : 'Quarterly Plan'}
              </span>
            )}
            
            {/* Client's Goal */}
            {user?.goal && (
              <div className="mt-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-1">
                  Current Goal
                </p>
                <p className="font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">{user.goal}</p>
                {user.goalProgress !== undefined && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#e1ddd8] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#a07855] rounded-full"
                        style={{ width: `${user.goalProgress}%` }}
                      />
                    </div>
                    <span className="font-albert text-xs text-[#5f5a55]">{user.goalProgress}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            {coachingData?.chatChannelId && (
              <button
                onClick={handleGoToChat}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#a07855] hover:bg-[#8c6245] rounded-full font-albert text-[14px] font-medium text-white transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Message
              </button>
            )}
            <button
              onClick={handleOpenNotesModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] dark:bg-[#11141b] hover:bg-[#e9e5e0] dark:hover:bg-[#171b22] rounded-full font-albert text-[14px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8] transition-colors"
            >
              <FileText className="w-4 h-4" />
              Private Notes
            </button>
          </div>
        </div>
      </div>

      {/* Next Call Card */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
            <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
              Next Call
            </h3>
          </div>
          <button
            onClick={() => setShowCallModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#a07855] dark:text-[#b8896a] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] rounded-full transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {coachingData?.nextCall?.datetime ? 'Edit' : 'Schedule'}
          </button>
        </div>

        {coachingData?.nextCall?.datetime ? (
          <div className="space-y-2">
            <p className="font-albert text-[15px] text-[#1a1a1a]">
              {formatCallTime(coachingData.nextCall.datetime, coachingData.nextCall.timezone)}
            </p>
            <p className="font-albert text-[14px] text-[#5f5a55]">
              Location: {coachingData.nextCall.location}
            </p>
          </div>
        ) : (
          <p className="font-albert text-[15px] text-[#8c8c8c] text-center py-4">
            No call scheduled yet.
          </p>
        )}
      </div>

      {/* Focus Areas */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
            Current Focus
          </h3>
        </div>

        <div className="space-y-2 mb-4">
          {focusAreas.map((focus, index) => (
            <div key={index} className="flex items-start gap-2 group">
              <span className="text-[#a07855] dark:text-[#b8896a] mt-0.5">–</span>
              <span className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] flex-1">{focus}</span>
              <button
                onClick={() => handleRemoveFocusArea(index)}
                className="p-1 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 rounded transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Focus Area */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newFocusArea}
            onChange={(e) => setNewFocusArea(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddFocusArea()}
            placeholder="Add focus area..."
            className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30"
          />
          <button
            onClick={handleAddFocusArea}
            disabled={!newFocusArea.trim()}
            className="px-3 py-2 bg-[#f3f1ef] dark:bg-[#11141b] hover:bg-[#e9e5e0] dark:hover:bg-[#171b22] rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
            Action Items
          </h3>
        </div>

        <div className="space-y-2 mb-4">
          {actionItems.map((item) => (
            <div key={item.id} className="flex items-start gap-2 group">
              <span className={`mt-0.5 ${item.completed ? 'text-[#a07855] dark:text-[#b8896a]' : 'text-[#c4bfb9] dark:text-[#7d8190]'}`}>
                {item.completed ? '✓' : '○'}
              </span>
              <span className={`font-albert text-[15px] flex-1 ${
                item.completed ? 'text-[#8c8c8c] dark:text-[#7d8190] line-through' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              }`}>
                {item.text}
              </span>
              <button
                onClick={() => handleRemoveActionItem(item.id)}
                className="p-1 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 rounded transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Action Item */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newActionItem}
            onChange={(e) => setNewActionItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddActionItem()}
            placeholder="Add action item..."
            className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30"
          />
          <button
            onClick={handleAddActionItem}
            disabled={!newActionItem.trim()}
            className="px-3 py-2 bg-[#f3f1ef] dark:bg-[#11141b] hover:bg-[#e9e5e0] dark:hover:bg-[#171b22] rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
        </div>
      </div>

      {/* Resources */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
            Resources
          </h3>
        </div>

        <div className="space-y-2 mb-4">
          {resources.map((resource) => (
            <div key={resource.id} className="flex items-start gap-2 group p-2 rounded-lg hover:bg-[#faf8f6] dark:hover:bg-[#11141b]">
              <div className="flex-1">
                <a 
                  href={resource.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-albert text-[15px] text-[#a07855] hover:underline"
                >
                  {resource.title}
                </a>
                {resource.description && (
                  <p className="font-albert text-[13px] text-[#8c8c8c] mt-0.5">{resource.description}</p>
                )}
              </div>
              <button
                onClick={() => handleRemoveResource(resource.id)}
                className="p-1 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 rounded transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Resource */}
        <div className="space-y-2 p-3 bg-[#faf8f6] rounded-xl">
          <input
            type="text"
            value={newResourceTitle}
            onChange={(e) => setNewResourceTitle(e.target.value)}
            placeholder="Resource title..."
            className="w-full px-3 py-2 border border-[#e1ddd8] rounded-lg font-albert text-[14px] placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30"
          />
          <input
            type="url"
            value={newResourceUrl}
            onChange={(e) => setNewResourceUrl(e.target.value)}
            placeholder="URL..."
            className="w-full px-3 py-2 border border-[#e1ddd8] rounded-lg font-albert text-[14px] placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30"
          />
          <input
            type="text"
            value={newResourceDescription}
            onChange={(e) => setNewResourceDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full px-3 py-2 border border-[#e1ddd8] rounded-lg font-albert text-[14px] placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30"
          />
          <button
            onClick={handleAddResource}
            disabled={!newResourceTitle.trim() || !newResourceUrl.trim()}
            className="w-full px-3 py-2 bg-[#a07855] hover:bg-[#8c6245] text-white rounded-lg font-albert text-[14px] font-medium transition-colors disabled:opacity-50"
          >
            Add Resource
          </button>
        </div>
      </div>

      {/* Session History */}
      <div className="bg-white/80 backdrop-blur-xl border border-[#e1ddd8]/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#a07855]" />
            <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] tracking-[-0.5px]">
              Session History
            </h3>
          </div>
          <button
            onClick={() => setShowSessionModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#a07855] hover:bg-[#f3f1ef] rounded-full transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Session
          </button>
        </div>

        {coachingData?.sessionHistory && coachingData.sessionHistory.length > 0 ? (
          <ul className="space-y-2">
            {coachingData.sessionHistory.slice().reverse().map((session) => (
              <li key={session.id} className="p-3 bg-[#faf8f6] rounded-xl">
                <p className="font-albert text-[15px] font-medium text-[#1a1a1a]">
                  {session.title}
                </p>
                <p className="font-albert text-[13px] text-[#8c8c8c]">
                  {new Date(session.date).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
                {session.summary && (
                  <p className="font-albert text-[14px] text-[#5f5a55] mt-2">{session.summary}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-albert text-[15px] text-[#8c8c8c] text-center py-4">
            No sessions recorded yet.
          </p>
        )}
      </div>

      {/* Save Changes Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveChanges}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#a07855] hover:bg-[#8c6245] rounded-full font-albert text-[15px] font-medium text-white transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Call Scheduling Modal */}
      <AlertDialog open={showCallModal} onOpenChange={setShowCallModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center justify-between">
              <AlertDialogTitle className="font-albert text-[20px] tracking-[-0.5px] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#a07855]" />
                {coachingData?.nextCall?.datetime ? 'Edit Call' : 'Schedule Call'}
              </AlertDialogTitle>
              <button
                onClick={() => setShowCallModal(false)}
                className="p-1.5 rounded-full hover:bg-[#f3f1ef] transition-colors"
              >
                <X className="w-5 h-5 text-[#5f5a55]" />
              </button>
            </div>
          </AlertDialogHeader>

          <div className="space-y-5 py-3">
            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] mb-2">Date</label>
                <input
                  type="date"
                  value={callDate}
                  onChange={(e) => setCallDate(e.target.value)}
                  min={minDate}
                  className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30"
                />
              </div>
              <div>
                <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] mb-2">Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55]" />
                  <input
                    type="time"
                    value={callTime}
                    onChange={(e) => setCallTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30"
                  />
                </div>
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] mb-2">Timezone</label>
              <select
                value={callTimezone}
                onChange={(e) => setCallTimezone(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 appearance-none cursor-pointer"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] mb-2">
                <MapPin className="inline w-4 h-4 mr-1 -mt-0.5" />
                Location
              </label>
              {!useCustomLocation ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {LOCATION_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCallLocation(preset)}
                        className={`px-3 py-1.5 rounded-full font-albert text-[13px] transition-all ${
                          callLocation === preset
                            ? 'bg-[#a07855] text-white'
                            : 'bg-[#f3f1ef] text-[#1a1a1a] hover:bg-[#e9e5e0]'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseCustomLocation(true)}
                    className="text-[13px] text-[#a07855] hover:underline font-albert"
                  >
                    + Add custom location/link
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="e.g., https://zoom.us/j/..."
                    className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomLocation(false);
                      setCustomLocation('');
                    }}
                    className="text-[13px] text-[#a07855] hover:underline font-albert"
                  >
                    ← Use preset location
                  </button>
                </div>
              )}
            </div>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
            {coachingData?.nextCall?.datetime && (
              <button
                onClick={handleDeleteCall}
                disabled={schedulingCall}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-red-600 hover:bg-red-50 rounded-full font-albert text-sm transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Remove call
              </button>
            )}
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <AlertDialogCancel disabled={schedulingCall} className="font-albert rounded-full border-[#e1ddd8] flex-1 sm:flex-none">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleScheduleCall}
                disabled={schedulingCall || !callDate || !callTime}
                className="font-albert rounded-full bg-[#a07855] hover:bg-[#8c6245] text-white flex-1 sm:flex-none"
              >
                {schedulingCall ? 'Saving...' : 'Save'}
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Session Modal */}
      <AlertDialog open={showSessionModal} onOpenChange={setShowSessionModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert text-[20px] tracking-[-0.5px]">
              Add Session Entry
            </AlertDialogTitle>
          </AlertDialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] mb-2">Date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30"
              />
            </div>
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] mb-2">Title</label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="e.g., Focus & Prioritization"
                className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30"
              />
            </div>
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] mb-2">Summary</label>
              <textarea
                value={sessionSummary}
                onChange={(e) => setSessionSummary(e.target.value)}
                placeholder="Brief summary of what was covered..."
                rows={3}
                className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 resize-none"
              />
            </div>
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] mb-2">Key Takeaways</label>
              {sessionTakeaways.map((takeaway, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={takeaway}
                    onChange={(e) => {
                      const updated = [...sessionTakeaways];
                      updated[index] = e.target.value;
                      setSessionTakeaways(updated);
                    }}
                    placeholder={`Takeaway ${index + 1}...`}
                    className="flex-1 px-3 py-2 border border-[#e1ddd8] rounded-lg font-albert text-[14px] placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30"
                  />
                  {sessionTakeaways.length > 1 && (
                    <button
                      onClick={() => setSessionTakeaways(sessionTakeaways.filter((_, i) => i !== index))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setSessionTakeaways([...sessionTakeaways, ''])}
                className="text-[13px] text-[#a07855] hover:underline font-albert"
              >
                + Add takeaway
              </button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={addingSession} className="font-albert rounded-full border-[#e1ddd8]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAddSession}
              disabled={addingSession || !sessionTitle.trim() || !sessionDate}
              className="font-albert rounded-full bg-[#a07855] hover:bg-[#8c6245] text-white"
            >
              {addingSession ? 'Adding...' : 'Add Session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Private Notes Modal */}
      <AlertDialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert text-[20px] tracking-[-0.5px]">
              Private Notes (Coach Only)
            </AlertDialogTitle>
          </AlertDialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] mb-2">
                Notes about this client
              </label>
              <textarea
                value={currentNotes}
                onChange={(e) => setCurrentNotes(e.target.value)}
                placeholder="Your private notes about this client..."
                rows={5}
                className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 resize-none"
              />
            </div>
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] mb-2">
                Planned topics for next session
              </label>
              <textarea
                value={plannedTopics}
                onChange={(e) => setPlannedTopics(e.target.value)}
                placeholder="Topics to cover in the next session..."
                rows={3}
                className="w-full px-4 py-3 bg-white border border-[#e1ddd8] rounded-xl font-albert text-[14px] placeholder:text-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 resize-none"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingNotes} className="font-albert rounded-full border-[#e1ddd8]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="font-albert rounded-full bg-[#a07855] hover:bg-[#8c6245] text-white"
            >
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

