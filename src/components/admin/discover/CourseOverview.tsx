'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  TrendingUp,
  Clock,
  BookOpen,
  Play,
  CheckCircle2,
  ChevronRight,
  Loader2,
  User,
} from 'lucide-react';
import type { DiscoverCourse } from '@/types/discover';

interface LessonStat {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
  moduleTitle: string;
  completionCount: number;
  completionPercent: number;
  avgWatchProgress: number;
}

interface Watcher {
  userId: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  overallProgress: number;
  completedLessons: number;
  totalLessons: number;
  lastAccessedAt: string;
  lastLessonTitle?: string;
  lastLessonModuleTitle?: string;
  totalWatchTimeMinutes: number;
  accessType: 'purchase' | 'program';
  programName?: string;
}

interface RecentActivity {
  userId: string;
  userName: string;
  userImage?: string;
  action: 'started' | 'completed';
  lessonTitle: string;
  timestamp: string;
}

interface CourseAnalytics {
  totalWatchers: number;
  avgCompletionPercent: number;
  totalDuration: number;
  totalLessons: number;
  lessonStats: LessonStat[];
  watchers: Watcher[];
  recentActivity: RecentActivity[];
}

interface CourseOverviewProps {
  course: DiscoverCourse;
  apiEndpoint: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = 'brand',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'brand' | 'green' | 'blue' | 'purple';
}) {
  const colorClasses = {
    brand: 'bg-brand-accent/10 text-brand-accent',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-[#171b22] rounded-2xl p-5 border border-[#e8e4df] dark:border-[#262b35]">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]} mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{value}</p>
      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">{label}</p>
      {subValue && (
        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mt-1">{subValue}</p>
      )}
    </div>
  );
}

function ProgressBar({ percent, size = 'md' }: { percent: number; size?: 'sm' | 'md' }) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className={`w-full bg-[#f3f1ef] dark:bg-[#262b35] rounded-full ${height} overflow-hidden`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`${height} rounded-full ${
          percent >= 100
            ? 'bg-green-500'
            : percent >= 50
            ? 'bg-brand-accent'
            : percent >= 25
            ? 'bg-amber-500'
            : 'bg-[#d1ccc6] dark:bg-[#4a5060]'
        }`}
      />
    </div>
  );
}

function WatcherCard({ watcher }: { watcher: Watcher }) {
  const initials = `${watcher.firstName[0] || ''}${watcher.lastName[0] || ''}`.toUpperCase();
  const timeAgo = getTimeAgo(watcher.lastAccessedAt);

  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#171b22] rounded-xl border border-[#e8e4df] dark:border-[#262b35] hover:border-brand-accent/30 transition-colors">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {watcher.imageUrl ? (
          <img
            src={watcher.imageUrl}
            alt={`${watcher.firstName} ${watcher.lastName}`}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-brand-accent/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-brand-accent">{initials}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] truncate font-albert">
            {watcher.firstName} {watcher.lastName}
          </p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            watcher.accessType === 'purchase'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
          }`}>
            {watcher.accessType === 'purchase' ? 'Purchased' : watcher.programName || 'Program'}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-1">
          <div className="flex items-center gap-1.5 flex-1">
            <span className={`text-sm font-medium ${
              watcher.overallProgress >= 100
                ? 'text-green-600 dark:text-green-400'
                : watcher.overallProgress >= 50
                ? 'text-brand-accent'
                : 'text-[#5f5a55] dark:text-[#b2b6c2]'
            }`}>
              {watcher.overallProgress}%
            </span>
            <div className="flex-1 max-w-[100px]">
              <ProgressBar percent={watcher.overallProgress} size="sm" />
            </div>
          </div>

          {watcher.lastLessonTitle && (
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] truncate max-w-[120px]">
              Last: {watcher.lastLessonTitle}
            </p>
          )}

          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] whitespace-nowrap">
            {watcher.totalWatchTimeMinutes}m watched
          </p>
        </div>
      </div>

      {/* Time ago */}
      <div className="flex-shrink-0 text-right">
        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">{timeAgo}</p>
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: RecentActivity }) {
  const timeAgo = getTimeAgo(activity.timestamp);

  return (
    <div className="flex items-center gap-3 py-2">
      {activity.userImage ? (
        <img
          src={activity.userImage}
          alt={activity.userName}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center">
          <User className="w-4 h-4 text-[#8c8c8c]" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          <span className="font-medium">{activity.userName}</span>
          {' '}
          {activity.action === 'completed' ? (
            <span className="text-green-600 dark:text-green-400">completed</span>
          ) : (
            <span className="text-blue-600 dark:text-blue-400">started</span>
          )}
          {' '}
          <span className="text-[#5f5a55] dark:text-[#b2b6c2]">{activity.lessonTitle}</span>
        </p>
      </div>

      <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] whitespace-nowrap">{timeAgo}</p>
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

export function CourseOverview({ course, apiEndpoint }: CourseOverviewProps) {
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const response = await fetch(`${apiEndpoint}/${course.id}/analytics`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        console.error('Error fetching course analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }

    if (course.id) {
      fetchAnalytics();
    }
  }, [course.id, apiEndpoint]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm text-brand-accent hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Watchers"
          value={analytics.totalWatchers}
          subValue="have access"
          color="brand"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg. Progress"
          value={`${analytics.avgCompletionPercent}%`}
          subValue="completion rate"
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Duration"
          value={`${analytics.totalDuration} min`}
          subValue="total content"
          color="blue"
        />
        <StatCard
          icon={BookOpen}
          label="Lessons"
          value={analytics.totalLessons}
          subValue="in course"
          color="purple"
        />
      </div>

      {/* Lesson Completion */}
      <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e8e4df] dark:border-[#262b35]">
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Lesson Completion
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            How many watchers completed each lesson
          </p>
        </div>

        <div className="divide-y divide-[#e8e4df] dark:divide-[#262b35]">
          {analytics.lessonStats.length === 0 ? (
            <div className="p-8 text-center">
              <Play className="w-10 h-10 text-[#d1ccc6] dark:text-[#4a5060] mx-auto mb-3" />
              <p className="text-[#8c8c8c] dark:text-[#7d8190] font-albert">No lessons in this course yet</p>
            </div>
          ) : (
            analytics.lessonStats.map((lesson) => (
              <div
                key={lesson.lessonId}
                className="px-6 py-4 flex items-center gap-4 hover:bg-[#faf8f6] dark:hover:bg-[#1a1f28] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center flex-shrink-0">
                  {lesson.completionPercent >= 100 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Play className="w-5 h-5 text-[#8c8c8c]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                      {lesson.moduleTitle}
                    </span>
                    <ChevronRight className="w-3 h-3 text-[#d1ccc6] dark:text-[#4a5060]" />
                    <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                      {lesson.lessonTitle}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar percent={lesson.completionPercent} />
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${
                    lesson.completionPercent >= 100
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}>
                    {lesson.completionPercent}%
                  </p>
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                    {lesson.completionCount} completed
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Two Column Layout for Watchers and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course Watchers - 2/3 width */}
        <div className="lg:col-span-2 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e8e4df] dark:border-[#262b35]">
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Course Watchers
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Users with access, sorted by progress
            </p>
          </div>

          <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
            {analytics.watchers.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-10 h-10 text-[#d1ccc6] dark:text-[#4a5060] mx-auto mb-3" />
                <p className="text-[#8c8c8c] dark:text-[#7d8190] font-albert">No watchers yet</p>
                <p className="text-xs text-[#a7a39e] dark:text-[#6b7080] font-albert mt-1">
                  Users who purchase the course or have it via a program will appear here
                </p>
              </div>
            ) : (
              analytics.watchers.map((watcher) => (
                <WatcherCard key={watcher.userId} watcher={watcher} />
              ))
            )}
          </div>
        </div>

        {/* Recent Activity - 1/3 width */}
        <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e8e4df] dark:border-[#262b35]">
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Recent Activity
            </h3>
          </div>

          <div className="p-4 divide-y divide-[#e8e4df]/50 dark:divide-[#262b35]/50">
            {analytics.recentActivity.length === 0 ? (
              <div className="p-6 text-center">
                <Clock className="w-8 h-8 text-[#d1ccc6] dark:text-[#4a5060] mx-auto mb-2" />
                <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert">No recent activity</p>
              </div>
            ) : (
              analytics.recentActivity.map((activity, idx) => (
                <ActivityItem key={`${activity.userId}-${idx}`} activity={activity} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
