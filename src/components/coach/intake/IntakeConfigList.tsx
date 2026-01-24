'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  Video,
  Link as LinkIcon,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { IntakeCallConfig } from '@/types';
import { IntakeConfigEditor } from './IntakeConfigEditor';
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

const PROVIDER_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  in_app: 'In-app Call',
  manual: 'Custom Link',
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  zoom: <Video className="h-4 w-4" />,
  google_meet: <Video className="h-4 w-4" />,
  in_app: <Video className="h-4 w-4" />,
  manual: <LinkIcon className="h-4 w-4" />,
};

export function IntakeConfigList() {
  const { isDemoMode } = useDemoMode();

  const [configs, setConfigs] = useState<IntakeCallConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingConfig, setEditingConfig] = useState<IntakeCallConfig | null>(null);

  // Delete confirmation
  const [configToDelete, setConfigToDelete] = useState<IntakeCallConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch configs
  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/coach/intake-configs');
      if (!response.ok) {
        throw new Error('Failed to fetch intake configs');
      }

      const data = await response.json();
      setConfigs(data.configs || []);
    } catch (err) {
      console.error('Error fetching intake configs:', err);
      setError('Failed to load intake call configurations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingConfig(null);
    setShowEditor(true);
  };

  const handleEdit = (config: IntakeCallConfig) => {
    setEditingConfig(config);
    setShowEditor(true);
  };

  const handleDelete = async () => {
    if (!configToDelete) return;

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/coach/intake-configs/${configToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      setConfigs(prev => prev.filter(c => c.id !== configToDelete.id));
      setConfigToDelete(null);
    } catch (err) {
      console.error('Error deleting config:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = (config: IntakeCallConfig) => {
    if (editingConfig) {
      // Update existing
      setConfigs(prev => prev.map(c => c.id === config.id ? config : c));
    } else {
      // Add new
      setConfigs(prev => [config, ...prev]);
    }
    setShowEditor(false);
    setEditingConfig(null);
  };

  const handleToggleActive = async (config: IntakeCallConfig) => {
    try {
      const response = await fetch(`/api/coach/intake-configs/${config.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !config.isActive }),
      });

      if (!response.ok) {
        throw new Error('Failed to update');
      }

      const data = await response.json();
      setConfigs(prev => prev.map(c => c.id === config.id ? data.config : c));
    } catch (err) {
      console.error('Error toggling config:', err);
    }
  };

  if (showEditor) {
    return (
      <IntakeConfigEditor
        config={editingConfig}
        onSave={handleSave}
        onCancel={() => {
          setShowEditor(false);
          setEditingConfig(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Intake Calls
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create booking links for discovery calls, strategy sessions, and more
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Intake Call</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && configs.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No intake calls yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create a booking link for potential clients to schedule calls with you
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Your First Intake Call</span>
          </button>
        </div>
      )}

      {/* Config list */}
      <AnimatePresence mode="popLayout">
        {configs.map(config => (
          <motion.div
            key={config.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 border rounded-lg transition-colors ${
              config.isActive
                ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-75'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {config.name}
                  </h3>
                  {!config.isActive && (
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {config.duration} min
                  </span>
                  <span className="flex items-center gap-1">
                    {PROVIDER_ICONS[config.meetingProvider]}
                    {PROVIDER_LABELS[config.meetingProvider]}
                  </span>
                </div>

                {config.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                    {config.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* More actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(config)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleActive(config)}>
                      {config.isActive ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfigToDelete(config)}
                      className="text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AlertDialog open={!!configToDelete} onOpenChange={() => setConfigToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Intake Call?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{configToDelete?.name}".
              Existing bookings will not be affected, but the booking link will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
