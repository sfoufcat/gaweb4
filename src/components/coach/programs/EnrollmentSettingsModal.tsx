'use client';

import { useState, useEffect } from 'react';
import { Loader2, Settings2, Users, User, Calendar, Infinity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { OrgEnrollmentRules } from '@/types';
import { DEFAULT_ENROLLMENT_RULES } from '@/types';

interface EnrollmentSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentRules?: OrgEnrollmentRules;
  onSave?: (rules: OrgEnrollmentRules) => void;
}

interface RuleItemProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon1: React.ReactNode;
  icon2: React.ReactNode;
}

function RuleItem({ label, description, checked, onChange, icon1, icon2 }: RuleItemProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#e8e5e1] dark:border-[#262b35] last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-1 mt-0.5">
          {icon1}
          <span className="text-[#9c9791] dark:text-[#6b6f7b]">+</span>
          {icon2}
        </div>
        <div>
          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{label}</p>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  );
}

export function EnrollmentSettingsModal({
  open,
  onOpenChange,
  organizationId,
  currentRules,
  onSave,
}: EnrollmentSettingsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [rules, setRules] = useState<OrgEnrollmentRules>(currentRules || DEFAULT_ENROLLMENT_RULES);
  const [error, setError] = useState<string | null>(null);

  // Reset to current rules when modal opens
  useEffect(() => {
    if (open) {
      setRules(currentRules || DEFAULT_ENROLLMENT_RULES);
      setError(null);
    }
  }, [open, currentRules]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch('/api/coach/branding/enrollment-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      onSave?.(rules);
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving enrollment rules:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const CohortIcon = () => (
    <div className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
      <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400" />
    </div>
  );

  const EvergreenIcon = () => (
    <div className="w-5 h-5 rounded bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
      <Infinity className="w-3 h-3 text-green-600 dark:text-green-400" />
    </div>
  );

  const IndividualIcon = () => (
    <div className="w-5 h-5 rounded bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
      <User className="w-3 h-3 text-purple-600 dark:text-purple-400" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white dark:bg-[#171b22] border border-[#e8e5e1] dark:border-[#262b35]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            <Settings2 className="w-5 h-5" />
            Program Enrollment Rules
          </DialogTitle>
          <DialogDescription className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Control which program combinations your clients can enroll in simultaneously.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 p-3 bg-[#f8f6f4] dark:bg-[#1e222a] rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              <CohortIcon /> <span>Cohort</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              <EvergreenIcon /> <span>Evergreen</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              <IndividualIcon /> <span>1:1</span>
            </div>
          </div>

          {/* Group Program Combinations */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-[#9c9791] dark:text-[#6b6f7b] uppercase tracking-wider mb-2 font-albert">
              Group Programs
            </h4>
            <div className="bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg px-3">
              <RuleItem
                label="Cohort + Cohort"
                description="Allow joining multiple time-bound group programs"
                checked={rules.allowCohortWithCohort}
                onChange={(checked) => setRules({ ...rules, allowCohortWithCohort: checked })}
                icon1={<CohortIcon />}
                icon2={<CohortIcon />}
              />
              <RuleItem
                label="Cohort + Evergreen"
                description="Allow joining evergreen while in a cohort program"
                checked={rules.allowCohortWithEvergreen}
                onChange={(checked) => setRules({ ...rules, allowCohortWithEvergreen: checked })}
                icon1={<CohortIcon />}
                icon2={<EvergreenIcon />}
              />
              <RuleItem
                label="Evergreen + Evergreen"
                description="Allow joining multiple evergreen programs"
                checked={rules.allowEvergreenWithEvergreen}
                onChange={(checked) => setRules({ ...rules, allowEvergreenWithEvergreen: checked })}
                icon1={<EvergreenIcon />}
                icon2={<EvergreenIcon />}
              />
            </div>
          </div>

          {/* 1:1 Program Combinations */}
          <div>
            <h4 className="text-xs font-semibold text-[#9c9791] dark:text-[#6b6f7b] uppercase tracking-wider mb-2 font-albert">
              1:1 Programs
            </h4>
            <div className="bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg px-3">
              <RuleItem
                label="1:1 + Cohort"
                description="Allow 1:1 coaching alongside group cohort"
                checked={rules.allowIndividualWithCohort}
                onChange={(checked) => setRules({ ...rules, allowIndividualWithCohort: checked })}
                icon1={<IndividualIcon />}
                icon2={<CohortIcon />}
              />
              <RuleItem
                label="1:1 + Evergreen"
                description="Allow 1:1 coaching alongside evergreen program"
                checked={rules.allowIndividualWithEvergreen}
                onChange={(checked) => setRules({ ...rules, allowIndividualWithEvergreen: checked })}
                icon1={<IndividualIcon />}
                icon2={<EvergreenIcon />}
              />
              <RuleItem
                label="1:1 + 1:1"
                description="Allow multiple simultaneous 1:1 programs"
                checked={rules.allowIndividualWithIndividual}
                onChange={(checked) => setRules({ ...rules, allowIndividualWithIndividual: checked })}
                icon1={<IndividualIcon />}
                icon2={<IndividualIcon />}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 mt-3 font-albert">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="font-albert"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
