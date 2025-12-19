/**
 * Script to make a user an Editor via Clerk
 * 
 * Usage: npx ts-node scripts/make-editor-clerk.ts <user_email>
 * 
 * This sets the role in Clerk publicMetadata (the source of truth for roles)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.error('❌ CLERK_SECRET_KEY not found in environment');
  process.exit(1);
}

async function makeUserEditor(email: string) {
  console.log(`\n🔍 Looking up user with email: ${email}\n`);

  try {
    // Find user by email
    const searchResponse = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`Failed to search users: ${error}`);
    }

    const users = await searchResponse.json();

    if (!users || users.length === 0) {
      console.error(`❌ No user found with email: ${email}`);
      process.exit(1);
    }

    const user = users[0];
    console.log(`✅ Found user: ${user.first_name} ${user.last_name} (${user.id})`);
    console.log(`   Current role: ${user.public_metadata?.role || 'user'}`);

    // Update publicMetadata to set role as editor
    const updateResponse = await fetch(
      `https://api.clerk.com/v1/users/${user.id}/metadata`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_metadata: {
            ...user.public_metadata,
            role: 'editor',
          },
        }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update user: ${error}`);
    }

    console.log(`\n✨ Successfully made ${email} an Editor!`);
    console.log(`\n📋 What this means:`);
    console.log(`   • Can access /editor section to manage discover content`);
    console.log(`   • Can manage articles, events, and courses`);
    console.log(`   • Cannot access /admin section (users, squads, etc.)`);
    console.log(`   • Bypasses Stripe payment gateway`);
    console.log(`\n⚠️  User may need to sign out and back in for changes to take effect.`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.log('Usage: npx ts-node scripts/make-editor-clerk.ts <user_email>');
  console.log('Example: npx ts-node scripts/make-editor-clerk.ts editor@example.com');
  process.exit(1);
}

makeUserEditor(email);

