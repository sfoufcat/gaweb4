/**
 * Program Enrollment API
 * 
 * POST /api/programs/enroll - Enroll in a program (with Stripe checkout if paid)
 * 
 * For paid programs, creates a Stripe checkout session using Connect.
 * For free programs, creates enrollment directly.
 * For group programs, auto-assigns to a squad (creating one if needed).
 * For individual programs, creates coaching relationship.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getStreamServerClient } from '@/lib/stream-server';
import Stripe from 'stripe';
import type { 
  Program, 
  ProgramCohort, 
  ProgramEnrollment, 
  Squad, 
  OrgSettings,
  ClientCoachingData,
  DiscountCode,
} from '@/types';

// Initialize Stripe
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

/**
 * Find or create a squad for a group program cohort
 */
async function findOrCreateSquad(
  program: Program,
  cohort: ProgramCohort,
  userId: string
): Promise<string> {
  const squadCapacity = program.squadCapacity || 10;

  // Find existing squad with capacity
  const squadsSnapshot = await adminDb
    .collection('squads')
    .where('cohortId', '==', cohort.id)
    .get();

  for (const doc of squadsSnapshot.docs) {
    const squad = doc.data() as Squad;
    const memberCount = squad.memberIds?.length || 0;
    const capacity = squad.capacity || squadCapacity;
    
    if (memberCount < capacity) {
      // Found a squad with room
      return doc.id;
    }
  }

  // No squad with capacity found, create a new one
  const squadNumber = squadsSnapshot.size + 1;
  const squadName = `${program.name} - ${cohort.name} - Squad ${squadNumber}`;
  
  // Generate invite code
  const inviteCode = `GA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  // Determine coach assignment using round-robin logic
  let coachId: string | null = null;
  const assignedCoachIds = program.assignedCoachIds || [];
  
  if (assignedCoachIds.length > 0 && !program.coachInSquads) {
    // Round-robin coach assignment: Squad 1 -> Coach A, Squad 2 -> Coach B, etc.
    coachId = assignedCoachIds[(squadNumber - 1) % assignedCoachIds.length];
    console.log(`[PROGRAM_ENROLL] Round-robin coach assignment: Squad ${squadNumber} -> Coach ${coachId}`);
  } else if (program.coachInSquads) {
    // When coachInSquads is true, get the org admin (super_coach) as the coach
    try {
      const clerk = await clerkClient();
      const memberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: program.organizationId,
        limit: 100,
      });
      
      // Find org:admin (super_coach)
      for (const membership of memberships.data) {
        if (membership.role === 'org:admin') {
          coachId = membership.publicUserData?.userId || null;
          break;
        }
      }
      
      if (coachId) {
        console.log(`[PROGRAM_ENROLL] coachInSquads: Assigning org admin ${coachId} as coach for Squad ${squadNumber}`);
      }
    } catch (err) {
      console.error(`[PROGRAM_ENROLL] Failed to get org admin for coachInSquads:`, err);
    }
  }
  
  const now = new Date().toISOString();
  const squadData: Omit<Squad, 'id'> = {
    name: squadName,
    description: `Squad for ${program.name} (${cohort.name})`,
    avatarUrl: program.coverImageUrl || '',
    visibility: 'private',
    timezone: 'UTC',
    memberIds: [],
    inviteCode,
    hasCoach: true, // Program squads always have coach scheduling
    coachId,
    organizationId: program.organizationId,
    programId: program.id,
    cohortId: cohort.id,
    capacity: squadCapacity,
    isAutoCreated: true,
    squadNumber,
    createdAt: now,
    updatedAt: now,
  };

  const squadRef = await adminDb.collection('squads').add(squadData);
  
  // Create Stream Chat channel for the squad
  try {
    const streamClient = await getStreamServerClient();
    const channelId = `squad-${squadRef.id}`;
    
    const channel = streamClient.channel('messaging', channelId, {
      name: squadName,
      image: program.coverImageUrl || undefined,
      squad_id: squadRef.id,
      created_by_id: userId,
    } as Record<string, unknown>);
    await channel.create();
    
    // Update squad with chat channel ID
    await squadRef.update({ chatChannelId: channelId });
    
    console.log(`[PROGRAM_ENROLL] Created squad ${squadRef.id} with chat channel ${channelId}`);
  } catch (chatError) {
    console.error(`[PROGRAM_ENROLL] Failed to create chat channel for squad ${squadRef.id}:`, chatError);
  }

  return squadRef.id;
}

/**
 * Add user to squad
 */
async function addUserToSquad(
  userId: string,
  squadId: string,
  clerkUser: { firstName?: string | null; lastName?: string | null; imageUrl?: string }
): Promise<void> {
  const now = new Date().toISOString();
  
  // Update squad memberIds (arrayUnion is idempotent - won't duplicate)
  await adminDb.collection('squads').doc(squadId).update({
    memberIds: FieldValue.arrayUnion(userId),
    updatedAt: now,
  });

  // Check if squadMember record already exists to prevent duplicates
  const existingMember = await adminDb
    .collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (!existingMember.empty) {
    console.log(`[PROGRAM_ENROLL] SquadMember record already exists for user ${userId} in squad ${squadId}`);
    return;
  }

  // Create squad member record
  await adminDb.collection('squadMembers').add({
    squadId,
    userId,
    roleInSquad: 'member',
    firstName: clerkUser.firstName || '',
    lastName: clerkUser.lastName || '',
    imageUrl: clerkUser.imageUrl || '',
    createdAt: now,
    updatedAt: now,
  });

  // Add user to squad chat
  try {
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    const chatChannelId = squadDoc.data()?.chatChannelId;
    
    if (chatChannelId) {
      const streamClient = await getStreamServerClient();
      
      // Upsert user in Stream
      await streamClient.upsertUser({
        id: userId,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
        image: clerkUser.imageUrl,
      });
      
      // Add to channel
      const channel = streamClient.channel('messaging', chatChannelId);
      await channel.addMembers([userId]);
      
      console.log(`[PROGRAM_ENROLL] Added user ${userId} to squad chat ${chatChannelId}`);
    }
  } catch (chatError) {
    console.error(`[PROGRAM_ENROLL] Failed to add user to squad chat:`, chatError);
  }
}

/**
 * Create coaching relationship for individual programs
 */
async function createCoachingRelationship(
  userId: string,
  program: Program,
  clerkUser: { firstName?: string | null; lastName?: string | null; imageUrl?: string; email?: string }
): Promise<void> {
  const now = new Date().toISOString();

  // Get organization owner (coach) ID
  const clerk = await clerkClient();
  const org = await clerk.organizations.getOrganization({ 
    organizationId: program.organizationId 
  });
  
  // Get the super_coach (org owner) as the coach
  const memberships = await clerk.organizations.getOrganizationMembershipList({
    organizationId: program.organizationId,
    limit: 100,
  });
  
  let coachId: string | null = null;
  for (const membership of memberships.data) {
    if (membership.role === 'org:admin') {
      coachId = membership.publicUserData?.userId || null;
      break;
    }
  }

  if (!coachId) {
    console.warn(`[PROGRAM_ENROLL] No coach found for organization ${program.organizationId}`);
    return;
  }

  // Create 1:1 chat channel
  let chatChannelId: string | null = null;
  try {
    const streamClient = await getStreamServerClient();
    chatChannelId = `coaching-${userId}-${coachId}`;
    
    // Upsert both users
    const coachClerkUser = await clerk.users.getUser(coachId);
    await streamClient.upsertUsers([
      {
        id: userId,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Client',
        image: clerkUser.imageUrl,
      },
      {
        id: coachId,
        name: `${coachClerkUser.firstName || ''} ${coachClerkUser.lastName || ''}`.trim() || 'Coach',
        image: coachClerkUser.imageUrl,
      },
    ]);

    const channel = streamClient.channel('messaging', chatChannelId, {
      members: [userId, coachId],
      created_by_id: userId,
      name: `${clerkUser.firstName || 'Client'} - Coaching`,
    } as Record<string, unknown>);
    await channel.create();
    
    console.log(`[PROGRAM_ENROLL] Created coaching chat channel ${chatChannelId}`);
  } catch (chatError) {
    console.error(`[PROGRAM_ENROLL] Failed to create coaching chat:`, chatError);
  }

  // Create coaching data record with organizationId for multi-tenancy
  const coachingDocId = `${program.organizationId}_${userId}`;
  const coachingData: Omit<ClientCoachingData, 'id'> = {
    userId,
    organizationId: program.organizationId,
    coachId,
    coachingPlan: 'monthly', // Default
    startDate: now.split('T')[0],
    focusAreas: [],
    actionItems: [],
    nextCall: {
      datetime: null,
      timezone: 'America/New_York',
      location: 'Chat',
    },
    sessionHistory: [],
    resources: [],
    privateNotes: [],
    chatChannelId: chatChannelId || undefined,
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection('clientCoachingData').doc(coachingDocId).set(coachingData);

  // Update user with coach assignment
  await adminDb.collection('users').doc(userId).update({
    coachId,
    updatedAt: now,
  });

  console.log(`[PROGRAM_ENROLL] Created coaching relationship: user ${userId} with coach ${coachId}`);
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { programId, cohortId, discountCode, joinCommunity } = body as { 
      programId: string; 
      cohortId?: string;
      discountCode?: string;
      joinCommunity?: boolean;
    };

    if (!programId) {
      return NextResponse.json({ error: 'Program ID is required' }, { status: 400 });
    }

    // Get program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = { id: programDoc.id, ...programDoc.data() } as Program;

    if (!program.isActive || !program.isPublished) {
      return NextResponse.json({ error: 'Program is not available' }, { status: 400 });
    }

    // Get cohort for group programs
    let cohort: ProgramCohort | null = null;
    if (program.type === 'group') {
      if (!cohortId) {
        return NextResponse.json({ error: 'Cohort ID is required for group programs' }, { status: 400 });
      }

      const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
      if (!cohortDoc.exists || cohortDoc.data()?.programId !== programId) {
        return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
      }

      cohort = { id: cohortDoc.id, ...cohortDoc.data() } as ProgramCohort;

      if (!cohort.enrollmentOpen) {
        return NextResponse.json({ error: 'Enrollment is closed for this cohort' }, { status: 400 });
      }

      // Check max enrollment
      if (cohort.maxEnrollment && cohort.currentEnrollment >= cohort.maxEnrollment) {
        return NextResponse.json({ error: 'Cohort is full' }, { status: 400 });
      }
    }

    // Check enrollment constraints
    const existingEnrollments = await adminDb
      .collection('program_enrollments')
      .where('userId', '==', userId)
      .where('status', 'in', ['active', 'upcoming'])
      .get();

    // Check if already enrolled in this program
    const existingInProgram = existingEnrollments.docs.find(
      d => d.data().programId === programId
    );
    if (existingInProgram) {
      return NextResponse.json({ error: 'Already enrolled in this program' }, { status: 400 });
    }

    // Check type constraints (max 1 active group, max 1 active individual)
    for (const doc of existingEnrollments.docs) {
      const enrollment = doc.data() as ProgramEnrollment;
      if (enrollment.status === 'active') {
        const enrolledProgramDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
        const enrolledProgram = enrolledProgramDoc.data() as Program | undefined;
        
        if (enrolledProgram?.type === program.type) {
          return NextResponse.json({ 
            error: `You already have an active ${program.type} program` 
          }, { status: 400 });
        }
      }
    }

    // Get user info from Clerk
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    // Get organization settings for Stripe Connect and discounts
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(program.organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    // Calculate final price after discounts
    let finalPrice = program.priceInCents;
    let discountAmountCents = 0;
    let appliedDiscountCode: DiscountCode | null = null;

    if (discountCode && program.priceInCents > 0) {
      const discountResult = await validateAndApplyDiscount(
        discountCode,
        userId,
        program.organizationId,
        programId,
        undefined, // squadId
        program.priceInCents,
        orgSettings
      );
      
      if (discountResult.valid) {
        discountAmountCents = discountResult.discountAmountCents;
        finalPrice = discountResult.finalAmountCents;
        appliedDiscountCode = discountResult.discountCode || null;
      } else if (discountResult.error && discountCode.toUpperCase() !== 'ALUMNI') {
        // Only return error for explicit discount codes, not silent alumni check
        return NextResponse.json({ error: discountResult.error }, { status: 400 });
      }
    }

    // If program is free (or fully discounted), create enrollment directly
    if (finalPrice === 0) {
      // Record discount usage if a code was applied
      if (appliedDiscountCode) {
        await recordDiscountUsage(
          appliedDiscountCode.id,
          userId,
          program.organizationId,
          programId,
          undefined,
          program.priceInCents,
          discountAmountCents,
          finalPrice
        );
      }
      return await createEnrollment(userId, program, cohort, clerkUser);
    }

    // For paid programs, create Stripe checkout session
    const stripe = getStripe();

    const stripeConnectAccountId = orgSettings?.stripeConnectAccountId;
    if (!stripeConnectAccountId) {
      return NextResponse.json({ 
        error: 'Payment is not configured for this program' 
      }, { status: 400 });
    }

    // Calculate platform fee based on final discounted price
    const platformFeePercent = orgSettings?.platformFeePercent ?? 1;
    const applicationFeeAmount = Math.round(finalPrice * (platformFeePercent / 100));

    // Build success/cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/programs/enrollment-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/discover/programs/${programId}?checkout=canceled`;

    // Build line item description including discount info
    let description = cohort 
      ? `${program.name} - ${cohort.name} (${program.lengthDays} days)`
      : `${program.name} (${program.lengthDays} days)`;
    
    if (discountAmountCents > 0) {
      const originalFormatted = (program.priceInCents / 100).toFixed(2);
      const discountFormatted = (discountAmountCents / 100).toFixed(2);
      description += ` (Originally $${originalFormatted}, -$${discountFormatted} discount)`;
    }

    // Create Stripe checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: program.currency || 'usd',
            product_data: {
              name: program.name,
              description,
              images: program.coverImageUrl ? [program.coverImageUrl] : undefined,
            },
            unit_amount: finalPrice, // Use discounted price
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        metadata: {
          userId,
          programId,
          cohortId: cohortId || '',
          programType: program.type,
          organizationId: program.organizationId,
          discountCodeId: appliedDiscountCode?.id || '',
          originalAmountCents: String(program.priceInCents),
          discountAmountCents: String(discountAmountCents),
          joinCommunity: joinCommunity !== false ? 'true' : 'false',
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: clerkUser.emailAddresses[0]?.emailAddress,
      metadata: {
        userId,
        programId,
        cohortId: cohortId || '',
        programType: program.type,
        organizationId: program.organizationId,
        type: 'program_enrollment',
        discountCodeId: appliedDiscountCode?.id || '',
        joinCommunity: joinCommunity !== false ? 'true' : 'false',
      },
    };

    const session = await stripe.checkout.sessions.create(
      sessionParams,
      { stripeAccount: stripeConnectAccountId }
    );

    console.log(`[PROGRAM_ENROLL] Created Stripe checkout session ${session.id} for user ${userId}, program ${programId}`);

    return NextResponse.json({ 
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('[PROGRAM_ENROLL] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process enrollment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Create enrollment (for free programs or after payment)
 */
async function createEnrollment(
  userId: string,
  program: Program,
  cohort: ProgramCohort | null,
  clerkUser: { 
    firstName?: string | null; 
    lastName?: string | null; 
    imageUrl?: string;
    emailAddresses?: Array<{ emailAddress: string }>;
  }
): Promise<NextResponse> {
  const now = new Date().toISOString();
  
  // Determine start date
  let startedAt: string;
  let status: 'upcoming' | 'active';
  
  if (cohort) {
    // Group program - start on cohort start date
    const cohortStart = new Date(cohort.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (cohortStart > today) {
      startedAt = cohort.startDate;
      status = 'upcoming';
    } else {
      startedAt = now.split('T')[0];
      status = 'active';
    }
  } else {
    // Individual program - start today or tomorrow based on time
    const hour = new Date().getHours();
    if (hour < 12) {
      startedAt = now.split('T')[0];
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      startedAt = tomorrow.toISOString().split('T')[0];
    }
    status = 'active';
  }

  // Find or create squad for group programs
  let squadId: string | null = null;
  if (program.type === 'group' && cohort) {
    squadId = await findOrCreateSquad(program, cohort, userId);
    await addUserToSquad(userId, squadId, clerkUser);
  }

  // Create enrollment
  const enrollmentData: Omit<ProgramEnrollment, 'id'> = {
    userId,
    programId: program.id,
    organizationId: program.organizationId,
    cohortId: cohort?.id || null,
    squadId,
    amountPaid: program.priceInCents,
    paidAt: program.priceInCents > 0 ? now : undefined,
    status,
    startedAt,
    lastAssignedDayIndex: 0,
    createdAt: now,
    updatedAt: now,
  };

  const enrollmentRef = await adminDb.collection('program_enrollments').add(enrollmentData);

  // Update cohort enrollment count
  if (cohort) {
    await adminDb.collection('program_cohorts').doc(cohort.id).update({
      currentEnrollment: FieldValue.increment(1),
      updatedAt: now,
    });
  }

  // For individual programs, create coaching relationship
  if (program.type === 'individual') {
    await createCoachingRelationship(userId, program, {
      ...clerkUser,
      email: clerkUser.emailAddresses?.[0]?.emailAddress,
    });
    
    // Add to client community squad if enabled and user opted in
    if (program.clientCommunitySquadId && joinCommunity !== false) {
      try {
        await addUserToSquad(userId, program.clientCommunitySquadId, clerkUser);
        
        // Update enrollment record with joinedCommunity flag
        await adminDb.collection('program_enrollments').doc(enrollmentRef.id).update({
          joinedCommunity: true,
        });
        
        console.log(`[PROGRAM_ENROLL] Added user ${userId} to client community squad ${program.clientCommunitySquadId}`);
      } catch (communityError) {
        console.error(`[PROGRAM_ENROLL] Failed to add user to community squad:`, communityError);
        // Don't fail enrollment if community join fails
      }
    }
  }

  console.log(`[PROGRAM_ENROLL] Created enrollment ${enrollmentRef.id} for user ${userId} in program ${program.id}`);

  return NextResponse.json({
    success: true,
    enrollmentId: enrollmentRef.id,
    squadId,
    status,
    startedAt,
    message: status === 'upcoming' 
      ? `Enrolled! Program starts on ${cohort?.startDate}`
      : 'Enrolled! Your program starts now',
  }, { status: 201 });
}

/**
 * Validate and apply discount code
 */
interface DiscountValidationResult {
  valid: boolean;
  discountAmountCents: number;
  finalAmountCents: number;
  discountCode?: DiscountCode;
  error?: string;
  isAlumniDiscount?: boolean;
}

async function validateAndApplyDiscount(
  code: string,
  userId: string,
  organizationId: string,
  programId: string | undefined,
  squadId: string | undefined,
  originalAmountCents: number,
  orgSettings: OrgSettings | undefined
): Promise<DiscountValidationResult> {
  const normalizedCode = code.trim().toUpperCase();

  // Check for alumni auto-discount
  if (normalizedCode === 'ALUMNI') {
    if (!orgSettings?.alumniDiscountEnabled || !orgSettings.alumniDiscountValue) {
      return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'Alumni discount is not available' };
    }

    // Check if user is alumni
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists || !userDoc.data()?.isAlumni) {
      return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'Alumni discount is only available to program alumni' };
    }

    // Calculate discount
    let discountAmountCents: number;
    if (orgSettings.alumniDiscountType === 'percentage') {
      discountAmountCents = Math.round(originalAmountCents * (orgSettings.alumniDiscountValue / 100));
    } else {
      discountAmountCents = Math.min(orgSettings.alumniDiscountValue, originalAmountCents);
    }

    return {
      valid: true,
      discountAmountCents,
      finalAmountCents: Math.max(0, originalAmountCents - discountAmountCents),
      isAlumniDiscount: true,
    };
  }

  // Look up discount code
  const codeSnapshot = await adminDb
    .collection('discount_codes')
    .where('organizationId', '==', organizationId)
    .where('code', '==', normalizedCode)
    .limit(1)
    .get();

  if (codeSnapshot.empty) {
    return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'Invalid discount code' };
  }

  const codeDoc = codeSnapshot.docs[0];
  const discountCode = {
    id: codeDoc.id,
    ...codeDoc.data(),
  } as DiscountCode;

  // Validate constraints
  if (!discountCode.isActive) {
    return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'This discount code is no longer active' };
  }
  if (discountCode.startsAt && new Date(discountCode.startsAt) > new Date()) {
    return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'This discount code is not yet active' };
  }
  if (discountCode.expiresAt && new Date(discountCode.expiresAt) < new Date()) {
    return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'This discount code has expired' };
  }
  if (discountCode.maxUses !== null && discountCode.maxUses !== undefined && discountCode.useCount >= discountCode.maxUses) {
    return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'This discount code has reached its maximum uses' };
  }

  // Check per-user limit
  if (discountCode.maxUsesPerUser) {
    const userUsages = await adminDb
      .collection('discount_code_usages')
      .where('discountCodeId', '==', discountCode.id)
      .where('userId', '==', userId)
      .count()
      .get();

    if (userUsages.data().count >= discountCode.maxUsesPerUser) {
      return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'You have already used this discount code' };
    }
  }

  // Check applicability
  if (discountCode.applicableTo === 'programs' && !programId) {
    return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'This discount code is only valid for programs' };
  }
  if (discountCode.applicableTo === 'squads' && !squadId) {
    return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'This discount code is only valid for squads' };
  }
  if (programId && discountCode.programIds?.length && !discountCode.programIds.includes(programId)) {
    return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'This discount code is not valid for this program' };
  }
  if (squadId && discountCode.squadIds?.length && !discountCode.squadIds.includes(squadId)) {
    return { valid: false, discountAmountCents: 0, finalAmountCents: originalAmountCents, error: 'This discount code is not valid for this squad' };
  }

  // Calculate discount
  let discountAmountCents: number;
  if (discountCode.type === 'percentage') {
    discountAmountCents = Math.round(originalAmountCents * (discountCode.value / 100));
  } else {
    discountAmountCents = Math.min(discountCode.value, originalAmountCents);
  }

  return {
    valid: true,
    discountAmountCents,
    finalAmountCents: Math.max(0, originalAmountCents - discountAmountCents),
    discountCode,
  };
}

/**
 * Record discount code usage for analytics
 */
async function recordDiscountUsage(
  discountCodeId: string,
  userId: string,
  organizationId: string,
  programId: string | undefined,
  squadId: string | undefined,
  originalAmountCents: number,
  discountAmountCents: number,
  finalAmountCents: number
): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    // Record usage
    await adminDb.collection('discount_code_usages').add({
      discountCodeId,
      userId,
      organizationId,
      programId: programId || null,
      squadId: squadId || null,
      originalAmountCents,
      discountAmountCents,
      finalAmountCents,
      createdAt: now,
    });

    // Increment use count
    await adminDb.collection('discount_codes').doc(discountCodeId).update({
      useCount: FieldValue.increment(1),
      updatedAt: now,
    });

    console.log(`[PROGRAM_ENROLL] Recorded discount usage for code ${discountCodeId}, user ${userId}`);
  } catch (error) {
    console.error('[PROGRAM_ENROLL] Error recording discount usage:', error);
    // Don't throw - discount still applied successfully
  }
}

