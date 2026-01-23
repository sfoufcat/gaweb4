'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Button } from '@/components/ui/button';
import { Plus, Search, Pencil, Trash2, BarChart3, Copy, Check, ClipboardList, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuestionnaireBuilder } from '@/components/coach/questionnaires/QuestionnaireBuilder';
import { ResponsesViewer } from '@/components/coach/questionnaires/ResponsesViewer';
import type { Questionnaire } from '@/types/questionnaire';

type ViewMode = 'list' | 'builder' | 'responses';

interface AdminQuestionnairesSectionProps {
  apiEndpoint?: string;
}

export function AdminQuestionnairesSection({
  apiEndpoint = '/api/coach/questionnaires',
}: AdminQuestionnairesSectionProps) {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Questionnaire | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // View management
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);

  // Fetch questionnaires
  const fetchQuestionnaires = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await fetch(apiEndpoint);
      if (!response.ok) throw new Error('Failed to fetch questionnaires');
      const data = await response.json();
      setQuestionnaires(data.questionnaires || []);
    } catch (error) {
      console.error('Error fetching questionnaires:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [apiEndpoint]);

  useEffect(() => {
    fetchQuestionnaires();
  }, [fetchQuestionnaires]);

  // Refresh selected questionnaire after save
  const refreshSelectedQuestionnaire = useCallback(async () => {
    if (!selectedQuestionnaire) return;
    try {
      const response = await fetch(`${apiEndpoint}/${selectedQuestionnaire.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedQuestionnaire(data);
      }
    } catch (error) {
      console.error('Error refreshing questionnaire:', error);
    }
  }, [apiEndpoint, selectedQuestionnaire]);

  // Filter questionnaires by search
  const filteredQuestionnaires = questionnaires.filter(q =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchExpand = useCallback(() => {
    setIsSearchExpanded(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSearchCollapse = useCallback(() => {
    setIsSearchExpanded(false);
    setSearchQuery('');
  }, []);

  // Handle delete
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      const response = await fetch(`${apiEndpoint}/${deleteConfirm.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete questionnaire');
      await fetchQuestionnaires();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting questionnaire:', error);
      alert('Failed to delete questionnaire');
    } finally {
      setDeleting(false);
    }
  };

  // Handle copy link
  const handleCopyLink = async (questionnaire: Questionnaire) => {
    const url = `${window.location.origin}/q/${questionnaire.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(questionnaire.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // Handle create new questionnaire
  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Questionnaire',
          description: '',
          questions: [],
          isActive: false,
        }),
      });
      if (!response.ok) throw new Error('Failed to create questionnaire');
      const newQuestionnaire = await response.json();
      // Don't show loading skeleton when refreshing after create
      await fetchQuestionnaires(false);
      setSelectedQuestionnaire(newQuestionnaire);
      setViewMode('builder');
    } catch (error) {
      console.error('Error creating questionnaire:', error);
      alert('Failed to create questionnaire');
    } finally {
      setCreating(false);
    }
  };

  // Handle edit
  const handleEdit = (questionnaire: Questionnaire) => {
    setSelectedQuestionnaire(questionnaire);
    setViewMode('builder');
  };

  // Handle view responses
  const handleViewResponses = (questionnaire: Questionnaire) => {
    setSelectedQuestionnaire(questionnaire);
    setViewMode('responses');
  };

  // Handle back to list
  const handleBackToList = async () => {
    setViewMode('list');
    setSelectedQuestionnaire(null);
    // Don't show skeleton when coming back from builder - just refresh silently
    await fetchQuestionnaires(false);
  };

  // Handle save from builder
  const handleSave = async (data: Partial<Questionnaire>) => {
    if (!selectedQuestionnaire) return;

    try {
      const response = await fetch(`${apiEndpoint}/${selectedQuestionnaire.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save questionnaire');
      await refreshSelectedQuestionnaire();
    } catch (error) {
      console.error('Error saving questionnaire:', error);
      throw error;
    }
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Render builder view
  if (viewMode === 'builder' && selectedQuestionnaire) {
    return (
      <QuestionnaireBuilder
        questionnaire={selectedQuestionnaire}
        onSave={handleSave}
        onBack={handleBackToList}
        onViewResponses={() => handleViewResponses(selectedQuestionnaire)}
        responseCount={selectedQuestionnaire.responseCount || 0}
      />
    );
  }

  // Render responses view
  if (viewMode === 'responses' && selectedQuestionnaire) {
    return (
      <ResponsesViewer
        questionnaireId={selectedQuestionnaire.id}
        questionnaireName={selectedQuestionnaire.title}
        onBack={handleBackToList}
        apiEndpoint={apiEndpoint}
      />
    );
  }

  // Render list view
  return (
    <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <div className="flex items-center justify-between gap-3">
          {/* Title with inline count */}
          <h3 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Questionnaires ({filteredQuestionnaires.length})
          </h3>

          <div className="flex items-center gap-2 ml-auto relative">
            {/* Animated search input */}
            <div
              className={cn(
                "flex items-center overflow-hidden transition-all duration-300 ease-out",
                isSearchExpanded ? "w-48 opacity-100" : "w-0 opacity-0"
              )}
            >
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search questionnaires..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-brand-accent/20 font-albert"
              />
            </div>

            {/* Search toggle button */}
            <button
              onClick={isSearchExpanded ? handleSearchCollapse : handleSearchExpand}
              className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              {isSearchExpanded ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>

            {/* Plus button - always visible */}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-2.5 py-1.5 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors disabled:opacity-70"
            >
              {creating ? (
                <motion.span
                  className="w-4 h-4 border-2 border-[#6b6560]/30 border-t-[#6b6560] dark:border-[#9ca3af]/30 dark:border-t-[#9ca3af] rounded-full block"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span className="hidden sm:inline text-[15px] font-medium">New Form</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#e1ddd8] dark:border-[#262b35]/50 hover:bg-transparent">
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium">
                  Title
                </TableHead>
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium">
                  Questions
                </TableHead>
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium">
                  Responses
                </TableHead>
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium">
                  Status
                </TableHead>
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium">
                  Created
                </TableHead>
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map(i => (
                <TableRow
                  key={i}
                  className="border-b border-[#e1ddd8] dark:border-[#262b35]/50"
                >
                  <TableCell>
                    <div className="space-y-2">
                      <div className="h-4 w-40 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                      <div className="h-3 w-56 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 rounded animate-pulse" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-8 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-6 w-10 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-14 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <div className="h-8 w-8 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
                      <div className="h-8 w-8 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
                      <div className="h-8 w-8 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
                      <div className="h-8 w-8 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filteredQuestionnaires.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-[#f3f1ef] dark:bg-[#262b35] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </div>
          <h4 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            {searchQuery ? 'No questionnaires found' : 'No questionnaires yet'}
          </h4>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6">
            {searchQuery
              ? 'Try a different search term'
              : 'Create your first questionnaire to start collecting responses from clients'}
          </p>
          {!searchQuery && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-block"
            >
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert font-medium disabled:opacity-70"
              >
                <AnimatePresence mode="wait">
                  {creating ? (
                    <motion.span
                      key="creating"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center"
                    >
                      <motion.span
                        className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      Creating...
                    </motion.span>
                  ) : (
                    <motion.span
                      key="create"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Questionnaire
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#e1ddd8] dark:border-[#262b35]/50 hover:bg-transparent">
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium">
                  Title
                </TableHead>
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium">
                  Questions
                </TableHead>
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium">
                  Responses
                </TableHead>
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium">
                  Status
                </TableHead>
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium">
                  Created
                </TableHead>
                <TableHead className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] font-medium text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuestionnaires.map(questionnaire => (
                <TableRow
                  key={questionnaire.id}
                  className="border-b border-[#e1ddd8] dark:border-[#262b35]/50 hover:bg-[#f3f1ef]/50 dark:hover:bg-[#262b35]/30"
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {questionnaire.title}
                      </p>
                      {questionnaire.description && (
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert line-clamp-1 mt-0.5">
                          {questionnaire.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {questionnaire.questions?.length || 0}
                  </TableCell>
                  <TableCell className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                    <button
                      onClick={() => handleViewResponses(questionnaire)}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] text-sm hover:bg-[#e1ddd8] dark:hover:bg-[#363b45] transition-colors"
                    >
                      {questionnaire.responseCount || 0}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-albert ${
                        questionnaire.isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                      }`}
                    >
                      {questionnaire.isActive ? 'Active' : 'Draft'}
                    </span>
                  </TableCell>
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] text-sm">
                    {formatDate(questionnaire.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* Copy Link */}
                      <button
                        onClick={() => handleCopyLink(questionnaire)}
                        className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                        title="Copy link"
                      >
                        <AnimatePresence mode="wait">
                          {copiedId === questionnaire.id ? (
                            <motion.div
                              key="check"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                            >
                              <Check className="w-4 h-4 text-green-500" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="copy"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                            >
                              <Copy className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>

                      {/* View Responses */}
                      <button
                        onClick={() => handleViewResponses(questionnaire)}
                        className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                        title="View responses"
                      >
                        <BarChart3 className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleEdit(questionnaire)}
                        className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteConfirm(questionnaire)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Delete Questionnaire
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Are you sure you want to delete &quot;{deleteConfirm?.title}&quot;? This will also
              delete all {deleteConfirm?.responseCount || 0} response
              {deleteConfirm?.responseCount !== 1 ? 's' : ''}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-albert">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white font-albert"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
