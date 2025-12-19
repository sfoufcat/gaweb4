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
  track?: UserTrack | null;  // Track-specific content (e.g., content_creator, saas)
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
  content: string;       // rich text / markdown
  authorName: string;
  authorTitle: string;
  authorAvatarUrl?: string;
  authorBio?: string;
  publishedAt: string;
  readingTimeMinutes?: number;
  category?: string;
  articleType?: ArticleType; // playbook, trend, or caseStudy
  track?: UserTrack | null;  // Track-specific content (e.g., content_creator, saas)
  organizationId?: string;   // Clerk Organization ID for multi-tenancy
  featured?: boolean;    // for Recommended section
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
  track?: UserTrack | null;  // Track-specific content (e.g., content_creator, saas)
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

