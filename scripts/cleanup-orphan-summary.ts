import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if already initialized
if (getApps().length === 0) {
  initializeApp({
    credential: cert(join(__dirname, '../serviceAccountKey.json')),
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
  const weeks = data?.weeks || [];

  let modified = false;
  for (const week of weeks) {
    if (week.linkedSummaryIds?.includes(orphanSummaryId)) {
      week.linkedSummaryIds = week.linkedSummaryIds.filter((id: string) => id !== orphanSummaryId);
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
