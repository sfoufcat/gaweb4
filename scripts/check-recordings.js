const admin = require('firebase-admin');

// Initialize with individual env vars
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

function isBunny(url) {
  return url && (url.includes('.b-cdn.net') || url.includes('bunnycdn'));
}

async function findRecordings() {
  const snapshot = await db.collection('events')
    .orderBy('updatedAt', 'desc')
    .limit(200)
    .get();

  const events = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(e => e.recordingUrl);

  const bunnyCount = events.filter(e => isBunny(e.recordingUrl)).length;
  const nonBunny = events.filter(e => !isBunny(e.recordingUrl));

  console.log('=== Recording URLs Status ===');
  console.log('Total with recordingUrl:', events.length);
  console.log('Already on Bunny:', bunnyCount);
  console.log('Need migration:', nonBunny.length);

  if (nonBunny.length > 0) {
    console.log('\nNon-Bunny recordings:');
    nonBunny.forEach(e => {
      const provider = e.meetingProvider || 'stream';
      const urlPreview = e.recordingUrl.substring(0, 70);
      console.log(`  - ${e.id} (${provider}): ${urlPreview}...`);
    });
  }
}

findRecordings().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
