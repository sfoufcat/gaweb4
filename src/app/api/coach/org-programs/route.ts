/**
 * Coach API: Organization-scoped Programs Management
 * 
 * GET /api/coach/org-programs - List programs in coach's organization
 * POST /api/coach/org-programs - Create new program in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { requireOrgAuthAndEntitlements, getOrgProgramCount, isEntitlementError, getEntitlementErrorStatus } from '@/lib/billing/server-enforcement';
import { withDemoMode, demoNotAvailable } from '@/lib/demo-api';
import type { Program, ProgramType, ProgramHabitTemplate, ProgramWithStats, ProgramFeature, ProgramTestimonial, ProgramFAQ } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('org-programs');
    if (demoData) return demoData;
    
    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const type = searchParams.get('type') as ProgramType | null;
    const isPublished = searchParams.get('published');

    console.log(`[COACH_ORG_PROGRAMS] Fetching programs for organization: ${organizationId}`);

    // Build query
    let query = adminDb
      .collection('programs')
      .where('organizationId', '==', organizationId);

    if (type) {
      query = query.where('type', '==', type);
    }
    if (isPublished !== null) {
      query = query.where('isPublished', '==', isPublished === 'true');
    }

    const programsSnapshot = await query.get();

    // Get enrollment counts for each program
    const programs: ProgramWithStats[] = await Promise.all(
      programsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        // Count enrollments
        const [activeEnrollments, totalEnrollments, cohorts] = await Promise.all([
          adminDb
            .collection('program_enrollments')
            .where('programId', '==', doc.id)
            .where('status', 'in', ['active', 'upcoming'])
            .count()
            .get(),
          adminDb
            .collection('program_enrollments')
            .where('programId', '==', doc.id)
            .count()
            .get(),
          data.type === 'group'
            ? adminDb
                .collection('program_cohorts')
                .where('programId', '==', doc.id)
                .count()
                .get()
            : Promise.resolve(null),
        ]);

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
          totalEnrollments: totalEnrollments.data().count,
          activeEnrollments: activeEnrollments.data().count,
          cohortCount: cohorts?.data().count,
        } as ProgramWithStats;
      })
    );

    // Sort by createdAt descending (in memory to avoid composite index requirement)
    programs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ 
      programs,
      totalCount: programs.length,
      organizationId,
    });
  } catch (error) {
    // Handle tenant required error
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    
    console.error('[COACH_ORG_PROGRAMS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Demo mode: block write operations
    const demoData = await withDemoMode('org-programs');
    if (demoData) return demoNotAvailable('Creating programs');
    
    // Get current program count for limit check
    const { organizationId } = await requireCoachWithOrg();
    const currentProgramCount = await getOrgProgramCount(organizationId);
    
    // Verify entitlements with limit check
    await requireOrgAuthAndEntitlements({
      requireLimitNotExceeded: {
        limitKey: 'maxPrograms',
        currentCount: currentProgramCount,
      },
    });

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['name', 'type', 'lengthDays'];
    for (const field of requiredFields) {
      if (!body[field] && body[field] !== 0) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate type
    if (!['group', 'individual'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Type must be "group" or "individual"' },
        { status: 400 }
      );
    }

    // Validate lengthDays
    if (typeof body.lengthDays !== 'number' || body.lengthDays < 1 || body.lengthDays > 365) {
      return NextResponse.json(
        { error: 'lengthDays must be a number between 1 and 365' },
        { status: 400 }
      );
    }

    // Validate squad capacity for group programs
    if (body.type === 'group') {
      if (body.squadCapacity !== undefined) {
        if (typeof body.squadCapacity !== 'number' || body.squadCapacity < 2 || body.squadCapacity > 100) {
          return NextResponse.json(
            { error: 'squadCapacity must be a number between 2 and 100' },
            { status: 400 }
          );
        }
      }
    }

    // Validate price
    if (body.priceInCents !== undefined) {
      if (typeof body.priceInCents !== 'number' || body.priceInCents < 0) {
        return NextResponse.json(
          { error: 'priceInCents must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    // Generate slug if not provided
    const slug = body.slug || body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if slug already exists in this organization
    const existingProgram = await adminDb
      .collection('programs')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!existingProgram.empty) {
      return NextResponse.json(
        { error: `Program with slug "${slug}" already exists in your organization` },
        { status: 400 }
      );
    }

    // Validate default habits if provided
    const defaultHabits: ProgramHabitTemplate[] = [];
    if (body.defaultHabits && Array.isArray(body.defaultHabits)) {
      for (const habit of body.defaultHabits) {
        if (!habit.title) continue;
        defaultHabits.push({
          title: habit.title,
          description: habit.description || '',
          frequency: habit.frequency || 'daily',
        });
      }
    }

    // Validate landing page content if provided
    const keyOutcomes: string[] = [];
    if (body.keyOutcomes && Array.isArray(body.keyOutcomes)) {
      for (const outcome of body.keyOutcomes) {
        if (typeof outcome === 'string' && outcome.trim()) {
          keyOutcomes.push(outcome.trim());
        }
      }
    }

    const features: ProgramFeature[] = [];
    if (body.features && Array.isArray(body.features)) {
      for (const feature of body.features) {
        if (feature.title?.trim()) {
          features.push({
            icon: feature.icon || undefined,
            title: feature.title.trim(),
            description: feature.description?.trim() || undefined,
          });
        }
      }
    }

    const testimonials: ProgramTestimonial[] = [];
    if (body.testimonials && Array.isArray(body.testimonials)) {
      for (const testimonial of body.testimonials) {
        if (testimonial.text?.trim() && testimonial.author?.trim()) {
          testimonials.push({
            text: testimonial.text.trim(),
            author: testimonial.author.trim(),
            role: testimonial.role?.trim() || undefined,
            imageUrl: testimonial.imageUrl || undefined,
            rating: typeof testimonial.rating === 'number' ? Math.min(5, Math.max(1, testimonial.rating)) : undefined,
          });
        }
      }
    }

    const faqs: ProgramFAQ[] = [];
    if (body.faqs && Array.isArray(body.faqs)) {
      for (const faq of body.faqs) {
        if (faq.question?.trim() && faq.answer?.trim()) {
          faqs.push({
            question: faq.question.trim(),
            answer: faq.answer.trim(),
          });
        }
      }
    }

    const programData: Omit<Program, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: FieldValue; updatedAt: FieldValue } = {
      organizationId,
      name: body.name.trim(),
      slug,
      description: body.description?.trim() || '',
      coverImageUrl: body.coverImageUrl || undefined,
      type: body.type as ProgramType,
      lengthDays: body.lengthDays,
      priceInCents: body.priceInCents || 0,
      currency: body.currency || 'usd',
      stripePriceId: body.stripePriceId || undefined,
      squadCapacity: body.type === 'group' ? (body.squadCapacity || 10) : undefined,
      coachInSquads: body.type === 'group' ? (body.coachInSquads !== false) : undefined,
      assignedCoachIds: body.type === 'group' && Array.isArray(body.assignedCoachIds) && body.assignedCoachIds.length > 0 
        ? body.assignedCoachIds 
        : undefined,
      // Individual program settings
      defaultStartDate: body.type === 'individual' && body.defaultStartDate ? body.defaultStartDate : undefined,
      allowCustomStartDate: body.type === 'individual' ? body.allowCustomStartDate !== false : undefined,
      callCreditsPerMonth: body.type === 'individual' && typeof body.callCreditsPerMonth === 'number' && body.callCreditsPerMonth > 0 
        ? body.callCreditsPerMonth 
        : undefined,
      defaultHabits: defaultHabits.length > 0 ? defaultHabits : undefined,
      dailyFocusSlots: typeof body.dailyFocusSlots === 'number' && body.dailyFocusSlots >= 1 && body.dailyFocusSlots <= 4
        ? body.dailyFocusSlots
        : undefined,
      includeWeekends: body.includeWeekends !== false, // Default true
      isActive: body.isActive !== false,
      isPublished: body.isPublished === true,
      // Subscription settings
      subscriptionEnabled: body.subscriptionEnabled || false,
      billingInterval: body.billingInterval || 'monthly',
      // Landing page content
      coachBio: body.coachBio?.trim() || undefined,
      keyOutcomes: keyOutcomes.length > 0 ? keyOutcomes : undefined,
      features: features.length > 0 ? features : undefined,
      testimonials: testimonials.length > 0 ? testimonials : undefined,
      faqs: faqs.length > 0 ? faqs : undefined,
      showEnrollmentCount: body.showEnrollmentCount === true,
      showCurriculum: body.showCurriculum === true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('programs').add(programData);

    console.log(`[COACH_ORG_PROGRAMS_POST] Created program: ${slug} (${docRef.id}) type=${body.type} in org ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      program: { 
        id: docRef.id, 
        ...programData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: 'Program created successfully',
    }, { status: 201 });
  } catch (error) {
    // Handle entitlement errors (plan limits)
    if (isEntitlementError(error)) {
      return NextResponse.json(
        { 
          error: error.message, 
          code: error.code,
          limit: error.limit,
          currentUsage: error.currentUsage,
        },
        { status: getEntitlementErrorStatus(error) }
      );
    }
    
    // Handle tenant required error
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    
    console.error('[COACH_ORG_PROGRAMS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create program' }, { status: 500 });
  }
}

