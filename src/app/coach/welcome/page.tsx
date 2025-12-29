'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Check,
  ArrowRight,
  Palette,
  Users,
  Rocket,
  LayoutDashboard,
  Loader2,
} from 'lucide-react';

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af';

/**
 * Coach Welcome Page
 * 
 * Shown after a coach completes their subscription payment.
 * Provides a quick orientation and first steps checklist.
 */
export default function CoachWelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  
  const [isProcessing, setIsProcessing] = useState(true);
  const [orgName, setOrgName] = useState<string>('');
  
  // Get session ID from URL (from Stripe redirect)
  const sessionId = searchParams?.get('session_id');
  
  // Process payment completion and update onboarding state
  useEffect(() => {
    const processPaymentCompletion = async () => {
      if (!isLoaded || !user) return;
      
      try {
        // Get org name from user metadata
        const publicMetadata = user.publicMetadata as {
          organizationId?: string;
          primaryOrganizationId?: string;
        };
        
        const organizationId = publicMetadata?.organizationId || publicMetadata?.primaryOrganizationId;
        
        if (organizationId) {
          // Fetch org settings to get the name
          try {
            const response = await fetch('/api/coach/settings');
            if (response.ok) {
              const data = await response.json();
              setOrgName(data.settings?.displayName || data.settings?.organizationName || '');
            }
          } catch (err) {
            console.error('Failed to fetch org settings:', err);
          }
        }
        
        // Update onboarding state to active
        await fetch('/api/coach/onboarding-state', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });
        
      } catch (error) {
        console.error('Error processing payment completion:', error);
      } finally {
        setIsProcessing(false);
      }
    };
    
    processPaymentCompletion();
  }, [isLoaded, user, sessionId]);
  
  const handleGoToDashboard = () => {
    router.push('/coach');
  };
  
  // First steps - branding is now done in the post-payment modal
  const firstSteps = [
    {
      icon: Rocket,
      title: 'Create your first program',
      description: 'Build a transformation program for your clients',
      action: '/coach?tab=programs',
    },
    {
      icon: Users,
      title: 'Set up a funnel',
      description: 'Create a landing page to attract new members',
      action: '/coach?tab=funnels',
    },
    {
      icon: Palette,
      title: 'Customize more branding',
      description: 'Add dark mode colors, horizontal logo, and more',
      action: '/coach?tab=customize',
    },
  ];
  
  if (!isLoaded || isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#faf8f6] to-[#f5f2ed] dark:from-[#0a0c10] dark:to-[#11141b] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-accent mx-auto mb-4" />
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-sans">
            Setting up your workspace...
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#faf8f6] to-[#f5f2ed] dark:from-[#0a0c10] dark:to-[#11141b]">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl" />
      </div>
      
      <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          {/* Logo */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl rotate-6 opacity-20" />
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
              <Image
                src={LOGO_URL}
                alt="Growth Addicts"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
              <Check className="w-5 h-5 text-white" />
            </div>
          </div>
          
          <h1 className="font-albert text-[36px] sm:text-[44px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] mb-4">
            Welcome to Growth Addicts! 🎉
          </h1>
          
          <p className="font-sans text-[17px] text-[#5f5a55] dark:text-[#b2b6c2] max-w-lg mx-auto">
            {orgName ? (
              <>Your coaching workspace <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{orgName}</span> is ready.</>
            ) : (
              <>Your coaching workspace is ready. Let&apos;s build something amazing.</>
            )}
          </p>
        </motion.div>
        
        {/* Trial Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-6 mb-10"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-albert text-[16px] font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
                Your 7-day free trial has started
              </h3>
              <p className="font-sans text-[14px] text-emerald-700 dark:text-emerald-300/80">
                You have full access to all features. Explore, create, and launch your first program risk-free.
              </p>
            </div>
          </div>
        </motion.div>
        
        {/* First Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-10"
        >
          <h2 className="font-albert text-[22px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-6 text-center">
            Get started in 3 simple steps
          </h2>
          
          <div className="space-y-4">
            {firstSteps.map((step, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                onClick={() => router.push(step.action)}
                className="w-full flex items-center gap-4 p-5 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent dark:hover:border-brand-accent transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-[#f3f1ef] dark:bg-[#1e222a] flex items-center justify-center flex-shrink-0 group-hover:bg-brand-accent/10 dark:group-hover:bg-brand-accent/10 transition-colors">
                  <step.icon className="w-6 h-6 text-brand-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] group-hover:text-brand-accent transition-colors">
                    {step.title}
                  </h3>
                  <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    {step.description}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190] group-hover:text-brand-accent group-hover:translate-x-1 transition-all flex-shrink-0" />
              </motion.button>
            ))}
          </div>
        </motion.div>
        
        {/* Go to Dashboard CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center"
        >
          <button
            onClick={handleGoToDashboard}
            className="inline-flex items-center gap-2 px-8 py-4 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#a07855]/20"
          >
            <LayoutDashboard className="w-5 h-5" />
            Go to your dashboard
          </button>
          
          <p className="font-sans text-[13px] text-[#a7a39e] dark:text-[#7d8190] mt-4">
            You can always access these steps from your dashboard
          </p>
        </motion.div>
      </div>
    </div>
  );
}


