import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { isDemoRequest } from '@/lib/demo-api';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface Suggestion {
  id: string;
  title: string;
  description: string;
  action: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
}

interface CoachContext {
  hasStripe: boolean;
  hasPrograms: boolean;
  hasFunnel: boolean;
  hasClients: boolean;
  hasSquads: boolean;
  totalRevenue: number;
  activeClients: number;
  totalPrograms: number;
  atRiskClients: number;
  recentActivity: {
    lastProgramCreated?: string;
    lastClientInvited?: string;
    lastPostCreated?: string;
  };
}

const SUGGESTIONS_SYSTEM_PROMPT = `You are a business coach AI assistant helping online coaches grow their coaching business.

Your job is to analyze a coach's current business state and suggest the SINGLE most impactful action they should take next.

You ALWAYS output valid JSON only.

OUTPUT FORMAT:
{
  "suggestions": [
    {
      "id": "unique-id",
      "title": "Short actionable title (max 8 words)",
      "description": "Brief explanation of why this matters (max 15 words)",
      "action": "Button label (2-3 words)",
      "href": "/coach?tab=...",
      "priority": "high|medium|low"
    }
  ]
}

PRIORITY RULES:
- high: Blocking revenue (no Stripe, no offers, no clients)
- medium: Growth opportunity (upsells, engagement, optimization)
- low: Nice to have (community, content)

AVAILABLE ACTIONS AND HREFS:
- Create program: /coach?tab=programs
- Connect Stripe: /coach?tab=settings&section=billing
- Create funnel: /coach?tab=funnels
- Invite client: /coach?tab=clients
- Create squad: /coach?tab=squads
- View analytics: /coach?tab=analytics
- Create content: /coach?tab=resources

RULES:
- Return 1-3 suggestions maximum
- Most important action first
- Be specific and actionable
- Focus on revenue-generating actions first
- Consider their current state`;

async function getCoachContext(organizationId: string): Promise<CoachContext> {
  const [
    orgSettingsDoc,
    programsSnap,
    squadsSnap,
    membersSnap,
    funnelsSnap,
  ] = await Promise.all([
    adminDb.collection('org_settings').doc(organizationId).get(),
    adminDb.collection('programs').where('organizationId', '==', organizationId).limit(10).get(),
    adminDb.collection('squads').where('organizationId', '==', organizationId).limit(10).get(),
    adminDb.collection('org_memberships').where('organizationId', '==', organizationId).where('status', '==', 'active').limit(100).get(),
    adminDb.collection('funnels').where('organizationId', '==', organizationId).limit(1).get(),
  ]);

  const orgSettings = orgSettingsDoc.data();
  const hasStripe = orgSettings?.stripeConnectStatus === 'connected';
  const hasPrograms = !programsSnap.empty;
  const hasFunnel = !funnelsSnap.empty;
  const hasClients = !membersSnap.empty;
  const hasSquads = !squadsSnap.empty;

  // Calculate revenue and active clients
  let totalRevenue = 0;
  const enrollmentsSnap = await adminDb
    .collection('enrollments')
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'active')
    .limit(100)
    .get();

  enrollmentsSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.paidAmount) {
      totalRevenue += data.paidAmount;
    }
  });

  // Count at-risk clients (inactive for 7+ days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let atRiskClients = 0;
  membersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const lastActive = data.lastActiveAt ? new Date(data.lastActiveAt) : null;
    if (!lastActive || lastActive < sevenDaysAgo) {
      atRiskClients++;
    }
  });

  return {
    hasStripe,
    hasPrograms,
    hasFunnel,
    hasClients,
    hasSquads,
    totalRevenue,
    activeClients: membersSnap.size,
    totalPrograms: programsSnap.size,
    atRiskClients,
    recentActivity: {},
  };
}

function generateRuleBasedSuggestions(context: CoachContext): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Priority 1: No Stripe = blocking revenue
  if (!context.hasStripe) {
    suggestions.push({
      id: 'connect-stripe',
      title: 'Connect Stripe to accept payments',
      description: "You can't receive payments without Stripe connected",
      action: 'Connect',
      href: '/coach?tab=settings&section=billing',
      priority: 'high',
    });
  }

  // Priority 2: No programs = nothing to sell
  if (!context.hasPrograms) {
    suggestions.push({
      id: 'create-program',
      title: 'Create your first offer',
      description: 'You need a program before clients can enroll',
      action: 'Create',
      href: '/coach?tab=programs',
      priority: 'high',
    });
  }

  // Priority 3: No funnel = no way to capture leads
  if (!context.hasFunnel && context.hasPrograms) {
    suggestions.push({
      id: 'create-funnel',
      title: 'Create a sales funnel',
      description: 'Capture leads and convert them to paying clients',
      action: 'Create',
      href: '/coach?tab=funnels',
      priority: 'high',
    });
  }

  // Priority 4: No clients = need to invite
  if (!context.hasClients && context.hasPrograms) {
    suggestions.push({
      id: 'invite-client',
      title: 'Invite your first client',
      description: 'Your program is ready, now get your first client',
      action: 'Invite',
      href: '/coach?tab=clients',
      priority: 'high',
    });
  }

  // Priority 5: At-risk clients
  if (context.atRiskClients > 0) {
    suggestions.push({
      id: 'engage-clients',
      title: `${context.atRiskClients} clients need attention`,
      description: "They haven't been active in 7+ days",
      action: 'View',
      href: '/coach?tab=clients',
      priority: 'medium',
    });
  }

  // Priority 6: Build community
  if (!context.hasSquads && context.activeClients >= 3) {
    suggestions.push({
      id: 'create-squad',
      title: 'Start a community for your clients',
      description: 'Squads increase retention and engagement',
      action: 'Create',
      href: '/coach?tab=squads',
      priority: 'medium',
    });
  }

  // Priority 7: Create more programs if doing well
  if (context.totalPrograms === 1 && context.activeClients >= 5) {
    suggestions.push({
      id: 'create-second-program',
      title: 'Create a second offer',
      description: 'Diversify your revenue with another program',
      action: 'Create',
      href: '/coach?tab=programs',
      priority: 'low',
    });
  }

  return suggestions.slice(0, 3);
}

async function generateAISuggestions(context: CoachContext): Promise<Suggestion[]> {
  try {
    const contextSummary = `
Coach Business State:
- Stripe Connected: ${context.hasStripe}
- Programs Created: ${context.totalPrograms}
- Has Funnel: ${context.hasFunnel}
- Active Clients: ${context.activeClients}
- Has Squads: ${context.hasSquads}
- Total Revenue: $${context.totalRevenue}
- At-Risk Clients (7+ days inactive): ${context.atRiskClients}
`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `${SUGGESTIONS_SYSTEM_PROMPT}

${contextSummary}

Generate 1-3 suggestions for this coach. Return ONLY valid JSON.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.suggestions && Array.isArray(result.suggestions)) {
          return result.suggestions.slice(0, 3);
        }
      }
    }
  } catch (error) {
    console.error('[SUGGESTIONS] AI generation failed:', error);
  }

  // Fallback to rule-based suggestions
  return generateRuleBasedSuggestions(context);
}

/**
 * GET /api/coach/suggestions
 * Get AI-powered suggestions for the coach dashboard
 */
export async function GET() {
  try {
    // Demo mode: return demo suggestions
    if (await isDemoRequest()) {
      return NextResponse.json({
        suggestions: [
          {
            id: 'demo-1',
            title: 'Connect Stripe to accept payments',
            description: "You can't receive payments without Stripe connected",
            action: 'Connect',
            href: '/coach?tab=settings&section=billing',
            priority: 'high' as const,
          },
          {
            id: 'demo-2',
            title: 'Create a sales funnel',
            description: 'Capture leads and convert them to paying clients',
            action: 'Create',
            href: '/coach?tab=funnels',
            priority: 'medium' as const,
          },
        ],
      });
    }

    const { organizationId } = await requireCoachWithOrg();

    // Get coach context
    const context = await getCoachContext(organizationId);

    // Try AI suggestions first, fall back to rule-based
    let suggestions: Suggestion[];

    // For simplicity and speed, use rule-based suggestions
    // AI can be enabled for more personalized suggestions later
    if (process.env.ANTHROPIC_API_KEY && context.hasStripe && context.hasPrograms && context.hasClients) {
      // Only use AI for coaches with established businesses
      suggestions = await generateAISuggestions(context);
    } else {
      // Use rule-based for new coaches (faster, more predictable)
      suggestions = generateRuleBasedSuggestions(context);
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('[SUGGESTIONS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch suggestions';

    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    // Return empty suggestions on error rather than failing
    return NextResponse.json({ suggestions: [] });
  }
}
