/**
 * Coach API: AI Context Fetcher
 *
 * GET /api/coach/ai-context
 * Fetches organization content to use as context for AI generation.
 *
 * Query params:
 * - useCase: 'LANDING_PAGE_WEBSITE' | 'LANDING_PAGE_PROGRAM' | 'LANDING_PAGE_SQUAD' | 'PROGRAM_CONTENT'
 * - programId: (optional) For program-specific contexts
 * - squadId: (optional) For squad-specific contexts
 *
 * Returns structured context appropriate for the use case.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import type {
  Program,
  Squad,
  ProgramFeature,
  SquadFeature,
} from '@/types';
import type { AIUseCase } from '@/lib/ai/types';

// Simplified types for AI context (don't send full objects)
interface ProgramSummary {
  name: string;
  description: string;
  keyOutcomes: string[];
  features: ProgramFeature[];
  lengthDays: number;
  lengthWeeks?: number;
  type: 'group' | 'individual';
  weekTitles?: string[];
  testimonials?: Array<{ text: string; author: string; role?: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}

interface SquadSummary {
  name: string;
  description: string;
  keyOutcomes: string[];
  features: SquadFeature[];
  testimonials?: Array<{ text: string; author: string; role?: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}

// Helper type for testimonials/FAQs
interface SimplifiedTestimonial {
  text: string;
  author: string;
  role?: string;
}

interface SimplifiedFAQ {
  question: string;
  answer: string;
}

export interface AIContextResponse {
  programs?: ProgramSummary[];
  squads?: SquadSummary[];
  program?: ProgramSummary; // Single program for program-specific contexts
  squad?: SquadSummary; // Single squad for squad LP
  coachName?: string;
  coachBio?: string;
  existingTestimonials?: SimplifiedTestimonial[];
  existingFaqs?: SimplifiedFAQ[];
  summary: string; // Human-readable summary
}

const VALID_USE_CASES: AIUseCase[] = [
  'PROGRAM_CONTENT',
  'LANDING_PAGE_PROGRAM',
  'LANDING_PAGE_SQUAD',
  'LANDING_PAGE_WEBSITE',
];

// Helper to convert testimonials to simplified format
function mapTestimonials(
  testimonials?: Array<{ text?: string; author?: string; role?: string; quote?: string; name?: string }>
): SimplifiedTestimonial[] {
  if (!testimonials) return [];
  return testimonials
    .filter((t) => (t.text || t.quote) && (t.author || t.name))
    .map((t) => ({
      text: t.text || t.quote || '',
      author: t.author || t.name || '',
      role: t.role,
    }));
}

// Helper to convert FAQs to simplified format
function mapFaqs(faqs?: Array<{ question?: string; answer?: string }>): SimplifiedFAQ[] {
  if (!faqs) return [];
  return faqs
    .filter((f) => f.question && f.answer)
    .map((f) => ({
      question: f.question || '',
      answer: f.answer || '',
    }));
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();

    const { searchParams } = new URL(request.url);
    const useCase = searchParams.get('useCase') as AIUseCase | null;
    const programId = searchParams.get('programId');
    const squadId = searchParams.get('squadId');

    if (!useCase || !VALID_USE_CASES.includes(useCase)) {
      return NextResponse.json(
        { error: 'Invalid or missing useCase parameter' },
        { status: 400 }
      );
    }

    console.log(`[AI_CONTEXT] Fetching context for ${useCase}, org=${organizationId}`);

    const response: AIContextResponse = {
      summary: '',
    };

    // Fetch based on use case
    switch (useCase) {
      case 'LANDING_PAGE_WEBSITE': {
        // Fetch all programs and squads for website generation
        const [programsSnap, squadsSnap] = await Promise.all([
          adminDb
            .collection('programs')
            .where('organizationId', '==', organizationId)
            .limit(20)
            .get(),
          adminDb
            .collection('squads')
            .where('organizationId', '==', organizationId)
            .limit(10)
            .get(),
        ]);

        const programs: ProgramSummary[] = programsSnap.docs.map((doc) => {
          const data = doc.data() as Program;
          return {
            name: data.name || '',
            description: data.description || '',
            keyOutcomes: data.keyOutcomes || [],
            features: data.features || [],
            lengthDays: data.lengthDays || 0,
            lengthWeeks: data.lengthWeeks,
            type: data.type || 'individual',
            weekTitles: (data.weeks?.map((w) => w.name).filter((n): n is string => !!n)) || [],
            testimonials: mapTestimonials(data.testimonials as any),
            faqs: mapFaqs(data.faqs as any),
          };
        });

        const squads: SquadSummary[] = squadsSnap.docs.map((doc) => {
          const data = doc.data() as Squad;
          return {
            name: data.name || '',
            description: data.description || '',
            keyOutcomes: data.keyOutcomes || [],
            features: data.features || [],
            testimonials: mapTestimonials(data.testimonials as any),
            faqs: mapFaqs(data.faqs as any),
          };
        });

        // Collect existing testimonials and FAQs from all sources
        const allTestimonials: SimplifiedTestimonial[] = [];
        const allFaqs: SimplifiedFAQ[] = [];

        programs.forEach((p) => {
          if (p.testimonials) allTestimonials.push(...p.testimonials);
          if (p.faqs) allFaqs.push(...p.faqs);
        });
        squads.forEach((s) => {
          if (s.testimonials) allTestimonials.push(...s.testimonials);
          if (s.faqs) allFaqs.push(...s.faqs);
        });

        // Find coach bio from any existing content
        const coachBio =
          programs.find((p) => (p as any).coachBio)?.description ||
          squads.find((s) => (s as any).coachBio)?.description ||
          '';

        response.programs = programs;
        response.squads = squads;
        response.existingTestimonials = allTestimonials.slice(0, 10);
        response.existingFaqs = allFaqs.slice(0, 10);
        response.coachBio = coachBio;
        response.summary = `${programs.length} program${programs.length !== 1 ? 's' : ''}, ${squads.length} squad${squads.length !== 1 ? 's' : ''}`;
        break;
      }

      case 'LANDING_PAGE_PROGRAM':
      case 'PROGRAM_CONTENT': {
        if (programId) {
          // Fetch specific program
          const programDoc = await adminDb.collection('programs').doc(programId).get();

          if (!programDoc.exists) {
            return NextResponse.json({ error: 'Program not found' }, { status: 404 });
          }

          const programData = programDoc.data() as Program;

          // Verify ownership
          if (programData.organizationId !== organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
          }

          const testimonials = mapTestimonials(programData.testimonials as any);
          const faqs = mapFaqs(programData.faqs as any);

          const program: ProgramSummary = {
            name: programData.name || '',
            description: programData.description || '',
            keyOutcomes: programData.keyOutcomes || [],
            features: programData.features || [],
            lengthDays: programData.lengthDays || 0,
            lengthWeeks: programData.lengthWeeks,
            type: programData.type || 'individual',
            weekTitles: (programData.weeks?.map((w) => w.name).filter((n): n is string => !!n)) || [],
            testimonials,
            faqs,
          };

          response.program = program;
          response.coachBio = (programData as any).coachBio || '';
          response.existingTestimonials = testimonials;
          response.existingFaqs = faqs;
          response.summary = `"${program.name}" (${program.lengthDays} days, ${program.type})`;
        } else {
          // No programId provided - fetch all programs for general context
          const programsSnap = await adminDb
            .collection('programs')
            .where('organizationId', '==', organizationId)
            .limit(20)
            .get();

          const programs: ProgramSummary[] = programsSnap.docs.map((doc) => {
            const data = doc.data() as Program;
            return {
              name: data.name || '',
              description: data.description || '',
              keyOutcomes: data.keyOutcomes || [],
              features: data.features || [],
              lengthDays: data.lengthDays || 0,
              lengthWeeks: data.lengthWeeks,
              type: data.type || 'individual',
              weekTitles: (data.weeks?.map((w) => w.name).filter((n): n is string => !!n)) || [],
              testimonials: mapTestimonials(data.testimonials as any),
              faqs: mapFaqs(data.faqs as any),
            };
          });

          // Collect existing testimonials and FAQs
          const allTestimonials: SimplifiedTestimonial[] = [];
          const allFaqs: SimplifiedFAQ[] = [];
          programs.forEach((p) => {
            if (p.testimonials) allTestimonials.push(...p.testimonials);
            if (p.faqs) allFaqs.push(...p.faqs);
          });

          response.programs = programs;
          response.existingTestimonials = allTestimonials.slice(0, 10);
          response.existingFaqs = allFaqs.slice(0, 10);
          response.summary = `${programs.length} program${programs.length !== 1 ? 's' : ''}`;
        }
        break;
      }

      case 'LANDING_PAGE_SQUAD': {
        if (!squadId) {
          return NextResponse.json(
            { error: 'squadId required for this use case' },
            { status: 400 }
          );
        }

        // Fetch specific squad
        const squadDoc = await adminDb.collection('squads').doc(squadId).get();

        if (!squadDoc.exists) {
          return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
        }

        const squadData = squadDoc.data() as Squad;

        // Verify ownership
        if (squadData.organizationId !== organizationId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const testimonials = mapTestimonials(squadData.testimonials as any);
        const faqs = mapFaqs(squadData.faqs as any);

        const squad: SquadSummary = {
          name: squadData.name || '',
          description: squadData.description || '',
          keyOutcomes: squadData.keyOutcomes || [],
          features: squadData.features || [],
          testimonials,
          faqs,
        };

        response.squad = squad;
        response.coachBio = (squadData as any).coachBio || '';
        response.existingTestimonials = testimonials;
        response.existingFaqs = faqs;
        response.summary = `"${squad.name}" squad`;
        break;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AI_CONTEXT] Error:', error);

    if (error instanceof TenantRequiredError) {
      return NextResponse.json(
        { error: 'tenant_required', tenantUrl: error.tenantUrl, subdomain: error.subdomain },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
