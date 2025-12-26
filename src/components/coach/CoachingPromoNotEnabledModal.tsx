'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Users, Sparkles, ArrowRight, Plus, Loader2, Check } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import type { Program } from '@/types';

interface CoachingPromoNotEnabledModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  
  /**
   * Callback to close the modal
   */
  onClose: () => void;
  
  /**
   * Optional callback when a program is selected to attach
   */
  onAttachProgram?: (programId: string) => void;
}

/**
 * CoachingPromoNotEnabledModal
 * 
 * Shown when a coach clicks on their coaching promo that hasn't been
 * linked to a 1:1 program yet. 
 * - If no 1:1 programs exist: prompts to create one
 * - If 1:1 programs exist: lets user choose to attach existing or create new
 */
export function CoachingPromoNotEnabledModal({
  isOpen,
  onClose,
  onAttachProgram,
}: CoachingPromoNotEnabledModalProps) {
  const router = useRouter();
  const { colors } = useBrandingValues();
  
  // State for fetching existing programs
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState<string | null>(null);
  
  // Fetch individual programs when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchPrograms = async () => {
        setLoading(true);
        try {
          const response = await fetch('/api/coach/org-programs');
          if (response.ok) {
            const data = await response.json();
            // Filter to only individual (1:1) programs
            const individualPrograms = (data.programs || []).filter(
              (p: Program) => p.type === 'individual'
            );
            setPrograms(individualPrograms);
          }
        } catch (err) {
          console.error('Error fetching programs:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchPrograms();
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  const handleCreateNew = () => {
    onClose();
    // Navigate to coach dashboard programs tab
    router.push('/coach?tab=programs');
  };
  
  const handleAttachProgram = async (programId: string) => {
    if (onAttachProgram) {
      setAttaching(programId);
      try {
        // Update the coaching promo with the selected program
        const response = await fetch('/api/coach/org-coaching-promo', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            programId,
            destinationType: 'landing_page',
          }),
        });
        
        if (response.ok) {
          onAttachProgram(programId);
          onClose();
          // Refresh the page to show updated promo
          window.location.reload();
        }
      } catch (err) {
        console.error('Error attaching program:', err);
      } finally {
        setAttaching(null);
      }
    }
  };
  
  const hasExistingPrograms = programs.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-text-secondary hover:text-text-primary dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: `${colors.accentLight}15` }}
          >
            <Sparkles className="w-7 h-7" style={{ color: colors.accentLight }} />
          </div>

          <h2 className="font-albert text-[22px] font-bold text-text-primary dark:text-[#f5f5f8] mb-2">
            Set Up Your 1:1 Promo
          </h2>

          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-relaxed">
            {hasExistingPrograms 
              ? 'Link your promo to an existing 1:1 program, or create a new one.'
              : 'You can add a promo for your 1:1 coaching support here. To enable it, you\'ll need to create a 1:1 program first.'}
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="px-6 pb-4 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
          </div>
        )}

        {/* Existing Programs List */}
        {!loading && hasExistingPrograms && (
          <div className="px-6 pb-4">
            <p className="font-sans text-[12px] font-medium text-text-secondary dark:text-[#b2b6c2] mb-2 uppercase tracking-wide">
              Your 1:1 Programs
            </p>
            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {programs.map((program) => (
                <button
                  key={program.id}
                  onClick={() => handleAttachProgram(program.id)}
                  disabled={attaching !== null}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] hover:border-[var(--brand-accent-light)] dark:hover:border-[var(--brand-accent-dark)] bg-white dark:bg-[#0a0c10] transition-colors text-left disabled:opacity-50"
                  style={{ 
                    ['--brand-accent-light' as string]: colors.accentLight,
                    ['--brand-accent-dark' as string]: colors.accentDark,
                  }}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${colors.accentLight}15` }}
                  >
                    <Users className="w-5 h-5" style={{ color: colors.accentLight }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] truncate">
                      {program.name}
                    </p>
                    <p className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2]">
                      {program.priceInCents === 0 ? 'Free' : `$${(program.priceInCents / 100).toFixed(0)}`}
                      {program.lengthDays ? ` · ${program.lengthDays} days` : ''}
                    </p>
                  </div>
                  {attaching === program.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-text-secondary flex-shrink-0" />
                  ) : (
                    <Check className="w-5 h-5 flex-shrink-0 opacity-0 group-hover:opacity-100" style={{ color: colors.accentLight }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info Card - Only show when no programs exist */}
        {!loading && !hasExistingPrograms && (
          <div className="px-6 pb-4">
            <div className="bg-[#faf8f6] dark:bg-[#0a0c10] rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${colors.accentLight}15` }}
                >
                  <Users className="w-4 h-4" style={{ color: colors.accentLight }} />
                </div>
                <div>
                  <p className="font-sans text-[13px] font-medium text-text-primary dark:text-[#f5f5f8] mb-1">
                    What is a 1:1 Program?
                  </p>
                  <p className="font-sans text-[12px] text-text-secondary dark:text-[#b2b6c2]">
                    A private coaching program for individual clients. Create one to promote 
                    your coaching services and let users sign up directly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-6 pt-2 flex flex-col gap-3">
          {/* Create New Program Button */}
          <button
            onClick={handleCreateNew}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white font-sans font-semibold text-[15px] rounded-xl hover:shadow-lg transition-all"
            style={{ 
              background: `linear-gradient(to right, ${colors.accentLight}, ${colors.accentDark})`,
            }}
          >
            {hasExistingPrograms ? (
              <>
                <Plus className="w-4 h-4" />
                <span>Create New Program</span>
              </>
            ) : (
              <>
                <span>Create a 1:1 Program</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full px-5 py-2.5 text-text-secondary dark:text-[#b2b6c2] font-sans font-medium text-[14px] hover:text-text-primary dark:hover:text-[#f5f5f8] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

