'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import { 
  Calendar, 
  MessageCircle, 
  Download, 
  CheckCircle2, 
  Circle,
  Target,
  ClipboardList,
  History,
  BookOpen,
  HelpCircle,
  Mail,
  Linkedin,
  Instagram,
  ExternalLink,
  ChevronRight,
  X
} from 'lucide-react';
import { isSuperAdmin } from '@/lib/admin-utils-shared';
import type { ClientCoachingData, Coach, UserRole, CoachingSessionHistory } from '@/types';

/**
 * My Coach Page
 * 
 * Client-facing coaching interface visible only to:
 * - Users with coaching === true in publicMetadata
 * - Super admins (for debugging/testing)
 * 
 * Sections:
 * A. Coach Header
 * B. Next Call Card
 * C. Current Focus
 * D. Action Items (Homework)
 * E. Session History
 * F. Resources From Your Coach
 * G. How Coaching Works (Static Info)
 */

// Helper to format date in timezone
function formatDateInTimezone(date: Date, timezone: string): { date: string; time: string; tzAbbrev: string } {
  try {
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      day: 'numeric',
      month: 'long',
    });
    
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const tzParts = tzFormatter.formatToParts(date);
    const tzAbbrev = tzParts.find(p => p.type === 'timeZoneName')?.value || timezone;
    
    return {
      date: dateFormatter.format(date),
      time: timeFormatter.format(date),
      tzAbbrev,
    };
  } catch {
    return {
      date: date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      tzAbbrev: 'UTC',
    };
  }
}

function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

// Session Detail Modal
function SessionDetailModal({ 
  session, 
  onClose 
}: { 
  session: CoachingSessionHistory; 
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#171b22] rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-albert text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                {session.title}
              </h2>
              <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                {new Date(session.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
          </div>

          {/* Summary */}
          {session.summary && (
            <div className="mb-6">
              <h3 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Summary</h3>
              <p className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                {session.summary}
              </p>
            </div>
          )}

          {/* Key Takeaways */}
          {session.takeaways && session.takeaways.length > 0 && (
            <div>
              <h3 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">Key Takeaways</h3>
              <ul className="space-y-2">
                {session.takeaways.map((takeaway, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#a07855] dark:text-[#b8896a] mt-0.5 shrink-0" />
                    <span className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyCoachPage() {
  const router = useRouter();
  const { sessionClaims, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  // Data states
  const [coachingData, setCoachingData] = useState<ClientCoachingData | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [selectedSession, setSelectedSession] = useState<CoachingSessionHistory | null>(null);

  // Get role and coaching status from Clerk session
  const publicMetadata = sessionClaims?.publicMetadata as {
    coaching?: boolean; // Legacy flag
    coachingStatus?: 'none' | 'active' | 'canceled' | 'past_due'; // New field
    role?: UserRole;
  } | undefined;

  const role = publicMetadata?.role;
  // Check both new coachingStatus and legacy coaching flag for backward compatibility
  const hasCoaching = publicMetadata?.coachingStatus === 'active' || publicMetadata?.coaching === true;
  const isSuperAdminUser = isSuperAdmin(role);
  const hasAccess = hasCoaching || isSuperAdminUser;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check authorization
  useEffect(() => {
    if (isLoaded && mounted && !hasAccess) {
      // Redirect to pricing if no coaching access
      router.push('/get-coach');
    }
  }, [hasAccess, isLoaded, router, mounted]);

  // Fetch coaching data
  useEffect(() => {
    const fetchData = async () => {
      if (!isLoaded || !mounted || !hasAccess) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/coaching/data');
        if (!response.ok) {
          if (response.status === 403) {
            router.push('/get-coach');
            return;
          }
          throw new Error('Failed to fetch coaching data');
        }

        const data = await response.json();
        setCoachingData(data.data);
        setCoach(data.coach);
      } catch (err) {
        console.error('Error fetching coaching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load coaching data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isLoaded, mounted, hasAccess, router]);

  // Handle action item toggle
  const handleToggleActionItem = async (itemId: string, completed: boolean) => {
    if (updatingItems.has(itemId)) return;

    setUpdatingItems(prev => new Set(prev).add(itemId));

    try {
      const response = await fetch(`/api/coaching/action-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      });

      if (!response.ok) {
        throw new Error('Failed to update action item');
      }

      // Update local state
      if (coachingData) {
        setCoachingData({
          ...coachingData,
          actionItems: coachingData.actionItems.map(item =>
            item.id === itemId
              ? { ...item, completed: !completed, completedAt: !completed ? new Date().toISOString() : undefined }
              : item
          ),
        });
      }
    } catch (err) {
      console.error('Error toggling action item:', err);
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  // Handle calendar download
  const handleAddToCalendar = async () => {
    const link = document.createElement('a');
    link.href = '/api/coaching/call.ics';
    link.download = 'coaching-call.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle go to chat
  const handleGoToChat = () => {
    if (coachingData?.chatChannelId) {
      router.push(`/chat?channel=${coachingData.chatChannelId}`);
    }
  };

  // Calculate call time info
  const callTimeInfo = coachingData?.nextCall?.datetime
    ? (() => {
        const callDate = new Date(coachingData.nextCall.datetime);
        const callTimezone = coachingData.nextCall.timezone || 'UTC';
        const userTimezone = getUserTimezone();
        const sameTimezone = callTimezone === userTimezone;

        return {
          coachTime: formatDateInTimezone(callDate, callTimezone),
          userTime: formatDateInTimezone(callDate, userTimezone),
          sameTimezone,
        };
      })()
    : null;

  // Loading state
  if (!isLoaded || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#faf8f6] to-[#f5f2ed]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] font-albert">Loading...</p>
        </div>
      </div>
    );
  }

  // Unauthorized - will redirect
  if (!hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="px-4 sm:px-8 lg:px-16 py-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 font-albert tracking-[-1px]">
            My Coach
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Your personal coaching dashboard
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-6">
            <p className="text-red-600 dark:text-red-400 font-albert mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-albert"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading your coaching data...</p>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <div className="space-y-6 max-w-4xl">
            
            {/* ================================================================
                SECTION A: Coach Header
            ================================================================ */}
            <div className="bg-white/80 dark:bg-[#171b22] backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35] rounded-3xl p-6 shadow-sm">
              {coach ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  {/* Coach Photo */}
                  <div className="shrink-0">
                    {coach.imageUrl ? (
                      <Image
                        src={coach.imageUrl}
                        alt={coach.name}
                        width={80}
                        height={80}
                        className="w-20 h-20 rounded-2xl object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#a07855] to-[#7d5c3e] flex items-center justify-center text-white text-2xl font-albert font-bold">
                        {coach.name?.charAt(0) || 'C'}
                      </div>
                    )}
                  </div>
                  
                  {/* Coach Info */}
                  <div className="flex-1">
                    <h2 className="font-albert text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                      {coach.name}
                    </h2>
                    {coach.title && (
                      <p className="font-albert text-[15px] text-[#a07855] dark:text-[#b8896a] font-medium">
                        {coach.title}
                      </p>
                    )}
                    {coach.email && (
                      <div className="flex items-center gap-2 mt-2 text-[#5f5a55] dark:text-[#b2b6c2]">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${coach.email}`} className="font-albert text-sm hover:text-[#a07855] dark:text-[#b8896a] dark:hover:text-[#b8896a] transition-colors">
                          {coach.email}
                        </a>
                      </div>
                    )}
                    
                    {/* Social Links */}
                    {(coach.linkedinUrl || coach.instagramHandle) && (
                      <div className="flex items-center gap-3 mt-3">
                        {coach.linkedinUrl && (
                          <a
                            href={coach.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-full bg-[#f3f1ef] dark:bg-[#222631] hover:bg-[#e9e5e0] dark:hover:bg-[#262b35] transition-colors"
                          >
                            <Linkedin className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                          </a>
                        )}
                        {coach.instagramHandle && (
                          <a
                            href={`https://instagram.com/${coach.instagramHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-full bg-[#f3f1ef] dark:bg-[#222631] hover:bg-[#e9e5e0] dark:hover:bg-[#262b35] transition-colors"
                          >
                            <Instagram className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Chat Button */}
                  {coachingData?.chatChannelId && (
                    <button
                      onClick={handleGoToChat}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] rounded-full font-albert text-[15px] font-medium text-white transition-colors shrink-0"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Message Coach
                    </button>
                  )}
                </div>
              ) : (
                /* No Coach Assigned Yet */
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-2xl bg-[#f3f1ef] dark:bg-[#222631] flex items-center justify-center mx-auto mb-4">
                    <HelpCircle className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]" />
                  </div>
                  <h2 className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    Your coach will be assigned soon
                  </h2>
                  <p className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] max-w-md mx-auto">
                    If you have questions, contact support at{' '}
                    <a href="mailto:hi@growthaddicts.com" className="text-[#a07855] dark:text-[#b8896a] hover:underline">
                      hi@growthaddicts.com
                    </a>
                  </p>
                </div>
              )}
            </div>

            {/* ================================================================
                SECTION B: Next Call Card
            ================================================================ */}
            <div className="bg-white/80 dark:bg-[#171b22] backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35] rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                  Next coaching call
                </h3>
              </div>

              {callTimeInfo ? (
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Call Details */}
                  <div className="space-y-2">
                    <p className="font-albert text-[15px] text-[#1a1a1a]">
                      <span className="font-medium">{callTimeInfo.coachTime.date}</span>
                      {' · '}
                      <span>{callTimeInfo.coachTime.time} {callTimeInfo.coachTime.tzAbbrev}</span>
                      {!callTimeInfo.sameTimezone && (
                        <span className="text-[#5f5a55]">
                          {' '}({callTimeInfo.userTime.time} your time)
                        </span>
                      )}
                    </p>

                    {coachingData?.nextCall?.location && (
                      <p className="font-albert text-[14px] text-[#5f5a55]">
                        <span className="font-medium text-[#1a1a1a]">Location:</span>{' '}
                        {coachingData.nextCall.location.startsWith('http') ? (
                          <a
                            href={coachingData.nextCall.location}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#a07855] dark:text-[#b8896a] hover:underline"
                          >
                            {coachingData.nextCall.location}
                          </a>
                        ) : (
                          coachingData.nextCall.location
                        )}
                      </p>
                    )}

                    {coach && (
                      <div className="flex items-center gap-1.5 font-albert text-[14px] text-[#5f5a55]">
                        <span className="font-medium text-[#1a1a1a]">With:</span>
                        <span>{coach.name}</span>
                        {coach.imageUrl && (
                          <Image
                            src={coach.imageUrl}
                            alt=""
                            width={20}
                            height={20}
                            className="rounded-full object-cover"
                            unoptimized
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
                    <button
                      onClick={handleAddToCalendar}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f3f1ef] hover:bg-[#e9e5e0] rounded-full font-albert text-[14px] font-medium text-[#1a1a1a] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Add to calendar
                    </button>

                    {coachingData?.chatChannelId && (
                      <button
                        onClick={handleGoToChat}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] rounded-full font-albert text-[14px] font-medium text-white transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Go to chat
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* No Call Scheduled */
                <div className="text-center py-4">
                  <p className="font-albert text-[15px] text-[#5f5a55]">
                    No upcoming coaching call scheduled yet.
                  </p>
                  <p className="font-albert text-[14px] text-[#8c8c8c] mt-1">
                    Your coach will schedule your next call soon.
                  </p>
                </div>
              )}
            </div>

            {/* ================================================================
                SECTION C: Current Focus
            ================================================================ */}
            <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                  Current Focus
                </h3>
              </div>

              {coachingData?.focusAreas && coachingData.focusAreas.length > 0 ? (
                <ul className="space-y-2">
                  {coachingData.focusAreas.map((focus, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-[#a07855] dark:text-[#b8896a] mt-0.5">–</span>
                      <span className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">{focus}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-albert text-[15px] text-[#8c8c8c] dark:text-[#7d8190] text-center py-4">
                  Your coach will update your focus areas soon.
                </p>
              )}
            </div>

            {/* ================================================================
                SECTION D: Action Items (Homework)
            ================================================================ */}
            <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                  Your Actions
                </h3>
              </div>

              {coachingData?.actionItems && coachingData.actionItems.length > 0 ? (
                <ul className="space-y-3">
                  {coachingData.actionItems.map((item) => (
                    <li key={item.id} className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleActionItem(item.id, item.completed)}
                        disabled={updatingItems.has(item.id)}
                        className="mt-0.5 shrink-0 transition-opacity disabled:opacity-50"
                      >
                        {item.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                        ) : (
                          <Circle className="w-5 h-5 text-[#c4bfb9] dark:text-[#7d8190]" />
                        )}
                      </button>
                      <span className={`font-albert text-[15px] ${
                        item.completed ? 'text-[#8c8c8c] dark:text-[#7d8190] line-through' : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                      }`}>
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-albert text-[15px] text-[#8c8c8c] dark:text-[#7d8190] text-center py-4">
                  Your coach hasn&apos;t assigned any actions yet.
                </p>
              )}
            </div>

            {/* ================================================================
                SECTION E: Session History
            ================================================================ */}
            <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                  Session History
                </h3>
              </div>

              {coachingData?.sessionHistory && coachingData.sessionHistory.length > 0 ? (
                <ul className="space-y-2">
                  {coachingData.sessionHistory.slice().reverse().map((session) => (
                    <li key={session.id}>
                      <button
                        onClick={() => setSelectedSession(session)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors text-left"
                      >
                        <div>
                          <p className="font-albert text-[15px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                            {session.title}
                          </p>
                          <p className="font-albert text-[13px] text-[#8c8c8c] dark:text-[#7d8190]">
                            {new Date(session.date).toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#c4bfb9] dark:text-[#7d8190]" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-albert text-[15px] text-[#8c8c8c] dark:text-[#7d8190] text-center py-4">
                  No previous sessions recorded yet.
                </p>
              )}
            </div>

            {/* ================================================================
                SECTION F: Resources From Your Coach
            ================================================================ */}
            <div className="bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-5 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                  Resources From Your Coach
                </h3>
              </div>

              {coachingData?.resources && coachingData.resources.length > 0 ? (
                <ul className="space-y-3">
                  {coachingData.resources.map((resource) => (
                    <li key={resource.id}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#a07855]/10 dark:bg-[#b8896a]/20 flex items-center justify-center shrink-0">
                          <ExternalLink className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-albert text-[15px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8] group-hover:text-[#a07855] dark:text-[#b8896a] dark:group-hover:text-[#b8896a] transition-colors">
                            {resource.title}
                          </p>
                          {resource.description && (
                            <p className="font-albert text-[13px] text-[#8c8c8c] dark:text-[#7d8190] mt-0.5 line-clamp-2">
                              {resource.description}
                            </p>
                          )}
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-albert text-[15px] text-[#8c8c8c] text-center py-4">
                  Your coach hasn&apos;t shared any resources yet.
                </p>
              )}
            </div>

            {/* ================================================================
                SECTION G: How Coaching Works (Static Info)
            ================================================================ */}
            <div className="bg-gradient-to-br from-[#a07855]/5 to-[#8c6245]/5 dark:from-[#b8896a]/10 dark:to-[#a07855]/5 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
                <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                  How your coaching works
                </h3>
              </div>

              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-[#a07855] dark:text-[#b8896a] mt-0.5">–</span>
                  <span className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    Weekly 1:1 calls with your coach
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#a07855] dark:text-[#b8896a] mt-0.5">–</span>
                  <span className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    Your coach responds to chat messages within 24–48 hours on weekdays
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#a07855] dark:text-[#b8896a] mt-0.5">–</span>
                  <span className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    You&apos;ll receive new focus areas and action items regularly
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#a07855] dark:text-[#b8896a] mt-0.5">–</span>
                  <span className="font-albert text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    Manage your coaching subscription in{' '}
                    <Link href="/profile" className="text-[#a07855] dark:text-[#b8896a] hover:underline">
                      Settings → Manage Subscription
                    </Link>
                  </span>
                </li>
              </ul>
            </div>

          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}

