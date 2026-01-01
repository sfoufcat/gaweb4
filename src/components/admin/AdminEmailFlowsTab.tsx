'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Mail, 
  Play,
  Pause,
  Clock,
  Eye,
  MousePointer,
  ChevronDown,
  ChevronRight,
  Loader2,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { EmailFlow, EmailTemplate, EmailFlowStats } from '@/types';

interface FlowWithTemplates extends EmailFlow {
  stats: EmailFlowStats;
  templates: EmailTemplate[];
}

interface QueueStats {
  pending: number;
}

/**
 * AdminEmailFlowsTab
 * 
 * Admin dashboard tab for managing email automation flows.
 */
export function AdminEmailFlowsTab() {
  const [flows, setFlows] = useState<FlowWithTemplates[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFlows, setExpandedFlows] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchFlows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/email-flows');
      
      if (!response.ok) {
        throw new Error('Failed to fetch email flows');
      }
      
      const data = await response.json();
      setFlows(data.flows);
      setQueueStats(data.queueStats);
    } catch (err) {
      console.error('Error fetching flows:', err);
      setError(err instanceof Error ? err.message : 'Failed to load email flows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const toggleFlow = (flowId: string) => {
    setExpandedFlows(prev => {
      const next = new Set(prev);
      if (next.has(flowId)) {
        next.delete(flowId);
      } else {
        next.add(flowId);
      }
      return next;
    });
  };

  const updateFlowEnabled = async (flowId: string, enabled: boolean) => {
    try {
      setUpdating(flowId);
      
      const response = await fetch('/api/admin/email-flows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId, updates: { enabled } }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update flow');
      }
      
      // Update local state
      setFlows(prev => prev.map(flow => 
        flow.id === flowId ? { ...flow, enabled } : flow
      ));
    } catch (err) {
      console.error('Error updating flow:', err);
    } finally {
      setUpdating(null);
    }
  };

  const updateTemplateEnabled = async (templateId: string, flowId: string, enabled: boolean) => {
    try {
      setUpdating(templateId);
      
      const response = await fetch('/api/admin/email-flows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, updates: { enabled } }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update template');
      }
      
      // Update local state
      setFlows(prev => prev.map(flow => {
        if (flow.id === flowId) {
          return {
            ...flow,
            templates: flow.templates.map(t => 
              t.id === templateId ? { ...t, enabled } : t
            ),
          };
        }
        return flow;
      }));
    } catch (err) {
      console.error('Error updating template:', err);
    } finally {
      setUpdating(null);
    }
  };

  const formatDelay = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} hours`;
    return `${Math.round(minutes / 1440)} days`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 dark:text-red-400 font-sans">{error}</p>
        <Button onClick={fetchFlows} variant="outline" size="sm" className="mt-3">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Stats */}
      {queueStats && (
        <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="font-albert font-bold text-2xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                {queueStats.pending}
              </div>
              <div className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                Emails in Queue
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flows */}
      <div className="space-y-4">
        {flows.map((flow) => (
          <div
            key={flow.id}
            className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden"
          >
            {/* Flow Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-[#11141b]"
              onClick={() => toggleFlow(flow.id)}
            >
              <div className="flex items-center gap-4">
                <button className="text-[#5f5a55] dark:text-[#b2b6c2]">
                  {expandedFlows.has(flow.id) ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
                
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-accent/20 to-brand-accent/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-brand-accent" />
                </div>
                
                <div>
                  <h3 className="font-albert font-semibold text-[16px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {flow.name}
                  </h3>
                  <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                    {flow.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-6" onClick={e => e.stopPropagation()}>
                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2]">
                    <Send className="w-4 h-4" />
                    <span>{flow.stats.totalSent}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2]">
                    <Eye className="w-4 h-4" />
                    <span>{flow.stats.openRate}%</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2]">
                    <MousePointer className="w-4 h-4" />
                    <span>{flow.stats.clickRate}%</span>
                  </div>
                </div>
                
                {/* Enable/Disable */}
                <div className="flex items-center gap-2">
                  {flow.enabled ? (
                    <Play className="w-4 h-4 text-green-500" />
                  ) : (
                    <Pause className="w-4 h-4 text-[#8a8580]" />
                  )}
                  <Switch
                    checked={flow.enabled}
                    onCheckedChange={(checked) => updateFlowEnabled(flow.id, checked)}
                    disabled={updating === flow.id}
                  />
                </div>
              </div>
            </div>
            
            {/* Templates */}
            {expandedFlows.has(flow.id) && (
              <div className="border-t border-[#e1ddd8] dark:border-[#262b35]">
                {flow.templates.length === 0 ? (
                  <div className="p-4 text-center text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm">
                    No email templates in this flow
                  </div>
                ) : (
                  <div className="divide-y divide-[#e1ddd8]/50 dark:divide-[#262b35]/50">
                    {flow.templates.map((template, index) => (
                      <div key={template.id} className="p-4 pl-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-center font-albert font-semibold text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                            {index + 1}
                          </div>
                          
                          <div>
                            <h4 className="font-albert font-medium text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                              {template.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="w-3 h-3 text-[#8a8580]" />
                              <span className="font-sans text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                                Send after {formatDelay(template.delayMinutes)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            template.enabled 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                          }`}>
                            {template.enabled ? 'Active' : 'Disabled'}
                          </span>
                          
                          <Switch
                            checked={template.enabled}
                            onCheckedChange={(checked) => updateTemplateEnabled(template.id, flow.id, checked)}
                            disabled={updating === template.id}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        
        {flows.length === 0 && (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-[#8a8580] mx-auto mb-3" />
            <p className="font-sans text-[#5f5a55] dark:text-[#b2b6c2]">No email flows configured</p>
          </div>
        )}
      </div>
    </div>
  );
}

