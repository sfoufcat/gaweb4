
import { adminDb } from '../src/lib/firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function fixFeedCounts() {
  console.log('Starting feed counts fix...');

  try {
    // 1. Get all posts
    const postsSnapshot = await adminDb.collection('feed_posts').get();
    console.log(`Found ${postsSnapshot.size} posts.`);

    let updatedCount = 0;

    for (const postDoc of postsSnapshot.docs) {
      const post = postDoc.data();
      const postId = postDoc.id;
      const currentCount = post.commentCount || 0;

      // 2. Count actual comments for this post
      const commentsSnapshot = await adminDb
        .collection('feed_comments')
        .where('postId', '==', postId)
        .count()
        .get();

      const actualCount = commentsSnapshot.data().count;

      if (currentCount !== actualCount) {
        console.log(`Mismatch for post ${postId}: stored=${currentCount}, actual=${actualCount}. Updating...`);
        
        await postDoc.ref.update({
          commentCount: actualCount
        });
        
        updatedCount++;
      }
    }

    console.log(`Finished! Updated ${updatedCount} posts.`);
  } catch (error) {
    console.error('Error fixing feed counts:', error);
  }
}

// Run the function
fixFeedCounts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });


