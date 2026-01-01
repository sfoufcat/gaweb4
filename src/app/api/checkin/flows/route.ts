import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { OrgCheckInFlow, CheckInFlowType, CheckInFlowTemplate } from '@/types';

// Ensure this route is never cached - coaches expect immediate updates
export const dynamic = 'force-dynamic';

/**
 * GET /api/checkin/flows
 * Get available check-in flows for the authenticated user's organization
 * 
 * Query params:
 * - type?: 'morning' | 'evening' | 'weekly' (get specific flow type)
 * - enabledOnly?: 'true' (default: true - only get enabled flows)
 * 
 * Used by end-user app to determine which check-ins are available
 * 
 * IMPORTANT: Auto-creates default check-in flows if none exist for the org.
 * This ensures users can access check-ins even before coaches configure them.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org ID from tenant context (subdomain) or Clerk session
    const orgId = await getEffectiveOrgId();
    
    // Users without an org don't have org-specific check-in flows
    if (!orgId) {
      return NextResponse.json({ flows: [] });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as CheckInFlowType | null;
    const enabledOnly = searchParams.get('enabledOnly') !== 'false';

    // Build query - only filter by organizationId and type in Firestore
    // Filter by enabled in memory to avoid composite index requirements
    let query = adminDb
      .collection('orgCheckInFlows')
      .where('organizationId', '==', orgId);

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();

    let flows: { id: string; name: string; type: CheckInFlowType; description?: string; enabled: boolean; stepCount: number }[] = snapshot.docs.map(doc => {
      const data = doc.data() as Omit<OrgCheckInFlow, 'id'>;
      return {
        id: doc.id,
        name: data.name,
        type: data.type,
        description: data.description,
        enabled: data.enabled,
        stepCount: data.stepCount,
      };
    });

    // Auto-create default check-in flows if none exist for this organization
    // This ensures users can access check-ins even before coaches configure them
    if (flows.length === 0 && !type) {
      const templatesSnapshot = await adminDb
        .collection('checkInFlowTemplates')
        .get();
      
      if (!templatesSnapshot.empty) {
        const now = new Date().toISOString();
        const batch = adminDb.batch();
        const newFlows: { id: string; name: string; type: CheckInFlowType; description?: string; enabled: boolean; stepCount: number }[] = [];
        
        for (const templateDoc of templatesSnapshot.docs) {
          const template = templateDoc.data() as CheckInFlowTemplate;
          
          // Create new flow ref
          const flowRef = adminDb.collection('orgCheckInFlows').doc();
          
          const flowData: Omit<OrgCheckInFlow, 'id'> = {
            organizationId: orgId,
            name: template.name,
            type: template.key,
            description: template.description,
            enabled: true, // Enabled by default!
            stepCount: template.defaultSteps.length,
            isSystemDefault: true,
            createdFromTemplateId: template.id,
            templateVersion: template.version,
            createdByUserId: 'system', // Created automatically
            createdAt: now,
            updatedAt: now,
          };
          
          batch.set(flowRef, flowData);
          newFlows.push({
            id: flowRef.id,
            name: flowData.name,
            type: flowData.type,
            description: flowData.description,
            enabled: flowData.enabled,
            stepCount: flowData.stepCount,
          });
          
          // Create steps
          template.defaultSteps.forEach((step, index) => {
            const stepRef = adminDb
              .collection('orgCheckInFlows')
              .doc(flowRef.id)
              .collection('steps')
              .doc();
            
            batch.set(stepRef, {
              flowId: flowRef.id,
              order: step.order ?? index,
              type: step.type,
              name: step.name,
              config: step.config,
              conditions: step.conditions || [],
              conditionLogic: step.conditionLogic || 'and',
              createdAt: now,
              updatedAt: now,
            });
          });
        }
        
        await batch.commit();
        console.log(`[CHECKIN_FLOWS_GET] Auto-created ${newFlows.length} default flows for org ${orgId}`);
        
        // Use newly created flows
        flows = newFlows;
      }
    }

    // Filter by enabled status in memory (avoids needing composite index)
    // Use !== false to treat undefined/missing enabled field as true (default)
    if (enabledOnly) {
      flows = flows.filter(flow => flow.enabled !== false);
    }

    return NextResponse.json({ flows });
  } catch (error) {
    console.error('[CHECKIN_FLOWS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

