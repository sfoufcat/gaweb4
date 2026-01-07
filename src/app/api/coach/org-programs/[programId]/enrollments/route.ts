/**
 * Coach API: Program Enrollments
 * 
 * GET /api/coach/org-programs/[programId]/enrollments - List enrollments for a program
 * 
 * This allows coaches to see who is enrolled in their program.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isUserOrgAdmin } from '@/lib/clerk-organizations';
import { getStreamServerClient } from '@/lib/stream-server';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramEnrollment, Program, Squad, SquadMember, UserCallCredits, UnifiedEvent, ClientCoachingData } from '@/types';

// Next call info structure
interface NextCallInfo {
  datetime: string;
  title: string;
  isRecurring: boolean;
  location?: string;
}

// Credits info structure
interface CreditsInfo {
  creditsRemaining: number;
  monthlyAllowance: number;
  creditsUsedThisMonth: number;
}

interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    imageUrl: string;
  };
  callCredits?: CreditsInfo | null;
  nextCall?: NextCallInfo | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { userId } = await auth();
    const { programId } = await params;

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

    // Get status filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'active', 'upcoming', 'completed', 'stopped', or null for all

    // Build query
    let query: FirebaseFirestore.Query = adminDb
      .collection('program_enrollments')
      .where('programId', '==', programId);

    if (statusFilter && ['active', 'upcoming', 'completed', 'stopped'].includes(statusFilter)) {
      query = query.where('status', '==', statusFilter);
    }

    const enrollmentsSnapshot = await query.get();

    // Get user info, call credits, and next call for each enrollment
    const clerk = await clerkClient();
    const now = new Date();
    
    const enrollments: EnrollmentWithUser[] = await Promise.all(
      enrollmentsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const enrollment = {
          id: doc.id,
          ...data,
          // Convert Firestore Timestamps to ISO strings
          startedAt: data.startedAt?.toDate?.()?.toISOString?.() || data.startedAt,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
          completedAt: data.completedAt?.toDate?.()?.toISOString?.() || data.completedAt,
          stoppedAt: data.stoppedAt?.toDate?.()?.toISOString?.() || data.stoppedAt,
        } as ProgramEnrollment;
        
        let user: EnrollmentWithUser['user'] = undefined;
        let callCredits: CreditsInfo | null = null;
        let nextCall: NextCallInfo | null = null;
        
        try {
          // Fetch Clerk user info
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
        
        // Fetch call credits for this user (only for individual programs)
        if (program.type === 'individual') {
          try {
            const creditsDocId = `${organizationId}_${enrollment.userId}`;
            const creditsDoc = await adminDb.collection('user_call_credits').doc(creditsDocId).get();
            
            if (creditsDoc.exists) {
              const credits = creditsDoc.data() as UserCallCredits;
              callCredits = {
                creditsRemaining: credits.creditsRemaining,
                monthlyAllowance: credits.monthlyAllowance,
                creditsUsedThisMonth: credits.creditsUsedThisMonth,
              };
            }
          } catch (err) {
            console.warn(`[ENROLLMENTS] Failed to fetch credits for user ${enrollment.userId}:`, err);
          }
          
          // Fetch next scheduled call for this user
          try {
            // First try from coaching data
            const coachingDocId = `${organizationId}_${enrollment.userId}`;
            const coachingDoc = await adminDb.collection('clientCoachingData').doc(coachingDocId).get();
            
            if (coachingDoc.exists) {
              const coachingData = coachingDoc.data() as ClientCoachingData;
              if (coachingData.nextCall?.datetime) {
                const callTime = new Date(coachingData.nextCall.datetime);
                if (callTime > now) {
                  nextCall = {
                    datetime: coachingData.nextCall.datetime,
                    title: coachingData.nextCall.title || 'Coaching Call',
                    isRecurring: coachingData.nextCall.isRecurring || false,
                    location: coachingData.nextCall.location,
                  };
                }
              }
            }
            
            // If no next call from coaching data, check unified_events
            if (!nextCall) {
              const eventsQuery = await adminDb.collection('unified_events')
                .where('organizationId', '==', organizationId)
                .where('eventType', '==', 'coaching_1on1')
                .where('attendeeIds', 'array-contains', enrollment.userId)
                .where('startDateTime', '>', now.toISOString())
                .where('status', 'in', ['confirmed', 'proposed', 'pending_response'])
                .orderBy('startDateTime', 'asc')
                .limit(1)
                .get();
              
              if (!eventsQuery.empty) {
                const eventData = eventsQuery.docs[0].data() as UnifiedEvent;
                nextCall = {
                  datetime: eventData.startDateTime,
                  title: eventData.title || 'Coaching Call',
                  isRecurring: eventData.isRecurring || false,
                  location: eventData.locationLabel || eventData.locationType,
                };
              }
            }
          } catch (err) {
            console.warn(`[ENROLLMENTS] Failed to fetch next call for user ${enrollment.userId}:`, err);
          }
        }
        
        return {
          ...enrollment,
          user,
          callCredits,
          nextCall,
        };
      })
    );

    // Deduplicate by userId - keep the most recent enrollment per user
    const enrollmentsByUser = new Map<string, EnrollmentWithUser>();
    
    for (const enrollment of enrollments) {
      const existing = enrollmentsByUser.get(enrollment.userId);
      if (!existing || new Date(enrollment.createdAt) > new Date(existing.createdAt)) {
        enrollmentsByUser.set(enrollment.userId, enrollment);
      }
    }
    
    const uniqueEnrollments = Array.from(enrollmentsByUser.values());

    // Sort by createdAt descending
    uniqueEnrollments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      enrollments: uniqueEnrollments,
      total: uniqueEnrollments.length, // Unique users count
    });
  } catch (error) {
    console.error('[COACH_PROGRAM_ENROLLMENTS_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/org-programs/[programId]/enrollments
 * Toggle community membership for an enrollment
 * 
 * Body:
 * - enrollmentId: string (required)
 * - joinCommunity: boolean (required) - true to add to community, false to remove
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { userId: coachUserId } = await auth();
    const { programId } = await params;

    if (!coachUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Coach features require tenant domain' }, { status: 403 });
    }

    // Verify user is an admin (coach) of the organization
    const isCoach = await isUserOrgAdmin(coachUserId, organizationId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Not authorized - coaches only' }, { status: 403 });
    }

    const body = await request.json();
    const { enrollmentId, joinCommunity } = body as { enrollmentId: string; joinCommunity: boolean };

    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
    }

    if (typeof joinCommunity !== 'boolean') {
      return NextResponse.json({ error: 'joinCommunity must be a boolean' }, { status: 400 });
    }

    // Get enrollment
    const enrollmentRef = adminDb.collection('program_enrollments').doc(enrollmentId);
    const enrollmentDoc = await enrollmentRef.get();
    
    if (!enrollmentDoc.exists) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;

    if (enrollment.programId !== programId) {
      return NextResponse.json({ error: 'Enrollment does not belong to this program' }, { status: 403 });
    }

    // Get program
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const program = programDoc.data() as Program;
    
    if (program.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Program does not belong to your organization' }, { status: 403 });
    }

    if (program.type !== 'individual') {
      return NextResponse.json({ error: 'Community membership only applies to individual programs' }, { status: 400 });
    }

    if (!program.clientCommunitySquadId) {
      return NextResponse.json({ error: 'This program does not have a client community enabled' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const clientUserId = enrollment.userId;

    if (joinCommunity) {
      // Add user to community squad
      const squadRef = adminDb.collection('squads').doc(program.clientCommunitySquadId);
      const squadDoc = await squadRef.get();
      
      if (!squadDoc.exists) {
        return NextResponse.json({ error: 'Community squad not found' }, { status: 404 });
      }

      const squad = squadDoc.data() as Squad;

      // Check if user is already in squad
      const existingMembershipSnapshot = await adminDb.collection('squadMembers')
        .where('squadId', '==', program.clientCommunitySquadId)
        .where('userId', '==', clientUserId)
        .limit(1)
        .get();

      if (existingMembershipSnapshot.empty) {
        // Get user info from Clerk
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(clientUserId);

        // Add to squad memberIds
        await squadRef.update({
          memberIds: FieldValue.arrayUnion(clientUserId),
          updatedAt: now,
        });

        // Create squadMember document
        const memberData: Omit<SquadMember, 'id'> = {
          squadId: program.clientCommunitySquadId,
          userId: clientUserId,
          roleInSquad: 'member',
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
          imageUrl: clerkUser.imageUrl || '',
          createdAt: now,
          updatedAt: now,
        };
        await adminDb.collection('squadMembers').add(memberData);

        // Add to Stream Chat channel
        try {
          const streamClient = await getStreamServerClient();
          const channelId = squad.chatChannelId || `squad-${program.clientCommunitySquadId}`;
          
          await streamClient.upsertUser({
            id: clientUserId,
            name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
            image: clerkUser.imageUrl,
          });

          const channel = streamClient.channel('messaging', channelId);
          await channel.addMembers([clientUserId]);
        } catch (streamError) {
          console.error('[COACH_ENROLLMENT_COMMUNITY] Error adding to Stream:', streamError);
        }

        // Update user's squadIds
        await adminDb.collection('users').doc(clientUserId).update({
          squadIds: FieldValue.arrayUnion(program.clientCommunitySquadId),
          updatedAt: now,
        });
      }

      // Update enrollment
      await enrollmentRef.update({
        joinedCommunity: true,
        updatedAt: now,
      });

      console.log(`[COACH_ENROLLMENT_COMMUNITY] Added user ${clientUserId} to community squad ${program.clientCommunitySquadId}`);

    } else {
      // Remove user from community squad
      const squadRef = adminDb.collection('squads').doc(program.clientCommunitySquadId);
      const squadDoc = await squadRef.get();

      if (squadDoc.exists) {
        const squad = squadDoc.data() as Squad;

        // Remove from squad memberIds
        await squadRef.update({
          memberIds: FieldValue.arrayRemove(clientUserId),
          updatedAt: now,
        });

        // Delete squadMember document
        const membershipSnapshot = await adminDb.collection('squadMembers')
          .where('squadId', '==', program.clientCommunitySquadId)
          .where('userId', '==', clientUserId)
          .get();

        const batch = adminDb.batch();
        membershipSnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Remove from Stream Chat channel
        try {
          const streamClient = await getStreamServerClient();
          const channelId = squad.chatChannelId || `squad-${program.clientCommunitySquadId}`;
          const channel = streamClient.channel('messaging', channelId);
          await channel.removeMembers([clientUserId]);
        } catch (streamError) {
          console.error('[COACH_ENROLLMENT_COMMUNITY] Error removing from Stream:', streamError);
        }

        // Update user's squadIds
        await adminDb.collection('users').doc(clientUserId).update({
          squadIds: FieldValue.arrayRemove(program.clientCommunitySquadId),
          updatedAt: now,
        });
      }

      // Update enrollment
      await enrollmentRef.update({
        joinedCommunity: false,
        updatedAt: now,
      });

      console.log(`[COACH_ENROLLMENT_COMMUNITY] Removed user ${clientUserId} from community squad ${program.clientCommunitySquadId}`);
    }

    return NextResponse.json({
      success: true,
      joinedCommunity: joinCommunity,
    });
  } catch (error) {
    console.error('[COACH_PROGRAM_ENROLLMENTS_PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to update community membership' }, { status: 500 });
  }
}

