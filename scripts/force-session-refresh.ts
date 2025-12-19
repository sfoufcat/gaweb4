/**
 * Force Clerk Session Refresh
 * 
 * This script helps debug and force refresh Clerk sessions
 * Run this if your JWT doesn't have the updated role
 */

import { createClerkClient } from '@clerk/backend';

const USER_EMAIL = 'nourchaaban20@gmail.com';

async function forceSessionRefresh() {
  try {
    console.log('🔄 Checking and refreshing Clerk session...');
    console.log(`   Email: ${USER_EMAIL}\n`);

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    
    if (!clerkSecretKey) {
      console.error('❌ Error: CLERK_SECRET_KEY not found');
      process.exit(1);
    }

    const clerk = createClerkClient({ secretKey: clerkSecretKey });

    // Find user
    const users = await clerk.users.getUserList({
      emailAddress: [USER_EMAIL],
    });

    if (users.totalCount === 0) {
      console.error('❌ User not found');
      process.exit(1);
    }

    const user = users.data[0];

    console.log('👤 Current User Info:');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.emailAddresses[0]?.emailAddress}`);
    console.log(`   Public Metadata:`, JSON.stringify(user.publicMetadata, null, 2));
    console.log(`   Role in Metadata: ${(user.publicMetadata as any)?.role || 'NOT SET'}\n`);

    // If role is not set, set it now
    if (!(user.publicMetadata as any)?.role) {
      console.log('⚠️  Role not found in publicMetadata, setting it now...');
      await clerk.users.updateUserMetadata(user.id, {
        publicMetadata: {
          role: 'super_admin',
        },
      });
      console.log('✅ Role set to super_admin\n');
    } else {
      console.log('✅ Role is already set in Clerk\n');
    }

    // Get all active sessions and revoke them to force refresh
    console.log('🔄 Revoking all active sessions to force refresh...');
    const sessions = await clerk.sessions.getSessionList({ userId: user.id });
    
    if (sessions.data && sessions.data.length > 0) {
      console.log(`   Found ${sessions.data.length} active session(s)`);
      
      for (const session of sessions.data) {
        await clerk.sessions.revokeSession(session.id);
        console.log(`   ✓ Revoked session: ${session.id}`);
      }
      
      console.log('\n✅ All sessions revoked!\n');
    } else {
      console.log('   No active sessions found\n');
    }

    console.log('🎉 Next steps:');
    console.log('   1. Go to Growth Addicts');
    console.log('   2. You should be automatically signed out');
    console.log('   3. Sign back in');
    console.log('   4. Fresh JWT with super_admin role will be created');
    console.log('   5. Admin menu will appear!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

forceSessionRefresh()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

