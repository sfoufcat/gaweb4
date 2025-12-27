/**
 * Migration Script: Unified Events Consolidation
 * 
 * This script migrates all existing event and call data to the unified events system.
 * 
 * Migrations:
 * 1. Discover events (events collection) - Add new fields, keep existing
 * 2. Coach-scheduled squad calls (squads.nextCall* fields) - Convert to event documents
 * 3. Standard squad calls (standardSquadCalls) - Convert to event documents with voting
 * 4. Coaching 1-on-1 calls (ClientCoachingData.nextCall) - Convert to event documents
 * 5. Squad call votes (squadCallVotes) - Migrate to eventVotes
 * 6. Scheduled jobs - Migrate to eventScheduledJobs
 * 
 * Run with: npx ts-node scripts/migrate-events.ts
 * 
 * IMPORTANT: This is a one-time migration. Back up your database first!
 */

import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Types from the codebase
type EventType = 'workshop' | 'community_event' | 'squad_call' | 'coaching_1on1';
type EventScope = 'global' | 'organization' | 'program' | 'squad' | 'private';
type EventVisibility = 'squad_only' | 'program_wide';
type ParticipantModel = 'rsvp' | 'squad_members' | 'program_enrollees' | 'invite_only';
type EventApprovalType = 'none' | 'voting';
type EventStatus = 'draft' | 'pending_approval' | 'confirmed' | 'live' | 'completed' | 'canceled';

interface UnifiedEventMigration {
  id?: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime?: string;
  timezone: string;
  durationMinutes?: number;
  locationType: 'online' | 'in_person' | 'chat';
  locationLabel: string;
  meetingLink?: string;
  eventType: EventType;
  scope: EventScope;
  participantModel: ParticipantModel;
  approvalType: EventApprovalType;
  status: EventStatus;
  visibility?: EventVisibility;
  organizationId?: string;
  programId?: string;
  programIds?: string[];
  squadId?: string;
  cohortId?: string;
  isRecurring: boolean;
  recurrence?: unknown;
  parentEventId?: string;
  instanceDate?: string;
  createdByUserId: string;
  hostUserId: string;
  hostName: string;
  hostAvatarUrl?: string;
  isCoachLed: boolean;
  attendeeIds: string[];
  maxAttendees?: number;
  votingConfig?: {
    yesCount: number;
    noCount: number;
    requiredVotes: number;
    totalEligibleVoters: number;
  };
  confirmedAt?: string;
  coverImageUrl?: string;
  bulletPoints?: string[];
  additionalInfo?: { type: string; language: string; difficulty: string };
  recordingUrl?: string;
  chatChannelId?: string;
  sendChatReminders: boolean;
  // Legacy fields
  date?: string;
  startTime?: string;
  endTime?: string;
  shortDescription?: string;
  longDescription?: string;
  category?: string;
  track?: string;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Initialize Firebase Admin
function initializeFirebase(): admin.firestore.Firestore {
  if (getApps().length === 0) {
    // Check for service account file or environment variable
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else if (serviceAccountPath) {
      initializeApp({
        credential: cert(serviceAccountPath),
      });
    } else {
      console.error('ERROR: No Firebase credentials found.');
      console.error('Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT environment variable.');
      process.exit(1);
    }
  }
  
  return getFirestore();
}

// Statistics tracking
const stats = {
  discoverEvents: { processed: 0, updated: 0, errors: 0 },
  coachSquadCalls: { processed: 0, created: 0, errors: 0 },
  standardSquadCalls: { processed: 0, created: 0, errors: 0 },
  coachingCalls: { processed: 0, created: 0, errors: 0 },
  votes: { processed: 0, migrated: 0, errors: 0 },
  scheduledJobs: { processed: 0, migrated: 0, errors: 0 },
};

// ============================================================================
// Migration 1: Update existing Discover Events
// ============================================================================

async function migrateDiscoverEvents(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n📅 Migrating Discover Events...');
  
  const eventsSnapshot = await db.collection('events').get();
  
  for (const doc of eventsSnapshot.docs) {
    stats.discoverEvents.processed++;
    const data = doc.data();
    
    try {
      // Only update if missing new fields
      const updates: Record<string, unknown> = {};
      
      // Add eventType if missing
      if (!data.eventType) {
        updates.eventType = 'workshop';
      }
      
      // Add scope if missing
      if (!data.scope) {
        if (data.organizationId) {
          updates.scope = 'organization';
        } else {
          updates.scope = 'global';
        }
      }
      
      // Add participantModel if missing
      if (!data.participantModel) {
        updates.participantModel = 'rsvp';
      }
      
      // Add approvalType if missing
      if (!data.approvalType) {
        updates.approvalType = 'none';
      }
      
      // Add status if missing
      if (!data.status) {
        const eventDate = data.date ? new Date(data.date) : null;
        const now = new Date();
        if (eventDate && eventDate < now) {
          updates.status = 'completed';
        } else {
          updates.status = 'confirmed';
        }
      }
      
      // Add isRecurring if missing
      if (data.isRecurring === undefined) {
        updates.isRecurring = false;
      }
      
      // Add isCoachLed if missing
      if (data.isCoachLed === undefined) {
        updates.isCoachLed = true; // Discover events are typically coach-led
      }
      
      // Add sendChatReminders if missing
      if (data.sendChatReminders === undefined) {
        updates.sendChatReminders = false;
      }
      
      // Convert date/time to startDateTime if startDateTime is missing
      if (!data.startDateTime && data.date && data.startTime) {
        try {
          const [hours, minutes] = data.startTime.split(':').map(Number);
          const dateObj = new Date(data.date);
          dateObj.setHours(hours, minutes, 0, 0);
          updates.startDateTime = dateObj.toISOString();
        } catch (e) {
          console.warn(`  ⚠️ Could not parse date/time for event ${doc.id}`);
        }
      }
      
      // Calculate endDateTime if missing
      if (!data.endDateTime && data.date && data.endTime) {
        try {
          const [hours, minutes] = data.endTime.split(':').map(Number);
          const dateObj = new Date(data.date);
          dateObj.setHours(hours, minutes, 0, 0);
          updates.endDateTime = dateObj.toISOString();
        } catch (e) {
          console.warn(`  ⚠️ Could not parse end time for event ${doc.id}`);
        }
      }
      
      // Add hostUserId if missing
      if (!data.hostUserId && data.createdByUserId) {
        updates.hostUserId = data.createdByUserId;
      }
      
      if (Object.keys(updates).length > 0) {
        await doc.ref.update(updates);
        stats.discoverEvents.updated++;
        console.log(`  ✓ Updated event ${doc.id}`);
      }
    } catch (error) {
      stats.discoverEvents.errors++;
      console.error(`  ✗ Failed to update event ${doc.id}:`, error);
    }
  }
  
  console.log(`  Done: ${stats.discoverEvents.processed} processed, ${stats.discoverEvents.updated} updated, ${stats.discoverEvents.errors} errors`);
}

// ============================================================================
// Migration 2: Coach-Scheduled Squad Calls
// ============================================================================

async function migrateCoachSquadCalls(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n📞 Migrating Coach-Scheduled Squad Calls...');
  
  const squadsSnapshot = await db.collection('squads')
    .where('nextCallDateTime', '!=', null)
    .get();
  
  for (const doc of squadsSnapshot.docs) {
    stats.coachSquadCalls.processed++;
    const squad = doc.data();
    
    try {
      if (!squad.nextCallDateTime) continue;
      
      // Get coach info
      let hostName = 'Coach';
      let hostAvatarUrl: string | undefined;
      if (squad.coachId) {
        const coachDoc = await db.collection('users').doc(squad.coachId).get();
        if (coachDoc.exists) {
          const coachData = coachDoc.data();
          hostName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || 'Coach';
          hostAvatarUrl = coachData?.profileImageUrl || coachData?.imageUrl;
        }
      }
      
      const now = new Date().toISOString();
      const callDate = new Date(squad.nextCallDateTime);
      
      const eventData: UnifiedEventMigration = {
        title: squad.nextCallTitle || 'Squad coaching call',
        description: `Weekly squad call for ${squad.name}`,
        startDateTime: squad.nextCallDateTime,
        timezone: squad.nextCallTimezone || squad.timezone || 'UTC',
        durationMinutes: 60,
        
        locationType: 'chat',
        locationLabel: squad.nextCallLocation || 'Squad Chat',
        meetingLink: squad.nextCallLocation?.startsWith('http') ? squad.nextCallLocation : undefined,
        
        eventType: 'squad_call',
        scope: 'squad',
        participantModel: 'squad_members',
        approvalType: 'none',
        status: callDate < new Date() ? 'completed' : 'confirmed',
        visibility: 'squad_only',
        
        organizationId: squad.organizationId || undefined,
        programId: squad.programId || undefined,
        squadId: doc.id,
        cohortId: squad.cohortId || undefined,
        
        isRecurring: false,
        
        createdByUserId: squad.coachId || 'system',
        hostUserId: squad.coachId || 'system',
        hostName,
        hostAvatarUrl,
        isCoachLed: true,
        
        attendeeIds: [],
        
        chatChannelId: squad.chatChannelId || undefined,
        sendChatReminders: true,
        
        createdAt: now,
        updatedAt: now,
      };
      
      // Create event with a predictable ID
      const eventId = `squad_call_${doc.id}`;
      await db.collection('events').doc(eventId).set(eventData);
      
      stats.coachSquadCalls.created++;
      console.log(`  ✓ Created event for squad ${squad.name} (${doc.id})`);
    } catch (error) {
      stats.coachSquadCalls.errors++;
      console.error(`  ✗ Failed to migrate squad ${doc.id}:`, error);
    }
  }
  
  console.log(`  Done: ${stats.coachSquadCalls.processed} processed, ${stats.coachSquadCalls.created} created, ${stats.coachSquadCalls.errors} errors`);
}

// ============================================================================
// Migration 3: Standard Squad Calls (Member-Proposed with Voting)
// ============================================================================

async function migrateStandardSquadCalls(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n🗳️ Migrating Standard Squad Calls (with voting)...');
  
  const callsSnapshot = await db.collection('standardSquadCalls').get();
  
  for (const doc of callsSnapshot.docs) {
    stats.standardSquadCalls.processed++;
    const call = doc.data();
    
    try {
      // Get squad info
      const squadDoc = await db.collection('squads').doc(call.squadId).get();
      const squad = squadDoc.exists ? squadDoc.data() : null;
      
      // Get proposer info
      let hostName = 'Squad Member';
      let hostAvatarUrl: string | undefined;
      if (call.proposedBy) {
        const userDoc = await db.collection('users').doc(call.proposedBy).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          hostName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Squad Member';
          hostAvatarUrl = userData?.profileImageUrl || userData?.imageUrl;
        }
      }
      
      const now = new Date().toISOString();
      
      // Determine status
      let status: EventStatus;
      switch (call.status) {
        case 'confirmed':
          const callDate = new Date(call.startDateTimeUtc);
          status = callDate < new Date() ? 'completed' : 'confirmed';
          break;
        case 'canceled':
          status = 'canceled';
          break;
        case 'pending':
        default:
          status = 'pending_approval';
      }
      
      const eventData: UnifiedEventMigration = {
        title: call.title || 'Squad call',
        description: `Squad call proposed by ${hostName}`,
        startDateTime: call.startDateTimeUtc,
        timezone: call.timezone || 'UTC',
        durationMinutes: 60,
        
        locationType: 'chat',
        locationLabel: call.location || 'Squad Chat',
        meetingLink: call.location?.startsWith('http') ? call.location : undefined,
        
        eventType: 'squad_call',
        scope: 'squad',
        participantModel: 'squad_members',
        approvalType: 'voting',
        status,
        visibility: 'squad_only',
        
        organizationId: squad?.organizationId || undefined,
        programId: squad?.programId || undefined,
        squadId: call.squadId,
        cohortId: squad?.cohortId || undefined,
        
        isRecurring: false,
        
        createdByUserId: call.proposedBy,
        hostUserId: call.proposedBy,
        hostName,
        hostAvatarUrl,
        isCoachLed: false,
        
        attendeeIds: [],
        
        votingConfig: {
          yesCount: call.yesCount || 0,
          noCount: call.noCount || 0,
          requiredVotes: call.requiredVotes || 1,
          totalEligibleVoters: call.totalMembers || 1,
        },
        confirmedAt: call.confirmedAt || undefined,
        
        chatChannelId: squad?.chatChannelId || undefined,
        sendChatReminders: true,
        
        createdAt: call.createdAt || now,
        updatedAt: call.updatedAt || now,
      };
      
      // Create event with preserved ID mapping
      const eventId = `std_call_${doc.id}`;
      await db.collection('events').doc(eventId).set(eventData);
      
      // Migrate votes for this call
      await migrateVotesForCall(db, doc.id, eventId);
      
      stats.standardSquadCalls.created++;
      console.log(`  ✓ Created event for call ${doc.id}`);
    } catch (error) {
      stats.standardSquadCalls.errors++;
      console.error(`  ✗ Failed to migrate call ${doc.id}:`, error);
    }
  }
  
  console.log(`  Done: ${stats.standardSquadCalls.processed} processed, ${stats.standardSquadCalls.created} created, ${stats.standardSquadCalls.errors} errors`);
}

// Migrate votes for a single call
async function migrateVotesForCall(
  db: admin.firestore.Firestore, 
  oldCallId: string, 
  newEventId: string
): Promise<void> {
  const votesSnapshot = await db.collection('squadCallVotes')
    .where('callId', '==', oldCallId)
    .get();
  
  for (const voteDoc of votesSnapshot.docs) {
    stats.votes.processed++;
    const vote = voteDoc.data();
    
    try {
      const newVoteId = `${newEventId}_${vote.userId}`;
      await db.collection('eventVotes').doc(newVoteId).set({
        id: newVoteId,
        eventId: newEventId,
        userId: vote.userId,
        vote: vote.vote,
        createdAt: vote.createdAt || new Date().toISOString(),
        updatedAt: vote.updatedAt || new Date().toISOString(),
      });
      stats.votes.migrated++;
    } catch (error) {
      stats.votes.errors++;
      console.error(`    ✗ Failed to migrate vote ${voteDoc.id}:`, error);
    }
  }
}

// ============================================================================
// Migration 4: Coaching 1-on-1 Calls
// ============================================================================

async function migrateCoachingCalls(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n👤 Migrating Coaching 1-on-1 Calls...');
  
  // Query for coaching relationships with next call data
  const coachingSnapshot = await db.collection('coaching_relationships').get();
  
  for (const doc of coachingSnapshot.docs) {
    const coaching = doc.data();
    
    // Skip if no next call scheduled
    if (!coaching.nextCall?.datetime) continue;
    
    stats.coachingCalls.processed++;
    
    try {
      // Get coach info
      let coachName = 'Coach';
      let coachAvatarUrl: string | undefined;
      if (coaching.coachId) {
        const coachDoc = await db.collection('users').doc(coaching.coachId).get();
        if (coachDoc.exists) {
          const coachData = coachDoc.data();
          coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || 'Coach';
          coachAvatarUrl = coachData?.profileImageUrl || coachData?.imageUrl;
        }
      }
      
      // Get client info
      let clientName = 'Client';
      if (coaching.userId) {
        const clientDoc = await db.collection('users').doc(coaching.userId).get();
        if (clientDoc.exists) {
          const clientData = clientDoc.data();
          clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Client';
        }
      }
      
      const now = new Date().toISOString();
      const callDate = new Date(coaching.nextCall.datetime);
      
      const eventData: UnifiedEventMigration = {
        title: coaching.nextCall.title || `Coaching call with ${clientName}`,
        description: `1-on-1 coaching session`,
        startDateTime: coaching.nextCall.datetime,
        timezone: coaching.nextCall.timezone || 'UTC',
        durationMinutes: 60,
        
        locationType: coaching.nextCall.location?.startsWith('http') ? 'online' : 'chat',
        locationLabel: coaching.nextCall.location || 'Chat',
        meetingLink: coaching.nextCall.location?.startsWith('http') ? coaching.nextCall.location : undefined,
        
        eventType: 'coaching_1on1',
        scope: 'private',
        participantModel: 'invite_only',
        approvalType: 'none',
        status: callDate < new Date() ? 'completed' : 'confirmed',
        
        organizationId: coaching.organizationId || undefined,
        
        isRecurring: false,
        
        createdByUserId: coaching.coachId,
        hostUserId: coaching.coachId,
        hostName: coachName,
        hostAvatarUrl: coachAvatarUrl,
        isCoachLed: true,
        
        attendeeIds: [coaching.userId],
        maxAttendees: 2,
        
        chatChannelId: coaching.chatChannelId || undefined,
        sendChatReminders: true,
        
        createdAt: now,
        updatedAt: now,
      };
      
      // Create event with a predictable ID
      const eventId = `coaching_${coaching.userId}`;
      await db.collection('events').doc(eventId).set(eventData);
      
      stats.coachingCalls.created++;
      console.log(`  ✓ Created event for coaching relationship ${doc.id}`);
    } catch (error) {
      stats.coachingCalls.errors++;
      console.error(`  ✗ Failed to migrate coaching ${doc.id}:`, error);
    }
  }
  
  console.log(`  Done: ${stats.coachingCalls.processed} processed, ${stats.coachingCalls.created} created, ${stats.coachingCalls.errors} errors`);
}

// ============================================================================
// Migration 5: Scheduled Jobs
// ============================================================================

async function migrateScheduledJobs(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n⏰ Migrating Scheduled Jobs...');
  
  // Migrate squad call jobs
  const squadJobsSnapshot = await db.collection('squadCallScheduledJobs').get();
  
  for (const doc of squadJobsSnapshot.docs) {
    stats.scheduledJobs.processed++;
    const job = doc.data();
    
    try {
      // Determine new event ID
      let eventId: string;
      if (job.hasCoach) {
        eventId = `squad_call_${job.squadId}`;
      } else {
        eventId = `std_call_${job.callId}`;
      }
      
      const newJobId = `${eventId}_${job.jobType}`;
      
      await db.collection('eventScheduledJobs').doc(newJobId).set({
        id: newJobId,
        eventId,
        jobType: job.jobType,
        scheduledTime: job.scheduledTime,
        eventTitle: job.callTitle || 'Squad call',
        eventDateTime: job.callDateTime,
        eventTimezone: job.callTimezone,
        eventLocation: job.callLocation,
        eventType: 'squad_call',
        scope: 'squad',
        squadId: job.squadId,
        squadName: job.squadName,
        chatChannelId: job.chatChannelId,
        executed: job.executed,
        executedAt: job.executedAt,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
      
      stats.scheduledJobs.migrated++;
    } catch (error) {
      stats.scheduledJobs.errors++;
      console.error(`  ✗ Failed to migrate job ${doc.id}:`, error);
    }
  }
  
  // Migrate coaching call jobs
  const coachingJobsSnapshot = await db.collection('coachingCallScheduledJobs').get();
  
  for (const doc of coachingJobsSnapshot.docs) {
    stats.scheduledJobs.processed++;
    const job = doc.data();
    
    try {
      const eventId = `coaching_${job.userId}`;
      const newJobId = `${eventId}_${job.jobType}`;
      
      await db.collection('eventScheduledJobs').doc(newJobId).set({
        id: newJobId,
        eventId,
        jobType: job.jobType,
        scheduledTime: job.scheduledTime,
        eventTitle: job.callTitle || 'Coaching call',
        eventDateTime: job.callDateTime,
        eventTimezone: job.callTimezone,
        eventLocation: job.callLocation,
        eventType: 'coaching_1on1',
        scope: 'private',
        hostUserId: job.coachId,
        hostName: job.coachName,
        clientUserId: job.userId,
        clientName: job.clientName,
        chatChannelId: job.chatChannelId,
        executed: job.executed,
        executedAt: job.executedAt,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
      
      stats.scheduledJobs.migrated++;
    } catch (error) {
      stats.scheduledJobs.errors++;
      console.error(`  ✗ Failed to migrate job ${doc.id}:`, error);
    }
  }
  
  console.log(`  Done: ${stats.scheduledJobs.processed} processed, ${stats.scheduledJobs.migrated} migrated, ${stats.scheduledJobs.errors} errors`);
}

// ============================================================================
// Main Migration Function
// ============================================================================

async function runMigration(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  UNIFIED EVENTS MIGRATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  This is a one-time migration. Ensure you have a database backup!');
  console.log('');
  
  const db = initializeFirebase();
  
  try {
    // Run migrations in order
    await migrateDiscoverEvents(db);
    await migrateCoachSquadCalls(db);
    await migrateStandardSquadCalls(db);
    await migrateCoachingCalls(db);
    await migrateScheduledJobs(db);
    
    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📅 Discover Events:');
    console.log(`   Processed: ${stats.discoverEvents.processed}`);
    console.log(`   Updated: ${stats.discoverEvents.updated}`);
    console.log(`   Errors: ${stats.discoverEvents.errors}`);
    console.log('');
    console.log('📞 Coach Squad Calls:');
    console.log(`   Processed: ${stats.coachSquadCalls.processed}`);
    console.log(`   Created: ${stats.coachSquadCalls.created}`);
    console.log(`   Errors: ${stats.coachSquadCalls.errors}`);
    console.log('');
    console.log('🗳️ Standard Squad Calls:');
    console.log(`   Processed: ${stats.standardSquadCalls.processed}`);
    console.log(`   Created: ${stats.standardSquadCalls.created}`);
    console.log(`   Errors: ${stats.standardSquadCalls.errors}`);
    console.log('');
    console.log('👤 Coaching Calls:');
    console.log(`   Processed: ${stats.coachingCalls.processed}`);
    console.log(`   Created: ${stats.coachingCalls.created}`);
    console.log(`   Errors: ${stats.coachingCalls.errors}`);
    console.log('');
    console.log('🗳️ Votes:');
    console.log(`   Processed: ${stats.votes.processed}`);
    console.log(`   Migrated: ${stats.votes.migrated}`);
    console.log(`   Errors: ${stats.votes.errors}`);
    console.log('');
    console.log('⏰ Scheduled Jobs:');
    console.log(`   Processed: ${stats.scheduledJobs.processed}`);
    console.log(`   Migrated: ${stats.scheduledJobs.migrated}`);
    console.log(`   Errors: ${stats.scheduledJobs.errors}`);
    console.log('');
    
    const totalErrors = 
      stats.discoverEvents.errors + 
      stats.coachSquadCalls.errors + 
      stats.standardSquadCalls.errors + 
      stats.coachingCalls.errors + 
      stats.votes.errors +
      stats.scheduledJobs.errors;
    
    if (totalErrors === 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log(`⚠️ Migration completed with ${totalErrors} errors. Review the logs above.`);
    }
    
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify data in Firestore console');
    console.log('2. Update UI components to use unified API');
    console.log('3. Run cleanup script to remove legacy collections');
    console.log('');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();


