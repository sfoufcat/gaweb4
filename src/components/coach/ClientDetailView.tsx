'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
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
  User,
  Users,
  Flame,
  Heart,
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  BarChart3,
  GraduationCap,
  Loader2,
  Info,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SendDMModal, type DMRecipient } from '@/components/coach/SendDMModal';
import { ScheduleCallModal } from '@/components/scheduling';
import { DatePicker } from '@/components/ui/date-picker';
import { useDemoMode } from '@/contexts/DemoModeContext';
import type { 
  ClientCoachingData, 
  FirebaseUser, 
  Coach,
  CoachingActionItem,
  CoachingSessionHistory,
  CoachingResource,
  CoachPrivateNotes,
  CoachingStatus,
  GoalHistoryEntry,
  IdentityHistoryEntry,
} from '@/types';
import {
  formatTierName,
  getTierBadgeColor,
  formatCoachingStatus,
  getCoachingStatusBadgeColor,
} from '@/lib/admin-utils-shared';
import { useMediaQuery } from '@/hooks/useMediaQuery';


// Support needs options (same as onboarding page)
const SUPPORT_NEEDS_LABELS: Record<string, string> = {
  daily_checkins: 'Consistent daily check-ins',
  accountability: 'Accountability (people who notice if I slip)',
  clear_system: 'A clear system for priorities & daily tasks',
  expert_guidance: 'Expert guidance & resources',
  inspiration: 'Simply being regularly inspired',
};

// Onboarding answer labels
const WORKDAY_STYLE_LABELS: Record<string, string> = {
  chaotic: 'Chaotic',
  busy: 'Busy',
  productive: 'Productive',
  disciplined: 'Disciplined',
};

const PEER_ACCOUNTABILITY_LABELS: Record<string, string> = {
  alone: 'Working alone',
  no_daily_system: 'No daily system',
  inconsistent: 'Inconsistent',
  strong_accountability: 'Strong accountability',
};

const BUSINESS_STAGE_LABELS: Record<string, string> = {
  just_starting: 'Just starting',
  building_momentum: 'Building momentum',
  growing_steadily: 'Growing steadily',
  leveling_up: 'Leveling up',
  reinventing: 'Reinventing',
};

const GOAL_IMPACT_LABELS: Record<string, string> = {
  transformational: 'Transformational',
  a_lot: 'A lot',
  somewhat: 'Somewhat',
  a_little: 'A little',
};

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

// Emotional state colors for sentiment graph and pills
// Note: text color should contrast with bg (white text on colored bg)
const EMOTIONAL_STATE_COLORS: Record<string, { bg: string; text: string; value: number }> = {
  // Morning states (7-state scale from EmotionalSlider)
  energized: { bg: 'bg-emerald-500', text: 'text-white', value: 7 },
  confident: { bg: 'bg-green-500', text: 'text-white', value: 6 },
  steady: { bg: 'bg-teal-500', text: 'text-white', value: 5 },
  neutral: { bg: 'bg-amber-500', text: 'text-white', value: 4 },
  uncertain: { bg: 'bg-orange-500', text: 'text-white', value: 3 },
  uneasy: { bg: 'bg-orange-600', text: 'text-white', value: 2 },
  low_stuck: { bg: 'bg-red-500', text: 'text-white', value: 1 },
  stuck: { bg: 'bg-red-500', text: 'text-white', value: 1 }, // alias for low_stuck
  // Evening states (5-state scale)
  great_day: { bg: 'bg-emerald-500', text: 'text-white', value: 5 },
  amazing: { bg: 'bg-emerald-500', text: 'text-white', value: 5 }, // alias
  good_day: { bg: 'bg-green-500', text: 'text-white', value: 4 },
  mixed: { bg: 'bg-orange-500', text: 'text-white', value: 2 },
  tough_day: { bg: 'bg-red-500', text: 'text-white', value: 1 },
};

// Activity status colors
const ACTIVITY_STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  thriving: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: <Heart className="w-3.5 h-3.5" /> },
  active: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: <Activity className="w-3.5 h-3.5" /> },
  inactive: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

interface ClientDetailViewProps {
  clientId: string;
  onBack: () => void;
}

// Extended user data with comprehensive fields
interface UserData {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  imageUrl?: string;
  avatarUrl?: string;
  timezone?: string;
  goal?: string;
  goalProgress?: number;
  goalTargetDate?: string;
  goalSetAt?: string;
  identity?: string;
  goalHistory?: GoalHistoryEntry[];
  identityHistory?: IdentityHistoryEntry[];
  // Multi-squad support
  squadIds?: string[];
  standardSquadId?: string | null;
  premiumSquadId?: string | null;
  tier?: string;
  coachingStatus?: string;
  coaching?: boolean;
  onboarding?: {
    supportNeeds?: string[];
    workdayStyle?: string;
    peerAccountability?: string;
    businessStage?: string;
    goalImpact?: string;
  };
}

// Comprehensive data types
interface ClientTask {
  id: string;
  title: string;
  status: string;
  listType: string;
  date: string;
  completedAt?: string;
  createdAt: string;
}

interface ClientHabit {
  id: string;
  text: string;
  frequencyType: string;
  frequencyValue: number | number[];
  progress: {
    currentCount: number;
    lastCompletedDate: string | null;
    completionDates: string[];
  };
  status?: string;
  createdAt: string;
}

interface ClientMorningCheckin {
  id: string;
  date: string;
  emotionalState: string;
  userThought?: string;
  aiReframe?: string;
  completedAt?: string;
}

interface ClientEveningCheckin {
  id: string;
  date: string;
  emotionalState: string;
  reflectionText?: string;
  tasksCompleted: number;
  tasksTotal: number;
  completedAt?: string;
}

interface ClientWeeklyCheckin {
  id: string;
  date: string;
  onTrackStatus: string;
  progress: number;
  previousProgress: number;
  whatWentWell?: string;
  biggestObstacles?: string;
  nextWeekPlan?: string;
  publicFocus?: string;
  completedAt?: string;
}

interface ClientProgramEnrollment {
  id: string;
  programId: string;
  programName: string;
  programType: 'individual' | 'group';
  programCoverImageUrl?: string;
  status: string;
  progress: {
    currentDay: number;
    totalDays: number;
    percentComplete: number;
  };
  startedAt: string;
  completedAt?: string;
}

interface ClientActivityScore {
  status: 'thriving' | 'active' | 'inactive';
  atRisk: boolean;
  lastActivityAt: string | null;
  daysActiveInPeriod: number;
  primarySignal: string | null;
}

interface ClientSession {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime?: string;
  timezone: string;
  durationMinutes?: number;
  eventType: 'coaching_1on1' | 'squad_call' | 'community_event';
  locationType: 'online' | 'in_person' | 'chat';
  locationLabel: string;
  meetingLink?: string;
  status: string;
  programId?: string;
  programName?: string;
  squadId?: string;
  squadName?: string;
  cohortId?: string;
  clientUserId?: string;
  hostUserId?: string;
}

interface SquadInfo {
  id: string;
  name: string;
  programId?: string | null;
}

/**
 * SupportNeedsModal - Shows client's onboarding answers
 */
interface SupportNeedsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onboarding?: UserData['onboarding'];
  clientName?: string;
}

function SupportNeedsModal({ open, onOpenChange, onboarding, clientName }: SupportNeedsModalProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');

  const content = (
    <div className="space-y-5">
      {/* Support Needs */}
      {onboarding?.supportNeeds && onboarding.supportNeeds.length > 0 && (
        <div>
          <h4 className="font-albert text-sm font-medium text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3">
            What would support them most
          </h4>
          <div className="space-y-2">
            {onboarding.supportNeeds.map((need, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 bg-gradient-to-br from-brand-accent/5 to-[#8c6245]/5 dark:from-[#b8896a]/10 dark:to-brand-accent/5 rounded-xl border border-brand-accent/20"
              >
                <div className="w-6 h-6 rounded-lg bg-brand-accent flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-albert text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {SUPPORT_NEEDS_LABELS[need] || need}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other onboarding answers */}
      {(onboarding?.workdayStyle || onboarding?.peerAccountability || onboarding?.businessStage || onboarding?.goalImpact) && (
        <div>
          <h4 className="font-albert text-sm font-medium text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-3">
            Other insights
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {onboarding?.workdayStyle && (
              <div className="p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] mb-1">Workday Style</p>
                <p className="font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">
                  {WORKDAY_STYLE_LABELS[onboarding.workdayStyle] || onboarding.workdayStyle}
                </p>
              </div>
            )}
            {onboarding?.peerAccountability && (
              <div className="p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] mb-1">Accountability</p>
                <p className="font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">
                  {PEER_ACCOUNTABILITY_LABELS[onboarding.peerAccountability] || onboarding.peerAccountability}
                </p>
              </div>
            )}
            {onboarding?.businessStage && (
              <div className="p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] mb-1">Business Stage</p>
                <p className="font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">
                  {BUSINESS_STAGE_LABELS[onboarding.businessStage] || onboarding.businessStage}
                </p>
              </div>
            )}
            {onboarding?.goalImpact && (
              <div className="p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] mb-1">Goal Impact</p>
                <p className="font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">
                  {GOAL_IMPACT_LABELS[onboarding.goalImpact] || onboarding.goalImpact}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!onboarding?.supportNeeds?.length && !onboarding?.workdayStyle && !onboarding?.peerAccountability && !onboarding?.businessStage && !onboarding?.goalImpact && (
        <div className="text-center py-8">
          <Info className="w-10 h-10 text-[#c4bfb9] dark:text-[#7d8190] mx-auto mb-3" />
          <p className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">
            No onboarding answers available
          </p>
          <p className="font-albert text-[13px] text-[#8c8c8c] dark:text-[#7d8190] mt-1">
            This client hasn&apos;t completed the onboarding quiz yet.
          </p>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
            <DrawerTitle className="font-albert">
              {clientName ? `${clientName}'s` : 'Client'} Onboarding Answers
            </DrawerTitle>
            <DrawerDescription>
              Insights from their onboarding questionnaire
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 overflow-y-auto">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-albert">
            {clientName ? `${clientName}'s` : 'Client'} Onboarding Answers
          </DialogTitle>
          <DialogDescription>
            Insights from their onboarding questionnaire
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

/**
 * ClientDetailView
 * 
 * Comprehensive client profile showing:
 * 1. Header with activity score and quick actions
 * 2. Goal and Identity section
 * 3. Progress timeline with tasks and habits
 * 4. Sentiment graph
 * 5. Check-ins (Morning/Evening/Weekly)
 * 6. Programs enrollment
 * 7. One-on-One coaching features
 * 8. Coach notes
 */
export function ClientDetailView({ clientId, onBack }: ClientDetailViewProps) {
  const router = useRouter();
  const { isDemoMode, openSignupModal } = useDemoMode();
  const isMobile = useMediaQuery('(max-width: 640px)');


  // Data states
  const [user, setUser] = useState<UserData | null>(null);
  const [coachingData, setCoachingData] = useState<ClientCoachingData | null>(null);
  const [hasCoaching, setHasCoaching] = useState<boolean>(false);
  const [_coach, setCoach] = useState<Coach | null>(null);
  const [squads, setSquads] = useState<SquadInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Comprehensive data states
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [habits, setHabits] = useState<ClientHabit[]>([]);
  const [morningCheckins, setMorningCheckins] = useState<ClientMorningCheckin[]>([]);
  const [eveningCheckins, setEveningCheckins] = useState<ClientEveningCheckin[]>([]);
  const [weeklyCheckins, setWeeklyCheckins] = useState<ClientWeeklyCheckin[]>([]);
  const [programEnrollments, setProgramEnrollments] = useState<ClientProgramEnrollment[]>([]);
  const [activityScore, setActivityScore] = useState<ClientActivityScore | null>(null);
  const [streak, setStreak] = useState(0);
  const [upcomingSessions, setUpcomingSessions] = useState<ClientSession[]>([]);
  const [pastSessions, setPastSessions] = useState<ClientSession[]>([]);

  // UI states
  const [showPastPrograms, setShowPastPrograms] = useState(false);
  const [showPastSessionsModal, setShowPastSessionsModal] = useState(false);
  const [checkinTab, setCheckinTab] = useState<'morning' | 'evening' | 'weekly'>('morning');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    goal: true,
    progress: true,
    sentiment: true,
    tasks: false,
    habits: false,
    checkins: true,
    programs: true,
    coaching: true,
    notes: true,
  });
  
  // DM Modal state
  const [showDMModal, setShowDMModal] = useState(false);

  // Support needs modal state
  const [showSupportNeedsModal, setShowSupportNeedsModal] = useState(false);

  // Squad update state
  const [updatingSquad, setUpdatingSquad] = useState(false);

  // Coach notes about user (stored separately from coaching data)
  const [coachNotes, setCoachNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Edit states for coaching features
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
  const [savingPrivateNotes, setSavingPrivateNotes] = useState(false);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch comprehensive coaching data
      const coachingResponse = await fetch(`/api/coaching/clients/${clientId}?comprehensive=true`);

      if (!coachingResponse.ok) {
        throw new Error('Failed to fetch client data');
      }

      const data = await coachingResponse.json();
      
      // Set user data
      const fetchedUser = data.user;
      setUser(fetchedUser);
      
      // Set coaching data
      setCoachingData(data.data);
      setCoach(data.coach);
      
      // Set comprehensive data
      setTasks(data.tasks || []);
      setHabits(data.habits || []);
      setMorningCheckins(data.morningCheckins || []);
      setEveningCheckins(data.eveningCheckins || []);
      setWeeklyCheckins(data.weeklyCheckins || []);
      setProgramEnrollments(data.programEnrollments || []);
      setActivityScore(data.activityScore || null);
      setCoachNotes(data.coachNotes || '');
      setStreak(data.streak || 0);
      setUpcomingSessions(data.upcomingSessions || []);
      setPastSessions(data.pastSessions || []);

      // Use hasActiveCoaching from API response (includes 1:1 program enrollment check)
      const userHasActiveCoaching = data.hasActiveCoaching ?? (
        fetchedUser?.coachingStatus === 'active' ||
        fetchedUser?.coaching === true
      );
      setHasCoaching(userHasActiveCoaching);

      // Initialize edit states for coaching features
      if (data.data && userHasActiveCoaching) {
        setFocusAreas(data.data.focusAreas || []);
        setActionItems(data.data.actionItems || []);
        setResources(data.data.resources || []);
        setPrivateNotes(data.data.privateNotes || []);
        
        // Initialize call modal with existing data
        if (data.data.nextCall?.datetime) {
          const callDateObj = new Date(data.data.nextCall.datetime);
          const tz = data.data.nextCall.timezone || 'America/New_York';
          
          const dateFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          setCallDate(dateFormatter.format(callDateObj));
          
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

      // Fetch squads for display/selection
      try {
        const squadsResponse = await fetch('/api/coach/org-squads');
        if (squadsResponse.ok) {
          const squadsData = await squadsResponse.json();
          setSquads(squadsData.squads || []);
        }
      } catch (err) {
        console.warn('Failed to fetch squads:', err);
      }

    } catch (err) {
      console.error('Error fetching client data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load client data');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  // Add user to a squad (proper multi-squad support)
  const handleAddToSquad = async (squadId: string) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    try {
      setUpdatingSquad(true);
      
      const response = await fetch(`/api/coach/org-users/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addSquadId: squadId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add to squad');
      }

      // Update local state - add squad to user's squadIds
      setUser((prev) => {
        if (!prev) return prev;
        const currentSquadIds = prev.squadIds || [];
        if (currentSquadIds.includes(squadId)) return prev;
        return { 
          ...prev, 
          squadIds: [...currentSquadIds, squadId],
          standardSquadId: prev.standardSquadId || squadId,
        };
      });
    } catch (err) {
      console.error('Error adding to squad:', err);
      setError(err instanceof Error ? err.message : 'Failed to add to squad');
    } finally {
      setUpdatingSquad(false);
    }
  };

  // Remove user from a squad (proper multi-squad support)
  const handleRemoveFromSquad = async (squadId: string) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    try {
      setUpdatingSquad(true);
      
      const response = await fetch(`/api/coach/org-users/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeSquadId: squadId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove from squad');
      }

      // Update local state - remove squad from user's squadIds
      setUser((prev) => {
        if (!prev) return prev;
        const currentSquadIds = prev.squadIds || [];
        const updatedSquadIds = currentSquadIds.filter(id => id !== squadId);
        return { 
          ...prev, 
          squadIds: updatedSquadIds,
          standardSquadId: updatedSquadIds.length > 0 ? updatedSquadIds[0] : null,
        };
      });
    } catch (err) {
      console.error('Error removing from squad:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove from squad');
    } finally {
      setUpdatingSquad(false);
    }
  };

  // Save coaching data changes
  const handleSaveCoachingChanges = async () => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    // Allow saving if user has active coaching (hasCoaching), even if coachingData document doesn't exist yet
    // The PATCH API will create the document if needed for users with 1:1 program enrollment
    if (!hasCoaching) return;

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

      await fetchData();
    } catch (err) {
      console.error('Error saving changes:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Schedule or update call (uses unified events API)
  const handleScheduleCall = async () => {
    if (isDemoMode) {
      openSignupModal();
      setShowCallModal(false);
      return;
    }
    if (!callDate || !callTime || !hasCoaching || !user) return;

    try {
      setSchedulingCall(true);

      const [year, month, day] = callDate.split('-').map(Number);
      const [hours, minutes] = callTime.split(':').map(Number);
      const localDate = new Date(year, month - 1, day, hours, minutes);
      
      const dateInTz = new Date(localDate.toLocaleString('en-US', { timeZone: callTimezone }));
      const utcDate = new Date(localDate.getTime() - (dateInTz.getTime() - localDate.getTime()));

      const finalLocation = useCustomLocation ? customLocation.trim() : callLocation;

      // Build event data for unified API
      const eventData = {
        title: 'Coaching Call',
        description: `1-on-1 coaching session with ${user.firstName || 'Client'}`,
        startDateTime: utcDate.toISOString(),
        timezone: callTimezone,
        durationMinutes: 60,
        
        locationType: finalLocation.startsWith('http') ? 'online' : 'chat',
        locationLabel: finalLocation,
        meetingLink: finalLocation.startsWith('http') ? finalLocation : undefined,
        
        eventType: 'coaching_1on1',
        scope: 'private',
        participantModel: 'invite_only',
        approvalType: 'none',
        
        organizationId: coachingData?.organizationId,
        
        isRecurring: false,
        isCoachLed: true,
        
        attendeeIds: [clientId],
        maxAttendees: 2,
        
        chatChannelId: coachingData?.chatChannelId,
        sendChatReminders: true,
      };

      // Create or update via unified events API
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error('Failed to schedule call');
      }

      // Also update legacy coaching data for backward compatibility
      await fetch(`/api/coaching/clients/${clientId}/call`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateTime: utcDate.toISOString(),
          timezone: callTimezone,
          location: finalLocation,
          title: 'Coaching Call',
        }),
      });

      setShowCallModal(false);
      await fetchData();
    } catch (err) {
      console.error('Error scheduling call:', err);
      setError(err instanceof Error ? err.message : 'Failed to schedule call');
    } finally {
      setSchedulingCall(false);
    }
  };

  // Delete scheduled call
  const handleDeleteCall = async () => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    if (!hasCoaching) return;

    try {
      setSchedulingCall(true);

      // Delete from legacy API (will also be handled by unified system after migration)
      const response = await fetch(`/api/coaching/clients/${clientId}/call`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove call');
      }

      setShowCallModal(false);
      await fetchData();
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
    if (isDemoMode) {
      openSignupModal();
      setShowSessionModal(false);
      return;
    }
    if (!sessionTitle.trim() || !sessionDate || !hasCoaching) return;

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
      await fetchData();
    } catch (err) {
      console.error('Error adding session:', err);
    } finally {
      setAddingSession(false);
    }
  };

  // Save private notes
  const handleSavePrivateNotes = async () => {
    if (isDemoMode) {
      openSignupModal();
      setShowNotesModal(false);
      return;
    }
    if (!hasCoaching) return;

    try {
      setSavingPrivateNotes(true);
      const now = new Date().toISOString();

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
      await fetchData();
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setSavingPrivateNotes(false);
    }
  };

  // Open notes modal with existing data
  const handleOpenNotesModal = () => {
    const generalNotes = privateNotes.find(n => n.sessionId === 'general');
    setCurrentNotes(generalNotes?.notes || '');
    setPlannedTopics(generalNotes?.plannedTopics || '');
    setShowNotesModal(true);
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

  // Check if the next call is in the future (not already passed)
  const hasUpcomingCall = (() => {
    if (!coachingData?.nextCall?.datetime) return false;
    const callTime = new Date(coachingData.nextCall.datetime);
    const now = new Date();
    return callTime > now;
  })();

  // Get user's squad names
  const getUserSquadNames = () => {
    const squadNames: string[] = [];
    if (user?.standardSquadId) {
      const squad = squads.find(s => s.id === user.standardSquadId);
      if (squad) squadNames.push(squad.name);
    }
    if (user?.premiumSquadId) {
      const squad = squads.find(s => s.id === user.premiumSquadId);
      if (squad) squadNames.push(`${squad.name} (Premium)`);
    }
    return squadNames.length > 0 ? squadNames.join(', ') : 'None';
  };

  // Save coach notes about this client
  const handleSaveCoachNotes = async () => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    try {
      setSavingNotes(true);
      setNotesSaved(false);
      
      const response = await fetch('/api/coach/client-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          notes: coachNotes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err) {
      console.error('Error saving notes:', err);
      setError('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  // Calculate completed tasks stats
  const completedTasksToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(t => t.status === 'completed' && t.date === today).length;
  }, [tasks]);

  const totalCompletedTasks = useMemo(() => {
    return tasks.filter(t => t.status === 'completed').length;
  }, [tasks]);

  // Calculate task completion rate (last 7 days)
  const taskCompletionRate = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    const recentTasks = tasks.filter(t => t.date >= sevenDaysAgoStr);
    if (recentTasks.length === 0) return 0;
    
    const completed = recentTasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / recentTasks.length) * 100);
  }, [tasks]);

  // Get sentiment data for graph (last 7 days)
  const sentimentData = useMemo(() => {
    const last7Days = [];
    const today = new Date();
    console.log('[MoodChart] Today:', today.toISOString(), 'morningCheckins:', morningCheckins.length);
    console.log('[MoodChart] Check-in dates:', morningCheckins.map(c => c.date));
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      // Use UTC date format YYYY-MM-DD to match server-side date storage
      const dateStr = date.toISOString().split('T')[0];

      const morningCheckin = morningCheckins.find(c => c.date === dateStr);
      const eveningCheckin = eveningCheckins.find(c => c.date === dateStr);

      last7Days.push({
        date: dateStr,
        dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
        morning: morningCheckin?.emotionalState || null,
        evening: eveningCheckin?.emotionalState || null,
      });
    }
    console.log('[MoodChart] Generated sentiment data:', last7Days);
    return last7Days;
  }, [morningCheckins, eveningCheckins]);

  // Filter programs by status
  const currentPrograms = useMemo(() => {
    return programEnrollments.filter(p => p.status === 'active' || p.status === 'in_progress');
  }, [programEnrollments]);

  const pastPrograms = useMemo(() => {
    return programEnrollments.filter(p => p.status === 'completed' || p.status === 'cancelled');
  }, [programEnrollments]);

  // Get active 1:1 (individual) program for title display
  const activeIndividualProgram = useMemo(() => {
    return programEnrollments.find(
      p => p.programType === 'individual' && (p.status === 'active' || p.status === 'upcoming')
    );
  }, [programEnrollments]);

  // DM recipient for modal
  const dmRecipient: DMRecipient | null = user ? {
    userId: user.id,
    name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
    email: user.email || '',
    avatarUrl: user.avatarUrl || user.imageUrl,
  } : null;

  const minDate = new Date().toISOString().split('T')[0];
  const displayName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Unknown User';
  const userTier = (user?.tier || 'free') as 'free' | 'standard' | 'premium';
  const coachingStatus = hasCoaching ? 'active' : (user?.coachingStatus || 'none');

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Client header skeleton */}
        <div className="bg-white/80 dark:bg-[#171b22]/80 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-3xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-40 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              <div className="h-4 w-56 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              <div className="flex gap-2">
                <div className="h-6 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                <div className="h-6 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
              </div>
            </div>
          </div>
        </div>
        {/* Stats cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/80 dark:bg-[#171b22]/80 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-4">
              <div className="h-4 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded mb-2" />
              <div className="h-8 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
            </div>
          ))}
        </div>
        {/* Activity section skeleton */}
        <div className="bg-white/80 dark:bg-[#171b22]/80 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6 space-y-4">
          <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-3 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <p className="text-red-600 dark:text-red-300 font-albert mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-albert"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Header with Activity Status */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar + Chat Button Row (Mobile) */}
          <div className="flex items-start justify-between sm:justify-start gap-4 shrink-0">
            {/* Avatar */}
            <div className="shrink-0">
              {user?.imageUrl || user?.avatarUrl ? (
                <Image
                  src={user.avatarUrl || user.imageUrl || ''}
                  alt={displayName}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-2xl object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-accent to-[#7d5c3e] dark:from-[#b8896a] dark:to-[#8c7a6d] flex items-center justify-center text-white text-2xl font-albert font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Chat Button - Mobile Only */}
            <button
              onClick={() => setShowDMModal(true)}
              className="sm:hidden inline-flex items-center justify-center w-10 h-10 bg-brand-accent hover:bg-brand-accent/90 rounded-full text-white transition-colors"
              title="Send message"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
          
          {/* Client Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h2 className="font-albert text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                {displayName}
              </h2>
              {/* Activity Status Badge */}
              {activityScore && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-albert ${ACTIVITY_STATUS_COLORS[activityScore.status]?.bg} ${ACTIVITY_STATUS_COLORS[activityScore.status]?.text}`}>
                  {ACTIVITY_STATUS_COLORS[activityScore.status]?.icon}
                  {activityScore.status.charAt(0).toUpperCase() + activityScore.status.slice(1)}
                </span>
              )}
              {activityScore?.atRisk && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium font-albert bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  At Risk
                </span>
              )}
            </div>
            <p className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">{user?.email}</p>
            {user?.timezone && (
              <p className="font-albert text-sm text-[#8c8c8c] dark:text-[#7d8190] mt-1">
                Timezone: {user.timezone}
              </p>
            )}
            
            {/* Badges Row */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${getTierBadgeColor(userTier)}`}>
                {formatTierName(userTier)}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${getCoachingStatusBadgeColor(coachingStatus as CoachingStatus)}`}>
                {hasCoaching ? 'Has 1:1 Coaching' : formatCoachingStatus(coachingStatus as CoachingStatus)}
              </span>
              {streak > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium font-albert bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <Flame className="w-3.5 h-3.5" />
                  {streak} day streak
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions - Desktop Only */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowDMModal(true)}
              className="inline-flex items-center justify-center w-10 h-10 bg-brand-accent hover:bg-brand-accent/90 rounded-full text-white transition-colors"
              title="Send message"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Streak</span>
          </div>
          <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{streak} days</p>
        </div>
        <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Tasks Done</span>
          </div>
          <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{totalCompletedTasks}</p>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">{completedTasksToday} today</p>
        </div>
        <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Completion Rate</span>
          </div>
          <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{taskCompletionRate}%</p>
          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">Last 7 days</p>
        </div>
        <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Goal Progress</span>
          </div>
          <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{user?.goalProgress || 0}%</p>
        </div>
      </div>

      {/* Next Sessions Card */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-accent" />
            <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
              Upcoming Sessions
            </h3>
            {upcomingSessions.length > 0 && (
              <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                ({upcomingSessions.length})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {pastSessions.length > 0 && (
              <button
                onClick={() => setShowPastSessionsModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] rounded-full transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                Past ({pastSessions.length})
              </button>
            )}
            <button
              onClick={() => setShowCallModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-brand-accent hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] rounded-full transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Schedule
            </button>
          </div>
        </div>

        {upcomingSessions.length > 0 ? (
          <div className="space-y-3">
            {upcomingSessions.slice(0, 5).map((session) => (
              <div key={session.id} className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-albert text-[14px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {session.title}
                      </span>
                      {/* Session type badge */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        session.eventType === 'coaching_1on1'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {session.eventType === 'coaching_1on1' ? '1:1' : 'Group'}
                      </span>
                    </div>
                    <p className="font-albert text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                      {formatCallTime(session.startDateTime, session.timezone)}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[12px] text-[#8c8c8c] dark:text-[#7d8190]">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {session.locationLabel}
                      </span>
                      {session.programName && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          {session.programName}
                        </span>
                      )}
                      {session.squadName && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {session.squadName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {upcomingSessions.length > 5 && (
              <p className="text-center text-[12px] text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                +{upcomingSessions.length - 5} more sessions
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Calendar className="w-10 h-10 mx-auto mb-2 text-[#c4bfb9] dark:text-[#7d8190]" />
            <p className="font-albert text-[14px] text-[#8c8c8c] dark:text-[#7d8190]">
              No upcoming sessions scheduled
            </p>
          </div>
        )}
      </div>

      {/* Goal and Identity Section */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('goal')}
          className="w-full flex items-center justify-between p-5 hover:bg-[#faf8f6]/50 dark:hover:bg-[#11141b]/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-accent" />
            <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
              Goal & Identity
            </h3>
          </div>
          {expandedSections.goal ? <ChevronUp className="w-5 h-5 text-[#5f5a55]" /> : <ChevronDown className="w-5 h-5 text-[#5f5a55]" />}
        </button>
        {expandedSections.goal && (
          <div className="px-5 pb-5 space-y-4">
            {/* Current Goal */}
            {user?.goal ? (
              <div className="p-4 bg-gradient-to-br from-brand-accent/5 to-[#8c6245]/5 dark:from-[#b8896a]/10 dark:to-brand-accent/5 rounded-xl border border-brand-accent/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-albert text-xs text-brand-accent uppercase tracking-wider font-medium">Current Goal</p>
                  {user?.onboarding && (user.onboarding.supportNeeds?.length || user.onboarding.workdayStyle || user.onboarding.peerAccountability || user.onboarding.businessStage || user.onboarding.goalImpact) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSupportNeedsModal(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-brand-accent/10 transition-colors group"
                      title="View onboarding answers"
                    >
                      <Info className="w-4 h-4 text-brand-accent/60 group-hover:text-brand-accent transition-colors" />
                    </button>
                  )}
                </div>
                <p className="font-albert text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">{user.goal}</p>
                {user.goalTargetDate && (
                  <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                    Target: {new Date(user.goalTargetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
                {user.goalProgress !== undefined && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Progress</span>
                      <span className="text-xs font-medium text-brand-accent font-albert">{user.goalProgress}%</span>
                    </div>
                    <div className="h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-accent to-[#8c6245] rounded-full transition-all duration-500"
                        style={{ width: `${user.goalProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl text-center">
                <Target className="w-8 h-8 text-[#c4bfb9] dark:text-[#7d8190] mx-auto mb-2" />
                <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">No goal set yet</p>
              </div>
            )}

            {/* Identity */}
            {user?.identity && (
              <div className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-2">Identity Statement</p>
                <p className="font-albert text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8] italic">"{user.identity}"</p>
              </div>
            )}

            {/* Goal History */}
            {user?.goalHistory && user.goalHistory.length > 0 && (
              <div>
                <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider mb-2">Past Goals</p>
                <div className="space-y-2">
                  {user.goalHistory.slice(0, 3).map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${entry.completedAt ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-[#e1ddd8] dark:bg-[#262b35]'}`}>
                        {entry.completedAt ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Target className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate">{entry.goal}</p>
                        <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                          {entry.completedAt ? 'Completed' : 'Archived'} • {entry.progress}% progress
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sentiment Graph Section */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('sentiment')}
          className="w-full flex items-center justify-between p-5 hover:bg-[#faf8f6]/50 dark:hover:bg-[#11141b]/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-accent" />
            <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
              Mood Over Time
            </h3>
          </div>
          {expandedSections.sentiment ? <ChevronUp className="w-5 h-5 text-[#5f5a55]" /> : <ChevronDown className="w-5 h-5 text-[#5f5a55]" />}
        </button>
        {expandedSections.sentiment && (
          <div className="px-5 pb-5">
            {/* Chart container with subtle grid background */}
            <div className="relative bg-gradient-to-b from-[#faf8f6]/50 to-transparent dark:from-[#11141b]/50 rounded-xl p-4">
              {/* Horizontal grid lines */}
              <div className="absolute inset-4 flex flex-col justify-between pointer-events-none">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-full h-px bg-[#e1ddd8]/40 dark:bg-[#262b35]/40" />
                ))}
              </div>

              {/* Bars container */}
              <div className="relative flex items-end justify-around h-36">
                {sentimentData.map((day, idx) => {
                  const morningValue = day.morning ? EMOTIONAL_STATE_COLORS[day.morning]?.value || 4 : 0;
                  const eveningValue = day.evening ? EMOTIONAL_STATE_COLORS[day.evening]?.value || 3 : 0;
                  // Morning uses 7-point scale, evening uses 5-point scale
                  // Use pixel heights (h-28 = 112px max)
                  const maxBarHeight = 100;
                  const morningHeight = morningValue ? Math.max((morningValue / 7) * maxBarHeight, 12) : 8;
                  const eveningHeight = eveningValue ? Math.max((eveningValue / 5) * maxBarHeight, 12) : 8;
                  const hasMorning = morningValue > 0;
                  const hasEvening = eveningValue > 0;

                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="flex gap-1.5 h-28 items-end mb-2">
                        {/* Morning bar */}
                        <div className="relative group">
                          <div
                            className={`w-4 rounded-md transition-all duration-300 ease-out ${
                              hasMorning
                                ? 'bg-gradient-to-t from-teal-600 to-teal-400 shadow-sm hover:shadow-md hover:shadow-teal-500/20'
                                : 'bg-[#e9e5e0] dark:bg-[#262b35]'
                            }`}
                            style={{
                              height: `${morningHeight}px`,
                              opacity: hasMorning ? 1 : 0.4
                            }}
                          />
                          {hasMorning && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-[#1a1a1a]/90 backdrop-blur-sm text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-10 shadow-lg pointer-events-none">
                              <div className="flex items-center gap-1.5">
                                <Sun className="w-3 h-3 text-amber-400" />
                                <span className="capitalize">{day.morning?.replace(/_/g, ' ')}</span>
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a1a1a]/90 rotate-45" />
                            </div>
                          )}
                        </div>
                        {/* Evening bar */}
                        <div className="relative group">
                          <div
                            className={`w-4 rounded-md transition-all duration-300 ease-out ${
                              hasEvening
                                ? 'bg-gradient-to-t from-orange-600 to-orange-400 shadow-sm hover:shadow-md hover:shadow-orange-500/20'
                                : 'bg-[#e9e5e0] dark:bg-[#262b35]'
                            }`}
                            style={{
                              height: `${eveningHeight}px`,
                              opacity: hasEvening ? 1 : 0.4
                            }}
                          />
                          {hasEvening && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-[#1a1a1a]/90 backdrop-blur-sm text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-10 shadow-lg pointer-events-none">
                              <div className="flex items-center gap-1.5">
                                <Moon className="w-3 h-3 text-indigo-400" />
                                <span className="capitalize">{day.evening?.replace(/_/g, ' ')}</span>
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a1a1a]/90 rotate-45" />
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-[#5f5a55] dark:text-[#b2b6c2] font-albert font-medium">{day.dayLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-teal-600 to-teal-400" />
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert font-medium">Morning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-orange-600 to-orange-400" />
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert font-medium">Evening</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Check-ins Section */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('checkins')}
          className="w-full flex items-center justify-between p-5 hover:bg-[#faf8f6]/50 dark:hover:bg-[#11141b]/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-accent" />
            <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
              Check-ins
            </h3>
          </div>
          {expandedSections.checkins ? <ChevronUp className="w-5 h-5 text-[#5f5a55]" /> : <ChevronDown className="w-5 h-5 text-[#5f5a55]" />}
        </button>
        {expandedSections.checkins && (
          <div className="px-5 pb-5">
            {/* Tab buttons */}
            <div className="flex gap-2 mb-4">
              {(['morning', 'evening', 'weekly'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCheckinTab(tab)}
                  className={`px-4 py-2 rounded-lg font-albert text-sm font-medium transition-colors ${
                    checkinTab === tab
                      ? 'bg-brand-accent text-white'
                      : 'bg-[#f3f1ef] dark:bg-[#11141b] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e9e5e0] dark:hover:bg-[#171b22]'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  <span className="ml-1.5 text-xs opacity-70">
                    ({tab === 'morning' ? morningCheckins.length : tab === 'evening' ? eveningCheckins.length : weeklyCheckins.length})
                  </span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {checkinTab === 'morning' && (
                morningCheckins.length > 0 ? (
                  morningCheckins.map((checkin) => (
                    <div key={checkin.id} className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-albert text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                          {new Date(checkin.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EMOTIONAL_STATE_COLORS[checkin.emotionalState]?.bg} ${EMOTIONAL_STATE_COLORS[checkin.emotionalState]?.text}`}>
                          {checkin.emotionalState.replace('_', ' ')}
                        </span>
                      </div>
                      {checkin.userThought && (
                        <div className="mb-2">
                          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-1">Thought:</p>
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">{checkin.userThought}</p>
                        </div>
                      )}
                      {checkin.aiReframe && (
                        <div className="p-3 bg-white dark:bg-[#171b22] rounded-lg border border-brand-accent/20">
                          <p className="text-xs text-brand-accent font-albert mb-1 font-medium">AI Reframe:</p>
                          <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{checkin.aiReframe}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No morning check-ins yet</p>
                )
              )}

              {checkinTab === 'evening' && (
                eveningCheckins.length > 0 ? (
                  eveningCheckins.map((checkin) => (
                    <div key={checkin.id} className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-albert text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                          {new Date(checkin.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EMOTIONAL_STATE_COLORS[checkin.emotionalState]?.bg} ${EMOTIONAL_STATE_COLORS[checkin.emotionalState]?.text}`}>
                          {checkin.emotionalState.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          {checkin.tasksCompleted}/{checkin.tasksTotal} tasks completed
                        </span>
                      </div>
                      {checkin.reflectionText && (
                        <div className="p-3 bg-white dark:bg-[#171b22] rounded-lg">
                          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-1">Reflection:</p>
                          <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{checkin.reflectionText}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No evening check-ins yet</p>
                )
              )}

              {checkinTab === 'weekly' && (
                weeklyCheckins.length > 0 ? (
                  weeklyCheckins.map((checkin) => {
                    // Determine progress status based on change from previous
                    const progressDiff = checkin.progress - (checkin.previousProgress || 0);
                    const isImproved = progressDiff > 0;
                    const isStagnant = progressDiff === 0;

                    return (
                      <div key={checkin.id} className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-albert text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                            Week of {new Date(checkin.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            isImproved
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : isStagnant
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {isImproved ? `+${progressDiff}% improved` : isStagnant ? 'no change' : `${progressDiff}% declined`}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-1">Goal progress:</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-accent rounded-full"
                                style={{ width: `${checkin.progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">{checkin.progress}%</span>
                          </div>
                        </div>
                        {checkin.whatWentWell && (
                          <div>
                            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-1">What went well:</p>
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{checkin.whatWentWell}</p>
                          </div>
                        )}
                        {checkin.biggestObstacles && (
                          <div>
                            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-1">Obstacles:</p>
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{checkin.biggestObstacles}</p>
                          </div>
                        )}
                        {checkin.nextWeekPlan && (
                          <div>
                            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-1">Next week plan:</p>
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{checkin.nextWeekPlan}</p>
                          </div>
                        )}
                        {checkin.publicFocus && (
                          <div>
                            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-1">Public focus:</p>
                            <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{checkin.publicFocus}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center py-8 text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No weekly check-ins yet</p>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Programs Section */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('programs')}
          className="w-full flex items-center justify-between p-5 hover:bg-[#faf8f6]/50 dark:hover:bg-[#11141b]/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-brand-accent" />
            <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
              Programs
            </h3>
            <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">({programEnrollments.length})</span>
          </div>
          {expandedSections.programs ? <ChevronUp className="w-5 h-5 text-[#5f5a55]" /> : <ChevronDown className="w-5 h-5 text-[#5f5a55]" />}
        </button>
        {expandedSections.programs && (
          <div className="px-5 pb-5">
            {/* Toggle for past programs */}
            {pastPrograms.length > 0 && (
              <div className="flex items-center justify-end mb-3">
                <button
                  onClick={() => setShowPastPrograms(!showPastPrograms)}
                  className="text-sm text-brand-accent hover:underline font-albert"
                >
                  {showPastPrograms ? 'Hide past programs' : `Show past programs (${pastPrograms.length})`}
                </button>
              </div>
            )}

            {/* Current Programs */}
            {currentPrograms.length > 0 ? (
              <div className="space-y-3">
                {currentPrograms.map((enrollment) => (
                  <Link
                    key={enrollment.id}
                    href={`/coach?tab=programs&programId=${enrollment.programId}`}
                    className="block"
                  >
                    <div className="flex gap-4 p-4 bg-gradient-to-br from-brand-accent/5 to-[#8c6245]/5 dark:from-[#b8896a]/10 dark:to-brand-accent/5 rounded-xl border border-brand-accent/20 hover:border-brand-accent/40 transition-colors cursor-pointer group">
                      {/* Cover Image */}
                      <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                        {enrollment.programCoverImageUrl ? (
                          <Image
                            src={enrollment.programCoverImageUrl}
                            alt={enrollment.programName}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                            sizes="64px"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-brand-accent/20 to-[#8c6245]/10 flex items-center justify-center">
                            {enrollment.programType === 'group' ? (
                              <Users className="w-6 h-6 text-brand-accent/60" />
                            ) : (
                              <User className="w-6 h-6 text-brand-accent/60" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-albert text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">{enrollment.programName}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0 ml-2">
                            Active
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-2 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-accent rounded-full transition-all"
                              style={{ width: `${enrollment.progress.percentComplete}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-brand-accent font-albert flex-shrink-0">{enrollment.progress.percentComplete}%</span>
                        </div>
                        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                          Day {enrollment.progress.currentDay}/{enrollment.progress.totalDays} • Started {new Date(enrollment.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-[#5f5a55] dark:text-[#b2b6c2] font-albert">No active programs</p>
            )}

            {/* Past Programs */}
            {showPastPrograms && pastPrograms.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50 space-y-3">
                <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] uppercase tracking-wider font-albert mb-2">Past Programs</p>
                {pastPrograms.map((enrollment) => (
                  <Link
                    key={enrollment.id}
                    href={`/coach?tab=programs&programId=${enrollment.programId}`}
                    className="block"
                  >
                    <div className="flex gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl hover:bg-[#f5f0eb] dark:hover:bg-[#171b22] transition-colors cursor-pointer group">
                      {/* Cover Image */}
                      <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden opacity-60">
                        {enrollment.programCoverImageUrl ? (
                          <Image
                            src={enrollment.programCoverImageUrl}
                            alt={enrollment.programName}
                            fill
                            className="object-cover grayscale group-hover:grayscale-0 transition-all"
                            sizes="56px"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#e1ddd8] to-[#d4cfc8] dark:from-[#262b35] dark:to-[#1f242c] flex items-center justify-center">
                            {enrollment.programType === 'group' ? (
                              <Users className="w-5 h-5 text-[#8c8c8c] dark:text-[#7d8190]" />
                            ) : (
                              <User className="w-5 h-5 text-[#8c8c8c] dark:text-[#7d8190]" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-albert text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">{enrollment.programName}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                            enrollment.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-[#e1ddd8] text-[#5f5a55] dark:bg-[#262b35] dark:text-[#b2b6c2]'
                          }`}>
                            {enrollment.status === 'completed' ? 'Completed' : 'Cancelled'}
                          </span>
                        </div>
                        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                          {enrollment.completedAt
                            ? `Completed ${new Date(enrollment.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                            : `Started ${new Date(enrollment.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          }
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Coach Notes Section */}
      <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('notes')}
          className="w-full flex items-center justify-between p-5 hover:bg-[#faf8f6]/50 dark:hover:bg-[#11141b]/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-accent" />
            <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
              Notes About This Client
            </h3>
          </div>
          {expandedSections.notes ? <ChevronUp className="w-5 h-5 text-[#5f5a55]" /> : <ChevronDown className="w-5 h-5 text-[#5f5a55]" />}
        </button>
        {expandedSections.notes && (
          <div className="px-5 pb-5">
            <textarea
              value={coachNotes}
              onChange={(e) => setCoachNotes(e.target.value)}
              placeholder="Add notes about this client..."
              rows={4}
              className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                Only you can see these notes
              </p>
              <div className="flex items-center gap-2">
                {notesSaved && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-albert flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Saved
                  </span>
                )}
                <button
                  onClick={handleSaveCoachNotes}
                  disabled={savingNotes}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 rounded-lg font-albert text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {savingNotes ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Notes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Call Scheduling Modal */}
      {user && (
        <ScheduleCallModal
          isOpen={showCallModal}
          onClose={() => setShowCallModal(false)}
          clientId={user.id}
          clientName={user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || 'Client'}
          onSuccess={() => {
            // Could refresh coaching data here if needed
          }}
        />
      )}

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
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Date</label>
              <DatePicker
                value={sessionDate}
                onChange={(date) => setSessionDate(date)}
                placeholder="Select date"
              />
            </div>
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Title</label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="e.g., Focus & Prioritization"
                className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 dark:focus:ring-brand-accent/30"
              />
            </div>
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Summary</label>
              <textarea
                value={sessionSummary}
                onChange={(e) => setSessionSummary(e.target.value)}
                placeholder="Brief summary of what was covered..."
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 dark:focus:ring-brand-accent/30 resize-none"
              />
            </div>
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Key Takeaways</label>
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
                    className="flex-1 px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 dark:focus:ring-brand-accent/30"
                  />
                  {sessionTakeaways.length > 1 && (
                    <button
                      onClick={() => setSessionTakeaways(sessionTakeaways.filter((_, i) => i !== index))}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setSessionTakeaways([...sessionTakeaways, ''])}
                className="text-[13px] text-brand-accent hover:underline font-albert"
              >
                + Add takeaway
              </button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={addingSession} className="font-albert rounded-full border-[#e1ddd8] dark:border-[#262b35]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAddSession}
              disabled={addingSession || !sessionTitle.trim() || !sessionDate}
              className="font-albert rounded-full bg-brand-accent hover:bg-brand-accent/90 dark:hover:bg-brand-accent dark:hover:bg-brand-accent/90 text-white"
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
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Notes about this client
              </label>
              <textarea
                value={currentNotes}
                onChange={(e) => setCurrentNotes(e.target.value)}
                placeholder="Your private notes about this client..."
                rows={5}
                className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 dark:focus:ring-brand-accent/30 resize-none"
              />
            </div>
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Planned topics for next session
              </label>
              <textarea
                value={plannedTopics}
                onChange={(e) => setPlannedTopics(e.target.value)}
                placeholder="Topics to cover in the next session..."
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/30 dark:focus:ring-brand-accent/30 resize-none"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingPrivateNotes} className="font-albert rounded-full border-[#e1ddd8] dark:border-[#262b35]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSavePrivateNotes}
              disabled={savingPrivateNotes}
              className="font-albert rounded-full bg-brand-accent hover:bg-brand-accent/90 dark:hover:bg-brand-accent dark:hover:bg-brand-accent/90 text-white"
            >
              {savingPrivateNotes ? 'Saving...' : 'Save Notes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send DM Modal */}
      {showDMModal && dmRecipient && (
        <SendDMModal
          recipients={[dmRecipient]}
          onClose={() => setShowDMModal(false)}
          channelId={coachingData?.chatChannelId}
        />
      )}

      {/* Support Needs Modal */}
      <SupportNeedsModal
        open={showSupportNeedsModal}
        onOpenChange={setShowSupportNeedsModal}
        onboarding={user?.onboarding}
        clientName={user?.firstName || user?.name?.split(' ')[0]}
      />

      {/* Past Sessions Modal */}
      {isMobile ? (
        <Drawer open={showPastSessionsModal} onOpenChange={setShowPastSessionsModal}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="border-b border-[#e1ddd8] dark:border-[#262b35]">
              <DrawerTitle className="font-albert text-[18px] font-semibold tracking-[-0.5px]">
                Past Sessions
              </DrawerTitle>
              <DrawerDescription className="font-albert text-[13px] text-[#8c8c8c] dark:text-[#7d8190]">
                {pastSessions.length} previous session{pastSessions.length !== 1 ? 's' : ''}
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)]">
              {pastSessions.length > 0 ? (
                <div className="space-y-3">
                  {pastSessions.map((session) => (
                    <div key={session.id} className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-albert text-[14px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                              {session.title}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              session.eventType === 'coaching_1on1'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {session.eventType === 'coaching_1on1' ? '1:1' : 'Group'}
                            </span>
                          </div>
                          <p className="font-albert text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                            {formatCallTime(session.startDateTime, session.timezone)}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-[12px] text-[#8c8c8c] dark:text-[#7d8190]">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {session.locationLabel}
                            </span>
                            {session.programName && (
                              <span className="flex items-center gap-1">
                                <GraduationCap className="w-3 h-3" />
                                {session.programName}
                              </span>
                            )}
                            {session.squadName && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {session.squadName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-10 h-10 mx-auto mb-2 text-[#c4bfb9] dark:text-[#7d8190]" />
                  <p className="font-albert text-[14px] text-[#8c8c8c] dark:text-[#7d8190]">
                    No past sessions yet
                  </p>
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showPastSessionsModal} onOpenChange={setShowPastSessionsModal}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-albert text-[18px] font-semibold tracking-[-0.5px]">
                Past Sessions
              </DialogTitle>
              <DialogDescription className="font-albert text-[13px] text-[#8c8c8c] dark:text-[#7d8190]">
                {pastSessions.length} previous session{pastSessions.length !== 1 ? 's' : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 pr-2">
              {pastSessions.length > 0 ? (
                <div className="space-y-3">
                  {pastSessions.map((session) => (
                    <div key={session.id} className="p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-albert text-[14px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                              {session.title}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              session.eventType === 'coaching_1on1'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {session.eventType === 'coaching_1on1' ? '1:1' : 'Group'}
                            </span>
                          </div>
                          <p className="font-albert text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                            {formatCallTime(session.startDateTime, session.timezone)}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-[12px] text-[#8c8c8c] dark:text-[#7d8190]">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {session.locationLabel}
                            </span>
                            {session.programName && (
                              <span className="flex items-center gap-1">
                                <GraduationCap className="w-3 h-3" />
                                {session.programName}
                              </span>
                            )}
                            {session.squadName && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {session.squadName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-10 h-10 mx-auto mb-2 text-[#c4bfb9] dark:text-[#7d8190]" />
                  <p className="font-albert text-[14px] text-[#8c8c8c] dark:text-[#7d8190]">
                    No past sessions yet
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

