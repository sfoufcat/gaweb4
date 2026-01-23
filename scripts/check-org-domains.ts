import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function check() {
  // Check for clearskin123
  const bySubdomain = await db.collection('org_domains')
    .where('subdomain', '==', 'clearskin123')
    .get();

  console.log('Found by subdomain clearskin123:', bySubdomain.size);

  // List recent org_domains
  const recent = await db.collection('org_domains')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log('\nRecent org_domains:');
  recent.forEach((doc) => {
    const data = doc.data();
    console.log('  -', data.subdomain, '->', data.organizationId);
  });
}

check().then(() => process.exit(0));
