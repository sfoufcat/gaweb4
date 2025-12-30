/**
 * Coach API: Duplicate Program
 * 
 * POST /api/coach/org-programs/[programId]/duplicate - Clone a program
 * 
 * Creates a copy of the program with:
 * - New name: "Original Name (Copy)" or incremented
 * - New unique slug
 * - All settings preserved (pricing, capacity, habits, landing page content, etc.)
 * - isPublished reset to false (draft mode)
 * - stripePriceId cleared (coach needs to create new Stripe price)
 * - clientCommunitySquadId cleared (fresh start)
 * - All program days copied to new program
 * - Cohorts NOT copied (they're specific to original program)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { Program, ProgramDay } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }
    const sourceProgram = programDoc.data() as Program;
    if (sourceProgram.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Generate unique name
    let newName = `${sourceProgram.name} (Copy)`;
    let copyNumber = 1;
    
    // Check if name already exists and increment if needed
    while (true) {
      const existingProgram = await adminDb
        .collection('programs')
        .where('organizationId', '==', organizationId)
        .where('name', '==', newName)
        .limit(1)
        .get();

      if (existingProgram.empty) {
        break;
      }
      
      copyNumber++;
      newName = `${sourceProgram.name} (Copy ${copyNumber})`;
      
      // Safety limit
      if (copyNumber > 100) {
        return NextResponse.json(
          { error: 'Too many copies of this program exist' },
          { status: 400 }
        );
      }
    }

    // Generate unique slug
    let baseSlug = newName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let newSlug = baseSlug;
    let slugNumber = 1;

    while (true) {
      const existingSlug = await adminDb
        .collection('programs')
        .where('organizationId', '==', organizationId)
        .where('slug', '==', newSlug)
        .limit(1)
        .get();

      if (existingSlug.empty) {
        break;
      }

      slugNumber++;
      newSlug = `${baseSlug}-${slugNumber}`;

      if (slugNumber > 100) {
        return NextResponse.json(
          { error: 'Unable to generate unique slug' },
          { status: 400 }
        );
      }
    }

    // Create new program with copied settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newProgramData: Record<string, any> = {
      organizationId,
      name: newName,
      slug: newSlug,
      description: sourceProgram.description || '',
      coverImageUrl: sourceProgram.coverImageUrl || undefined,
      type: sourceProgram.type,
      lengthDays: sourceProgram.lengthDays,
      priceInCents: sourceProgram.priceInCents || 0,
      currency: sourceProgram.currency || 'usd',
      // Do NOT copy stripePriceId - coach needs to create new Stripe price
      stripePriceId: undefined,
      
      // Group program settings
      squadCapacity: sourceProgram.squadCapacity,
      coachInSquads: sourceProgram.coachInSquads,
      assignedCoachIds: sourceProgram.assignedCoachIds,
      
      // Individual program settings
      clientCommunityEnabled: sourceProgram.clientCommunityEnabled,
      // Do NOT copy clientCommunitySquadId - fresh start
      clientCommunitySquadId: undefined,
      defaultStartDate: sourceProgram.defaultStartDate,
      allowCustomStartDate: sourceProgram.allowCustomStartDate,
      
      // Content
      defaultHabits: sourceProgram.defaultHabits,
      dailyFocusSlots: sourceProgram.dailyFocusSlots,
      includeWeekends: sourceProgram.includeWeekends,
      
      // Status - reset to draft
      isActive: true,
      isPublished: false, // Always start as draft
      
      // Landing page content
      heroHeadline: sourceProgram.heroHeadline,
      heroSubheadline: sourceProgram.heroSubheadline,
      heroCtaText: sourceProgram.heroCtaText,
      landingPageCoverImageUrl: sourceProgram.landingPageCoverImageUrl,
      coachBio: sourceProgram.coachBio,
      coachHeadline: sourceProgram.coachHeadline,
      coachBullets: sourceProgram.coachBullets,
      keyOutcomes: sourceProgram.keyOutcomes,
      features: sourceProgram.features,
      testimonials: sourceProgram.testimonials,
      faqs: sourceProgram.faqs,
      showEnrollmentCount: sourceProgram.showEnrollmentCount,
      showCurriculum: sourceProgram.showCurriculum,
      
      // Referral config
      referralConfig: sourceProgram.referralConfig,
      
      // Timestamps
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Remove undefined values
    Object.keys(newProgramData).forEach(key => {
      if (newProgramData[key] === undefined) {
        delete newProgramData[key];
      }
    });

    // Create the new program
    const newProgramRef = await adminDb.collection('programs').add(newProgramData);
    const newProgramId = newProgramRef.id;

    console.log(`[COACH_ORG_PROGRAM_DUPLICATE] Created program copy: ${sourceProgram.name} -> ${newName} (${newProgramId})`);

    // Copy all program days
    const daysSnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .get();

    if (!daysSnapshot.empty) {
      const batch = adminDb.batch();
      
      for (const dayDoc of daysSnapshot.docs) {
        const dayData = dayDoc.data() as ProgramDay;
        const newDayRef = adminDb.collection('program_days').doc();
        
        batch.set(newDayRef, {
          programId: newProgramId,
          dayIndex: dayData.dayIndex,
          title: dayData.title || '',
          summary: dayData.summary || '',
          dailyPrompt: dayData.dailyPrompt || '',
          tasks: dayData.tasks || [],
          habits: dayData.habits || undefined,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      
      await batch.commit();
      console.log(`[COACH_ORG_PROGRAM_DUPLICATE] Copied ${daysSnapshot.size} program days to new program ${newProgramId}`);
    }

    return NextResponse.json({ 
      success: true, 
      id: newProgramId,
      program: { 
        id: newProgramId, 
        ...newProgramData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      daysCopied: daysSnapshot.size,
      message: `Program duplicated as "${newName}"`,
    }, { status: 201 });
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

    console.error('[COACH_ORG_PROGRAM_DUPLICATE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to duplicate program' }, { status: 500 });
  }
}



