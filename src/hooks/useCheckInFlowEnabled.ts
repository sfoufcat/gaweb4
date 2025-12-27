import { useState, useEffect } from 'react';
import type { CheckInFlowType } from '@/types';

/**
 * Hook to check if the dynamic check-in flow system is enabled for an org
 * 
 * Returns:
 * - useDynamicFlow: whether to use the new dynamic flow system
 * - isLoading: loading state
 * - flowId: the ID of the flow if using dynamic
 * 
 * This allows for gradual migration - orgs that have been migrated to
 * the dynamic system will use it, others fall back to legacy pages.
 */
export function useCheckInFlowEnabled(type: CheckInFlowType) {
  const [useDynamicFlow, setUseDynamicFlow] = useState(false);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkFlow() {
      try {
        const response = await fetch(`/api/checkin/flows/by-type/${type}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.flow && data.steps && data.steps.length > 0) {
            setUseDynamicFlow(true);
            setFlowId(data.flow.id);
          }
        }
      } catch (error) {
        console.log('Dynamic flow not available, using legacy');
      } finally {
        setIsLoading(false);
      }
    }

    checkFlow();
  }, [type]);

  return { useDynamicFlow, flowId, isLoading };
}

