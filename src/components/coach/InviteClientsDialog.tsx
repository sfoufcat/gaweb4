'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  UserPlus,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  Upload,
  Mail,
  Send,
  Copy,
  Trash2,
  Check,
  Clock,
  Link2,
  AlertCircle,
  User,
  Users,
  ArrowRight,
  DollarSign,
  Calendar,
  Sparkles,
  RefreshCw,
  CreditCard,
  Globe,
  FileText,
  Rocket,
  BookOpen,
  Video,
  Download,
  Home,
  Settings,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
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
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { Funnel, Program, ProgramInvite } from '@/types';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { useStripeConnectStatus } from '@/hooks/useStripeConnectStatus';
import { StripeConnectWarning } from '@/components/ui/StripeConnectWarning';
import { StripeConnectModal } from '@/components/ui/StripeConnectModal';

type DialogView = 'list' | 'create' | 'bulk';
type WizardStep = 'welcome' | 'target-type' | 'program-choice' | 'content-select' | 'program-type' | 'program-structure' | 'program-details' | 'cohort-setup' | 'funnel-setup' | 'create-invite';

interface WizardData {
  // Target type (program or content)
  targetType: 'program' | 'content';
  programChoice: 'existing' | 'new';
  selectedProgramId?: string;
  contentType?: 'article' | 'course' | 'event' | 'download';
  selectedContentId?: string;
  selectedContentName?: string;
  // Program type
  programType: 'individual' | 'group';
  // Structure
  durationType: 'fixed' | 'evergreen';
  durationWeeks: number;
  numModules: number;
  includeWeekends: boolean;
  // Details + Pricing
  programName: string;
  programDescription: string;
  pricing: 'free' | 'paid';
  price: number;
  recurring: boolean;
  recurringCadence: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  // Cohort (group programs only)
  cohortName: string;
  cohortStartDate: string;
  cohortMaxEnrollment: string;
  // Funnel
  funnelAccessType: 'public' | 'invite_only';
}

const DEFAULT_WIZARD_DATA: WizardData = {
  targetType: 'program',
  programChoice: 'new',
  selectedProgramId: undefined,
  contentType: undefined,
  selectedContentId: undefined,
  selectedContentName: undefined,
  programType: 'individual',
  durationType: 'fixed',
  durationWeeks: 12,
  numModules: 4,
  includeWeekends: false,
  programName: '',
  programDescription: '',
  pricing: 'free',
  price: 297,
  recurring: false,
  recurringCadence: 'monthly',
  cohortName: '',
  cohortStartDate: new Date().toISOString().split('T')[0],
  cohortMaxEnrollment: '',
  funnelAccessType: 'invite_only',
};

interface InviteClientsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteClientsDialog({ isOpen, onClose }: InviteClientsDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stripe Connect status for payment features
  const { isConnected: stripeConnected, isLoading: stripeLoading, refetch: refetchStripe } = useStripeConnectStatus();
  const [showStripeModal, setShowStripeModal] = useState(false);
  const canAcceptPayments = stripeConnected || stripeLoading;

  // Selected funnel
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);

  // Wizard state - persist to sessionStorage so user can continue where they left off
  const [wizardStep, setWizardStep] = useState<WizardStep>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('inviteWizardStep');
      if (saved && ['welcome', 'target-type', 'program-choice', 'content-select', 'program-type', 'program-structure', 'program-details', 'cohort-setup', 'funnel-setup', 'create-invite'].includes(saved)) {
        return saved as WizardStep;
      }
    }
    return 'welcome';
  });
  const [wizardData, setWizardData] = useState<WizardData>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('inviteWizardData');
      if (saved) {
        try {
          return { ...DEFAULT_WIZARD_DATA, ...JSON.parse(saved) };
        } catch {
          return DEFAULT_WIZARD_DATA;
        }
      }
    }
    return DEFAULT_WIZARD_DATA;
  });
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);

  // Save wizard state to sessionStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('inviteWizardStep', wizardStep);
      sessionStorage.setItem('inviteWizardData', JSON.stringify(wizardData));
    }
  }, [wizardStep, wizardData]);

  // View state
  const [currentView, setCurrentView] = useState<DialogView>('list');
  const [createMode, setCreateMode] = useState<'single' | 'bulk'>('single');
  const [showExistingInvites, setShowExistingInvites] = useState(false);

  // Invites state
  const [invites, setInvites] = useState<ProgramInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    emailInput: '',      // Current input field value
    emailChips: [] as string[], // Validated email chips
    emails: '',          // For wizard mode textarea input
    paymentStatus: 'required' as 'required' | 'pre_paid' | 'free',
    prePaidAmount: '' as string, // Amount in dollars
    prePaidNote: '',     // Reference note (e.g., "Invoice #123")
    sendEmail: true,
  });
  const [isCreating, setIsCreating] = useState(false);

  // Bulk import state
  const [bulkCsv, setBulkCsv] = useState('');
  const [bulkPaymentStatus, setBulkPaymentStatus] = useState<'required' | 'pre_paid' | 'free'>('required');
  const [bulkPrepaidAmount, setBulkPrepaidAmount] = useState('');
  const [bulkPrepaidNote, setBulkPrepaidNote] = useState('');
  const [bulkSendEmails, setBulkSendEmails] = useState(true);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    skipped: number;
    emailsSent: number;
    errors: Array<{ index: number; error: string }>;
  } | null>(null);

  // Copy feedback state
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Success message state
  const [successMessage, setSuccessMessage] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);

  // Wizard setup success
  const [wizardSuccess, setWizardSuccess] = useState(false);

  // Wizard completion state: idle -> processing -> success
  const [wizardCompletionState, setWizardCompletionState] = useState<'idle' | 'processing' | 'success'>('idle');

  // Auto-created link after wizard completes
  const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null);
  const [createdLinkCopied, setCreatedLinkCopied] = useState(false);

  // Invites created during wizard flow (for showing in the create-invite step)
  const [wizardInvites, setWizardInvites] = useState<Array<{
    id: string;
    email: string;        // Display string (comma-separated for batch)
    emails?: string[];    // Array of emails (for batch invites)
    name?: string;
    linkUrl: string;
    emailSent: boolean;
    emailsSent?: string[];   // Which emails were successfully sent
    emailsFailed?: string[]; // Which emails failed to send
  }>>([]);

  // Base URL for constructing invite links (set after wizard completion)
  const [wizardBaseUrl, setWizardBaseUrl] = useState<string | null>(null);

  // Public link copy state (for normal mode)
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);

  // Content items for content-select step
  const [contentItems, setContentItems] = useState<Array<{ id: string; title: string }>>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Cancel invite confirmation dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [inviteToCancel, setInviteToCancel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Animation variants - opacity only for seamless transitions
  const fadeVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch funnels and programs in parallel
      const [funnelsRes, programsRes] = await Promise.all([
        fetch('/api/coach/org-funnels'),
        fetch('/api/coach/org-programs'),
      ]);

      if (!funnelsRes.ok) throw new Error('Failed to fetch funnels');
      if (!programsRes.ok) throw new Error('Failed to fetch programs');

      const funnelsData = await funnelsRes.json();
      const programsData = await programsRes.json();

      setFunnels(funnelsData.funnels || []);
      setPrograms(programsData.programs || []);

      // Auto-select first funnel if exists
      if (funnelsData.funnels?.length > 0) {
        setSelectedFunnelId(funnelsData.funnels[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchInvites = useCallback(async () => {
    if (!selectedFunnelId) return;

    try {
      setInvitesLoading(true);
      const response = await fetch(`/api/coach/org-invites?funnelId=${selectedFunnelId}`);
      if (!response.ok) throw new Error('Failed to fetch invites');
      const data = await response.json();
      setInvites(data.invites || []);
      setInvitesError(null);
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setInvitesLoading(false);
    }
  }, [selectedFunnelId]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setCurrentView('list');
      setSuccessMessage(null);
      // Don't reset wizard step/data - let it continue from sessionStorage
      // Only reset success state and link URL
      setWizardSuccess(false);
      setCreatedLinkUrl(null);
      setCreatedLinkCopied(false);
      setWizardInvites([]);
      setWizardBaseUrl(null);
      setWizardCompletionState('idle');
    }
  }, [isOpen, fetchData]);

  // Clear wizard state when wizard completes successfully (after "Done" is clicked)
  const clearWizardState = useCallback(() => {
    setWizardStep('welcome');
    setWizardData(DEFAULT_WIZARD_DATA);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('inviteWizardStep');
      sessionStorage.removeItem('inviteWizardData');
    }
  }, []);

  useEffect(() => {
    if (selectedFunnelId) {
      fetchInvites();
    }
  }, [selectedFunnelId, fetchInvites]);

  // Update wizard data helper
  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  };

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  };

  // Programs without funnels (for program-choice step)
  const programsWithoutFunnels = programs.filter(p => !funnels.some(f => f.programId === p.id));

  // Wizard step navigation - matches NewProgramModal flow
  const getNextWizardStep = (): WizardStep | null => {
    switch (wizardStep) {
      case 'welcome': return 'target-type';
      case 'target-type':
        if (wizardData.targetType === 'content') return 'content-select';
        // If program and programs exist, ask to use existing or create new
        if (programs.length > 0) return 'program-choice';
        return 'program-type';
      case 'program-choice':
        if (wizardData.programChoice === 'existing') return 'funnel-setup';
        return 'program-type';
      case 'content-select': return 'funnel-setup';
      case 'program-type': return 'program-structure';
      case 'program-structure': return 'program-details';
      case 'program-details':
        return wizardData.programType === 'group' ? 'cohort-setup' : 'funnel-setup';
      case 'cohort-setup': return 'funnel-setup';
      case 'funnel-setup': return 'create-invite';
      default: return null;
    }
  };

  const getPreviousWizardStep = (): WizardStep | null => {
    switch (wizardStep) {
      case 'target-type': return 'welcome';
      case 'program-choice': return 'target-type';
      case 'content-select': return 'target-type';
      case 'program-type':
        // Go back to program-choice if it existed, otherwise target-type
        if (programs.length > 0 && wizardData.targetType === 'program') return 'program-choice';
        return 'target-type';
      case 'program-structure': return 'program-type';
      case 'program-details': return 'program-structure';
      case 'cohort-setup': return 'program-details';
      case 'funnel-setup':
        if (wizardData.targetType === 'content') return 'content-select';
        if (wizardData.programChoice === 'existing') return 'program-choice';
        return wizardData.programType === 'group' ? 'cohort-setup' : 'program-details';
      case 'create-invite': return 'funnel-setup';
      default: return null;
    }
  };

  const canProceedWizard = (): boolean => {
    switch (wizardStep) {
      case 'welcome': return true;
      case 'target-type': return true;
      case 'program-choice':
        return wizardData.programChoice === 'new' || !!wizardData.selectedProgramId;
      case 'content-select':
        return !!wizardData.contentType && !!wizardData.selectedContentId;
      case 'program-type': return true;
      case 'program-structure':
        return wizardData.durationWeeks >= 1 && wizardData.numModules >= 1;
      case 'program-details':
        return wizardData.programName.trim().length > 0 &&
               wizardData.programDescription.trim().length > 0 &&
               (wizardData.pricing === 'free' || wizardData.price > 0);
      case 'cohort-setup':
        return wizardData.cohortName.trim().length > 0 &&
               !!wizardData.cohortStartDate;
      case 'funnel-setup': return true;
      default: return false;
    }
  };

  // Complete wizard - create program/content funnel and invite link
  const handleWizardComplete = async () => {
    setIsCreatingProgram(true);
    setError(null);

    try {
      let programId: string | undefined;
      let programSlug: string | undefined;
      let funnelName: string;

      // Handle different target types and program choices
      if (wizardData.targetType === 'content') {
        // CONTENT FLOW: Create funnel for content
        funnelName = `Access ${wizardData.selectedContentName || 'Content'}`;
      } else if (wizardData.programChoice === 'existing' && wizardData.selectedProgramId) {
        // EXISTING PROGRAM FLOW: Use selected program
        const existingProgram = programs.find(p => p.id === wizardData.selectedProgramId);
        if (!existingProgram) {
          throw new Error('Selected program not found');
        }
        programId = existingProgram.id;
        programSlug = existingProgram.slug;
        funnelName = `Join ${existingProgram.name}`;
      } else {
        // NEW PROGRAM FLOW: Create program first
        const programRes = await fetch('/api/coach/org-programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: wizardData.programName,
            slug: generateSlug(wizardData.programName),
            description: wizardData.programDescription,
            type: wizardData.programType,
            durationType: wizardData.durationType,
            durationWeeks: wizardData.durationWeeks,
            numModules: wizardData.numModules,
            includeWeekends: wizardData.includeWeekends,
            lengthDays: wizardData.durationWeeks * 7,
            priceInCents: wizardData.pricing === 'paid' ? Math.round(wizardData.price * 100) : 0,
            recurring: wizardData.pricing === 'paid' ? wizardData.recurring : false,
            recurringCadence: wizardData.recurring ? wizardData.recurringCadence : undefined,
            currency: 'USD',
            isActive: true,
          }),
        });

        if (!programRes.ok) {
          const data = await programRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create program');
        }

        const programData = await programRes.json();
        programId = programData.program.id;
        programSlug = programData.program.slug;
        funnelName = `Join ${wizardData.programName}`;

        // Add to programs state
        setPrograms(prev => [...prev, programData.program]);

        // Create cohort (if group program)
        if (wizardData.programType === 'group') {
          const cohortRes = await fetch(`/api/coach/org-programs/${programId}/cohorts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: wizardData.cohortName,
              startDate: wizardData.cohortStartDate,
              maxEnrollment: wizardData.cohortMaxEnrollment ? parseInt(wizardData.cohortMaxEnrollment) : undefined,
            }),
          });

          if (!cohortRes.ok) {
            const data = await cohortRes.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to create cohort');
          }
        }
      }

      // Create funnel (for all flows)
      const funnelPayload: Record<string, unknown> = {
        name: funnelName,
        slug: generateSlug(funnelName),
        accessType: wizardData.funnelAccessType,
        isActive: true,
        isDefault: true,
      };

      if (wizardData.targetType === 'content') {
        funnelPayload.targetType = 'content';
        funnelPayload.contentType = wizardData.contentType;
        funnelPayload.contentId = wizardData.selectedContentId;
      } else {
        funnelPayload.targetType = 'program';
        funnelPayload.programId = programId;
      }

      const funnelRes = await fetch('/api/coach/org-funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(funnelPayload),
      });

      if (!funnelRes.ok) {
        const data = await funnelRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create funnel');
      }

      const funnelData = await funnelRes.json();
      const newFunnelId = funnelData.funnel.id;

      // Add signup step
      await fetch(`/api/coach/org-funnels/${newFunnelId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'signup',
          config: { showSocialLogin: true },
        }),
      });

      // Add payment step (if paid program - check both new and existing programs)
      let needsPayment = false;
      if (wizardData.targetType === 'program') {
        if (wizardData.programChoice === 'new') {
          // New program: check wizard pricing setting
          needsPayment = wizardData.pricing === 'paid';
        } else if (wizardData.programChoice === 'existing' && wizardData.selectedProgramId) {
          // Existing program: check if program has a price
          const existingProgram = programs.find(p => p.id === wizardData.selectedProgramId);
          needsPayment = (existingProgram?.priceInCents ?? 0) > 0;
        }
      }

      if (needsPayment) {
        await fetch(`/api/coach/org-funnels/${newFunnelId}/steps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'payment',
            config: { useProgramPricing: true },
          }),
        });
      }

      // Add success step
      await fetch(`/api/coach/org-funnels/${newFunnelId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'success',
          config: { showConfetti: true, redirectDelay: 3000 },
        }),
      });

      // Update funnels state
      setFunnels(prev => [...prev, { ...funnelData.funnel, stepCount: needsPayment ? 3 : 2 }]);
      setSelectedFunnelId(newFunnelId);
      setWizardSuccess(true);

      // Generate the link based on access type
      const funnelSlug = funnelData.funnel.slug;

      // Build the base URL - content uses /content/ path, programs use /join/
      let baseUrl: string;
      if (wizardData.targetType === 'content') {
        baseUrl = `${window.location.origin}/content/${funnelSlug}`;
      } else {
        baseUrl = `${window.location.origin}/join/${programSlug}/${funnelSlug}`;
      }

      // Store the base URL for constructing invite links later
      setWizardBaseUrl(baseUrl);

      if (wizardData.funnelAccessType === 'public') {
        // For public funnels, use the direct URL
        setCreatedLinkUrl(baseUrl);
      }
      // For invite-only, don't auto-create an invite - user needs to add emails
      // The UI will show a form to add client emails instead

      setWizardStep('create-invite');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup');
    } finally {
      setIsCreatingProgram(false);
    }
  };

  // Create invite
  const handleCreateInvite = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedFunnelId) return;

    // Collect all emails: chips + current input (if valid)
    let emailsToInvite = [...createForm.emailChips];
    const currentInput = createForm.emailInput.trim().toLowerCase();
    if (currentInput && currentInput.includes('@') && !emailsToInvite.includes(currentInput)) {
      emailsToInvite.push(currentInput);
    }

    // Require at least one email
    if (emailsToInvite.length === 0) {
      return;
    }

    setIsCreating(true);

    // In wizard mode check
    const isWizardMode = wizardStep === 'create-invite' && wizardBaseUrl;

    const emailRequested = createForm.sendEmail && emailsToInvite.length > 0;

    // Convert amount to cents for storage
    const prePaidAmountCents = createForm.prePaidAmount 
      ? Math.round(parseFloat(createForm.prePaidAmount) * 100) 
      : undefined;

    try {
      const response = await fetch('/api/coach/org-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelId: selectedFunnelId,
          // Use emails array for batch, single email for normal mode
          emails: emailsToInvite.length > 1 ? emailsToInvite : undefined,
          email: emailsToInvite.length === 1 ? emailsToInvite[0] : undefined,
          paymentStatus: createForm.paymentStatus,
          prePaidAmount: prePaidAmountCents,
          prePaidNote: createForm.prePaidNote || undefined,
          sendEmail: emailRequested,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create invite');
      }

      const data = await response.json();

      // Reset form
      setCreateForm({
        emailInput: '',
        emailChips: [],
        emails: '',
        paymentStatus: 'required',
        prePaidAmount: '',
        prePaidNote: '',
        sendEmail: true,
      });

      // Handle wizard mode differently
      if (isWizardMode) {
        // Add to wizard invites list - one invite with multiple emails
        const inviteUrl = `${wizardBaseUrl}?invite=${data.invite.id}`;
        setWizardInvites(prev => [...prev, {
          id: data.invite.id,
          email: emailsToInvite.join(', '),  // Display all emails
          emails: emailsToInvite,             // Store as array
          linkUrl: inviteUrl,
          emailSent: data.emailSent || false,
          emailsSent: data.emailsSent || [],
          emailsFailed: data.emailsFailed || [],
        }]);
        // Don't switch views - stay in wizard
      } else {
        // Normal mode - switch to list view
        setCurrentView('list');
        await fetchInvites();

        // Set success message based on email status
        if (emailRequested && data.emailSent) {
          setSuccessMessage({
            type: 'success',
            message: `Email successfully sent to ${emailsToInvite[0]}`,
          });
        } else if (emailRequested && !data.emailSent) {
          setSuccessMessage({
            type: 'warning',
            message: 'Invite created, but email could not be sent',
          });
        } else {
          setSuccessMessage({
            type: 'success',
            message: 'Invite created successfully',
          });
        }

        // Auto-dismiss success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setIsCreating(false);
    }
  };

  // Bulk import
  const handleBulkImport = async () => {
    if (!selectedFunnelId) return;

    setIsBulkImporting(true);
    setBulkResult(null);

    try {
      const lines = bulkCsv.trim().split('\n');
      const entries = lines.map(line => {
        const [email, name] = line.split(',').map(s => s.trim());
        return { email, name };
      }).filter(e => e.email);

      if (entries.length === 0) {
        throw new Error('No valid entries found');
      }

      // Convert amount to cents for storage
      const prePaidAmountCents = bulkPrepaidAmount 
        ? Math.round(parseFloat(bulkPrepaidAmount) * 100) 
        : undefined;

      const response = await fetch('/api/coach/org-invites/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelId: selectedFunnelId,
          entries,
          paymentStatus: bulkPaymentStatus,
          prePaidAmount: prePaidAmountCents,
          prePaidNote: bulkPrepaidNote || undefined,
          sendEmails: bulkSendEmails,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import');
      }

      setBulkResult({
        created: data.created,
        skipped: data.skipped,
        emailsSent: data.emailsSent || 0,
        errors: data.errors || [],
      });

      await fetchInvites();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import');
    } finally {
      setIsBulkImporting(false);
    }
  };

  // Cancel invite (soft delete)
  const handleCancelInvite = async (inviteId: string) => {
    // Open the confirm dialog
    setInviteToCancel(inviteId);
    setCancelDialogOpen(true);
  };

  // Actually cancel the invite (called from dialog confirm)
  const confirmCancelInvite = async () => {
    if (!inviteToCancel) return;

    setIsCancelling(true);
    try {
      const response = await fetch('/api/coach/org-invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: inviteToCancel }),
      });

      if (!response.ok) throw new Error('Failed to cancel invite');
      await fetchInvites();
      setCancelDialogOpen(false);
      setInviteToCancel(null);
    } catch (err) {
      console.error('Failed to cancel invite:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  // Copy invite link
  const copyInviteLink = (invite: ProgramInvite) => {
    const funnel = funnels.find(f => f.id === selectedFunnelId);
    const program = funnel ? programs.find(p => p.id === funnel.programId) : null;

    if (program && funnel) {
      const url = `${window.location.origin}/join/${program.slug}/${funnel.slug}?invite=${invite.id}`;
      navigator.clipboard.writeText(url);
      setCopiedInviteId(invite.id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    }
  };

  const getProgramName = (programId: string | null | undefined) => {
    if (!programId) return 'Squad Funnel';
    return programs.find(p => p.id === programId)?.name || 'Unknown Program';
  };

  // Get selected funnel and its public URL
  const selectedFunnel = funnels.find(f => f.id === selectedFunnelId);
  const selectedProgram = selectedFunnel ? programs.find(p => p.id === selectedFunnel.programId) : null;
  const publicFunnelUrl = selectedFunnel && selectedProgram
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${selectedProgram.slug}/${selectedFunnel.slug}`
    : null;

  // Get funnel type badge (Public/Private)
  const getFunnelTypeBadge = (invite: ProgramInvite) => {
    const funnel = funnels.find(f => f.id === invite.funnelId);
    if (funnel?.accessType === 'public') {
      return (
        <span className="px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center gap-1">
          <Globe className="w-3 h-3" />
          Public
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full flex items-center gap-1">
        <Mail className="w-3 h-3" />
        Private
      </span>
    );
  };

  const getStatusBadge = (invite: ProgramInvite) => {
    if (invite.usedBy) {
      return (
        <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center gap-1">
          <Check className="w-3 h-3" />
          Used
        </span>
      );
    }
    if (invite.maxUses && invite.useCount >= invite.maxUses) {
      return (
        <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full flex items-center gap-1">
          <Check className="w-3 h-3" />
          Fully Used
        </span>
      );
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return (
        <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Expired
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
        Active
      </span>
    );
  };

  // Check if we're in wizard mode (no funnels OR wizard just completed)
  const isWizardMode = (funnels.length === 0 || wizardSuccess) && !isLoading;

  // Get header info based on current state
  const getHeaderInfo = () => {
    // In wizard mode
    if (isWizardMode) {
      switch (wizardStep) {
        case 'welcome':
          return { title: 'Invite Your Clients', subtitle: null };
        case 'program-type':
          return { title: 'Program Type', subtitle: 'Choose how you\'ll work with clients' };
        case 'program-structure':
          return { title: 'Program Structure', subtitle: 'Configure how your program is organized' };
        case 'program-details':
          return { title: 'Program Details', subtitle: 'Name, description, and pricing' };
        case 'cohort-setup':
          return { title: 'Create First Cohort', subtitle: 'Set up your first group of clients' };
        case 'funnel-setup':
          return { title: 'Signup Flow', subtitle: 'Configure how clients sign up' };
        case 'create-invite':
          return { title: 'You\'re All Set!', subtitle: 'Share this link to invite clients' };
      }
    }

    // Normal mode - simplified header
    return { title: 'Invite Clients', subtitle: '' };
  };

  const headerInfo = getHeaderInfo();

  // Check if we can show back button
  const canGoBack = () => {
    if (isWizardMode) {
      return wizardStep !== 'welcome' && wizardStep !== 'create-invite';
    }
    return currentView !== 'list';
  };

  // Handle back navigation
  const handleBack = () => {
    if (isWizardMode) {
      const prev = getPreviousWizardStep();
      // If at target-type and funnels exist, exit wizard mode instead of going to welcome
      if (wizardStep === 'target-type' && funnels.length > 0) {
        clearWizardState();
        setWizardSuccess(false);
        return;
      }
      if (prev) setWizardStep(prev);
    } else {
      setCurrentView('list');
      setBulkResult(null);
    }
  };

  // Get wizard steps based on current flow
  const getWizardSteps = (): WizardStep[] => {
    // Content flow: welcome -> target-type -> content-select -> funnel-setup
    if (wizardData.targetType === 'content') {
      return ['welcome', 'target-type', 'content-select', 'funnel-setup'];
    }

    // Program flow with existing program: welcome -> target-type -> program-choice -> funnel-setup
    if (wizardData.programChoice === 'existing') {
      return ['welcome', 'target-type', 'program-choice', 'funnel-setup'];
    }

    // New program flow (group): welcome -> target-type -> (program-choice if programs exist) -> program-type -> program-structure -> program-details -> cohort-setup -> funnel-setup
    // New program flow (individual): welcome -> target-type -> (program-choice if programs exist) -> program-type -> program-structure -> program-details -> funnel-setup
    const baseSteps: WizardStep[] = ['welcome', 'target-type'];

    // Add program-choice if programs exist
    if (programs.length > 0) {
      baseSteps.push('program-choice');
    }

    baseSteps.push('program-type', 'program-structure', 'program-details');

    if (wizardData.programType === 'group') {
      baseSteps.push('cohort-setup');
    }

    baseSteps.push('funnel-setup');
    return baseSteps;
  };

  // Get wizard progress dots count
  const getWizardDotsCount = () => {
    return getWizardSteps().length;
  };

  // Get current wizard dot index
  const getWizardDotIndex = () => {
    return getWizardSteps().indexOf(wizardStep);
  };

  // Shared content for both Dialog and Drawer
  const content = (
    <>
      {/* Header - hide on welcome step since it has its own logo/title */}
      {!(isWizardMode && wizardStep === 'welcome') && (
        <div className="p-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {canGoBack() && (
              <button
                onClick={handleBack}
                className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors -ml-2"
              >
                <ChevronLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {headerInfo.title}
              </h2>
              {headerInfo.subtitle && (
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  {headerInfo.subtitle}
                </p>
              )}
            </div>
          </div>
          {isDesktop && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-y-auto px-6 pb-6 ${isWizardMode && wizardStep === 'welcome' ? 'pt-0' : 'pt-4'}`}>
        {/* Loading */}
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#faf8f6] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                    <div className="h-4 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
                  <div className="h-8 w-8 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 mb-4">
            {error}
          </div>
        )}

        {/* Animated transition between Normal and Wizard modes */}
        <AnimatePresence mode="wait">
        {/* WIZARD MODE - No funnels exist OR wizard just completed (show success screen) */}
        {!isLoading && !error && (funnels.length === 0 || wizardSuccess) && (
          <motion.div
            key="wizard-mode"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="relative"
          >
          <AnimatePresence mode="popLayout" initial={false}>
            {/* Welcome Step */}
            {wizardStep === 'welcome' && (
              <motion.div
                key="welcome"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="text-center relative py-6"
              >
                {/* Subtle radial gradient accent */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-60"
                  style={{
                    background: 'radial-gradient(ellipse at 50% 0%, rgba(160, 120, 85, 0.08) 0%, transparent 60%)'
                  }}
                />

                {/* Logo with subtle glow */}
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-5 shadow-[0_4px_20px_rgba(160,120,85,0.15)]">
                  <img
                    src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=78f383ba-0074-4375-985c-f623e8c90d70"
                    alt="Coachful"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-recoleta mb-1.5">
                  Invite Your Clients
                </h3>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1.5 leading-relaxed">
                  We&apos;ll walk you through setting up your first funnel so you can start onboarding clients in minutes.
                </p>
                <p className="text-xs text-[#8a857f] dark:text-[#8a8f9c] font-albert mb-5">
                  Takes about 2 minutes to complete.
                </p>

                {/* Steps - Glass container */}
                <div className="relative bg-white/60 dark:bg-[#1d222b]/60 backdrop-blur-sm border border-[#e1ddd8]/50 dark:border-[#313746]/50 rounded-2xl p-4 mt-6 mb-6">
                  <div className="text-left space-y-1">
                    <div className="flex items-center gap-3 py-2.5 px-2 rounded-xl transition-colors hover:bg-white/70 dark:hover:bg-white/5">
                      <div className="w-7 h-7 rounded-full bg-brand-accent text-white flex items-center justify-center text-xs font-semibold font-albert shrink-0 shadow-[0_0_12px_rgba(160,120,85,0.35)]">1</div>
                      <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm font-medium">Choose your offer</span>
                    </div>
                    <div className="flex items-center gap-3 py-2.5 px-2 rounded-xl transition-colors hover:bg-white/70 dark:hover:bg-white/5">
                      <div className="w-7 h-7 rounded-full bg-[#e8e4df] dark:bg-[#3a4150] text-[#7a756f] dark:text-[#9ca3af] flex items-center justify-center text-xs font-semibold font-albert shrink-0">2</div>
                      <span className="text-[#6b665f] dark:text-[#9ca3af] font-albert text-sm">Set up signup flow</span>
                    </div>
                    <div className="flex items-center gap-3 py-2.5 px-2 rounded-xl transition-colors hover:bg-white/70 dark:hover:bg-white/5">
                      <div className="w-7 h-7 rounded-full bg-[#e8e4df] dark:bg-[#3a4150] text-[#7a756f] dark:text-[#9ca3af] flex items-center justify-center text-xs font-semibold font-albert shrink-0">3</div>
                      <span className="text-[#6b665f] dark:text-[#9ca3af] font-albert text-sm">Send invite</span>
                    </div>
                  </div>
                </div>

                {/* CTA - Enhanced with shadow */}
                <button
                  onClick={() => setWizardStep('target-type')}
                  className="w-full py-3.5 bg-brand-accent text-white rounded-xl font-albert font-medium transition-all flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(160,120,85,0.3)] hover:shadow-[0_4px_20px_rgba(160,120,85,0.4)] hover:bg-brand-accent/95 active:scale-[0.98]"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* Target Type Step - Program or Content */}
            {wizardStep === 'target-type' && (
              <motion.div
                key="target-type"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
              >
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-recoleta mb-2">
                    What do you want to invite clients to?
                  </h3>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Choose the type of experience for your clients
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Program Card */}
                  <button
                    onClick={() => {
                      updateWizardData({ targetType: 'program' });
                      // Navigate on click - if programs exist, go to program-choice, else program-type
                      setWizardStep(programs.length > 0 ? 'program-choice' : 'program-type');
                    }}
                    className={`group relative flex flex-col items-center justify-center text-center aspect-square p-5 rounded-2xl border-2 transition-all ${
                      wizardData.targetType === 'program'
                        ? 'border-brand-accent bg-gradient-to-br from-brand-accent/5 to-brand-accent/10 shadow-[0_4px_24px_rgba(160,120,85,0.15)]'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50 hover:shadow-lg'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 transition-all ${
                      wizardData.targetType === 'program'
                        ? 'bg-brand-accent/20 shadow-[0_0_20px_rgba(160,120,85,0.2)]'
                        : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-brand-accent/10'
                    }`}>
                      <Rocket className={`w-7 h-7 ${wizardData.targetType === 'program' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                    </div>
                    <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                      Program
                    </h3>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert leading-snug">
                      Structured journey with tasks & check-ins
                    </p>
                    {wizardData.targetType === 'program' && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center shadow-[0_2px_8px_rgba(160,120,85,0.3)]">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>

                  {/* Content Card */}
                  <button
                    onClick={() => {
                      updateWizardData({ targetType: 'content' });
                      setWizardStep('content-select');
                    }}
                    className={`group relative flex flex-col items-center justify-center text-center aspect-square p-5 rounded-2xl border-2 transition-all ${
                      wizardData.targetType === 'content'
                        ? 'border-brand-accent bg-gradient-to-br from-brand-accent/5 to-brand-accent/10 shadow-[0_4px_24px_rgba(160,120,85,0.15)]'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50 hover:shadow-lg'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 transition-all ${
                      wizardData.targetType === 'content'
                        ? 'bg-brand-accent/20 shadow-[0_0_20px_rgba(160,120,85,0.2)]'
                        : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-brand-accent/10'
                    }`}>
                      <FileText className={`w-7 h-7 ${wizardData.targetType === 'content' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                    </div>
                    <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                      Resource
                    </h3>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert leading-snug">
                      Article, course, event, or download
                    </p>
                    {wizardData.targetType === 'content' && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center shadow-[0_2px_8px_rgba(160,120,85,0.3)]">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                </div>

                {/* Continue Button */}
                {wizardData.targetType && (
                  <button
                    onClick={() => {
                      if (wizardData.targetType === 'program') {
                        // If programs exist, go to program-choice, else straight to program-type
                        setWizardStep(programs.length > 0 ? 'program-choice' : 'program-type');
                      } else {
                        setWizardStep('content-select');
                      }
                    }}
                    className="w-full mt-6 py-3.5 bg-brand-accent text-white rounded-xl font-albert font-medium transition-all flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(160,120,85,0.3)] hover:shadow-[0_4px_20px_rgba(160,120,85,0.4)] hover:bg-brand-accent/95 active:scale-[0.98]"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            )}

            {/* Program Choice Step - Use Existing or Create New */}
            {wizardStep === 'program-choice' && (
              <motion.div
                key="program-choice"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="text-center mb-4">
                  <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-recoleta mb-2">
                    Choose a program
                  </h3>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Use an existing program or create a new one
                  </p>
                </div>

                {/* Use Existing Program Option */}
                <button
                  onClick={() => updateWizardData({ programChoice: 'existing' })}
                  className={`w-full relative p-6 rounded-2xl border-2 text-left transition-all ${
                    wizardData.programChoice === 'existing'
                      ? 'border-brand-accent bg-gradient-to-br from-brand-accent/5 to-brand-accent/10 shadow-[0_4px_24px_rgba(160,120,85,0.15)]'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50 hover:shadow-lg'
                  }`}
                >
                  {wizardData.programChoice === 'existing' && (
                    <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-brand-accent flex items-center justify-center shadow-[0_2px_8px_rgba(160,120,85,0.3)]">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex items-start gap-5">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      wizardData.programChoice === 'existing'
                        ? 'bg-brand-accent/20 shadow-[0_0_16px_rgba(160,120,85,0.15)]'
                        : 'bg-[#f0ede9] dark:bg-[#262b35]'
                    }`}>
                      <BookOpen className={`w-7 h-7 ${
                        wizardData.programChoice === 'existing'
                          ? 'text-brand-accent'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold font-albert text-base mb-1 ${
                        wizardData.programChoice === 'existing'
                          ? 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                          : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                      }`}>
                        Use Existing Program
                      </p>
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
                        Create a new invite link for one of your programs
                      </p>

                      {/* Program dropdown - only show if this option selected */}
                      {wizardData.programChoice === 'existing' && (
                        <Select
                          value={wizardData.selectedProgramId || ''}
                          onValueChange={(value) => updateWizardData({ selectedProgramId: value })}
                        >
                          <SelectTrigger className="w-full h-12 bg-white dark:bg-[#1d222b] border-[#e1ddd8] dark:border-[#262b35] rounded-2xl text-base">
                            <SelectValue placeholder="Select a program" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            {programs.map((program) => (
                              <SelectItem key={program.id} value={program.id} className="py-3">
                                {program.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </button>

                {/* Create New Program Option */}
                <button
                  onClick={() => {
                    updateWizardData({ programChoice: 'new', selectedProgramId: undefined });
                    setWizardStep('program-type');
                  }}
                  className={`w-full relative p-6 rounded-2xl border-2 text-left transition-all ${
                    wizardData.programChoice === 'new'
                      ? 'border-brand-accent bg-gradient-to-br from-brand-accent/5 to-brand-accent/10 shadow-[0_4px_24px_rgba(160,120,85,0.15)]'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50 hover:shadow-lg'
                  }`}
                >
                  {wizardData.programChoice === 'new' && (
                    <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-brand-accent flex items-center justify-center shadow-[0_2px_8px_rgba(160,120,85,0.3)]">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex items-start gap-5">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      wizardData.programChoice === 'new'
                        ? 'bg-brand-accent/20 shadow-[0_0_16px_rgba(160,120,85,0.15)]'
                        : 'bg-[#f0ede9] dark:bg-[#262b35]'
                    }`}>
                      <Plus className={`w-7 h-7 ${
                        wizardData.programChoice === 'new'
                          ? 'text-brand-accent'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                      }`} />
                    </div>
                    <div>
                      <p className={`font-semibold font-albert text-base mb-1 ${
                        wizardData.programChoice === 'new'
                          ? 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                          : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                      }`}>
                        Create New Program
                      </p>
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        Set up a brand new coaching program
                      </p>
                    </div>
                  </div>
                </button>
              </motion.div>
            )}

            {/* Content Select Step */}
            {wizardStep === 'content-select' && (
              <motion.div
                key="content-select"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="text-center mb-4">
                  <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-recoleta mb-2">
                    Select content to share
                  </h3>
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    Choose the type and specific content item
                  </p>
                </div>

                {/* Content Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
                    Content Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { type: 'article' as const, icon: FileText, label: 'Article' },
                      { type: 'course' as const, icon: BookOpen, label: 'Course' },
                      { type: 'event' as const, icon: Video, label: 'Event' },
                      { type: 'download' as const, icon: Download, label: 'Download' },
                    ].map(({ type, icon: Icon, label }) => (
                      <button
                        key={type}
                        onClick={async () => {
                          updateWizardData({ contentType: type, selectedContentId: undefined, selectedContentName: undefined });
                          // Fetch content items for this type
                          setIsLoadingContent(true);
                          try {
                            const res = await fetch(`/api/coach/org-discover/${type}s`);
                            if (res.ok) {
                              const data = await res.json();
                              const items = data[`${type}s`] || [];
                              setContentItems(items.map((item: { id: string; title?: string; name?: string }) => ({
                                id: item.id,
                                title: item.title || item.name || 'Untitled'
                              })));
                            }
                          } catch (err) {
                            console.error('Failed to fetch content:', err);
                            setContentItems([]);
                          } finally {
                            setIsLoadingContent(false);
                          }
                        }}
                        className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
                          wizardData.contentType === type
                            ? 'border-brand-accent bg-gradient-to-br from-brand-accent/5 to-brand-accent/10 shadow-[0_4px_20px_rgba(160,120,85,0.12)]'
                            : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50 hover:shadow-md'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                          wizardData.contentType === type
                            ? 'bg-brand-accent/20'
                            : 'bg-[#f3f1ef] dark:bg-[#262b35]'
                        }`}>
                          <Icon className={`w-6 h-6 ${
                            wizardData.contentType === type
                              ? 'text-brand-accent'
                              : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                          }`} />
                        </div>
                        <span className={`font-semibold font-albert text-sm ${
                          wizardData.contentType === type
                            ? 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                            : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                        }`}>
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Item Selection */}
                {wizardData.contentType && (
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                      Select {wizardData.contentType}
                    </label>
                    {isLoadingContent ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-7 h-7 animate-spin text-brand-accent" />
                      </div>
                    ) : contentItems.length === 0 ? (
                      <div className="p-5 rounded-2xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35] text-center">
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-3">
                          No {wizardData.contentType}s found.
                        </p>
                        <button
                          onClick={() => {
                            onClose();
                            // Navigate to Resources tab
                            window.location.href = '/coach?tab=resources';
                          }}
                          className="text-sm font-medium text-brand-accent hover:text-brand-accent/80 font-albert underline underline-offset-2"
                        >
                          Create one in Resources →
                        </button>
                      </div>
                    ) : (
                      <Select
                        value={wizardData.selectedContentId || ''}
                        onValueChange={(value) => {
                          const item = contentItems.find(c => c.id === value);
                          updateWizardData({
                            selectedContentId: value,
                            selectedContentName: item?.title || ''
                          });
                        }}
                      >
                        <SelectTrigger className="w-full h-12 bg-white dark:bg-[#1d222b] border-[#e1ddd8] dark:border-[#262b35] rounded-2xl text-base">
                          <SelectValue placeholder={`Select a ${wizardData.contentType}`} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {contentItems.map((item) => (
                            <SelectItem key={item.id} value={item.id} className="py-3">
                              {item.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Program Type Step */}
            {wizardStep === 'program-type' && (
              <motion.div
                key="program-type"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Individual Card */}
                  <button
                    onClick={() => {
                      updateWizardData({ programType: 'individual' });
                      setWizardStep('program-structure');
                    }}
                    className={`group relative flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-colors ${
                      wizardData.programType === 'individual'
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                      wizardData.programType === 'individual'
                        ? 'bg-brand-accent/20'
                        : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-brand-accent/10'
                    }`}>
                      <User className={`w-7 h-7 ${wizardData.programType === 'individual' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      1:1 Coaching
                    </h3>
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      Work with clients individually
                    </p>
                    {wizardData.programType === 'individual' && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>

                  {/* Group Card */}
                  <button
                    onClick={() => {
                      updateWizardData({ programType: 'group' });
                      setWizardStep('program-structure');
                    }}
                    className={`group relative flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-colors ${
                      wizardData.programType === 'group'
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                      wizardData.programType === 'group'
                        ? 'bg-brand-accent/20'
                        : 'bg-[#f3f1ef] dark:bg-[#262b35] group-hover:bg-brand-accent/10'
                    }`}>
                      <Users className={`w-7 h-7 ${wizardData.programType === 'group' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Group Program
                    </h3>
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      Lead a cohort together
                    </p>
                    {wizardData.programType === 'group' && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Program Structure Step - Duration & Modules */}
            {wizardStep === 'program-structure' && (
              <motion.div
                key="program-structure"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="max-w-md mx-auto space-y-6"
              >
                {/* Duration Type - Prominent Toggle */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#f3f1ef] dark:bg-[#1d222b] border border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                    <button
                      onClick={() => updateWizardData({ durationType: 'fixed', recurring: false })}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        wizardData.durationType === 'fixed'
                          ? 'bg-white dark:bg-[#262b35] text-brand-accent shadow-sm'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      Fixed
                    </button>
                    <button
                      onClick={() => updateWizardData({ durationType: 'evergreen' })}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        wizardData.durationType === 'evergreen'
                          ? 'bg-white dark:bg-[#262b35] text-brand-accent shadow-sm'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Evergreen
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert">
                    {wizardData.durationType === 'evergreen'
                      ? 'Program repeats continuously after completion'
                      : 'Program ends after the set duration'}
                  </p>
                </div>

                {/* Duration + Modules Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Duration Card */}
                  <div className="p-5 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b]/50 border border-[#e1ddd8]/60 dark:border-[#262b35]/60 text-center">
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                      {wizardData.durationType === 'evergreen' ? 'Cycle Length' : 'Duration'}
                    </label>
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => updateWizardData({ durationWeeks: Math.max(1, wizardData.durationWeeks - 1) })}
                        disabled={wizardData.durationWeeks <= 1}
                        className="w-11 h-11 rounded-xl bg-[#f3f1ef] dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium text-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8e5e1] dark:hover:bg-[#262b35] transition-colors"
                      >
                        −
                      </button>
                      <div className="flex flex-col items-center">
                        <span className="text-4xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tabular-nums">{wizardData.durationWeeks}</span>
                        <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">weeks</span>
                      </div>
                      <button
                        onClick={() => updateWizardData({ durationWeeks: Math.min(52, wizardData.durationWeeks + 1) })}
                        disabled={wizardData.durationWeeks >= 52}
                        className="w-11 h-11 rounded-xl bg-[#f3f1ef] dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium text-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8e5e1] dark:hover:bg-[#262b35] transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Modules Card */}
                  <div className="p-5 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b]/50 border border-[#e1ddd8]/60 dark:border-[#262b35]/60 text-center">
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                      Modules
                    </label>
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => updateWizardData({ numModules: Math.max(1, wizardData.numModules - 1) })}
                        disabled={wizardData.numModules <= 1}
                        className="w-11 h-11 rounded-xl bg-[#f3f1ef] dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium text-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8e5e1] dark:hover:bg-[#262b35] transition-colors"
                      >
                        −
                      </button>
                      <div className="flex flex-col items-center">
                        <span className="text-4xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tabular-nums">{wizardData.numModules}</span>
                        <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">modules</span>
                      </div>
                      <button
                        onClick={() => updateWizardData({ numModules: Math.min(12, wizardData.numModules + 1) })}
                        disabled={wizardData.numModules >= 12}
                        className="w-11 h-11 rounded-xl bg-[#f3f1ef] dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium text-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8e5e1] dark:hover:bg-[#262b35] transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Weeks per module calculation */}
                <p className="text-center text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert">
                  {Math.round(wizardData.durationWeeks / wizardData.numModules * 10) / 10} weeks per module
                </p>

                {/* Weekends Toggle + Edit later note */}
                <div>
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b]/50">
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Include Weekends
                      </label>
                      <p className="text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert">
                        {wizardData.includeWeekends ? '7 days per week' : '5 days per week (Mon-Fri)'}
                      </p>
                    </div>
                    <Switch
                      checked={wizardData.includeWeekends}
                      onCheckedChange={(checked) => updateWizardData({ includeWeekends: checked })}
                    />
                  </div>
                  <p className="text-center text-xs text-[#8c8a87] dark:text-[#8b8f9a] font-albert italic mt-3">
                    You can edit this later
                  </p>
                </div>
              </motion.div>
            )}

            {/* Program Details Step - Name, Description & Pricing */}
            {wizardStep === 'program-details' && (
              <motion.div
                key="program-details"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                {/* Program Name */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Program Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={wizardData.programName}
                    onChange={(e) => updateWizardData({
                      programName: e.target.value,
                      cohortName: wizardData.programType === 'group' ? `${e.target.value} - Cohort 1` : ''
                    })}
                    placeholder='e.g., "90-Day Transformation"'
                    className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={wizardData.programDescription}
                    onChange={(e) => updateWizardData({ programDescription: e.target.value })}
                    placeholder="Describe what clients will achieve..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors resize-none"
                  />
                </div>

                {/* Pricing */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                    Pricing
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                      onClick={() => updateWizardData({ pricing: 'free', recurring: false })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        wizardData.pricing === 'free'
                          ? 'border-brand-accent bg-brand-accent/5'
                          : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                      }`}
                    >
                      <span className={`font-semibold ${wizardData.pricing === 'free' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>Free</span>
                    </button>
                    <button
                      onClick={() => updateWizardData({ pricing: 'paid' })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        wizardData.pricing === 'paid'
                          ? 'border-brand-accent bg-brand-accent/5'
                          : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                      }`}
                    >
                      <DollarSign className={`w-5 h-5 ${wizardData.pricing === 'paid' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                      <span className={`font-semibold ${wizardData.pricing === 'paid' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>Paid</span>
                    </button>
                  </div>

                  {/* Price Input & Stripe Warning */}
                  <AnimatePresence mode="wait">
                    {wizardData.pricing === 'paid' && (
                      <motion.div
                        key="paid-options"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3 overflow-hidden"
                      >
                        {/* Stripe Warning */}
                        {!stripeLoading && !stripeConnected && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: 0.1 }}
                          >
                            <StripeConnectWarning
                              variant="inline"
                              showCta={true}
                              message="Connect Stripe to accept platform payments"
                              subMessage="Without Stripe, you can still add clients as pre-paid (they paid you externally)."
                              onConnectClick={() => setShowStripeModal(true)}
                            />
                          </motion.div>
                        )}

                        {/* Price Input */}
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: stripeConnected ? 0 : 0.15 }}
                          className="relative"
                        >
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert font-medium">$</span>
                          <input
                            type="number"
                            value={wizardData.price}
                            onChange={(e) => updateWizardData({ price: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
                            placeholder="297"
                          />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Auto-renew subscription - only for evergreen paid programs */}
                {wizardData.pricing === 'paid' && wizardData.durationType === 'evergreen' && (
                  <div className="p-4 rounded-xl border bg-[#faf8f6] dark:bg-[#1d222b]/50 border-[#e1ddd8] dark:border-[#262b35]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <RefreshCw className={`w-5 h-5 ${wizardData.recurring ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
                        <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                          Auto-renew subscription
                        </span>
                      </div>
                      <Switch
                        checked={wizardData.recurring}
                        onCheckedChange={(checked) => updateWizardData({ recurring: checked })}
                      />
                    </div>

                    {wizardData.recurring && (
                      <div className="mt-3 pt-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
                        <label className="block text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
                          Billing Cadence
                        </label>
                        <Select
                          value={wizardData.recurringCadence}
                          onValueChange={(value) => updateWizardData({ recurringCadence: value as WizardData['recurringCadence'] })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Bi-weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Cohort Setup Step */}
            {wizardStep === 'cohort-setup' && (
              <motion.div
                key="cohort-setup"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="space-y-5 max-w-md mx-auto"
              >
                {/* Cohort Name */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Cohort Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={wizardData.cohortName}
                    onChange={(e) => updateWizardData({ cohortName: e.target.value })}
                    placeholder={`${wizardData.programName || 'Program'} - Cohort 1`}
                    className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    <input
                      type="date"
                      value={wizardData.cohortStartDate}
                      onChange={(e) => updateWizardData({ cohortStartDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
                    />
                  </div>
                </div>

                {/* Max Enrollment */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Max Enrollment (optional)
                  </label>
                  <input
                    type="number"
                    value={wizardData.cohortMaxEnrollment}
                    onChange={(e) => updateWizardData({ cohortMaxEnrollment: e.target.value })}
                    placeholder="Unlimited"
                    min={1}
                    className="w-full px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors"
                  />
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                    Leave empty for unlimited enrollment
                  </p>
                </div>
              </motion.div>
            )}

            {/* Funnel Setup Step */}
            {wizardStep === 'funnel-setup' && (
              <motion.div
                key="funnel-setup"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="space-y-5 max-w-md mx-auto"
              >
                {/* Preview */}
                <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35]">
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                    Signup Flow Preview
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#3a4150]">
                      <User className="w-4 h-4 text-brand-accent" />
                      <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Signup</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    {wizardData.targetType === 'program' && (
                      (wizardData.programChoice === 'new' && wizardData.pricing === 'paid') ||
                      (wizardData.programChoice === 'existing' && wizardData.selectedProgramId && (programs.find(p => p.id === wizardData.selectedProgramId)?.priceInCents ?? 0) > 0)
                    ) && (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#3a4150]">
                          <CreditCard className="w-4 h-4 text-brand-accent" />
                          <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Payment</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      </>
                    )}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#3a4150]">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Success</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-3">
                    You can change this later
                  </p>
                </div>

                {/* Access Type */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                    How will clients access this {wizardData.targetType === 'content' ? 'content' : 'program'}?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Public Option */}
                    <button
                      onClick={() => updateWizardData({ funnelAccessType: 'public' })}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        wizardData.funnelAccessType === 'public'
                          ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20'
                          : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#c5c0ba] dark:hover:border-[#3a4150]'
                      }`}
                    >
                      {wizardData.funnelAccessType === 'public' && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${
                        wizardData.funnelAccessType === 'public'
                          ? 'bg-brand-accent/20'
                          : 'bg-[#f0ede9] dark:bg-[#262b35]'
                      }`}>
                        <Globe className={`w-5 h-5 ${
                          wizardData.funnelAccessType === 'public'
                            ? 'text-brand-accent'
                            : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                        }`} />
                      </div>
                      <p className={`font-medium font-albert text-sm mb-1 ${
                        wizardData.funnelAccessType === 'public'
                          ? 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                      }`}>
                        Open Signup
                      </p>
                      <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert leading-relaxed">
                        Share one link, anyone can join
                      </p>
                    </button>

                    {/* Invite Only Option */}
                    <button
                      onClick={() => updateWizardData({ funnelAccessType: 'invite_only' })}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        wizardData.funnelAccessType === 'invite_only'
                          ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent/20'
                          : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#c5c0ba] dark:hover:border-[#3a4150]'
                      }`}
                    >
                      {wizardData.funnelAccessType === 'invite_only' && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${
                        wizardData.funnelAccessType === 'invite_only'
                          ? 'bg-brand-accent/20'
                          : 'bg-[#f0ede9] dark:bg-[#262b35]'
                      }`}>
                        <Mail className={`w-5 h-5 ${
                          wizardData.funnelAccessType === 'invite_only'
                            ? 'text-brand-accent'
                            : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                        }`} />
                      </div>
                      <p className={`font-medium font-albert text-sm mb-1 ${
                        wizardData.funnelAccessType === 'invite_only'
                          ? 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                          : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                      }`}>
                        Private Invites
                      </p>
                      <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert leading-relaxed">
                        Unique link per client
                      </p>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Create Invite Step (after wizard completion) */}
            {wizardStep === 'create-invite' && wizardCompletionState === 'idle' && (
              <motion.div
                key="create-invite"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Success Banner */}
                {wizardSuccess && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-medium text-emerald-700 dark:text-emerald-300 font-albert">
                          Setup complete!
                        </p>
                        <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 font-albert">
                          Your program and signup flow are ready
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show the created link */}
                {createdLinkUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {wizardData.funnelAccessType === 'public' ? (
                        <Globe className="w-5 h-5 text-brand-accent" />
                      ) : (
                        <Link2 className="w-5 h-5 text-brand-accent" />
                      )}
                      <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {wizardData.funnelAccessType === 'public'
                          ? 'Your signup link is ready!'
                          : 'Your first invite link is ready!'}
                      </p>
                    </div>

                    {/* Link display and copy */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-3 bg-[#faf8f6] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
                        <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-mono truncate">
                          {createdLinkUrl}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdLinkUrl);
                          setCreatedLinkCopied(true);
                          setTimeout(() => setCreatedLinkCopied(false), 2000);
                        }}
                        className={`shrink-0 px-4 py-3 rounded-xl font-albert font-medium text-sm transition-all flex items-center gap-2 ${
                          createdLinkCopied
                            ? 'bg-emerald-500 text-white'
                            : 'bg-brand-accent text-white hover:bg-brand-accent/90'
                        }`}
                      >
                        {createdLinkCopied ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert">
                      {wizardData.funnelAccessType === 'public'
                        ? 'Share this link anywhere — anyone can sign up!'
                        : 'Share this link with a client to invite them to your program.'}
                    </p>
                  </div>
                )}

                {/* Invite-only: intro and invite form */}
                {wizardData.funnelAccessType === 'invite_only' && !createdLinkUrl && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-brand-accent" />
                      <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Add clients to invite
                      </p>
                    </div>
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      Each client will get a unique invite link. Only they can use it — the signup email must match.
                    </p>
                  </div>
                )}

                {/* Invite-only: show created invites list and option to add more */}
                {wizardData.funnelAccessType === 'invite_only' && (
                  <div className={createdLinkUrl ? "pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]" : ""}>
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
                      {createdLinkUrl ? 'Invite another client' : 'Add client email'}
                    </p>
                    <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mb-3">
                      Only these emails will be able to sign up with this invite
                    </p>
                    <form onSubmit={handleCreateInvite} className="space-y-4">
                      <div>
                        <textarea
                          required
                          value={createForm.emails}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, emails: e.target.value }))}
                          className="w-full min-h-[80px] px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-xl focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm resize-none"
                          placeholder="Enter client emails (one per line or comma-separated)&#10;e.g. john@example.com, jane@example.com"
                        />
                        <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert mt-1">
                          {(() => {
                            const count = createForm.emails
                              .split(/[,\n]/)
                              .map(e => e.trim())
                              .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).length;
                            return count > 0 ? `${count} valid email${count > 1 ? 's' : ''}` : 'Enter at least one email';
                          })()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
                        <BrandedCheckbox
                          checked={createForm.sendEmail}
                          onChange={(checked) => setCreateForm(prev => ({ ...prev, sendEmail: checked }))}
                        />
                        <span className="flex items-center gap-2 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer" onClick={() => setCreateForm(prev => ({ ...prev, sendEmail: !prev.sendEmail }))}>
                          <Send className="w-4 h-4 text-brand-accent" />
                          Send invite emails
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={isCreating || !createForm.emails.trim()}
                        className="w-full py-2.5 px-4 border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl hover:bg-[#f9f8f7] dark:hover:bg-[#1e222a] disabled:opacity-50 transition-colors font-albert flex items-center justify-center gap-2"
                      >
                        {isCreating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            {wizardInvites.length > 0 ? 'Add Another Batch' : 'Create Invite'}
                          </>
                        )}
                      </button>
                    </form>

                    {/* List of created invites */}
                    {wizardInvites.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                          Invites Created ({wizardInvites.length})
                        </p>
                        <div className="space-y-2">
                          {wizardInvites.map((invite) => (
                            <div
                              key={invite.id}
                              className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                                  {invite.name || invite.email}
                                </p>
                                {invite.name && (
                                  <p className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert truncate">
                                    {invite.email}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {invite.emailSent ? (
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-albert flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    Sent
                                  </span>
                                ) : (
                                  <span className="text-xs text-[#8c8c8c] dark:text-[#7f8694] font-albert">
                                    Not sent
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(invite.linkUrl);
                                    setCopiedInviteId(invite.id);
                                    setTimeout(() => setCopiedInviteId(null), 2000);
                                  }}
                                  className={`p-2 rounded-lg transition-colors ${
                                    copiedInviteId === invite.id
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                      : 'hover:bg-[#e1ddd8]/50 dark:hover:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
                                  }`}
                                >
                                  {copiedInviteId === invite.id ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Done button */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      // Show success state instead of closing immediately
                      setWizardCompletionState('success');
                    }}
                    disabled={wizardInvites.length === 0}
                    className={`flex-1 py-3 px-4 rounded-xl transition-colors font-albert font-medium flex items-center justify-center gap-2 ${
                      wizardInvites.length === 0
                        ? 'bg-[#e1ddd8] dark:bg-[#3a4150] text-[#8a857f] dark:text-[#6b7280] cursor-not-allowed'
                        : 'bg-brand-accent text-white hover:bg-brand-accent/90'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Done
                  </button>
                </div>
              </motion.div>
            )}

            {/* WIZARD SUCCESS STATE - Shows after clicking Done */}
            {wizardCompletionState === 'success' && (
              <motion.div
                key="wizard-success"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                {/* Success header */}
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    {wizardInvites.some(inv => inv.emailsSent && inv.emailsSent.length > 0)
                      ? 'Invites Sent!'
                      : 'Invite Created!'}
                  </h3>
                  <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm">
                    {wizardInvites.some(inv => inv.emailsSent && inv.emailsSent.length > 0)
                      ? 'Your clients have been invited via email.'
                      : 'Share this link with your clients to get them started.'}
                  </p>
                </div>

                {/* Show sent emails if any */}
                {wizardInvites.some(inv => inv.emailsSent && inv.emailsSent.length > 0) && (
                  <div className="bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Sent to:
                    </p>
                    <div className="space-y-1">
                      {wizardInvites.flatMap(inv => inv.emailsSent || []).map((email, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          <Check className="w-3.5 h-3.5 text-green-500" />
                          {email}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show failed emails if any */}
                {wizardInvites.some(inv => inv.emailsFailed && inv.emailsFailed.length > 0) && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300 font-albert mb-2">
                      Failed to send:
                    </p>
                    <div className="space-y-1">
                      {wizardInvites.flatMap(inv => inv.emailsFailed || []).map((email, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 font-albert">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {email}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invite link - always show */}
                {wizardInvites.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      {wizardInvites.some(inv => inv.emailsSent && inv.emailsSent.length > 0)
                        ? "Here's a link in case you still need it:"
                        : 'Share this link:'}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-3">
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate font-mono">
                          {wizardInvites[0].linkUrl}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wizardInvites[0].linkUrl);
                          setCreatedLinkCopied(true);
                          setTimeout(() => setCreatedLinkCopied(false), 2000);
                        }}
                        className="p-3 bg-[#faf8f6] dark:bg-[#11141b] hover:bg-[#f0ece6] dark:hover:bg-[#1a1f2a] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] transition-colors"
                      >
                        {createdLinkCopied ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : (
                          <Copy className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Allowed emails info (for private invites without email sent) */}
                {!wizardInvites.some(inv => inv.emailsSent && inv.emailsSent.length > 0) &&
                 wizardInvites.some(inv => inv.emails && inv.emails.length > 0) && (
                  <div className="bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Allowed emails:
                    </p>
                    <div className="space-y-1">
                      {wizardInvites.flatMap(inv => inv.emails || []).map((email, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          <Mail className="w-3.5 h-3.5 text-[#8a857f] dark:text-[#6b7280]" />
                          {email}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* What's next section */}
                <div className="pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                    What would you like to do next?
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => {
                        clearWizardState();
                        onClose();
                      }}
                      className="w-full py-3 px-4 bg-brand-accent text-white rounded-xl hover:bg-brand-accent/90 transition-colors font-albert font-medium flex items-center justify-center gap-2"
                    >
                      <Home className="w-4 h-4" />
                      Back to Dashboard
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          clearWizardState();
                          onClose();
                          // Navigate to programs tab (will be handled by parent)
                          window.dispatchEvent(new CustomEvent('navigate-coach-tab', { detail: 'programs' }));
                        }}
                        className="py-3 px-4 bg-[#faf8f6] dark:bg-[#11141b] hover:bg-[#f0ece6] dark:hover:bg-[#1a1f2a] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] transition-colors font-albert text-[#1a1a1a] dark:text-[#f5f5f8] flex items-center justify-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Edit Program
                      </button>
                      <button
                        onClick={() => {
                          clearWizardState();
                          onClose();
                          // Navigate to funnels tab (will be handled by parent)
                          window.dispatchEvent(new CustomEvent('navigate-coach-tab', { detail: 'funnels' }));
                        }}
                        className="py-3 px-4 bg-[#faf8f6] dark:bg-[#11141b] hover:bg-[#f0ece6] dark:hover:bg-[#1a1f2a] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] transition-colors font-albert text-[#1a1a1a] dark:text-[#f5f5f8] flex items-center justify-center gap-2"
                      >
                        <Link2 className="w-4 h-4" />
                        Edit Funnel
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
        )}

        {/* NORMAL MODE - Funnels exist and wizard not just completed */}
        {!isLoading && !error && funnels.length > 0 && !wizardSuccess && (
          <motion.div
            key="normal-mode"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            {/* LIST VIEW - Streamlined layout */}
            {currentView === 'list' && (
              <div className="space-y-5">
                {/* Success Message Banner */}
                <AnimatePresence>
                  {successMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`p-4 rounded-xl flex items-center gap-3 ${
                        successMessage.type === 'success'
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                          : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        successMessage.type === 'success'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-amber-100 dark:bg-amber-900/30'
                      }`}>
                        {successMessage.type === 'success' ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        )}
                      </div>
                      <p className={`text-sm font-albert flex-1 ${
                        successMessage.type === 'success'
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-amber-700 dark:text-amber-300'
                      }`}>
                        {successMessage.message}
                      </p>
                      <button
                        onClick={() => setSuccessMessage(null)}
                        className={`p-1 rounded-lg transition-colors ${
                          successMessage.type === 'success'
                            ? 'hover:bg-green-100 dark:hover:bg-green-900/30'
                            : 'hover:bg-amber-100 dark:hover:bg-amber-900/30'
                        }`}
                      >
                        <X className={`w-4 h-4 ${
                          successMessage.type === 'success'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Funnel Bar - selector + new funnel button */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                    Select funnel
                  </label>
                  <div className="flex items-center gap-3">
                    <Select value={selectedFunnelId || ''} onValueChange={setSelectedFunnelId}>
                      <SelectTrigger className="flex-1 h-11 px-4 bg-white dark:bg-[#1a1e26] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:border-brand-accent dark:focus:border-brand-accent">
                        <SelectValue placeholder="Select a funnel..." />
                      </SelectTrigger>
                    <SelectContent>
                      {funnels.map(funnel => (
                        <SelectItem key={funnel.id} value={funnel.id}>
                          <div className="flex items-center gap-2">
                            {funnel.accessType === 'public' ? (
                              <Globe className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Mail className="w-4 h-4 text-violet-500" />
                            )}
                            {funnel.name || 'Unnamed Funnel'}
                            <span className="text-xs text-[#8a857f] dark:text-[#6b7280]">
                              ({funnel.accessType === 'public' ? 'Public' : 'Private'})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      // Skip welcome step when funnels already exist - go directly to target-type
                      setWizardStep('target-type');
                      setWizardData(DEFAULT_WIZARD_DATA);
                      setWizardSuccess(true);
                    }}
                    className="h-11 px-4 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1a1e26] rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors font-albert text-[#5f5a55] dark:text-[#b2b6c2] flex items-center gap-2 text-sm whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    New
                  </motion.button>
                  </div>
                </div>

                {/* Create Form */}
                <div className="space-y-4">
                  {/* Email Input */}
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Client email(s)
                    </label>
                    <input
                      type="text"
                      value={createForm.emailInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.endsWith(',')) {
                          const email = value.slice(0, -1).trim().toLowerCase();
                          if (email && email.includes('@') && !createForm.emailChips.includes(email)) {
                            setCreateForm(prev => ({
                              ...prev,
                              emailInput: '',
                              emailChips: [...prev.emailChips, email]
                            }));
                          } else {
                            setCreateForm(prev => ({ ...prev, emailInput: '' }));
                          }
                        } else {
                          setCreateForm(prev => ({ ...prev, emailInput: value }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const email = createForm.emailInput.trim().toLowerCase();
                          if (email && email.includes('@') && !createForm.emailChips.includes(email)) {
                            setCreateForm(prev => ({
                              ...prev,
                              emailInput: '',
                              emailChips: [...prev.emailChips, email]
                            }));
                          }
                        }
                        if (e.key === 'Backspace' && createForm.emailInput === '' && createForm.emailChips.length > 0) {
                          setCreateForm(prev => ({
                            ...prev,
                            emailChips: prev.emailChips.slice(0, -1)
                          }));
                        }
                      }}
                      className="w-full h-11 px-4 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-xl focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      placeholder={createForm.emailChips.length > 0 ? "Add another email..." : "Enter email address..."}
                    />
                    <p className="text-xs text-[#8a857f] dark:text-[#6b7280] font-albert mt-1.5">
                      Press comma or Enter to add multiple emails
                    </p>
                    {/* Email Chips */}
                    {createForm.emailChips.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {createForm.emailChips.map((email, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-accent/10 dark:bg-brand-accent/20 rounded-lg text-sm text-brand-accent"
                          >
                            {email}
                            <button
                              type="button"
                              onClick={() => {
                                setCreateForm(prev => ({
                                  ...prev,
                                  emailChips: prev.emailChips.filter((_, i) => i !== index)
                                }));
                              }}
                              className="ml-1 text-brand-accent/60 hover:text-brand-accent"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payment Status - Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Payment
                    </label>
                    <Select
                      value={createForm.paymentStatus}
                      onValueChange={(value) => setCreateForm(prev => ({
                        ...prev,
                        paymentStatus: value as 'required' | 'pre_paid' | 'free'
                      }))}
                    >
                      <SelectTrigger className="w-full h-11 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:border-brand-accent dark:focus:border-brand-accent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required" disabled={!canAcceptPayments}>
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                            <span>Payment Required</span>
                            {!canAcceptPayments && <span className="text-xs text-[#8a857f]">(Connect Stripe)</span>}
                          </div>
                        </SelectItem>
                        <SelectItem value="pre_paid">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                            <span>Pre-paid</span>
                            <span className="text-xs text-[#8a857f]">Paid externally</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="free">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                            <span>Free Access</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stripe Connect Warning */}
                  {createForm.paymentStatus === 'required' && !canAcceptPayments && (
                    <StripeConnectWarning
                      variant="inline"
                      showCta={true}
                      onConnectClick={() => setShowStripeModal(true)}
                    />
                  )}

                  {/* Send Email Toggle */}
                  <div className="flex items-center justify-between py-2">
                    <label className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      Send invite by email
                    </label>
                    <Switch
                      checked={createForm.sendEmail}
                      onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, sendEmail: checked }))}
                    />
                  </div>

                  {/* Create Button */}
                  <button
                    onClick={handleCreateInvite}
                    disabled={!selectedFunnelId || (createForm.emailChips.length === 0 && !createForm.emailInput.includes('@')) || isCreating}
                    className="w-full py-3 px-4 bg-brand-accent text-white rounded-xl font-albert font-semibold hover:bg-brand-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Create Invite
                  </button>
                </div>

                {/* Collapsible Existing Invites */}
                <div className="pt-2">
                  <button
                    onClick={() => setShowExistingInvites(!showExistingInvites)}
                    className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert transition-colors"
                  >
                    {showExistingInvites ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Sent invites
                    {invites.length > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-[#f5f3f0] dark:bg-[#262b35] rounded-full">
                        {invites.length}
                      </span>
                    )}
                  </button>

                  <AnimatePresence>
                    {showExistingInvites && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 space-y-2">
                          {/* Invites Loading */}
                          {invitesLoading && (
                            <div className="flex justify-center py-6">
                              <Loader2 className="w-5 h-5 text-brand-accent animate-spin" />
                            </div>
                          )}

                          {/* Invites Error */}
                          {invitesError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                              {invitesError}
                            </div>
                          )}

                          {/* Empty state */}
                          {!invitesLoading && !invitesError && invites.length === 0 && (
                            <div className="text-center py-6">
                              <p className="text-sm text-[#8c8c8c] dark:text-[#7f8694] font-albert">
                                No invites sent yet
                              </p>
                            </div>
                          )}

                          {/* Invites list */}
                          {!invitesLoading && !invitesError && invites.length > 0 && (
                            <>
                              {invites.map(invite => (
                                <div
                                  key={invite.id}
                                  className="flex items-center justify-between p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-md bg-white dark:bg-[#262b35] flex items-center justify-center shrink-0">
                                      {invite.email || invite.emails?.length ? (
                                        <Mail className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                                      ) : (
                                        <Link2 className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-mono text-xs">
                                          {invite.id}
                                        </p>
                                        {getStatusBadge(invite)}
                                      </div>
                                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                                        {invite.emails?.length
                                          ? `${invite.emails.slice(0, 2).join(', ')}${invite.emails.length > 2 ? `, +${invite.emails.length - 2}` : ''}`
                                          : invite.email || invite.name || 'General invite'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => copyInviteLink(invite)}
                                      className="p-1.5 hover:bg-white dark:hover:bg-[#262b35] rounded-md transition-colors"
                                      title={copiedInviteId === invite.id ? "Copied!" : "Copy link"}
                                    >
                                      {copiedInviteId === invite.id ? (
                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                                      )}
                                    </button>
                                    {!invite.usedBy && (
                                      <button
                                        onClick={() => handleCancelInvite(invite.id)}
                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                                        title="Cancel invite"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* CREATE VIEW - Animated */}
            <AnimatePresence mode="wait">
              {currentView === 'create' && (
                <motion.form
                  key="create-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleCreateInvite}
                  className="space-y-4"
                >
                  {/* Email Input with Chips */}
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Client Email(s) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={createForm.emailInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Check if comma was typed - add email as chip
                        if (value.endsWith(',')) {
                          const email = value.slice(0, -1).trim().toLowerCase();
                          if (email && email.includes('@') && !createForm.emailChips.includes(email)) {
                            setCreateForm(prev => ({
                              ...prev,
                              emailInput: '',
                              emailChips: [...prev.emailChips, email]
                            }));
                          } else {
                            setCreateForm(prev => ({ ...prev, emailInput: '' }));
                          }
                        } else {
                          setCreateForm(prev => ({ ...prev, emailInput: value }));
                        }
                      }}
                      onKeyDown={(e) => {
                        // Handle Enter to add chip
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const email = createForm.emailInput.trim().toLowerCase();
                          if (email && email.includes('@') && !createForm.emailChips.includes(email)) {
                            setCreateForm(prev => ({
                              ...prev,
                              emailInput: '',
                              emailChips: [...prev.emailChips, email]
                            }));
                          }
                        }
                        // Handle Backspace to remove last chip if input is empty
                        if (e.key === 'Backspace' && createForm.emailInput === '' && createForm.emailChips.length > 0) {
                          setCreateForm(prev => ({
                            ...prev,
                            emailChips: prev.emailChips.slice(0, -1)
                          }));
                        }
                      }}
                      className="w-full h-12 px-4 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-xl focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      placeholder={createForm.emailChips.length > 0 ? "Add another email..." : "user@example.com (press comma or enter to add more)"}
                    />
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                      Separate multiple emails with comma or press Enter
                    </p>

                    {/* Email Chips */}
                    <AnimatePresence>
                      {createForm.emailChips.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex flex-wrap gap-2 mt-3"
                        >
                          {createForm.emailChips.map((email, index) => (
                            <motion.div
                              key={email}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent/10 dark:bg-brand-accent/20 text-brand-accent rounded-full text-sm font-albert"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>{email}</span>
                              <button
                                type="button"
                                onClick={() => setCreateForm(prev => ({
                                  ...prev,
                                  emailChips: prev.emailChips.filter((_, i) => i !== index)
                                }))}
                                className="ml-1 hover:bg-brand-accent/20 rounded-full p-0.5"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Payment Selector */}
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                      Payment
                    </label>
                    <Select
                      value={createForm.paymentStatus}
                      onValueChange={(value) => setCreateForm(prev => ({
                        ...prev,
                        paymentStatus: value as 'required' | 'pre_paid' | 'free'
                      }))}
                    >
                      <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:border-brand-accent dark:focus:border-brand-accent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required" disabled={!canAcceptPayments}>
                          Payment Required {!canAcceptPayments && '(Stripe required)'}
                        </SelectItem>
                        <SelectItem value="pre_paid">Pre-paid (paid externally)</SelectItem>
                        <SelectItem value="free">Free Access</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Stripe Warning when Payment Required selected but Stripe not connected */}
                    {createForm.paymentStatus === 'required' && !canAcceptPayments && (
                      <div className="mt-2">
                        <StripeConnectWarning
                          variant="inline"
                          showCta={true}
                          message="Connect Stripe to enable platform payments"
                          subMessage="Use 'Pre-paid' for clients who paid you externally (Venmo, PayPal, cash, etc.)."
                          onConnectClick={() => setShowStripeModal(true)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Pre-paid Amount + Reference (side by side) */}
                  <AnimatePresence>
                    {createForm.paymentStatus === 'pre_paid' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="grid grid-cols-2 gap-3"
                      >
                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                            Amount ($)
                          </label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a857f] dark:text-[#6b7280]" />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={createForm.prePaidAmount}
                              onChange={(e) => setCreateForm(prev => ({ ...prev, prePaidAmount: e.target.value }))}
                              className="w-full h-12 pl-9 pr-4 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-xl focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                              placeholder="297.00"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                            Reference
                          </label>
                          <input
                            type="text"
                            value={createForm.prePaidNote}
                            onChange={(e) => setCreateForm(prev => ({ ...prev, prePaidNote: e.target.value }))}
                            className="w-full h-12 px-4 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-xl focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                            placeholder="Invoice #123"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Send Email Toggle */}
                  {(createForm.emailChips.length > 0 || createForm.emailInput.includes('@')) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-3 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      <BrandedCheckbox
                        checked={createForm.sendEmail}
                        onChange={(checked) => setCreateForm(prev => ({ ...prev, sendEmail: checked }))}
                      />
                      <span className="flex items-center gap-2 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer" onClick={() => setCreateForm(prev => ({ ...prev, sendEmail: !prev.sendEmail }))}>
                        <Send className="w-4 h-4 text-brand-accent" />
                        Send invite email{createForm.emailChips.length > 1 ? 's' : ''} ({createForm.emailChips.length || 1} recipient{createForm.emailChips.length !== 1 ? 's' : ''})
                      </span>
                    </motion.div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setCreateForm({
                          emailInput: '',
                          emailChips: [],
                          emails: '',
                          paymentStatus: 'required',
                          prePaidAmount: '',
                          prePaidNote: '',
                          sendEmail: true,
                        });
                        setCurrentView('list');
                      }}
                      className="flex-1 py-2.5 px-4 text-[#5f5a55] dark:text-[#b2b6c2] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors font-albert"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={isCreating || (createForm.emailChips.length === 0 && !createForm.emailInput.includes('@'))}
                      className="flex-1 py-2.5 px-4 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-albert flex items-center justify-center gap-2"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Invite'
                      )}
                    </motion.button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* BULK VIEW */}
            {currentView === 'bulk' && (
              <div className="space-y-4">
                {!bulkResult ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Client List
                      </label>
                      <textarea
                        value={bulkCsv}
                        onChange={(e) => setBulkCsv(e.target.value)}
                        className="w-full px-4 py-3 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-xl focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8] resize-none font-mono text-sm"
                        rows={8}
                        placeholder={`email@example.com, John Doe\nanother@example.com, Jane Doe\n...`}
                      />
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
                        One entry per line: email, name (name is optional)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Payment (for all)
                      </label>
                      <Select
                        value={bulkPaymentStatus}
                        onValueChange={(value) => setBulkPaymentStatus(value as 'required' | 'pre_paid' | 'free')}
                      >
                        <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:border-brand-accent dark:focus:border-brand-accent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="required" disabled={!canAcceptPayments}>
                            Payment Required {!canAcceptPayments && '(Stripe required)'}
                          </SelectItem>
                          <SelectItem value="pre_paid">Pre-paid (paid externally)</SelectItem>
                          <SelectItem value="free">Free Access</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Stripe Warning when Payment Required selected but Stripe not connected */}
                      {bulkPaymentStatus === 'required' && !canAcceptPayments && (
                        <div className="mt-2">
                          <StripeConnectWarning
                            variant="inline"
                            showCta={true}
                            message="Connect Stripe to enable platform payments"
                            subMessage="Use 'Pre-paid' for clients who paid you externally."
                            onConnectClick={() => setShowStripeModal(true)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Pre-paid Amount + Reference (for all) */}
                    <AnimatePresence>
                      {bulkPaymentStatus === 'pre_paid' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="grid grid-cols-2 gap-3"
                        >
                          <div>
                            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                              Amount ($)
                            </label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a857f] dark:text-[#6b7280]" />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={bulkPrepaidAmount}
                                onChange={(e) => setBulkPrepaidAmount(e.target.value)}
                                className="w-full h-12 pl-9 pr-4 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-xl focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                                placeholder="297.00"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                              Reference
                            </label>
                            <input
                              type="text"
                              value={bulkPrepaidNote}
                              onChange={(e) => setBulkPrepaidNote(e.target.value)}
                              className="w-full h-12 px-4 border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] rounded-xl focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                              placeholder="Invoice #123"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Send Emails Toggle */}
                    <div className="flex items-center gap-3 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
                      <BrandedCheckbox
                        checked={bulkSendEmails}
                        onChange={(checked) => setBulkSendEmails(checked)}
                      />
                      <span className="flex items-center gap-2 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert cursor-pointer" onClick={() => setBulkSendEmails(!bulkSendEmails)}>
                        <Send className="w-4 h-4 text-brand-accent" />
                        Send invite emails to all addresses
                      </span>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentView('list')}
                        className="flex-1 py-2.5 px-4 text-[#5f5a55] dark:text-[#b2b6c2] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors font-albert"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleBulkImport}
                        disabled={isBulkImporting || !bulkCsv.trim()}
                        className="flex-1 py-2.5 px-4 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 transition-colors font-albert flex items-center justify-center gap-2"
                      >
                        {isBulkImporting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          'Import'
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center py-4">
                      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                        <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <h4 className="text-lg font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                        Import Complete
                      </h4>
                      <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        Created {bulkResult.created} invites
                        {bulkResult.skipped > 0 && `, skipped ${bulkResult.skipped} duplicates`}
                      </p>
                      {bulkResult.emailsSent > 0 && (
                        <p className="text-sm text-brand-accent font-albert mt-1">
                          {bulkResult.emailsSent} invite emails sent
                        </p>
                      )}
                    </div>

                    {bulkResult.errors.length > 0 && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-400 flex items-center gap-2 font-albert">
                          <AlertCircle className="w-4 h-4" />
                          {bulkResult.errors.length} errors
                        </p>
                        <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 font-albert">
                          {bulkResult.errors.slice(0, 5).map((err, i) => (
                            <li key={i}>Line {err.index + 1}: {err.error}</li>
                          ))}
                          {bulkResult.errors.length > 5 && (
                            <li>... and {bulkResult.errors.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setCurrentView('list');
                        setBulkResult(null);
                        setBulkCsv('');
                      }}
                      className="w-full py-2.5 px-4 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors font-albert"
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Footer with progress dots and actions - only show in wizard mode (not on auto-advancing or final steps) */}
      {!isLoading && !error && isWizardMode && wizardStep !== 'welcome' && wizardStep !== 'target-type' && wizardStep !== 'create-invite' && (
        <div className="px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          <div className="flex items-center justify-between">
            {/* Progress Dots */}
            <div className="flex items-center gap-2">
              {Array.from({ length: getWizardDotsCount() }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i <= getWizardDotIndex()
                      ? 'bg-brand-accent'
                      : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                  }`}
                />
              ))}
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                if (wizardStep === 'funnel-setup') {
                  handleWizardComplete();
                } else {
                  const next = getNextWizardStep();
                  if (next) setWizardStep(next);
                }
              }}
              disabled={!canProceedWizard() || isCreatingProgram}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingProgram ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : wizardStep === 'funnel-setup' ? (
                <>
                  Create & Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );

  // Cancel Invite Confirmation Dialog
  const cancelConfirmDialog = (
    <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Cancel Invite
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel this invite? The link will no longer work and anyone trying to use it will be rejected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>
            Keep Invite
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmCancelInvite}
            disabled={isCancelling}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Cancelling...
              </>
            ) : (
              'Yes, Cancel Invite'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Desktop: Use Dialog (centered modal)
  if (isDesktop) {
    return (
      <>
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="max-w-lg p-0 max-h-[90vh] overflow-hidden flex flex-col" hideCloseButton>
            <DialogTitle className="sr-only">{headerInfo.title}</DialogTitle>
            {content}
          </DialogContent>
        </Dialog>
        {cancelConfirmDialog}
        <StripeConnectModal
          isOpen={showStripeModal}
          onClose={() => setShowStripeModal(false)}
          onConnected={() => refetchStripe()}
        />
      </>
    );
  }

  // Mobile: Use Drawer (slide-up)
  return (
    <>
      <Drawer
        open={isOpen}
        onOpenChange={(open) => !open && onClose()}
        shouldScaleBackground={false}
      >
        <DrawerContent className="max-h-[90vh] overflow-hidden flex flex-col">
          {content}
        </DrawerContent>
      </Drawer>
      {cancelConfirmDialog}
      <StripeConnectModal
        isOpen={showStripeModal}
        onClose={() => setShowStripeModal(false)}
        onConnected={() => refetchStripe()}
      />
    </>
  );
}
