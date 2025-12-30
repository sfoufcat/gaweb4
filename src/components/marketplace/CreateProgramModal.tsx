'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useSignUp } from '@clerk/nextjs';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Sparkles, 
  Users, 
  Zap, 
  Target,
  ArrowRight,
  Check,
  Loader2,
  Mail,
  Lock,
  User
} from 'lucide-react';
import { OAuthButton, VerificationCodeInput } from '@/components/auth';

interface CreateProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalStep = 'persuasion' | 'signup' | 'creating' | 'existing_coach';

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af';

/**
 * Create Program Modal
 * 
 * Multi-step modal flow:
 * 1. Persuasion - Value props and benefits
 * 2. Signup - Create account (if not logged in)
 * 3. Creating - Organization creation in progress
 */
export function CreateProgramModal({ isOpen, onClose }: CreateProgramModalProps) {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { signUp, isLoaded: signUpLoaded, setActive } = useSignUp();
  
  const [step, setStep] = useState<ModalStep>('persuasion');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  
  // Signup form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  // Existing coach state
  const [existingCoachUrl, setExistingCoachUrl] = useState<string | null>(null);
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('persuasion');
      setError(null);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setPendingVerification(false);
      setVerificationCode('');
    }
  }, [isOpen]);
  
  // Handle "Get Started" click
  const handleGetStarted = async () => {
    if (!userLoaded) return;
    
    if (user) {
      // Check if user already has an organization
      const metadata = user.publicMetadata as { organizationId?: string };
      
      if (metadata?.organizationId) {
        // User is already a coach - fetch their subdomain to redirect
        try {
          const response = await fetch('/api/user/tenant-domains');
          if (response.ok) {
            const data = await response.json();
            const ownerDomain = data.tenantDomains?.find((d: { isOwner?: boolean }) => d.isOwner);
            if (ownerDomain?.tenantUrl) {
              setExistingCoachUrl(ownerDomain.tenantUrl);
            }
          }
        } catch (e) {
          console.error('Error fetching tenant domains:', e);
        }
        setStep('existing_coach');
        return;
      }
      
      // User is logged in but not a coach yet, create their organization
      setStep('creating');
      await createCoachOrganization();
    } else {
      // Show signup form
      setStep('signup');
    }
  };
  
  // Handle Google OAuth signup
  const handleGoogleSignUp = async () => {
    if (!signUpLoaded || !signUp) return;
    setOauthLoading(true);
    setError(null);

    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/coach/complete-signup',
        unsafeMetadata: { coachSignup: true },
      });
    } catch (err: any) {
      console.error('OAuth error:', err);
      setError(err.errors?.[0]?.message || 'Failed to sign up with Google');
      setOauthLoading(false);
    }
  };
  
  // Handle signup form submission
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Create the signup
      await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
        unsafeMetadata: { coachSignup: true },
      });
      
      // Prepare email verification
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });
      
      setPendingVerification(true);
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.errors?.[0]?.longMessage || err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle email verification
  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp) return;
    
    setError(null);
    setIsLoading(true);
    
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });
      
      if (completeSignUp.status === 'complete') {
        // Set the session
        await setActive({ session: completeSignUp.createdSessionId });
        
        // Immediately redirect to complete-signup page which handles org creation
        // This mirrors the OAuth flow and prevents any Clerk-triggered redirects
        onClose();
        router.push('/coach/complete-signup');
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.errors?.[0]?.longMessage || err.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create coach organization
  const createCoachOrganization = async () => {
    setError(null);
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/coach/create-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Will use default name from user's name
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }
      
      // Redirect to coach onboarding profile page
      router.push('/coach/onboarding/profile');
      onClose();
    } catch (err: any) {
      console.error('Create org error:', err);
      setError(err.message || 'Failed to create organization');
      setStep('persuasion'); // Go back to allow retry
    } finally {
      setIsLoading(false);
    }
  };
  
  const valueProps = [
    {
      icon: Users,
      title: 'Build a profitable info business',
      description: 'Masterminds, check-ins, accountability and programs that keep members coming back',
    },
    {
      icon: Zap,
      title: 'Launch in minutes',
      description: 'Custom funnels, branded experience, and built-in payments',
    },
    {
      icon: Target,
      title: 'Focus on transformation',
      description: 'We handle the tech so you can focus on changing lives',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-lg bg-white dark:bg-[#171b22] rounded-3xl shadow-2xl overflow-hidden pointer-events-auto max-h-[90vh] overflow-y-auto">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-[#f3f1ef] dark:bg-[#1e222a] hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              
              <AnimatePresence mode="wait">
                {/* Step 1: Persuasion */}
                {step === 'persuasion' && (
                  <motion.div
                    key="persuasion"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Header with logo */}
                    <div className="pt-8 pb-6 px-6 text-center">
                      <Image 
                        src={LOGO_URL}
                        alt="Growth Addicts"
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-2xl mx-auto mb-5 shadow-lg"
                        unoptimized
                      />
                      <h2 className="font-albert text-[28px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]">
                        Create your program
                      </h2>
                      <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                        Join coaches building thriving communities
                      </p>
                    </div>
                    
                    {/* Value props */}
                    <div className="px-6 pb-2 space-y-4">
                      {valueProps.map((prop, i) => (
                        <div key={i} className="flex gap-4 items-start">
                          <div className="w-10 h-10 rounded-xl bg-[#f3f1ef] dark:bg-[#1e222a] flex items-center justify-center flex-shrink-0">
                            <prop.icon className="w-5 h-5 text-brand-accent" />
                          </div>
                          <div>
                            <h4 className="font-albert text-[15px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                              {prop.title}
                            </h4>
                            <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                              {prop.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* CTA */}
                    <div className="px-6 py-6">
                      <button
                        onClick={handleGetStarted}
                        disabled={!userLoaded}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] dark:bg-none dark:bg-[#b8896a] dark:hover:bg-[#a07855] dark:text-white rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#e8b923]/20 dark:shadow-[#b8896a]/20"
                      >
                        {!userLoaded ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            Get started free
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                      <p className="text-center font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190] mt-3">
                        7-day free trial • Credit card required
                      </p>
                    </div>
                  </motion.div>
                )}
                
                {/* Step 2: Signup */}
                {step === 'signup' && (
                  <motion.div
                    key="signup"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Header with logo */}
                    <div className="pt-6 px-6">
                      <button
                        onClick={() => setStep('persuasion')}
                        className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors mb-4"
                      >
                        ← Back
                      </button>
                      
                      <div className="text-center mb-6">
                        <Image 
                          src={LOGO_URL}
                          alt="Growth Addicts"
                          width={56}
                          height={56}
                          className="w-14 h-14 rounded-xl mx-auto mb-4 shadow-md"
                          unoptimized
                        />
                        <h2 className="font-albert text-[24px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                          {pendingVerification ? 'Check your email' : 'Create your account'}
                        </h2>
                        <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                          {pendingVerification 
                            ? `We sent a code to ${email}`
                            : 'Start building your coaching program'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Form */}
                    <div className="px-6 pb-6">
                      {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
                          <p className="font-sans text-[13px] text-red-600 dark:text-red-400">{error}</p>
                        </div>
                      )}
                      
                      {!pendingVerification ? (
                        <>
                          {/* Google OAuth */}
                          <OAuthButton
                            provider="google"
                            onClick={handleGoogleSignUp}
                            disabled={isLoading}
                            loading={oauthLoading}
                          />
                          
                          {/* Divider */}
                          <div className="flex items-center gap-4 my-6">
                            <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#313746]" />
                            <span className="font-sans text-sm text-[#a7a39e] dark:text-[#7d8190]">or</span>
                            <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#313746]" />
                          </div>
                          
                          <form onSubmit={handleSignup} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 block">
                                  First name
                                </label>
                                <div className="relative">
                                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a7a39e] dark:text-[#7d8190]" />
                                  <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    required
                                    placeholder="Alex"
                                    className="w-full pl-10 pr-3 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-sans text-[14px] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 dark:focus:ring-brand-accent/30 focus:border-brand-accent dark:focus:border-brand-accent"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 block">
                                  Last name
                                </label>
                                <input
                                  type="text"
                                  value={lastName}
                                  onChange={(e) => setLastName(e.target.value)}
                                  required
                                  placeholder="Smith"
                                  className="w-full px-3 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-sans text-[14px] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 dark:focus:ring-brand-accent/30 focus:border-brand-accent dark:focus:border-brand-accent"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 block">
                                Email
                              </label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a7a39e] dark:text-[#7d8190]" />
                                <input
                                  type="email"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  required
                                  placeholder="alex@example.com"
                                  className="w-full pl-10 pr-3 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-sans text-[14px] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 dark:focus:ring-brand-accent/30 focus:border-brand-accent dark:focus:border-brand-accent"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] mb-1.5 block">
                                Password
                              </label>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a7a39e] dark:text-[#7d8190]" />
                                <input
                                  type="password"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  required
                                  minLength={8}
                                  placeholder="••••••••"
                                  className="w-full pl-10 pr-3 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-sans text-[14px] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 dark:focus:ring-brand-accent/30 focus:border-brand-accent dark:focus:border-brand-accent"
                                />
                              </div>
                            </div>
                            
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] dark:bg-none dark:bg-[#b8896a] dark:hover:bg-[#a07855] dark:text-white rounded-full font-sans font-bold text-[15px] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#e8b923]/20 dark:shadow-[#b8896a]/20"
                            >
                              {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <>
                                  Continue
                                  <ArrowRight className="w-4 h-4" />
                                </>
                              )}
                            </button>
                          </form>
                        </>
                      ) : (
                        <motion.form 
                          onSubmit={handleVerification} 
                          className="space-y-4"
                          initial="hidden"
                          animate="visible"
                          variants={{
                            hidden: { opacity: 0 },
                            visible: {
                              opacity: 1,
                              transition: {
                                staggerChildren: 0.08,
                                delayChildren: 0.1,
                              },
                            },
                          }}
                        >
                          <motion.div
                            variants={{
                              hidden: { opacity: 0, y: 12 },
                              visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
                            }}
                          >
                            <VerificationCodeInput
                              value={verificationCode}
                              onChange={setVerificationCode}
                              autoFocus
                              disabled={isLoading}
                            />
                          </motion.div>
                          
                          <motion.button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] dark:bg-none dark:bg-[#b8896a] dark:hover:bg-[#a07855] dark:text-white rounded-full font-sans font-bold text-[15px] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#e8b923]/20 dark:shadow-[#b8896a]/20"
                            variants={{
                              hidden: { opacity: 0, y: 12 },
                              visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
                            }}
                          >
                            {isLoading ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <>
                                Verify & continue
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </motion.button>
                          
                          <motion.button
                            type="button"
                            onClick={() => setPendingVerification(false)}
                            className="w-full text-center font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
                            variants={{
                              hidden: { opacity: 0 },
                              visible: { opacity: 1, transition: { duration: 0.3, delay: 0.1 } },
                            }}
                          >
                            Use a different email
                          </motion.button>
                        </motion.form>
                      )}
                      
                      <div className="mt-6 pt-4 border-t border-[#e1ddd8]/50 dark:border-[#313746]/50 text-center">
                        <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                          Already have an account?{' '}
                          <a href="/sign-in" className="text-brand-accent hover:underline font-medium">
                            Sign in
                          </a>
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                {/* Step 3: Creating */}
                {step === 'creating' && (
                  <motion.div
                    key="creating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-16 px-6"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-brand-accent to-brand-accent rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Sparkles className="w-8 h-8 text-white" />
                      </div>
                      <h2 className="font-albert text-[24px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px] mb-2">
                        Setting things up...
                      </h2>
                      <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2]">
                        Creating your coaching workspace
                      </p>
                      
                      <div className="mt-8 space-y-3 max-w-xs mx-auto">
                        {[
                          { text: 'Creating organization', done: true },
                          { text: 'Setting up workspace', done: true },
                          { text: 'Preparing dashboard', done: false },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-3 text-left">
                            {item.done ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              </div>
                            ) : (
                              <Loader2 className="w-5 h-5 text-brand-accent animate-spin" />
                            )}
                            <span className={`font-sans text-[14px] ${
                              item.done 
                                ? 'text-[#5f5a55] dark:text-[#b2b6c2]' 
                                : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                            }`}>
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                
                {/* Step 4: Existing Coach */}
                {step === 'existing_coach' && (
                  <motion.div
                    key="existing_coach"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Header */}
                    <div className="pt-8 pb-6 px-6 text-center">
                      <Image 
                        src={user?.imageUrl || LOGO_URL}
                        alt={user?.firstName || 'Coach'}
                        width={72}
                        height={72}
                        className="w-18 h-18 rounded-full mx-auto mb-5 shadow-lg border-4 border-white dark:border-[#262b35]"
                        unoptimized
                      />
                      <h2 className="font-albert text-[28px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]">
                        Welcome back, {user?.firstName || 'Coach'}!
                      </h2>
                      <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                        You already have a program in progress
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="px-6 pb-8 space-y-3">
                      {/* Continue to existing program - always stay on marketing domain for onboarding */}
                      <button
                        onClick={async () => {
                          // Ensure onboarding doc exists for existing coaches (who were grandfathered as 'active')
                          // This creates the doc with 'needs_profile' so they can go through the flow
                          await fetch('/api/coach/onboarding-state', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'needs_profile', force: true }),
                          });
                          router.push('/coach/onboarding/profile');
                          onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] dark:bg-none dark:bg-[#b8896a] dark:hover:bg-[#a07855] dark:text-white rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20 dark:shadow-[#b8896a]/20"
                      >
                        Continue as {user?.firstName}
                        <ArrowRight className="w-5 h-5" />
                      </button>
                      
                      <p className="text-center font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190] pt-2">
                        Want to create another program?{' '}
                        <a href="mailto:support@growthaddicts.com" className="text-brand-accent hover:underline">
                          Contact us
                        </a>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
