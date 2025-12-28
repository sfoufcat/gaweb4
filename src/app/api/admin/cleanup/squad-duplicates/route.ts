import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

interface DuplicateReport {
  squadId: string;
  userId: string;
  duplicateCount: number;
  keptRecordId: string;
  deletedRecordIds: string[];
}

interface SyncReport {
  squadId: string;
  originalMemberIds: string[];
  actualMemberIds: string[];
  addedMemberIds: string[];
  removedMemberIds: string[];
}

/**
 * POST /api/admin/cleanup/squad-duplicates
 * 
 * Cleanup endpoint that:
 * 1. Finds duplicate squadMembers records (same squadId + userId)
 * 2. Keeps only the oldest record, deletes duplicates
 * 3. Syncs squads.memberIds array with actual squadMembers records
 * 
 * Returns a report of what was cleaned.
 * 
 * This is a one-time admin-only cleanup utility.
 */
export async function POST() {
  try {
    await requireAdmin();

    const duplicateReports: DuplicateReport[] = [];
    const syncReports: SyncReport[] = [];

    // Step 1: Find all squadMembers
    const allMembersSnapshot = await adminDb.collection('squadMembers').get();
    
    // Group by squadId + userId to find duplicates
    const memberMap = new Map<string, Array<{ id: string; createdAt: string }>>();
    
    for (const doc of allMembersSnapshot.docs) {
      const data = doc.data();
      const key = `${data.squadId}:${data.userId}`;
      
      if (!memberMap.has(key)) {
        memberMap.set(key, []);
      }
      
      memberMap.get(key)!.push({
        id: doc.id,
        createdAt: data.createdAt || '2000-01-01T00:00:00.000Z', // Default old date for records without createdAt
      });
    }

    // Step 2: Process duplicates
    for (const [key, records] of memberMap.entries()) {
      if (records.length <= 1) continue; // No duplicates
      
      const [squadId, userId] = key.split(':');
      
      // Sort by createdAt ascending (oldest first)
      records.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      // Keep the oldest record, delete the rest
      const [keepRecord, ...deleteRecords] = records;
      
      const report: DuplicateReport = {
        squadId,
        userId,
        duplicateCount: deleteRecords.length,
        keptRecordId: keepRecord.id,
        deletedRecordIds: deleteRecords.map(r => r.id),
      };
      
      // Delete duplicate records
      const batch = adminDb.batch();
      for (const record of deleteRecords) {
        batch.delete(adminDb.collection('squadMembers').doc(record.id));
      }
      await batch.commit();
      
      duplicateReports.push(report);
      console.log(`[CLEANUP] Deleted ${deleteRecords.length} duplicate(s) for squad:${squadId} user:${userId}`);
    }

    // Step 3: Sync squads.memberIds with actual squadMembers records
    const squadsSnapshot = await adminDb.collection('squads').get();
    
    for (const squadDoc of squadsSnapshot.docs) {
      const squadData = squadDoc.data();
      const squadId = squadDoc.id;
      const currentMemberIds: string[] = squadData.memberIds || [];
      
      // Get actual members from squadMembers collection
      const actualMembersSnapshot = await adminDb.collection('squadMembers')
        .where('squadId', '==', squadId)
        .get();
      
      const actualMemberIds = actualMembersSnapshot.docs.map(doc => doc.data().userId);
      
      // Calculate diff
      const currentSet = new Set(currentMemberIds);
      const actualSet = new Set(actualMemberIds);
      
      const addedMemberIds = actualMemberIds.filter(id => !currentSet.has(id));
      const removedMemberIds = currentMemberIds.filter(id => !actualSet.has(id));
      
      // Only update if there are differences
      if (addedMemberIds.length > 0 || removedMemberIds.length > 0) {
        // Replace memberIds array entirely with actual members
        await adminDb.collection('squads').doc(squadId).update({
          memberIds: actualMemberIds,
          updatedAt: FieldValue.serverTimestamp(),
        });
        
        syncReports.push({
          squadId,
          originalMemberIds: currentMemberIds,
          actualMemberIds,
          addedMemberIds,
          removedMemberIds,
        });
        
        console.log(`[CLEANUP] Synced squad ${squadId} memberIds: +${addedMemberIds.length} -${removedMemberIds.length}`);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        duplicateRecordsDeleted: duplicateReports.reduce((sum, r) => sum + r.duplicateCount, 0),
        squadsWithDuplicates: duplicateReports.length,
        squadsSynced: syncReports.length,
      },
      duplicateReports,
      syncReports,
    });
  } catch (error) {
    console.error('[ADMIN_CLEANUP_SQUAD_DUPLICATES_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * GET /api/admin/cleanup/squad-duplicates
 * 
 * Dry run - shows what would be cleaned without making changes.
 */
export async function GET() {
  try {
    await requireAdmin();

    const duplicateReports: DuplicateReport[] = [];
    const syncReports: SyncReport[] = [];

    // Step 1: Find all squadMembers
    const allMembersSnapshot = await adminDb.collection('squadMembers').get();
    
    // Group by squadId + userId to find duplicates
    const memberMap = new Map<string, Array<{ id: string; createdAt: string }>>();
    
    for (const doc of allMembersSnapshot.docs) {
      const data = doc.data();
      const key = `${data.squadId}:${data.userId}`;
      
      if (!memberMap.has(key)) {
        memberMap.set(key, []);
      }
      
      memberMap.get(key)!.push({
        id: doc.id,
        createdAt: data.createdAt || '2000-01-01T00:00:00.000Z',
      });
    }

    // Step 2: Process duplicates (dry run)
    for (const [key, records] of memberMap.entries()) {
      if (records.length <= 1) continue;
      
      const [squadId, userId] = key.split(':');
      
      records.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      const [keepRecord, ...deleteRecords] = records;
      
      duplicateReports.push({
        squadId,
        userId,
        duplicateCount: deleteRecords.length,
        keptRecordId: keepRecord.id,
        deletedRecordIds: deleteRecords.map(r => r.id),
      });
    }

    // Step 3: Check squads.memberIds sync (dry run)
    const squadsSnapshot = await adminDb.collection('squads').get();
    
    for (const squadDoc of squadsSnapshot.docs) {
      const squadData = squadDoc.data();
      const squadId = squadDoc.id;
      const currentMemberIds: string[] = squadData.memberIds || [];
      
      const actualMembersSnapshot = await adminDb.collection('squadMembers')
        .where('squadId', '==', squadId)
        .get();
      
      const actualMemberIds = actualMembersSnapshot.docs.map(doc => doc.data().userId);
      
      const currentSet = new Set(currentMemberIds);
      const actualSet = new Set(actualMemberIds);
      
      const addedMemberIds = actualMemberIds.filter(id => !currentSet.has(id));
      const removedMemberIds = currentMemberIds.filter(id => !actualSet.has(id));
      
      if (addedMemberIds.length > 0 || removedMemberIds.length > 0) {
        syncReports.push({
          squadId,
          originalMemberIds: currentMemberIds,
          actualMemberIds,
          addedMemberIds,
          removedMemberIds,
        });
      }
    }

    return NextResponse.json({
      dryRun: true,
      summary: {
        duplicateRecordsToDelete: duplicateReports.reduce((sum, r) => sum + r.duplicateCount, 0),
        squadsWithDuplicates: duplicateReports.length,
        squadsToSync: syncReports.length,
      },
      duplicateReports,
      syncReports,
      instruction: 'This is a dry run. To execute cleanup, make a POST request to the same endpoint.',
    });
  } catch (error) {
    console.error('[ADMIN_CLEANUP_SQUAD_DUPLICATES_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}




