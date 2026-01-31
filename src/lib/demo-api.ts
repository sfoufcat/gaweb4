/**
 * Demo API Utilities
 * 
 * Provides demo data handlers for API routes when in demo mode.
 * Used by demo.coachful.co to showcase the platform without real data.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  generateDemoClients,
  generateDemoUsers,
  generateDemoSquadsWithStats,
  generateDemoSquadMembers,
  generateDemoProgramsWithStats,
  generateDemoProgramDays,
  generateDemoProgramCohorts,
  generateDemoFunnels,
  generateDemoReferrals,
  generateDemoCommunityHealth,
  generateDemoFeedAnalytics,
  generateDemoChatAnalytics,
  generateDemoProductAnalytics,
  generateDemoFunnelAnalytics,
  generateDemoCheckInFlows,
  generateDemoOnboardingFlow,
  generateDemoChannels,
  generateDemoDiscountCodes,
  generateDemoBranding,
  generateDemoSubscription,
  generateDemoScheduling,
  generateDemoDiscoverContent,
  generateDemoFeedPosts,
  generateDemoUserProfile,
  generateDemoFeatureRequests,
  generateDemoMyContent,
  getDemoSquads,
  getDemoPrograms,
} from './demo-data';
import { DEMO_USER, DEMO_ORGANIZATION } from './demo-utils';

// Demo subdomains that should trigger demo mode
const DEMO_SUBDOMAINS = ['demo.coachful.co', 'demo.localhost'];

/**
 * Check if the current request is from the demo site
 * Checks both x-demo-mode header (set by middleware) and host header (for client-side fetches)
 */
export async function isDemoRequest(): Promise<boolean> {
  try {
    const headersList = await headers();
    
    // Check explicit demo mode header (set by middleware on initial page load)
    if (headersList.get('x-demo-mode') === 'true') {
      return true;
    }
    
    // Also check host header for client-side API requests
    // (these don't go through middleware, so won't have x-demo-mode header)
    const host = headersList.get('host') || '';
    return DEMO_SUBDOMAINS.some(demo => host === demo || host.startsWith(`${demo}:`));
  } catch {
    return false;
  }
}

/**
 * Demo response helper - returns NextResponse with demo data
 */
export function demoResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Demo API Handlers
 * 
 * Each handler corresponds to an API route and returns appropriate demo data.
 */
export const demoHandlers = {
  // ============================================================================
  // USERS / CLIENTS
  // ============================================================================
  
  'org-users': () => {
    const users = generateDemoUsers(18);
    return demoResponse({
      users: users.map(u => ({
        ...u,
        orgRole: 'member',
        orgRoleForOrg: 'member',
        programs: [],
        invitedBy: null,
        invitedByName: null,
        inviteCode: null,
        invitedAt: null,
      })),
      totalCount: users.length,
      organizationId: DEMO_ORGANIZATION.id,
      currentUserOrgRole: 'super_coach',
    });
  },
  
  'clients': () => {
    const { clients, summary } = generateDemoClients(18);
    return demoResponse({ clients, summary });
  },
  
  'client-detail': (clientId: string) => {
    const { clients } = generateDemoClients(18);
    const client = clients.find(c => c.userId === clientId) || clients[0];
    return demoResponse({
      client: {
        ...client,
        notes: [],
        recentActivity: [],
        programProgress: client.programId ? {
          programId: client.programId,
          programName: client.programName,
          currentDay: 12,
          totalDays: 30,
          completionRate: 40,
        } : null,
      },
    });
  },
  
  // ============================================================================
  // SQUADS
  // ============================================================================
  
  'org-squads': () => {
    const squads = generateDemoSquadsWithStats();
    return demoResponse({ squads, totalCount: squads.length });
  },
  
  'squad-detail': (squadId: string) => {
    const squads = generateDemoSquadsWithStats();
    const squad = squads.find(s => s.id === squadId) || squads[0];
    return demoResponse({ squad });
  },
  
  'squad-members': (squadId: string) => {
    const members = generateDemoSquadMembers(squadId, 12);
    return demoResponse({ members, totalCount: members.length });
  },
  
  // ============================================================================
  // PROGRAMS
  // ============================================================================
  
  'org-programs': () => {
    const programs = generateDemoProgramsWithStats();
    return demoResponse({ programs, totalCount: programs.length });
  },
  
  'program-detail': (programId: string) => {
    const programs = generateDemoProgramsWithStats();
    const program = programs.find(p => p.id === programId) || programs[0];
    const days = generateDemoProgramDays(program.id, program.durationDays);
    const cohorts = generateDemoProgramCohorts(program.id);
    return demoResponse({ program, days, cohorts });
  },
  
  'program-days': (programId: string) => {
    const programs = generateDemoProgramsWithStats();
    const program = programs.find(p => p.id === programId) || programs[0];
    const days = generateDemoProgramDays(program.id, program.durationDays);
    return demoResponse({ days });
  },
  
  'program-cohorts': (programId: string) => {
    const cohorts = generateDemoProgramCohorts(programId);
    return demoResponse({ cohorts });
  },
  
  // ============================================================================
  // FUNNELS
  // ============================================================================
  
  'org-funnels': () => {
    const funnels = generateDemoFunnels();
    return demoResponse({ funnels, totalCount: funnels.length });
  },
  
  'funnel-detail': (funnelId: string) => {
    const funnels = generateDemoFunnels();
    const funnel = funnels.find(f => f.id === funnelId) || funnels[0];
    return demoResponse({ funnel, steps: funnel.steps });
  },
  
  'funnel-steps': (funnelId: string) => {
    const funnels = generateDemoFunnels();
    const funnel = funnels.find(f => f.id === funnelId) || funnels[0];
    return demoResponse({ steps: funnel.steps });
  },

  // ============================================================================
  // INTAKE CONFIGS
  // ============================================================================

  'intake-configs': () => {
    // Return empty array for demo mode - intake configs are org-specific
    return demoResponse({ configs: [] });
  },

  'intake-config-detail': () => {
    // Not found in demo mode
    return demoResponse({ error: 'Not found' }, 404);
  },

  // ============================================================================
  // CHECK-INS
  // ============================================================================
  
  'org-checkin-flows': () => {
    const flows = generateDemoCheckInFlows();
    return demoResponse({ flows, totalCount: flows.length });
  },
  
  'checkin-flow-detail': (flowId: string) => {
    const flows = generateDemoCheckInFlows();
    const flow = flows.find(f => f.id === flowId) || flows[0];
    return demoResponse({ flow, steps: flow.steps });
  },
  
  // ============================================================================
  // ONBOARDING
  // ============================================================================
  
  'org-onboarding-flow': () => {
    const flow = generateDemoOnboardingFlow();
    return demoResponse({ flow, steps: flow.steps });
  },
  
  // ============================================================================
  // CHANNELS
  // ============================================================================
  
  'org-channels': () => {
    const channels = generateDemoChannels();
    return demoResponse({ channels, totalCount: channels.length });
  },
  
  // ============================================================================
  // DISCOUNT CODES
  // ============================================================================
  
  'discount-codes': () => {
    const codes = generateDemoDiscountCodes();
    return demoResponse({ codes, totalCount: codes.length });
  },
  
  // ============================================================================
  // REFERRALS
  // ============================================================================
  
  'referrals': () => {
    const { referrals, stats } = generateDemoReferrals();
    return demoResponse({ referrals, stats, totalCount: referrals.length });
  },
  
  'referral-config': () => {
    return demoResponse({
      config: {
        isEnabled: true,
        rewardType: 'discount',
        rewardValue: 20,
        rewardDescription: '20% off next purchase',
      },
    });
  },
  
  // ============================================================================
  // ANALYTICS
  // ============================================================================
  
  'analytics-clients': () => {
    const { clients, summary } = generateDemoClients(18);
    return demoResponse({ clients, summary });
  },
  
  'analytics-communities': () => {
    const data = generateDemoCommunityHealth();
    return demoResponse(data);
  },
  
  'analytics-feed': () => {
    const data = generateDemoFeedAnalytics();
    return demoResponse(data);
  },
  
  'analytics-chats': () => {
    const data = generateDemoChatAnalytics();
    return demoResponse(data);
  },
  
  'analytics-products': (daysParam?: string) => {
    const days = daysParam ? parseInt(daysParam, 10) : undefined;
    const data = generateDemoProductAnalytics(days);
    return demoResponse(data);
  },
  
  'analytics-funnels': () => {
    const data = generateDemoFunnelAnalytics();
    return demoResponse(data);
  },
  
  // ============================================================================
  // BRANDING / CUSTOMIZATION
  // ============================================================================
  
  'branding': () => {
    const branding = generateDemoBranding();
    return demoResponse({ branding });
  },
  
  'org-domain': () => {
    return demoResponse({
      subdomain: 'demo',
      customDomains: [],
    });
  },
  
  // ============================================================================
  // SUBSCRIPTION
  // ============================================================================
  
  'subscription': () => {
    const subscription = generateDemoSubscription();
    return demoResponse({ subscription });
  },
  
  // ============================================================================
  // SCHEDULING
  // ============================================================================
  
  'availability': () => {
    const data = generateDemoScheduling();
    return demoResponse({
      availability: data.availability,
      timezone: data.timezone,
      bufferMinutes: data.bufferMinutes,
      maxAdvanceDays: data.maxAdvanceDays,
    });
  },
  
  'availability-slots': () => {
    const data = generateDemoScheduling();
    // Generate available slots for the next 14 days
    const slots: { date: string; times: string[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      const availableDay = data.availability.find(a => a.dayOfWeek === dayOfWeek && a.isActive);
      
      if (availableDay) {
        const times: string[] = [];
        let hour = parseInt(availableDay.startTime.split(':')[0]);
        const endHour = parseInt(availableDay.endTime.split(':')[0]);
        
        while (hour < endHour) {
          times.push(`${hour.toString().padStart(2, '0')}:00`);
          hour++;
        }
        
        slots.push({
          date: date.toISOString().split('T')[0],
          times,
        });
      }
    }
    return demoResponse({ slots });
  },
  
  'bookings': () => {
    const data = generateDemoScheduling();
    return demoResponse({ bookings: data.bookings });
  },
  
  // ============================================================================
  // DISCOVER CONTENT
  // ============================================================================
  
  'org-discover-articles': () => {
    const items = generateDemoDiscoverContent().filter(i => i.type === 'article');
    return demoResponse({ articles: items, totalCount: items.length });
  },
  
  'org-discover-courses': () => {
    const items = generateDemoDiscoverContent().filter(i => i.type === 'course');
    return demoResponse({ courses: items, totalCount: items.length });
  },
  
  'org-discover-events': () => {
    const items = generateDemoDiscoverContent().filter(i => i.type === 'event');
    return demoResponse({ events: items, totalCount: items.length });
  },
  
  'org-discover-downloads': () => {
    const items = generateDemoDiscoverContent().filter(i => i.type === 'download');
    return demoResponse({ downloads: items, totalCount: items.length });
  },
  
  // ============================================================================
  // FEED
  // ============================================================================
  
  'feed': () => {
    const posts = generateDemoFeedPosts();
    return demoResponse({ posts, totalCount: posts.length, hasMore: false });
  },
  
  'feed-settings': () => {
    return demoResponse({
      settings: {
        feedEnabled: true,
        allowMemberPosts: true,
        requireApproval: false,
        allowImages: true,
        allowComments: true,
      },
    });
  },

  'org-website': () => {
    return demoResponse({
      website: {
        id: DEMO_ORGANIZATION.id,
        organizationId: DEMO_ORGANIZATION.id,
        enabled: true,
        template: 'classic',
        heroHeadline: 'Transform Your Life with Expert Coaching',
        heroSubheadline: 'Personalized coaching programs designed to help you achieve your biggest goals and become your best self.',
        heroCtaText: 'Get Started',
        heroCtaFunnelId: null,
        coachBio: 'I am a certified coach with over 10 years of experience helping individuals achieve their personal and professional goals.',
        coachBullets: ['ICF Certified Coach', '10+ Years Experience', 'MBA, Stanford University'],
        coachHeadline: 'About Your Coach',
        servicesHeadline: 'What I Offer',
        services: [
          { id: '1', title: '1:1 Coaching', description: 'Personalized sessions tailored to your needs', icon: 'users', funnelId: '' },
          { id: '2', title: 'Group Programs', description: 'Join a cohort of like-minded individuals', icon: 'video', funnelId: '' },
        ],
        testimonials: [
          { text: 'Working with this coach completely transformed my approach to work and life.', author: 'Sarah M.', role: 'Entrepreneur', rating: 5 },
        ],
        faqs: [
          { question: 'How long is a typical coaching engagement?', answer: 'Most clients work with me for 3-6 months, depending on their goals.' },
        ],
        showSignIn: true,
        signInButtonText: 'Sign In',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      funnels: [],
    });
  },

  // ============================================================================
  // SUPPORT / FEATURE REQUESTS
  // ============================================================================
  
  'feature-requests': () => {
    const requests = generateDemoFeatureRequests();
    return demoResponse({ requests, totalCount: requests.length });
  },
  
  // ============================================================================
  // MISC
  // ============================================================================
  
  'ending-cohorts': () => {
    return demoResponse({ endingCohorts: [] });
  },
  
  'invite-codes': () => {
    return demoResponse({
      codes: [
        { code: 'DEMO2024', usageCount: 15, maxUses: 100, isActive: true },
        { code: 'WELCOME', usageCount: 42, maxUses: null, isActive: true },
      ],
    });
  },
  
  'email-templates': () => {
    return demoResponse({
      templates: [
        { id: 't1', name: 'Welcome Email', subject: 'Welcome to {org_name}!', isActive: true },
        { id: 't2', name: 'Program Reminder', subject: 'Don\'t forget today\'s task!', isActive: true },
      ],
    });
  },
  
  // ============================================================================
  // USER-FACING DEMO DATA
  // ============================================================================
  
  'demo-user-profile': () => {
    const profile = generateDemoUserProfile();
    return demoResponse({ user: profile });
  },
  
  'demo-user-dashboard': () => {
    const profile = generateDemoUserProfile();
    const feedPosts = generateDemoFeedPosts().slice(0, 3);
    
    return demoResponse({
      user: profile,
      todaysTasks: profile.todaysTasks,
      habits: profile.habits,
      goals: profile.goals,
      currentProgram: profile.currentProgram,
      squad: profile.squad,
      recentFeed: feedPosts,
      streak: profile.streak,
    });
  },
  
  'user-tasks': () => {
    const profile = generateDemoUserProfile();
    const tasks = profile.todaysTasks.map((task, index) => ({
      id: `demo-task-${index}`,
      userId: DEMO_USER.id,
      organizationId: DEMO_ORGANIZATION.id,
      title: task.label,
      date: new Date().toISOString().split('T')[0],
      status: task.completed ? 'completed' : 'pending',
      listType: task.isPrimary ? 'focus' : 'backlog',
      order: index,
      isPrivate: false,
      sourceType: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    return demoResponse({ tasks });
  },
  
  'user-habits': () => {
    const profile = generateDemoUserProfile();
    const today = new Date().toISOString().split('T')[0];
    const habits = profile.habits.map((habit, index) => ({
      id: `demo-habit-${index}`,
      userId: DEMO_USER.id,
      organizationId: DEMO_ORGANIZATION.id,
      text: habit.title,
      frequencyType: 'daily' as const,
      frequencyValue: 1,
      reminder: null,
      targetRepetitions: null,
      progress: {
        currentCount: habit.streak,
        lastCompletedDate: habit.completedToday ? today : null,
        completionDates: habit.completedToday ? [today] : [],
        skipDates: [],
      },
      archived: false,
      status: 'active' as const,
      source: 'user' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    return demoResponse({ habits });
  },
  
  'user-goals': () => {
    const profile = generateDemoUserProfile();
    return demoResponse({ 
      goals: profile.goals,
      hasIdentity: true,
      identity: {
        futureIdentity: 'A confident, healthy, and focused individual who prioritizes well-being and personal growth.',
        coreValues: ['Growth', 'Health', 'Balance', 'Connection'],
      },
    });
  },
  
  'my-programs': () => {
    const programs = getDemoPrograms();
    const enrolledPrograms = programs.slice(0, 2).map(p => ({
      ...p,
      enrollmentId: `demo-enrollment-${p.id}`,
      enrolledAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      currentDay: 14,
      completionRate: 67,
      status: 'active',
    }));
    return demoResponse({ programs: enrolledPrograms });
  },
  
  'my-squads': () => {
    const squads = getDemoSquads();
    const memberSquads = squads.slice(0, 2).map(s => ({
      ...s,
      membershipId: `demo-membership-${s.id}`,
      joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      role: 'member',
    }));
    return demoResponse({ squads: memberSquads });
  },
  
  'my-content': () => {
    const data = generateDemoMyContent();
    return demoResponse(data);
  },
  
  'org-discover-programs': () => {
    const programs = getDemoPrograms().map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      coverImageUrl: p.coverImageUrl,
      type: p.type,
      priceInCents: p.priceInCents,
      lengthDays: p.lengthDays,
      isPublished: true,
      coachName: 'Coach Adam',
      coachImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
      nextCohortDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      spotsLeft: 8,
    }));
    return demoResponse({ programs, totalCount: programs.length });
  },
  
  'org-discover-categories': () => {
    return demoResponse({
      categories: [
        { id: 'cat-1', name: 'Personal Growth', slug: 'personal-growth', itemCount: 12 },
        { id: 'cat-2', name: 'Health & Wellness', slug: 'health-wellness', itemCount: 8 },
        { id: 'cat-3', name: 'Productivity', slug: 'productivity', itemCount: 6 },
        { id: 'cat-4', name: 'Mindfulness', slug: 'mindfulness', itemCount: 5 },
      ],
    });
  },
};

/**
 * Get demo data for a specific route
 * 
 * @param route - The route key (e.g., 'org-users', 'analytics-clients')
 * @param params - Optional parameters (e.g., { clientId: 'demo-user-1' })
 */
export function getDemoData(route: keyof typeof demoHandlers, params?: Record<string, string>): NextResponse {
  const handler = demoHandlers[route];
  
  if (typeof handler === 'function') {
    // Some handlers accept parameters
    if (params) {
      const firstParam = Object.values(params)[0];
      return (handler as (param: string) => NextResponse)(firstParam);
    }
    return (handler as () => NextResponse)();
  }
  
  return demoResponse({ error: 'Demo data not available for this route' }, 404);
}

/**
 * Wrap an API handler with demo mode support
 * 
 * Usage in API route:
 * ```ts
 * export async function GET(request: Request) {
 *   const demoData = await withDemoMode('org-users');
 *   if (demoData) return demoData;
 *   
 *   // ... real API logic
 * }
 * ```
 */
export async function withDemoMode(
  route: keyof typeof demoHandlers,
  params?: Record<string, string>
): Promise<NextResponse | null> {
  const isDemo = await isDemoRequest();
  
  if (isDemo) {
    return getDemoData(route, params);
  }
  
  return null;
}

/**
 * Create a demo-aware fetch wrapper for client components
 * 
 * This can be used in components that need to fetch data but should
 * return demo data when in demo mode.
 */
export function createDemoFetch(isDemoMode: boolean) {
  return async function demoFetch<T>(
    url: string,
    demoData: T,
    options?: RequestInit
  ): Promise<T> {
    if (isDemoMode) {
      // Simulate network delay for realism
      await new Promise(resolve => setTimeout(resolve, 200));
      return demoData;
    }
    
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }
    return response.json();
  };
}

/**
 * Demo not available response
 * Use this for actions that aren't available in demo mode
 */
export function demoNotAvailable(action: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Demo Mode',
      message: `${action} is not available in demo mode`,
      isDemoMode: true,
    },
    { status: 403 }
  );
}

