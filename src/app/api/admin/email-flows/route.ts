/**
 * Admin Email Flows API
 * 
 * GET: List all email flows with stats
 * PATCH: Update flow (enable/disable)
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isSuperAdmin } from '@/lib/admin-utils-shared';
import { adminDb } from '@/lib/firebase-admin';
import { getAllFlowsWithStats, initializeEmailFlows } from '@/lib/email-automation';
import type { EmailFlow, EmailTemplate, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/admin/email-flows
 * List all email flows with their stats and templates
 */
export async function GET() {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!isSuperAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Initialize flows if needed
    await initializeEmailFlows();
    
    // Get flows with stats
    const flowsWithStats = await getAllFlowsWithStats();
    
    // Get templates for each flow
    const flowsWithTemplates = await Promise.all(
      flowsWithStats.map(async (flow) => {
        const templatesSnapshot = await adminDb
          .collection('email_templates')
          .where('flowId', '==', flow.id)
          .orderBy('order')
          .get();
        
        const templates = templatesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as EmailTemplate));
        
        return {
          ...flow,
          templates,
        };
      })
    );
    
    // Get queue stats
    const queueSnapshot = await adminDb
      .collection('email_queue')
      .where('cancelled', '==', false)
      .get();
    
    const queueStats = {
      pending: queueSnapshot.size,
    };
    
    return NextResponse.json({
      flows: flowsWithTemplates,
      queueStats,
    });
    
  } catch (error) {
    console.error('[ADMIN_EMAIL_FLOWS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email flows' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/email-flows
 * Update a flow or template
 * 
 * Body: {
 *   flowId?: string,
 *   templateId?: string,
 *   updates: { enabled?: boolean, ... }
 * }
 */
export async function PATCH(request: Request) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!isSuperAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const body = await request.json();
    const { flowId, templateId, updates } = body;
    
    const now = new Date().toISOString();
    
    if (templateId) {
      // Update template
      await adminDb.collection('email_templates').doc(templateId).update({
        ...updates,
        updatedAt: now,
      });
      
      console.log(`[ADMIN_EMAIL_FLOWS] Updated template ${templateId}:`, updates);
      
      return NextResponse.json({ success: true, updated: 'template' });
    }
    
    if (flowId) {
      // Update flow
      await adminDb.collection('email_flows').doc(flowId).update({
        ...updates,
        updatedAt: now,
      });
      
      console.log(`[ADMIN_EMAIL_FLOWS] Updated flow ${flowId}:`, updates);
      
      return NextResponse.json({ success: true, updated: 'flow' });
    }
    
    return NextResponse.json(
      { error: 'flowId or templateId required' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('[ADMIN_EMAIL_FLOWS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update email flow' },
      { status: 500 }
    );
  }
}

