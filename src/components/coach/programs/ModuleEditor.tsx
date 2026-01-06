'use client';

import React, { useState, useEffect } from 'react';
import type { ProgramModule, ProgramWeek } from '@/types';
import { Trash2, Save, X, Calendar, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModuleEditorProps {
  module: ProgramModule;
  weeks: ProgramWeek[];
  onSave: (updates: Partial<ProgramModule>) => Promise<void>;
  onDelete?: () => Promise<void>;
  isSaving?: boolean;
  readOnly?: boolean;
}

/**
 * Editor for program module metadata
 * Allows editing name, description, and preview content
 */
export function ModuleEditor({
  module,
  weeks,
  onSave,
  onDelete,
  isSaving = false,
  readOnly = false,
}: ModuleEditorProps) {
  const [formData, setFormData] = useState({
    name: module.name,
    description: module.description || '',
    previewTitle: module.previewTitle || '',
    previewDescription: module.previewDescription || '',
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset form when module changes
  useEffect(() => {
    setFormData({
      name: module.name,
      description: module.description || '',
      previewTitle: module.previewTitle || '',
      previewDescription: module.previewDescription || '',
    });
    setHasChanges(false);
  }, [module.id, module.name, module.description, module.previewTitle, module.previewDescription]);

  // Check for changes
  useEffect(() => {
    const changed =
      formData.name !== module.name ||
      formData.description !== (module.description || '') ||
      formData.previewTitle !== (module.previewTitle || '') ||
      formData.previewDescription !== (module.previewDescription || '');
    setHasChanges(changed);
  }, [formData, module]);

  const handleSave = async () => {
    await onSave({
      name: formData.name,
      description: formData.description || undefined,
      previewTitle: formData.previewTitle || undefined,
      previewDescription: formData.previewDescription || undefined,
    });
    setHasChanges(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Get weeks in this module
  const moduleWeeks = weeks.filter(w => w.moduleId === module.id).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Read-only info banner */}
      {readOnly && (
        <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300 font-albert">
            Module settings are managed at the template level. Switch to template view to edit.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Module {module.order}
        </h3>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim()}
                className="flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Module Name */}
      <div>
        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
          Module Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Foundation Phase"
          disabled={readOnly}
          className={`w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* Module Description (Coach only) */}
      <div>
        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
          Description <span className="text-xs text-[#a7a39e]">(coach notes, not shown to clients)</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Internal notes about this module..."
          rows={3}
          disabled={readOnly}
          className={`w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* Client Preview Section */}
      <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
        <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
          Client Preview
        </h4>
        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-4">
          This is what clients see before unlocking this module
        </p>

        {/* Preview Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Preview Title
          </label>
          <input
            type="text"
            value={formData.previewTitle}
            onChange={(e) => setFormData({ ...formData, previewTitle: e.target.value })}
            placeholder={formData.name || 'Module title...'}
            disabled={readOnly}
            className={`w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
        </div>

        {/* Preview Description */}
        <div>
          <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
            Preview Description
          </label>
          <textarea
            value={formData.previewDescription}
            onChange={(e) => setFormData({ ...formData, previewDescription: e.target.value })}
            placeholder="What clients will learn in this module..."
            rows={2}
            disabled={readOnly}
            className={`w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert resize-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
        </div>
      </div>

      {/* Weeks Overview */}
      <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
        <h4 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Weeks in this Module
        </h4>
        {moduleWeeks.length > 0 ? (
          <div className="space-y-2">
            {moduleWeeks.map((week) => (
              <div
                key={week.id}
                className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg"
              >
                <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {week.name || `Week ${week.weekNumber}`}
                  </p>
                  <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                    Days {week.startDayIndex}-{week.endDayIndex}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert">
            No weeks in this module yet
          </p>
        )}
      </div>

      {/* Day Range Info */}
      <div className="p-3 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg">
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          <span className="font-medium">Day range:</span> {module.startDayIndex} - {module.endDayIndex}
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-[#171b22] rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-950/30 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Delete Module
                </h3>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                  Are you sure you want to delete &quot;{module.name}&quot;? This will also remove all weeks
                  and day content within this module. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? 'Deleting...' : 'Delete Module'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
