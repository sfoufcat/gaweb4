'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type ConfirmationModalVariant = 'default' | 'destructive' | 'warning';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationModalVariant;
  icon?: ReactNode;
  isLoading?: boolean;
}

/**
 * ConfirmationModal - Beautiful custom modal matching the archive habit style
 * 
 * Replaces native browser confirm() dialogs with a styled modal.
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  icon,
  isLoading = false,
}: ConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  // Variant-based styles
  const variantStyles = {
    default: {
      iconBg: 'bg-[#f3f1ef] dark:bg-[#1e222a]',
      iconColor: 'text-earth-900 dark:text-brand-accent',
      confirmBg: 'bg-[#2c2520] dark:bg-brand-accent hover:bg-[#1a1a1a] dark:hover:bg-brand-accent/90',
      confirmText: 'text-white',
    },
    destructive: {
      iconBg: 'bg-red-50 dark:bg-red-900/20',
      iconColor: 'text-red-600 dark:text-red-400',
      confirmBg: 'bg-red-600 dark:bg-red-600 hover:bg-red-700 dark:hover:bg-red-700',
      confirmText: 'text-white',
    },
    warning: {
      iconBg: 'bg-amber-50 dark:bg-amber-900/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      confirmBg: 'bg-amber-600 dark:bg-amber-600 hover:bg-amber-700 dark:hover:bg-amber-700',
      confirmText: 'text-white',
    },
  };

  const styles = variantStyles[variant];

  // Default icons per variant
  const defaultIcons = {
    default: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    destructive: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    warning: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  };

  const displayIcon = icon || defaultIcons[variant];

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10002] animate-backdrop-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white dark:bg-[#171b22] rounded-[24px] p-6 max-w-[400px] w-full animate-modal-zoom-in pointer-events-auto shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className={`w-14 h-14 ${styles.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <div className={styles.iconColor}>
              {displayIcon}
            </div>
          </div>
          
          {/* Title */}
          <h3 className="font-albert text-[24px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3] mb-2 text-center">
            {title}
          </h3>
          
          {/* Description */}
          {description && (
            <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.4] mb-6 text-center">
              {description}
            </p>
          )}
          
          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 px-4 bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary dark:text-[#f5f5f8] rounded-xl font-sans font-semibold text-[14px] hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 py-3 px-4 ${styles.confirmBg} ${styles.confirmText} rounded-xl font-sans font-semibold text-[14px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // Use portal to render at document body level, escaping any parent overflow:hidden
  return createPortal(modalContent, document.body);
}

/**
 * Discard confirmation modal - pre-configured for discarding content
 */
export function DiscardConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  itemName = 'post',
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName?: string;
}) {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Discard ${itemName}?`}
      description={`Are you sure you want to discard this ${itemName}? Your changes will be lost.`}
      confirmText="Discard"
      cancelText="Keep editing"
      variant="destructive"
      icon={
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      }
    />
  );
}

/**
 * Delete confirmation modal - pre-configured for delete actions
 */
export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  itemName = 'item',
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName?: string;
  isLoading?: boolean;
}) {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Delete ${itemName}?`}
      description={`Are you sure you want to delete this ${itemName}? This action cannot be undone.`}
      confirmText="Delete"
      cancelText="Cancel"
      variant="destructive"
      isLoading={isLoading}
    />
  );
}

