'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowLeft, 
  Eye,
  EyeOff,
  Settings,
  Users,
  ClipboardList,
  Globe,
  Loader2,
  Pencil
} from 'lucide-react';
import type { OrgOnboardingFlow } from '@/types';
import { OnboardingFlowEditor } from './OnboardingFlowEditor';
import { OnboardingResponsesView } from './OnboardingResponsesView';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { DemoSignupModal, useDemoSignupModal } from '@/components/demo/DemoSignupModal';

type ViewMode = 'overview' | 'editing' | 'responses';

/**
 * CoachOnboardingFlowTab
 * 
 * Dedicated tab in the coach dashboard for managing the user onboarding flow.
 * Coaches can:
 * - Enable/disable the onboarding flow for new users
 * - Edit the flow steps (questions, goal setting, etc.)
 * - View user responses to the onboarding questions
 */
export function CoachOnboardingFlowTab() {
  const { isDemoMode } = useDemoMode();
  const { isOpen: isSignupModalOpen, action: signupModalAction, showModal: showSignupModal, hideModal: hideSignupModal } = useDemoSignupModal();
  const [flow, setFlow] = useState<OrgOnboardingFlow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [isToggling, setIsToggling] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  
  // Tenant required state
  const [tenantRequired, setTenantRequired] = useState<{
    tenantUrl: string | null;
    subdomain: string | null;
  } | null>(null);

  const fetchFlow = useCallback(async () => {
    try {
      setIsLoading(true);
      setTenantRequired(null);
      
      if (isDemoMode) {
        setFlow({
          id: 'demo-flow',
          name: 'Welcome Quiz',
          description: 'Demo onboarding flow',
          enabled: true,
          stepCount: 5,
          organizationId: 'demo-org',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as OrgOnboardingFlow);
        setResponseCount(12);
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/coach/org-onboarding-flow');
      
      // Check for tenant_required error
      if (response.status === 403) {
        const data = await response.json();
        if (data.error === 'tenant_required') {
          setTenantRequired({
            tenantUrl: data.tenantUrl,
            subdomain: data.subdomain,
          });
          setIsLoading(false);
          return;
        }
      }
      
      if (!response.ok) throw new Error('Failed to fetch onboarding flow');
      const data = await response.json();
      setFlow(data.flow || null);
      setResponseCount(data.responseCount || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding flow');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlow();
  }, [fetchFlow]);

  const handleToggleEnabled = async () => {
    if (isDemoMode) {
      showSignupModal('toggle onboarding flow');
      return;
    }
    if (!flow) return;
    
    setIsToggling(true);
    try {
      const response = await fetch(`/api/coach/org-onboarding-flow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !flow.enabled }),
      });
      if (!response.ok) throw new Error('Failed to update flow');
      await fetchFlow();
    } catch (err) {
      console.error('Failed to toggle flow:', err);
    } finally {
      setIsToggling(false);
    }
  };

  const handleCreateFlow = async () => {
    if (isDemoMode) {
      showSignupModal('create onboarding flow');
      return;
    }
    try {
      setIsLoading(true);
      const response = await fetch('/api/coach/org-onboarding-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Welcome Quiz',
          description: 'Onboarding questions for new members',
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create flow');
      await fetchFlow();
      setViewMode('editing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create flow');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToOverview = () => {
    setViewMode('overview');
    fetchFlow();
  };

  // Editing mode - show step editor
  if (viewMode === 'editing' && flow) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToOverview}
              className="p-2 rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">
                Edit Onboarding Flow
              </h2>
              <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
                Configure the questions and steps new users will see
              </p>
            </div>
          </div>
        </div>

        <OnboardingFlowEditor 
          flowId={flow.id}
          onBack={handleBackToOverview}
        />
      </div>
    );
  }

  // Responses view
  if (viewMode === 'responses' && flow) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToOverview}
              className="p-2 rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">
                User Responses
              </h2>
              <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
                View answers submitted by users during onboarding
              </p>
            </div>
          </div>
        </div>

        <OnboardingResponsesView flowId={flow.id} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">
            User Onboarding
          </h2>
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
            Customize the onboarding experience for new users joining your organization
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-8">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
            <span className="text-text-secondary dark:text-[#b2b6c2]">Loading...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tenant required state */}
      {tenantRequired && (
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Globe className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8] mb-2">
            Access from Your Organization Domain
          </h3>
          <p className="text-text-secondary dark:text-[#b2b6c2] mb-6 max-w-md mx-auto">
            To manage onboarding flows, please access this page from your organization&apos;s domain.
          </p>
        </div>
      )}

      {/* Main content */}
      {!isLoading && !error && !tenantRequired && (
        <>
          {flow ? (
            /* Flow exists - show overview card */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden"
            >
              {/* Flow header */}
              <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-accent/20 to-brand-accent/5 flex items-center justify-center">
                      <ClipboardList className="w-6 h-6 text-brand-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8]">
                          {flow.name}
                        </h3>
                        {flow.enabled ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded-full">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
                        {flow.stepCount} step{flow.stepCount !== 1 ? 's' : ''} · {responseCount} response{responseCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  
                  {/* Enable/Disable Toggle */}
                  <button
                    onClick={handleToggleEnabled}
                    disabled={isToggling}
                    className={`
                      relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0
                      ${flow.enabled 
                        ? 'bg-[#4CAF50]' 
                        : 'bg-[#d1cec9] dark:bg-[#3d4351]'
                      }
                      disabled:opacity-50
                    `}
                    title={flow.enabled ? 'Disable onboarding' : 'Enable onboarding'}
                  >
                    <span className={`
                      absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                      ${flow.enabled ? 'left-[30px]' : 'left-1'}
                    `} />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 bg-[#faf8f6] dark:bg-[#11141b] flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    if (isDemoMode) {
                      showSignupModal('edit onboarding steps');
                      return;
                    }
                    setViewMode('editing');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] hover:border-brand-accent dark:hover:border-brand-accent transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Steps
                </button>
                
                <button
                  onClick={() => setViewMode('responses')}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-text-primary dark:text-[#f5f5f8] hover:border-brand-accent dark:hover:border-brand-accent transition-colors"
                >
                  <Users className="w-4 h-4" />
                  View Responses ({responseCount})
                </button>
              </div>

              {/* Info section */}
              {!flow.enabled && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-200 dark:border-amber-800/30">
                  <div className="flex items-start gap-3">
                    <EyeOff className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Onboarding is disabled
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-0.5">
                        New users will skip the onboarding flow and go directly to the dashboard.
                        Enable it to collect information from new members.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            /* No flow exists - show empty state */
            <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-brand-accent/20 to-brand-accent/5 flex items-center justify-center">
                <ClipboardList className="w-8 h-8 text-brand-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary dark:text-[#f5f5f8] mb-2">
                No Onboarding Flow Yet
              </h3>
              <p className="text-text-secondary dark:text-[#b2b6c2] mb-6 max-w-md mx-auto">
                Create an onboarding flow to ask new users questions when they join.
                Collect information about their goals, challenges, and preferences.
              </p>
              <button
                onClick={handleCreateFlow}
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl hover:bg-brand-accent/90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Onboarding Flow
              </button>
            </div>
          )}

          {/* Help section */}
          <div className="bg-[#faf8f6] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
            <h4 className="font-semibold text-text-primary dark:text-[#f5f5f8] mb-3">
              How Onboarding Works
            </h4>
            <ul className="space-y-2 text-sm text-text-secondary dark:text-[#b2b6c2]">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
                <span>When enabled, new users see your onboarding flow after signing up</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
                <span>Add questions, goal-setting steps, or informational screens</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
                <span>View user responses to better understand your members</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center flex-shrink-0 text-xs font-medium">4</span>
                <span>The flow uses your brand colors for a consistent experience</span>
              </li>
            </ul>
          </div>
        </>
      )}

      {/* Demo Signup Modal */}
      <DemoSignupModal
        isOpen={isSignupModalOpen}
        onClose={hideSignupModal}
        action={signupModalAction}
      />
    </div>
  );
}



