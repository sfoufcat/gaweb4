import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config();

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

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const TARGET_EMAIL = 'youmna1995h@gmail.com';

async function diagnose() {
  console.log(`🔍 Diagnosing payment issues for: ${TARGET_EMAIL}\n`);

  // 1. Check Firebase User
  console.log('--- Checking Firebase User ---');
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', TARGET_EMAIL).get();

  if (snapshot.empty) {
    console.log('❌ No user found in Firebase with this email.');
    // Try to list all users and search manually in case email field is missing or different
    // skipping for now to keep it simple
  } else {
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`✅ Found User ID: ${doc.id}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Billing Status: ${data.billing?.status}`);
      console.log(`   Stripe Customer ID (Firebase): ${data.billing?.stripeCustomerId}`);
      console.log(`   Stripe Subscription ID (Firebase): ${data.billing?.stripeSubscriptionId}`);
      console.log(`   Current Period End: ${data.billing?.currentPeriodEnd}`);
    });
  }
  console.log('');

  // 2. Check Stripe Customer
  console.log('--- Checking Stripe Customer ---');
  try {
    const customers = await stripe.customers.list({
      email: TARGET_EMAIL,
      expand: ['data.subscriptions'],
    });

    if (customers.data.length === 0) {
      console.log('❌ No customer found in Stripe with this email.');
    } else {
      console.log(`✅ Found ${customers.data.length} customer(s) in Stripe:`);
      
      for (const customer of customers.data) {
        console.log(`\n   Customer ID: ${customer.id}`);
        console.log(`   Name: ${customer.name}`);
        console.log(`   Created: ${new Date(customer.created * 1000).toISOString()}`);
        
        // Check subscriptions
        const subscriptions = customer.subscriptions?.data || [];
        if (subscriptions.length === 0) {
          console.log('   ❌ No active subscriptions for this customer.');
        } else {
          subscriptions.forEach(sub => {
            console.log(`   ✅ Subscription ID: ${sub.id}`);
            console.log(`      Status: ${sub.status}`);
            console.log(`      Plan: ${sub.items.data[0]?.price?.nickname || sub.items.data[0]?.price?.id}`);
            console.log(`      Current Period End: ${new Date(sub.current_period_end * 1000).toISOString()}`);
          });
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Error querying Stripe:', error.message);
  }
  
  console.log('\n--- Diagnosis Complete ---');
  process.exit(0);
}

diagnose().catch(console.error);


