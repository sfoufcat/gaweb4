'use client';

import React, { useState, useEffect, useCallback, Fragment } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, Transition } from '@headlessui/react';
import {
  LayoutTemplate, Search, Filter, Clock, CheckCircle2, XCircle, Eye,
  Star, StarOff, Globe, GlobeLock, Trash2, ChevronRight, Calendar,
  ListTodo, Users, Loader2, RefreshCw, X, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProgramTemplate, TemplateCategory, TemplateStatus } from '@/types';

type FilterStatus = 'all' | TemplateStatus;

const STATUS_STYLES: Record<TemplateStatus, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending_review: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', icon: Clock },
  published: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: CheckCircle2 },
  draft: { bg: 'bg-gray-100 dark:bg-gray-800/50', text: 'text-gray-600 dark:text-gray-400', icon: Eye },
  rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: XCircle },
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  business: 'Business',
  habits: 'Habits',
  mindset: 'Mindset',
  health: 'Health',
  productivity: 'Productivity',
  relationships: 'Relationships',
};

export function AdminTemplatesTab() {
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    total: 0,
    pending_review: 0,
    published: 0,
    draft: 0,
    rejected: 0,
  });
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProgramTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ProgramTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/templates');
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      
      const data = await response.json();
      setTemplates(data.templates || []);
      setCounts(data.counts || { total: 0, pending_review: 0, published: 0, draft: 0, rejected: 0 });
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(query) || 
             t.description.toLowerCase().includes(query) ||
             t.creatorName?.toLowerCase().includes(query);
    }
    return true;
  });

  // Actions
  const handleAction = async (templateId: string, action: string) => {
    try {
      setActionLoading(templateId);
      
      const response = await fetch(`/api/admin/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      if (!response.ok) {
        throw new Error('Action failed');
      }
      
      await fetchTemplates();
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      setActionLoading(deleteConfirm.id);
      
      const response = await fetch(`/api/admin/templates/${deleteConfirm.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Delete failed');
      }
      
      setDeleteConfirm(null);
      await fetchTemplates();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Template Library
          </h2>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
            Manage program templates for coaches
          </p>
        </div>
        <button
          onClick={fetchTemplates}
          disabled={loading}
          className="p-2 rounded-lg text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard 
          label="Total" 
          value={counts.total} 
          onClick={() => setFilterStatus('all')}
          active={filterStatus === 'all'}
        />
        <StatCard 
          label="Pending Review" 
          value={counts.pending_review} 
          color="amber"
          onClick={() => setFilterStatus('pending_review')}
          active={filterStatus === 'pending_review'}
        />
        <StatCard 
          label="Published" 
          value={counts.published} 
          color="green"
          onClick={() => setFilterStatus('published')}
          active={filterStatus === 'published'}
        />
        <StatCard 
          label="Draft" 
          value={counts.draft}
          onClick={() => setFilterStatus('draft')}
          active={filterStatus === 'draft'}
        />
        <StatCard 
          label="Rejected" 
          value={counts.rejected} 
          color="red"
          onClick={() => setFilterStatus('rejected')}
          active={filterStatus === 'rejected'}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30"
        />
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#a07855] dark:text-[#b8896a] animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500">{error}</p>
          <button onClick={fetchTemplates} className="text-[#a07855] dark:text-[#b8896a] text-sm mt-2 hover:underline">
            Try again
          </button>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-20">
          <LayoutTemplate className="w-12 h-12 text-[#a7a39e] mx-auto mb-4" />
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            {searchQuery ? 'No templates match your search' : 'No templates found'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              onAction={(action) => handleAction(template.id, action)}
              onDelete={() => setDeleteConfirm(template)}
              onView={() => setSelectedTemplate(template)}
              loading={actionLoading === template.id}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Transition appear show={!!deleteConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !actionLoading && setDeleteConfirm(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 shadow-xl">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Delete Template?
                      </Dialog.Title>
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                        This will permanently delete "{deleteConfirm?.name}" and all its content. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteConfirm(null)}
                      disabled={!!actionLoading}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDelete}
                      disabled={!!actionLoading}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {actionLoading ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  color?: 'amber' | 'green' | 'red';
  onClick: () => void;
  active: boolean;
}

function StatCard({ label, value, color, onClick, active }: StatCardProps) {
  const colorStyles = {
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };
  
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all text-left ${
        active 
          ? 'border-[#a07855] dark:border-[#b8896a] ring-2 ring-[#a07855] dark:ring-[#b8896a]/20' 
          : color 
            ? colorStyles[color] 
            : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35]'
      } hover:border-[#a07855] dark:border-[#b8896a]/50`}
    >
      <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{value}</p>
      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">{label}</p>
    </button>
  );
}

// Template Row Component
interface TemplateRowProps {
  template: ProgramTemplate;
  onAction: (action: string) => void;
  onDelete: () => void;
  onView: () => void;
  loading: boolean;
}

function TemplateRow({ template, onAction, onDelete, onView, loading }: TemplateRowProps) {
  const statusStyle = STATUS_STYLES[template.status];
  const StatusIcon = statusStyle.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35]"
    >
      {/* Cover */}
      <div className="w-16 h-12 rounded-lg bg-[#f3f1ef] dark:bg-[#262b35] overflow-hidden flex-shrink-0">
        {template.coverImageUrl ? (
          <Image
            src={template.coverImageUrl}
            alt={template.name}
            width={64}
            height={48}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <LayoutTemplate className="w-6 h-6 text-[#a7a39e]" />
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
            {template.name}
          </h3>
          {template.featured && (
            <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {template.lengthDays}d
          </span>
          <span className="capitalize">{CATEGORY_LABELS[template.category]}</span>
          {template.createdBy !== 'platform' && (
            <span>by {template.creatorName || 'Coach'}</span>
          )}
          {template.usageCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {template.usageCount}
            </span>
          )}
        </div>
      </div>
      
      {/* Status Badge */}
      <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${statusStyle.bg} ${statusStyle.text}`}>
        <StatusIcon className="w-3.5 h-3.5" />
        <span className="text-xs font-medium capitalize">
          {template.status.replace('_', ' ')}
        </span>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1">
        {template.status === 'pending_review' && (
          <>
            <ActionButton
              onClick={() => onAction('approve')}
              disabled={loading}
              icon={CheckCircle2}
              label="Approve"
              variant="success"
            />
            <ActionButton
              onClick={() => onAction('reject')}
              disabled={loading}
              icon={XCircle}
              label="Reject"
              variant="danger"
            />
          </>
        )}
        
        {template.status === 'published' && (
          <>
            <ActionButton
              onClick={() => onAction(template.featured ? 'unfeature' : 'feature')}
              disabled={loading}
              icon={template.featured ? StarOff : Star}
              label={template.featured ? 'Unfeature' : 'Feature'}
            />
            <ActionButton
              onClick={() => onAction('unpublish')}
              disabled={loading}
              icon={GlobeLock}
              label="Unpublish"
            />
          </>
        )}
        
        {template.status === 'draft' && (
          <ActionButton
            onClick={() => onAction('publish')}
            disabled={loading}
            icon={Globe}
            label="Publish"
            variant="success"
          />
        )}
        
        {template.status === 'rejected' && (
          <ActionButton
            onClick={() => onAction('approve')}
            disabled={loading}
            icon={CheckCircle2}
            label="Approve"
            variant="success"
          />
        )}
        
        <ActionButton
          onClick={onDelete}
          disabled={loading}
          icon={Trash2}
          label="Delete"
          variant="danger"
        />
      </div>
    </motion.div>
  );
}

// Action Button Component
interface ActionButtonProps {
  onClick: () => void;
  disabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant?: 'default' | 'success' | 'danger';
}

function ActionButton({ onClick, disabled, icon: Icon, label, variant = 'default' }: ActionButtonProps) {
  const variants = {
    default: 'text-[#5f5a55] hover:text-[#1a1a1a] hover:bg-[#f3f1ef] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] dark:hover:bg-[#262b35]',
    success: 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20',
    danger: 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${variants[variant]}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

