/**
 * Promote User to Super Admin via Clerk
 * 
 * This script promotes a user to super_admin by updating their Clerk publicMetadata.
 * 
 * Usage:
 * 1. Set CLERK_SECRET_KEY in your environment (via Doppler or .env.local)
 * 2. Update USER_EMAIL below
 * 3. Run: doppler run -- npx tsx scripts/make-superadmin-clerk.ts
 */

import { createClerkClient } from '@clerk/backend';

const USER_EMAIL = 'nourchaaban20@gmail.com';

async function makeSuperAdmin() {
  try {
    console.log('🔄 Promoting user to super_admin via Clerk...');
    console.log(`   Email: ${USER_EMAIL}`);

    // Initialize Clerk client
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    
    if (!clerkSecretKey) {
      console.error('\n❌ Error: CLERK_SECRET_KEY not found in environment');
      console.log('\n💡 Make sure to run with Doppler:');
      console.log('   doppler run -- npx tsx scripts/make-superadmin-clerk.ts\n');
      process.exit(1);
    }

    const clerk = createClerkClient({ secretKey: clerkSecretKey });

    // Find user by email
    console.log('\n🔍 Looking up user in Clerk...');
    const users = await clerk.users.getUserList({
      emailAddress: [USER_EMAIL],
    });

    if (users.totalCount === 0) {
      console.error('\n❌ Error: No user found with that email');
      console.log('\n💡 Make sure:');
      console.log('   - The email is correct');
      console.log('   - The user has signed up at least once');
      console.log('   - You are using the correct Clerk environment\n');
      process.exit(1);
    }

    const user = users.data[0];
    const currentRole = (user.publicMetadata?.role as string) || 'user';

    console.log(`\n👤 Found user:`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.emailAddresses[0]?.emailAddress}`);
    console.log(`   Current Role: ${currentRole}`);

    // Update role to super_admin
    console.log('\n⚡ Updating role to super_admin...');
    await clerk.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        role: 'super_admin',
      },
    });

    console.log('\n✅ Successfully promoted to super_admin!');
    console.log('\n🎉 Next steps:');
    console.log('   1. Sign out of Growth Addicts (if logged in)');
    console.log('   2. Sign back in to get new JWT with super_admin role');
    console.log('   3. Look for the "Admin" menu item in the sidebar');
    console.log('   4. Click it to access the Admin Panel');
    console.log('   5. You now have full admin access!\n');
    console.log('💡 Note: The role is stored in your JWT token, so you must');
    console.log('   sign out and back in for it to take effect.\n');

  } catch (error) {
    console.error('\n❌ Error promoting user:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('   - Check your Clerk secret key is correct');
    console.log('   - Ensure Doppler is properly configured');
    console.log('   - Verify the user email is correct\n');
    process.exit(1);
  }
}

// Run the script
makeSuperAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

