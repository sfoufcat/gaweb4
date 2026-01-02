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

// Demo programs
const DEMO_PROGRAMS = [
  { id: 'demo-prog-1', name: '30-Day Transformation' },
  { id: 'demo-prog-2', name: 'Content Creator Accelerator' },
  { id: 'demo-prog-3', name: 'Business Growth Intensive' },
  { id: 'demo-prog-4', name: 'Mindset Mastery' },
];

// Demo squads
const DEMO_SQUADS = [
  { id: 'demo-squad-1', name: 'Alpha Achievers' },
  { id: 'demo-squad-2', name: 'Growth Warriors' },
  { id: 'demo-squad-3', name: 'Peak Performers' },
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

/**
 * Generate avatar URL using ui-avatars.com
 */
function generateAvatarUrl(name: string): string {
  const colors = ['a07855', '7c9885', '6b7db3', 'b36b6b', '9b6bb3', '6bb3a0'];
  const color = colors[Math.floor(Math.random() * colors.length)];
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
}

const SQUAD_NAMES = [
  { name: 'Alpha Achievers', slug: 'alpha-achievers' },
  { name: 'Growth Warriors', slug: 'growth-warriors' },
  { name: 'Peak Performers', slug: 'peak-performers' },
  { name: 'Momentum Masters', slug: 'momentum-masters' },
  { name: 'Vision Builders', slug: 'vision-builders' },
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
  
  for (let i = 0; i < count; i++) {
    const firstNameIndex = Math.floor(random() * FIRST_NAMES.length);
    const lastNameIndex = Math.floor(random() * LAST_NAMES.length);
    const firstName = FIRST_NAMES[firstNameIndex];
    const lastName = LAST_NAMES[lastNameIndex];
    const fullName = `${firstName} ${lastName}`;
    
    members.push({
      odataId: `demo-member-${squadId}-${i + 1}`,
      odataUserId: `demo-user-${i + 1}`,
      odataSquadId: squadId,
      email: generateEmail(firstName, lastName, i),
      name: fullName,
      firstName,
      lastName,
      imageUrl: generateAvatarUrl(fullName),
      joinedAt: randomPastDate(90).toISOString(),
      role: i === 0 ? 'admin' : 'member',
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
  type: 'group' | 'individual';
  durationDays: number;
  priceInCents: number;
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
    durationDays: 30,
    priceInCents: 29700,
  },
  {
    name: 'Content Creator Accelerator',
    slug: 'content-creator-accelerator',
    description: 'Build your personal brand and grow your audience.',
    durationDays: 60,
    priceInCents: 49700,
  },
  {
    name: 'Business Growth Intensive',
    slug: 'business-growth-intensive',
    description: 'Scale your business with proven strategies.',
    durationDays: 90,
    priceInCents: 99700,
  },
  {
    name: 'Mindset Mastery',
    slug: 'mindset-mastery',
    description: 'Develop an unstoppable mindset for success.',
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
    
    return {
      id: `demo-prog-${i + 1}`,
      name: prog.name,
      slug: prog.slug,
      description: prog.description,
      type: random() < 0.7 ? 'group' : 'individual',
      durationDays: prog.durationDays,
      priceInCents: prog.priceInCents,
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
  targetType: 'program' | 'squad' | 'content';
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
  { name: 'Community Entry Funnel', targetType: 'squad' as const },
  { name: 'Lead Magnet Funnel', targetType: 'content' as const },
];

const STEP_TYPES: DemoFunnelStep['type'][] = ['landing', 'form', 'video', 'checkout', 'thank_you'];

export function generateDemoFunnels(): DemoFunnel[] {
  const random = seededRandom(600);
  const funnels: DemoFunnel[] = [];
  
  for (let i = 0; i < 4; i++) {
    const template = FUNNEL_TEMPLATES[i];
    const numSteps = 3 + Math.floor(random() * 3); // 3-5 steps
    
    let targetId: string | undefined;
    let targetName: string | undefined;
    
    if (template.targetType === 'program') {
      const program = DEMO_PROGRAMS[Math.floor(random() * DEMO_PROGRAMS.length)];
      targetId = program.id;
      targetName = program.name;
    } else if (template.targetType === 'squad') {
      const squad = DEMO_SQUADS[Math.floor(random() * DEMO_SQUADS.length)];
      targetId = squad.id;
      targetName = squad.name;
    }
    
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
  lastMessageAt: string | null;
  createdAt: string;
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
  
  // Generate squad channels
  for (let i = 0; i < 5; i++) {
    const squadInfo = SQUAD_NAMES[i];
    const messageCount = 50 + Math.floor(random() * 200);
    
    channels.push({
      channelId: `demo-channel-squad-${i + 1}`,
      channelType: 'messaging',
      name: squadInfo.name,
      squadId: `demo-squad-${i + 1}`,
      squadName: squadInfo.name,
      memberCount: 8 + Math.floor(random() * 20),
      messageCount,
      lastMessageAt: randomPastDate(3).toISOString(),
      createdAt: randomPastDate(90).toISOString(),
    });
  }
  
  // Generate some DM channels
  for (let i = 0; i < 8; i++) {
    const firstName = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    
    channels.push({
      channelId: `demo-channel-dm-${i + 1}`,
      channelType: 'messaging',
      name: `${firstName} ${lastName}`,
      memberCount: 2,
      messageCount: 10 + Math.floor(random() * 50),
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
  
  for (let i = 0; i < 4; i++) {
    const template = FUNNEL_TEMPLATES[i];
    const numSteps = 3 + Math.floor(random() * 3);
    
    let targetProgramId: string | undefined;
    let targetProgramName: string | undefined;
    let targetSquadId: string | undefined;
    let targetSquadName: string | undefined;
    
    if (template.targetType === 'program') {
      const program = DEMO_PROGRAMS[i % DEMO_PROGRAMS.length];
      targetProgramId = program.id;
      targetProgramName = program.name;
    } else if (template.targetType === 'squad') {
      const squad = DEMO_SQUADS[i % DEMO_SQUADS.length];
      targetSquadId = squad.id;
      targetSquadName = squad.name;
    }
    
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
      squadId: targetSquadId,
      squadName: targetSquadName,
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
      options: step.options,
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
    logoUrl: 'https://ui-avatars.com/api/?name=Demo+Coach&background=a07855&color=fff&size=128&bold=true',
    appTitle: 'Demo Coaching',
    colors: {
      accentLight: '#a07855',
      accentDark: '#b8896a',
    },
    socialLinks: {
      website: 'https://example.com',
      instagram: 'https://instagram.com/democoach',
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
    timezone: 'America/New_York',
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
  imageUrl: string;
  author: string;
  publishedAt: string;
  readTime?: number; // minutes
  isPublished: boolean;
  isPremium: boolean;
}

export function generateDemoDiscoverContent(): DemoDiscoverItem[] {
  const random = seededRandom(1700);
  const items: DemoDiscoverItem[] = [];
  
  const contentTemplates = [
    { type: 'article' as const, title: '10 Habits of Highly Successful People', description: 'Discover the daily habits that drive success', readTime: 8 },
    { type: 'article' as const, title: 'The Power of Morning Routines', description: 'How to start your day with intention', readTime: 5 },
    { type: 'course' as const, title: 'Goal Setting Masterclass', description: 'A comprehensive guide to setting and achieving your goals', isPremium: true },
    { type: 'course' as const, title: 'Productivity Fundamentals', description: 'Learn to manage your time and energy effectively' },
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
      imageUrl: `https://picsum.photos/seed/${i + 100}/800/400`,
      author: 'Demo Coach',
      publishedAt: randomPastDate(60).toISOString(),
      readTime: template.readTime,
      isPublished: true,
      isPremium: template.isPremium || false,
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
    authorName: 'Demo Coach',
    authorImageUrl: 'https://ui-avatars.com/api/?name=Demo+Coach&background=a07855&color=fff&size=128&bold=true',
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
  squad?: {
    id: string;
    name: string;
    memberCount: number;
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
    streak: 12,
    totalTasksCompleted: 87,
    currentProgram: {
      id: 'demo-prog-1',
      name: '30-Day Transformation',
      currentDay: 12,
      totalDays: 30,
      progress: 40,
    },
    squad: {
      id: 'demo-squad-1',
      name: 'Alpha Achievers',
      memberCount: 18,
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

