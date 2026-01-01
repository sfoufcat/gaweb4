// Testimonial Request Cron Job
// 
// Checks for coaches who signed up 14 days ago and queues testimonial request emails.
// Runs daily at 10 AM UTC.
// 
// Configure in vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/testimonial-requests",
//     "schedule": "0 10 * * *"
//   }]
// }

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { queueEmailsForTrigger, initializeEmailFlows } from '@/lib/email-automation';

// Vercel cron job secret (set in environment)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/testimonial-requests
 * Find coaches who signed up 14 days ago and queue testimonial emails
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret if configured
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        console.warn('[TESTIMONIAL_CRON] Invalid cron secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    console.log('[TESTIMONIAL_CRON] Starting testimonial request check...');
    
    // Initialize flows if needed
    await initializeEmailFlows();
    
    // Calculate the date range for 14 days ago (with 1 day window)
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - 14);
    
    // Start of target day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    // End of target day
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Find coach subscriptions created 14 days ago that are still active
    const subscriptionsSnapshot = await adminDb
      .collection('coach_subscriptions')
      .where('createdAt', '>=', startOfDay.toISOString())
      .where('createdAt', '<=', endOfDay.toISOString())
      .where('status', 'in', ['active', 'trialing'])
      .get();
    
    if (subscriptionsSnapshot.empty) {
      console.log('[TESTIMONIAL_CRON] No coaches eligible for testimonial request today');
      return NextResponse.json({
        success: true,
        checked: 0,
        queued: 0,
        timestamp: now.toISOString(),
      });
    }
    
    let queued = 0;
    const errors: string[] = [];
    
    for (const doc of subscriptionsSnapshot.docs) {
      const subscription = doc.data();
      
      // Skip if we've already sent testimonial request
      if (subscription.testimonialRequestSent) {
        continue;
      }
      
      try {
        // Get user email
        const orgSettingsDoc = await adminDb
          .collection('org_settings')
          .doc(subscription.organizationId)
          .get();
        
        const orgSettings = orgSettingsDoc.data();
        
        // Try to get email from org membership
        const membershipSnapshot = await adminDb
          .collection('org_memberships')
          .where('organizationId', '==', subscription.organizationId)
          .where('userId', '==', subscription.userId)
          .limit(1)
          .get();
        
        let email: string | undefined;
        let firstName: string | undefined;
        
        if (!membershipSnapshot.empty) {
          const membership = membershipSnapshot.docs[0].data();
          firstName = membership.firstName;
          // Email not stored in membership, would need to fetch from Clerk
        }
        
        // For now, we'll need to have email stored somewhere accessible
        // Let's check if there's an email field in org_settings or coach_onboarding
        const onboardingDoc = await adminDb
          .collection('coach_onboarding')
          .doc(subscription.organizationId)
          .get();
        
        const onboarding = onboardingDoc.data();
        email = onboarding?.email || orgSettings?.contactEmail;
        
        if (!email) {
          // Skip if we can't find email (would need Clerk API call)
          console.log(`[TESTIMONIAL_CRON] Skipping org ${subscription.organizationId} - no email found`);
          continue;
        }
        
        // Try to get quiz data for personalization
        const emailVariables: Record<string, string> = {
          firstName: firstName || 'there',
        };
        
        // Look up quiz lead data for this email
        try {
          const quizLeadSnapshot = await adminDb
            .collection('quiz_leads')
            .where('email', '==', email)
            .limit(1)
            .get();
          
          if (!quizLeadSnapshot.empty) {
            const quizLead = quizLeadSnapshot.docs[0].data();
            if (quizLead.clientCount) {
              emailVariables.quizClientCount = quizLead.clientCount;
            }
            if (quizLead.frustrations && Array.isArray(quizLead.frustrations) && quizLead.frustrations.length > 0) {
              emailVariables.quizFrustrations = quizLead.frustrations.slice(0, 2).join(', ');
            }
            if (quizLead.impactFeatures && Array.isArray(quizLead.impactFeatures) && quizLead.impactFeatures.length > 0) {
              emailVariables.quizImpactFeatures = quizLead.impactFeatures.slice(0, 2).join(', ');
            }
          }
        } catch (quizErr) {
          console.warn(`[TESTIMONIAL_CRON] Failed to fetch quiz data for ${email}:`, quizErr);
          // Continue without quiz data
        }
        
        // Queue the testimonial request email
        const result = await queueEmailsForTrigger(
          'day_14',
          email,
          subscription.userId,
          subscription.organizationId,
          emailVariables
        );
        
        if (result.success && result.queuedCount > 0) {
          queued++;
          
          // Mark that we've sent testimonial request
          await doc.ref.update({
            testimonialRequestSent: true,
            testimonialRequestSentAt: now.toISOString(),
          });
          
          console.log(`[TESTIMONIAL_CRON] Queued testimonial request for ${email} (org: ${subscription.organizationId})`);
        }
        
      } catch (err) {
        const errorMsg = `Error processing org ${subscription.organizationId}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(`[TESTIMONIAL_CRON] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    console.log(`[TESTIMONIAL_CRON] Complete: checked ${subscriptionsSnapshot.size}, queued ${queued}`);
    
    return NextResponse.json({
      success: true,
      checked: subscriptionsSnapshot.size,
      queued,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
    
  } catch (error) {
    console.error('[TESTIMONIAL_CRON] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process testimonial requests',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/testimonial-requests
 * Manual trigger for testing
 */
export async function POST(request: Request) {
  return GET(request);
}

