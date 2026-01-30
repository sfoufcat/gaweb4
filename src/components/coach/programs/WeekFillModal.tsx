'use client';

/**
 * WeekFillModal
 *
 * Modal for filling a program week using AI from various sources:
 * - Sessions: Select from existing call recordings (with or without summaries)
 * - PDF: Upload and extract text from PDF documents
 * - Prompt: Custom instructions for generating content
 */

import React, { useState, useEffect, Fragment, useCallback, useRef } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  MessageSquare,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Target,
  StickyNote,
  ChevronRight,
  RefreshCw,
  Upload,
  Video,
  Trash2,
  Calendar,
  Wand2,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  ProgramWeek,
  ProgramTaskTemplate,
  UnifiedEvent,
  WeekFillSource,
  CallSummary,
} from '@/types';
import { extractPdfText, formatFileSize, type PdfExtractionResult } from '@/lib/pdf-utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type FillTarget = 'current' | 'next' | 'until_call';

const FILL_OPTIONS: { value: FillTarget; label: string }[] = [
  { value: 'current', label: 'Current week' },
  { value: 'next', label: 'Next week' },
  { value: 'until_call', label: 'Until next call' },
];

interface WeekFillResult {
  tasks: Array<{
    label: string;
    type: 'task' | 'reflection' | 'habit';
    isPrimary: boolean;
    estimatedMinutes?: number;
    notes?: string;
    tag?: string;
  }>;
  currentFocus: string[];
  notes?: string[];
  weekTheme?: string;
  weekDescription?: string;
}

interface WeekFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  week: ProgramWeek;
  onApply: (updates: Partial<ProgramWeek>) => Promise<void>;
  // Client context for 1:1 programs - when provided, filters sessions by client
  enrollmentId?: string;
  clientUserId?: string;
}

type FillSourceType = 'session' | 'pdf' | 'prompt';

// Session with potential summary data
interface SessionWithSummary extends UnifiedEvent {
  summaryId?: string;
  hasSummary?: boolean;
  hasRecording?: boolean;
}

// Inline upload recording button for compact row display
function InlineUploadRecordingButton({
  eventId,
  onUploaded,
}: {
  eventId: string;
  onUploaded: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [linkUrl, setLinkUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const handleLinkSubmit = async () => {
    if (!linkUrl.trim()) return;
    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch(`/api/events/${eventId}/recording`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingUrl: linkUrl.trim() }),
      });

      if (response.ok) {
        setIsOpen(false);
        setLinkUrl('');
        onUploaded();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save recording');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadComplete = () => {
    setIsOpen(false);
    onUploaded();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-brand-accent/10 hover:text-brand-accent transition-colors"
      >
        Add Recording
      </button>
    );
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-10 w-80 p-4 bg-white dark:bg-[#1e222a] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
          Add Recording
        </span>
        <button
          onClick={() => {
            setIsOpen(false);
            setLinkUrl('');
            setError(undefined);
            setMode('upload');
          }}
          className="p-1 rounded hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]"
        >
          <X className="w-4 h-4 text-[#5f5a55]" />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-[#f3f1ef] dark:bg-[#11141b] rounded-lg mb-3">
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'upload'
              ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
          }`}
        >
          Upload File
        </button>
        <button
          onClick={() => setMode('link')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'link'
              ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
              : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
          }`}
        >
          Paste Link
        </button>
      </div>

      {mode === 'upload' ? (
        <InlineRecordingUploadCompact
          eventId={eventId}
          onUploadComplete={handleUploadComplete}
        />
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e]"
          />

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            onClick={handleLinkSubmit}
            disabled={!linkUrl.trim() || isSubmitting}
            className="w-full px-3 py-2 text-sm font-medium bg-brand-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isSubmitting ? 'Saving...' : 'Save Link'}
          </button>
        </div>
      )}
    </div>
  );
}

// Compact version of InlineRecordingUpload for the popup
function InlineRecordingUploadCompact({
  eventId,
  onUploadComplete,
}: {
  eventId: string;
  onUploadComplete: () => void;
}) {
  // Import dynamically to avoid circular deps - use the existing component
  const [RecordingUpload, setRecordingUpload] = useState<React.ComponentType<{
    eventId: string;
    onUploadComplete?: () => void;
    variant?: 'default' | 'compact' | 'link';
  }> | null>(null);

  useEffect(() => {
    import('@/components/scheduling/InlineRecordingUpload').then((mod) => {
      setRecordingUpload(() => mod.InlineRecordingUpload);
    });
  }, []);

  if (!RecordingUpload) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
      </div>
    );
  }

  return (
    <RecordingUpload
      eventId={eventId}
      onUploadComplete={onUploadComplete}
      variant="compact"
    />
  );
}

// Inline summary generation button for compact row display
function InlineGenerateSummaryButton({
  eventId,
  onGenerated,
}: {
  eventId: string;
  onGenerated: (summaryId: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string>();

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setState('loading');
    setError(undefined);

    try {
      const response = await fetch(`/api/events/${eventId}/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onGenerated(data.summaryId);
      } else if (response.status === 402) {
        setError(`Need credits`);
        setState('error');
      } else {
        setError(data.error || 'Failed');
        setState('error');
      }
    } catch {
      setError('Error');
      setState('error');
    }
  };

  if (state === 'loading') {
    return (
      <button
        disabled
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-accent/10 text-brand-accent flex items-center gap-1.5"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Generating...
      </button>
    );
  }

  if (state === 'error') {
    return (
      <button
        onClick={handleGenerate}
        title={error}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1.5"
      >
        <AlertCircle className="w-3.5 h-3.5" />
        Retry
      </button>
    );
  }

  return (
    <button
      onClick={handleGenerate}
      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-brand-accent/10 hover:text-brand-accent transition-colors"
    >
      Get Summary (1 credit)
    </button>
  );
}

export function WeekFillModal({
  isOpen,
  onClose,
  programId,
  week,
  onApply,
  enrollmentId,
  clientUserId,
}: WeekFillModalProps) {
  // Source selection
  const [sourceType, setSourceType] = useState<FillSourceType>('session');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedSummaryId, setSelectedSummaryId] = useState<string>('');
  const [promptText, setPromptText] = useState('');

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtraction, setPdfExtraction] = useState<PdfExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available sessions (events with recordings)
  const [sessions, setSessions] = useState<SessionWithSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Full summary data (when using existing summary)
  const [selectedSummary, setSelectedSummary] = useState<CallSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // For client mode: show fill preview with timing options
  const [showFillPreview, setShowFillPreview] = useState(false);
  const [fillTarget, setFillTarget] = useState<FillTarget>('current');
  const [hasNextCall, setHasNextCall] = useState<boolean | null>(null);
  const [fillState, setFillState] = useState<'preview' | 'loading' | 'success' | 'error'>('preview');
  const [fillError, setFillError] = useState<string>();
  const [fillResult, setFillResult] = useState<{ daysUpdated: number; weeksUpdated: number }>();

  // Determine if we're in client mode (should use FillWeekPreviewModal)
  const isClientMode = !!enrollmentId;

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [result, setResult] = useState<WeekFillResult | null>(null);

  // Apply state
  const [isApplying, setIsApplying] = useState(false);

  // Fetch sessions (events with recordings) for this program
  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      // Fetch events for this program - include all statuses (except canceled)
      // to catch draft events without recordings
      // Include recurring events (parent events) since those are actual scheduled calls
      const eventsParams = new URLSearchParams({
        programId,
        status: 'all',
        includeInstances: 'false',
        limit: '100',
      });
      // Don't filter by eventType - we'll filter client-side for call types
      // This ensures we get all calls regardless of eventType variations

      // Fetch call summaries for this program
      const summariesParams = new URLSearchParams({
        programId,
        status: 'completed',
        limit: '50',
      });
      if (enrollmentId) {
        summariesParams.set('programEnrollmentId', enrollmentId);
      }

      // Fetch both in parallel
      const [eventsRes, summariesRes] = await Promise.all([
        fetch(`/api/events?${eventsParams}`),
        fetch(`/api/coach/call-summaries?${summariesParams}`),
      ]);

      let allEvents: UnifiedEvent[] = [];
      let summaries: CallSummary[] = [];

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        // Filter to call-type events (with or without recordings)
        const callTypes = ['coaching_1on1', 'cohort_call', 'squad_call'];
        allEvents = (eventsData.events || []).filter(
          (e: UnifiedEvent) => callTypes.includes(e.eventType || '')
        );
        console.log('[WeekFillModal] Fetched events:', allEvents.length, allEvents.map(e => ({ id: e.id, title: e.title, status: e.status, hasRecording: !!e.recordingUrl, callSummaryId: e.callSummaryId })));
      }

      if (summariesRes.ok) {
        const summariesData = await summariesRes.json();
        summaries = summariesData.summaries || [];
        console.log('[WeekFillModal] Fetched summaries:', summaries.length, summaries.map(s => ({ id: s.id, eventId: s.eventId, status: s.status })));
      }

      // Create map for eventId -> summary
      const eventIdToSummary = new Map<string, CallSummary>();
      // Also create map for callId -> summary (backup matching)
      const callIdToSummary = new Map<string, CallSummary>();

      for (const summary of summaries) {
        if (summary.eventId) {
          eventIdToSummary.set(summary.eventId, summary);
        }
        if (summary.callId) {
          callIdToSummary.set(summary.callId, summary);
        }
      }

      // Match events with their summaries
      const sessionsWithSummaryInfo: SessionWithSummary[] = allEvents.map(
        (event: UnifiedEvent) => {
          // Try to match by eventId first, then by callId as fallback
          let summaryId = eventIdToSummary.get(event.id)?.id;
          if (!summaryId && event.streamCallId) {
            summaryId = callIdToSummary.get(event.streamCallId)?.id;
          }
          // Also check if event already has callSummaryId set directly
          // (this is the most reliable indicator as it's set when summary is created)
          if (!summaryId && event.callSummaryId) {
            summaryId = event.callSummaryId;
          }

          const hasSummary = !!summaryId;

          return {
            ...event,
            summaryId,
            hasSummary,
            hasRecording: !!event.recordingUrl,
          };
        }
      );

      // Also include summaries that don't have matching events in our list
      // (they might be from events not linked to this program but still relevant)
      const eventIds = new Set(allEvents.map(e => e.id));
      for (const summary of summaries) {
        if (summary.eventId && !eventIds.has(summary.eventId)) {
          // This summary has an event we didn't fetch - create a synthetic session entry
          sessionsWithSummaryInfo.push({
            id: summary.eventId,
            title: 'Coaching Call',
            eventType: 'coaching_1on1',
            startDateTime: summary.callStartedAt || summary.createdAt,
            durationMinutes: summary.recordingDurationSeconds
              ? Math.round(summary.recordingDurationSeconds / 60)
              : undefined,
            recordingUrl: summary.recordingUrl,
            summaryId: summary.id,
            hasSummary: true,
            hasRecording: !!summary.recordingUrl,
          } as SessionWithSummary);
        }
      }

      // Sort by date, newest first
      sessionsWithSummaryInfo.sort((a, b) => {
        const dateA = a.startDateTime || '';
        const dateB = b.startDateTime || '';
        return dateB.localeCompare(dateA);
      });

      console.log('[WeekFillModal] Final sessions:', sessionsWithSummaryInfo.map(s => ({ id: s.id, title: s.title, hasSummary: s.hasSummary, hasRecording: s.hasRecording })));
      setSessions(sessionsWithSummaryInfo);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, [programId, enrollmentId]);

  // Load sessions when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSessions();
      // Reset state
      setResult(null);
      setGenerationError(null);
      setPromptText('');
      setPdfFile(null);
      setPdfExtraction(null);
      setSelectedSessionId('');
      setSelectedSummaryId('');
      setSelectedSummary(null);
      setShowFillPreview(false);
      setFillState('preview');
      setFillError(undefined);
      setFillResult(undefined);
      setHasNextCall(null);
      setFillTarget('current');
    }
  }, [isOpen, fetchSessions]);

  // Check for next call when entering fill preview mode
  useEffect(() => {
    if (!showFillPreview || !selectedSessionId) return;

    async function checkNextCall() {
      try {
        const response = await fetch(`/api/events/${selectedSessionId}/has-next-call`);
        if (response.ok) {
          const data = await response.json();
          setHasNextCall(data.hasNextCall);
          if (data.hasNextCall) {
            setFillTarget('until_call');
          }
        }
      } catch {
        setHasNextCall(false);
      }
    }
    checkNextCall();
  }, [showFillPreview, selectedSessionId]);

  // Get fill options based on whether there's a next call
  const fillOptions = hasNextCall === true
    ? FILL_OPTIONS
    : FILL_OPTIONS.filter(opt => opt.value !== 'until_call');

  // Handle fill week from summary (client mode)
  const handleFillFromSummary = async () => {
    if (!selectedSessionId) return;

    setFillState('loading');
    setFillError(undefined);

    try {
      const response = await fetch(`/api/events/${selectedSessionId}/fill-week-from-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fillTarget }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setFillResult({
          daysUpdated: data.daysUpdated || 0,
          weeksUpdated: data.weeksUpdated || 0,
        });
        setFillState('success');
      } else {
        setFillError(data.error || 'Failed to fill week');
        setFillState('error');
      }
    } catch {
      setFillError('Network error. Please try again.');
      setFillState('error');
    }
  };

  // Get priority badge variant
  const getPriorityVariant = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  // Handle PDF file selection
  const handlePdfSelect = async (file: File) => {
    setPdfFile(file);
    setIsExtracting(true);
    setPdfExtraction(null);

    try {
      const result = await extractPdfText(file);
      setPdfExtraction(result);
    } catch (error) {
      setPdfExtraction({
        success: false,
        text: '',
        pageCount: 0,
        charCount: 0,
        truncated: false,
        error: error instanceof Error ? error.message : 'Failed to extract PDF',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePdfSelect(file);
    }
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      handlePdfSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Clear PDF
  const clearPdf = () => {
    setPdfFile(null);
    setPdfExtraction(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fetch full summary data when a summary is selected
  const fetchSummaryData = useCallback(async (summaryId: string) => {
    setLoadingSummary(true);
    try {
      const res = await fetch(`/api/coach/call-summaries/${summaryId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSummary(data.summary || data);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // When a summary is selected, fetch the full data
  useEffect(() => {
    if (selectedSummaryId && sourceType === 'session') {
      fetchSummaryData(selectedSummaryId);
    } else {
      setSelectedSummary(null);
    }
  }, [selectedSummaryId, sourceType, fetchSummaryData]);

  // Convert existing CallSummary to WeekFillResult (no AI call needed!)
  const convertSummaryToResult = (summary: CallSummary): WeekFillResult => {
    // Convert actionItems to tasks
    const tasks = summary.actionItems
      .filter(item => item.assignedTo === 'client' || item.assignedTo === 'both')
      .map(item => ({
        label: item.description,
        type: 'task' as const,
        isPrimary: item.priority === 'high',
        tag: item.category,
      }));

    // Use weekContent if available (pre-generated during summary creation)
    const weekContent = summary.weekContent || {};

    return {
      tasks,
      currentFocus: weekContent.goals || weekContent.currentFocus || [],
      notes: weekContent.notes || [],
      weekTheme: weekContent.theme,
      weekDescription: weekContent.description,
    };
  };

  // Check if can generate
  const canGenerate = () => {
    if (sourceType === 'session') {
      return !!selectedSummaryId;
    }
    if (sourceType === 'prompt') {
      return promptText.trim().length >= 50;
    }
    if (sourceType === 'pdf') {
      return pdfExtraction?.success && pdfExtraction.text.length >= 50;
    }
    return false;
  };

  // Generate content
  const handleGenerate = async () => {
    if (!canGenerate()) return;

    // In client mode with session selected, show fill preview instead
    // Check selectedSummaryId (not selectedSummary) because summary might still be loading
    if (isClientMode && sourceType === 'session' && selectedSummaryId) {
      // If summary is still loading, wait for it
      if (loadingSummary) {
        return; // Button should be disabled anyway, but just in case
      }
      // If we have the summary, show the preview
      if (selectedSummary) {
        setShowFillPreview(true);
        return;
      }
      // If no summary loaded yet but we have an ID, fetch it first then show preview
      // This shouldn't happen normally since useEffect fetches it, but just in case
      setGenerationError('Please wait for the summary to load');
      return;
    }

    // For session mode, ensure summary is fully loaded before proceeding
    if (sourceType === 'session') {
      if (loadingSummary) {
        setGenerationError('Please wait for the summary to load');
        return;
      }
      if (!selectedSummary) {
        setGenerationError('Summary not found. Please select a session with a summary.');
        return;
      }
    }

    setIsGenerating(true);
    setGenerationError(null);
    setResult(null);

    try {
      // For sessions with existing summaries (template mode), use the data directly - no AI call needed!
      if (sourceType === 'session' && selectedSummary) {
        const convertedResult = convertSummaryToResult(selectedSummary);
        setResult(convertedResult);
        setIsGenerating(false);
        return;
      }

      // For prompt/PDF sources, call AI endpoint
      const source: {
        type: 'call_summary' | 'prompt' | 'pdf';
        summaryId?: string;
        prompt?: string;
        pdfText?: string;
      } = {
        type: sourceType === 'session' ? 'call_summary' : sourceType,
      };

      if (sourceType === 'session') {
        source.summaryId = selectedSummaryId;
      } else if (sourceType === 'prompt') {
        source.prompt = promptText;
      } else if (sourceType === 'pdf') {
        source.pdfText = pdfExtraction?.text || '';
      }

      const res = await fetch('/api/ai/fill-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId,
          weekId: week.id,
          source,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate content');
      }

      setResult(data.result);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle summary generation from session
  const handleSummaryGenerated = (eventId: string, summaryId: string) => {
    // Update the session with the new summary
    setSessions((prev) =>
      prev.map((s) =>
        s.id === eventId ? { ...s, summaryId, hasSummary: true } : s
      )
    );
    // Auto-select this summary
    setSelectedSessionId(eventId);
    setSelectedSummaryId(summaryId);
  };

  // Apply result to week
  const handleApply = async () => {
    if (!result) return;

    setIsApplying(true);
    try {
      // Convert result to ProgramWeek updates
      const tasks: ProgramTaskTemplate[] = result.tasks.map((t) => ({
        label: t.label,
        type: t.type === 'reflection' ? 'task' : t.type,
        isPrimary: t.isPrimary,
        estimatedMinutes: t.estimatedMinutes,
        notes: t.notes,
        tag: t.tag,
      }));

      const fillSource: WeekFillSource = {
        type:
          sourceType === 'session'
            ? 'call_summary'
            : sourceType === 'pdf'
            ? 'pdf'
            : 'ai_prompt',
        sourceId: sourceType === 'session' ? selectedSummaryId : undefined,
        sourceName: getSourceName(),
        generatedAt: new Date().toISOString(),
      };

      const updates: Partial<ProgramWeek> = {
        weeklyTasks: tasks,
        currentFocus: result.currentFocus,
        notes: result.notes,
        theme: result.weekTheme || week.theme,
        description: result.weekDescription || week.description,
        fillSource,
      };

      await onApply(updates);
      onClose();
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to apply content');
    } finally {
      setIsApplying(false);
    }
  };

  // Get source name for tracking
  const getSourceName = (): string => {
    if (sourceType === 'session') {
      const session = sessions.find((s) => s.id === selectedSessionId);
      if (session) {
        const date = new Date(session.startDateTime || '').toLocaleDateString();
        return `Session - ${date}`;
      }
      return 'Session';
    }
    if (sourceType === 'pdf') {
      return pdfFile?.name || 'PDF Upload';
    }
    return 'Custom Prompt';
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get week display name
  const getWeekDisplayName = () => {
    if (week.weekNumber === 0) return 'Onboarding';
    return `Week ${week.weekNumber}`;
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-2xl max-h-[85vh] transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] shadow-2xl transition-all flex flex-col">
                {/* Header */}
                <div className="relative px-6 pt-6 pb-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-3">
                    {showFillPreview && (
                      <button
                        onClick={() => {
                          setShowFillPreview(false);
                          setFillState('preview');
                        }}
                        className="p-2 -ml-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center">
                      {showFillPreview ? (
                        <Wand2 className="w-5 h-5 text-brand-accent" />
                      ) : (
                        <Sparkles className="w-5 h-5 text-brand-accent" />
                      )}
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {showFillPreview ? 'Fill Week from Summary' : `Fill ${getWeekDisplayName()} with AI`}
                      </Dialog.Title>
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        {showFillPreview
                          ? 'Review and apply tasks from your coaching call'
                          : 'Generate tasks, focus areas, and notes from a source'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 min-h-0 overflow-y-auto">
                  <AnimatePresence mode="wait">
                    {showFillPreview && selectedSummary ? (
                      /* Fill Preview Mode (client mode) */
                      <motion.div
                        key="fill-preview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        {/* Success State */}
                        {fillState === 'success' && fillResult && (
                          <div className="p-6 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/60">
                            <div className="flex flex-col items-center text-center gap-3">
                              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                              <div>
                                <p className="text-lg font-semibold font-albert text-emerald-700 dark:text-emerald-300">
                                  Tasks Created!
                                </p>
                                <p className="text-sm font-albert text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                                  {fillResult.daysUpdated} day{fillResult.daysUpdated !== 1 ? 's' : ''} updated
                                  {fillResult.weeksUpdated > 1 ? ` across ${fillResult.weeksUpdated} weeks` : ''}
                                </p>
                              </div>
                              <button
                                onClick={onClose}
                                className="mt-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold font-albert transition-colors"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Error State */}
                        {fillState === 'error' && (
                          <div className="p-4 rounded-xl bg-red-50/70 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/60">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold font-albert text-red-700 dark:text-red-300">
                                  Failed to create tasks
                                </p>
                                <p className="text-sm font-albert text-red-600/80 dark:text-red-400/80 mt-1">{fillError}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setFillState('preview')}
                              className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold font-albert text-red-600 dark:text-red-400 bg-white dark:bg-red-900/30 border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
                            >
                              Try Again
                            </button>
                          </div>
                        )}

                        {/* Loading State */}
                        {fillState === 'loading' && (
                          <div className="py-12 flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
                            <div className="text-center">
                              <p className="text-base font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                                Creating tasks...
                              </p>
                              <p className="text-sm font-albert text-[#8a857f] dark:text-[#9a969f] mt-1">
                                Converting action items to program tasks
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Preview State */}
                        {fillState === 'preview' && (
                          <>
                            {/* Client Tasks */}
                            {(() => {
                              const clientItems = selectedSummary.actionItems?.filter(
                                i => i.assignedTo === 'client' || i.assignedTo === 'both'
                              ) || [];
                              return clientItems.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-1.5 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                                    Client Tasks ({clientItems.length})
                                  </h4>
                                  <div className="space-y-1.5">
                                    {clientItems.map((item) => (
                                      <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#f5f3f0] dark:bg-[#1e222a] border border-[#e5e1dc] dark:border-[#2a2f3a]">
                                        <Badge variant={getPriorityVariant(item.priority)} className="shrink-0 text-xs font-albert">
                                          {item.priority}
                                        </Badge>
                                        <span className="flex-1 text-sm text-[#3a3a3a] dark:text-[#e0e0e5] font-albert">
                                          {item.description}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Week Content Preview */}
                            {selectedSummary.weekContent && (selectedSummary.weekContent.theme || selectedSummary.weekContent.description || selectedSummary.weekContent.notes?.length || selectedSummary.weekContent.goals?.length || selectedSummary.weekContent.currentFocus?.length) && (
                              <div className="space-y-2 p-3 rounded-xl bg-amber-50/40 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-700/30">
                                {selectedSummary.weekContent.theme && (
                                  <div>
                                    <h4 className="text-xs font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-0.5">
                                      Weekly Theme
                                    </h4>
                                    <p className="text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2] italic">
                                      {selectedSummary.weekContent.theme}
                                    </p>
                                  </div>
                                )}
                                {selectedSummary.weekContent.description && (
                                  <div>
                                    <h4 className="text-xs font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-0.5">
                                      Description
                                    </h4>
                                    <p className="text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2] line-clamp-2">
                                      {selectedSummary.weekContent.description}
                                    </p>
                                  </div>
                                )}
                                {selectedSummary.weekContent.notes && selectedSummary.weekContent.notes.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 flex items-center gap-1.5">
                                      <StickyNote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                      Week Notes
                                    </h4>
                                    <ul className="space-y-1">
                                      {selectedSummary.weekContent.notes.map((note, idx) => (
                                        <li key={idx} className="text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2] pl-2.5 border-l-2 border-amber-400/60 dark:border-amber-500/40">
                                          {note}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {(selectedSummary.weekContent.goals?.length || selectedSummary.weekContent.currentFocus?.length) ? (
                                  <div>
                                    <h4 className="text-xs font-semibold font-albert text-[#1a1a1a] dark:text-[#f5f5f8] mb-1 flex items-center gap-1.5">
                                      <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                      Goals
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                      {(selectedSummary.weekContent.goals || selectedSummary.weekContent.currentFocus || []).map((goal, idx) => (
                                        <span
                                          key={idx}
                                          className="px-2 py-0.5 text-xs font-medium font-albert bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md"
                                        >
                                          {goal}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {/* Fill Target Selection */}
                            <div className="pt-4 border-t border-[#e8e4df] dark:border-[#2a2f3a]">
                              <div className="flex items-center gap-2 mb-3">
                                <Calendar className="w-4 h-4 text-[#8a857f] dark:text-[#9a969f]" />
                                <h4 className="text-sm font-medium font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                                  Add tasks to:
                                </h4>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {fillOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={() => setFillTarget(option.value)}
                                    className={cn(
                                      "flex items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                                      fillTarget === option.value
                                        ? "border-brand-accent bg-brand-accent/5"
                                        : "border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50"
                                    )}
                                  >
                                    <span className={cn(
                                      "text-sm font-semibold font-albert",
                                      fillTarget === option.value
                                        ? "text-brand-accent"
                                        : "text-[#5f5a55] dark:text-[#b2b6c2]"
                                    )}>
                                      {option.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </motion.div>
                    ) : !result ? (
                      <motion.div
                        key="source-selection"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        {/* Source Tabs */}
                        <Tab.Group
                          selectedIndex={
                            sourceType === 'session'
                              ? 0
                              : sourceType === 'prompt'
                              ? 1
                              : 2
                          }
                          onChange={(index) =>
                            setSourceType(
                              index === 0
                                ? 'session'
                                : index === 1
                                ? 'prompt'
                                : 'pdf'
                            )
                          }
                        >
                          <Tab.List className="flex gap-1 p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl">
                            <Tab
                              className={({ selected }) =>
                                `flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                  selected
                                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                                    : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                                }`
                              }
                            >
                              <Video className="w-4 h-4" />
                              Sessions
                            </Tab>
                            <Tab
                              className={({ selected }) =>
                                `flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                  selected
                                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                                    : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                                }`
                              }
                            >
                              <Sparkles className="w-4 h-4" />
                              Prompt
                            </Tab>
                            <Tab
                              className={({ selected }) =>
                                `flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                  selected
                                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                                    : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                                }`
                              }
                            >
                              <FileText className="w-4 h-4" />
                              PDF
                            </Tab>
                          </Tab.List>

                          <Tab.Panels className="mt-4">
                            {/* Sessions Panel */}
                            <Tab.Panel className="space-y-4">
                              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                Select a session with a summary to fill this week. Using existing summaries is free!
                              </p>

                              {loadingSessions ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
                                </div>
                              ) : sessions.length === 0 ? (
                                <div className="text-center py-8 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
                                  <Video className="w-8 h-8 mx-auto text-[#a7a39e] dark:text-[#7d8190] mb-2" />
                                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                    No sessions found
                                  </p>
                                  <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1">
                                    Schedule a coaching call first
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {sessions.map((session) => (
                                    <div
                                      key={session.id}
                                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                                        selectedSessionId === session.id
                                          ? 'border-brand-accent bg-brand-accent/5'
                                          : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d4cfc9] dark:hover:border-[#3a4150]'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                                            {session.title || 'Coaching Call'}
                                          </p>
                                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                                            {session.startDateTime
                                              ? formatDate(session.startDateTime)
                                              : 'No date'}
                                            {session.durationMinutes && (
                                              <span className="ml-2">
                                                · {session.durationMinutes} min
                                              </span>
                                            )}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2 relative">
                                          {session.hasSummary ? (
                                            // Has summary - show Use Summary button
                                            <button
                                              onClick={() => {
                                                setSelectedSessionId(session.id);
                                                setSelectedSummaryId(session.summaryId || '');
                                                // Set loading immediately to prevent race condition
                                                if (session.summaryId) {
                                                  setLoadingSummary(true);
                                                }
                                              }}
                                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                                selectedSessionId === session.id
                                                  ? 'bg-brand-accent text-white'
                                                  : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#2d333e]'
                                              }`}
                                            >
                                              {selectedSessionId === session.id ? (
                                                <span className="flex items-center gap-1">
                                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                                  Selected
                                                </span>
                                              ) : (
                                                'Use Summary'
                                              )}
                                            </button>
                                          ) : session.hasRecording ? (
                                            // Has recording but no summary - show Get Summary button
                                            <InlineGenerateSummaryButton
                                              eventId={session.id}
                                              onGenerated={(summaryId) =>
                                                handleSummaryGenerated(session.id, summaryId)
                                              }
                                            />
                                          ) : (
                                            // No recording - show Upload Recording button
                                            <InlineUploadRecordingButton
                                              eventId={session.id}
                                              onUploaded={() => fetchSessions()}
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </Tab.Panel>

                            {/* Prompt Panel */}
                            <Tab.Panel className="space-y-4">
                              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                Describe what you want for this week. Include goals, themes, and specific areas to focus on.
                              </p>
                              <textarea
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                placeholder="E.g., This week the client should focus on setting up their morning routine. They mentioned wanting to wake up at 6am and exercise before work. Key challenges include managing energy levels and building consistency..."
                                rows={6}
                                className="w-full px-4 py-3 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm resize-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
                              />
                              <p className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                                Minimum 50 characters required.{' '}
                                {promptText.length}/50
                              </p>
                            </Tab.Panel>

                            {/* PDF Panel */}
                            <Tab.Panel className="space-y-4">
                              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                Upload a PDF document (intake form, notes, etc.) to extract content for this week.
                              </p>

                              {!pdfFile ? (
                                <div
                                  onDrop={handleDrop}
                                  onDragOver={handleDragOver}
                                  onClick={() => fileInputRef.current?.click()}
                                  className="border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-8 text-center cursor-pointer hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-colors"
                                >
                                  <Upload className="w-8 h-8 mx-auto text-[#a7a39e] dark:text-[#7d8190] mb-3" />
                                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-1">
                                    Drop a PDF here or click to upload
                                  </p>
                                  <p className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                                    Maximum file size: 10MB
                                  </p>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={handleFileChange}
                                    className="hidden"
                                  />
                                </div>
                              ) : (
                                <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                                          {pdfFile.name}
                                        </p>
                                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                                          {formatFileSize(pdfFile.size)}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={clearPdf}
                                      className="p-1.5 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] text-[#5f5a55] hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {isExtracting ? (
                                    <div className="mt-4 flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Extracting text...
                                    </div>
                                  ) : pdfExtraction ? (
                                    <div className="mt-4">
                                      {pdfExtraction.success ? (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>
                                              Extracted {pdfExtraction.charCount.toLocaleString()} characters
                                              {pdfExtraction.pageCount > 0 && (
                                                <span className="text-[#5f5a55] dark:text-[#b2b6c2]">
                                                  {' '}from {pdfExtraction.pageCount} pages
                                                </span>
                                              )}
                                            </span>
                                          </div>
                                          {pdfExtraction.truncated && (
                                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                              Content was truncated to stay within limits
                                            </p>
                                          )}
                                          <div className="p-3 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-lg text-xs text-[#5f5a55] dark:text-[#b2b6c2] max-h-24 overflow-y-auto">
                                            {pdfExtraction.text.slice(0, 500)}
                                            {pdfExtraction.text.length > 500 && '...'}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                                          <AlertCircle className="w-4 h-4" />
                                          <span>{pdfExtraction.error}</span>
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </Tab.Panel>
                          </Tab.Panels>
                        </Tab.Group>

                        {/* Error */}
                        {generationError && (
                          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">{generationError}</span>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="result-preview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        {/* Result Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                              Content Generated
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResult(null)}
                            className="text-[#5f5a55] hover:text-[#1a1a1a]"
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Regenerate
                          </Button>
                        </div>

                        {/* Theme & Description */}
                        {(result.weekTheme || result.weekDescription) && (
                          <div className="p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl space-y-2">
                            {result.weekTheme && (
                              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                                Theme: {result.weekTheme}
                              </p>
                            )}
                            {result.weekDescription && (
                              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                {result.weekDescription}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Tasks */}
                        <div>
                          <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Tasks ({result.tasks.length})
                          </h4>
                          <div className="space-y-2">
                            {result.tasks.map((task, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg"
                              >
                                <div
                                  className={`mt-0.5 w-2 h-2 rounded-full ${
                                    task.isPrimary
                                      ? 'bg-brand-accent'
                                      : 'bg-[#d4cfc9] dark:bg-[#4a5261]'
                                  }`}
                                />
                                <div className="flex-1">
                                  <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                                    {task.label}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs px-2 py-0.5 bg-[#e8e4df] dark:bg-[#262b35] rounded text-[#5f5a55] dark:text-[#b2b6c2]">
                                      {task.type}
                                    </span>
                                    {task.isPrimary && (
                                      <span className="text-xs px-2 py-0.5 bg-brand-accent/10 text-brand-accent rounded">
                                        Primary
                                      </span>
                                    )}
                                    {task.estimatedMinutes && (
                                      <span className="text-xs text-[#a7a39e] dark:text-[#7d8190]">
                                        {task.estimatedMinutes}min
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Current Focus */}
                        <div>
                          <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Current Focus ({result.currentFocus.length})
                          </h4>
                          <div className="space-y-2">
                            {result.currentFocus.map((focus, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg"
                              >
                                <ChevronRight className="w-4 h-4 text-brand-accent" />
                                <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                                  {focus}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Notes */}
                        {result.notes && result.notes.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 flex items-center gap-2">
                              <StickyNote className="w-4 h-4" />
                              Notes ({result.notes.length})
                            </h4>
                            <div className="space-y-2">
                              {result.notes.map((note, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 p-2 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg"
                                >
                                  <span className="w-2 h-2 rounded-full bg-[#a7a39e]" />
                                  <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                    {note}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Apply Error */}
                        {generationError && (
                          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">{generationError}</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-end gap-3">
                  {showFillPreview ? (
                    /* Fill Preview Footer (client mode) */
                    fillState === 'preview' && (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setShowFillPreview(false);
                            setFillState('preview');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleFillFromSummary}
                          className="flex items-center gap-2"
                        >
                          Fill Week
                          <Wand2 className="w-4 h-4" />
                        </Button>
                      </>
                    )
                  ) : (
                    /* Normal Footer */
                    <>
                      <Button variant="ghost" onClick={onClose}>
                        Cancel
                      </Button>

                      {!result ? (
                        <Button
                          onClick={handleGenerate}
                          disabled={!canGenerate() || isGenerating || (sourceType === 'session' && loadingSummary)}
                          className="flex items-center gap-2"
                        >
                          {isGenerating || (sourceType === 'session' && loadingSummary) ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {loadingSummary ? 'Loading...' : 'Generating...'}
                            </>
                          ) : sourceType === 'session' && selectedSummary ? (
                            // Using existing summary - no AI credit needed
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              Fill Week
                            </>
                          ) : (
                            // Prompt/PDF needs AI generation
                            <>
                              <Sparkles className="w-4 h-4" />
                              Fill Week
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleApply}
                          disabled={isApplying}
                          className="flex items-center gap-2"
                        >
                          {isApplying ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              Apply to Week
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
