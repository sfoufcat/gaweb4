'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Quiz, QuizWithSteps, UserTrack } from '@/types';
import { TRACKS } from '@/lib/track-constants';
import { QuizEditorDialog } from './QuizEditorDialog';
import { QuizStepsEditor } from './QuizStepsEditor';

type ViewMode = 'list' | 'editing';

export function AdminQuizzesTab() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialogs & editing
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showEditDetailsDialog, setShowEditDetailsDialog] = useState(false);
  const [quizToClone, setQuizToClone] = useState<Quiz | null>(null);
  const [quizToEdit, setQuizToEdit] = useState<Quiz | null>(null);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const fetchQuizzes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/quizzes');
      if (!response.ok) throw new Error('Failed to fetch quizzes');
      const data = await response.json();
      setQuizzes(data.quizzes || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quizzes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleToggleActive = async (quiz: Quiz) => {
    try {
      const response = await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !quiz.isActive }),
      });
      if (!response.ok) throw new Error('Failed to update quiz');
      await fetchQuizzes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update quiz');
    }
  };

  const handleDelete = async (quiz: Quiz) => {
    if (!confirm(`Are you sure you want to delete "${quiz.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/quizzes/${quiz.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete quiz');
      await fetchQuizzes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete quiz');
    }
  };

  const handleClone = (quiz: Quiz) => {
    setQuizToClone(quiz);
    setShowCloneDialog(true);
  };

  const handleEditDetails = (quiz: Quiz) => {
    setQuizToEdit(quiz);
    setShowEditDetailsDialog(true);
  };

  const handleEditSteps = (quiz: Quiz) => {
    setEditingQuizId(quiz.id);
    setViewMode('editing');
  };

  const handleBackToList = () => {
    setEditingQuizId(null);
    setViewMode('list');
    fetchQuizzes();
  };

  const getTrackLabel = (trackId: UserTrack | null) => {
    if (!trackId) return 'Unassigned';
    const track = TRACKS.find(t => t.id === trackId);
    return track?.label || trackId;
  };

  if (viewMode === 'editing' && editingQuizId) {
    return (
      <QuizStepsEditor
        quizId={editingQuizId}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Onboarding Quizzes
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Manage quiz content for each track&apos;s onboarding flow
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2 bg-[#a07855] text-white rounded-lg font-albert text-sm font-medium hover:bg-[#8c6245] transition-colors"
        >
          + Create Quiz
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchQuizzes}
            className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#a07855] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Quiz list */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {quizzes.length === 0 ? (
            <div className="text-center py-12 text-[#5f5a55] dark:text-[#b2b6c2]">
              <p className="font-albert">No quizzes found.</p>
              <p className="text-sm mt-1">Create your first quiz to get started.</p>
            </div>
          ) : (
            quizzes.map(quiz => (
              <div
                key={quiz.id}
                className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {quiz.title}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        quiz.isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}>
                        {quiz.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      <span className="font-mono text-xs bg-[#f5f2ed] dark:bg-[#262b35] px-2 py-0.5 rounded">
                        /{quiz.slug}
                      </span>
                      <span>Track: {getTrackLabel(quiz.trackId)}</span>
                      <span>{quiz.stepCount || 0} steps</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditSteps(quiz)}
                      className="px-3 py-1.5 text-sm text-[#a07855] hover:bg-[#a07855]/10 rounded-lg transition-colors font-albert"
                    >
                      Edit Steps
                    </button>
                    <button
                      onClick={() => handleEditDetails(quiz)}
                      className="px-3 py-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded-lg transition-colors font-albert"
                    >
                      Edit Details
                    </button>
                    <button
                      onClick={() => handleClone(quiz)}
                      className="px-3 py-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded-lg transition-colors font-albert"
                    >
                      Clone
                    </button>
                    <button
                      onClick={() => handleToggleActive(quiz)}
                      className="px-3 py-1.5 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded-lg transition-colors font-albert"
                    >
                      {quiz.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(quiz)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-albert"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Quiz Dialog */}
      {showCreateDialog && (
        <QuizEditorDialog
          mode="create"
          onClose={() => setShowCreateDialog(false)}
          onSaved={() => {
            setShowCreateDialog(false);
            fetchQuizzes();
          }}
        />
      )}

      {/* Clone Quiz Dialog */}
      {showCloneDialog && quizToClone && (
        <QuizEditorDialog
          mode="clone"
          sourceQuiz={quizToClone}
          onClose={() => {
            setShowCloneDialog(false);
            setQuizToClone(null);
          }}
          onSaved={() => {
            setShowCloneDialog(false);
            setQuizToClone(null);
            fetchQuizzes();
          }}
        />
      )}

      {/* Edit Quiz Details Dialog */}
      {showEditDetailsDialog && quizToEdit && (
        <QuizEditorDialog
          mode="edit"
          sourceQuiz={quizToEdit}
          onClose={() => {
            setShowEditDetailsDialog(false);
            setQuizToEdit(null);
          }}
          onSaved={() => {
            setShowEditDetailsDialog(false);
            setQuizToEdit(null);
            fetchQuizzes();
          }}
        />
      )}
    </div>
  );
}

