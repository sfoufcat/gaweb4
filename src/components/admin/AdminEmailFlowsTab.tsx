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
  Pencil,
  X,
  Save,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import type { EmailFlow, AutomatedEmailTemplate, EmailFlowStats } from '@/types';

interface FlowWithTemplates extends EmailFlow {
  stats: EmailFlowStats;
  templates: AutomatedEmailTemplate[];
}

interface QueueStats {
  pending: number;
}

// Sample variables for preview
const SAMPLE_VARIABLES: Record<string, string> = {
  firstName: 'Sarah',
  email: 'sarah@example.com',
  ctaUrl: 'https://growthaddicts.com/signup',
  quizClientCount: '25-50',
  quizFrustrations: 'Manual check-ins, No visibility into engagement',
  quizImpactFeatures: 'Tracking client progress, Squad accountability groups',
};

// Available template variables
const TEMPLATE_VARIABLES = [
  { key: '{{firstName}}', description: "Recipient's first name" },
  { key: '{{email}}', description: "Recipient's email" },
  { key: '{{ctaUrl}}', description: 'Call-to-action URL' },
  { key: '{{quizClientCount}}', description: 'From quiz: client count range' },
  { key: '{{quizFrustrations}}', description: 'From quiz: frustrations list' },
  { key: '{{quizImpactFeatures}}', description: 'From quiz: desired features' },
];

/**
 * Replace template variables with sample values for preview
 */
function replaceVariables(content: string): string {
  let result = content;
  for (const [key, value] of Object.entries(SAMPLE_VARIABLES)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
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
  
  // Modal state
  const [selectedTemplate, setSelectedTemplate] = useState<AutomatedEmailTemplate | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'preview' | 'edit'>('preview');
  const [editSubject, setEditSubject] = useState('');
  const [editHtmlContent, setEditHtmlContent] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openPreview = (template: AutomatedEmailTemplate, flowId: string) => {
    setSelectedTemplate(template);
    setSelectedFlowId(flowId);
    setModalMode('preview');
  };

  const openEdit = (template: AutomatedEmailTemplate, flowId: string) => {
    setSelectedTemplate(template);
    setSelectedFlowId(flowId);
    setEditSubject(template.subject);
    setEditHtmlContent(template.htmlContent);
    setModalMode('edit');
  };

  const closeModal = () => {
    setSelectedTemplate(null);
    setSelectedFlowId(null);
    setEditSubject('');
    setEditHtmlContent('');
  };

  const handleSave = async () => {
    if (!selectedTemplate || !selectedFlowId) return;
    
    try {
      setSaving(true);
      
      const response = await fetch('/api/admin/email-flows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          updates: {
            subject: editSubject,
            htmlContent: editHtmlContent,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save template');
      }
      
      // Update local state
      setFlows(prev => prev.map(flow => {
        if (flow.id === selectedFlowId) {
          return {
            ...flow,
            templates: flow.templates.map(t => 
              t.id === selectedTemplate.id 
                ? { ...t, subject: editSubject, htmlContent: editHtmlContent } 
                : t
            ),
          };
        }
        return flow;
      }));
      
      closeModal();
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Failed to save template');
    } finally {
      setSaving(false);
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
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#8a8580]" />
                                <span className="font-sans text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                                  Send after {formatDelay(template.delayMinutes)}
                                </span>
                              </div>
                              <span className="text-[#5f5a55] dark:text-[#b2b6c2]">•</span>
                              <span className="font-sans text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate max-w-[200px]">
                                {template.subject}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {/* Preview Button */}
                          <button
                            onClick={() => openPreview(template, flow.id)}
                            className="p-2 rounded-lg hover:bg-[#faf8f6] dark:hover:bg-[#11141b] text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent transition-colors"
                            title="Preview email"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          {/* Edit Button */}
                          <button
                            onClick={() => openEdit(template, flow.id)}
                            className="p-2 rounded-lg hover:bg-[#faf8f6] dark:hover:bg-[#11141b] text-[#5f5a55] dark:text-[#b2b6c2] hover:text-brand-accent transition-colors"
                            title="Edit email"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          
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

      {/* Preview/Edit Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
              <div>
                <h2 className="font-albert text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {modalMode === 'preview' ? 'Email Preview' : 'Edit Email'}
                </h2>
                <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                  {selectedTemplate.name}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {modalMode === 'preview' && (
                  <Button
                    onClick={() => {
                      setEditSubject(selectedTemplate.subject);
                      setEditHtmlContent(selectedTemplate.htmlContent);
                      setModalMode('edit');
                    }}
                    variant="outline"
                    className="gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Button>
                )}
                
                {modalMode === 'edit' && (
                  <>
                    <Button
                      onClick={() => setModalMode('preview')}
                      variant="outline"
                      className="gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="gap-2 bg-brand-accent hover:bg-[#8b6847]"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save
                    </Button>
                  </>
                )}
                
                <button
                  onClick={closeModal}
                  className="p-2 rounded-lg hover:bg-[#faf8f6] dark:hover:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {modalMode === 'preview' ? (
                /* Preview Mode */
                <div className="space-y-4">
                  {/* Subject Preview */}
                  <div className="bg-[#faf8f6] dark:bg-[#0a0c10] rounded-xl p-4">
                    <div className="font-sans text-xs text-[#8a8580] mb-1">Subject</div>
                    <div className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {replaceVariables(selectedTemplate.subject)}
                    </div>
                  </div>
                  
                  {/* Email Preview */}
                  <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
                    <div className="bg-[#faf8f6] dark:bg-[#0a0c10] px-4 py-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
                      <span className="font-sans text-xs text-[#8a8580]">Email Body</span>
                    </div>
                    <div 
                      className="p-4 bg-white dark:bg-[#171b22]"
                      dangerouslySetInnerHTML={{ 
                        __html: replaceVariables(selectedTemplate.htmlContent) 
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Edit Mode */
                <div className="space-y-6">
                  {/* Variable Reference */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div>
                        <h4 className="font-albert font-semibold text-sm text-blue-900 dark:text-blue-100 mb-2">
                          Available Variables
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {TEMPLATE_VARIABLES.map(v => (
                            <div key={v.key} className="font-sans text-xs">
                              <code className="bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300">
                                {v.key}
                              </code>
                              <span className="text-blue-700 dark:text-blue-300 ml-2">
                                {v.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Subject Input */}
                  <div>
                    <label className="block font-sans text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#0a0c10] text-[#1a1a1a] dark:text-[#f5f5f8] font-sans focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
                      placeholder="Email subject..."
                    />
                  </div>
                  
                  {/* HTML Content Editor */}
                  <div>
                    <label className="block font-sans text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                      Email Content
                    </label>
                    <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
                      <RichTextEditor
                        initialContent={editHtmlContent}
                        placeholder="Write your email content..."
                        onChange={({ html }) => setEditHtmlContent(html)}
                        minHeight="300px"
                        maxHeight="500px"
                        autoFocus={false}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
