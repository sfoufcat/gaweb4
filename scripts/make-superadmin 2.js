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

async function makeSuperAdmin(email) {
  try {
    console.log(`Looking for user with email: ${email}...`);
    
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (snapshot.empty) {
      console.log(`❌ No user found with email: ${email}`);
      console.log('Please make sure the user has signed up first.');
      process.exit(1);
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    console.log(`Found user: ${userData.name || userData.firstName} ${userData.lastName || ''}`);
    console.log(`Current role: ${userData.role || 'user'}`);
    
    await userDoc.ref.update({
      role: 'super_admin',
      updatedAt: new Date().toISOString()
    });
    
    console.log(`✅ Successfully made ${email} a super admin!`);
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

const email = process.argv[2] || 'nourchaaban20@gmail.com';
makeSuperAdmin(email);

