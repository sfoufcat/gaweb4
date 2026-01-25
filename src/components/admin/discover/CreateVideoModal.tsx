'use client';

import React, { useState, Fragment, useCallback, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Play,
  Globe,
  Lock,
  DollarSign,
  Sparkles,
  Upload,
  CheckCircle2,
  Image as ImageIcon,
  Plus,
} from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ProgramSelector } from '@/components/admin/ProgramSelector';
import { useStripeConnectStatus } from '@/hooks/useStripeConnectStatus';
import { StripeConnectWarning } from '@/components/ui/StripeConnectWarning';
import { StripeConnectModal } from '@/components/ui/StripeConnectModal';
import { DiscardUploadDialog } from '@/components/ui/DiscardUploadDialog';
import { ThumbnailWithFallback, pollForThumbnail, getThumbnailUrl } from '@/lib/video-thumbnail';
import * as tus from 'tus-js-client';

// Wizard step types
type WizardStep = 'info' | 'details';

// Thumbnail option type
type ThumbnailOption = 'auto' | 'custom';

// Wizard data collected across steps
interface VideoWizardData {
  // Step 1: Info
  title: string;
  description: string;
  bunnyVideoId: string;
  discoverVideoId: string; // Firestore doc ID (placeholder created on upload)
  thumbnailUrl: string; // Auto-generated from Bunny
  // Step 2: Details
  thumbnailOption: ThumbnailOption;
  customThumbnailUrl: string;
  previewBunnyVideoId: string;
  programIds: string[];
  pricing: 'free' | 'paid';
  price: number;
  isPublic: boolean;
}

const DEFAULT_WIZARD_DATA: VideoWizardData = {
  title: '',
  description: '',
  bunnyVideoId: '',
  discoverVideoId: '',
  thumbnailUrl: '',
  thumbnailOption: 'auto',
  customThumbnailUrl: '',
  previewBunnyVideoId: '',
  programIds: [],
  pricing: 'free',
  price: 0,
  isPublic: true,
};

interface CreateVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoCreated: (videoId: string) => void;
  apiEndpoint?: string;
  programsApiEndpoint?: string;
}

export function CreateVideoModal({
  isOpen,
  onClose,
  onVideoCreated,
  apiEndpoint = '/api/coach/org-discover/videos',
  programsApiEndpoint = '/api/coach/org-programs',
}: CreateVideoModalProps) {
  const [step, setStep] = useState<WizardStep>('info');
  const [wizardData, setWizardData] = useState<VideoWizardData>(DEFAULT_WIZARD_DATA);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Upload states
  const [mainVideoFile, setMainVideoFile] = useState<File | null>(null);
  const [previewVideoFile, setPreviewVideoFile] = useState<File | null>(null);
  const [mainUploadProgress, setMainUploadProgress] = useState(0);
  const [previewUploadProgress, setPreviewUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isFetchingThumbnail, setIsFetchingThumbnail] = useState(false);

  const isMobile = useMediaQuery('(max-width: 768px)');

  // Stripe Connect status for paid pricing
  const { isConnected: stripeConnected, isLoading: stripeLoading, refetch: refetchStripe } = useStripeConnectStatus();
  const [showStripeModal, setShowStripeModal] = useState(false);
  const canAcceptPayments = stripeConnected || stripeLoading;

  // Track uploaded but unsaved videos (for cleanup on discard)
  const [pendingBunnyVideoIds, setPendingBunnyVideoIds] = useState<string[]>([]);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track if this is the initial mount to skip animation on first open
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isOpen) {
      isInitialMount.current = true;
      const timer = setTimeout(() => {
        isInitialMount.current = false;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Smooth fade animation variants
  const fadeVariants = {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('info');
      setWizardData(DEFAULT_WIZARD_DATA);
      setIsCreating(false);
      setCreateError(null);
      setMainVideoFile(null);
      setPreviewVideoFile(null);
      setMainUploadProgress(0);
      setPreviewUploadProgress(0);
      setIsUploading(false);
      setUploadError(null);
      setPendingBunnyVideoIds([]);
      setShowDiscardDialog(false);
      setIsDeleting(false);
    }
  }, [isOpen]);

  // Check if there are pending uploads that would be lost
  const hasPendingUploads = pendingBunnyVideoIds.length > 0 || isUploading;

  // Delete pending videos from Bunny when discarding
  const deletePendingVideos = async () => {
    setIsDeleting(true);
    try {
      await Promise.all(
        pendingBunnyVideoIds.map((videoId) =>
          fetch(`/api/coach/bunny-video/${videoId}`, { method: 'DELETE' }).catch((err) =>
            console.warn(`Failed to delete orphaned video ${videoId}:`, err)
          )
        )
      );
    } finally {
      setIsDeleting(false);
      setPendingBunnyVideoIds([]);
    }
  };

  const handleClose = () => {
    // If there are pending uploads, show discard confirmation
    if (hasPendingUploads) {
      setShowDiscardDialog(true);
      return;
    }
    onClose();
  };

  const handleDiscardConfirm = async () => {
    await deletePendingVideos();
    setShowDiscardDialog(false);
    onClose();
  };

  const handleDiscardCancel = () => {
    setShowDiscardDialog(false);
  };

  const updateWizardData = useCallback((updates: Partial<VideoWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  }, []);

  // Upload video to Bunny via TUS
  // Returns { bunnyVideoId, discoverVideoId } for main videos, or { bunnyVideoId } for previews
  const uploadVideoToBunny = async (
    file: File,
    isPreview: boolean,
    onProgress: (progress: number) => void
  ): Promise<{ bunnyVideoId: string; discoverVideoId?: string }> => {
    const urlResponse = await fetch('/api/coach/discover-videos/get-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        isPreview,
      }),
    });

    if (!urlResponse.ok) {
      const error = await urlResponse.json();
      throw new Error(error.error || 'Failed to get upload URL');
    }

    const { videoId, discoverVideoId, tusEndpoint, tusHeaders } = await urlResponse.json();

    // Debug: Log what we received from server
    console.log('[VIDEO_UPLOAD] TUS config:', {
      videoId,
      tusEndpoint,
      tusHeaders: {
        ...tusHeaders,
        AuthorizationSignature: tusHeaders.AuthorizationSignature?.substring(0, 20) + '...',
      },
    });

    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        headers: tusHeaders,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        onBeforeRequest: (req) => {
          // Debug: Log actual request being sent
          console.log('[VIDEO_UPLOAD] TUS request:', {
            method: req.getMethod(),
            url: req.getURL(),
            headers: {
              AuthorizationSignature: req.getHeader('AuthorizationSignature')?.substring(0, 20) + '...',
              AuthorizationExpire: req.getHeader('AuthorizationExpire'),
              VideoId: req.getHeader('VideoId'),
              LibraryId: req.getHeader('LibraryId'),
            },
          });
        },
        onError: (error) => {
          console.error('[VIDEO_UPLOAD] TUS error:', error);
          reject(new Error('Upload failed. Please try again.'));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          onProgress(percentage);
        },
        onSuccess: () => {
          console.log('[VIDEO_UPLOAD] Upload complete:', videoId, 'discoverVideoId:', discoverVideoId);
          // Track this video ID as pending (uploaded but not yet saved)
          setPendingBunnyVideoIds((prev) => [...prev, videoId]);
          resolve({ bunnyVideoId: videoId, discoverVideoId });
        },
      });

      upload.start();
    });
  };

  // Fetch auto-generated thumbnail from Bunny with polling (uses shared utility)
  const fetchThumbnail = async (videoId: string) => {
    setIsFetchingThumbnail(true);
    try {
      const thumbnailUrl = await pollForThumbnail(videoId);
      updateWizardData({ thumbnailUrl });
    } catch (error) {
      console.error('Error fetching thumbnail:', error);
      // Still set the URL even on error - might work later
      updateWizardData({ thumbnailUrl: getThumbnailUrl(videoId) });
    } finally {
      setIsFetchingThumbnail(false);
    }
  };

  const goToNextStep = async () => {
    if (step === 'info') {
      // Upload main video if file selected
      if (mainVideoFile && !wizardData.bunnyVideoId) {
        setIsUploading(true);
        setUploadError(null);
        try {
          const { bunnyVideoId, discoverVideoId } = await uploadVideoToBunny(mainVideoFile, false, setMainUploadProgress);
          updateWizardData({ bunnyVideoId, discoverVideoId: discoverVideoId || '' });
          // Fetch thumbnail after upload
          fetchThumbnail(bunnyVideoId);
          setStep('details');
        } catch (error) {
          setUploadError(error instanceof Error ? error.message : 'Upload failed');
        } finally {
          setIsUploading(false);
        }
      } else {
        setStep('details');
      }
    }
  };

  const goToPreviousStep = () => {
    if (step === 'details') {
      setStep('info');
    }
  };

  const handleCreateVideo = async () => {
    setIsCreating(true);
    setCreateError(null);

    try {
      let previewBunnyVideoId = wizardData.previewBunnyVideoId;

      // Upload preview video if file selected
      if (previewVideoFile && !previewBunnyVideoId) {
        setIsUploading(true);
        const result = await uploadVideoToBunny(previewVideoFile, true, setPreviewUploadProgress);
        previewBunnyVideoId = result.bunnyVideoId;
        setIsUploading(false);
      }

      const videoData = {
        // If we have a discoverVideoId from placeholder, include it to update existing doc
        id: wizardData.discoverVideoId || undefined,
        title: wizardData.title,
        description: wizardData.description,
        bunnyVideoId: wizardData.bunnyVideoId,
        videoStatus: 'encoding',
        customThumbnailUrl: wizardData.thumbnailOption === 'custom' ? wizardData.customThumbnailUrl : null,
        previewBunnyVideoId: previewBunnyVideoId || null,
        programIds: wizardData.programIds,
        priceInCents: wizardData.pricing === 'paid' ? wizardData.price * 100 : 0,
        isPublic: wizardData.isPublic,
        purchaseType: wizardData.pricing === 'paid' ? 'popup' : 'free',
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create video');
      }

      const data = await response.json();
      const videoId = data.id;

      // Clear pending IDs since video was saved successfully
      setPendingBunnyVideoIds([]);
      onClose();
      onVideoCreated(videoId);
    } catch (error) {
      console.error('Error creating video:', error);
      setCreateError(error instanceof Error ? error.message : 'Failed to create video');
    } finally {
      setIsCreating(false);
      setIsUploading(false);
    }
  };

  // Get step index for progress indicator
  const getStepIndex = () => {
    const steps: WizardStep[] = ['info', 'details'];
    return steps.indexOf(step);
  };

  // Validation for each step
  const canProceed = () => {
    switch (step) {
      case 'info':
        return (
          wizardData.title.trim().length > 0 &&
          (mainVideoFile !== null || wizardData.bunnyVideoId.length > 0)
        );
      case 'details':
        return true; // Optional fields
      default:
        return false;
    }
  };

  // Wizard content (shared between Dialog and Drawer)
  const wizardContent = (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center gap-3">
          {step !== 'info' && (
            <button
              onClick={goToPreviousStep}
              className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
              {step === 'info' && 'New Video'}
              {step === 'details' && 'Details & Pricing'}
            </h2>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-xl text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">
          {step === 'info' && (
            <motion.div
              key="info"
              variants={fadeVariants}
              initial={isInitialMount.current ? false : "initial"}
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <InfoStep
                data={wizardData}
                onChange={updateWizardData}
                mainVideoFile={mainVideoFile}
                setMainVideoFile={setMainVideoFile}
                uploadProgress={mainUploadProgress}
                isUploading={isUploading}
                uploadError={uploadError}
              />
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <DetailsStep
                data={wizardData}
                onChange={updateWizardData}
                error={createError}
                stripeConnected={stripeConnected}
                stripeLoading={stripeLoading}
                canAcceptPayments={canAcceptPayments}
                onOpenStripeModal={() => setShowStripeModal(true)}
                programsApiEndpoint={programsApiEndpoint}
                previewVideoFile={previewVideoFile}
                setPreviewVideoFile={setPreviewVideoFile}
                previewUploadProgress={previewUploadProgress}
                isFetchingThumbnail={isFetchingThumbnail}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center justify-between">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= getStepIndex()
                    ? 'bg-brand-accent'
                    : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                }`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <button
            onClick={step === 'details' ? handleCreateVideo : goToNextStep}
            disabled={!canProceed() || isCreating || isUploading}
            className="flex items-center gap-2 px-5 py-2 bg-brand-accent text-white rounded-xl font-medium font-albert hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading... {mainUploadProgress}%
              </>
            ) : isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : step === 'details' ? (
              <>
                Create Video
                <Sparkles className="w-4 h-4" />
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
    </div>
  );

  // Render mobile drawer or desktop dialog
  if (isMobile) {
    return (
      <>
        <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
          <DrawerContent className="max-h-[90vh]">
            {wizardContent}
          </DrawerContent>
        </Drawer>
        <StripeConnectModal
          isOpen={showStripeModal}
          onClose={() => setShowStripeModal(false)}
          onConnected={() => refetchStripe()}
        />
        <DiscardUploadDialog
          isOpen={showDiscardDialog}
          onStay={handleDiscardCancel}
          onDiscard={handleDiscardConfirm}
          isDeleting={isDeleting}
          title="Discard Video?"
          description="You have an uploaded video that hasn't been saved. If you leave now, the video will be permanently deleted and you'll need to upload again."
        />
      </>
    );
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[100]" onClose={handleClose}>
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 z-[10001] overflow-y-auto">
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
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all">
                  {wizardContent}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      <StripeConnectModal
        isOpen={showStripeModal}
        onClose={() => setShowStripeModal(false)}
        onConnected={() => refetchStripe()}
      />
      <DiscardUploadDialog
        isOpen={showDiscardDialog}
        onStay={handleDiscardCancel}
        onDiscard={handleDiscardConfirm}
        isDeleting={isDeleting}
        title="Discard Video?"
        description="You have an uploaded video that hasn't been saved. If you leave now, the video will be permanently deleted and you'll need to upload again."
      />
    </>
  );
}

// ============================================================================
// STEP 1: Video Info
// ============================================================================
interface InfoStepProps {
  data: VideoWizardData;
  onChange: (updates: Partial<VideoWizardData>) => void;
  mainVideoFile: File | null;
  setMainVideoFile: (file: File | null) => void;
  uploadProgress: number;
  isUploading: boolean;
  uploadError: string | null;
}

function InfoStep({
  data,
  onChange,
  mainVideoFile,
  setMainVideoFile,
  uploadProgress,
  isUploading,
  uploadError,
}: InfoStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
      if (!validTypes.includes(file.type)) {
        return;
      }
      setMainVideoFile(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-4">
      {/* Video Title */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder='e.g., "Getting Started with Mindfulness"'
          className="w-full px-3 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors text-sm"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
          Description
          <span className="text-[#8c8a87] dark:text-[#8b8f9a] font-normal ml-1.5">(optional)</span>
        </label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What will viewers learn from this video?"
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors resize-none text-sm"
        />
      </div>

      {/* Video Upload */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
          Video <span className="text-red-500">*</span>
        </label>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
          onChange={handleFileChange}
          className="hidden"
        />

        {mainVideoFile ? (
          <div className="p-4 bg-[#f3f1ef] dark:bg-[#1d222b]/50 rounded-xl border border-[#e1ddd8]/60 dark:border-[#262b35]/60">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate font-albert">
                  {mainVideoFile.name}
                </p>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  {formatFileSize(mainVideoFile.size)}
                </p>
              </div>
              <button
                onClick={() => setMainVideoFile(null)}
                className="p-2 text-[#5f5a55] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Upload Progress */}
            {isUploading && uploadProgress > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-1 font-albert">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-accent rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full p-6 border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:border-brand-accent hover:bg-brand-accent/5 transition-colors cursor-pointer"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-brand-accent/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-brand-accent" />
              </div>
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Click to upload video
              </p>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                MP4, MOV, WebM, or MKV (max 2GB)
              </p>
            </div>
          </button>
        )}

        {/* Upload Error */}
        {uploadError && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs text-red-600 dark:text-red-400 font-albert">{uploadError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 2: Details & Pricing
// ============================================================================
interface DetailsStepProps {
  data: VideoWizardData;
  onChange: (updates: Partial<VideoWizardData>) => void;
  error: string | null;
  stripeConnected: boolean;
  stripeLoading: boolean;
  canAcceptPayments: boolean;
  onOpenStripeModal: () => void;
  programsApiEndpoint: string;
  previewVideoFile: File | null;
  setPreviewVideoFile: (file: File | null) => void;
  previewUploadProgress: number;
  isFetchingThumbnail: boolean;
}

function DetailsStep({
  data,
  onChange,
  error,
  stripeConnected,
  stripeLoading,
  canAcceptPayments,
  onOpenStripeModal,
  programsApiEndpoint,
  previewVideoFile,
  setPreviewVideoFile,
  previewUploadProgress,
  isFetchingThumbnail,
}: DetailsStepProps) {
  const previewInputRef = useRef<HTMLInputElement>(null);

  const handlePreviewChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
      if (validTypes.includes(file.type)) {
        setPreviewVideoFile(file);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5">
      {/* Thumbnail Option */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Thumbnail
        </label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => onChange({ thumbnailOption: 'auto' })}
            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
              data.thumbnailOption === 'auto'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <ImageIcon className={`w-4 h-4 ${data.thumbnailOption === 'auto' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className={`font-albert font-medium text-sm ${data.thumbnailOption === 'auto' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>
              Auto-generated
            </span>
          </button>
          <button
            onClick={() => onChange({ thumbnailOption: 'custom' })}
            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
              data.thumbnailOption === 'custom'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <Upload className={`w-4 h-4 ${data.thumbnailOption === 'custom' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className={`font-albert font-medium text-sm ${data.thumbnailOption === 'custom' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>
              Custom upload
            </span>
          </button>
        </div>

        {/* Thumbnail Preview or Custom Upload */}
        {data.thumbnailOption === 'auto' ? (
          <div className="p-3 bg-[#f3f1ef] dark:bg-[#1d222b]/50 rounded-xl border border-[#e1ddd8]/60 dark:border-[#262b35]/60">
            {isFetchingThumbnail ? (
              <div className="flex items-center gap-3">
                <div className="w-20 h-12 rounded-lg bg-[#e1ddd8] dark:bg-[#262b35] animate-pulse flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-[#8c8c8c]" />
                </div>
                <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                  Generating thumbnail...
                </span>
              </div>
            ) : data.thumbnailUrl ? (
              <ThumbnailWithFallback
                src={data.thumbnailUrl}
                alt="Video thumbnail"
              />
            ) : (
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Thumbnail will be generated after processing
              </p>
            )}
          </div>
        ) : (
          <input
            type="text"
            value={data.customThumbnailUrl}
            onChange={(e) => onChange({ customThumbnailUrl: e.target.value })}
            placeholder="Enter image URL..."
            className="w-full px-3 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#8c8c8c] text-sm"
          />
        )}
      </div>

      {/* Link to Programs */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
          Link to Programs
          <span className="text-[#8c8a87] dark:text-[#8b8f9a] font-normal ml-1.5">(optional)</span>
        </label>
        <ProgramSelector
          value={data.programIds}
          onChange={(programIds) => onChange({ programIds })}
          placeholder="Select programs..."
          programsApiEndpoint={programsApiEndpoint}
        />
      </div>

      {/* Pricing */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Pricing
        </label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={() => onChange({ pricing: 'free' })}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
              data.pricing === 'free'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <span className={`font-semibold text-sm ${data.pricing === 'free' ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>
              Free
            </span>
          </button>
          <button
            onClick={() => canAcceptPayments && onChange({ pricing: 'paid' })}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
              !canAcceptPayments
                ? 'opacity-50 cursor-not-allowed border-[#e1ddd8] dark:border-[#262b35]'
                : data.pricing === 'paid'
                  ? 'border-brand-accent bg-brand-accent/5'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <DollarSign className={`w-4 h-4 ${data.pricing === 'paid' && canAcceptPayments ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className={`font-semibold text-sm ${data.pricing === 'paid' && canAcceptPayments ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>
              Paid
            </span>
          </button>
        </div>

        {/* Connect Stripe prompt when Paid is disabled */}
        {!canAcceptPayments && !stripeLoading && (
          <div
            onClick={onOpenStripeModal}
            className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#f8f6f4] to-[#f3f1ef] dark:from-[#1d222b] dark:to-[#1a1f27] border border-[#e1ddd8]/60 dark:border-[#262b35]/60 cursor-pointer hover:border-brand-accent/40 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#635bff]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#635bff]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Connect Stripe for payments
              </p>
              <p className="text-xs text-[#5f5a55] dark:text-[#8b8f9a] font-albert">
                Enable paid content in seconds
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[#8c8c8c] group-hover:text-brand-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </div>
        )}

        {/* Stripe Warning & Price Input */}
        <AnimatePresence mode="wait">
          {data.pricing === 'paid' && (
            <motion.div
              key="paid-options"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2 overflow-hidden"
            >
              {!stripeLoading && !stripeConnected && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <StripeConnectWarning
                    variant="inline"
                    showCta={true}
                    message="Connect Stripe to accept payments"
                    subMessage="Set your price now — enable payments later."
                    onConnectClick={onOpenStripeModal}
                  />
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: stripeConnected ? 0 : 0.15 }}
                className="relative"
              >
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm font-medium">$</span>
                <input
                  type="number"
                  value={data.price || ''}
                  onChange={(e) => onChange({ price: Math.max(0, parseInt(e.target.value) || 0) })}
                  placeholder="29"
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent transition-colors text-sm"
                />
              </motion.div>

              {/* Preview/Trailer Video - only for paid content */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: stripeConnected ? 0.1 : 0.2 }}
              >
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1.5">
                  Preview/Trailer
                  <span className="text-[#8c8a87] dark:text-[#8b8f9a] font-normal ml-1.5">(optional)</span>
                </label>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-2 font-albert">
                  Short preview shown in the payment popup
                </p>
                <input
                  ref={previewInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={handlePreviewChange}
                  className="hidden"
                />

                {previewVideoFile ? (
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Play className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate font-albert">
                          {previewVideoFile.name}
                        </p>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          {formatFileSize(previewVideoFile.size)}
                        </p>
                      </div>
                      <button
                        onClick={() => setPreviewVideoFile(null)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => previewInputRef.current?.click()}
                    className="w-full p-3 border border-dashed border-[#e1ddd8] dark:border-[#262b35] rounded-xl hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        Add preview video
                      </span>
                    </div>
                  </button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Visibility
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onChange({ isPublic: true })}
            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
              data.isPublic
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <Globe className={`w-4 h-4 ${data.isPublic ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className={`font-albert font-medium text-sm ${data.isPublic ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>Public</span>
          </button>
          <button
            onClick={() => onChange({ isPublic: false })}
            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
              !data.isPublic
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
            }`}
          >
            <Lock className={`w-4 h-4 ${!data.isPublic ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`} />
            <span className={`font-albert font-medium text-sm ${!data.isPublic ? 'text-brand-accent' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>Private</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
        </div>
      )}
    </div>
  );
}
