'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Lightbulb, 
  Rocket, 
  CheckCircle2, 
  XCircle,
  Plus,
  Loader2,
  MoreVertical,
  GripVertical,
  Edit2,
  Trash2,
  Eye,
  ArrowUp,
  ArrowDown,
  Users,
  X
} from 'lucide-react';
import type { FeatureRequest, FeatureRequestStatus } from '@/types';

interface FeaturesData {
  byStatus: {
    in_progress: FeatureRequest[];
    suggested: FeatureRequest[];
    completed: FeatureRequest[];
    declined: FeatureRequest[];
  };
  counts: {
    total: number;
    in_progress: number;
    suggested: number;
    completed: number;
    declined: number;
  };
}

const STATUS_CONFIG: Record<FeatureRequestStatus, {
  label: string;
  icon: typeof Rocket;
  color: string;
  bgColor: string;
}> = {
  in_progress: {
    label: 'In Progress',
    icon: Rocket,
    color: 'text-[#a07855] dark:text-[#b8896a]',
    bgColor: 'bg-[#a07855]/10 dark:bg-[#b8896a]/20',
  },
  suggested: {
    label: 'Suggested',
    icon: Lightbulb,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  declined: {
    label: 'Declined',
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
};

export function AdminFeaturesTab() {
  const [data, setData] = useState<FeaturesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<FeatureRequest | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/features');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch');
      }

      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load features');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = () => setActiveDropdown(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleStatusChange = async (featureId: string, newStatus: FeatureRequestStatus) => {
    try {
      const response = await fetch(`/api/admin/features/${featureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      await fetchFeatures();
    } catch (err) {
      console.error('Status update error:', err);
    }
    setActiveDropdown(null);
  };

  const handleDelete = async (featureId: string) => {
    if (!confirm('Are you sure you want to delete this feature request? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/features/${featureId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      await fetchFeatures();
    } catch (err) {
      console.error('Delete error:', err);
    }
    setActiveDropdown(null);
  };

  const handlePriorityChange = async (featureId: string, direction: 'up' | 'down') => {
    const inProgress = data?.byStatus.in_progress || [];
    const currentIndex = inProgress.findIndex(f => f.id === featureId);
    if (currentIndex === -1) return;

    const newPriority = direction === 'up' 
      ? (inProgress[currentIndex - 1]?.priority || 0) - 1
      : (inProgress[currentIndex + 1]?.priority || inProgress.length) + 1;

    try {
      await fetch(`/api/admin/features/${featureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      await fetchFeatures();
    } catch (err) {
      console.error('Priority change error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#a07855] dark:text-[#b8896a]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 font-albert mb-4">{error}</p>
        <button
          onClick={fetchFeatures}
          className="text-[#a07855] dark:text-[#b8896a] hover:underline font-albert"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
            Feature Requests
          </h2>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
            Manage feature requests from coaches. {data?.counts.total || 0} total requests.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#a07855] to-[#8c6245] hover:from-[#8c6245] hover:to-[#7a5539] text-white font-albert font-medium rounded-xl transition-all shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          Add Feature
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.entries(STATUS_CONFIG) as [FeatureRequestStatus, typeof STATUS_CONFIG[FeatureRequestStatus]][]).map(([status, config]) => {
          const Icon = config.icon;
          const count = data?.counts[status] || 0;
          return (
            <div
              key={status}
              className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {count}
                  </p>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    {config.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* In Progress Section */}
      <section>
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3 flex items-center gap-2">
          <Rocket className="w-5 h-5 text-[#a07855] dark:text-[#b8896a]" />
          In Progress ({data?.byStatus.in_progress.length || 0})
        </h3>
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          {data?.byStatus.in_progress.length === 0 ? (
            <div className="p-8 text-center text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              No features in progress. Move suggestions here to show coaches what you&apos;re building.
            </div>
          ) : (
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {data?.byStatus.in_progress.map((feature, index) => (
                <FeatureRow
                  key={feature.id}
                  feature={feature}
                  showPriority
                  canMoveUp={index > 0}
                  canMoveDown={index < (data?.byStatus.in_progress.length || 0) - 1}
                  onMoveUp={() => handlePriorityChange(feature.id, 'up')}
                  onMoveDown={() => handlePriorityChange(feature.id, 'down')}
                  onStatusChange={(status) => handleStatusChange(feature.id, status)}
                  onEdit={() => setEditingFeature(feature)}
                  onDelete={() => handleDelete(feature.id)}
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Suggested Section */}
      <section>
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          Suggested ({data?.byStatus.suggested.length || 0})
        </h3>
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          {data?.byStatus.suggested.length === 0 ? (
            <div className="p-8 text-center text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              No pending suggestions from coaches.
            </div>
          ) : (
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {data?.byStatus.suggested.map((feature) => (
                <FeatureRow
                  key={feature.id}
                  feature={feature}
                  showVotes
                  onStatusChange={(status) => handleStatusChange(feature.id, status)}
                  onEdit={() => setEditingFeature(feature)}
                  onDelete={() => handleDelete(feature.id)}
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Completed Section */}
      {data?.byStatus.completed && data.byStatus.completed.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Completed ({data.byStatus.completed.length})
          </h3>
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {data.byStatus.completed.map((feature) => (
                <FeatureRow
                  key={feature.id}
                  feature={feature}
                  onStatusChange={(status) => handleStatusChange(feature.id, status)}
                  onEdit={() => setEditingFeature(feature)}
                  onDelete={() => handleDelete(feature.id)}
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Declined Section */}
      {data?.byStatus.declined && data.byStatus.declined.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            Declined ({data.byStatus.declined.length})
          </h3>
          <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {data.byStatus.declined.map((feature) => (
                <FeatureRow
                  key={feature.id}
                  feature={feature}
                  onStatusChange={(status) => handleStatusChange(feature.id, status)}
                  onEdit={() => setEditingFeature(feature)}
                  onDelete={() => handleDelete(feature.id)}
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingFeature) && (
        <FeatureModal
          feature={editingFeature}
          onClose={() => {
            setShowCreateModal(false);
            setEditingFeature(null);
          }}
          onSave={async () => {
            await fetchFeatures();
            setShowCreateModal(false);
            setEditingFeature(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// FEATURE ROW COMPONENT
// =============================================================================

interface FeatureRowProps {
  feature: FeatureRequest;
  showVotes?: boolean;
  showPriority?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onStatusChange: (status: FeatureRequestStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  activeDropdown: string | null;
  setActiveDropdown: (id: string | null) => void;
}

function FeatureRow({
  feature,
  showVotes,
  showPriority,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onStatusChange,
  onEdit,
  onDelete,
  activeDropdown,
  setActiveDropdown,
}: FeatureRowProps) {
  const statusConfig = STATUS_CONFIG[feature.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-[#faf8f6] dark:hover:bg-[#262b35]/50 transition-colors">
      {/* Priority Controls */}
      {showPriority && (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-1 text-[#8c8680] dark:text-[#6b7280] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <GripVertical className="w-4 h-4 text-[#8c8680] dark:text-[#6b7280]" />
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-1 text-[#8c8680] dark:text-[#6b7280] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Vote Count */}
      {showVotes && (
        <div className="flex flex-col items-center min-w-[48px] px-2 py-1 bg-[#faf8f6] dark:bg-[#262b35] rounded-lg">
          <span className="text-lg font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {feature.voteCount}
          </span>
          <span className="text-[10px] text-[#8c8680] dark:text-[#6b7280] font-albert uppercase">
            votes
          </span>
        </div>
      )}

      {/* Status Badge */}
      <div className={`w-8 h-8 rounded-lg ${statusConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
        <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
          {feature.title}
        </p>
        {feature.description && (
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert line-clamp-1">
            {feature.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-[#8c8680] dark:text-[#6b7280] font-albert">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {feature.suggestedByName}
          </span>
          <span>
            {new Date(feature.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Actions Dropdown */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveDropdown(activeDropdown === feature.id ? null : feature.id);
          }}
          className="p-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] rounded-lg transition-colors"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {activeDropdown === feature.id && (
          <div 
            className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg py-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onEdit()}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#faf8f6] dark:hover:bg-[#262b35] font-albert"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            
            <div className="border-t border-[#e1ddd8] dark:border-[#262b35] my-1" />
            
            <p className="px-4 py-1 text-xs text-[#8c8680] dark:text-[#6b7280] font-albert uppercase">
              Move to
            </p>
            
            {(Object.keys(STATUS_CONFIG) as FeatureRequestStatus[])
              .filter(status => status !== feature.status)
              .map((status) => {
                const config = STATUS_CONFIG[status];
                const Icon = config.icon;
                return (
                  <button
                    key={status}
                    onClick={() => onStatusChange(status)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#faf8f6] dark:hover:bg-[#262b35] font-albert"
                  >
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    {config.label}
                  </button>
                );
              })}
            
            <div className="border-t border-[#e1ddd8] dark:border-[#262b35] my-1" />
            
            <button
              onClick={() => onDelete()}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-albert"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// FEATURE MODAL (CREATE/EDIT)
// =============================================================================

interface FeatureModalProps {
  feature: FeatureRequest | null;
  onClose: () => void;
  onSave: () => Promise<void>;
}

function FeatureModal({ feature, onClose, onSave }: FeatureModalProps) {
  const [title, setTitle] = useState(feature?.title || '');
  const [description, setDescription] = useState(feature?.description || '');
  const [status, setStatus] = useState<FeatureRequestStatus>(feature?.status || 'in_progress');
  const [priority, setPriority] = useState(feature?.priority?.toString() || '');
  const [adminNotes, setAdminNotes] = useState(feature?.adminNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!feature;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const url = isEdit 
        ? `/api/admin/features/${feature.id}`
        : '/api/admin/features';
      
      const response = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          status,
          priority: priority ? parseInt(priority) : undefined,
          adminNotes: adminNotes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      await onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h3 className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8]">
            {isEdit ? 'Edit Feature' : 'Add Feature'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-[#262b35] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Feature title"
              required
              minLength={3}
              className="w-full px-4 py-2.5 bg-[#faf8f6] dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Feature description (optional)"
              rows={3}
              className="w-full px-4 py-2.5 bg-[#faf8f6] dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FeatureRequestStatus)}
                className="w-full px-4 py-2.5 bg-[#faf8f6] dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30"
              >
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5">
                Priority (optional)
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="1, 2, 3..."
                min={1}
                className="w-full px-4 py-2.5 bg-[#faf8f6] dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5">
              Admin Notes (internal only)
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Internal notes not shown to users..."
              rows={2}
              className="w-full px-4 py-2.5 bg-[#faf8f6] dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-[#faf8f6] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] font-albert font-medium rounded-xl hover:bg-[#e1ddd8] dark:hover:bg-[#2d333e] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#a07855] to-[#8c6245] hover:from-[#8c6245] hover:to-[#7a5539] text-white font-albert font-medium rounded-xl transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                isEdit ? 'Save Changes' : 'Create Feature'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}





