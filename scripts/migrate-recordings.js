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

// Bunny Storage config
const BUNNY_API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME;
const BUNNY_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME;
const BUNNY_CDN = process.env.NEXT_PUBLIC_BUNNY_STORAGE_CDN;

function isBunny(url) {
  return url && (url.includes('.b-cdn.net') || url.includes('bunnycdn'));
}

async function uploadToBunny(buffer, path, contentType) {
  const uploadUrl = `https://${BUNNY_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      AccessKey: BUNNY_API_KEY,
      'Content-Type': contentType,
    },
    body: buffer,
  });

  if (!response.ok) {
    throw new Error(`Bunny upload failed: ${response.status}`);
  }

  return `https://${BUNNY_CDN}/${path}`;
}

async function storeRecording(sourceUrl, orgId, identifier) {
  console.log(`  Downloading from ${sourceUrl.substring(0, 60)}...`);

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'video/mp4';
  const ext = contentType.includes('webm') ? 'webm' : 'mp4';
  const path = `orgs/${orgId}/recordings/${identifier}.${ext}`;

  console.log(`  Uploading ${(buffer.length / 1024 / 1024).toFixed(2)}MB to Bunny...`);

  return uploadToBunny(buffer, path, contentType);
}

async function migrateRecordings() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== Migrate Recordings to Bunny ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  if (!BUNNY_API_KEY || !BUNNY_STORAGE_ZONE || !BUNNY_HOSTNAME || !BUNNY_CDN) {
    console.error('Missing Bunny Storage configuration!');
    process.exit(1);
  }

  const snapshot = await db.collection('events')
    .orderBy('updatedAt', 'desc')
    .limit(200)
    .get();

  const nonBunny = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(e => e.recordingUrl && !isBunny(e.recordingUrl));

  console.log(`Found ${nonBunny.length} recordings to migrate\n`);

  if (nonBunny.length === 0) {
    console.log('All recordings already on Bunny!');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const event of nonBunny) {
    const { id, recordingUrl, organizationId, meetingProvider } = event;

    console.log(`Processing ${id} (${meetingProvider || 'stream'})...`);

    if (!organizationId) {
      console.log('  ⏭️  Skipped: No organizationId\n');
      continue;
    }

    // Skip non-stream providers (need special handling)
    if (meetingProvider === 'zoom' || meetingProvider === 'google_meet') {
      console.log(`  ⏭️  Skipped: ${meetingProvider} requires re-auth\n`);
      continue;
    }

    if (dryRun) {
      console.log(`  📋 Would migrate: ${recordingUrl.substring(0, 60)}...\n`);
      continue;
    }

    try {
      const newUrl = await storeRecording(recordingUrl, organizationId, id);

      await db.collection('events').doc(id).update({
        recordingUrl: newUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`  ✅ Migrated to: ${newUrl}\n`);
      success++;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}\n`);
      failed++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('=== Summary ===');
  console.log(`Successful: ${success}`);
  console.log(`Failed: ${failed}`);
}

migrateRecordings().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
