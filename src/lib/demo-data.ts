/**
 * Demo Data Generator
 * 
 * Generates fake client data for demo mode in the coach dashboard.
 * Uses realistic names and placeholder avatars.
 */

import type { HealthStatus } from '@/lib/analytics/constants';

// Realistic first names
const FIRST_NAMES = [
  'Sarah', 'Michael', 'Emma', 'James', 'Olivia', 'William', 'Sophia', 'Benjamin',
  'Isabella', 'Lucas', 'Mia', 'Henry', 'Charlotte', 'Alexander', 'Amelia', 'Daniel',
  'Harper', 'Matthew', 'Evelyn', 'David', 'Abigail', 'Joseph', 'Emily', 'Samuel',
  'Elizabeth', 'Sebastian', 'Sofia', 'Jack', 'Avery', 'Owen', 'Ella', 'Ryan',
  'Madison', 'Nathan', 'Scarlett', 'Caleb', 'Victoria', 'Isaac', 'Aria', 'Luke'
];

// Realistic last names
const LAST_NAMES = [
  'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez',
  'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
  'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris',
  'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen',
  'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green'
];

// Demo programs with cover images
const DEMO_PROGRAMS = [
  { 
    id: 'demo-prog-1', 
    name: '30-Day Transformation',
    description: 'Transform your life in 30 days with daily guided actions.',
    coverImageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop',
    type: 'individual' as const,
    priceInCents: 29700,
    lengthDays: 30,
  },
  { 
    id: 'demo-prog-2', 
    name: 'Content Creator Accelerator',
    description: 'Build your personal brand and grow your audience.',
    coverImageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=450&fit=crop',
    type: 'group' as const,
    priceInCents: 49700,
    lengthDays: 60,
  },
  { 
    id: 'demo-prog-3', 
    name: 'Business Growth Intensive',
    description: 'Scale your business with proven strategies.',
    coverImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
    type: 'individual' as const,
    priceInCents: 99700,
    lengthDays: 90,
  },
  { 
    id: 'demo-prog-4', 
    name: 'Mindset Mastery',
    description: 'Develop an unstoppable mindset for success.',
    coverImageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=450&fit=crop',
    type: 'group' as const,
    priceInCents: 19700,
    lengthDays: 21,
  },
];

// Demo squads - at least one standalone (no programId)
const DEMO_SQUADS = [
  { id: 'demo-squad-1', name: 'Alpha Achievers', programId: 'demo-prog-2', coverImageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=450&fit=crop' },
  { id: 'demo-squad-2', name: 'Growth Warriors', programId: undefined, coverImageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=450&fit=crop' }, // Standalone squad
  { id: 'demo-squad-3', name: 'Peak Performers', programId: 'demo-prog-4', coverImageUrl: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&h=450&fit=crop' },
];

// Primary signals
const PRIMARY_SIGNALS = ['task', 'habit', 'checkin', 'weekly', null];

export interface DemoClient {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  status: HealthStatus;
  atRisk: boolean;
  lastActivityAt: string | null;
  primarySignal: string | null;
  daysActiveInPeriod: number;
  programId?: string;
  programName?: string;
  squadId?: string;
  squadName?: string;
  joinedAt: string;
}

export interface DemoClientSummary {
  totalClients: number;
  thrivingCount: number;
  activeCount: number;
  inactiveCount: number;
  atRiskCount: number;
  activeRate: number;
}

// For AdminUsersTab format
export interface DemoUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  role: 'user';
  orgRole: 'member';
  tier: 'free' | 'standard' | 'premium';
  squadIds: string[];
  coachingStatus: 'none' | 'active' | 'pending';
  programs?: { programId: string; programName: string; programType: 'group' | 'individual'; status: 'active' }[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate a random date in the past N days
 */
function randomPastDate(maxDaysAgo: number): Date {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * maxDaysAgo);
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

// Real photo avatars for demo users (from Unsplash)
// Organized by first name to enable first-name-based lookup
const DEMO_AVATARS: Record<string, string> = {
  // Full names that might be generated
  'Sarah Miller': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
  'Michael Chen': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  'Emma Thompson': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  'James Wilson': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  'Lisa Park': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=face',
  'Luke Anderson': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  'Caleb King': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
  'Avery Allen': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
  'Olivia Johnson': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  'William Brown': 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=150&h=150&fit=crop&crop=face',
  'Sophia Garcia': 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face',
  'Benjamin Davis': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
  'Isabella Martinez': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&h=150&fit=crop&crop=face',
  'Alexander Lee': 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&h=150&fit=crop&crop=face',
  'Mia Rodriguez': 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&h=150&fit=crop&crop=face',
  'Henry Nguyen': 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face',
  'Charlotte Lopez': 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face',
  'Daniel Gonzalez': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  'David Gonzalez': 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=150&h=150&fit=crop&crop=face',
  'Alex Morgan': 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=150&h=150&fit=crop&crop=face',
  'Coach Adam': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
  // Additional generated names for demo clients
  'David White': 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=150&h=150&fit=crop&crop=face',
  'Sofia Williams': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
  'Caleb Rodriguez': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&crop=face',
  'Michael Green': 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&h=150&fit=crop&crop=face',
  'Harper Allen': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face',
  'Joseph White': 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop&crop=face',
  'Olivia Martin': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  'Benjamin Perez': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  'Olivia Gonzalez': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  'Lucas Davis': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
  'Amelia Brown': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
  'David Rodriguez': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
};

// First name to avatar mapping for fallback when full name not found
const FIRST_NAME_AVATARS: Record<string, string> = {
  'Sarah': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
  'Michael': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  'Emma': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  'James': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  'Olivia': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  'William': 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=150&h=150&fit=crop&crop=face',
  'Sophia': 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face',
  'Benjamin': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
  'Isabella': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&h=150&fit=crop&crop=face',
  'Lucas': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
  'Mia': 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&h=150&fit=crop&crop=face',
  'Henry': 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face',
  'Charlotte': 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face',
  'Alexander': 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&h=150&fit=crop&crop=face',
  'Amelia': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
  'Daniel': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  'Harper': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face',
  'Matthew': 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&h=150&fit=crop&crop=face',
  'Evelyn': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
  'David': 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=150&h=150&fit=crop&crop=face',
  'Abigail': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=face',
  'Joseph': 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop&crop=face',
  'Emily': 'https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?w=150&h=150&fit=crop&crop=face',
  'Samuel': 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=150&h=150&fit=crop&crop=face',
  'Elizabeth': 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&h=150&fit=crop&crop=face',
  'Sebastian': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&crop=face',
  'Sofia': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  'Jack': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
  'Avery': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
  'Owen': 'https://images.unsplash.com/photo-1542178243-bc20204b769f?w=150&h=150&fit=crop&crop=face',
  'Ella': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
  'Ryan': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  'Madison': 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face',
  'Nathan': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
  'Scarlett': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&h=150&fit=crop&crop=face',
  'Caleb': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
  'Victoria': 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&h=150&fit=crop&crop=face',
  'Isaac': 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face',
  'Aria': 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face',
  'Luke': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
};

/**
 * Generate avatar URL using real photos for known demo names
 * Falls back to ui-avatars.com for unknown names
 * Exported for use in demo mode components
 */
export function generateAvatarUrl(name: string): string {
  // Return real photo if available for full name
  if (DEMO_AVATARS[name]) {
    return DEMO_AVATARS[name];
  }
  
  // Try first name lookup for real photos
  const firstName = name.split(' ')[0];
  if (FIRST_NAME_AVATARS[firstName]) {
    return FIRST_NAME_AVATARS[firstName];
  }
  
  // Generate consistent color based on name (not random)
  const colors = ['a07855', '7c9885', '6b7db3', 'b36b6b', '9b6bb3', '6bb3a0'];
  const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  const color = colors[colorIndex];
  const encodedName = encodeURIComponent(name);
  return `https://ui-avatars.com/api/?name=${encodedName}&background=${color}&color=fff&size=128&bold=true`;
}

/**
 * Generate a unique fake email
 */
function generateEmail(firstName: string, lastName: string, index: number): string {
  const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'proton.me'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${domain}`;
}

/**
 * Seeded random for consistent demo data
 */
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

/**
 * Generate demo clients for ClientActivityTab
 */
export function generateDemoClients(count: number = 18): { clients: DemoClient[]; summary: DemoClientSummary } {
  const random = seededRandom(42); // Consistent seed for reproducible data
  const clients: DemoClient[] = [];
  
  // Distribution: 5 thriving, 6 active, 4 inactive, 3 at-risk
  const statusDistribution: { status: HealthStatus; atRisk: boolean; count: number }[] = [
    { status: 'thriving', atRisk: false, count: 5 },
    { status: 'active', atRisk: false, count: 4 },
    { status: 'active', atRisk: true, count: 2 },
    { status: 'inactive', atRisk: false, count: 4 },
    { status: 'inactive', atRisk: true, count: 3 },
  ];

  let clientIndex = 0;
  
  for (const { status, atRisk, count: statusCount } of statusDistribution) {
    for (let i = 0; i < statusCount && clientIndex < count; i++) {
      const firstNameIndex = Math.floor(random() * FIRST_NAMES.length);
      const lastNameIndex = Math.floor(random() * LAST_NAMES.length);
      const firstName = FIRST_NAMES[firstNameIndex];
      const lastName = LAST_NAMES[lastNameIndex];
      const fullName = `${firstName} ${lastName}`;
      
      // Assign program (80% have one)
      const hasProgram = random() < 0.8;
      const program = hasProgram ? DEMO_PROGRAMS[Math.floor(random() * DEMO_PROGRAMS.length)] : null;
      
      // Assign squad (70% have one)
      const hasSquad = random() < 0.7;
      const squad = hasSquad ? DEMO_SQUADS[Math.floor(random() * DEMO_SQUADS.length)] : null;
      
      // Generate activity data based on status
      let daysActiveInPeriod = 0;
      let lastActivityAt: string | null = null;
      let primarySignal: string | null = null;
      
      if (status === 'thriving') {
        daysActiveInPeriod = 4 + Math.floor(random() * 4); // 4-7 days
        lastActivityAt = randomPastDate(2).toISOString(); // Within 2 days
        primarySignal = PRIMARY_SIGNALS[Math.floor(random() * 4)] as string; // Has signal
      } else if (status === 'active') {
        daysActiveInPeriod = 1 + Math.floor(random() * 3); // 1-3 days
        lastActivityAt = randomPastDate(5).toISOString(); // Within 5 days
        primarySignal = PRIMARY_SIGNALS[Math.floor(random() * 4)] as string;
      } else {
        daysActiveInPeriod = 0;
        lastActivityAt = random() < 0.3 ? randomPastDate(14).toISOString() : null; // Older or never
        primarySignal = null;
      }
      
      const client: DemoClient = {
        userId: `demo-user-${clientIndex + 1}`,
        name: fullName,
        email: generateEmail(firstName, lastName, clientIndex),
        avatarUrl: generateAvatarUrl(fullName),
        status,
        atRisk,
        lastActivityAt,
        primarySignal,
        daysActiveInPeriod,
        programId: program?.id,
        programName: program?.name,
        squadId: squad?.id,
        squadName: squad?.name,
        joinedAt: randomPastDate(90).toISOString(), // Joined within last 90 days
      };
      
      clients.push(client);
      clientIndex++;
    }
  }
  
  // Calculate summary
  const summary: DemoClientSummary = {
    totalClients: clients.length,
    thrivingCount: clients.filter(c => c.status === 'thriving').length,
    activeCount: clients.filter(c => c.status === 'active').length,
    inactiveCount: clients.filter(c => c.status === 'inactive').length,
    atRiskCount: clients.filter(c => c.atRisk).length,
    activeRate: Math.round(
      ((clients.filter(c => c.status === 'thriving' || c.status === 'active').length) / clients.length) * 100
    ),
  };
  
  return { clients, summary };
}

/**
 * Generate demo users for AdminUsersTab
 */
export function generateDemoUsers(count: number = 18): DemoUser[] {
  const random = seededRandom(42); // Same seed for consistency
  const users: DemoUser[] = [];
  
  for (let i = 0; i < count; i++) {
    const firstNameIndex = Math.floor(random() * FIRST_NAMES.length);
    const lastNameIndex = Math.floor(random() * LAST_NAMES.length);
    const firstName = FIRST_NAMES[firstNameIndex];
    const lastName = LAST_NAMES[lastNameIndex];
    const fullName = `${firstName} ${lastName}`;
    
    // Tier distribution: 40% free, 40% standard, 20% premium
    const tierRoll = random();
    const tier: 'free' | 'standard' | 'premium' = tierRoll < 0.4 ? 'free' : tierRoll < 0.8 ? 'standard' : 'premium';
    
    // Assign squads
    const hasSquad = random() < 0.7;
    const squadIds = hasSquad ? [DEMO_SQUADS[Math.floor(random() * DEMO_SQUADS.length)].id] : [];
    
    // Assign programs (60% have one)
    const hasProgram = random() < 0.6;
    const programData = hasProgram ? DEMO_PROGRAMS[Math.floor(random() * DEMO_PROGRAMS.length)] : null;
    
    const user: DemoUser = {
      id: `demo-user-${i + 1}`,
      email: generateEmail(firstName, lastName, i),
      firstName,
      lastName,
      name: fullName,
      imageUrl: generateAvatarUrl(fullName),
      role: 'user',
      orgRole: 'member',
      tier,
      squadIds,
      coachingStatus: random() < 0.2 ? 'active' : 'none',
      programs: programData ? [{
        programId: programData.id,
        programName: programData.name,
        programType: random() < 0.7 ? 'group' : 'individual',
        status: 'active',
      }] : undefined,
      createdAt: randomPastDate(90).toISOString(),
      updatedAt: randomPastDate(7).toISOString(),
    };
    
    users.push(user);
  }
  
  return users;
}

/**
 * Get demo squad options for populating dropdowns
 */
export function getDemoSquads() {
  return DEMO_SQUADS;
}

/**
 * Get demo program options
 */
export function getDemoPrograms() {
  return DEMO_PROGRAMS;
}

// ============================================================================
// SQUADS
// ============================================================================

export interface DemoSquadWithStats {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  memberCount: number;
  programId?: string;
  programName?: string;
  programType?: 'group' | 'individual';
  isPublic: boolean;
  priceInCents?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DemoSquadMember {
  odataId: string;
  odataUserId: string;
  odataSquadId: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  joinedAt: string;
  role: 'member' | 'admin';
  // Alignment/streak data
  streak?: number;
  alignment?: {
    score: number;
    trend: 'up' | 'down' | 'stable';
  };
  // Story data
  hasStory?: boolean;
  hasDayClosed?: boolean;
}

const SQUAD_NAMES = [
  { name: 'Alpha Achievers', slug: 'alpha-achievers', avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&h=200&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=450&fit=crop' },
  { name: 'Growth Warriors', slug: 'growth-warriors', avatarUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&h=200&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=450&fit=crop' },
  { name: 'Peak Performers', slug: 'peak-performers', avatarUrl: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=200&h=200&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&h=450&fit=crop' },
  { name: 'Momentum Masters', slug: 'momentum-masters', avatarUrl: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=200&h=200&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=450&fit=crop' },
  { name: 'Vision Builders', slug: 'vision-builders', avatarUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=200&h=200&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=450&fit=crop' },
];

const SQUAD_DESCRIPTIONS = [
  'A community of driven individuals committed to personal growth and excellence.',
  'High-achievers pushing boundaries and supporting each other.',
  'Focused entrepreneurs building their dreams together.',
  'A tight-knit group dedicated to continuous improvement.',
  'Ambitious professionals on the path to mastery.',
];

export function generateDemoSquadsWithStats(): DemoSquadWithStats[] {
  const random = seededRandom(100);
  const squads: DemoSquadWithStats[] = [];
  
  for (let i = 0; i < 5; i++) {
    const squadInfo = SQUAD_NAMES[i];
    const hasProgram = i < 3; // First 3 are program-linked
    const program = hasProgram ? DEMO_PROGRAMS[i % DEMO_PROGRAMS.length] : null;
    
    squads.push({
      id: `demo-squad-${i + 1}`,
      name: squadInfo.name,
      slug: squadInfo.slug,
      description: SQUAD_DESCRIPTIONS[i],
      avatarUrl: squadInfo.avatarUrl,
      coverImageUrl: squadInfo.coverImageUrl,
      memberCount: 8 + Math.floor(random() * 20), // 8-27 members
      programId: program?.id,
      programName: program?.name,
      programType: program ? (random() < 0.7 ? 'group' : 'individual') : undefined,
      isPublic: random() < 0.6,
      priceInCents: hasProgram ? undefined : (random() < 0.5 ? Math.floor(random() * 5000) + 2900 : undefined),
      createdAt: randomPastDate(180).toISOString(),
      updatedAt: randomPastDate(7).toISOString(),
    });
  }
  
  return squads;
}

export function generateDemoSquadMembers(squadId: string, count: number = 12): DemoSquadMember[] {
  const random = seededRandom(parseInt(squadId.replace(/\D/g, '')) || 50);
  const members: DemoSquadMember[] = [];
  
  const trends: ('up' | 'down' | 'stable')[] = ['up', 'stable', 'up', 'down', 'stable'];
  
  for (let i = 0; i < count; i++) {
    const firstNameIndex = Math.floor(random() * FIRST_NAMES.length);
    const lastNameIndex = Math.floor(random() * LAST_NAMES.length);
    const firstName = FIRST_NAMES[firstNameIndex];
    const lastName = LAST_NAMES[lastNameIndex];
    const fullName = `${firstName} ${lastName}`;
    
    // Generate streak between 1-15, with squad target of 4
    const streak = Math.floor(random() * 15) + 1;
    // Generate alignment score from discrete values only
    const alignmentValues = [0, 25, 50, 75, 100];
    const alignmentScore = alignmentValues[Math.floor(random() * alignmentValues.length)];
    
    // Use demo-member-X IDs that match story API (1-5 have predefined stories)
    const memberId = i < 5 ? `demo-member-${i + 1}` : `demo-user-${i + 1}`;
    const hasStoryForMember = i < 5 ? true : random() > 0.4; // First 5 always have stories
    
    members.push({
      odataId: `demo-member-${squadId}-${i + 1}`,
      odataUserId: memberId,
      odataSquadId: squadId,
      email: generateEmail(firstName, lastName, i),
      name: fullName,
      firstName,
      lastName,
      imageUrl: generateAvatarUrl(fullName),
      joinedAt: randomPastDate(90).toISOString(),
      role: i === 0 ? 'admin' : 'member',
      streak: streak,
      alignment: {
        score: alignmentScore,
        trend: trends[i % trends.length],
      },
      hasStory: hasStoryForMember,
      hasDayClosed: i < 5 ? [true, false, true, false, true][i] : random() > 0.5
    });
  }
  
  return members;
}

/**
 * Generate demo squad members specifically for PROGRAM squads
 * Uses a different seed offset to ensure different members than standalone squads
 */
export function generateDemoProgramSquadMembers(squadId: string, count: number = 12): DemoSquadMember[] {
  // Use a different seed offset (+ 1000) to get completely different names
  const random = seededRandom((parseInt(squadId.replace(/\D/g, '')) || 50) + 1000);
  const members: DemoSquadMember[] = [];
  
  const trends: ('up' | 'down' | 'stable')[] = ['up', 'stable', 'up', 'down', 'stable'];
  
  for (let i = 0; i < count; i++) {
    // Offset the name indices to get different combinations
    const firstNameIndex = (Math.floor(random() * FIRST_NAMES.length) + 20) % FIRST_NAMES.length;
    const lastNameIndex = (Math.floor(random() * LAST_NAMES.length) + 15) % LAST_NAMES.length;
    const firstName = FIRST_NAMES[firstNameIndex];
    const lastName = LAST_NAMES[lastNameIndex];
    const fullName = `${firstName} ${lastName}`;
    
    const streak = Math.floor(random() * 15) + 1;
    const alignmentValues = [0, 25, 50, 75, 100];
    const alignmentScore = alignmentValues[Math.floor(random() * alignmentValues.length)];
    
    // Use program-specific member IDs
    const memberId = `demo-prog-member-${i + 1}`;
    const hasStoryForMember = i < 5 ? true : random() > 0.4;
    
    members.push({
      odataId: `demo-prog-member-${squadId}-${i + 1}`,
      odataUserId: memberId,
      odataSquadId: squadId,
      email: generateEmail(firstName, lastName, i + 100),
      name: fullName,
      firstName,
      lastName,
      imageUrl: generateAvatarUrl(fullName),
      joinedAt: randomPastDate(60).toISOString(),
      role: i === 0 ? 'admin' : 'member',
      streak: streak,
      alignment: {
        score: alignmentScore,
        trend: trends[i % trends.length],
      },
      hasStory: hasStoryForMember,
      hasDayClosed: i < 5 ? [true, false, true, false, true][i] : random() > 0.5
    });
  }
  
  return members;
}

// ============================================================================
// PROGRAMS
// ============================================================================

export interface DemoProgramWithStats {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImageUrl?: string;
  type: 'group' | 'individual';
  durationDays: number;
  priceInCents: number;
  subscriptionEnabled?: boolean;
  billingInterval?: 'monthly' | 'quarterly' | 'yearly';
  isPublished: boolean;
  enrolledCount: number;
  activeEnrollments: number;
  completedEnrollments: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
}

export interface DemoProgramCohort {
  id: string;
  name: string;
  programId: string;
  startDate: string;
  endDate: string;
  maxParticipants: number | null;
  enrolledCount: number;
  isActive: boolean;
}

export interface DemoProgramDay {
  id: string;
  programId: string;
  dayIndex: number;
  title: string;
  summary: string;
  dailyPrompt?: string;
  tasks: DemoProgramTask[];
  habits: DemoProgramHabit[];
}

export interface DemoProgramTask {
  id: string;
  label: string;
  type: 'task' | 'learning';
  isPrimary: boolean;
  estimatedMinutes?: number;
  notes?: string;
}

export interface DemoProgramHabit {
  id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'custom';
}

const PROGRAM_DATA = [
  {
    name: '30-Day Transformation',
    slug: '30-day-transformation',
    description: 'Transform your life in 30 days with daily guided actions.',
    coverImageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop',
    durationDays: 30,
    priceInCents: 29700,
  },
  {
    name: 'Content Creator Accelerator',
    slug: 'content-creator-accelerator',
    description: 'Build your personal brand and grow your audience.',
    coverImageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=450&fit=crop',
    durationDays: 60,
    priceInCents: 49700,
  },
  {
    name: 'Business Growth Intensive',
    slug: 'business-growth-intensive',
    description: 'Scale your business with proven strategies.',
    coverImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
    durationDays: 90,
    priceInCents: 99700,
  },
  {
    name: 'Mindset Mastery',
    slug: 'mindset-mastery',
    description: 'Develop an unstoppable mindset for success.',
    coverImageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=450&fit=crop',
    durationDays: 21,
    priceInCents: 19700,
  },
];

const DAY_TITLES = [
  'Foundation & Vision', 'Goal Setting', 'Building Momentum', 'Core Skills',
  'Overcoming Obstacles', 'Mindset Shift', 'Taking Action', 'Reflection & Growth',
  'Accountability', 'Leveling Up', 'Deep Work', 'Community Connection',
  'Habit Formation', 'Energy Management', 'Strategic Planning', 'Execution Mode',
];

const TASK_TEMPLATES = [
  { label: 'Complete morning reflection', type: 'learning' as const },
  { label: 'Watch training video', type: 'learning' as const },
  { label: 'Complete worksheet', type: 'task' as const },
  { label: 'Journal prompt exercise', type: 'learning' as const },
  { label: 'Implement key strategy', type: 'task' as const },
  { label: 'Review and optimize', type: 'task' as const },
  { label: 'Community check-in', type: 'task' as const },
  { label: 'Practice new skill', type: 'task' as const },
];

const HABIT_TEMPLATES = [
  { title: 'Morning Meditation', description: '10 minutes of guided meditation', frequency: 'daily' as const },
  { title: 'Gratitude Journaling', description: 'Write 3 things you\'re grateful for', frequency: 'daily' as const },
  { title: 'Exercise', description: '30 minutes of physical activity', frequency: 'daily' as const },
  { title: 'Weekly Review', description: 'Reflect on progress and plan ahead', frequency: 'weekly' as const },
  { title: 'Deep Work Block', description: '2 hours of focused work', frequency: 'daily' as const },
];

export function generateDemoProgramsWithStats(): DemoProgramWithStats[] {
  const random = seededRandom(200);
  
  return PROGRAM_DATA.map((prog, i) => {
    const enrolled = 15 + Math.floor(random() * 50);
    const completed = Math.floor(enrolled * (0.3 + random() * 0.4));
    const active = enrolled - completed - Math.floor(random() * 5);
    // Some programs have recurring subscriptions
    const isSubscription = i === 2; // Business Growth Intensive is recurring
    
    return {
      id: `demo-prog-${i + 1}`,
      name: prog.name,
      slug: prog.slug,
      description: prog.description,
      coverImageUrl: prog.coverImageUrl,
      type: random() < 0.7 ? 'group' : 'individual',
      durationDays: prog.durationDays,
      priceInCents: prog.priceInCents,
      subscriptionEnabled: isSubscription,
      billingInterval: isSubscription ? 'monthly' : undefined,
      isPublished: true,
      enrolledCount: enrolled,
      activeEnrollments: active > 0 ? active : 0,
      completedEnrollments: completed,
      totalRevenue: enrolled * prog.priceInCents,
      createdAt: randomPastDate(365).toISOString(),
      updatedAt: randomPastDate(7).toISOString(),
    };
  });
}

export function generateDemoProgramCohorts(programId: string): DemoProgramCohort[] {
  const random = seededRandom(parseInt(programId.replace(/\D/g, '')) * 10 || 300);
  const cohorts: DemoProgramCohort[] = [];
  
  const cohortNames = ['Spring 2024', 'Summer 2024', 'Fall 2024', 'Winter 2025'];
  
  for (let i = 0; i < 3; i++) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (90 - i * 30));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);
    
    const maxParticipants = random() < 0.5 ? 20 + Math.floor(random() * 30) : null;
    const enrolled = 8 + Math.floor(random() * 15);
    
    cohorts.push({
      id: `demo-cohort-${programId}-${i + 1}`,
      name: cohortNames[i] || `Cohort ${i + 1}`,
      programId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      maxParticipants,
      enrolledCount: enrolled,
      isActive: i === 0,
    });
  }
  
  return cohorts;
}

export function generateDemoProgramDays(programId: string, durationDays: number = 30): DemoProgramDay[] {
  const random = seededRandom(parseInt(programId.replace(/\D/g, '')) * 20 || 400);
  const days: DemoProgramDay[] = [];
  
  const numDays = Math.min(durationDays, 30); // Cap at 30 for demo
  
  for (let i = 0; i < numDays; i++) {
    const dayIndex = i + 1;
    const titleIndex = i % DAY_TITLES.length;
    
    // Generate 2-4 tasks per day
    const numTasks = 2 + Math.floor(random() * 3);
    const tasks: DemoProgramTask[] = [];
    for (let t = 0; t < numTasks; t++) {
      const template = TASK_TEMPLATES[Math.floor(random() * TASK_TEMPLATES.length)];
      tasks.push({
        id: `demo-task-${programId}-${dayIndex}-${t + 1}`,
        label: template.label,
        type: template.type,
        isPrimary: t === 0,
        estimatedMinutes: 10 + Math.floor(random() * 30),
      });
    }
    
    // Generate 1-2 habits per day (only first week)
    const habits: DemoProgramHabit[] = [];
    if (dayIndex <= 7) {
      const numHabits = 1 + Math.floor(random() * 2);
      for (let h = 0; h < numHabits; h++) {
        const template = HABIT_TEMPLATES[Math.floor(random() * HABIT_TEMPLATES.length)];
        habits.push({
          id: `demo-habit-${programId}-${dayIndex}-${h + 1}`,
          title: template.title,
          description: template.description,
          frequency: template.frequency,
        });
      }
    }
    
    days.push({
      id: `demo-day-${programId}-${dayIndex}`,
      programId,
      dayIndex,
      title: `Day ${dayIndex}: ${DAY_TITLES[titleIndex]}`,
      summary: `Focus on ${DAY_TITLES[titleIndex].toLowerCase()} and build momentum.`,
      dailyPrompt: random() < 0.7 ? `What does ${DAY_TITLES[titleIndex].toLowerCase()} mean to you?` : undefined,
      tasks,
      habits,
    });
  }
  
  return days;
}

// ============================================================================
// REFERRALS
// ============================================================================

export type DemoReferralStatus = 'pending' | 'completed' | 'rewarded' | 'expired';

export interface DemoReferral {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referrerImageUrl: string;
  referredId?: string;
  referredName?: string;
  referredEmail: string;
  referredImageUrl?: string;
  programId?: string;
  programName?: string;
  squadId?: string;
  squadName?: string;
  status: DemoReferralStatus;
  rewardType?: 'discount' | 'free_month' | 'commission';
  rewardValue?: number;
  createdAt: string;
  completedAt?: string;
  rewardedAt?: string;
}

export interface DemoReferralStats {
  total: number;
  pending: number;
  completed: number;
  rewarded: number;
  conversionRate: number;
}

export function generateDemoReferrals(): { referrals: DemoReferral[]; stats: DemoReferralStats } {
  const random = seededRandom(500);
  const referrals: DemoReferral[] = [];
  
  const statusDistribution: DemoReferralStatus[] = [
    'pending', 'pending', 'pending', 'pending',
    'completed', 'completed', 'completed',
    'rewarded', 'rewarded',
    'expired',
  ];
  
  for (let i = 0; i < 20; i++) {
    const referrerFirstName = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const referrerLastName = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    const referrerName = `${referrerFirstName} ${referrerLastName}`;
    
    const referredFirstName = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const referredLastName = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    const referredName = `${referredFirstName} ${referredLastName}`;
    
    const status = statusDistribution[Math.floor(random() * statusDistribution.length)];
    const hasProgram = random() < 0.6;
    const program = hasProgram ? DEMO_PROGRAMS[Math.floor(random() * DEMO_PROGRAMS.length)] : null;
    const squad = !hasProgram ? DEMO_SQUADS[Math.floor(random() * DEMO_SQUADS.length)] : null;
    
    const createdAt = randomPastDate(60);
    
    referrals.push({
      id: `demo-referral-${i + 1}`,
      referrerId: `demo-user-${Math.floor(random() * 18) + 1}`,
      referrerName,
      referrerEmail: generateEmail(referrerFirstName, referrerLastName, i),
      referrerImageUrl: generateAvatarUrl(referrerName),
      referredId: status !== 'pending' ? `demo-user-ref-${i + 1}` : undefined,
      referredName: status !== 'pending' ? referredName : undefined,
      referredEmail: generateEmail(referredFirstName, referredLastName, i + 100),
      referredImageUrl: status !== 'pending' ? generateAvatarUrl(referredName) : undefined,
      programId: program?.id,
      programName: program?.name,
      squadId: squad?.id,
      squadName: squad?.name,
      status,
      rewardType: status === 'rewarded' ? (['discount', 'free_month', 'commission'] as const)[Math.floor(random() * 3)] : undefined,
      rewardValue: status === 'rewarded' ? Math.floor(random() * 50) + 10 : undefined,
      createdAt: createdAt.toISOString(),
      completedAt: status !== 'pending' && status !== 'expired' ? new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      rewardedAt: status === 'rewarded' ? new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
    });
  }
  
  const pending = referrals.filter(r => r.status === 'pending').length;
  const completed = referrals.filter(r => r.status === 'completed').length;
  const rewarded = referrals.filter(r => r.status === 'rewarded').length;
  
  return {
    referrals,
    stats: {
      total: referrals.length,
      pending,
      completed,
      rewarded,
      conversionRate: Math.round(((completed + rewarded) / referrals.length) * 100),
    },
  };
}

// ============================================================================
// FUNNELS
// ============================================================================

export interface DemoFunnelStep {
  id: string;
  funnelId: string;
  stepIndex: number;
  type: 'landing' | 'form' | 'video' | 'checkout' | 'upsell' | 'thank_you';
  title: string;
}

export interface DemoFunnel {
  id: string;
  name: string;
  slug: string;
  targetType: 'intake' | 'program' | 'squad' | 'content';
  targetId?: string;
  targetName?: string;
  isActive: boolean;
  steps: DemoFunnelStep[];
  createdAt: string;
  updatedAt: string;
}

const FUNNEL_TEMPLATES = [
  { name: 'Program Launch Funnel', targetType: 'program' as const },
  { name: 'Free Webinar Funnel', targetType: 'content' as const },
  // DEPRECATED: Squad funnels disabled. Squads now managed via Program > Community
  // { name: 'Community Entry Funnel', targetType: 'squad' as const },
  { name: 'Lead Magnet Funnel', targetType: 'content' as const },
];

const STEP_TYPES: DemoFunnelStep['type'][] = ['landing', 'form', 'video', 'checkout', 'thank_you'];

export function generateDemoFunnels(): DemoFunnel[] {
  const random = seededRandom(600);
  const funnels: DemoFunnel[] = [];

  for (let i = 0; i < FUNNEL_TEMPLATES.length; i++) {
    const template = FUNNEL_TEMPLATES[i];
    const numSteps = 3 + Math.floor(random() * 3); // 3-5 steps
    
    let targetId: string | undefined;
    let targetName: string | undefined;
    
    if (template.targetType === 'program') {
      const program = DEMO_PROGRAMS[Math.floor(random() * DEMO_PROGRAMS.length)];
      targetId = program.id;
      targetName = program.name;
    }
    // DEPRECATED: Squad funnels disabled
    // } else if (template.targetType === 'squad') {
    //   const squad = DEMO_SQUADS[Math.floor(random() * DEMO_SQUADS.length)];
    //   targetId = squad.id;
    //   targetName = squad.name;
    // }
    
    const steps: DemoFunnelStep[] = [];
    for (let s = 0; s < numSteps; s++) {
      steps.push({
        id: `demo-step-${i + 1}-${s + 1}`,
        funnelId: `demo-funnel-${i + 1}`,
        stepIndex: s,
        type: STEP_TYPES[s % STEP_TYPES.length],
        title: `Step ${s + 1}`,
      });
    }
    
    funnels.push({
      id: `demo-funnel-${i + 1}`,
      name: template.name,
      slug: template.name.toLowerCase().replace(/\s+/g, '-'),
      targetType: template.targetType,
      targetId,
      targetName,
      isActive: random() < 0.75,
      steps,
      createdAt: randomPastDate(120).toISOString(),
      updatedAt: randomPastDate(14).toISOString(),
    });
  }
  
  return funnels;
}

// ============================================================================
// ANALYTICS: COMMUNITY HEALTH
// ============================================================================

export type DemoSquadHealthStatus = 'thriving' | 'active' | 'inactive';

export interface DemoSquadAnalytics {
  squadId: string;
  name: string;
  memberCount: number;
  healthStatus: DemoSquadHealthStatus;
  activeRate: number;
  messageCount: number;
  avgMessagesPerMember: number;
  trend: 'up' | 'down' | 'stable';
  lastActivityAt: string | null;
}

export interface DemoCommunityHealthSummary {
  thriving: number;
  active: number;
  inactive: number;
  total: number;
}

export function generateDemoCommunityHealth(): {
  communities: DemoSquadAnalytics[];
  summary: DemoCommunityHealthSummary;
} {
  const random = seededRandom(700);
  const communities: DemoSquadAnalytics[] = [];
  
  const healthDistribution: DemoSquadHealthStatus[] = ['thriving', 'thriving', 'active', 'active', 'inactive'];
  
  for (let i = 0; i < 5; i++) {
    const squadInfo = SQUAD_NAMES[i];
    const health = healthDistribution[i];
    const memberCount = 10 + Math.floor(random() * 30);
    
    let activeRate = 0;
    let messageCount = 0;
    
    if (health === 'thriving') {
      activeRate = 70 + Math.floor(random() * 25);
      messageCount = memberCount * (5 + Math.floor(random() * 10));
    } else if (health === 'active') {
      activeRate = 40 + Math.floor(random() * 30);
      messageCount = memberCount * (2 + Math.floor(random() * 5));
    } else {
      activeRate = Math.floor(random() * 30);
      messageCount = Math.floor(random() * memberCount);
    }
    
    communities.push({
      squadId: `demo-squad-${i + 1}`,
      name: squadInfo.name,
      memberCount,
      healthStatus: health,
      activeRate,
      messageCount,
      avgMessagesPerMember: Math.round((messageCount / memberCount) * 10) / 10,
      trend: health === 'thriving' ? 'up' : health === 'inactive' ? 'down' : 'stable',
      lastActivityAt: health !== 'inactive' ? randomPastDate(3).toISOString() : randomPastDate(14).toISOString(),
    });
  }
  
  return {
    communities,
    summary: {
      thriving: communities.filter(c => c.healthStatus === 'thriving').length,
      active: communities.filter(c => c.healthStatus === 'active').length,
      inactive: communities.filter(c => c.healthStatus === 'inactive').length,
      total: communities.length,
    },
  };
}

// ============================================================================
// ANALYTICS: FEED
// ============================================================================

export interface DemoPosterStats {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  postCount: number;
  lastPostAt: string | null;
  totalEngagement: number;
}

export interface DemoDailyFeedStats {
  date: string;
  postCount: number;
  engagementCount: number;
}

export interface DemoFeedSummary {
  totalPosts: number;
  totalEngagement: number;
  totalLikes: number;
  totalComments: number;
  activePosters: number;
  avgEngagementPerPost: number;
}

export function generateDemoFeedAnalytics(): {
  posters: DemoPosterStats[];
  dailyStats: DemoDailyFeedStats[];
  summary: DemoFeedSummary;
} {
  const random = seededRandom(800);
  const posters: DemoPosterStats[] = [];
  
  // Generate 10 active posters
  for (let i = 0; i < 10; i++) {
    const firstName = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    const fullName = `${firstName} ${lastName}`;
    const postCount = 2 + Math.floor(random() * 15);
    
    posters.push({
      userId: `demo-user-${i + 1}`,
      name: fullName,
      email: generateEmail(firstName, lastName, i),
      avatarUrl: generateAvatarUrl(fullName),
      postCount,
      lastPostAt: randomPastDate(7).toISOString(),
      totalEngagement: postCount * (3 + Math.floor(random() * 10)),
    });
  }
  
  // Generate 30 days of daily stats
  const dailyStats: DemoDailyFeedStats[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dailyStats.push({
      date: date.toISOString().split('T')[0],
      postCount: 2 + Math.floor(random() * 8),
      engagementCount: 10 + Math.floor(random() * 40),
    });
  }
  
  const totalPosts = posters.reduce((sum, p) => sum + p.postCount, 0);
  const totalEngagement = posters.reduce((sum, p) => sum + p.totalEngagement, 0);
  
  return {
    posters,
    dailyStats,
    summary: {
      totalPosts,
      totalEngagement,
      totalLikes: Math.floor(totalEngagement * 0.7),
      totalComments: Math.floor(totalEngagement * 0.3),
      activePosters: posters.length,
      avgEngagementPerPost: Math.round((totalEngagement / totalPosts) * 10) / 10,
    },
  };
}

// ============================================================================
// ANALYTICS: CHAT
// ============================================================================

export interface DemoChannelStats {
  channelId: string;
  channelType: string;
  name: string;
  squadId?: string;
  squadName?: string;
  memberCount: number;
  messageCount: number;
  messagesLast7Days: number;
  lastMessageAt: string | null;
  createdAt: string;
  image?: string;
}

export interface DemoDailyChatStats {
  date: string;
  messageCount: number;
  activeChannels: number;
}

export interface DemoChatSummary {
  totalChannels: number;
  activeChannels: number;
  squadChannels: number;
  totalMessages: number;
  avgMessagesPerChannel: number;
}

export function generateDemoChatAnalytics(): {
  channels: DemoChannelStats[];
  dailyStats: DemoDailyChatStats[];
  summary: DemoChatSummary;
} {
  const random = seededRandom(900);
  const channels: DemoChannelStats[] = [];
  
  // Generate squad channels with varying activity levels
  const activityLevels = [
    { min7Day: 15, max7Day: 30 },  // Thriving
    { min7Day: 8, max7Day: 15 },   // Active
    { min7Day: 3, max7Day: 8 },    // Active
    { min7Day: 0, max7Day: 3 },    // Inactive/barely active
    { min7Day: 0, max7Day: 0 },    // Inactive
  ];

  for (let i = 0; i < 5; i++) {
    const squadInfo = SQUAD_NAMES[i];
    const messageCount = 50 + Math.floor(random() * 200);
    const activity = activityLevels[i];
    const messagesLast7Days = activity.min7Day + Math.floor(random() * (activity.max7Day - activity.min7Day + 1));

    channels.push({
      channelId: `demo-channel-squad-${i + 1}`,
      channelType: 'messaging',
      name: squadInfo.name,
      squadId: `demo-squad-${i + 1}`,
      squadName: squadInfo.name,
      memberCount: 8 + Math.floor(random() * 20),
      messageCount,
      messagesLast7Days,
      lastMessageAt: randomPastDate(3).toISOString(),
      createdAt: randomPastDate(90).toISOString(),
    });
  }

  // Generate organization channels with varying activity
  const orgChannelNames = ['Announcements', 'Social Corner', 'Share your wins'];
  const orgActivityLevels = [
    { min7Day: 1, max7Day: 3 },   // Low activity
    { min7Day: 1, max7Day: 2 },   // Low activity
    { min7Day: 0, max7Day: 0 },   // Inactive
  ];

  for (let i = 0; i < 3; i++) {
    const activity = orgActivityLevels[i];
    const messagesLast7Days = activity.min7Day + Math.floor(random() * (activity.max7Day - activity.min7Day + 1));

    channels.push({
      channelId: `demo-channel-org-${i + 1}`,
      channelType: 'messaging',
      name: orgChannelNames[i],
      memberCount: 10 + Math.floor(random() * 15),
      messageCount: 5 + Math.floor(random() * 30),
      messagesLast7Days,
      lastMessageAt: messagesLast7Days > 0 ? randomPastDate(7).toISOString() : randomPastDate(30).toISOString(),
      createdAt: randomPastDate(90).toISOString(),
    });
  }

  // Generate some DM channels (not shown in analytics but kept for completeness)
  for (let i = 0; i < 5; i++) {
    const firstName = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    const messagesLast7Days = Math.floor(random() * 10);

    channels.push({
      channelId: `demo-channel-dm-${i + 1}`,
      channelType: 'messaging',
      name: `${firstName} ${lastName}`,
      memberCount: 2,
      messageCount: 10 + Math.floor(random() * 50),
      messagesLast7Days,
      lastMessageAt: randomPastDate(7).toISOString(),
      createdAt: randomPastDate(60).toISOString(),
    });
  }
  
  // Generate 30 days of daily stats
  const dailyStats: DemoDailyChatStats[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dailyStats.push({
      date: date.toISOString().split('T')[0],
      messageCount: 20 + Math.floor(random() * 80),
      activeChannels: 3 + Math.floor(random() * 8),
    });
  }
  
  const totalMessages = channels.reduce((sum, c) => sum + c.messageCount, 0);
  const activeChannels = channels.filter(c => {
    if (!c.lastMessageAt) return false;
    const daysSince = (Date.now() - new Date(c.lastMessageAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  }).length;
  
  return {
    channels,
    dailyStats,
    summary: {
      totalChannels: channels.length,
      activeChannels,
      squadChannels: channels.filter(c => c.squadId).length,
      totalMessages,
      avgMessagesPerChannel: Math.round(totalMessages / channels.length),
    },
  };
}

// ============================================================================
// ANALYTICS: PRODUCTS
// ============================================================================

export interface DemoProductProgram {
  id: string;
  name: string;
  type: 'self_paced' | 'group';
  enrolledCount: number;
  activeEnrollments: number;
  completedEnrollments: number;
  totalRevenue: number;
  createdAt: string;
}

export interface DemoProductSquad {
  id: string;
  name: string;
  type: 'standalone' | 'program';
  memberCount: number;
  programId?: string;
  programName?: string;
  createdAt: string;
}

export interface DemoProductContent {
  id: string;
  type: 'course' | 'article' | 'event' | 'download' | 'link';
  title: string;
  purchaserCount: number;
  totalRevenue: number;
  priceInCents: number;
  createdAt: string;
}

export interface DemoProductSummary {
  totalPrograms: number;
  totalSquads: number;
  totalContentItems: number;
  totalEnrollments: number;
  totalMembers: number;
  totalRevenue: number;
}

export function generateDemoProductAnalytics(): {
  programs: DemoProductProgram[];
  squads: DemoProductSquad[];
  content: DemoProductContent[];
  summary: DemoProductSummary;
} {
  const random = seededRandom(1000);
  
  // Generate programs
  const programs: DemoProductProgram[] = PROGRAM_DATA.map((prog, i) => {
    const enrolled = 15 + Math.floor(random() * 50);
    const completed = Math.floor(enrolled * (0.3 + random() * 0.3));
    const active = Math.max(0, enrolled - completed - Math.floor(random() * 5));
    
    return {
      id: `demo-prog-${i + 1}`,
      name: prog.name,
      type: random() < 0.7 ? 'group' : 'self_paced',
      enrolledCount: enrolled,
      activeEnrollments: active,
      completedEnrollments: completed,
      totalRevenue: enrolled * prog.priceInCents,
      createdAt: randomPastDate(180).toISOString(),
    };
  });
  
  // Generate squads
  const squads: DemoProductSquad[] = SQUAD_NAMES.slice(0, 5).map((squadInfo, i) => ({
    id: `demo-squad-${i + 1}`,
    name: squadInfo.name,
    type: i < 3 ? 'program' : 'standalone',
    memberCount: 8 + Math.floor(random() * 25),
    programId: i < 3 ? DEMO_PROGRAMS[i % DEMO_PROGRAMS.length].id : undefined,
    programName: i < 3 ? DEMO_PROGRAMS[i % DEMO_PROGRAMS.length].name : undefined,
    createdAt: randomPastDate(120).toISOString(),
  }));
  
  // Generate content items
  const contentTypes: DemoProductContent['type'][] = ['course', 'article', 'event', 'download', 'link'];
  const contentTitles = [
    'Ultimate Guide to Success', 'Productivity Masterclass', 'Live Q&A Session',
    'Strategy Workbook', 'Resource Library', 'Bonus Training Video',
  ];
  
  const content: DemoProductContent[] = contentTitles.slice(0, 5).map((title, i) => {
    const purchasers = Math.floor(random() * 30);
    const price = (1 + Math.floor(random() * 10)) * 1000;
    
    return {
      id: `demo-content-${i + 1}`,
      type: contentTypes[i % contentTypes.length],
      title,
      purchaserCount: purchasers,
      totalRevenue: purchasers * price,
      priceInCents: price,
      createdAt: randomPastDate(90).toISOString(),
    };
  });
  
  const totalEnrollments = programs.reduce((sum, p) => sum + p.enrolledCount, 0);
  const totalMembers = squads.reduce((sum, s) => sum + s.memberCount, 0);
  const totalRevenue = programs.reduce((sum, p) => sum + p.totalRevenue, 0) +
                       content.reduce((sum, c) => sum + c.totalRevenue, 0);
  
  return {
    programs,
    squads,
    content,
    summary: {
      totalPrograms: programs.length,
      totalSquads: squads.length,
      totalContentItems: content.length,
      totalEnrollments,
      totalMembers,
      totalRevenue,
    },
  };
}

// ============================================================================
// ANALYTICS: FUNNELS
// ============================================================================

export interface DemoFunnelStepAnalytics {
  stepIndex: number;
  stepId: string;
  stepType: string;
  views: number;
  completions: number;
  dropOff: number;
  dropOffRate: number;
}

export interface DemoFunnelAnalytics {
  id: string;
  name: string;
  programId?: string;
  programName?: string;
  squadId?: string;
  squadName?: string;
  isActive: boolean;
  totalViews: number;
  totalStarts: number;
  totalCompletions: number;
  totalRevenue: number;
  startRate: number;
  conversionRate: number;
  completionRate: number;
  steps: DemoFunnelStepAnalytics[];
  highestDropOffStep?: {
    stepIndex: number;
    stepId: string;
    dropOffRate: number;
  };
  createdAt: string;
}

export interface DemoFunnelAnalyticsSummary {
  totalFunnels: number;
  totalViews: number;
  totalCompletions: number;
  totalRevenue: number;
  overallConversionRate: number;
}

export function generateDemoFunnelAnalytics(): {
  funnels: DemoFunnelAnalytics[];
  summary: DemoFunnelAnalyticsSummary;
} {
  const random = seededRandom(1100);
  const funnels: DemoFunnelAnalytics[] = [];
  
  for (let i = 0; i < FUNNEL_TEMPLATES.length; i++) {
    const template = FUNNEL_TEMPLATES[i];
    const numSteps = 3 + Math.floor(random() * 3);

    let targetProgramId: string | undefined;
    let targetProgramName: string | undefined;
    // DEPRECATED: Squad funnels disabled
    // let targetSquadId: string | undefined;
    // let targetSquadName: string | undefined;

    if (template.targetType === 'program') {
      const program = DEMO_PROGRAMS[i % DEMO_PROGRAMS.length];
      targetProgramId = program.id;
      targetProgramName = program.name;
    }
    // DEPRECATED: Squad funnels disabled
    // } else if (template.targetType === 'squad') {
    //   const squad = DEMO_SQUADS[i % DEMO_SQUADS.length];
    //   targetSquadId = squad.id;
    //   targetSquadName = squad.name;
    // }
    
    const totalViews = 200 + Math.floor(random() * 800);
    const totalStarts = Math.floor(totalViews * (0.4 + random() * 0.3));
    const totalCompletions = Math.floor(totalStarts * (0.15 + random() * 0.35));
    const revenuePerConversion = 5000 + Math.floor(random() * 25000);
    
    // Generate step analytics with progressive drop-off
    const steps: DemoFunnelStepAnalytics[] = [];
    let currentViews = totalViews;
    let highestDropOff: DemoFunnelAnalytics['highestDropOffStep'] = undefined;
    
    for (let s = 0; s < numSteps; s++) {
      const dropOffRate = 15 + Math.floor(random() * 30);
      const completions = Math.floor(currentViews * (1 - dropOffRate / 100));
      const dropOff = currentViews - completions;
      
      if (!highestDropOff || dropOffRate > highestDropOff.dropOffRate) {
        highestDropOff = {
          stepIndex: s,
          stepId: `demo-step-${i + 1}-${s + 1}`,
          dropOffRate,
        };
      }
      
      steps.push({
        stepIndex: s,
        stepId: `demo-step-${i + 1}-${s + 1}`,
        stepType: STEP_TYPES[s % STEP_TYPES.length],
        views: currentViews,
        completions,
        dropOff,
        dropOffRate,
      });
      
      currentViews = completions;
    }
    
    funnels.push({
      id: `demo-funnel-${i + 1}`,
      name: template.name,
      programId: targetProgramId,
      programName: targetProgramName,
      // DEPRECATED: Squad funnels disabled
      // squadId: targetSquadId,
      // squadName: targetSquadName,
      squadId: undefined,
      squadName: undefined,
      isActive: random() < 0.75,
      totalViews,
      totalStarts,
      totalCompletions,
      totalRevenue: totalCompletions * revenuePerConversion,
      startRate: Math.round((totalStarts / totalViews) * 100),
      conversionRate: Math.round((totalCompletions / totalViews) * 100),
      completionRate: Math.round((totalCompletions / totalStarts) * 100),
      steps,
      highestDropOffStep: highestDropOff,
      createdAt: randomPastDate(120).toISOString(),
    });
  }
  
  const totalViews = funnels.reduce((sum, f) => sum + f.totalViews, 0);
  const totalCompletions = funnels.reduce((sum, f) => sum + f.totalCompletions, 0);
  const totalRevenue = funnels.reduce((sum, f) => sum + f.totalRevenue, 0);
  
  return {
    funnels,
    summary: {
      totalFunnels: funnels.length,
      totalViews,
      totalCompletions,
      totalRevenue,
      overallConversionRate: Math.round((totalCompletions / totalViews) * 100),
    },
  };
}

// ============================================================================
// CHECK-IN FLOWS
// ============================================================================

export interface DemoCheckInStep {
  id: string;
  flowId: string;
  stepIndex: number;
  type: 'question' | 'rating' | 'text' | 'multiple_choice';
  title: string;
  description?: string;
  options?: string[];
  required: boolean;
}

export interface DemoCheckInFlow {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  frequency: 'daily' | 'weekly' | 'custom';
  steps: DemoCheckInStep[];
  responseCount: number;
  createdAt: string;
  updatedAt: string;
}

const CHECKIN_FLOW_TEMPLATES = [
  {
    name: 'Daily Reflection',
    description: 'Quick daily check-in to track progress and mood',
    frequency: 'daily' as const,
    steps: [
      { type: 'rating' as const, title: 'How are you feeling today?', description: 'Rate your overall energy level' },
      { type: 'text' as const, title: 'What\'s your main focus for today?', required: true },
      { type: 'multiple_choice' as const, title: 'Did you complete yesterday\'s goals?', options: ['Yes, all of them', 'Most of them', 'Some of them', 'Not yet'] },
    ],
  },
  {
    name: 'Weekly Review',
    description: 'End-of-week reflection on wins and challenges',
    frequency: 'weekly' as const,
    steps: [
      { type: 'text' as const, title: 'What were your biggest wins this week?', required: true },
      { type: 'text' as const, title: 'What challenges did you face?', required: false },
      { type: 'rating' as const, title: 'How satisfied are you with your progress?', description: '1 = Not at all, 10 = Extremely' },
      { type: 'text' as const, title: 'What will you focus on next week?', required: true },
    ],
  },
];

export function generateDemoCheckInFlows(): DemoCheckInFlow[] {
  const random = seededRandom(1200);
  const flows: DemoCheckInFlow[] = [];
  
  CHECKIN_FLOW_TEMPLATES.forEach((template, i) => {
    const flowId = `demo-checkin-flow-${i + 1}`;
    const steps: DemoCheckInStep[] = template.steps.map((step, j) => ({
      id: `demo-checkin-step-${i + 1}-${j + 1}`,
      flowId,
      stepIndex: j,
      type: step.type,
      title: step.title,
      description: step.description,
      options: 'options' in step ? step.options : undefined,
      required: step.required ?? true,
    }));
    
    flows.push({
      id: flowId,
      name: template.name,
      description: template.description,
      isActive: i === 0, // First one is active
      frequency: template.frequency,
      steps,
      responseCount: 50 + Math.floor(random() * 150),
      createdAt: randomPastDate(90).toISOString(),
      updatedAt: randomPastDate(7).toISOString(),
    });
  });
  
  return flows;
}

// ============================================================================
// ONBOARDING FLOW
// ============================================================================

export interface DemoOnboardingStep {
  id: string;
  stepIndex: number;
  type: 'welcome' | 'profile' | 'goals' | 'preferences' | 'complete';
  title: string;
  description: string;
  isRequired: boolean;
}

export interface DemoOnboardingFlow {
  id: string;
  name: string;
  isActive: boolean;
  steps: DemoOnboardingStep[];
  completionCount: number;
  averageCompletionTime: number; // in minutes
  createdAt: string;
  updatedAt: string;
}

export function generateDemoOnboardingFlow(): DemoOnboardingFlow {
  const random = seededRandom(1300);
  const flowId = 'demo-onboarding-flow-1';
  
  const steps: DemoOnboardingStep[] = [
    { id: `${flowId}-step-1`, stepIndex: 0, type: 'welcome', title: 'Welcome!', description: 'Let\'s get you set up for success', isRequired: true },
    { id: `${flowId}-step-2`, stepIndex: 1, type: 'profile', title: 'Complete Your Profile', description: 'Tell us a bit about yourself', isRequired: true },
    { id: `${flowId}-step-3`, stepIndex: 2, type: 'goals', title: 'Set Your Goals', description: 'What do you want to achieve?', isRequired: true },
    { id: `${flowId}-step-4`, stepIndex: 3, type: 'preferences', title: 'Preferences', description: 'Customize your experience', isRequired: false },
    { id: `${flowId}-step-5`, stepIndex: 4, type: 'complete', title: 'You\'re All Set!', description: 'Ready to start your journey', isRequired: true },
  ];
  
  return {
    id: flowId,
    name: 'New Member Onboarding',
    isActive: true,
    steps,
    completionCount: 45 + Math.floor(random() * 30),
    averageCompletionTime: 5 + Math.floor(random() * 5),
    createdAt: randomPastDate(180).toISOString(),
    updatedAt: randomPastDate(14).toISOString(),
  };
}

// ============================================================================
// CHANNELS
// ============================================================================

export interface DemoChannel {
  id: string;
  name: string;
  description?: string;
  type: 'general' | 'squad' | 'program' | 'announcements' | 'support';
  squadId?: string;
  squadName?: string;
  programId?: string;
  programName?: string;
  memberCount: number;
  messageCount: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function generateDemoChannels(): DemoChannel[] {
  const random = seededRandom(1400);
  const channels: DemoChannel[] = [];
  
  // Default channels
  channels.push({
    id: 'demo-channel-general',
    name: 'General',
    description: 'General discussion for all members',
    type: 'general',
    memberCount: 45,
    messageCount: 320 + Math.floor(random() * 200),
    isDefault: true,
    sortOrder: 0,
    createdAt: randomPastDate(180).toISOString(),
    updatedAt: randomPastDate(1).toISOString(),
  });
  
  channels.push({
    id: 'demo-channel-announcements',
    name: 'Announcements',
    description: 'Important updates and announcements',
    type: 'announcements',
    memberCount: 45,
    messageCount: 25 + Math.floor(random() * 15),
    isDefault: true,
    sortOrder: 1,
    createdAt: randomPastDate(180).toISOString(),
    updatedAt: randomPastDate(7).toISOString(),
  });
  
  channels.push({
    id: 'demo-channel-support',
    name: 'Support',
    description: 'Get help and ask questions',
    type: 'support',
    memberCount: 45,
    messageCount: 85 + Math.floor(random() * 50),
    isDefault: true,
    sortOrder: 2,
    createdAt: randomPastDate(180).toISOString(),
    updatedAt: randomPastDate(2).toISOString(),
  });
  
  // Squad channels
  SQUAD_NAMES.slice(0, 3).forEach((squad, i) => {
    channels.push({
      id: `demo-channel-squad-${i + 1}`,
      name: squad.name,
      description: `Private channel for ${squad.name} members`,
      type: 'squad',
      squadId: `demo-squad-${i + 1}`,
      squadName: squad.name,
      memberCount: 10 + Math.floor(random() * 15),
      messageCount: 100 + Math.floor(random() * 200),
      isDefault: false,
      sortOrder: 10 + i,
      createdAt: randomPastDate(90).toISOString(),
      updatedAt: randomPastDate(3).toISOString(),
    });
  });
  
  return channels;
}

// ============================================================================
// DISCOUNT CODES
// ============================================================================

export interface DemoDiscountCode {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetType: 'all' | 'program' | 'squad';
  targetId?: string;
  targetName?: string;
  usageLimit?: number;
  usageCount: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function generateDemoDiscountCodes(): DemoDiscountCode[] {
  const random = seededRandom(1500);
  const codes: DemoDiscountCode[] = [];
  
  const codeTemplates = [
    { code: 'WELCOME20', description: 'New member discount', discountType: 'percentage' as const, discountValue: 20, targetType: 'all' as const },
    { code: 'TRANSFORM50', description: '50% off 30-Day Transformation', discountType: 'percentage' as const, discountValue: 50, targetType: 'program' as const, targetId: 'demo-prog-1', targetName: '30-Day Transformation' },
    { code: 'SAVE100', description: '$100 off any program', discountType: 'fixed' as const, discountValue: 10000, targetType: 'all' as const },
    { code: 'SQUAD25', description: '25% off squad membership', discountType: 'percentage' as const, discountValue: 25, targetType: 'squad' as const },
    { code: 'EARLYBIRD', description: 'Early bird special', discountType: 'percentage' as const, discountValue: 30, targetType: 'all' as const },
  ];
  
  codeTemplates.forEach((template, i) => {
    const usageLimit = random() < 0.7 ? 50 + Math.floor(random() * 100) : undefined;
    const usageCount = usageLimit ? Math.floor(random() * usageLimit * 0.6) : Math.floor(random() * 30);
    const hasExpiry = random() < 0.5;
    
    codes.push({
      id: `demo-discount-${i + 1}`,
      code: template.code,
      description: template.description,
      discountType: template.discountType,
      discountValue: template.discountValue,
      targetType: template.targetType,
      targetId: template.targetId,
      targetName: template.targetName,
      usageLimit,
      usageCount,
      expiresAt: hasExpiry ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      isActive: i < 4, // First 4 are active
      createdAt: randomPastDate(60).toISOString(),
      updatedAt: randomPastDate(7).toISOString(),
    });
  });
  
  return codes;
}

// ============================================================================
// BRANDING / CUSTOMIZATION
// ============================================================================

export interface DemoBranding {
  logoUrl: string;
  horizontalLogoUrl?: string;
  faviconUrl?: string;
  appTitle: string;
  colors: {
    accentLight: string;
    accentDark: string;
    sidebarLight?: string;
    sidebarDark?: string;
  };
  customDomain?: string;
  socialLinks: {
    website?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
}

export function generateDemoBranding(): DemoBranding {
  return {
    logoUrl: '/logo.png',
    appTitle: 'Coach Adam',
    colors: {
      accentLight: '#a07855',
      accentDark: '#b8896a',
    },
    socialLinks: {
      website: 'https://coachful.co',
      instagram: 'https://instagram.com/coachful',
    },
  };
}

// ============================================================================
// SUBSCRIPTION
// ============================================================================

export interface DemoSubscription {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  plan: 'starter' | 'growth' | 'scale';
  planName: string;
  pricePerMonth: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  features: string[];
}

export function generateDemoSubscription(): DemoSubscription {
  return {
    id: 'demo-subscription-1',
    status: 'active',
    plan: 'growth',
    planName: 'Growth Plan',
    pricePerMonth: 9900, // $99/month
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
    features: [
      'Unlimited clients',
      'Unlimited programs',
      'Custom branding',
      'Analytics dashboard',
      'Priority support',
    ],
  };
}

// ============================================================================
// SCHEDULING / AVAILABILITY
// ============================================================================

export interface DemoTimeSlot {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:mm format
  endTime: string;
  isActive: boolean;
}

export interface DemoBooking {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientImageUrl: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'pending' | 'canceled';
  type: '1:1 Coaching' | 'Discovery Call' | 'Strategy Session';
  notes?: string;
}

export interface DemoSchedulingData {
  availability: DemoTimeSlot[];
  bookings: DemoBooking[];
  timezone: string;
  bufferMinutes: number;
  maxAdvanceDays: number;
}

export function generateDemoScheduling(): DemoSchedulingData {
  const random = seededRandom(1600);
  
  // Default availability: Mon-Fri 9am-5pm
  const availability: DemoTimeSlot[] = [];
  for (let day = 1; day <= 5; day++) {
    availability.push({
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '17:00',
      isActive: true,
    });
  }
  
  // Generate some bookings
  const bookings: DemoBooking[] = [];
  const bookingTypes: DemoBooking['type'][] = ['1:1 Coaching', 'Discovery Call', 'Strategy Session'];
  
  for (let i = 0; i < 8; i++) {
    const daysFromNow = Math.floor(random() * 14) - 3; // -3 to +11 days
    const hour = 9 + Math.floor(random() * 8); // 9am to 4pm
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + daysFromNow);
    startTime.setHours(hour, 0, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 60);
    
    const firstName = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    
    bookings.push({
      id: `demo-booking-${i + 1}`,
      clientId: `demo-user-${i + 1}`,
      clientName: `${firstName} ${lastName}`,
      clientEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      clientImageUrl: generateAvatarUrl(`${firstName} ${lastName}`),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: daysFromNow < 0 ? 'confirmed' : (random() < 0.8 ? 'confirmed' : 'pending'),
      type: bookingTypes[Math.floor(random() * bookingTypes.length)],
    });
  }
  
  // Sort by start time
  bookings.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  
  return {
    availability,
    bookings,
    timezone: typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC',
    bufferMinutes: 15,
    maxAdvanceDays: 60,
  };
}

// ============================================================================
// DISCOVER CONTENT (Articles, Courses, Events)
// ============================================================================

export interface DemoDiscoverItem {
  id: string;
  type: 'article' | 'course' | 'event' | 'download';
  title: string;
  description: string;
  shortDescription?: string;
  imageUrl: string;
  author: string;
  authorImageUrl?: string;
  publishedAt: string;
  readTime?: number; // minutes
  isPublished: boolean;
  isPremium: boolean;
  priceInCents?: number; // For paid content
  currency?: string;
  category?: string;
  level?: string;
  // Landing page content for gated courses
  keyOutcomes?: string[];
  features?: { title: string; description?: string; icon?: string }[];
  testimonials?: { name: string; title?: string; quote: string; rating?: number }[];
  faqs?: { question: string; answer: string }[];
  purchaseType?: 'popup' | 'landing_page';
}

export function generateDemoDiscoverContent(): DemoDiscoverItem[] {
  const items: DemoDiscoverItem[] = [];
  
  const contentTemplates = [
    { type: 'article' as const, title: '10 Habits of Highly Successful People', description: 'Discover the daily habits that drive success', readTime: 8, category: 'habits' },
    { type: 'article' as const, title: 'The Power of Morning Routines', description: 'How to start your day with intention', readTime: 5, category: 'productivity' },
    { 
      type: 'course' as const, 
      title: 'Goal Setting Masterclass', 
      description: 'A comprehensive guide to setting and achieving your goals. Transform your dreams into actionable plans with proven frameworks.',
      shortDescription: 'Master the art of goal setting with proven frameworks used by top achievers.',
      isPremium: true, 
      priceInCents: 4900,
      currency: 'usd',
      category: 'success',
      level: 'All Levels',
      purchaseType: 'popup' as const,
      keyOutcomes: [
        'Create crystal-clear goals aligned with your values',
        'Build a proven action plan to achieve any goal',
        'Overcome procrastination and stay motivated',
        'Track progress and celebrate wins along the way',
      ],
      features: [
        { title: '8 Video Lessons', description: 'Step-by-step guidance through each phase', icon: 'video' },
        { title: 'Workbook Included', description: 'Downloadable exercises and templates', icon: 'book' },
        { title: 'Lifetime Access', description: 'Learn at your own pace, forever', icon: 'check-circle' },
        { title: 'Community Support', description: 'Connect with fellow goal-setters', icon: 'message-circle' },
      ],
      testimonials: [
        { name: 'Sarah M.', title: 'Entrepreneur', quote: 'This course completely changed how I approach my goals. I\'ve achieved more in 3 months than the entire past year!', rating: 5 },
        { name: 'James T.', title: 'Marketing Director', quote: 'The frameworks are practical and actionable. Highly recommend for anyone serious about growth.', rating: 5 },
      ],
      faqs: [
        { question: 'How long do I have access?', answer: 'You get lifetime access to all course materials, including any future updates.' },
        { question: 'Is there a guarantee?', answer: 'Yes! If you\'re not satisfied within 30 days, we\'ll give you a full refund.' },
      ],
    },
    { type: 'course' as const, title: 'Productivity Fundamentals', description: 'Learn to manage your time and energy effectively', category: 'productivity', level: 'Beginner' },
    { type: 'event' as const, title: 'Live Q&A: Ask Me Anything', description: 'Join us for a live coaching session' },
    { type: 'event' as const, title: 'Monthly Mastermind', description: 'Connect with fellow members and share wins' },
    { type: 'download' as const, title: 'Goal Planning Worksheet', description: 'A printable worksheet to plan your goals' },
    { type: 'download' as const, title: 'Weekly Review Template', description: 'Track your progress with this template' },
  ];
  
  contentTemplates.forEach((template, i) => {
    items.push({
      id: `demo-discover-${i + 1}`,
      type: template.type,
      title: template.title,
      description: template.description,
      shortDescription: (template as { shortDescription?: string }).shortDescription,
      imageUrl: template.type === 'course' && template.title === 'Goal Setting Masterclass'
        ? 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=400&fit=crop'
        : `https://picsum.photos/seed/${i + 100}/800/400`,
      author: 'Coach Adam',
      authorImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
      publishedAt: randomPastDate(60).toISOString(),
      readTime: (template as { readTime?: number }).readTime,
      isPublished: true,
      isPremium: (template as { isPremium?: boolean }).isPremium || false,
      priceInCents: (template as { priceInCents?: number }).priceInCents,
      currency: (template as { currency?: string }).currency,
      category: (template as { category?: string }).category,
      level: (template as { level?: string }).level,
      keyOutcomes: (template as { keyOutcomes?: string[] }).keyOutcomes,
      features: (template as { features?: { title: string; description?: string; icon?: string }[] }).features,
      testimonials: (template as { testimonials?: { name: string; title?: string; quote: string; rating?: number }[] }).testimonials,
      faqs: (template as { faqs?: { question: string; answer: string }[] }).faqs,
      purchaseType: (template as { purchaseType?: 'popup' | 'landing_page' }).purchaseType,
    });
  });
  
  return items;
}

// ============================================================================
// FEED POSTS (For demo user experience)
// ============================================================================

export interface DemoFeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorImageUrl: string;
  content: string;
  imageUrl?: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  isPinned: boolean;
}

export function generateDemoFeedPosts(): DemoFeedPost[] {
  const random = seededRandom(1800);
  const posts: DemoFeedPost[] = [];
  
  const postContents = [
    { content: '🎉 Just hit my 30-day streak! Consistency really is key. What\'s your current streak?', likes: 24, comments: 8 },
    { content: 'Morning reflection: Today I\'m grateful for this community. Your support means everything! 💪', likes: 45, comments: 12 },
    { content: 'Finished the Goal Setting Masterclass! Mind = blown 🤯 Highly recommend it to everyone here.', likes: 38, comments: 15 },
    { content: 'Quick tip: Start your day with your most important task. Don\'t check email first thing!', likes: 56, comments: 9 },
    { content: 'Week 2 of my transformation journey complete. The daily check-ins are keeping me accountable!', likes: 31, comments: 7 },
    { content: 'Anyone else doing the morning meditation habit? It\'s been a game changer for my focus.', likes: 29, comments: 18 },
  ];
  
  // Add coach announcement
  posts.push({
    id: 'demo-post-coach',
    authorId: 'demo-coach-user',
    authorName: 'Coach Adam',
    authorImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
    content: '📣 Exciting news! We\'re launching a new program next month - "Business Growth Intensive". Early bird registration opens next week. Stay tuned!',
    likeCount: 67,
    commentCount: 23,
    createdAt: randomPastDate(2).toISOString(),
    isPinned: true,
  });
  
  // Add member posts
  postContents.forEach((template, i) => {
    const firstName = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    const fullName = `${firstName} ${lastName}`;
    
    posts.push({
      id: `demo-post-${i + 1}`,
      authorId: `demo-user-${i + 1}`,
      authorName: fullName,
      authorImageUrl: generateAvatarUrl(fullName),
      content: template.content,
      imageUrl: random() < 0.2 ? `https://picsum.photos/seed/${i + 200}/600/400` : undefined,
      likeCount: template.likes + Math.floor(random() * 10),
      commentCount: template.comments + Math.floor(random() * 5),
      createdAt: randomPastDate(7 - i).toISOString(),
      isPinned: false,
    });
  });
  
  return posts;
}

// ============================================================================
// DEMO USER (For user-facing pages in demo mode)
// ============================================================================

export interface DemoUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  bio: string;
  location: string;
  joinedAt: string;
  streak: number;
  totalTasksCompleted: number;
  currentProgram?: {
    id: string;
    name: string;
    currentDay: number;
    totalDays: number;
    progress: number;
  };
  // Multiple program enrollments (group + 1:1)
  programs: {
    id: string;
    name: string;
    type: 'group' | 'individual';
    currentDay: number;
    totalDays: number;
    progress: number;
    coverImageUrl?: string;
  }[];
  squad?: {
    id: string;
    name: string;
    memberCount: number;
    avatarUrl?: string;
    chatChannelId?: string;
  };
  goals: {
    id: string;
    title: string;
    progress: number;
    deadline?: string;
  }[];
  habits: {
    id: string;
    title: string;
    streak: number;
    completedToday: boolean;
  }[];
  todaysTasks: {
    id: string;
    label: string;
    completed: boolean;
    isPrimary: boolean;
  }[];
}

export function generateDemoUserProfile(): DemoUserProfile {
  const random = seededRandom(1900);
  
  return {
    id: 'demo-user-viewer',
    email: 'alex.morgan@example.com',
    firstName: 'Alex',
    lastName: 'Morgan',
    name: 'Alex Morgan',
    imageUrl: generateAvatarUrl('Alex Morgan'),
    bio: 'Entrepreneur on a journey of personal growth. Building better habits one day at a time.',
    location: 'San Francisco, CA',
    joinedAt: randomPastDate(45).toISOString(),
    streak: 5,
    totalTasksCompleted: 87,
    currentProgram: {
      id: 'demo-prog-1',
      name: '30-Day Transformation',
      currentDay: 12,
      totalDays: 30,
      progress: 40,
    },
    // Multiple program enrollments (group + 1:1)
    programs: [
      {
        id: 'demo-prog-1',
        name: '30-Day Transformation',
        type: 'group',
        currentDay: 12,
        totalDays: 30,
        progress: 40,
        coverImageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop',
      },
      {
        id: 'demo-prog-3',
        name: 'Business Growth Intensive',
        type: 'individual',
        currentDay: 5,
        totalDays: 90,
        progress: 6,
        coverImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
      },
    ],
    // Use standalone squad (demo-squad-2 has no programId)
    squad: {
      id: 'demo-squad-2',
      name: 'Growth Warriors',
      memberCount: 18,
      avatarUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&h=200&fit=crop',
      chatChannelId: 'demo-channel-squad-2',
    },
    goals: [
      { id: 'goal-1', title: 'Build a morning routine', progress: 70, deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'goal-2', title: 'Read 12 books this year', progress: 42 },
      { id: 'goal-3', title: 'Launch my side project', progress: 25, deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    habits: [
      { id: 'habit-1', title: 'Morning Meditation', streak: 12, completedToday: true },
      { id: 'habit-2', title: 'Exercise', streak: 8, completedToday: false },
      { id: 'habit-3', title: 'Journaling', streak: 5, completedToday: true },
      { id: 'habit-4', title: 'Read 30 minutes', streak: 15, completedToday: false },
    ],
    todaysTasks: [
      { id: 'task-1', label: 'Complete Day 12 lesson', completed: true, isPrimary: true },
      { id: 'task-2', label: 'Post progress update in squad', completed: false, isPrimary: false },
      { id: 'task-3', label: 'Review weekly goals', completed: false, isPrimary: false },
      { id: 'task-4', label: 'Schedule 1:1 coaching call', completed: true, isPrimary: false },
    ],
  };
}

// ============================================================================
// FEATURE REQUESTS (for support tab)
// ============================================================================

export interface DemoFeatureRequest {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'declined';
  votes: number;
  createdAt: string;
}

export function generateDemoFeatureRequests(): DemoFeatureRequest[] {
  return [
    { id: 'fr-1', title: 'Mobile app', description: 'Native iOS and Android apps', status: 'in_progress', votes: 156, createdAt: randomPastDate(60).toISOString() },
    { id: 'fr-2', title: 'Calendar integration', description: 'Sync with Google Calendar and Outlook', status: 'completed', votes: 89, createdAt: randomPastDate(90).toISOString() },
    { id: 'fr-3', title: 'Custom email templates', description: 'Ability to customize automated emails', status: 'open', votes: 67, createdAt: randomPastDate(30).toISOString() },
    { id: 'fr-4', title: 'Advanced analytics', description: 'More detailed reporting and insights', status: 'open', votes: 45, createdAt: randomPastDate(14).toISOString() },
  ];
}

// ============================================================================
// DEMO EVENTS / CALENDAR
// ============================================================================

export interface DemoEvent {
  id: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime?: string;
  startTime?: string;
  endTime?: string;
  timezone: string;
  durationMinutes: number;
  locationType: 'online' | 'in_person' | 'chat';
  locationLabel: string;
  meetingLink?: string;
  coverImageUrl?: string;
  eventType: 'community_event' | 'squad_call' | 'coaching_1on1';
  scope: 'global' | 'organization' | 'program' | 'squad' | 'private';
  participantModel: 'open' | 'invite_only' | 'approval';
  approvalType: 'none' | 'host' | 'voting';
  status: 'confirmed' | 'live' | 'completed';
  organizationId: string;
  createdBy: string;
  hostName: string;
  hostImageUrl: string;
  rsvpCount: number;
  maxAttendees?: number;
  createdAt: string;
  updatedAt: string;
  programId?: string;
  squadId?: string;
}

export function generateDemoEvents(): DemoEvent[] {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Helper to create future date
  const futureDate = (daysFromNow: number, hours: number = 10, minutes: number = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  };
  
  return [
    {
      id: 'demo-event-1',
      title: 'Weekly Group Coaching Call',
      description: 'Join us for our weekly group coaching session. We\'ll discuss progress, share wins, and work through challenges together.',
      startDateTime: futureDate(2, 14, 0),
      endDateTime: futureDate(2, 15, 0),
      startTime: '14:00',
      endTime: '15:00',
      timezone,
      durationMinutes: 60,
      locationType: 'online',
      locationLabel: 'Zoom Meeting',
      meetingLink: 'https://zoom.us/j/demo123456',
      coverImageUrl: 'https://images.unsplash.com/photo-1531545514256-d18697064064?w=800&h=400&fit=crop',
      eventType: 'squad_call',
      scope: 'squad',
      participantModel: 'open',
      approvalType: 'none',
      status: 'confirmed',
      organizationId: 'demo-org',
      createdBy: 'demo-coach-user',
      hostName: 'Coach Adam',
      hostImageUrl: generateAvatarUrl('Coach Adam'),
      rsvpCount: 8,
      maxAttendees: 20,
      createdAt: randomPastDate(30).toISOString(),
      updatedAt: randomPastDate(5).toISOString(),
      squadId: 'demo-squad-1',
    },
    {
      id: 'demo-event-2',
      title: 'Mindset Workshop: Overcoming Limiting Beliefs',
      description: 'A deep-dive workshop on identifying and overcoming the beliefs that hold you back from success.',
      startDateTime: futureDate(5, 11, 0),
      endDateTime: futureDate(5, 13, 0),
      startTime: '11:00',
      endTime: '13:00',
      timezone,
      durationMinutes: 120,
      locationType: 'online',
      locationLabel: 'Live Webinar',
      meetingLink: 'https://zoom.us/j/demo789012',
      coverImageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop',
      eventType: 'community_event',
      scope: 'organization',
      participantModel: 'open',
      approvalType: 'none',
      status: 'confirmed',
      organizationId: 'demo-org',
      createdBy: 'demo-coach-user',
      hostName: 'Coach Adam',
      hostImageUrl: generateAvatarUrl('Coach Adam'),
      rsvpCount: 24,
      maxAttendees: 50,
      createdAt: randomPastDate(14).toISOString(),
      updatedAt: randomPastDate(2).toISOString(),
      programId: 'demo-prog-2',
    },
    {
      id: 'demo-event-3',
      title: '1:1 Coaching Session',
      description: 'Personal coaching session to discuss your goals and progress.',
      startDateTime: futureDate(1, 16, 30),
      endDateTime: futureDate(1, 17, 30),
      startTime: '16:30',
      endTime: '17:30',
      timezone,
      durationMinutes: 60,
      locationType: 'online',
      locationLabel: 'Video Call',
      meetingLink: 'https://meet.google.com/demo-abc-xyz',
      coverImageUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&h=400&fit=crop',
      eventType: 'coaching_1on1',
      scope: 'private',
      participantModel: 'invite_only',
      approvalType: 'none',
      status: 'confirmed',
      organizationId: 'demo-org',
      createdBy: 'demo-coach-user',
      hostName: 'Coach Adam',
      hostImageUrl: generateAvatarUrl('Coach Adam'),
      rsvpCount: 1,
      createdAt: randomPastDate(7).toISOString(),
      updatedAt: randomPastDate(1).toISOString(),
    },
    {
      id: 'demo-event-4',
      title: 'Community Mastermind Session',
      description: 'Connect with fellow community members, share insights, and get feedback on your projects.',
      startDateTime: futureDate(7, 10, 0),
      endDateTime: futureDate(7, 11, 30),
      startTime: '10:00',
      endTime: '11:30',
      timezone,
      durationMinutes: 90,
      locationType: 'online',
      locationLabel: 'Zoom Meeting',
      meetingLink: 'https://zoom.us/j/demo456789',
      coverImageUrl: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&h=400&fit=crop',
      eventType: 'community_event',
      scope: 'organization',
      participantModel: 'open',
      approvalType: 'none',
      status: 'confirmed',
      organizationId: 'demo-org',
      createdBy: 'demo-coach-user',
      hostName: 'Coach Adam',
      hostImageUrl: generateAvatarUrl('Coach Adam'),
      rsvpCount: 15,
      maxAttendees: 30,
      createdAt: randomPastDate(21).toISOString(),
      updatedAt: randomPastDate(3).toISOString(),
    },
    {
      id: 'demo-event-5',
      title: 'Goal Setting & Planning Workshop',
      description: 'Set powerful goals for the month ahead and create actionable plans to achieve them.',
      startDateTime: futureDate(10, 15, 0),
      endDateTime: futureDate(10, 16, 30),
      startTime: '15:00',
      endTime: '16:30',
      timezone,
      durationMinutes: 90,
      locationType: 'online',
      locationLabel: 'Live Workshop',
      meetingLink: 'https://zoom.us/j/demo111222',
      coverImageUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=400&fit=crop',
      eventType: 'community_event',
      scope: 'organization',
      participantModel: 'open',
      approvalType: 'none',
      status: 'confirmed',
      organizationId: 'demo-org',
      createdBy: 'demo-coach-user',
      hostName: 'Coach Adam',
      hostImageUrl: generateAvatarUrl('Coach Adam'),
      rsvpCount: 18,
      maxAttendees: 40,
      createdAt: randomPastDate(10).toISOString(),
      updatedAt: randomPastDate(1).toISOString(),
    },
  ];
}

// ============================================================================
// CALENDAR EVENTS (For scheduling/calendar view)
// ============================================================================

export interface DemoCalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timezone: string;
  eventType: string;
  locationType: 'online' | 'in_person' | 'chat';
  locationLabel?: string;
  meetingLink?: string;
  status: 'confirmed' | 'proposed' | 'cancelled';
  hostId: string;
  hostName: string;
  hostImageUrl: string;
  attendees?: { id: string; name: string; imageUrl: string; status: string }[];
  organizationId: string;
}

/**
 * Generate demo calendar events for the calendar view
 * Events are spread across the given date range
 */
export function generateDemoCalendarEvents(startDateStr?: string | null, endDateStr?: string | null): DemoCalendarEvent[] {
  const now = new Date();
  const startDate = startDateStr ? new Date(startDateStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = endDateStr ? new Date(endDateStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const events: DemoCalendarEvent[] = [];
  
  // Generate events for the date range
  const eventTemplates = [
    { title: 'Weekly Group Coaching', type: 'squad_call', duration: 60, time: '14:00' },
    { title: '1:1 Coaching Session', type: 'coaching_1on1', duration: 45, time: '10:00' },
    { title: 'Mindset Workshop', type: 'community_event', duration: 90, time: '11:00' },
    { title: 'Community Q&A', type: 'community_event', duration: 60, time: '16:00' },
    { title: 'Morning Accountability Call', type: 'squad_call', duration: 30, time: '08:00' },
  ];
  
  const attendeeNames = ['Sarah Miller', 'Michael Chen', 'Emma Thompson', 'James Wilson', 'Lisa Park'];
  
  // Add events throughout the date range
  let eventId = 1;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // Add 1-2 events per weekday
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
      const numEvents = 1 + Math.floor(Math.random() * 2);
      const usedTimes = new Set<string>();
      
      for (let i = 0; i < numEvents; i++) {
        const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
        
        // Avoid same time on same day
        if (usedTimes.has(template.time)) continue;
        usedTimes.add(template.time);
        
        const [hours, minutes] = template.time.split(':').map(Number);
        const eventStart = new Date(currentDate);
        eventStart.setHours(hours, minutes, 0, 0);
        
        const eventEnd = new Date(eventStart);
        eventEnd.setMinutes(eventEnd.getMinutes() + template.duration);
        
        // Generate attendees for the event
        const numAttendees = Math.floor(Math.random() * 4) + 1;
        const attendees = attendeeNames.slice(0, numAttendees).map((name, idx) => ({
          id: `demo-attendee-${idx + 1}`,
          name,
          imageUrl: generateAvatarUrl(name),
          status: 'confirmed',
        }));
        
        events.push({
          id: `demo-cal-event-${eventId++}`,
          title: template.title,
          description: `Demo ${template.title.toLowerCase()} event`,
          startDateTime: eventStart.toISOString(),
          endDateTime: eventEnd.toISOString(),
          timezone,
          eventType: template.type,
          locationType: 'online',
          locationLabel: 'Zoom',
          meetingLink: 'https://zoom.us/j/demo123',
          status: 'confirmed',
          hostId: 'demo-coach-user',
          hostName: 'Coach Adam',
          hostImageUrl: generateAvatarUrl('Coach Adam'),
          attendees,
          organizationId: 'demo-org',
        });
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return events;
}

// ============================================================================
// NOTIFICATIONS (For notification bell)
// ============================================================================

export interface DemoNotification {
  id: string;
  type: 'message' | 'task_reminder' | 'event_reminder' | 'achievement' | 'squad_activity' | 'comment' | 'like';
  title: string;
  body: string;
  imageUrl?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

/**
 * Generate demo notifications for the notification bell
 */
export function generateDemoNotifications(): DemoNotification[] {
  const now = new Date();
  
  return [
    {
      id: 'demo-notif-1',
      type: 'event_reminder',
      title: 'Upcoming: Weekly Group Coaching',
      body: 'Your coaching session starts in 30 minutes',
      imageUrl: generateAvatarUrl('Coach Adam'),
      link: '/calendar',
      read: false,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-notif-2',
      type: 'achievement',
      title: '🎉 7-Day Streak!',
      body: "Congratulations! You've completed tasks for 7 days in a row",
      read: false,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-notif-3',
      type: 'message',
      title: 'New message from Sarah Miller',
      body: 'Thank you so much for the session today!',
      imageUrl: generateAvatarUrl('Sarah Miller'),
      link: '/chat',
      read: false,
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-notif-4',
      type: 'squad_activity',
      title: 'Michael Chen completed a task',
      body: 'In Momentum Masters squad',
      imageUrl: generateAvatarUrl('Michael Chen'),
      link: '/squad',
      read: true,
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-notif-5',
      type: 'like',
      title: 'Emma Thompson liked your post',
      body: 'In the community feed',
      imageUrl: generateAvatarUrl('Emma Thompson'),
      link: '/feed',
      read: true,
      createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-notif-6',
      type: 'comment',
      title: 'James Wilson commented on your post',
      body: '"Great progress! Keep it up!"',
      imageUrl: generateAvatarUrl('James Wilson'),
      link: '/feed',
      read: true,
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-notif-7',
      type: 'task_reminder',
      title: 'Daily Focus Reminder',
      body: "Don't forget to complete your morning meditation",
      read: true,
      createdAt: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

// ============================================================================
// MY CONTENT (User's Purchased/Enrolled Content)
// ============================================================================

export interface DemoMyContentItem {
  id: string;
  contentType: 'event' | 'article' | 'course' | 'download' | 'link' | 'program' | 'squad';
  contentId: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  thumbnailUrl?: string;
  organizationId?: string;
  coachName?: string;
  coachImageUrl?: string;
  purchasedAt: string;
  includedInProgramId?: string;
  includedInProgramName?: string;
}

/**
 * Generate demo "My Content" items for the user
 * Includes a mix of programs, squads, courses, articles, and downloads
 */
export function generateDemoMyContent(): {
  items: DemoMyContentItem[];
  totalCount: number;
  counts: {
    programs: number;
    squads: number;
    courses: number;
    articles: number;
    events: number;
    downloads: number;
    links: number;
  };
} {
  const items: DemoMyContentItem[] = [];
  const coachName = 'Coach Adam';
  const coachImageUrl = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face';
  
  // Programs (2) - enrolled programs
  items.push({
    id: 'my-prog-1',
    contentType: 'program',
    contentId: 'demo-prog-1',
    title: '30-Day Transformation',
    description: 'Transform your life in 30 days with daily guided actions.',
    coverImageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop',
    organizationId: 'demo-org',
    coachName,
    coachImageUrl,
    purchasedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
  
  items.push({
    id: 'my-prog-2',
    contentType: 'program',
    contentId: 'demo-prog-3',
    title: 'Business Growth Intensive',
    description: 'Scale your business with proven strategies.',
    coverImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
    organizationId: 'demo-org',
    coachName,
    coachImageUrl,
    purchasedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  });
  
  // Squad (1) - standalone squad membership
  items.push({
    id: 'my-squad-1',
    contentType: 'squad',
    contentId: 'demo-squad-2',
    title: 'Growth Warriors',
    description: 'High-achievers pushing boundaries and supporting each other.',
    coverImageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=450&fit=crop',
    organizationId: 'demo-org',
    purchasedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  
  // Courses (2) - purchased courses
  items.push({
    id: 'my-course-1',
    contentType: 'course',
    contentId: 'demo-discover-3',
    title: 'Goal Setting Masterclass',
    description: 'A comprehensive guide to setting and achieving your goals. Transform your dreams into actionable plans with proven frameworks.',
    coverImageUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=400&fit=crop',
    organizationId: 'demo-org',
    coachName,
    coachImageUrl,
    purchasedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  
  items.push({
    id: 'my-course-2',
    contentType: 'course',
    contentId: 'demo-discover-4',
    title: 'Productivity Fundamentals',
    description: 'Learn to manage your time and energy effectively',
    coverImageUrl: 'https://images.unsplash.com/photo-1483058712412-4245e9b90334?w=800&h=400&fit=crop',
    organizationId: 'demo-org',
    coachName,
    coachImageUrl,
    purchasedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    includedInProgramId: 'demo-prog-1',
    includedInProgramName: '30-Day Transformation',
  });
  
  // Articles (2) - purchased/accessed articles
  items.push({
    id: 'my-article-1',
    contentType: 'article',
    contentId: 'demo-discover-1',
    title: '10 Habits of Highly Successful People',
    description: 'Discover the daily habits that drive success',
    coverImageUrl: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&h=400&fit=crop',
    organizationId: 'demo-org',
    coachName,
    coachImageUrl,
    purchasedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  });
  
  items.push({
    id: 'my-article-2',
    contentType: 'article',
    contentId: 'demo-discover-2',
    title: 'The Power of Morning Routines',
    description: 'How to start your day with intention',
    coverImageUrl: 'https://images.unsplash.com/photo-1484627147104-f5197bcd6651?w=800&h=400&fit=crop',
    organizationId: 'demo-org',
    coachName,
    coachImageUrl,
    purchasedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    includedInProgramId: 'demo-prog-1',
    includedInProgramName: '30-Day Transformation',
  });
  
  // Downloads (2) - purchased downloads
  items.push({
    id: 'my-download-1',
    contentType: 'download',
    contentId: 'demo-discover-7',
    title: 'Goal Planning Worksheet',
    description: 'A printable worksheet to plan your goals',
    thumbnailUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=300&fit=crop',
    organizationId: 'demo-org',
    coachName,
    coachImageUrl,
    purchasedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  });
  
  items.push({
    id: 'my-download-2',
    contentType: 'download',
    contentId: 'demo-discover-8',
    title: 'Weekly Review Template',
    description: 'Track your progress with this template',
    thumbnailUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=300&fit=crop',
    organizationId: 'demo-org',
    coachName,
    coachImageUrl,
    purchasedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    includedInProgramId: 'demo-prog-1',
    includedInProgramName: '30-Day Transformation',
  });
  
  // Sort by purchasedAt (most recent first)
  items.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
  
  // Calculate counts by type
  const counts = {
    programs: items.filter(i => i.contentType === 'program').length,
    squads: items.filter(i => i.contentType === 'squad').length,
    courses: items.filter(i => i.contentType === 'course').length,
    articles: items.filter(i => i.contentType === 'article').length,
    events: items.filter(i => i.contentType === 'event').length,
    downloads: items.filter(i => i.contentType === 'download').length,
    links: items.filter(i => i.contentType === 'link').length,
  };
  
  return {
    items,
    totalCount: items.length,
    counts,
  };
}

