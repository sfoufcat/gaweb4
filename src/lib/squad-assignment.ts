/**
 * Squad Assignment Helper
 * 
 * Handles automatic squad assignment when users enroll in programs.
 * For group programs, finds or creates a squad with available capacity.
 */

import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { clerkClient } from '@clerk/nextjs/server';
import type { Squad, Program } from '@/types';

const DEFAULT_SQUAD_CAPACITY = 10;

interface AssignUserToSquadParams {
  userId: string;
  programId: string;
  cohortId?: string | null;
  organizationId: string;
  program: Program;
  /** Pre-specified squadId from invite - if provided, user is added to this squad */
  targetSquadId?: string | null;
}

interface AssignmentResult {
  squadId: string | null;
  isNewSquad: boolean;
  squadName?: string;
}

/**
 * Assigns a user to a squad for a program enrollment.
 * 
 * Logic:
 * 1. If targetSquadId is provided (from invite), add user to that squad
 * 2. Otherwise, find an existing squad for the program/cohort with capacity
 * 3. If no squad with capacity, auto-create a new squad
 * 
 * @returns The assigned squadId, whether it was a new squad, and squad name
 */
export async function assignUserToSquad(params: AssignUserToSquadParams): Promise<AssignmentResult> {
  const { userId, programId, cohortId, organizationId, program, targetSquadId } = params;
  
  const squadCapacity = program.squadCapacity || DEFAULT_SQUAD_CAPACITY;
  const now = new Date().toISOString();
  
  // Get user info from Clerk for squad member creation
  const clerk = await clerkClient();
  let clerkUser;
  try {
    clerkUser = await clerk.users.getUser(userId);
  } catch (err) {
    console.error(`[SQUAD_ASSIGNMENT] Failed to get Clerk user ${userId}:`, err);
    return { squadId: null, isNewSquad: false };
  }
  
  // Case 1: Use specified targetSquadId from invite
  if (targetSquadId) {
    const success = await addUserToExistingSquad(targetSquadId, userId, clerkUser, now);
    if (success) {
      return { squadId: targetSquadId, isNewSquad: false };
    }
    // If adding to target squad failed, fall through to find another squad
    console.warn(`[SQUAD_ASSIGNMENT] Failed to add to target squad ${targetSquadId}, finding alternative`);
  }
  
  // Case 2: Find existing squad with capacity
  // Query squads for this program/cohort/organization that have room
  const squadsQuery = adminDb.collection('squads')
    .where('organizationId', '==', organizationId)
    .where('programId', '==', programId);
  
  // Add cohort filter if specified
  let squadsSnapshot;
  if (cohortId) {
    squadsSnapshot = await squadsQuery
      .where('cohortId', '==', cohortId)
      .where('isClosed', '!=', true) // Exclude closed squads
      .get();
  } else {
    squadsSnapshot = await squadsQuery
      .where('isClosed', '!=', true)
      .get();
  }
  
  // Find squad with available capacity
  for (const doc of squadsSnapshot.docs) {
    const squadData = doc.data() as Squad;
    const memberCount = squadData.memberIds?.length || 0;
    const capacity = squadData.capacity || squadCapacity;
    
    if (memberCount < capacity) {
      // Found a squad with room - add user
      const success = await addUserToExistingSquad(doc.id, userId, clerkUser, now);
      if (success) {
        console.log(`[SQUAD_ASSIGNMENT] Added user ${userId} to existing squad ${doc.id} (${memberCount + 1}/${capacity})`);
        return { squadId: doc.id, isNewSquad: false, squadName: squadData.name };
      }
    }
  }
  
  // Case 3: No squad with capacity - create a new one
  console.log(`[SQUAD_ASSIGNMENT] No squad with capacity found, creating new squad for program ${programId}`);
  const newSquadId = await createNewSquad({
    userId,
    programId,
    cohortId,
    organizationId,
    program,
    clerkUser,
    existingSquadCount: squadsSnapshot.docs.length,
  });
  
  if (newSquadId) {
    return { squadId: newSquadId, isNewSquad: true, squadName: `${program.name} Squad ${squadsSnapshot.docs.length + 1}` };
  }
  
  return { squadId: null, isNewSquad: false };
}

/**
 * Add a user to an existing squad
 */
async function addUserToExistingSquad(
  squadId: string,
  userId: string,
  clerkUser: { firstName: string | null; lastName: string | null; imageUrl: string },
  now: string
): Promise<boolean> {
  try {
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();
    
    if (!squadDoc.exists) {
      console.warn(`[SQUAD_ASSIGNMENT] Squad ${squadId} not found`);
      return false;
    }
    
    const squadData = squadDoc.data() as Squad;
    const memberIds = squadData.memberIds || [];
    
    // Check if already a member in memberIds array
    if (memberIds.includes(userId)) {
      console.log(`[SQUAD_ASSIGNMENT] User ${userId} already in squad ${squadId} memberIds`);
      return true; // Already a member is a success
    }
    
    // Update squad memberIds
    await squadRef.update({
      memberIds: [...memberIds, userId],
      updatedAt: now,
    });
    
    // Check if squadMember document already exists to prevent duplicates
    const existingMember = await adminDb
      .collection('squadMembers')
      .where('squadId', '==', squadId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (existingMember.empty) {
      // Create squadMember document only if it doesn't exist
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
    } else {
      console.log(`[SQUAD_ASSIGNMENT] SquadMember record already exists for user ${userId} in squad ${squadId}`);
    }
    
    // Add user to Stream Chat channel if it exists
    if (squadData.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        
        // Ensure user exists in Stream
        await streamClient.upsertUser({
          id: userId,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
          image: clerkUser.imageUrl,
        });
        
        // Add to channel
        const channel = streamClient.channel('messaging', squadData.chatChannelId);
        await channel.addMembers([userId]);
        
        console.log(`[SQUAD_ASSIGNMENT] Added user ${userId} to Stream channel ${squadData.chatChannelId}`);
      } catch (streamErr) {
        // Non-fatal - log but continue
        console.error(`[SQUAD_ASSIGNMENT] Failed to add user to Stream channel:`, streamErr);
      }
    }
    
    return true;
  } catch (err) {
    console.error(`[SQUAD_ASSIGNMENT] Error adding user to squad ${squadId}:`, err);
    return false;
  }
}

interface CreateNewSquadParams {
  userId: string;
  programId: string;
  cohortId?: string | null;
  organizationId: string;
  program: Program;
  clerkUser: { firstName: string | null; lastName: string | null; imageUrl: string };
  existingSquadCount: number;
}

/**
 * Create a new auto-generated squad for a program
 */
async function createNewSquad(params: CreateNewSquadParams): Promise<string | null> {
  const { userId, programId, cohortId, organizationId, program, clerkUser, existingSquadCount } = params;
  
  const now = new Date().toISOString();
  const squadNumber = existingSquadCount + 1;
  const squadName = `${program.name} Squad ${squadNumber}`;
  
  try {
    // Create squad document
    const squadRef = await adminDb.collection('squads').add({
      name: squadName,
      description: `Auto-created squad for ${program.name}`,
      avatarUrl: '', // Could use program's cover image
      visibility: 'private', // Auto-created squads are private
      timezone: 'UTC',
      memberIds: [userId],
      hasCoach: true, // Paid programs get coached squads
      coachId: null, // Will be assigned by coach later
      organizationId,
      programId,
      cohortId: cohortId || null,
      capacity: program.squadCapacity || DEFAULT_SQUAD_CAPACITY,
      isAutoCreated: true,
      squadNumber,
      createdAt: now,
      updatedAt: now,
    });
    
    const squadId = squadRef.id;
    console.log(`[SQUAD_ASSIGNMENT] Created new squad ${squadId}: ${squadName}`);
    
    // Create squadMember document for the first user
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
    
    // Create Stream Chat channel for the squad
    try {
      const streamClient = await getStreamServerClient();
      const channelId = `squad-${squadId}`;
      
      // Ensure user exists in Stream
      await streamClient.upsertUser({
        id: userId,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
        image: clerkUser.imageUrl,
      });
      
      // Create the squad group chat channel
      const channel = streamClient.channel('messaging', channelId, {
        members: [userId],
        created_by_id: userId,
        name: squadName,
        isSquadChannel: true,
      } as Record<string, unknown>);
      
      await channel.create();
      
      // Update squad with chat channel ID
      await squadRef.update({
        chatChannelId: channelId,
      });
      
      console.log(`[SQUAD_ASSIGNMENT] Created Stream channel ${channelId} for squad ${squadId}`);
    } catch (streamErr) {
      // Non-fatal - squad is created, just no chat
      console.error(`[SQUAD_ASSIGNMENT] Failed to create Stream channel:`, streamErr);
    }
    
    return squadId;
  } catch (err) {
    console.error(`[SQUAD_ASSIGNMENT] Error creating new squad:`, err);
    return null;
  }
}

/**
 * Update user document with squad reference
 * 
 * @param userId - User ID to update
 * @param squadId - Squad ID to add to user's squadIds array
 */
export async function updateUserSquadReference(
  userId: string,
  squadId: string
): Promise<void> {
  const now = new Date().toISOString();
  const userRef = adminDb.collection('users').doc(userId);
  
  // Get current user data to update squadIds array
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? userDoc.data() : null;
  
  // Get current squadIds array or create from legacy fields
  const currentSquadIds: string[] = userData?.squadIds || [];
  
  // Don't add if already in array
  if (currentSquadIds.includes(squadId)) {
    console.log(`[SQUAD_ASSIGNMENT] User ${userId} already has squadId ${squadId}`);
    return;
  }
  
  // Add legacy fields to array if not already present
  if (userData?.standardSquadId && !currentSquadIds.includes(userData.standardSquadId)) {
    currentSquadIds.push(userData.standardSquadId);
  }
  if (userData?.premiumSquadId && !currentSquadIds.includes(userData.premiumSquadId)) {
    currentSquadIds.push(userData.premiumSquadId);
  }
  
  // Add the new squad
  currentSquadIds.push(squadId);
  
  const updateData: Record<string, unknown> = {
    squadIds: currentSquadIds,
    updatedAt: now,
  };
  
  await userRef.set(updateData, { merge: true });
  console.log(`[SQUAD_ASSIGNMENT] Updated user ${userId} with squadId ${squadId}`);
}

