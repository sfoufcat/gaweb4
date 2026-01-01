'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useSignUp, useClerk } from '@clerk/nextjs';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ArrowRight, 
  ArrowLeft,
  Users, 
  Zap, 
  Target,
  Check,
  Sparkles,
  TrendingUp,
  BarChart3,
  MessageSquare,
  Loader2,
  Mail,
  Lock,
  User
} from 'lucide-react';
import { OAuthButton, VerificationCodeInput } from '@/components/auth';

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af';

interface CoachQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type QuizStep = 'why' | 'clients' | 'frustration' | 'impact' | 'match' | 'signup' | 'verification' | 'creating' | 'existing_coach';

type ClientCount = '0-5' | '5-20' | '20-50' | '50+' | null;

type Frustration = 
  | 'clients_dont_implement'
  | 'cant_prove_roi'
  | 'no_accountability_tracking'
  | 'too_much_followup'
  | 'group_loses_feel';

const FRUSTRATION_OPTIONS: { id: Frustration; label: string }[] = [
  { id: 'clients_dont_implement', label: 'Clients consume but don\'t implement' },
  { id: 'cant_prove_roi', label: 'I can\'t prove my coaching actually works' },
  { id: 'no_accountability_tracking', label: 'Community platforms don\'t track accountability' },
  { id: 'too_much_followup', label: 'I spend too much time on follow-ups' },
  { id: 'group_loses_feel', label: 'Group programs lose the 1:1 feel' },
];

type ImpactFeature = 
  | 'track_progress'
  | 'squad_accountability'
  | 'daily_habits'
  | 'engagement_visibility'
  | 'automated_delivery'
  | 'personal_group';

const IMPACT_OPTIONS: { id: ImpactFeature; label: string }[] = [
  { id: 'track_progress', label: 'Tracking client progress automatically' },
  { id: 'squad_accountability', label: 'Squad accountability groups' },
  { id: 'daily_habits', label: 'Daily habits & check-ins' },
  { id: 'engagement_visibility', label: 'Seeing who\'s actually engaged' },
  { id: 'automated_delivery', label: 'Automated program delivery' },
  { id: 'personal_group', label: 'Group coaching that feels personal' },
];

const CLIENT_OPTIONS: { value: ClientCount; label: string; sublabel: string }[] = [
  { value: '0-5', label: 'Just starting', sublabel: '0-5 clients' },
  { value: '5-20', label: 'Building momentum', sublabel: '5-20 clients' },
  { value: '20-50', label: 'Scaling up', sublabel: '20-50 clients' },
  { value: '50+', label: 'At capacity', sublabel: '50+ clients' },
];

export function CoachQuizModal({ isOpen, onClose }: CoachQuizModalProps) {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { signUp, isLoaded: signUpLoaded, setActive } = useSignUp();
  const { signOut } = useClerk();
  
  const [step, setStep] = useState<QuizStep>('why');
  const [clientCount, setClientCount] = useState<ClientCount>(null);
  const [frustrations, setFrustrations] = useState<Set<Frustration>>(new Set());
  const [impactFeatures, setImpactFeatures] = useState<Set<ImpactFeature>>(new Set());
  
  // Signup state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  // Detect mobile for animation
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('why');
      setClientCount(null);
      setFrustrations(new Set());
      setError(null);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setVerificationCode('');
    }
  }, [isOpen]);

  const toggleFrustration = (id: Frustration) => {
    setFrustrations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleImpactFeature = (id: ImpactFeature) => {
    setImpactFeatures(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Save quiz data to database
  const saveQuizData = async (userEmail: string, userName?: string) => {
    try {
      // Get referral code from URL if present
      const urlParams = new URLSearchParams(window.location.search);
      const referralCode = urlParams.get('ref') || urlParams.get('referral');
      const source = urlParams.get('utm_source') || document.referrer || undefined;

      const response = await fetch('/api/quiz-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          name: userName,
          clientCount: clientCount || '',
          frustrations: Array.from(frustrations),
          impactFeatures: Array.from(impactFeatures),
          referralCode,
          source,
        }),
      });

      if (!response.ok) {
        console.warn('[CoachQuizModal] Failed to save quiz data:', await response.text());
      } else {
        const data = await response.json();
        console.log('[CoachQuizModal] Quiz data saved:', data.leadId);
        
        // Store lead ID for later conversion tracking
        if (data.leadId) {
          localStorage.setItem('ga_quiz_lead_id', data.leadId);
        }
      }
    } catch (err) {
      console.warn('[CoachQuizModal] Error saving quiz data:', err);
      // Don't block signup on quiz save failure
    }
  };

  // Store quiz data in localStorage for OAuth flow (retrieved after redirect)
  const storeQuizDataForOAuth = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const quizData = {
      clientCount,
      frustrations: Array.from(frustrations),
      impactFeatures: Array.from(impactFeatures),
      referralCode: urlParams.get('ref') || urlParams.get('referral'),
      source: urlParams.get('utm_source') || document.referrer || undefined,
    };
    localStorage.setItem('ga_quiz_data', JSON.stringify(quizData));
  };

  const handleNext = () => {
    if (step === 'why') setStep('clients');
    else if (step === 'clients' && clientCount) setStep('frustration');
    else if (step === 'frustration' && frustrations.size > 0) setStep('impact');
    else if (step === 'impact' && impactFeatures.size > 0) setStep('match');
  };

  const handleBack = () => {
    if (step === 'clients') setStep('why');
    else if (step === 'frustration') setStep('clients');
    else if (step === 'impact') setStep('frustration');
    else if (step === 'match') setStep('impact');
    else if (step === 'signup') setStep('match');
    else if (step === 'verification') setStep('signup');
  };

  // Handle "Create my platform" click
  const handleCreatePlatform = async () => {
    if (!userLoaded) return;
    
    if (user) {
      // Check if user already has an organization
      const metadata = user.publicMetadata as { primaryOrganizationId?: string; organizationId?: string };
      const existingOrgId = metadata?.primaryOrganizationId || metadata?.organizationId;
      
      if (existingOrgId) {
        // User is already a coach - fetch their subdomain to redirect
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
      // Store quiz data in localStorage for retrieval after OAuth redirect
      storeQuizDataForOAuth();
      
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/coach/complete-signup',
        unsafeMetadata: { coachSignup: true },
      });
    } catch (err: unknown) {
      console.error('OAuth error:', err);
      const clerkError = err as { errors?: Array<{ message?: string }> };
      setError(clerkError.errors?.[0]?.message || 'Failed to sign up with Google');
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
      // Save quiz data before signup
      await saveQuizData(email, `${firstName} ${lastName}`.trim() || undefined);
      
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
      
      setStep('verification');
    } catch (err: unknown) {
      console.error('Signup error:', err);
      const clerkError = err as { errors?: Array<{ longMessage?: string }>, message?: string };
      setError(clerkError.errors?.[0]?.longMessage || clerkError.message || 'Failed to create account');
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
        
        // Create org
        setStep('creating');
        await createCoachOrganization();
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: unknown) {
      console.error('Verification error:', err);
      const clerkError = err as { errors?: Array<{ longMessage?: string }>, message?: string };
      setError(clerkError.errors?.[0]?.longMessage || clerkError.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Create coach organization
  const createCoachOrganization = async () => {
    setError(null);
    setIsLoading(true);
    
    try {
      // Send quiz data for personalized abandoned cart emails
      const response = await fetch('/api/coach/create-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizData: {
            clientCount,
            frustrations: Array.from(frustrations),
            impactFeatures: Array.from(impactFeatures),
          },
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }
      
      // Redirect to coach onboarding profile page
      router.push('/coach/onboarding/profile');
      onClose();
    } catch (err: unknown) {
      console.error('Create org error:', err);
      const error = err as { message?: string };
      setError(error.message || 'Failed to create organization');
      setStep('match'); // Go back to allow retry
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total steps for progress bar (quiz steps only, signup is separate flow)
  const quizSteps = ['why', 'clients', 'frustration', 'impact', 'match'];
  const isQuizStep = quizSteps.includes(step);
  const stepIndex = quizSteps.indexOf(step);

  // Value props for step 1
  const valueProps = [
    {
      icon: BarChart3,
      title: 'See who\'s doing the work',
      description: 'Alignment scores show exactly which clients are engaged: no more guessing',
    },
    {
      icon: Target,
      title: 'Built for transformation',
      description: 'Daily Focus, habits, and streaks keep clients accountable between sessions',
    },
    {
      icon: Users,
      title: 'Scale without losing quality',
      description: 'Squad accountability makes group coaching as effective as 1:1',
    },
  ];

  // Compute animation props based on device
  const mobileAnimation = {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
  };
  
  const desktopAnimation = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  };

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
          
          {/* Modal - Desktop: centered popup, Mobile: bottom sheet */}
          <motion.div
            {...(isMobile ? mobileAnimation : desktopAnimation)}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={
              isMobile 
                ? "fixed inset-x-0 bottom-0 z-50 pointer-events-none"
                : "fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            }
          >
            <div className={`w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-[#171b22] shadow-2xl pointer-events-auto ${
              isMobile ? 'rounded-t-3xl' : 'sm:w-[480px] rounded-3xl'
            }`}>
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-[#f3f1ef] dark:bg-[#1e222a] hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Progress bar - only show for quiz steps */}
              {isQuizStep && (
                <div className="px-6 pt-6">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          i <= stepIndex 
                            ? 'bg-brand-accent' 
                            : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <AnimatePresence mode="wait">
                {/* Step 1: Why GrowthAddicts */}
                {step === 'why' && (
                  <motion.div
                    key="why"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    <div className="text-center mb-6">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-4 relative">
                        <Image
                          src={LOGO_URL}
                          alt="GrowthAddicts"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <h2 className="font-albert text-[26px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]">
                        Why GrowthAddicts?
                      </h2>
                      <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                        Built for coaches who want results, not just engagement
                      </p>
                    </div>
                    
                    <div className="space-y-4 mb-8">
                      {valueProps.map((prop, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex gap-4 items-start p-4 bg-[#faf8f6] dark:bg-[#1e222a] rounded-2xl"
                        >
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#262b35] flex items-center justify-center flex-shrink-0 shadow-sm">
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
                        </motion.div>
                      ))}
                    </div>
                    
                    <button
                      onClick={handleNext}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20"
                    >
                      Let's see if we're a match
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}

                {/* Step 2: Client Count */}
                {step === 'clients' && (
                  <motion.div
                    key="clients"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    
                    <div className="text-center mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <TrendingUp className="w-7 h-7 text-white" />
                      </div>
                      <h2 className="font-albert text-[26px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]">
                        How many clients do you coach?
                      </h2>
                      <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                        This helps us understand your needs
                      </p>
                    </div>
                    
                    <div className="space-y-3 mb-8">
                      {CLIENT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setClientCount(option.value)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            clientCount === option.value
                              ? 'border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10'
                              : 'border-[#e1ddd8] dark:border-[#313746] hover:border-[#c5bfb8] dark:hover:border-[#3d4452]'
                          }`}
                        >
                          <div className="text-left">
                            <p className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                              {option.label}
                            </p>
                            <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                              {option.sublabel}
                            </p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            clientCount === option.value
                              ? 'border-brand-accent bg-brand-accent'
                              : 'border-[#c5bfb8] dark:border-[#3d4452]'
                          }`}>
                            {clientCount === option.value && (
                              <Check className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={handleNext}
                      disabled={!clientCount}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}

                {/* Step 3: Frustrations */}
                {step === 'frustration' && (
                  <motion.div
                    key="frustration"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    
                    <div className="text-center mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-7 h-7 text-white" />
                      </div>
                      <h2 className="font-albert text-[26px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]">
                        What frustrates you most?
                      </h2>
                      <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                        Select all that apply
                      </p>
                    </div>
                    
                    <div className="space-y-3 mb-8">
                      {FRUSTRATION_OPTIONS.map((option) => {
                        const isSelected = frustrations.has(option.id);
                        return (
                          <button
                            key={option.id}
                            onClick={() => toggleFrustration(option.id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                              isSelected
                                ? 'border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10'
                                : 'border-[#e1ddd8] dark:border-[#313746] hover:border-[#c5bfb8] dark:hover:border-[#3d4452]'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected
                                ? 'border-brand-accent bg-brand-accent'
                                : 'border-[#c5bfb8] dark:border-[#3d4452]'
                            }`}>
                              {isSelected && (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <p className="font-sans text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                              {option.label}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={handleNext}
                      disabled={frustrations.size === 0}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}

                {/* Step 4: Impact Features */}
                {step === 'impact' && (
                  <motion.div
                    key="impact"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    
                    <div className="text-center mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-7 h-7 text-white" />
                      </div>
                      <h2 className="font-albert text-[26px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]">
                        What would make the biggest impact?
                      </h2>
                      <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                        Select all that apply
                      </p>
                    </div>
                    
                    <div className="space-y-3 mb-8">
                      {IMPACT_OPTIONS.map((option) => {
                        const isSelected = impactFeatures.has(option.id);
                        return (
                          <button
                            key={option.id}
                            onClick={() => toggleImpactFeature(option.id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                              isSelected
                                ? 'border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10'
                                : 'border-[#e1ddd8] dark:border-[#313746] hover:border-[#c5bfb8] dark:hover:border-[#3d4452]'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected
                                ? 'border-brand-accent bg-brand-accent'
                                : 'border-[#c5bfb8] dark:border-[#3d4452]'
                            }`}>
                              {isSelected && (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <p className="font-sans text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                              {option.label}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={handleNext}
                      disabled={impactFeatures.size === 0}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      See my results
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}

                {/* Step 5: Match */}
                {step === 'match' && (
                  <motion.div
                    key="match"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    
                    <div className="text-center mb-6">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}
                        className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/30"
                      >
                        <Check className="w-10 h-10 text-white" />
                      </motion.div>
                      <motion.h2 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="font-albert text-[28px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]"
                      >
                        You're a perfect match!
                      </motion.h2>
                      <motion.p 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2"
                      >
                        GrowthAddicts was built for coaches exactly like you
                      </motion.p>
                    </div>
                    
                    {/* Summary of their answers */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="bg-[#faf8f6] dark:bg-[#1e222a] rounded-2xl p-5 mb-6"
                    >
                      <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
                        Based on your answers, here's what you'll get:
                      </p>
                      <ul className="space-y-2.5">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="font-sans text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                            <strong>Alignment Scores</strong> — see exactly who's doing the work
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="font-sans text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                            <strong>Daily Focus + Habits</strong> — accountability that sticks
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="font-sans text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                            <strong>Squad Groups</strong> — peer pressure that works
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="font-sans text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                            <strong>Built-in Payments</strong> — monetize on day one
                          </span>
                        </li>
                      </ul>
                    </motion.div>
                    
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      onClick={handleCreatePlatform}
                      disabled={!userLoaded}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {!userLoaded ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          Create my platform
                        </>
                      )}
                    </motion.button>
                    
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="text-center font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190] mt-4"
                    >
                      7-day free trial • Credit card required • Cancel anytime
                    </motion.p>
                  </motion.div>
                )}

                {/* Step 5: Signup */}
                {step === 'signup' && (
                  <motion.div
                    key="signup"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    
                    <div className="text-center mb-6">
                      <Image 
                        src={LOGO_URL}
                        alt="GrowthAddicts"
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-xl mx-auto mb-4 shadow-md"
                        unoptimized
                      />
                      <h2 className="font-albert text-[24px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                        Create your account
                      </h2>
                      <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                        Start building your coaching platform
                      </p>
                    </div>
                    
                    {error && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
                        <p className="font-sans text-[13px] text-red-600 dark:text-red-400">{error}</p>
                      </div>
                    )}
                    
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
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[15px] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#e8b923]/20"
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
                    
                    <div className="mt-6 pt-4 border-t border-[#e1ddd8]/50 dark:border-[#313746]/50 text-center">
                      <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                        Already have an account?{' '}
                        <a href="/sign-in" className="text-brand-accent hover:underline font-medium">
                          Sign in
                        </a>
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Step 6: Verification */}
                {step === 'verification' && (
                  <motion.div
                    key="verification"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    
                    <div className="text-center mb-6">
                      <Image 
                        src={LOGO_URL}
                        alt="GrowthAddicts"
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-xl mx-auto mb-4 shadow-md"
                        unoptimized
                      />
                      <h2 className="font-albert text-[24px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                        Check your email
                      </h2>
                      <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                        We sent a code to {email}
                      </p>
                    </div>
                    
                    {error && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
                        <p className="font-sans text-[13px] text-red-600 dark:text-red-400">{error}</p>
                      </div>
                    )}
                    
                    <form onSubmit={handleVerification} className="space-y-4">
                      <VerificationCodeInput
                        value={verificationCode}
                        onChange={setVerificationCode}
                        autoFocus
                        disabled={isLoading}
                      />
                      
                      <button
                        type="submit"
                        disabled={isLoading || verificationCode.length < 6}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[15px] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#e8b923]/20"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            Verify & continue
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setStep('signup')}
                        className="w-full text-center font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
                      >
                        Use a different email
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* Step 7: Creating */}
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

                {/* Step: Existing Coach */}
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
                      <button
                        onClick={async () => {
                          await fetch('/api/coach/onboarding-state', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'needs_profile', force: true }),
                          });
                          router.push('/coach/onboarding/profile');
                          onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20"
                      >
                        Continue as {user?.firstName}
                        <ArrowRight className="w-5 h-5" />
                      </button>
                      
                      <p className="text-center font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190] pt-2">
                        Want to use a different account?{' '}
                        <button 
                          onClick={async () => {
                            // Sign out and stay on current page
                            // Use '/' as redirect since we're on the landing page
                            await signOut({ redirectUrl: '/' });
                            setStep('signup');
                          }}
                          className="text-brand-accent hover:underline"
                        >
                          Log out
                        </button>
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
