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
import type { Program, Squad, ReferralConfig, Funnel, ReferralResourceType } from '@/types';

// Resource collections and their display names
const RESOURCE_COLLECTIONS: Record<ReferralResourceType, { collection: string; displayName: string }> = {
  course: { collection: 'courses', displayName: 'Course' },
  article: { collection: 'articles', displayName: 'Article' },
  download: { collection: 'downloads', displayName: 'Download' },
  video: { collection: 'videos', displayName: 'Video' },
  link: { collection: 'links', displayName: 'Link' },
};

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);

    // Optional filters
    const targetType = searchParams.get('targetType') as 'program' | 'squad' | ReferralResourceType | null;
    const targetId = searchParams.get('targetId');
    const includeResources = searchParams.get('includeResources') !== 'false'; // Default true

    console.log(`[COACH_REFERRAL_CONFIG] Fetching referral configs for organization: ${organizationId}`);

    // If specific target requested, return just that config
    if (targetId && targetType) {
      let collection: string;
      if (targetType === 'program') {
        collection = 'programs';
      } else if (targetType === 'squad') {
        collection = 'squads';
      } else if (RESOURCE_COLLECTIONS[targetType as ReferralResourceType]) {
        collection = RESOURCE_COLLECTIONS[targetType as ReferralResourceType].collection;
      } else {
        return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 });
      }

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
        targetName: data?.name || data?.title,
      });
    }

    // Fetch all programs, squads, and resources with referral configs
    const fetchPromises: Promise<FirebaseFirestore.QuerySnapshot>[] = [
      adminDb
        .collection('programs')
        .where('organizationId', '==', organizationId)
        .get(),
      adminDb
        .collection('squads')
        .where('organizationId', '==', organizationId)
        .where('coachId', '!=', null) // Only coached squads
        .get(),
    ];

    // Also fetch resources if requested
    if (includeResources) {
      for (const resourceType of Object.keys(RESOURCE_COLLECTIONS) as ReferralResourceType[]) {
        const { collection } = RESOURCE_COLLECTIONS[resourceType];
        fetchPromises.push(
          adminDb
            .collection(collection)
            .where('organizationId', '==', organizationId)
            .get()
        );
      }
    }

    const snapshots = await Promise.all(fetchPromises);
    const [programsSnapshot, squadsSnapshot, ...resourceSnapshots] = snapshots;

    interface ReferralConfigItem {
      targetType: 'program' | 'squad' | ReferralResourceType;
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

    // Add resources with their referral configs
    if (includeResources) {
      const resourceTypes = Object.keys(RESOURCE_COLLECTIONS) as ReferralResourceType[];
      resourceSnapshots.forEach((snapshot, idx) => {
        const resourceType = resourceTypes[idx];
        for (const doc of snapshot.docs) {
          const data = doc.data();
          // Only include published resources
          if (data.status === 'published' || data.published) {
            configs.push({
              targetType: resourceType,
              targetId: doc.id,
              targetName: data.title || data.name,
              referralConfig: data.referralConfig || null,
            });
          }
        }
      });
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
      targetType: 'program' | 'squad' | ReferralResourceType;
      targetId: string;
      referralConfig: ReferralConfig;
    };

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      );
    }

    // Determine the collection based on target type
    let collection: string;
    if (targetType === 'program') {
      collection = 'programs';
    } else if (targetType === 'squad') {
      collection = 'squads';
    } else if (RESOURCE_COLLECTIONS[targetType as ReferralResourceType]) {
      collection = RESOURCE_COLLECTIONS[targetType as ReferralResourceType].collection;
    } else {
      return NextResponse.json(
        { error: 'Invalid targetType' },
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

      // Verify the funnel targets the correct entity (programs and squads only)
      // Resources can use any funnel for now
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

    // Validate reward based on type
    if (referralConfig?.reward?.type === 'free_program') {
      // Validate freeProgramId if specified
      if (referralConfig.reward.freeProgramId) {
        const programDoc = await adminDb.collection('programs').doc(referralConfig.reward.freeProgramId).get();
        if (!programDoc.exists) {
          return NextResponse.json({ error: 'Reward program not found' }, { status: 404 });
        }
        const program = programDoc.data() as Program;
        if (program.organizationId !== organizationId) {
          return NextResponse.json({ error: 'Reward program does not belong to this organization' }, { status: 403 });
        }
      }

      // Validate freeResourceId if specified (for courses, articles, etc.)
      if (referralConfig.reward.freeResourceId && referralConfig.reward.freeResourceType) {
        // Map resource type to collection name
        const resourceCollections: Record<string, string> = {
          article: 'articles',
          course: 'courses',
          video: 'videos',
          download: 'downloads',
          link: 'links',
        };
        const collectionName = resourceCollections[referralConfig.reward.freeResourceType];
        if (collectionName) {
          const resourceDoc = await adminDb.collection(collectionName).doc(referralConfig.reward.freeResourceId).get();
          if (!resourceDoc.exists) {
            return NextResponse.json({ error: 'Reward resource not found' }, { status: 404 });
          }
          const resource = resourceDoc.data();
          if (resource?.organizationId !== organizationId) {
            return NextResponse.json({ error: 'Reward resource does not belong to this organization' }, { status: 403 });
          }
        }
      }
    }

    // Validate monetary reward
    if (referralConfig?.reward?.type === 'monetary') {
      if (!referralConfig.reward.monetaryAmount || referralConfig.reward.monetaryAmount <= 0) {
        return NextResponse.json({ error: 'Monetary amount must be greater than 0' }, { status: 400 });
      }
    }

    console.log(`[COACH_REFERRAL_CONFIG] Updating referral config for ${targetType} ${targetId} by user ${userId}`);

    // Update the document
    // Store the config as-is (including { enabled: false } for disabled referrals)
    // This allows us to distinguish "explicitly disabled" from "never configured"
    await docRef.update({
      referralConfig: referralConfig ?? FieldValue.delete(),
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


