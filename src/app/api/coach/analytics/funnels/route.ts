/**
 * Coach API: Funnel Analytics
 * 
 * GET /api/coach/analytics/funnels
 * 
 * Returns funnel-level analytics for the coach's organization:
 * - Views (sessions created)
 * - Starts (sessions with at least 1 step completed)
 * - Completions (sessions with purchase/enrollment)
 * - Revenue
 * - Conversion rates
 * - Drop-off by step
 * 
 * Query params:
 *   - funnelId: specific funnel (optional, returns all if not provided)
 *   - days: lookback period (default 30)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { withDemoMode } from '@/lib/demo-api';
import type { Funnel, FlowSession, FunnelStep } from '@/types';

interface FunnelStepAnalytics {
  stepIndex: number;
  stepId: string;
  stepType: string;
  views: number;
  completions: number;
  dropOff: number;
  dropOffRate: number;
}

interface FunnelAnalytics {
  id: string;
  name: string;
  programId?: string;
  programName?: string;
  squadId?: string;
  squadName?: string;
  isActive: boolean;
  
  // Metrics
  totalViews: number;
  totalStarts: number;
  totalCompletions: number;
  totalRevenue: number;
  
  // Rates
  startRate: number; // starts / views
  conversionRate: number; // completions / views
  completionRate: number; // completions / starts
  
  // Step breakdown
  steps: FunnelStepAnalytics[];
  
  // Highlight worst step
  highestDropOffStep?: {
    stepIndex: number;
    stepId: string;
    dropOffRate: number;
  };
  
  createdAt: string;
}

export async function GET(request: NextRequest) {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('analytics-funnels');
    if (demoData) return demoData;
    
    const { organizationId } = await requireCoachWithOrg();
    const { searchParams } = new URL(request.url);
    
    const funnelIdFilter = searchParams.get('funnelId');
    const days = parseInt(searchParams.get('days') || '30', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // Get funnels
    let funnelsQuery = adminDb
      .collection('funnels')
      .where('organizationId', '==', organizationId);
    
    if (funnelIdFilter) {
      funnelsQuery = funnelsQuery.where('__name__', '==', funnelIdFilter);
    }

    const funnelsSnapshot = await funnelsQuery.get();

    if (funnelsSnapshot.empty) {
      return NextResponse.json({
        funnels: [],
        summary: {
          totalFunnels: 0,
          totalViews: 0,
          totalCompletions: 0,
          totalRevenue: 0,
          overallConversionRate: 0,
        },
      });
    }

    // Get program/squad names
    const programIds = new Set<string>();
    const squadIds = new Set<string>();
    
    for (const doc of funnelsSnapshot.docs) {
      const funnel = doc.data() as Funnel;
      if (funnel.programId) programIds.add(funnel.programId);
      if (funnel.squadId) squadIds.add(funnel.squadId);
    }

    const programMap = new Map<string, string>();
    const squadMap = new Map<string, string>();

    if (programIds.size > 0) {
      const programDocs = await Promise.all(
        Array.from(programIds).map(id => adminDb.collection('programs').doc(id).get())
      );
      for (const doc of programDocs) {
        if (doc.exists) {
          programMap.set(doc.id, doc.data()?.name || 'Unknown Program');
        }
      }
    }

    if (squadIds.size > 0) {
      const squadDocs = await Promise.all(
        Array.from(squadIds).map(id => adminDb.collection('squads').doc(id).get())
      );
      for (const doc of squadDocs) {
        if (doc.exists) {
          squadMap.set(doc.id, doc.data()?.name || 'Unknown Squad');
        }
      }
    }

    // Process each funnel
    const funnels: FunnelAnalytics[] = [];
    let totalViews = 0;
    let totalCompletions = 0;
    let totalRevenue = 0;

    for (const funnelDoc of funnelsSnapshot.docs) {
      const funnel = funnelDoc.data() as Funnel;
      const funnelId = funnelDoc.id;

      // Get flow sessions for this funnel in the time period
      let sessions: FlowSession[] = [];
      try {
        const sessionsSnapshot = await adminDb
          .collection('flow_sessions')
          .where('funnelId', '==', funnelId)
          .where('createdAt', '>=', startDateStr)
          .get();

        sessions = sessionsSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        })) as FlowSession[];
      } catch (sessionError) {
        console.warn(`[FUNNEL_ANALYTICS] Failed to fetch sessions for funnel ${funnelId}:`, sessionError);
        // Continue with empty sessions - index may not be deployed yet
      }

      // Calculate metrics
      const views = sessions.length;
      const starts = sessions.filter(s => (s.completedStepIndexes?.length || 0) > 0).length;
      const completions = sessions.filter(s => s.completedAt).length;

      // Get revenue from program_enrollments for this funnel's sessions
      let funnelRevenue = 0;
      const sessionIds = sessions.map(s => s.id);
      
      if (sessionIds.length > 0) {
        // Query in batches due to Firestore 'in' limit
        const batchSize = 30;
        for (let i = 0; i < sessionIds.length; i += batchSize) {
          const batch = sessionIds.slice(i, i + batchSize);
          const enrollmentsSnapshot = await adminDb
            .collection('program_enrollments')
            .where('organizationId', '==', organizationId)
            .get();
          
          // Filter by matching flow session IDs
          for (const enrollDoc of enrollmentsSnapshot.docs) {
            const enrollment = enrollDoc.data();
            // Check if this enrollment is from one of our sessions
            // by matching payment intent with session data
            if (enrollment.amountPaid) {
              // Find if any session has matching data
              const matchingSession = sessions.find(s => 
                s.data?.stripePaymentIntentId === enrollment.stripePaymentIntentId
              );
              if (matchingSession) {
                funnelRevenue += enrollment.amountPaid;
              }
            }
          }
        }
      }

      // Fetch funnel steps from subcollection
      // Sort in memory to avoid requiring composite index
      let funnelSteps: FunnelStep[] = [];
      try {
        const funnelStepsSnapshot = await adminDb
          .collection('funnels')
          .doc(funnelId)
          .collection('funnel_steps')
          .get();
        
        funnelSteps = funnelStepsSnapshot.docs
          .map(d => ({
            id: d.id,
            ...d.data(),
          }) as FunnelStep)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
      } catch (stepError) {
        console.warn(`[FUNNEL_ANALYTICS] Failed to fetch steps for funnel ${funnelId}:`, stepError);
        // Continue without steps
      }

      // Calculate step-level analytics
      const stepAnalytics: FunnelStepAnalytics[] = [];

      for (let i = 0; i < funnelSteps.length; i++) {
        const step = funnelSteps[i];
        
        // Count sessions that viewed this step
        const viewedStep = sessions.filter(s => 
          s.currentStepIndex >= i || (s.completedStepIndexes?.includes(i) ?? false)
        ).length;
        
        // Count sessions that completed this step
        const completedStep = sessions.filter(s => 
          s.completedStepIndexes?.includes(i) ?? false
        ).length;
        
        // Drop off = viewed but didn't complete
        const dropOff = viewedStep - completedStep;
        const dropOffRate = viewedStep > 0 ? Math.round((dropOff / viewedStep) * 100) : 0;

        stepAnalytics.push({
          stepIndex: i,
          stepId: step.id,
          stepType: step.type,
          views: viewedStep,
          completions: completedStep,
          dropOff,
          dropOffRate,
        });
      }

      // Find highest drop-off step
      let highestDropOffStep: FunnelAnalytics['highestDropOffStep'];
      let maxDropOffRate = 0;
      
      for (const step of stepAnalytics) {
        if (step.dropOffRate > maxDropOffRate && step.views > 0) {
          maxDropOffRate = step.dropOffRate;
          highestDropOffStep = {
            stepIndex: step.stepIndex,
            stepId: step.stepId,
            dropOffRate: step.dropOffRate,
          };
        }
      }

      // Calculate rates
      const startRate = views > 0 ? Math.round((starts / views) * 100) : 0;
      const conversionRate = views > 0 ? Math.round((completions / views) * 100) : 0;
      const completionRate = starts > 0 ? Math.round((completions / starts) * 100) : 0;

      funnels.push({
        id: funnelId,
        name: funnel.name || 'Untitled Funnel',
        programId: funnel.programId || undefined,
        programName: funnel.programId ? programMap.get(funnel.programId) : undefined,
        squadId: funnel.squadId || undefined,
        squadName: funnel.squadId ? squadMap.get(funnel.squadId) : undefined,
        isActive: funnel.isActive,
        totalViews: views,
        totalStarts: starts,
        totalCompletions: completions,
        totalRevenue: funnelRevenue / 100,
        startRate,
        conversionRate,
        completionRate,
        steps: stepAnalytics,
        highestDropOffStep,
        createdAt: funnel.createdAt || '',
      });

      totalViews += views;
      totalCompletions += completions;
      totalRevenue += funnelRevenue;
    }

    // Sort by views descending
    funnels.sort((a, b) => b.totalViews - a.totalViews);

    const overallConversionRate = totalViews > 0 
      ? Math.round((totalCompletions / totalViews) * 100) 
      : 0;

    return NextResponse.json({
      funnels,
      summary: {
        totalFunnels: funnels.length,
        totalViews,
        totalCompletions,
        totalRevenue: totalRevenue / 100,
        overallConversionRate,
      },
      period: {
        days,
        startDate: startDateStr,
        endDate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[COACH_ANALYTICS_FUNNELS] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch funnel analytics' }, { status: 500 });
  }
}

