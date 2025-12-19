'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, Crown, Lock, Globe, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

type SquadType = 'private' | 'public' | 'premium';

interface SquadInviteDialogProps {
  open: boolean;
  onClose: () => void;
  squadName: string;
  squadType: SquadType;
  inviteCode?: string; // Only for private squads
}

/**
 * SquadInviteDialog Component
 * 
 * Shows different invite dialogs based on squad type:
 * - Private: Shows join code + invite link
 * - Public: Shows invite link only
 * - Premium: Shows invite link with premium notice
 * 
 * Responsive: Dialog on desktop, bottom drawer on mobile
 */
export function SquadInviteDialog({ 
  open, 
  onClose, 
  squadName,
  squadType,
  inviteCode,
}: SquadInviteDialogProps) {
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate invite link when dialog opens
  useEffect(() => {
    if (open && !inviteUrl) {
      generateInviteLink();
    }
  }, [open]);

  const generateInviteLink = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/squad/invite', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate invite link');
      }
      
      const data = await response.json();
      setInviteUrl(data.inviteUrl);
    } catch (err) {
      console.error('Error generating invite link:', err);
      setError('Failed to generate invite link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!inviteCode || codeCopied) return;
    
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = inviteCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteUrl || linkCopied) return;
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    
    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${squadName} on GrowthAddicts`,
          text: getShareText(),
          url: inviteUrl,
        });
      } catch (err) {
        // User cancelled or share failed - just copy instead
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      // Fallback to copy
      handleCopyLink();
    }
  };

  const getShareText = (): string => {
    switch (squadType) {
      case 'premium':
        return `Join my Premium Squad "${squadName}" on GrowthAddicts! Get accountability coaching and grow with us.`;
      case 'private':
        return `You're invited to join my private squad "${squadName}" on GrowthAddicts!`;
      default:
        return `Join my squad "${squadName}" on GrowthAddicts and let's grow together!`;
    }
  };

  const getSquadTypeIcon = () => {
    switch (squadType) {
      case 'premium':
        return <Crown className="w-5 h-5 text-[#f7c948]" />;
      case 'private':
        return <Lock className="w-5 h-5 text-[#a07855]" />;
      default:
        return <Globe className="w-5 h-5 text-[#a07855]" />;
    }
  };

  const getTitle = (): string => {
    switch (squadType) {
      case 'premium':
        return 'Invite friends to your Premium Squad';
      case 'private':
        return 'Invite friends to your private squad';
      default:
        return 'Invite friends to your squad';
    }
  };

  const getDescription = (): string => {
    switch (squadType) {
      case 'premium':
        return 'Only Premium members can join your squad.';
      case 'private':
        return 'Share the code or link with friends you want to invite.';
      default:
        return 'Your friends will join Growth Addicts and will be automatically added to this squad.';
    }
  };

  // Content to render
  const DialogContent = () => (
    <div className="space-y-5">
      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-[12px] text-red-700 dark:text-red-300 font-albert text-[14px]">
          {error}
          <button 
            onClick={generateInviteLink}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Squad Type Badge */}
      <div className="flex items-center gap-2 p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-[12px]">
        {getSquadTypeIcon()}
        <span className="font-albert text-[14px] text-text-primary dark:text-[#f5f5f8] font-medium">
          {squadName}
        </span>
        {squadType === 'premium' && (
          <span className="ml-auto font-albert text-[11px] font-semibold bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-white px-2 py-0.5 rounded-full">
            PREMIUM
          </span>
        )}
      </div>

      {/* Description */}
      <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-relaxed">
        {getDescription()}
      </p>

      {/* Private Squad: Show Join Code */}
      {squadType === 'private' && inviteCode && (
        <div className="space-y-2">
          <label className="block font-albert font-medium text-[13px] text-text-secondary dark:text-[#b2b6c2]">
            Squad code
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#faf8f6] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-[12px] px-4 py-3 font-mono text-[18px] text-text-primary dark:text-[#f5f5f8] tracking-[2px] text-center">
              {inviteCode}
            </div>
            <button
              onClick={handleCopyCode}
              className={`flex items-center gap-2 px-4 py-3 rounded-[12px] font-albert font-semibold text-[14px] transition-all ${
                codeCopied 
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                  : 'bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] hover:bg-[#3d342d] dark:hover:bg-[#e5e5e8]'
              }`}
            >
              {codeCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Invite Link */}
      <div className="space-y-2">
        <label className="block font-albert font-medium text-[13px] text-text-secondary dark:text-[#b2b6c2]">
          Invite link
        </label>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-[#a07855] dark:text-[#b8896a] animate-spin" />
            <span className="ml-2 font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2]">
              Generating link...
            </span>
          </div>
        ) : inviteUrl ? (
          <div className="bg-[#faf8f6] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-[12px] px-4 py-3">
            <p className="font-sans text-[13px] text-text-primary dark:text-[#f5f5f8] break-all leading-relaxed">
              {inviteUrl}
            </p>
          </div>
        ) : null}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleCopyLink}
          disabled={loading || !inviteUrl}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[16px] font-albert font-semibold text-[15px] transition-all disabled:opacity-50 ${
            linkCopied 
              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
              : 'bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] hover:bg-[#3d342d] dark:hover:bg-[#e5e5e8]'
          }`}
        >
          {linkCopied ? (
            <>
              <Check className="w-4 h-4" />
              Link Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Link
            </>
          )}
        </button>
        <button
          onClick={handleShare}
          disabled={loading || !inviteUrl}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] text-text-primary dark:text-[#f5f5f8] rounded-[16px] font-albert font-semibold text-[15px] hover:bg-[#faf8f6] dark:hover:bg-[#262b35] transition-all disabled:opacity-50"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  );

  // Mobile: Bottom Drawer
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DrawerContent className="px-4 pb-8">
          <DrawerHeader className="text-left px-0 pt-4 pb-2">
            <DrawerTitle className="font-albert text-[22px] tracking-[-0.5px]">
              {getTitle()}
            </DrawerTitle>
          </DrawerHeader>
          <DialogContent />
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Dialog
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="max-w-md p-0 dark:bg-[#171b22] dark:border-[#262b35]">
        <AlertDialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="font-albert text-[22px] tracking-[-0.5px] dark:text-[#f5f5f8]">
              {getTitle()}
            </AlertDialogTitle>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
          </div>
        </AlertDialogHeader>
        <div className="p-6 pt-4">
          <DialogContent />
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

