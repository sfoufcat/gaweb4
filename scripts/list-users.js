const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('❌ Missing Firebase environment variables');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

async function listUsers() {
  try {
    console.log('Fetching all users...\n');
    
    const usersRef = db.collection('users');
    const snapshot = await usersRef.limit(20).get();
    
    if (snapshot.empty) {
      console.log('No users found in the database.');
      process.exit(0);
    }
    
    console.log(`Found ${snapshot.size} users:\n`);
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ID: ${doc.id}`);
      console.log(`   Name: ${data.name || data.firstName} ${data.lastName || ''}`);
      console.log(`   Email: ${data.email || 'N/A'}`);
      console.log(`   Role: ${data.role || 'user'}`);
      console.log('');
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listUsers();















