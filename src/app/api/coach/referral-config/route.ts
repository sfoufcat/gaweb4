/**
 * Coach API: Referral Configuration Management
 * 
 * GET /api/coach/referral-config - List referral configs for programs/squads
 * POST /api/coach/referral-config - Create/update referral config for a program/squad
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { Program, Squad, ReferralConfig, Funnel } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const targetType = searchParams.get('targetType') as 'program' | 'squad' | null;
    const targetId = searchParams.get('targetId');

    console.log(`[COACH_REFERRAL_CONFIG] Fetching referral configs for organization: ${organizationId}`);

    // If specific target requested, return just that config
    if (targetId && targetType) {
      const collection = targetType === 'program' ? 'programs' : 'squads';
      const docRef = await adminDb.collection(collection).doc(targetId).get();
      
      if (!docRef.exists) {
        return NextResponse.json({ error: `${targetType} not found` }, { status: 404 });
      }
      
      const data = docRef.data();
      if (data?.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      
      return NextResponse.json({
        referralConfig: data?.referralConfig || null,
        targetType,
        targetId,
        targetName: data?.name,
      });
    }

    // Fetch all programs and squads with referral configs
    const [programsSnapshot, squadsSnapshot] = await Promise.all([
      adminDb
        .collection('programs')
        .where('organizationId', '==', organizationId)
        .get(),
      adminDb
        .collection('squads')
        .where('organizationId', '==', organizationId)
        .where('coachId', '!=', null) // Only coached squads
        .get(),
    ]);

    interface ReferralConfigItem {
      targetType: 'program' | 'squad';
      targetId: string;
      targetName: string;
      referralConfig: ReferralConfig | null;
      funnelName?: string;
    }

    const configs: ReferralConfigItem[] = [];

    // Add programs with their referral configs
    for (const doc of programsSnapshot.docs) {
      const data = doc.data() as Program;
      configs.push({
        targetType: 'program',
        targetId: doc.id,
        targetName: data.name,
        referralConfig: data.referralConfig || null,
      });
    }

    // Add standalone squads (no programId) with their referral configs
    for (const doc of squadsSnapshot.docs) {
      const data = doc.data() as Squad;
      // Only include standalone/alumni squads (not program cohort squads)
      if (!data.programId) {
        configs.push({
          targetType: 'squad',
          targetId: doc.id,
          targetName: data.name,
          referralConfig: data.referralConfig || null,
        });
      }
    }

    // Fetch funnel names for configs that have funnels
    const funnelIds = configs
      .filter(c => c.referralConfig?.funnelId)
      .map(c => c.referralConfig!.funnelId);
    
    if (funnelIds.length > 0) {
      const uniqueFunnelIds = [...new Set(funnelIds)];
      const funnelDocs = await Promise.all(
        uniqueFunnelIds.map(id => adminDb.collection('funnels').doc(id).get())
      );
      
      const funnelNames: Record<string, string> = {};
      funnelDocs.forEach(doc => {
        if (doc.exists) {
          funnelNames[doc.id] = (doc.data() as Funnel).name;
        }
      });
      
      configs.forEach(c => {
        if (c.referralConfig?.funnelId) {
          c.funnelName = funnelNames[c.referralConfig.funnelId];
        }
      });
    }

    return NextResponse.json({
      configs,
      totalCount: configs.length,
      enabledCount: configs.filter(c => c.referralConfig?.enabled).length,
    });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    
    console.error('[COACH_REFERRAL_CONFIG_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();
    const body = await request.json();
    
    const { targetType, targetId, referralConfig } = body as {
      targetType: 'program' | 'squad';
      targetId: string;
      referralConfig: ReferralConfig;
    };

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      );
    }

    if (!['program', 'squad'].includes(targetType)) {
      return NextResponse.json(
        { error: 'targetType must be "program" or "squad"' },
        { status: 400 }
      );
    }

    // Validate the config
    if (referralConfig?.enabled && !referralConfig.funnelId) {
      return NextResponse.json(
        { error: 'A funnel must be selected when referrals are enabled' },
        { status: 400 }
      );
    }

    const collection = targetType === 'program' ? 'programs' : 'squads';
    const docRef = adminDb.collection(collection).doc(targetId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: `${targetType} not found` }, { status: 404 });
    }

    const data = doc.data();
    if (data?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // If funnel is specified, verify it exists and belongs to this org
    if (referralConfig?.funnelId) {
      const funnelDoc = await adminDb.collection('funnels').doc(referralConfig.funnelId).get();
      if (!funnelDoc.exists) {
        return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
      }
      const funnel = funnelDoc.data() as Funnel;
      if (funnel.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Funnel does not belong to this organization' }, { status: 403 });
      }
      
      // Verify the funnel targets the correct entity
      if (targetType === 'program' && funnel.programId !== targetId) {
        return NextResponse.json(
          { error: 'Funnel must be associated with this program' },
          { status: 400 }
        );
      }
      if (targetType === 'squad' && funnel.squadId !== targetId) {
        return NextResponse.json(
          { error: 'Funnel must be associated with this squad' },
          { status: 400 }
        );
      }
    }

    // If a reward freeProgramId is specified, verify it exists
    if (referralConfig?.reward?.type === 'free_program' && referralConfig.reward.freeProgramId) {
      const programDoc = await adminDb.collection('programs').doc(referralConfig.reward.freeProgramId).get();
      if (!programDoc.exists) {
        return NextResponse.json({ error: 'Reward program not found' }, { status: 404 });
      }
      const program = programDoc.data() as Program;
      if (program.organizationId !== organizationId) {
        return NextResponse.json({ error: 'Reward program does not belong to this organization' }, { status: 403 });
      }
    }

    console.log(`[COACH_REFERRAL_CONFIG] Updating referral config for ${targetType} ${targetId} by user ${userId}`);

    // Update the document
    await docRef.update({
      referralConfig: referralConfig || FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      targetType,
      targetId,
      referralConfig,
    });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    
    console.error('[COACH_REFERRAL_CONFIG_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


