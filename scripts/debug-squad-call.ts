/**
 * Debug Script: Squad Call Visibility
 * 
 * This script helps debug why a squad call is not showing up in the calendar.
 * It checks:
 * 1. Squad data (memberIds, coachId, programId)
 * 2. Events in the events collection for this squad
 * 3. User membership data
 * 
 * Run with: npx ts-node scripts/debug-squad-call.ts
 */

import * as admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
function initializeFirebaseAdmin(): admin.firestore.Firestore {
  if (getApps().length === 0) {
    // Check for individual env vars (used by Doppler)
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      throw new Error('Please set Firebase credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
    }
  }
  
  return getFirestore();
}

async function main() {
  console.log('\n🔍 Debug: Squad Call Visibility\n');
  console.log('='.repeat(60));
  
  const db = initializeFirebaseAdmin();
  
  // Step 1: Find squads with "Mindset Mastery" in name or belonging to that program
  console.log('\n📋 Step 1: Searching for Mindset Mastery squad...\n');
  
  const squadsSnapshot = await db.collection('squads').get();
  const allSquads = squadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Find squads that match "Mindset Mastery"
  const matchingSquads = allSquads.filter((s: any) => 
    s.name?.toLowerCase().includes('mindset') || 
    s.name?.toLowerCase().includes('mastery')
  );
  
  if (matchingSquads.length === 0) {
    console.log('❌ No squads found with "Mindset Mastery" in name.');
    console.log('\nListing all squads for reference:\n');
    allSquads.slice(0, 20).forEach((s: any) => {
      console.log(`  - ${s.id}: "${s.name}" (programId: ${s.programId || 'none'})`);
    });
    
    // Also check programs
    console.log('\n📋 Checking programs...\n');
    const programsSnapshot = await db.collection('programs').get();
    const matchingPrograms = programsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((p: any) => 
        p.name?.toLowerCase().includes('mindset') || 
        p.name?.toLowerCase().includes('mastery')
      );
    
    if (matchingPrograms.length > 0) {
      console.log('Found matching programs:');
      for (const prog of matchingPrograms) {
        console.log(`  - ${(prog as any).id}: "${(prog as any).name}"`);
        
        // Find squads for this program
        const programSquads = allSquads.filter((s: any) => s.programId === (prog as any).id);
        if (programSquads.length > 0) {
          console.log('    Squads for this program:');
          programSquads.forEach((s: any) => {
            console.log(`      - ${s.id}: "${s.name}"`);
          });
        }
      }
    }
    return;
  }
  
  console.log(`Found ${matchingSquads.length} matching squad(s):\n`);
  
  for (const squad of matchingSquads) {
    const s = squad as any;
    console.log('='.repeat(60));
    console.log(`\n🏠 Squad: "${s.name}" (ID: ${s.id})\n`);
    console.log('Squad Data:');
    console.log(`  - coachId: ${s.coachId || 'none'}`);
    console.log(`  - programId: ${s.programId || 'none'}`);
    console.log(`  - organizationId: ${s.organizationId || 'none'}`);
    console.log(`  - memberIds: ${JSON.stringify(s.memberIds || [])}`);
    console.log(`  - chatChannelId: ${s.chatChannelId || 'none'}`);
    
    // Check legacy call fields
    console.log('\nLegacy Call Fields:');
    console.log(`  - nextCallDateTime: ${s.nextCallDateTime || 'not set'}`);
    console.log(`  - nextCallTimezone: ${s.nextCallTimezone || 'not set'}`);
    console.log(`  - nextCallLocation: ${s.nextCallLocation || 'not set'}`);
    console.log(`  - nextCallTitle: ${s.nextCallTitle || 'not set'}`);
    
    // Step 2: Check events collection for this squad
    console.log('\n📅 Step 2: Checking events collection...\n');
    
    const eventsSnapshot = await db.collection('events')
      .where('squadId', '==', s.id)
      .get();
    
    if (eventsSnapshot.empty) {
      console.log('❌ No events found in events collection for this squad!');
      console.log('   This is likely the problem - the event was never created.');
      
      if (s.nextCallDateTime) {
        console.log('\n   ⚠️  Legacy nextCallDateTime IS set on squad document.');
        console.log('   The migration to unified events may not have been run.');
        console.log('   Or the call was scheduled via legacy API without creating an event.');
      }
    } else {
      console.log(`Found ${eventsSnapshot.size} event(s):\n`);
      
      eventsSnapshot.docs.forEach((doc, i) => {
        const e = doc.data();
        console.log(`  Event ${i + 1}: ${doc.id}`);
        console.log(`    - title: ${e.title}`);
        console.log(`    - startDateTime: ${e.startDateTime}`);
        console.log(`    - timezone: ${e.timezone}`);
        console.log(`    - status: ${e.status}`);
        console.log(`    - eventType: ${e.eventType}`);
        console.log(`    - organizationId: ${e.organizationId || 'not set'}`);
        console.log(`    - squadId: ${e.squadId}`);
        console.log(`    - programId: ${e.programId || 'not set'}`);
        console.log(`    - hostUserId: ${e.hostUserId}`);
        console.log(`    - attendeeIds: ${JSON.stringify(e.attendeeIds || [])}`);
        console.log(`    - visibility: ${e.visibility || 'not set'}`);
        console.log(`    - isRecurring: ${e.isRecurring}`);
        console.log('');
        
        // Check if startDateTime is in expected range for January 2026
        if (e.startDateTime) {
          const eventDate = new Date(e.startDateTime);
          const now = new Date();
          console.log(`    📆 Event date: ${eventDate.toISOString()}`);
          console.log(`    📆 Current date: ${now.toISOString()}`);
          console.log(`    📆 Is in future: ${eventDate > now}`);
        }
      });
    }
    
    // Step 3: Check a sample user's squad membership
    console.log('\n👥 Step 3: Checking user squad membership...\n');
    
    if (s.memberIds && s.memberIds.length > 0) {
      const sampleUserId = s.memberIds[0];
      const userDoc = await db.collection('users').doc(sampleUserId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log(`Sample user: ${sampleUserId}`);
        console.log(`  - squadIds in user doc: ${JSON.stringify(userData?.squadIds || [])}`);
        console.log(`  - Has this squad in squadIds: ${userData?.squadIds?.includes(s.id)}`);
      }
    } else {
      console.log('No memberIds on squad to check.');
    }
    
    // Also check if coach is in squadIds
    if (s.coachId) {
      const coachDoc = await db.collection('users').doc(s.coachId).get();
      if (coachDoc.exists) {
        const coachData = coachDoc.data();
        console.log(`\nCoach: ${s.coachId}`);
        console.log(`  - squadIds in user doc: ${JSON.stringify(coachData?.squadIds || [])}`);
        console.log(`  - Has this squad in squadIds: ${coachData?.squadIds?.includes(s.id)}`);
      }
    }
  }
  
  // Step 4: Check ALL events for January 4, 2026
  console.log('\n\n📅 Step 4: Checking all events around January 4, 2026...\n');
  
  const jan4Start = '2026-01-04T00:00:00';
  const jan4End = '2026-01-05T00:00:00';
  
  const jan4Events = await db.collection('events')
    .where('startDateTime', '>=', jan4Start)
    .where('startDateTime', '<', jan4End)
    .get();
  
  if (jan4Events.empty) {
    console.log('No events found for January 4, 2026.');
  } else {
    console.log(`Found ${jan4Events.size} event(s) on January 4, 2026:`);
    jan4Events.docs.forEach(doc => {
      const e = doc.data();
      console.log(`  - ${doc.id}: "${e.title}" (squadId: ${e.squadId}, status: ${e.status})`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Debug complete.\n');
}

main().catch(console.error);

