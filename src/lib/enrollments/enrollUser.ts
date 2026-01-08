/**
 * Shared enrollment helper for programs, squads, and future products
 * 
 * Consolidates enrollment logic used by:
 * - Funnel completion
 * - Upsell/downsell purchases
 * - Direct enrollment APIs
 */

import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { FieldValue } from 'firebase-admin/firestore';
import { syncAllProgramTasks } from '@/lib/program-engine';
import type { 
  UpsellProductType, 
  ProgramEnrollment, 
  Squad, 
  Program,
  ProgramCohort,
} from '@/types';

// Re-export the type for convenience
export type { UpsellProductType };

interface ClerkUserInfo {
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string;
  email?: string;
}

export interface EnrollmentResult {
  success: boolean;
  enrollmentId?: string;
  error?: string;
}

export interface EnrollProgramOptions {
  cohortId?: string;
  squadId?: string;
  stripePaymentIntentId?: string;
  amountPaid?: number;
  startDate?: string;
  joinCommunity?: boolean;
}

export interface EnrollSquadOptions {
  roleInSquad?: 'member' | 'admin' | 'mentor' | 'coach';
}

/**
 * Enroll a user in a product (program, squad, or future products)
 */
export async function enrollUserInProduct(
  userId: string,
  productType: UpsellProductType,
  productId: string,
  userInfo: ClerkUserInfo,
  options?: EnrollProgramOptions | EnrollSquadOptions
): Promise<EnrollmentResult> {
  try {
    switch (productType) {
      case 'program':
        return await enrollInProgram(userId, productId, userInfo, options as EnrollProgramOptions);
      case 'squad':
        return await enrollInSquad(userId, productId, userInfo, options as EnrollSquadOptions);
      case 'course':
        return await enrollInCourse(userId, productId);
      case 'article':
        return await grantContentAccess(userId, productId, 'article');
      case 'content':
        return await grantContentAccess(userId, productId, 'content');
      default:
        return { success: false, error: `Unknown product type: ${productType}` };
    }
  } catch (error) {
    console.error(`[ENROLL_USER] Error enrolling user ${userId} in ${productType} ${productId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Enrollment failed' 
    };
  }
}

/**
 * Enroll user in a program
 */
async function enrollInProgram(
  userId: string,
  programId: string,
  userInfo: ClerkUserInfo,
  options?: EnrollProgramOptions
): Promise<EnrollmentResult> {
  const now = new Date().toISOString();
  
  // Get program details
  const programDoc = await adminDb.collection('programs').doc(programId).get();
  if (!programDoc.exists) {
    return { success: false, error: 'Program not found' };
  }
  const program = { id: programDoc.id, ...programDoc.data() } as Program;

  // Check for existing enrollment
  const existingEnrollment = await adminDb
    .collection('program_enrollments')
    .where('userId', '==', userId)
    .where('programId', '==', programId)
    .where('status', 'in', ['active', 'upcoming'])
    .limit(1)
    .get();

  if (!existingEnrollment.empty) {
    // Already enrolled - return existing enrollment ID
    return { 
      success: true, 
      enrollmentId: existingEnrollment.docs[0].id 
    };
  }

  // Determine cohort assignment for group programs
  let cohortId = options?.cohortId || null;
  let squadId = options?.squadId || null;
  
  if (program.type === 'group' && !cohortId) {
    // Find the best available cohort:
    // 1. Enrollment must be open
    // 2. Status must be upcoming or active
    // 3. End date must be in the future (if set)
    // 4. Prefer cohorts with future start dates over already-started ones
    const cohortsSnapshot = await adminDb
      .collection('program_cohorts')
      .where('programId', '==', programId)
      .where('enrollmentOpen', '==', true)
      .where('status', 'in', ['upcoming', 'active'])
      .orderBy('startDate', 'asc')
      .limit(10) // Get a few to filter by end date
      .get();

    const now = new Date();
    let selectedCohort: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    // First pass: try to find an upcoming cohort (start date in future)
    for (const doc of cohortsSnapshot.docs) {
      const cohort = doc.data() as ProgramCohort;
      
      // Skip if cohort has ended
      if (cohort.endDate && new Date(cohort.endDate) < now) {
        continue;
      }

      // Prefer upcoming cohorts (start date in future)
      if (cohort.status === 'upcoming' && new Date(cohort.startDate) > now) {
        selectedCohort = doc;
        break;
      }

      // Fall back to active cohort if no upcoming found
      if (!selectedCohort && cohort.status === 'active') {
        selectedCohort = doc;
      }
    }

    if (selectedCohort) {
      cohortId = selectedCohort.id;
      console.log(`[enrollUser] Selected cohort ${cohortId} for program ${programId}`);

      // Update cohort enrollment count
      await selectedCohort.ref.update({
        currentEnrollment: FieldValue.increment(1),
      });
    } else {
      console.warn(`[enrollUser] No valid cohort found for group program ${programId}`);
    }
  }

  // Find or create squad for group programs
  if (program.type === 'group' && cohortId && !squadId) {
    squadId = await findOrCreateSquadForProgram(program, cohortId, userId);
  }

  // Determine start date and status
  let startedAt = options?.startDate || now;
  let status: 'active' | 'upcoming' = 'active';

  if (cohortId) {
    const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
    if (cohortDoc.exists) {
      const cohortData = cohortDoc.data() as ProgramCohort;
      if (cohortData.startDate && new Date(cohortData.startDate) > new Date()) {
        status = 'upcoming';
        startedAt = cohortData.startDate;
      }
    }
  }

  // Create enrollment
  const enrollmentData: Omit<ProgramEnrollment, 'id'> = {
    userId,
    programId,
    organizationId: program.organizationId,
    cohortId,
    squadId,
    amountPaid: options?.amountPaid || 0,
    status,
    startedAt,
    lastAssignedDayIndex: 0,
    createdAt: now,
    updatedAt: now,
    ...(options?.stripePaymentIntentId && { 
      stripePaymentIntentId: options.stripePaymentIntentId, 
      paidAt: now 
    }),
  };

  const enrollmentRef = await adminDb.collection('program_enrollments').add(enrollmentData);

  // Add user to squad if assigned
  if (squadId) {
    await addUserToSquadInternal(userId, squadId, userInfo);
  }

  // Update user record
  await adminDb.collection('users').doc(userId).set({
    organizationId: program.organizationId,
    currentProgramEnrollmentId: enrollmentRef.id,
    currentProgramId: programId,
    updatedAt: now,
  }, { merge: true });

  console.log(`[ENROLL_USER] Enrolled user ${userId} in program ${programId}, enrollment ${enrollmentRef.id}`);

  // Sync ALL program tasks in background if enrollment is active
  // This ensures entire program tasks are synced immediately without blocking response
  if (status === 'active') {
    // Fire-and-forget: run sync in background without blocking response
    setImmediate(async () => {
      try {
        console.log(`[ENROLL_USER] Starting background sync of all tasks for enrollment ${enrollmentRef.id}`);
        const syncResult = await syncAllProgramTasks({
          userId,
          enrollmentId: enrollmentRef.id,
          mode: 'fill-empty',
        });
        console.log(`[ENROLL_USER] Background sync completed:`, {
          enrollmentId: enrollmentRef.id,
          tasksCreated: syncResult.tasksCreated,
          daysProcessed: syncResult.daysProcessed,
          totalDays: syncResult.totalDays,
        });
      } catch (syncError) {
        console.error(`[ENROLL_USER] Background sync failed for enrollment ${enrollmentRef.id}:`, syncError);
      }
    });
  }

  return { success: true, enrollmentId: enrollmentRef.id };
}

/**
 * Enroll user in a squad (standalone squad membership)
 */
async function enrollInSquad(
  userId: string,
  squadId: string,
  userInfo: ClerkUserInfo,
  options?: EnrollSquadOptions
): Promise<EnrollmentResult> {
  const now = new Date().toISOString();

  // Get squad details
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  if (!squadDoc.exists) {
    return { success: false, error: 'Squad not found' };
  }
  const squad = { id: squadDoc.id, ...squadDoc.data() } as Squad;

  // Check if already a member
  const existingMember = await adminDb
    .collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (!existingMember.empty) {
    return { success: true, enrollmentId: existingMember.docs[0].id };
  }

  // Check capacity
  const memberIds = squad.memberIds || [];
  if (memberIds.length >= (squad.capacity || 12)) {
    return { success: false, error: 'Squad is at capacity' };
  }

  // Add to squad
  await addUserToSquadInternal(userId, squadId, userInfo, options?.roleInSquad);

  // Update user's squadIds
  await adminDb.collection('users').doc(userId).set({
    squadIds: FieldValue.arrayUnion(squadId),
    squadId, // Legacy field
    updatedAt: now,
  }, { merge: true });

  console.log(`[ENROLL_USER] Added user ${userId} to squad ${squadId}`);
  
  return { success: true, enrollmentId: squadId };
}

/**
 * Enroll user in a course (future implementation)
 */
async function enrollInCourse(
  userId: string,
  courseId: string
): Promise<EnrollmentResult> {
  const now = new Date().toISOString();

  // Check for existing access
  const existingAccess = await adminDb
    .collection('course_enrollments')
    .where('userId', '==', userId)
    .where('courseId', '==', courseId)
    .limit(1)
    .get();

  if (!existingAccess.empty) {
    return { success: true, enrollmentId: existingAccess.docs[0].id };
  }

  // Create course enrollment
  const enrollmentRef = await adminDb.collection('course_enrollments').add({
    userId,
    courseId,
    status: 'active',
    progress: 0,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[ENROLL_USER] Enrolled user ${userId} in course ${courseId}`);
  
  return { success: true, enrollmentId: enrollmentRef.id };
}

/**
 * Grant user access to premium content (articles and other gated content)
 * @param contentType - Type of content (e.g., 'article', 'content')
 */
async function grantContentAccess(
  userId: string,
  contentId: string,
  contentType: 'article' | 'content' = 'content'
): Promise<EnrollmentResult> {
  const now = new Date().toISOString();

  // Check for existing access
  const existingAccess = await adminDb
    .collection('content_access')
    .where('userId', '==', userId)
    .where('contentId', '==', contentId)
    .limit(1)
    .get();

  if (!existingAccess.empty) {
    return { success: true, enrollmentId: existingAccess.docs[0].id };
  }

  // Grant content access
  const accessRef = await adminDb.collection('content_access').add({
    userId,
    contentId,
    contentType, // Store the type for proper tracking
    grantedAt: now,
    createdAt: now,
  });

  console.log(`[ENROLL_USER] Granted user ${userId} access to ${contentType} ${contentId}`);
  
  return { success: true, enrollmentId: accessRef.id };
}

/**
 * Internal helper to add user to squad
 */
async function addUserToSquadInternal(
  userId: string,
  squadId: string,
  userInfo: ClerkUserInfo,
  roleInSquad: 'member' | 'admin' | 'mentor' | 'coach' = 'member'
): Promise<void> {
  const now = new Date().toISOString();

  // Update squad memberIds
  await adminDb.collection('squads').doc(squadId).update({
    memberIds: FieldValue.arrayUnion(userId),
    updatedAt: now,
  });

  // Check if squadMember record already exists
  const existingMember = await adminDb
    .collection('squadMembers')
    .where('squadId', '==', squadId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (existingMember.empty) {
    // Create squad member record
    await adminDb.collection('squadMembers').add({
      squadId,
      userId,
      roleInSquad,
      firstName: userInfo.firstName || '',
      lastName: userInfo.lastName || '',
      imageUrl: userInfo.imageUrl || '',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Add to Stream Chat channel
  const squadDoc = await adminDb.collection('squads').doc(squadId).get();
  const squad = squadDoc.data() as Squad;
  
  if (squad?.chatChannelId) {
    try {
      const streamClient = await getStreamServerClient();
      const channel = streamClient.channel('messaging', squad.chatChannelId);
      await channel.addMembers([userId]);
    } catch (chatError) {
      console.error(`[ENROLL_USER] Failed to add user to chat channel:`, chatError);
      // Non-fatal - user is still enrolled
    }
  }
}

/**
 * Find or create a squad for a program cohort
 */
async function findOrCreateSquadForProgram(
  program: Program,
  cohortId: string,
  userId: string
): Promise<string> {
  const SQUAD_CAPACITY = 12;
  const now = new Date().toISOString();

  // Get cohort details
  const cohortDoc = await adminDb.collection('program_cohorts').doc(cohortId).get();
  const cohort = cohortDoc.exists ? cohortDoc.data() as ProgramCohort : null;

  // Find existing squad with space
  const squadsSnapshot = await adminDb
    .collection('squads')
    .where('programId', '==', program.id)
    .where('cohortId', '==', cohortId)
    .get();

  for (const squadDoc of squadsSnapshot.docs) {
    const squad = squadDoc.data() as Squad;
    const memberCount = squad.memberIds?.length || 0;
    const capacity = squad.capacity || SQUAD_CAPACITY;
    
    if (memberCount < capacity) {
      return squadDoc.id;
    }
  }

  // Create new squad
  const squadNumber = squadsSnapshot.size + 1;
  const squadName = cohort?.name 
    ? `${cohort.name} - Squad ${squadNumber}`
    : `${program.name} Squad ${squadNumber}`;

  const squadData: Omit<Squad, 'id'> = {
    name: squadName,
    avatarUrl: program.coverImageUrl || '',
    memberIds: [],
    coachId: null, // Program squads don't have a direct coach
    organizationId: program.organizationId,
    programId: program.id,
    cohortId,
    capacity: SQUAD_CAPACITY,
    isAutoCreated: true,
    squadNumber,
    createdAt: now,
    updatedAt: now,
  };

  const squadRef = await adminDb.collection('squads').add(squadData);

  // Create Stream Chat channel
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
    
    await squadRef.update({ chatChannelId: channelId });
    console.log(`[ENROLL_USER] Created squad ${squadRef.id} with chat channel ${channelId}`);
  } catch (chatError) {
    console.error(`[ENROLL_USER] Failed to create chat channel:`, chatError);
  }

  return squadRef.id;
}

