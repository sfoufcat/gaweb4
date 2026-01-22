'use client';

import { createPortal } from 'react-dom';
import { X, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getIntegrationErrorMessage } from '@/lib/integrations/error-messages';
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from '@/lib/integrations/types';

interface IntegrationErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  provider: IntegrationProvider | null;
  errorCode: string | null;
}

export function IntegrationErrorModal({
  isOpen,
  onClose,
  onRetry,
  provider,
  errorCode,
}: IntegrationErrorModalProps) {
  if (!isOpen || !errorCode) return null;
  if (typeof document === 'undefined') return null;

  const errorMessage = getIntegrationErrorMessage(errorCode);
  const providerName = provider ? INTEGRATION_PROVIDERS[provider]?.name || provider : 'Integration';

  const handleRetry = () => {
    onClose();
    onRetry();
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
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
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>

          <h2 className="font-albert text-[22px] font-bold text-text-primary dark:text-[#f5f5f8] mb-2">
            {errorMessage.title}
          </h2>

          <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
            {errorMessage.description}
          </p>
        </div>

        {/* Action guidance */}
        <div className="px-6 pb-4">
          <div className="bg-[#faf8f6] dark:bg-[#0a0c10] rounded-xl p-4">
            <p className="font-sans text-[13px] text-text-secondary dark:text-[#b2b6c2]">
              {errorMessage.action}
            </p>
          </div>
        </div>

        {/* Provider info */}
        <div className="px-6 pb-2">
          <p className="font-sans text-[12px] text-text-tertiary dark:text-[#6b7280] text-center">
            Connecting to {providerName}
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 pt-4 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Dismiss
          </Button>
          <Button
            onClick={handleRetry}
            className="flex-1"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
