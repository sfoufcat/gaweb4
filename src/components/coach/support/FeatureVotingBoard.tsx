'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Rocket, 
  ThumbsUp, 
  Plus, 
  Loader2, 
  CheckCircle2,
  Lightbulb,
  X
} from 'lucide-react';
import type { FeatureRequest } from '@/types';

interface FeaturesData {
  inProgress: FeatureRequest[];
  suggested: FeatureRequest[];
  completed: FeatureRequest[];
  userVotedFeatureIds: string[];
}

export function FeatureVotingBoard() {
  const [data, setData] = useState<FeaturesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingFeatureId, setVotingFeatureId] = useState<string | null>(null);
  const [showSuggestForm, setShowSuggestForm] = useState(false);

  const fetchFeatures = useCallback(async () => {
    try {
      const response = await fetch('/api/features');
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

  const handleVote = async (featureId: string) => {
    if (votingFeatureId) return;
    setVotingFeatureId(featureId);

    try {
      const response = await fetch(`/api/features/${featureId}/vote`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to vote');
      }

      // Update local state
      setData(prev => {
        if (!prev) return prev;
        
        const updateVoteCount = (features: FeatureRequest[]) =>
          features.map(f => 
            f.id === featureId 
              ? { ...f, voteCount: result.voteCount }
              : f
          );

        return {
          ...prev,
          suggested: updateVoteCount(prev.suggested).sort((a, b) => b.voteCount - a.voteCount),
          userVotedFeatureIds: result.voted
            ? [...prev.userVotedFeatureIds, featureId]
            : prev.userVotedFeatureIds.filter(id => id !== featureId),
        };
      });
    } catch (err) {
      console.error('Vote error:', err);
    } finally {
      setVotingFeatureId(null);
    }
  };

  const handleSuggestionSubmit = async (title: string, description: string) => {
    const response = await fetch('/api/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to submit');
    }

    // Refresh the list
    await fetchFeatures();
    setShowSuggestForm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#a07855] dark:text-[#b8896a]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400 font-albert">{error}</p>
        <button
          onClick={fetchFeatures}
          className="mt-2 text-sm text-[#a07855] dark:text-[#b8896a] hover:underline font-albert"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* In Progress Section */}
      {data?.inProgress && data.inProgress.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide font-albert mb-3 flex items-center gap-2">
            <Rocket className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
            In Progress
          </h4>
          <div className="space-y-2">
            {data.inProgress.map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-[#a07855]/5 to-transparent dark:from-[#b8896a]/10 border border-[#a07855]/20 dark:border-[#b8896a]/20 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#a07855]/10 dark:bg-[#b8896a]/20 flex items-center justify-center">
                    <Rocket className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
                  </div>
                  <div>
                    <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {feature.title}
                    </p>
                    {feature.description && (
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert line-clamp-1">
                        {feature.description}
                      </p>
                    )}
                  </div>
                </div>
                <span className="px-3 py-1 bg-[#a07855]/10 dark:bg-[#b8896a]/20 text-[#a07855] dark:text-[#b8896a] text-xs font-medium rounded-full font-albert">
                  Building
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Community Suggestions Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide font-albert flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Community Suggestions
          </h4>
          <button
            onClick={() => setShowSuggestForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-albert font-medium text-[#a07855] dark:text-[#b8896a] hover:bg-[#a07855]/10 dark:hover:bg-[#b8896a]/10 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Suggest Feature
          </button>
        </div>

        {data?.suggested && data.suggested.length > 0 ? (
          <div className="space-y-2">
            {data.suggested.map((feature) => {
              const hasVoted = data.userVotedFeatureIds.includes(feature.id);
              const isVoting = votingFeatureId === feature.id;

              return (
                <div
                  key={feature.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:border-[#a07855]/30 dark:hover:border-[#b8896a]/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex flex-col items-center justify-center min-w-[48px] px-2 py-1 rounded-lg ${
                      hasVoted 
                        ? 'bg-[#a07855]/10 dark:bg-[#b8896a]/20' 
                        : 'bg-[#faf8f6] dark:bg-[#262b35]'
                    }`}>
                      <span className={`text-lg font-bold font-albert ${
                        hasVoted 
                          ? 'text-[#a07855] dark:text-[#b8896a]' 
                          : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                      }`}>
                        {feature.voteCount}
                      </span>
                      <span className="text-[10px] text-[#8c8680] dark:text-[#6b7280] font-albert uppercase">
                        votes
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {feature.title}
                      </p>
                      {feature.description && (
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert line-clamp-1">
                          {feature.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleVote(feature.id)}
                    disabled={isVoting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-albert font-medium transition-all ${
                      hasVoted
                        ? 'bg-[#a07855] dark:bg-[#b8896a] text-white'
                        : 'bg-[#faf8f6] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#a07855]/10 dark:hover:bg-[#b8896a]/10 hover:text-[#a07855] dark:hover:text-[#b8896a]'
                    } disabled:opacity-50`}
                  >
                    {isVoting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : hasVoted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Voted
                      </>
                    ) : (
                      <>
                        <ThumbsUp className="w-4 h-4" />
                        Vote
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-[#faf8f6] dark:bg-[#171b22] rounded-xl border border-dashed border-[#e1ddd8] dark:border-[#262b35]">
            <Lightbulb className="w-8 h-8 text-[#8c8680] dark:text-[#6b7280] mx-auto mb-2" />
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              No suggestions yet. Be the first!
            </p>
          </div>
        )}
      </div>

      {/* Completed Section */}
      {data?.completed && data.completed.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide font-albert mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Recently Shipped
          </h4>
          <div className="space-y-2">
            {data.completed.slice(0, 3).map((feature) => (
              <div
                key={feature.id}
                className="flex items-center gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30 rounded-xl"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <p className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">
                  {feature.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestion Modal */}
      {showSuggestForm && (
        <SuggestFeatureModal
          onClose={() => setShowSuggestForm(false)}
          onSubmit={handleSuggestionSubmit}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUGGEST FEATURE MODAL
// =============================================================================

interface SuggestFeatureModalProps {
  onClose: () => void;
  onSubmit: (title: string, description: string) => Promise<void>;
}

function SuggestFeatureModal({ onClose, onSubmit }: SuggestFeatureModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(title, description);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <>
      {/* Backdrop with fade-in animation */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal with scale + fade animation */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="relative w-full max-w-md bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <h3 className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8]">
              Suggest a Feature
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#faf8f6] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label 
                htmlFor="feature-title"
                className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5"
              >
                Feature Title
              </label>
              <input
                id="feature-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Dark mode for mobile app"
                required
                minLength={5}
                maxLength={100}
                className="w-full px-4 py-2.5 bg-[#faf8f6] dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8680] dark:placeholder:text-[#6b7280] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:focus:border-[#b8896a] transition-all"
              />
            </div>

            <div>
              <label 
                htmlFor="feature-description"
                className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5"
              >
                Description
              </label>
              <textarea
                id="feature-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the feature and why it would be helpful..."
                required
                minLength={20}
                maxLength={1000}
                rows={4}
                className="w-full px-4 py-2.5 bg-[#faf8f6] dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8680] dark:placeholder:text-[#6b7280] font-albert focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:focus:border-[#b8896a] transition-all resize-none"
              />
              <p className="mt-1 text-xs text-[#8c8680] dark:text-[#6b7280] font-albert">
                {description.length}/1000 characters (min 20)
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 font-albert">
                {error}
              </p>
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
                disabled={isSubmitting || title.trim().length < 5 || description.trim().length < 20}
                style={{
                  background: `linear-gradient(to right, var(--brand-accent-light, #a07855), var(--brand-accent-dark, #8c6245))`,
                  color: `var(--brand-accent-foreground, #ffffff)`,
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 font-albert font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Submit
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}


