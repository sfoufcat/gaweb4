// Discover Types
import type { UserTrack } from './index';

export type DiscoverEvent = {
  id: string;
  title: string;
  coverImageUrl: string;
  date: string;          // ISO string
  startTime: string;     // e.g. "18:00"
  endTime: string;       // e.g. "20:00"
  timezone: string;      // e.g. "CET"
  // UnifiedEvent compatibility fields
  startDateTime?: string;  // ISO 8601 (for UnifiedEvent compatibility)
  endDateTime?: string;    // ISO 8601 (for UnifiedEvent compatibility)
  durationMinutes?: number; // (for UnifiedEvent compatibility)
  meetingLink?: string;    // Meeting URL (UnifiedEvent uses this instead of zoomLink)
  locationType: "online" | "in_person";
  locationLabel: string; // "Online via Zoom" etc.
  shortDescription: string;
  longDescription: string;
  bulletPoints: string[]; // "By the end of the session, you'll…"
  additionalInfo: {
    type: string;
    language: string;
    difficulty: string;
  };
  zoomLink?: string;     // meeting link, only visible after RSVP
  recordingUrl?: string; // recording link for past events
  hostName: string;
  hostAvatarUrl?: string;
  // For public Discover
  featured?: boolean;    // if true, shown in "Upcoming events" section
  category?: string;     // optional category tag
  /** @deprecated Use programIds instead. Track-based filtering is being phased out. */
  track?: UserTrack | null;
  /** Program IDs this content belongs to. Used for program-scoped content delivery. */
  programIds?: string[];
  organizationId?: string;   // Clerk Organization ID for multi-tenancy
  // Participants
  attendeeIds: string[]; // user IDs who RSVPed
  maxAttendees?: number;
  createdAt: string;
  updatedAt: string;
};

export type EventUpdate = {
  id: string;
  eventId: string;
  title: string;
  content: string;
  authorName: string;
  createdAt: string;
};

// Article type enum values
export type ArticleType = 'playbook' | 'trend' | 'caseStudy';

export type DiscoverArticle = {
  id: string;
  title: string;
  coverImageUrl: string;
  /** Optional thumbnail for cards/lists (16:9). Falls back to coverImageUrl if not set. */
  thumbnailUrl?: string;
  content: string;       // rich text / markdown
  /** User ID of the author - used for dynamic bio/avatar lookup */
  authorId?: string;
  authorName: string;
  /** Optional author title (e.g., "Life Coach", "CEO") */
  authorTitle?: string;
  /** @deprecated Use authorId for dynamic avatar lookup from user profile */
  authorAvatarUrl?: string;
  /** @deprecated Use authorId for dynamic bio lookup from user profile */
  authorBio?: string;
  publishedAt: string;
  readingTimeMinutes?: number;
  category?: string;
  /** @deprecated Use category with org-specific categories instead */
  articleType?: ArticleType; // playbook, trend, or caseStudy
  /** @deprecated Use programIds instead. Track-based filtering is being phased out. */
  track?: UserTrack | null;
  /** Program IDs this content belongs to. Used for program-scoped content delivery. */
  programIds?: string[];
  organizationId?: string;   // Clerk Organization ID for multi-tenancy
  featured?: boolean;    // for Featured section
  trending?: boolean;    // for Trending section
  createdAt?: string;
  updatedAt?: string;
};

export type CourseLesson = {
  id: string;
  order?: number;
  title: string;
  durationMinutes?: number;
  videoUrl?: string;          // Direct video URL (MP4 or hosted video)
  videoThumbnailUrl?: string; // Optional poster image for video
  notes?: string;             // Rich text / markdown lesson content
  isLocked?: boolean;         // For future premium gating
};

export type CourseModule = {
  id: string;
  order?: number;
  title: string;
  subtitle?: string;
  description?: string;
  lessons: CourseLesson[];
};

export type DiscoverCourse = {
  id: string;
  title: string;
  coverImageUrl: string;
  shortDescription: string;
  category: string;
  level: string;
  totalDurationMinutes?: number;
  totalLessons?: number;
  totalModules?: number;
  /** @deprecated Use programIds instead. Track-based filtering is being phased out. */
  track?: UserTrack | null;
  /** Program IDs this content belongs to. Used for program-scoped content delivery. */
  programIds?: string[];
  organizationId?: string;   // Clerk Organization ID for multi-tenancy
  featured?: boolean;    // for Recommended or main Courses section
  trending?: boolean;    // for Trending section
  modules: CourseModule[];
  createdAt: string;
  updatedAt: string;
};

export type DiscoverCategory = {
  id: string;
  name: string;
  icon?: string;
};

export type TrendingItem = {
  id: string;
  type: 'article' | 'course';
  title: string;
  snippet: string;
  coverImageUrl?: string;
  thumbnailUrl?: string; // Optional thumbnail for cards (16:9)
  articleType?: ArticleType; // Only for articles
};

export type RecommendedItem = {
  id: string;
  type: 'article' | 'course';
  title: string;
  subtitle: string;
  coverImageUrl: string;
  brandImageUrl?: string;
  year?: string;
  articleType?: ArticleType; // Only for articles
};

// Attendee info for display (resolved from user profiles)
export type EventAttendee = {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
};

// Discover Program type for public display
export type DiscoverProgram = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: 'group' | 'individual';
  lengthDays: number;
  priceInCents: number;
  currency?: string;
  coverImageUrl?: string;
  coachId?: string;
  organizationId?: string;
  isPublished?: boolean;
  isActive?: boolean;
  squadCapacity?: number;
  // Display fields
  coachName: string;
  coachImageUrl?: string;
  // For group programs
  nextCohort?: {
    id: string;
    name: string;
    startDate: string;
    spotsRemaining: number;
  } | null;
  // User's enrollment status
  userEnrollment?: {
    status: string;
    cohortId?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

