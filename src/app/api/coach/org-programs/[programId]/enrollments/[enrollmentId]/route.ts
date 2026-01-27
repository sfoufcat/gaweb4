/**
 * Coach API: Manage Single Program Enrollment
 *
 * GET /api/coach/org-programs/[programId]/enrollments/[enrollmentId] - Get enrollment details
 * DELETE /api/coach/org-programs/[programId]/enrollments/[enrollmentId] - Remove user from program
 *
 * When a coach removes a user:
 * 1. Enrollment status is set to 'stopped'
 * 2. User is removed from squad memberIds
 * 3. User is removed from Stream chat channel (loses chat access entirely)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isUserOrgAdmin } from '@/lib/clerk-organizations';
import { removeUserFromSquadEntirely, syncAllProgramTasks } from '@/lib/program-engine';
import { ensureCohortInstanceExists, ensureEnrollmentInstanceExists } from '@/lib/program-instances';
import type { ProgramEnrollment, Program } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; enrollmentId: string }> }
) {
  try {
    const { userId } = await auth();
    const { programId, enrollmentId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Coach features require tenant domain' }, { status: 403 });
    }

    // Verify user is an admin (coach) of the organization
    const isCoach = await isUserOrgAdmin(userId, organizationId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Not authorized - coaches only' }, { status: 403 });
    }

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data() as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program does not belong to your organization' }, { status: 403 });
    }

    // Get the enrollment
    const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

    // Verify enrollment is for this program
    if (enrollment.programId !== programId) {
      return NextResponse.json({ error: 'Enrollment does not belong to this program' }, { status: 400 });
    }

    // Get user info
    let user = null;
    try {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(enrollment.userId);
      user = {
        id: clerkUser.id,
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        imageUrl: clerkUser.imageUrl || '',
      };
    } catch {
      // User might not exist in Clerk anymore
    }

    return NextResponse.json({
      enrollment: {
        ...enrollment,
        user,
      },
    });
  } catch (error) {
    console.error('[COACH_ENROLLMENT_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollment' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; enrollmentId: string }> }
) {
  try {
    const { userId } = await auth();
    const { programId, enrollmentId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Coach features require tenant domain' }, { status: 403 });
    }

    // Verify user is an admin (coach) of the organization
    const isCoach = await isUserOrgAdmin(userId, organizationId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Not authorized - coaches only' }, { status: 403 });
    }

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data() as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program does not belong to your organization' }, { status: 403 });
    }

    // Get the enrollment
    const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

    // Verify enrollment is for this program
    if (enrollment.programId !== programId) {
      return NextResponse.json({ error: 'Enrollment does not belong to this program' }, { status: 400 });
    }

    // Check if already stopped
    if (enrollment.status === 'stopped') {
      return NextResponse.json({ error: 'Enrollment is already stopped' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const enrolledUserId = enrollment.userId;

    // 1. Update enrollment status to 'stopped'
    await enrollmentDoc.ref.update({
      status: 'stopped',
      stoppedAt: now,
      stoppedBy: userId, // Track who removed them
      stoppedReason: 'removed_by_coach',
      updatedAt: now,
    });

    // 2. Remove user from squad entirely (both memberIds and Stream chat)
    if (enrollment.squadId) {
      try {
        await removeUserFromSquadEntirely(enrolledUserId, enrollment.squadId);
        console.log(`[COACH_ENROLLMENT_DELETE] Removed user ${enrolledUserId} from squad ${enrollment.squadId}`);
      } catch (squadErr) {
        console.error(`[COACH_ENROLLMENT_DELETE] Failed to remove from squad (non-fatal):`, squadErr);
        // Continue - enrollment is already stopped
      }
    }

    // 2a. For individual programs with client community, remove from community squad
    // Individual programs don't store squadId on enrollment - they use clientCommunitySquadId on the program
    if (program.type === 'individual' && program.clientCommunitySquadId && enrollment.joinedCommunity) {
      try {
        await removeUserFromSquadEntirely(enrolledUserId, program.clientCommunitySquadId);
        console.log(`[COACH_ENROLLMENT_DELETE] Removed user ${enrolledUserId} from client community squad ${program.clientCommunitySquadId}`);
      } catch (communityErr) {
        console.error(`[COACH_ENROLLMENT_DELETE] Failed to remove from client community squad (non-fatal):`, communityErr);
        // Continue - enrollment is already stopped
      }
    }

    // 2b. Delete future program tasks for this user from this enrollment's instance
    // This prevents phantom tasks from appearing after enrollment is stopped
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Find the instance for this enrollment (cohort or individual)
      let instanceId: string | null = null;

      if (enrollment.cohortId) {
        // Cohort enrollment - find cohort instance
        const cohortInstance = await adminDb
          .collection('program_instances')
          .where('cohortId', '==', enrollment.cohortId)
          .where('type', '==', 'cohort')
          .limit(1)
          .get();
        if (!cohortInstance.empty) {
          instanceId = cohortInstance.docs[0].id;
        }
      } else {
        // Individual enrollment - find individual instance
        const indivInstance = await adminDb
          .collection('program_instances')
          .where('enrollmentId', '==', enrollmentId)
          .where('type', '==', 'individual')
          .limit(1)
          .get();
        if (!indivInstance.empty) {
          instanceId = indivInstance.docs[0].id;
        }
      }

      if (instanceId) {
        // Delete future uncompleted tasks from this instance for this user
        const futureTasks = await adminDb
          .collection('tasks')
          .where('userId', '==', enrolledUserId)
          .where('instanceId', '==', instanceId)
          .where('date', '>=', todayStr)
          .where('completed', '==', false)
          .get();

        if (!futureTasks.empty) {
          const deleteBatch = adminDb.batch();
          futureTasks.docs.forEach(doc => {
            deleteBatch.delete(doc.ref);
          });
          await deleteBatch.commit();
          console.log(`[COACH_ENROLLMENT_DELETE] Deleted ${futureTasks.size} future tasks for user ${enrolledUserId} from instance ${instanceId}`);
        }
      }
    } catch (taskErr) {
      console.error(`[COACH_ENROLLMENT_DELETE] Failed to delete future tasks (non-fatal):`, taskErr);
      // Continue - enrollment is already stopped
    }

    // 3. Clear user's current program reference if this was their active enrollment
    try {
      const userDoc = await adminDb.collection('users').doc(enrolledUserId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.currentProgramEnrollmentId === enrollmentId) {
          await userDoc.ref.update({
            currentProgramEnrollmentId: null,
            currentProgramId: null,
            updatedAt: now,
          });
          console.log(`[COACH_ENROLLMENT_DELETE] Cleared current program reference for user ${enrolledUserId}`);
        }
      }
    } catch (userErr) {
      console.error(`[COACH_ENROLLMENT_DELETE] Failed to clear user reference (non-fatal):`, userErr);
    }

    // 4. Update cohort enrollment count if applicable
    if (enrollment.cohortId) {
      try {
        const { FieldValue } = await import('firebase-admin/firestore');
        await adminDb.collection('program_cohorts').doc(enrollment.cohortId).update({
          currentEnrollment: FieldValue.increment(-1),
        });
      } catch (cohortErr) {
        console.error(`[COACH_ENROLLMENT_DELETE] Failed to update cohort count (non-fatal):`, cohortErr);
      }
    }

    // 5. Delete program-created habits for this user (hard delete since they're kicked out)
    let habitsDeleted = 0;
    try {
      const habitsSnapshot = await adminDb
        .collection('habits')
        .where('userId', '==', enrolledUserId)
        .where('programId', '==', programId)
        .where('source', '==', 'program_default')
        .get();

      if (!habitsSnapshot.empty) {
        const batch = adminDb.batch();
        for (const habitDoc of habitsSnapshot.docs) {
          batch.delete(habitDoc.ref);
        }
        await batch.commit();
        habitsDeleted = habitsSnapshot.size;
        console.log(`[COACH_ENROLLMENT_DELETE] Deleted ${habitsDeleted} program habits for user ${enrolledUserId}`);
      }
    } catch (habitErr) {
      console.error(`[COACH_ENROLLMENT_DELETE] Failed to delete habits (non-fatal):`, habitErr);
    }

    // 6. Delete program-sourced tasks for this user from this enrollment
    let tasksDeleted = 0;
    try {
      // Query tasks by enrollment ID (most reliable) and also by programId as fallback
      const tasksSnapshot = await adminDb
        .collection('tasks')
        .where('userId', '==', enrolledUserId)
        .where('programEnrollmentId', '==', enrollmentId)
        .get();

      if (!tasksSnapshot.empty) {
        // Batch delete in chunks of 500 (Firestore limit)
        const docs = tasksSnapshot.docs;
        for (let i = 0; i < docs.length; i += 500) {
          const batch = adminDb.batch();
          const chunk = docs.slice(i, i + 500);
          for (const taskDoc of chunk) {
            batch.delete(taskDoc.ref);
          }
          await batch.commit();
        }
        tasksDeleted = tasksSnapshot.size;
        console.log(`[COACH_ENROLLMENT_DELETE] Deleted ${tasksDeleted} program tasks for user ${enrolledUserId}`);
      }
    } catch (taskErr) {
      console.error(`[COACH_ENROLLMENT_DELETE] Failed to delete tasks (non-fatal):`, taskErr);
    }

    // 7. For individual programs, clean up coaching relationship data
    if (program.type === 'individual') {
      try {
        const coachingDocId = `${program.organizationId}_${enrolledUserId}`;
        const coachingDoc = await adminDb.collection('clientCoachingData').doc(coachingDocId).get();
        
        if (coachingDoc.exists) {
          // Update coaching data to mark as inactive instead of deleting
          // This preserves history while indicating the relationship is stopped
          await coachingDoc.ref.update({
            status: 'stopped',
            stoppedAt: now,
            updatedAt: now,
          });
          console.log(`[COACH_ENROLLMENT_DELETE] Marked coaching data as stopped for user ${enrolledUserId}`);
        }

        // Update user's coaching flags
        const userDoc = await adminDb.collection('users').doc(enrolledUserId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          // Only clear coaching flags if this user's coach matches the org owner
          if (userData?.coachId) {
            await userDoc.ref.update({
              coaching: false,
              coachingStatus: 'stopped',
              updatedAt: now,
            });
            console.log(`[COACH_ENROLLMENT_DELETE] Updated user coaching status to stopped`);
          }
        }

        // Update org_memberships
        const membershipDocId = `${program.organizationId}_${enrolledUserId}`;
        const membershipDoc = await adminDb.collection('org_memberships').doc(membershipDocId).get();
        if (membershipDoc.exists) {
          await membershipDoc.ref.update({
            coaching: false,
            coachingStatus: 'stopped',
            updatedAt: now,
          });
          console.log(`[COACH_ENROLLMENT_DELETE] Updated org membership coaching status`);
        }

        // Update Clerk user metadata
        try {
          const clerk = await clerkClient();
          const currentUser = await clerk.users.getUser(enrolledUserId);
          const existingMetadata = (currentUser.publicMetadata as Record<string, unknown>) || {};
          
          await clerk.users.updateUserMetadata(enrolledUserId, {
            publicMetadata: {
              ...existingMetadata,
              coaching: false,
              coachingStatus: 'stopped',
            },
          });
          console.log(`[COACH_ENROLLMENT_DELETE] Updated Clerk metadata for user ${enrolledUserId}`);
        } catch (clerkErr) {
          console.error(`[COACH_ENROLLMENT_DELETE] Failed to update Clerk metadata (non-fatal):`, clerkErr);
        }
      } catch (coachingErr) {
        console.error(`[COACH_ENROLLMENT_DELETE] Failed to clean up coaching data (non-fatal):`, coachingErr);
      }
    }

    console.log(`[COACH_ENROLLMENT_DELETE] Coach ${userId} removed user ${enrolledUserId} from program ${programId}, deleted ${habitsDeleted} habits, ${tasksDeleted} tasks`);

    return NextResponse.json({
      success: true,
      message: 'User removed from program',
      habitsDeleted,
      tasksDeleted,
    });
  } catch (error) {
    console.error('[COACH_ENROLLMENT_DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to remove user from program' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/org-programs/[programId]/enrollments/[enrollmentId]
 * Resume a stopped enrollment - sets status back to active and re-adds user to squad/chat
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string; enrollmentId: string }> }
) {
  try {
    const { userId } = await auth();
    const { programId, enrollmentId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { action } = body;

    if (action !== 'resume') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Coach features require tenant domain' }, { status: 403 });
    }

    // Verify user is an admin (coach) of the organization
    const isCoach = await isUserOrgAdmin(userId, organizationId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Not authorized - coaches only' }, { status: 403 });
    }

    // Verify program belongs to this organization
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data() as Program;
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program does not belong to your organization' }, { status: 403 });
    }

    // Get the enrollment
    const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

    // Verify enrollment is for this program
    if (enrollment.programId !== programId) {
      return NextResponse.json({ error: 'Enrollment does not belong to this program' }, { status: 400 });
    }

    // Check if enrollment is stopped (can only resume stopped enrollments)
    if (enrollment.status !== 'stopped') {
      return NextResponse.json({ error: 'Can only resume stopped enrollments' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const enrolledUserId = enrollment.userId;

    // 1. Update enrollment status back to 'active'
    await enrollmentDoc.ref.update({
      status: 'active',
      resumedAt: now,
      resumedBy: userId,
      // Clear stop-related fields
      stoppedAt: null,
      stoppedBy: null,
      stoppedReason: null,
      updatedAt: now,
    });

    // 2. Re-add user to squad if applicable
    if (enrollment.squadId) {
      try {
        const { FieldValue } = await import('firebase-admin/firestore');
        const squadDoc = await adminDb.collection('squads').doc(enrollment.squadId).get();

        if (squadDoc.exists) {
          const squadData = squadDoc.data();
          const memberIds = squadData?.memberIds || [];

          // Add user back to squad if not already there
          if (!memberIds.includes(enrolledUserId)) {
            await squadDoc.ref.update({
              memberIds: FieldValue.arrayUnion(enrolledUserId),
              updatedAt: now,
            });
            console.log(`[COACH_ENROLLMENT_RESUME] Re-added user ${enrolledUserId} to squad ${enrollment.squadId}`);
          }

          // Re-add to Stream chat channel if exists
          if (squadData?.streamChannelId) {
            try {
              const { StreamChat } = await import('stream-chat');
              const streamClient = StreamChat.getInstance(
                process.env.NEXT_PUBLIC_STREAM_API_KEY!,
                process.env.STREAM_API_SECRET!
              );

              const channel = streamClient.channel('messaging', squadData.streamChannelId);
              await channel.addMembers([enrolledUserId]);
              console.log(`[COACH_ENROLLMENT_RESUME] Re-added user ${enrolledUserId} to Stream channel ${squadData.streamChannelId}`);
            } catch (streamErr) {
              console.error(`[COACH_ENROLLMENT_RESUME] Failed to re-add to Stream channel (non-fatal):`, streamErr);
            }
          }
        }
      } catch (squadErr) {
        console.error(`[COACH_ENROLLMENT_RESUME] Failed to re-add to squad (non-fatal):`, squadErr);
      }
    }

    // 2a. For individual programs, re-add to client community squad if they had joined
    if (program.type === 'individual' && program.clientCommunitySquadId && enrollment.joinedCommunity) {
      try {
        const { FieldValue } = await import('firebase-admin/firestore');
        const { getStreamServerClient } = await import('@/lib/stream-server');
        const squadDoc = await adminDb.collection('squads').doc(program.clientCommunitySquadId).get();

        if (squadDoc.exists) {
          const squadData = squadDoc.data();
          const memberIds = squadData?.memberIds || [];

          // Add user back to squad if not already there
          if (!memberIds.includes(enrolledUserId)) {
            await squadDoc.ref.update({
              memberIds: FieldValue.arrayUnion(enrolledUserId),
              updatedAt: now,
            });
            console.log(`[COACH_ENROLLMENT_RESUME] Re-added user ${enrolledUserId} to client community squad ${program.clientCommunitySquadId}`);
          }

          // Re-add to Stream chat channel if exists
          if (squadData?.chatChannelId) {
            try {
              const streamClient = await getStreamServerClient();
              const channel = streamClient.channel('messaging', squadData.chatChannelId);
              await channel.addMembers([enrolledUserId]);
              console.log(`[COACH_ENROLLMENT_RESUME] Re-added user ${enrolledUserId} to client community Stream channel`);
            } catch (streamErr) {
              console.error(`[COACH_ENROLLMENT_RESUME] Failed to re-add to client community Stream channel (non-fatal):`, streamErr);
            }
          }
        }
      } catch (communityErr) {
        console.error(`[COACH_ENROLLMENT_RESUME] Failed to re-add to client community squad (non-fatal):`, communityErr);
      }
    }

    // 2b. For individual programs, restore coaching relationship data
    if (program.type === 'individual') {
      try {
        const coachingDocId = `${program.organizationId}_${enrolledUserId}`;
        const coachingDoc = await adminDb.collection('clientCoachingData').doc(coachingDocId).get();
        
        if (coachingDoc.exists) {
          await coachingDoc.ref.update({
            status: 'active',
            resumedAt: now,
            updatedAt: now,
          });
          console.log(`[COACH_ENROLLMENT_RESUME] Restored coaching data for user ${enrolledUserId}`);
        }

        // Restore user's coaching flags
        await adminDb.collection('users').doc(enrolledUserId).update({
          coaching: true,
          coachingStatus: 'active',
          updatedAt: now,
        });

        // Restore org_memberships
        const membershipDocId = `${program.organizationId}_${enrolledUserId}`;
        await adminDb.collection('org_memberships').doc(membershipDocId).update({
          coaching: true,
          coachingStatus: 'active',
          updatedAt: now,
        });

        // Update Clerk user metadata
        try {
          const clerk = await clerkClient();
          const currentUser = await clerk.users.getUser(enrolledUserId);
          const existingMetadata = (currentUser.publicMetadata as Record<string, unknown>) || {};
          
          await clerk.users.updateUserMetadata(enrolledUserId, {
            publicMetadata: {
              ...existingMetadata,
              coaching: true,
              coachingStatus: 'active',
            },
          });
          console.log(`[COACH_ENROLLMENT_RESUME] Restored Clerk metadata for user ${enrolledUserId}`);
        } catch (clerkErr) {
          console.error(`[COACH_ENROLLMENT_RESUME] Failed to update Clerk metadata (non-fatal):`, clerkErr);
        }
      } catch (coachingErr) {
        console.error(`[COACH_ENROLLMENT_RESUME] Failed to restore coaching data (non-fatal):`, coachingErr);
      }
    }

    // 3. Update user's current program reference if not set
    try {
      const userDoc = await adminDb.collection('users').doc(enrolledUserId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        // Only update if user doesn't have a current program
        if (!userData?.currentProgramEnrollmentId) {
          await userDoc.ref.update({
            currentProgramEnrollmentId: enrollmentId,
            currentProgramId: programId,
            updatedAt: now,
          });
          console.log(`[COACH_ENROLLMENT_RESUME] Set current program reference for user ${enrolledUserId}`);
        }
      }
    } catch (userErr) {
      console.error(`[COACH_ENROLLMENT_RESUME] Failed to update user reference (non-fatal):`, userErr);
    }

    // 4. Update cohort enrollment count if applicable
    if (enrollment.cohortId) {
      try {
        const { FieldValue } = await import('firebase-admin/firestore');
        await adminDb.collection('program_cohorts').doc(enrollment.cohortId).update({
          currentEnrollment: FieldValue.increment(1),
        });
      } catch (cohortErr) {
        console.error(`[COACH_ENROLLMENT_RESUME] Failed to update cohort count (non-fatal):`, cohortErr);
      }
    }

    // 5. Ensure program_instances exists and sync program tasks
    try {
      if (enrollment.cohortId) {
        await ensureCohortInstanceExists(programId, enrollment.cohortId, organizationId);
        console.log(`[COACH_ENROLLMENT_RESUME] Ensured cohort instance exists for cohortId: ${enrollment.cohortId}`);
      } else {
        await ensureEnrollmentInstanceExists(programId, enrollmentId, organizationId);
        console.log(`[COACH_ENROLLMENT_RESUME] Ensured enrollment instance exists for enrollmentId: ${enrollmentId}`);
      }

      // Sync all program tasks to the user's tasks collection
      const syncResult = await syncAllProgramTasks({
        userId: enrolledUserId,
        enrollmentId,
        mode: 'fill-empty',
        coachUserId: userId,
      });
      console.log(`[COACH_ENROLLMENT_RESUME] Synced program tasks:`, {
        tasksCreated: syncResult.tasksCreated,
        daysProcessed: syncResult.daysProcessed,
        totalDays: syncResult.totalDays,
      });
    } catch (syncErr) {
      console.error(`[COACH_ENROLLMENT_RESUME] Failed to sync program tasks (non-fatal):`, syncErr);
      // Non-fatal - enrollment is already resumed
    }

    console.log(`[COACH_ENROLLMENT_RESUME] Coach ${userId} resumed enrollment for user ${enrolledUserId} in program ${programId}`);

    return NextResponse.json({
      success: true,
      message: 'Enrollment resumed successfully',
    });
  } catch (error) {
    console.error('[COACH_ENROLLMENT_RESUME] Error:', error);
    return NextResponse.json({ error: 'Failed to resume enrollment' }, { status: 500 });
  }
}

