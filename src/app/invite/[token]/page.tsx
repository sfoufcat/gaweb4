'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Users, Crown, Lock, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';

type InviteState = 
  | 'loading' 
  | 'validating' 
  | 'needs_auth'
  | 'joining' 
  | 'premium_required' 
  | 'confirm_switch'
  | 'success' 
  | 'error'
  | 'already_member';

interface TokenPayload {
  inviterUserId: string;
  inviterSquadId: string;
  squadName: string;
  squadType: 'private' | 'public' | 'premium';
  joinCode?: string;
  requiresPremium?: boolean;
}

interface SwitchSquadInfo {
  currentSquadId: string;
  currentSquadName: string;
  newSquadName: string;
}

/**
 * Invite Landing Page
 * 
 * Handles smart invite links for all squad types:
 * - Validates the invite token/code
 * - Redirects unauthenticated users to sign-in/signup
 * - Auto-joins eligible users
 * - Shows premium upgrade modal for non-premium users trying to join premium squads
 * - Shows confirmation when switching squads
 */
export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  
  const { user, isLoaded: userLoaded } = useUser();
  const { logoUrl, appTitle } = useBrandingValues();
  
  const [state, setState] = useState<InviteState>('loading');
  const [tokenPayload, setTokenPayload] = useState<TokenPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string>('');
  const [switchInfo, setSwitchInfo] = useState<SwitchSquadInfo | null>(null);
  
  // Refs to prevent re-running validation
  const hasValidated = useRef(false);
  const isJoining = useRef(false);

  // Validate the token
  const validateToken = useCallback(async () => {
    try {
      setState('validating');
      
      const response = await fetch('/api/squad/validate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid invite link');
        setState('error');
        return null;
      }

      setTokenPayload(data.payload);
      setInviterName(data.inviterName || 'Your friend');
      return data.payload;
    } catch (err) {
      console.error('Token validation error:', err);
      setError('Failed to validate invite link. Please try again.');
      setState('error');
      return null;
    }
  }, [token]);

  // Attempt to join the squad
  const attemptJoin = useCallback(async (forceSwitch = false) => {
    if (isJoining.current && !forceSwitch) return;
    isJoining.current = true;
    
    setState('joining');
    
    try {
      const response = await fetch('/api/squad/join-by-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, forceSwitch }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle premium required case
        if (data.error === 'PREMIUM_REQUIRED') {
          setState('premium_required');
          isJoining.current = false;
          return;
        }
        
        // Handle already in different squad case - show confirmation
        if (data.error === 'ALREADY_IN_SQUAD') {
          setSwitchInfo({
            currentSquadId: data.currentSquadId,
            currentSquadName: data.currentSquadName,
            newSquadName: data.newSquadName,
          });
          setState('confirm_switch');
          isJoining.current = false;
          return;
        }

        // Handle already a member of target squad
        if (data.alreadyMember) {
          setState('already_member');
          setTimeout(() => router.push('/squad?joined=true'), 2000);
          return;
        }

        setError(data.error || 'Failed to join squad');
        setState('error');
        isJoining.current = false;
        return;
      }

      // Success!
      setState('success');
      
      // Redirect to squad page after a short delay
      // Add ?joined=true to force the squad page to refetch data
      setTimeout(() => {
        router.push('/squad?joined=true');
      }, 2000);
    } catch (err) {
      console.error('Join error:', err);
      setError('Failed to join squad. Please try again.');
      setState('error');
      isJoining.current = false;
    }
  }, [token, router]);

  // Handle switching squads (confirmed by user)
  const handleConfirmSwitch = useCallback(() => {
    attemptJoin(true);
  }, [attemptJoin]);

  // Main effect - validate token once user is loaded
  useEffect(() => {
    if (!userLoaded) return;
    if (hasValidated.current) return;
    
    hasValidated.current = true;
    
    const init = async () => {
      const payload = await validateToken();
      
      if (!payload) return; // Error already handled
      
      if (!user) {
        // User not signed in - show auth options
        setState('needs_auth');
        // Store token in sessionStorage for after auth
        sessionStorage.setItem('pendingInviteToken', token);
        return;
      }

      // User is authenticated - attempt to join
      attemptJoin();
    };
    
    init();
  }, [userLoaded, user, validateToken, attemptJoin, token]);

  // Handle sign in (for existing users)
  const handleSignIn = () => {
    sessionStorage.setItem('pendingInviteToken', token);
    router.push(`/sign-in?redirect_url=/invite/${token}`);
  };

  // Handle create account (for new users - goes to full onboarding)
  const handleCreateAccount = () => {
    sessionStorage.setItem('pendingInviteToken', token);
    router.push('/start');
  };

  // Handle premium upgrade
  const handleUpgrade = () => {
    router.push(`/upgrade-premium?redirectAfterUpgrade=/invite/${token}`);
  };

  // Get squad type icon
  const getSquadTypeIcon = () => {
    if (!tokenPayload) return null;
    
    switch (tokenPayload.squadType) {
      case 'premium':
        return <Crown className="w-6 h-6 text-[#f7c948]" />;
      case 'private':
        return <Lock className="w-6 h-6 text-[#a07855]" />;
      default:
        return <Users className="w-6 h-6 text-[#a07855]" />;
    }
  };

  // Get squad type label
  const getSquadTypeLabel = () => {
    if (!tokenPayload) return '';
    
    switch (tokenPayload.squadType) {
      case 'premium':
        return 'Premium Squad';
      case 'private':
        return 'Private Squad';
      default:
        return 'Public Squad';
    }
  };

  // Loading/Validating state - CENTERED properly
  if (state === 'loading' || state === 'validating' || !userLoaded) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-4 mx-auto w-12 h-12">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
          </div>
          <p className="text-text-secondary font-sans text-[15px]">
            {state === 'validating' ? 'Validating invite...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Logo Header */}
        <motion.div 
          className="pt-8 pb-4 px-6 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Image 
            src={logoUrl} 
            alt={appTitle} 
            width={56} 
            height={56} 
            className="rounded-lg"
            unoptimized
          />
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-md mx-auto">
            <AnimatePresence mode="wait">
              {/* Error State */}
              {state === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h1 className="font-albert text-[28px] text-text-primary tracking-[-1px] mb-3">
                    Invalid Invite Link
                  </h1>
                  <p className="font-sans text-[16px] text-text-secondary mb-8">
                    {error || 'This invite link is invalid or has expired.'}
                  </p>
                  <button
                    onClick={() => router.push('/')}
                    className="bg-[#2c2520] text-white font-sans font-bold text-[16px] py-4 px-8 rounded-[32px] hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    Go to Home
                  </button>
                </motion.div>
              )}

              {/* Needs Auth State - User not signed in */}
              {state === 'needs_auth' && tokenPayload && (
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center"
                >
                  {/* Squad Card */}
                  <div className="bg-white rounded-[24px] p-6 border border-[#e1ddd8] shadow-lg mb-8">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      {getSquadTypeIcon()}
                      <span className="font-sans text-[13px] text-text-secondary font-medium">
                        {getSquadTypeLabel()}
                      </span>
                    </div>
                    <h2 className="font-albert text-[24px] text-text-primary tracking-[-0.5px] mb-2">
                      {tokenPayload.squadName}
                    </h2>
                    <p className="font-sans text-[15px] text-text-secondary">
                      {inviterName} invited you to join their squad
                    </p>
                  </div>

                  <h1 className="font-albert text-[28px] text-text-primary tracking-[-1px] mb-3">
                    Join the Squad
                  </h1>
                  <p className="font-sans text-[16px] text-text-secondary mb-8">
                    Sign in or create an account to accept this invitation.
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={handleSignIn}
                      className="w-full bg-[#2c2520] text-white font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={handleCreateAccount}
                      className="w-full bg-white border border-[#e1ddd8] text-text-primary font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] hover:bg-[#faf8f6] active:scale-[0.98] transition-all"
                    >
                      Create Account
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Joining State */}
              {state === 'joining' && tokenPayload && (
                <motion.div
                  key="joining"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-[#faf8f6] rounded-full flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-8 h-8 text-[#a07855] animate-spin" />
                  </div>
                  <h1 className="font-albert text-[28px] text-text-primary tracking-[-1px] mb-3">
                    Joining {tokenPayload.squadName}...
                  </h1>
                  <p className="font-sans text-[16px] text-text-secondary">
                    Just a moment...
                  </p>
                </motion.div>
              )}

              {/* Confirm Squad Switch State */}
              {state === 'confirm_switch' && tokenPayload && switchInfo && (
                <motion.div
                  key="confirm_switch"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                  </div>
                  <h1 className="font-albert text-[28px] text-text-primary tracking-[-1px] mb-3">
                    Switch Squads?
                  </h1>
                  <p className="font-sans text-[16px] text-text-secondary mb-6">
                    You&apos;re currently a member of <span className="font-semibold text-text-primary">{switchInfo.currentSquadName}</span>.
                  </p>
                  
                  {/* Warning Card */}
                  <div className="bg-amber-50 rounded-[16px] p-4 border border-amber-200 mb-8 text-left">
                    <p className="font-sans text-[14px] text-amber-800">
                      By joining <span className="font-semibold">{switchInfo.newSquadName}</span>, you will automatically leave{' '}
                      <span className="font-semibold">{switchInfo.currentSquadName}</span>.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleConfirmSwitch}
                      className="w-full bg-[#2c2520] text-white font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
                    >
                      Switch to {tokenPayload.squadName}
                    </button>
                    <button
                      onClick={() => router.push('/squad')}
                      className="w-full bg-white border border-[#e1ddd8] text-text-primary font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] hover:bg-[#faf8f6] active:scale-[0.98] transition-all"
                    >
                      Keep Current Squad
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Premium Required State */}
              {state === 'premium_required' && tokenPayload && (
                <motion.div
                  key="premium"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center"
                >
                  {/* Premium Badge */}
                  <div className="w-16 h-16 bg-gradient-to-br from-[#f7c948] to-[#f5b820] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Crown className="w-8 h-8 text-white" />
                  </div>

                  <h1 className="font-albert text-[28px] text-text-primary tracking-[-1px] mb-3">
                    Join {inviterName}&apos;s Premium Squad
                  </h1>
                  <p className="font-sans text-[16px] text-text-secondary mb-6">
                    To join this squad, you need a Premium membership.
                  </p>

                  {/* Squad Card */}
                  <div className="bg-white rounded-[20px] p-5 border border-[#e1ddd8] mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#f7c948] to-[#f5b820] rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-albert text-[18px] font-semibold text-text-primary">
                          {tokenPayload.squadName}
                        </h3>
                        <p className="font-sans text-[13px] text-text-secondary">
                          Premium Squad with dedicated coach
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleUpgrade}
                      className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
                    >
                      Upgrade to Premium
                    </button>
                    <button
                      onClick={() => router.push('/')}
                      className="w-full text-text-secondary font-sans font-medium text-[14px] py-3 hover:text-text-primary transition-colors"
                    >
                      Maybe later
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Already Member State */}
              {state === 'already_member' && tokenPayload && (
                <motion.div
                  key="already_member"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Users className="w-8 h-8 text-green-600" />
                  </div>
                  <h1 className="font-albert text-[28px] text-text-primary tracking-[-1px] mb-3">
                    You&apos;re already a member!
                  </h1>
                  <p className="font-sans text-[16px] text-text-secondary mb-2">
                    You&apos;re already part of <span className="font-semibold text-text-primary">{tokenPayload.squadName}</span>
                  </p>
                  <p className="font-sans text-[14px] text-text-secondary">
                    Redirecting to your squad...
                  </p>
                </motion.div>
              )}

              {/* Success State */}
              {state === 'success' && tokenPayload && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center"
                >
                  <motion.div 
                    className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                  >
                    <motion.svg 
                      className="w-8 h-8 text-green-500" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={3}
                    >
                      <motion.path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M5 13l4 4L19 7"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      />
                    </motion.svg>
                  </motion.div>
                  <h1 className="font-albert text-[28px] text-text-primary tracking-[-1px] mb-3">
                    Welcome to the Squad! 🎉
                  </h1>
                  <p className="font-sans text-[16px] text-text-secondary mb-2">
                    You&apos;ve joined <span className="font-semibold text-text-primary">{tokenPayload.squadName}</span>
                  </p>
                  <p className="font-sans text-[14px] text-text-secondary">
                    Redirecting to your squad...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
