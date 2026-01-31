'use client';

import React, { useState, useEffect } from 'react';
import { X, Sun, Moon, Calendar, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import type { OrgCheckInFlow, CheckInFlowTemplate, CheckInFlowType, FlowDisplayConfig, FlowShowConditions } from '@/types';
import { FlowConditionBuilder } from './FlowConditionBuilder';
import { FlowDisplayConfigEditor } from './FlowDisplayConfigEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface CheckInFlowEditorDialogProps {
  mode: 'create' | 'edit';
  flow?: OrgCheckInFlow;
  templates: CheckInFlowTemplate[];
  existingFlows: OrgCheckInFlow[];
  onClose: () => void;
  onSaved: () => void;
}

const FLOW_TYPE_ICONS: Record<CheckInFlowType, React.ElementType> = {
  morning: Sun,
  evening: Moon,
  weekly: Calendar,
  custom: Layers,
};

const FLOW_TYPE_LABELS: Record<CheckInFlowType, string> = {
  morning: 'Morning Check-in',
  evening: 'Evening Check-in',
  weekly: 'Weekly Reflection',
  custom: 'Custom Flow',
};

export function CheckInFlowEditorDialog({
  mode,
  flow,
  templates,
  existingFlows,
  onClose,
  onSaved,
}: CheckInFlowEditorDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [name, setName] = useState(flow?.name || '');
  const [description, setDescription] = useState(flow?.description || '');
  const [selectedSource, setSelectedSource] = useState<'scratch' | 'template' | 'duplicate'>('scratch');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom flow specific settings
  const [displayConfig, setDisplayConfig] = useState<FlowDisplayConfig | undefined>(flow?.displayConfig);
  const [showConditions, setShowConditions] = useState<FlowShowConditions | undefined>(flow?.showConditions);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const isCustomFlow = flow?.type === 'custom' || mode === 'create';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (mode === 'create') {
        const body: Record<string, unknown> = {
          name: name.trim(),
          type: 'custom',
          description: description.trim() || undefined,
          displayConfig: displayConfig,
          showConditions: showConditions,
        };

        if (selectedSource === 'template' && selectedTemplateId) {
          body.fromTemplateId = selectedTemplateId;
        } else if (selectedSource === 'duplicate' && selectedFlowId) {
          body.fromFlowId = selectedFlowId;
        }

        const response = await fetch('/api/coach/org-checkin-flows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create flow');
        }
      } else {
        // Edit mode
        const body: Record<string, unknown> = {
          name: name.trim(),
          description: description.trim() || undefined,
        };
        
        // Only include display config and show conditions for custom flows
        if (isCustomFlow) {
          body.displayConfig = displayConfig;
          body.showConditions = showConditions;
        }
        
        const response = await fetch(`/api/coach/org-checkin-flows/${flow!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update flow');
        }
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  // Form content - shared between Dialog and Drawer
  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-5">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
              Flow Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Mindfulness"
              className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#666d7c] focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this flow for?"
              rows={2}
              className="w-full px-4 py-3 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#666d7c] focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent resize-none"
            />
          </div>

          {/* Display & Conditions (custom flows only) */}
          {isCustomFlow && (
            <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-4">
              <button
                type="button"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <span className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
                  Homepage Display & Conditions
                </span>
                {isAdvancedOpen ? (
                  <ChevronUp className="w-4 h-4 text-text-muted dark:text-[#666d7c]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-muted dark:text-[#666d7c]" />
                )}
              </button>
              
              {isAdvancedOpen && (
                <div className="mt-4 space-y-6">
                  <FlowDisplayConfigEditor
                    value={displayConfig}
                    onChange={setDisplayConfig}
                  />
                  
                  <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-4">
                    <FlowConditionBuilder
                      value={showConditions}
                      onChange={setShowConditions}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Source selection (create mode only) */}
          {mode === 'create' && (
            <div>
              <label className="block text-sm font-medium text-text-primary dark:text-[#f5f5f8] mb-3">
                Start from
              </label>
              <div className="space-y-2">
                {/* From scratch */}
                <label className="flex items-center gap-3 p-3 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-[#0d1015] transition-colors">
                  <input
                    type="radio"
                    name="source"
                    value="scratch"
                    checked={selectedSource === 'scratch'}
                    onChange={() => setSelectedSource('scratch')}
                    className="w-4 h-4 text-brand-accent"
                  />
                  <div>
                    <p className="font-medium text-text-primary dark:text-[#f5f5f8]">Blank flow</p>
                    <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">Start with an empty flow</p>
                  </div>
                </label>

                {/* From template */}
                <label className="flex items-center gap-3 p-3 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-[#0d1015] transition-colors">
                  <input
                    type="radio"
                    name="source"
                    value="template"
                    checked={selectedSource === 'template'}
                    onChange={() => setSelectedSource('template')}
                    className="w-4 h-4 text-brand-accent"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-text-primary dark:text-[#f5f5f8]">From template</p>
                    <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">Start with a pre-built template</p>
                  </div>
                </label>

                {selectedSource === 'template' && templates.length > 0 && (
                  <div className="ml-7 mt-2 space-y-2">
                    {templates.map(template => {
                      const Icon = FLOW_TYPE_ICONS[template.key];
                      return (
                        <label
                          key={template.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedTemplateId === template.id
                              ? 'border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10'
                              : 'border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-[#0d1015]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="template"
                            value={template.id}
                            checked={selectedTemplateId === template.id}
                            onChange={() => setSelectedTemplateId(template.id)}
                            className="sr-only"
                          />
                          <Icon className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
                          <span className="text-sm text-text-primary dark:text-[#f5f5f8]">
                            {FLOW_TYPE_LABELS[template.key]}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Duplicate existing */}
                {existingFlows.length > 0 && (
                  <>
                    <label className="flex items-center gap-3 p-3 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-[#0d1015] transition-colors">
                      <input
                        type="radio"
                        name="source"
                        value="duplicate"
                        checked={selectedSource === 'duplicate'}
                        onChange={() => setSelectedSource('duplicate')}
                        className="w-4 h-4 text-brand-accent"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-text-primary dark:text-[#f5f5f8]">Duplicate existing</p>
                        <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">Copy from an existing flow</p>
                      </div>
                    </label>

                    {selectedSource === 'duplicate' && (
                      <div className="ml-7 mt-2">
                        <select
                          value={selectedFlowId}
                          onChange={(e) => setSelectedFlowId(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-[#0d1015] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent"
                        >
                          <option value="">Select a flow...</option>
                          {existingFlows.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

      </div>

      {/* Actions - Sticky footer */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl font-albert font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-2.5 px-4 bg-brand-accent text-white rounded-xl font-albert font-medium hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );

  // Desktop: Dialog
  if (isDesktop) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#e1ddd8] dark:border-[#262b35] flex-shrink-0">
            <DialogTitle className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              {mode === 'create' ? 'Create Check-in Flow' : 'Edit Flow Details'}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
              {mode === 'create'
                ? 'Create a custom check-in flow for your clients'
                : 'Update your flow settings'}
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Drawer (slide up bottom sheet)
  return (
    <Drawer open={true} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        <DrawerHeader className="px-4 pb-3 border-b border-[#e1ddd8] dark:border-[#262b35] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {mode === 'create' ? 'Create Check-in Flow' : 'Edit Flow'}
              </DrawerTitle>
              <DrawerDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                {mode === 'create' ? 'Create a custom check-in' : 'Update flow settings'}
              </DrawerDescription>
            </div>
            <button
              onClick={onClose}
              className="hidden sm:block p-2 -mr-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
          </div>
        </DrawerHeader>
        {formContent}
        {/* Safe area padding for mobile */}
        <div className="h-6 flex-shrink-0" />
      </DrawerContent>
    </Drawer>
  );
}

