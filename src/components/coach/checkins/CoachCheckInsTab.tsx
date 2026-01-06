'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowLeft, 
  Copy, 
  MoreVertical, 
  Pencil, 
  Trash2,
  Sun,
  Moon,
  Calendar,
  Layers,
  Eye,
  EyeOff,
  RotateCcw,
  Globe,
  Settings
} from 'lucide-react';
import type { OrgCheckInFlow, CheckInFlowTemplate, CheckInFlowType } from '@/types';
import { CheckInFlowEditorDialog } from './CheckInFlowEditorDialog';
import { CheckInFlowStepsEditor } from './CheckInFlowStepsEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDemoMode } from '@/contexts/DemoModeContext';

type ViewMode = 'list' | 'editing';

// Icon mapping for flow types
const FLOW_TYPE_ICONS: Record<CheckInFlowType, React.ElementType> = {
  morning: Sun,
  evening: Moon,
  weekly: Calendar,
  custom: Layers,
};

const FLOW_TYPE_COLORS: Record<CheckInFlowType, string> = {
  morning: 'bg-amber-100 text-amber-600',
  evening: 'bg-indigo-100 text-indigo-600',
  weekly: 'bg-emerald-100 text-emerald-600',
  custom: 'bg-purple-100 text-purple-600',
};

const FLOW_TYPE_LABELS: Record<CheckInFlowType, string> = {
  morning: 'Morning',
  evening: 'Evening',
  weekly: 'Weekly',
  custom: 'Custom',
};

export function CoachCheckInsTab() {
  const { isDemoMode, openSignupModal } = useDemoMode();
  const [flows, setFlows] = useState<OrgCheckInFlow[]>([]);
  const [templates, setTemplates] = useState<CheckInFlowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tenant required state
  const [tenantRequired, setTenantRequired] = useState<{
    tenantUrl: string | null;
    subdomain: string | null;
  } | null>(null);
  
  // Dialogs & editing
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [flowToEdit, setFlowToEdit] = useState<OrgCheckInFlow | null>(null);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // Delete confirmation state
  const [flowToDelete, setFlowToDelete] = useState<OrgCheckInFlow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Reset confirmation state
  const [flowToReset, setFlowToReset] = useState<OrgCheckInFlow | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const fetchFlows = useCallback(async () => {
    try {
      setIsLoading(true);
      setTenantRequired(null);
      
      if (isDemoMode) {
        setFlows([
          {
            id: 'demo-flow-1',
            name: 'Morning Check-in',
            type: 'morning',
            description: 'Start your day with intention',
            isSystemDefault: true,
            enabled: true,
            stepCount: 3,
            organizationId: 'demo-org',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'demo-flow-2',
            name: 'Evening Reflection',
            type: 'evening',
            description: 'Review your progress',
            isSystemDefault: true,
            enabled: true,
            stepCount: 4,
            organizationId: 'demo-org',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'demo-flow-3',
            name: 'Weekly Review',
            type: 'weekly',
            description: 'Plan for the week ahead',
            isSystemDefault: true,
            enabled: false,
            stepCount: 6,
            organizationId: 'demo-org',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ] as OrgCheckInFlow[]);
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/coach/org-checkin-flows');
      
      // Check for tenant_required error
      if (response.status === 403) {
        const data = await response.json();
        if (data.error === 'tenant_required') {
          setTenantRequired({
            tenantUrl: data.tenantUrl,
            subdomain: data.subdomain,
          });
          setIsLoading(false);
          return;
        }
      }
      
      if (!response.ok) throw new Error('Failed to fetch check-in flows');
      const data = await response.json();
      setFlows(data.flows || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load check-in flows');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/coach/org-checkin-flows/templates');
      if (!response.ok) return;
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
    fetchTemplates();
  }, [fetchFlows, fetchTemplates]);

  const handleToggleEnabled = async (flow: OrgCheckInFlow) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    try {
      const response = await fetch(`/api/coach/org-checkin-flows/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !flow.enabled }),
      });
      if (!response.ok) throw new Error('Failed to update flow');
      await fetchFlows();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update flow');
    }
  };

  const handleDelete = (flow: OrgCheckInFlow) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    if (flow.isSystemDefault) {
      alert('System default flows cannot be deleted. You can disable them instead.');
      return;
    }
    setFlowToDelete(flow);
  };

  const confirmDelete = async () => {
    if (!flowToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/coach/org-checkin-flows/${flowToDelete.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete flow');
      setFlowToDelete(null);
      await fetchFlows();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete flow');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicate = async (flow: OrgCheckInFlow) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    try {
      const response = await fetch('/api/coach/org-checkin-flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${flow.name} (Copy)`,
          type: 'custom',
          description: flow.description,
          fromFlowId: flow.id,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to duplicate flow');
      
      const data = await response.json();
      await fetchFlows();
      
      // Open the duplicated flow for editing
      setEditingFlowId(data.flow.id);
      setViewMode('editing');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to duplicate flow');
    }
  };

  const handleResetToDefault = (flow: OrgCheckInFlow) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    if (!flow.isSystemDefault) {
      alert('Only system default flows can be reset to the original template.');
      return;
    }
    setFlowToReset(flow);
  };

  const confirmReset = async () => {
    if (!flowToReset) return;
    
    setIsResetting(true);
    try {
      const response = await fetch(`/api/coach/org-checkin-flows/${flowToReset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_to_default' }),
      });
      if (!response.ok) throw new Error('Failed to reset flow');
      setFlowToReset(null);
      await fetchFlows();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset flow');
    } finally {
      setIsResetting(false);
    }
  };

  const handleEditDetails = (flow: OrgCheckInFlow) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    setFlowToEdit(flow);
    setShowEditDialog(true);
  };

  const handleEditSteps = (flow: OrgCheckInFlow) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    setEditingFlowId(flow.id);
    setViewMode('editing');
  };

  const handleBackToList = () => {
    setEditingFlowId(null);
    setViewMode('list');
    fetchFlows();
  };

  // Group flows by type for display
  const systemFlows = flows.filter(f => f.isSystemDefault);
  const customFlows = flows.filter(f => !f.isSystemDefault);

  // If editing a flow's steps, show the step editor
  if (viewMode === 'editing' && editingFlowId) {
    const editingFlow = flows.find(f => f.id === editingFlowId);
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToList}
              className="p-2 rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">
                {editingFlow?.name || 'Edit Check-in Flow'}
              </h2>
              <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
                Configure the steps users will go through
              </p>
            </div>
          </div>
          
          {/* Settings icon for custom flows */}
          {editingFlow && !editingFlow.isSystemDefault && (
            <button
              onClick={() => handleEditDetails(editingFlow)}
              className="p-2 rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
              title="Flow settings"
            >
              <Settings className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
          )}
        </div>

        <CheckInFlowStepsEditor 
          flowId={editingFlowId}
          isSystemDefault={editingFlow?.isSystemDefault}
          onBack={handleBackToList}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">Check-ins</h2>
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
            Customize morning, evening, and weekly check-in flows for your clients
          </p>
        </div>
        <button
          onClick={() => {
            if (isDemoMode) {
              openSignupModal();
              return;
            }
            setShowCreateDialog(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-transparent text-[#1a1a1a] dark:text-white font-semibold rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Flow
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
                  <div className="space-y-2">
                    <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                    <div className="h-4 w-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-16 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
                  <div className="h-8 w-8 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tenant required state */}
      {tenantRequired && (
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Globe className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8] mb-2">
            Access from Your Organization Domain
          </h3>
          <p className="text-text-secondary dark:text-[#b2b6c2] mb-6 max-w-md mx-auto">
            To manage check-in flows, please access this page from your organization&apos;s domain.
          </p>
        </div>
      )}

      {/* Flows list */}
      {!isLoading && !error && !tenantRequired && (
        <div className="space-y-8">
          {/* System Default Flows */}
          {systemFlows.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-secondary dark:text-[#b2b6c2] uppercase tracking-wider">
                Default Check-ins
              </h3>
              <div className="space-y-3">
                {systemFlows.map(flow => (
                  <FlowCard
                    key={flow.id}
                    flow={flow}
                    onToggleEnabled={() => handleToggleEnabled(flow)}
                    onEditSteps={() => handleEditSteps(flow)}
                    onEditDetails={() => handleEditDetails(flow)}
                    onDuplicate={() => handleDuplicate(flow)}
                    onDelete={() => handleDelete(flow)}
                    onReset={() => handleResetToDefault(flow)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom Flows */}
          {customFlows.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-secondary dark:text-[#b2b6c2] uppercase tracking-wider">
                Custom Flows
              </h3>
              <div className="space-y-3">
                {customFlows.map(flow => (
                  <FlowCard
                    key={flow.id}
                    flow={flow}
                    onToggleEnabled={() => handleToggleEnabled(flow)}
                    onEditSteps={() => handleEditSteps(flow)}
                    onEditDetails={() => handleEditDetails(flow)}
                    onDuplicate={() => handleDuplicate(flow)}
                    onDelete={() => handleDelete(flow)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {flows.length === 0 && (
            <div className="text-center py-12 bg-[#faf8f6] dark:bg-[#11141b] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]">
              <Layers className="w-12 h-12 text-text-muted dark:text-[#666d7c] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text-primary dark:text-[#f5f5f8] mb-2">No check-in flows yet</h3>
              <p className="text-text-secondary dark:text-[#b2b6c2] mb-6">
                Create your first check-in flow or the system will use default templates.
              </p>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="px-6 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
              >
                Create Flow
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <CheckInFlowEditorDialog
          mode="create"
          templates={templates}
          existingFlows={flows}
          onClose={() => setShowCreateDialog(false)}
          onSaved={() => {
            setShowCreateDialog(false);
            fetchFlows();
          }}
        />
      )}

      {/* Edit Dialog */}
      {showEditDialog && flowToEdit && (
        <CheckInFlowEditorDialog
          mode="edit"
          flow={flowToEdit}
          templates={templates}
          existingFlows={flows}
          onClose={() => {
            setShowEditDialog(false);
            setFlowToEdit(null);
          }}
          onSaved={() => {
            setShowEditDialog(false);
            setFlowToEdit(null);
            fetchFlows();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!flowToDelete} onOpenChange={(open) => !open && setFlowToDelete(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert text-[20px] tracking-[-0.5px]">
              Delete flow?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-albert text-[15px] text-text-secondary dark:text-[#b2b6c2]">
              Are you sure you want to delete &ldquo;{flowToDelete?.name}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel 
              disabled={isDeleting}
              className="font-albert rounded-full border-[#e1ddd8] dark:border-[#262b35]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="font-albert rounded-full bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={!!flowToReset} onOpenChange={(open) => !open && setFlowToReset(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert text-[20px] tracking-[-0.5px]">
              Reset to default?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-albert text-[15px] text-text-secondary dark:text-[#b2b6c2]">
              This will replace all steps in &ldquo;{flowToReset?.name}&rdquo; with the original template. Your customizations will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel 
              disabled={isResetting}
              className="font-albert rounded-full border-[#e1ddd8] dark:border-[#262b35]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReset}
              disabled={isResetting}
              className="font-albert rounded-full bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isResetting ? 'Resetting...' : 'Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// Flow card component
interface FlowCardProps {
  flow: OrgCheckInFlow;
  onToggleEnabled: () => void;
  onEditSteps: () => void;
  onEditDetails: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReset?: () => void;
}

function FlowCard({ flow, onToggleEnabled, onEditSteps, onEditDetails, onDuplicate, onDelete, onReset }: FlowCardProps) {
  const Icon = FLOW_TYPE_ICONS[flow.type];
  const colorClass = FLOW_TYPE_COLORS[flow.type];
  const typeLabel = FLOW_TYPE_LABELS[flow.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 hover:border-[#d4d0cb] dark:hover:border-[#363d4a] transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-text-primary dark:text-[#f5f5f8]">{flow.name}</h3>
              {flow.isSystemDefault && (
                <span className="px-2 py-0.5 text-xs bg-brand-accent/10 text-brand-accent dark:bg-brand-accent/20 dark:text-brand-accent rounded-full">
                  Default
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
              {typeLabel} · {flow.stepCount || 0} steps
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Enable/Disable Toggle */}
          <button
            onClick={onToggleEnabled}
            className={`
              relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
              ${flow.enabled 
                ? 'bg-[#4CAF50]' 
                : 'bg-[#d1cec9] dark:bg-[#3d4351]'
              }
            `}
            title={flow.enabled ? 'Disable flow' : 'Enable flow'}
          >
            <span className={`
              absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
              ${flow.enabled ? 'left-[22px]' : 'left-0.5'}
            `} />
          </button>

          {/* Edit Steps button */}
          <button
            onClick={onEditSteps}
            className="px-3 py-1.5 text-sm text-brand-accent hover:bg-brand-accent/5 dark:hover:bg-brand-accent/10 rounded-lg transition-colors"
          >
            Edit Steps
          </button>
          
          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors">
                <MoreVertical className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border-[#e1ddd8] dark:border-[#262b35]">
              <DropdownMenuItem 
                onClick={onEditDetails}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={onDuplicate}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </DropdownMenuItem>
              {flow.isSystemDefault && onReset && (
                <DropdownMenuItem 
                  onClick={onReset}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Default
                </DropdownMenuItem>
              )}
              {!flow.isSystemDefault && (
                <>
                  <DropdownMenuSeparator className="bg-[#e1ddd8] dark:bg-[#262b35]" />
                  <DropdownMenuItem 
                    onClick={onDelete}
                    className="flex items-center gap-2 text-red-600 focus:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}

