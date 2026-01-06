/**
 * Coach API: Single Program Management (org-scoped)
 *
 * GET /api/coach/org-programs/[programId] - Get program details with days
 * PUT /api/coach/org-programs/[programId] - Full program update
 * PATCH /api/coach/org-programs/[programId] - Partial update (taskDistribution, etc.)
 * DELETE /api/coach/org-programs/[programId] - Delete program
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import { clerkClient } from '@clerk/nextjs/server';
import { getStreamServerClient } from '@/lib/stream-server';
import type { Program, ProgramDay, ProgramCohort, ProgramHabitTemplate, ProgramFeature, ProgramTestimonial, ProgramFAQ, Squad } from '@/types';
import { syncProgramWeeks, recalculateWeekDayIndices } from '@/lib/program-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    
    const programDoc = await adminDb.collection('programs').doc(programId).get();

    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data();
    
    // Verify program belongs to this organization
    if (programData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    const program = {
      id: programDoc.id,
      ...programData,
      createdAt: programData?.createdAt?.toDate?.()?.toISOString?.() || programData?.createdAt,
      updatedAt: programData?.updatedAt?.toDate?.()?.toISOString?.() || programData?.updatedAt,
    } as Program;

    // Fetch program days
    const daysSnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .get();

    const days = daysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as ProgramDay[];

    // Sort days by dayIndex in memory
    days.sort((a, b) => a.dayIndex - b.dayIndex);

    // For group programs, also fetch cohorts
    let cohorts: ProgramCohort[] = [];
    if (program.type === 'group') {
      const cohortsSnapshot = await adminDb
        .collection('program_cohorts')
        .where('programId', '==', programId)
        .get();

      cohorts = cohortsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      })) as ProgramCohort[];

      // Sort cohorts by startDate descending in memory
      cohorts.sort((a, b) => 
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
    }

    // Count enrollments
    const [activeEnrollments, totalEnrollments] = await Promise.all([
      adminDb
        .collection('program_enrollments')
        .where('programId', '==', programId)
        .where('status', 'in', ['active', 'upcoming'])
        .count()
        .get(),
      adminDb
        .collection('program_enrollments')
        .where('programId', '==', programId)
        .count()
        .get(),
    ]);

    return NextResponse.json({ 
      program, 
      days,
      cohorts,
      stats: {
        totalEnrollments: totalEnrollments.data().count,
        activeEnrollments: activeEnrollments.data().count,
        cohortCount: cohorts.length,
        dayCount: days.length,
      },
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch program' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body = await request.json();

    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const currentData = programDoc.data();
    
    // Verify program belongs to this organization
    if (currentData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Validate type if being changed (not allowed to change type after creation)
    if (body.type !== undefined && body.type !== currentData?.type) {
      return NextResponse.json(
        { error: 'Cannot change program type after creation' },
        { status: 400 }
      );
    }

    // Validate lengthDays if being changed
    if (body.lengthDays !== undefined) {
      if (typeof body.lengthDays !== 'number' || body.lengthDays < 1 || body.lengthDays > 365) {
        return NextResponse.json(
          { error: 'lengthDays must be a number between 1 and 365' },
          { status: 400 }
        );
      }
    }

    // If slug is being changed, check it doesn't conflict within the org
    if (body.slug && body.slug !== currentData?.slug) {
      const existingProgram = await adminDb
        .collection('programs')
        .where('organizationId', '==', organizationId)
        .where('slug', '==', body.slug)
        .limit(1)
        .get();

      if (!existingProgram.empty && existingProgram.docs[0].id !== programId) {
        return NextResponse.json(
          { error: `Program with slug "${body.slug}" already exists in your organization` },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // String fields
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.coverImageUrl !== undefined) updateData.coverImageUrl = body.coverImageUrl || null;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.stripePriceId !== undefined) updateData.stripePriceId = body.stripePriceId || null;
    
    // Number fields
    if (body.lengthDays !== undefined) updateData.lengthDays = body.lengthDays;
    if (body.priceInCents !== undefined) updateData.priceInCents = body.priceInCents;
    if (body.squadCapacity !== undefined && currentData?.type === 'group') {
      updateData.squadCapacity = body.squadCapacity;
    }
    
    // Boolean fields
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
    if (body.coachInSquads !== undefined && currentData?.type === 'group') {
      updateData.coachInSquads = body.coachInSquads;
    }

    // Handle hasModules flag (enables module-based structure)
    if (body.hasModules !== undefined) {
      updateData.hasModules = body.hasModules === true;
    }

    // Handle task distribution setting
    if (body.taskDistribution !== undefined) {
      const validDistributions = ['repeat-daily', 'spread'];
      if (validDistributions.includes(body.taskDistribution)) {
        updateData.taskDistribution = body.taskDistribution;
      }
    }

    // Handle legacy orientation (deprecated, for backward compatibility)
    if (body.orientation !== undefined) {
      const validOrientations = ['daily', 'weekly'];
      if (validOrientations.includes(body.orientation)) {
        updateData.orientation = body.orientation;
      }
    }
    
    // Subscription settings
    if (body.subscriptionEnabled !== undefined) updateData.subscriptionEnabled = body.subscriptionEnabled;
    if (body.billingInterval !== undefined) updateData.billingInterval = body.billingInterval;
    
    // Handle clientCommunityEnabled for individual programs
    if (body.clientCommunityEnabled !== undefined && currentData?.type === 'individual') {
      updateData.clientCommunityEnabled = body.clientCommunityEnabled;
      
      // If enabling community and no squad exists yet, auto-create one
      if (body.clientCommunityEnabled === true && !currentData?.clientCommunitySquadId) {
        const now = new Date().toISOString();
        
        // Generate invite code for the community
        const inviteCode = `GA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        // Create the community squad
        const squadData: Omit<Squad, 'id'> = {
          name: `${currentData?.name || 'Program'} Community`,
          description: `Client community for ${currentData?.name || 'program'} participants`,
          avatarUrl: currentData?.coverImageUrl || '',
          visibility: 'private',
          timezone: 'UTC',
          memberIds: [],
          inviteCode,
          hasCoach: true,
          coachId: userId, // Coach is the creator
          organizationId,
          programId,
          createdAt: now,
          updatedAt: now,
        };
        
        const squadRef = await adminDb.collection('squads').add(squadData);
        const squadId = squadRef.id;
        
        console.log(`[COACH_ORG_PROGRAM_PUT] Created client community squad: ${squadId} for program ${programId}`);
        
        // Create Stream Chat channel for the community
        try {
          const streamClient = await getStreamServerClient();
          const channelId = `squad-${squadId}`;
          
          // Get coach's details from Clerk
          const clerk = await clerkClient();
          const coachClerkUser = await clerk.users.getUser(userId);
          
          // Upsert coach in Stream
          await streamClient.upsertUser({
            id: userId,
            name: `${coachClerkUser.firstName || ''} ${coachClerkUser.lastName || ''}`.trim() || 'Coach',
            image: coachClerkUser.imageUrl,
          });
          
          // Create the community chat channel with coach as initial member
          const channel = streamClient.channel('messaging', channelId, {
            members: [userId],
            created_by_id: userId,
            name: `${currentData?.name || 'Program'} Community`,
            image: currentData?.coverImageUrl || undefined,
            isSquadChannel: true,
          } as Record<string, unknown>);
          await channel.create();
          
          // Update squad with chatChannelId
          await squadRef.update({ chatChannelId: channelId });
          
          console.log(`[COACH_ORG_PROGRAM_PUT] Created chat channel ${channelId} for community squad`);
        } catch (chatError) {
          console.error(`[COACH_ORG_PROGRAM_PUT] Failed to create chat channel for community:`, chatError);
          // Continue anyway - squad is created, chat can be added later
        }
        
        // Add coach as proper squad member (like in group programs)
        try {
          const clerk = await clerkClient();
          const coachClerkUser = await clerk.users.getUser(userId);
          
          // Create squadMember document for the coach
          await adminDb.collection('squadMembers').add({
            squadId,
            userId,
            roleInSquad: 'coach',
            firstName: coachClerkUser.firstName || '',
            lastName: coachClerkUser.lastName || '',
            imageUrl: coachClerkUser.imageUrl || '',
            createdAt: now,
            updatedAt: now,
          });
          
          // Update squad memberIds to include coach
          await squadRef.update({
            memberIds: [userId],
            updatedAt: now,
          });
          
          // Update coach's user document with squadIds
          const coachUserDoc = await adminDb.collection('users').doc(userId).get();
          if (coachUserDoc.exists) {
            await adminDb.collection('users').doc(userId).update({
              squadIds: FieldValue.arrayUnion(squadId),
              updatedAt: now,
            });
          } else {
            await adminDb.collection('users').doc(userId).set({
              squadIds: [squadId],
              createdAt: now,
              updatedAt: now,
            });
          }
          
          // If coach has an enrollment for this program, set joinedCommunity
          const coachEnrollmentSnapshot = await adminDb.collection('programEnrollments')
            .where('programId', '==', programId)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .limit(1)
            .get();
          
          if (!coachEnrollmentSnapshot.empty) {
            await coachEnrollmentSnapshot.docs[0].ref.update({
              joinedCommunity: true,
              updatedAt: now,
            });
            console.log(`[COACH_ORG_PROGRAM_PUT] Updated coach enrollment with joinedCommunity: true`);
          }
          
          console.log(`[COACH_ORG_PROGRAM_PUT] Added coach ${userId} as proper squad member`);
        } catch (memberError) {
          console.error(`[COACH_ORG_PROGRAM_PUT] Failed to add coach as squad member:`, memberError);
          // Continue anyway - squad is created
        }
        
        // Add the squad ID to the program update
        updateData.clientCommunitySquadId = squadId;
      }
    }
    
    // Handle start date settings for individual programs
    if (currentData?.type === 'individual') {
      if (body.defaultStartDate !== undefined) {
        updateData.defaultStartDate = body.defaultStartDate || null;
      }
      if (body.allowCustomStartDate !== undefined) {
        updateData.allowCustomStartDate = body.allowCustomStartDate;
      }
      if (body.callCreditsPerMonth !== undefined) {
        updateData.callCreditsPerMonth = typeof body.callCreditsPerMonth === 'number' && body.callCreditsPerMonth > 0 
          ? body.callCreditsPerMonth 
          : FieldValue.delete();
      }
    }
    
    // Handle assignedCoachIds for group programs
    if (body.assignedCoachIds !== undefined && currentData?.type === 'group') {
      if (Array.isArray(body.assignedCoachIds) && body.assignedCoachIds.length > 0) {
        updateData.assignedCoachIds = body.assignedCoachIds;
      } else {
        updateData.assignedCoachIds = FieldValue.delete();
      }
    }

    // Handle default habits
    if (body.defaultHabits !== undefined) {
      const defaultHabits: ProgramHabitTemplate[] = [];
      if (Array.isArray(body.defaultHabits)) {
        for (const habit of body.defaultHabits) {
          if (!habit.title) continue;
          defaultHabits.push({
            title: habit.title,
            description: habit.description || '',
            frequency: habit.frequency || 'daily',
          });
        }
      }
      updateData.defaultHabits = defaultHabits.length > 0 ? defaultHabits : null;
    }

    // Handle daily focus slots
    if (body.dailyFocusSlots !== undefined) {
      const slots = Number(body.dailyFocusSlots);
      if (!isNaN(slots) && slots >= 1 && slots <= 4) {
        updateData.dailyFocusSlots = slots;
      }
    }

    // Handle weekend settings
    if (body.includeWeekends !== undefined) {
      updateData.includeWeekends = body.includeWeekends === true;
    }

    // Handle landing page hero section fields
    if (body.heroHeadline !== undefined) {
      updateData.heroHeadline = body.heroHeadline?.trim() || null;
    }
    if (body.heroSubheadline !== undefined) {
      updateData.heroSubheadline = body.heroSubheadline?.trim() || null;
    }
    if (body.heroCtaText !== undefined) {
      updateData.heroCtaText = body.heroCtaText?.trim() || null;
    }
    if (body.landingPageCoverImageUrl !== undefined) {
      updateData.landingPageCoverImageUrl = body.landingPageCoverImageUrl || null;
    }

    // Handle landing page content fields
    if (body.coachBio !== undefined) {
      updateData.coachBio = body.coachBio?.trim() || null;
    }
    if (body.coachHeadline !== undefined) {
      updateData.coachHeadline = body.coachHeadline?.trim() || null;
    }
    if (body.coachBullets !== undefined) {
      const coachBullets: string[] = [];
      if (Array.isArray(body.coachBullets)) {
        for (const bullet of body.coachBullets) {
          if (typeof bullet === 'string' && bullet.trim()) {
            coachBullets.push(bullet.trim());
          }
        }
      }
      updateData.coachBullets = coachBullets.length > 0 ? coachBullets : null;
    }

    if (body.keyOutcomes !== undefined) {
      const keyOutcomes: string[] = [];
      if (Array.isArray(body.keyOutcomes)) {
        for (const outcome of body.keyOutcomes) {
          if (typeof outcome === 'string' && outcome.trim()) {
            keyOutcomes.push(outcome.trim());
          }
        }
      }
      updateData.keyOutcomes = keyOutcomes.length > 0 ? keyOutcomes : null;
    }

    if (body.features !== undefined) {
      const features: ProgramFeature[] = [];
      if (Array.isArray(body.features)) {
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
      updateData.features = features.length > 0 ? features : null;
    }

    if (body.testimonials !== undefined) {
      const testimonials: ProgramTestimonial[] = [];
      if (Array.isArray(body.testimonials)) {
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
      updateData.testimonials = testimonials.length > 0 ? testimonials : null;
    }

    if (body.faqs !== undefined) {
      const faqs: ProgramFAQ[] = [];
      if (Array.isArray(body.faqs)) {
        for (const faq of body.faqs) {
          if (faq.question?.trim() && faq.answer?.trim()) {
            faqs.push({
              question: faq.question.trim(),
              answer: faq.answer.trim(),
            });
          }
        }
      }
      updateData.faqs = faqs.length > 0 ? faqs : null;
    }

    if (body.showEnrollmentCount !== undefined) {
      updateData.showEnrollmentCount = body.showEnrollmentCount === true;
    }

    if (body.showCurriculum !== undefined) {
      updateData.showCurriculum = body.showCurriculum === true;
    }

    // Handle completion config (upsell settings)
    if (body.completionConfig !== undefined) {
      const completionConfig: {
        showConfetti?: boolean;
        upsellProgramId?: string;
        upsellHeadline?: string;
        upsellDescription?: string;
      } = {};
      
      // Show confetti (default true)
      completionConfig.showConfetti = body.completionConfig.showConfetti !== false;
      
      // Upsell program (validate it exists and belongs to same org)
      if (body.completionConfig.upsellProgramId) {
        const upsellProgramDoc = await adminDb.collection('programs').doc(body.completionConfig.upsellProgramId).get();
        if (upsellProgramDoc.exists && upsellProgramDoc.data()?.organizationId === organizationId) {
          completionConfig.upsellProgramId = body.completionConfig.upsellProgramId;
          completionConfig.upsellHeadline = body.completionConfig.upsellHeadline?.trim() || undefined;
          completionConfig.upsellDescription = body.completionConfig.upsellDescription?.trim() || undefined;
        }
      }
      
      // Only set if there's meaningful config, otherwise remove it
      if (completionConfig.upsellProgramId || completionConfig.showConfetti === false) {
        updateData.completionConfig = completionConfig;
      } else {
        updateData.completionConfig = FieldValue.delete();
      }
    }

    await adminDb.collection('programs').doc(programId).update(updateData);

    console.log(`[COACH_ORG_PROGRAM_PUT] Updated program: ${programId} in org ${organizationId}`);

    // If lengthDays or includeWeekends changed, sync weeks
    const durationChanged = body.lengthDays !== undefined && body.lengthDays !== currentData?.lengthDays;
    const weekendSettingChanged = body.includeWeekends !== undefined && body.includeWeekends !== currentData?.includeWeekends;

    if (durationChanged || weekendSettingChanged) {
      try {
        // Sync weeks to match new duration
        const weekResult = await syncProgramWeeks(programId, organizationId);
        console.log(`[COACH_ORG_PROGRAM_PUT] Synced weeks: ${weekResult.created} created, ${weekResult.existing} existed, ${weekResult.total} total`);

        // Recalculate day indices for existing weeks
        await recalculateWeekDayIndices(programId);
        console.log(`[COACH_ORG_PROGRAM_PUT] Recalculated week day indices`);
      } catch (weekError) {
        console.error(`[COACH_ORG_PROGRAM_PUT] Failed to sync weeks:`, weekError);
        // Don't fail the update, weeks can be synced later
      }
    }

    // If applyCoachesToExistingSquads is true, update all existing squads with new coach assignment
    if (body.applyCoachesToExistingSquads === true && currentData?.type === 'group') {
      const coachInSquads = body.coachInSquads ?? currentData?.coachInSquads;
      const assignedCoachIds = body.assignedCoachIds ?? currentData?.assignedCoachIds ?? [];
      
      // Get all squads for this program
      const squadsSnapshot = await adminDb
        .collection('squads')
        .where('programId', '==', programId)
        .get();
      
      if (!squadsSnapshot.empty) {
        const batch = adminDb.batch();
        let updatedSquadCount = 0;
        
        squadsSnapshot.docs.forEach((squadDoc) => {
          const squad = squadDoc.data();
          const squadNumber = squad.squadNumber || 1;
          
          let newCoachId: string | null = null;
          
          if (coachInSquads) {
            // If coachInSquads is true, we can't easily determine who the original creator was
            // so we leave the coach as-is or null
            newCoachId = squad.coachId || null;
          } else if (assignedCoachIds.length > 0) {
            // Round-robin assignment based on squad number
            newCoachId = assignedCoachIds[(squadNumber - 1) % assignedCoachIds.length];
          }
          
          // Only update if coach assignment changed
          if (squad.coachId !== newCoachId) {
            batch.update(squadDoc.ref, { 
              coachId: newCoachId,
              updatedAt: new Date().toISOString(),
            });
            updatedSquadCount++;
          }
        });
        
        if (updatedSquadCount > 0) {
          await batch.commit();
          console.log(`[COACH_ORG_PROGRAM_PUT] Updated ${updatedSquadCount} squads with new coach assignment`);
        }
      }
    }

    // Fetch updated program
    const updatedDoc = await adminDb.collection('programs').doc(programId).get();
    const updatedData = updatedDoc.data();
    const updatedProgram = {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData?.createdAt?.toDate?.()?.toISOString?.() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt?.toDate?.()?.toISOString?.() || updatedData?.updatedAt,
    } as Program;

    return NextResponse.json({ 
      success: true, 
      program: updatedProgram,
      message: 'Program updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
  }
}

/**
 * PATCH - Partial update for quick field changes
 * Supports: taskDistribution, isActive, isPublished, name
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    const body = await request.json();

    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const currentData = programDoc.data();

    // Verify program belongs to this organization
    if (currentData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Build update object - only include provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Handle task distribution setting
    if (body.taskDistribution !== undefined) {
      const validDistributions = ['repeat-daily', 'spread'];
      if (validDistributions.includes(body.taskDistribution)) {
        updateData.taskDistribution = body.taskDistribution;
      } else {
        return NextResponse.json({ error: 'Invalid taskDistribution value' }, { status: 400 });
      }
    }

    // Handle other quick toggle fields
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
    if (body.name !== undefined) updateData.name = body.name.trim();

    // Only update if there's something to update beyond timestamp
    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    await adminDb.collection('programs').doc(programId).update(updateData);

    console.log(`[COACH_ORG_PROGRAM_PATCH] Updated program: ${programId}, fields: ${Object.keys(updateData).join(', ')}`);

    // Fetch updated program
    const updatedDoc = await adminDb.collection('programs').doc(programId).get();
    const updatedData = updatedDoc.data();
    const updatedProgram = {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData?.createdAt?.toDate?.()?.toISOString?.() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt?.toDate?.()?.toISOString?.() || updatedData?.updatedAt,
    } as Program;

    return NextResponse.json({
      success: true,
      program: updatedProgram,
      message: 'Program updated successfully'
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { programId } = await params;
    
    const programDoc = await adminDb.collection('programs').doc(programId).get();

    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data();
    
    // Verify program belongs to this organization
    if (programData?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program not found in your organization' }, { status: 404 });
    }

    // Safety check: Don't allow deleting programs that have active enrollments
    const activeEnrollments = await adminDb
      .collection('program_enrollments')
      .where('programId', '==', programId)
      .where('status', 'in', ['active', 'upcoming'])
      .limit(1)
      .get();

    if (!activeEnrollments.empty) {
      return NextResponse.json(
        { error: `Cannot delete program "${programData?.name}" - it has active enrollments. Deactivate it instead.` },
        { status: 400 }
      );
    }

    // Delete in order: cohorts, days, enrollments (completed/stopped), then program
    const batch = adminDb.batch();

    // Delete cohorts
    const cohortsSnapshot = await adminDb
      .collection('program_cohorts')
      .where('programId', '==', programId)
      .get();
    cohortsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete program days
    const daysSnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .get();
    daysSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete past enrollments
    const enrollmentsSnapshot = await adminDb
      .collection('program_enrollments')
      .where('programId', '==', programId)
      .get();
    enrollmentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete the program
    batch.delete(programDoc.ref);

    await batch.commit();

    console.log(`[COACH_ORG_PROGRAM_DELETE] Deleted program: ${programId} (${programData?.name}) with ${cohortsSnapshot.size} cohorts, ${daysSnapshot.size} days, ${enrollmentsSnapshot.size} enrollments`);

    return NextResponse.json({ 
      success: true, 
      message: 'Program deleted successfully',
      deleted: {
        cohorts: cohortsSnapshot.size,
        days: daysSnapshot.size,
        enrollments: enrollmentsSnapshot.size,
      },
    });
  } catch (error) {
    console.error('[COACH_ORG_PROGRAM_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 });
  }
}

