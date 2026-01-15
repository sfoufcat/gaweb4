const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(),
  });
}

const db = getFirestore();

async function cleanupOrphan() {
  const instanceId = 'KSf31xFhFMMYW8RautPe';
  const orphanSummaryId = 'bSYmdhent0MF3YoaflBZ';

  const instanceRef = db.collection('program_instances').doc(instanceId);
  const doc = await instanceRef.get();

  if (!doc.exists) {
    console.log('Instance not found');
    return;
  }

  const data = doc.data();
  const weeks = data.weeks || [];

  let modified = false;
  for (const week of weeks) {
    if (week.linkedSummaryIds && week.linkedSummaryIds.includes(orphanSummaryId)) {
      week.linkedSummaryIds = week.linkedSummaryIds.filter(id => id !== orphanSummaryId);
      console.log('Removed orphan from week', week.weekNumber);
      modified = true;
    }
  }

  if (modified) {
    await instanceRef.update({ weeks });
    console.log('Cleanup complete!');
  } else {
    console.log('Orphan not found in any week');
  }
}

cleanupOrphan().catch(console.error);
