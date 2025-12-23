/**
 * Cleanup Script: Remove Duplicate Templates
 * 
 * Run with: doppler run -- npx tsx scripts/cleanup-duplicate-templates.ts
 * 
 * This script finds duplicate templates by slug and removes all but one,
 * along with their associated template_days.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local if it exists
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  const hasServiceAccount = process.env.FIREBASE_PROJECT_ID && 
                            process.env.FIREBASE_CLIENT_EMAIL && 
                            process.env.FIREBASE_PRIVATE_KEY;
  
  if (hasServiceAccount) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    initializeApp({
      credential: applicationDefault(),
      projectId: 'gawebdev2-3191a',
    });
  }
}

const db = getFirestore();

interface TemplateDoc {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
}

async function cleanupDuplicates() {
  console.log('🧹 Starting duplicate template cleanup...\n');

  // Get all templates
  const templatesSnapshot = await db.collection('program_templates').get();
  
  console.log(`📊 Found ${templatesSnapshot.size} total templates\n`);

  // Group templates by slug
  const templatesBySlug = new Map<string, TemplateDoc[]>();
  
  templatesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const template: TemplateDoc = {
      id: doc.id,
      slug: data.slug,
      name: data.name,
      createdAt: data.createdAt,
    };
    
    if (!templatesBySlug.has(data.slug)) {
      templatesBySlug.set(data.slug, []);
    }
    templatesBySlug.get(data.slug)!.push(template);
  });

  // Find duplicates
  let totalDeleted = 0;
  let totalDaysDeleted = 0;

  for (const [slug, templates] of templatesBySlug) {
    if (templates.length > 1) {
      console.log(`🔍 Found ${templates.length} copies of "${slug}":`);
      
      // Sort by createdAt descending (newest first)
      templates.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Keep the first one (newest), delete the rest
      const [keep, ...toDelete] = templates;
      console.log(`   ✅ Keeping: ${keep.id} (${keep.createdAt})`);
      
      for (const template of toDelete) {
        console.log(`   🗑️  Deleting: ${template.id} (${template.createdAt})`);
        
        // Delete associated template_days first
        const daysSnapshot = await db
          .collection('template_days')
          .where('templateId', '==', template.id)
          .get();
        
        if (!daysSnapshot.empty) {
          const batch = db.batch();
          daysSnapshot.docs.forEach(dayDoc => {
            batch.delete(dayDoc.ref);
          });
          await batch.commit();
          console.log(`      Deleted ${daysSnapshot.size} template days`);
          totalDaysDeleted += daysSnapshot.size;
        }
        
        // Delete the template
        await db.collection('program_templates').doc(template.id).delete();
        totalDeleted++;
      }
      
      console.log('');
    }
  }

  console.log('✨ Cleanup complete!');
  console.log(`   Deleted ${totalDeleted} duplicate templates`);
  console.log(`   Deleted ${totalDaysDeleted} orphaned template days`);
  
  // Final count
  const finalSnapshot = await db.collection('program_templates').get();
  console.log(`   Remaining templates: ${finalSnapshot.size}`);
}

// Run the cleanup
cleanupDuplicates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });

