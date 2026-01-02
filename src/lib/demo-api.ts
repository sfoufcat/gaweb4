/**
 * Demo API Utilities
 * 
 * Provides demo data handlers for API routes when in demo mode.
 * Used by demo.growthaddicts.com to showcase the platform without real data.
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
  getDemoSquads,
  getDemoPrograms,
} from './demo-data';
import { DEMO_USER, DEMO_ORGANIZATION } from './demo-utils';

/**
 * Check if the current request is from the demo site
 */
export async function isDemoRequest(): Promise<boolean> {
  try {
    const headersList = await headers();
    return headersList.get('x-demo-mode') === 'true';
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
  
  'analytics-products': () => {
    const data = generateDemoProductAnalytics();
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

