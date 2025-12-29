'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Sun, Moon, Calendar, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import type { OrgCheckInFlow, CheckInFlowTemplate, CheckInFlowType, FlowDisplayConfig, FlowShowConditions } from '@/types';
import { FlowConditionBuilder } from './FlowConditionBuilder';
import { FlowDisplayConfigEditor } from './FlowDisplayConfigEditor';

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
  const [name, setName] = useState(flow?.name || '');
  const [description, setDescription] = useState(flow?.description || '');
  const [selectedSource, setSelectedSource] = useState<'scratch' | 'template' | 'duplicate'>('scratch');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Custom flow specific settings
  const [displayConfig, setDisplayConfig] = useState<FlowDisplayConfig | undefined>(flow?.displayConfig);
  const [showConditions, setShowConditions] = useState<FlowShowConditions | undefined>(flow?.showConditions);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  const isCustomFlow = flow?.type === 'custom' || mode === 'create';

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#171b22] rounded-2xl w-full max-w-xl shadow-xl border border-[#e1ddd8] dark:border-[#262b35] max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">
            {mode === 'create' ? 'Create Check-in Flow' : 'Edit Flow Details'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-[#e1ddd8] dark:border-[#262b35] text-text-primary dark:text-[#f5f5f8] rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 bg-brand-accent text-white rounded-xl hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}

