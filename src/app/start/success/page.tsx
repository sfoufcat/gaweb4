'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Script from 'next/script';
import { useGuestSession } from '@/hooks/useGuestSession';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshData, saveData, sessionId } = useGuestSession();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      // Check for embedded checkout flow (PaymentIntent)
      const paymentIntentId = searchParams.get('payment_intent');
      const redirectStatus = searchParams.get('redirect_status');
      
      // Check for traditional checkout flow (Checkout Session)
      const stripeSessionId = searchParams.get('session_id');
      
      // Determine which flow we're handling
      const isEmbeddedCheckout = paymentIntentId && redirectStatus;
      const isCheckoutSession = stripeSessionId;
      
      if (!isEmbeddedCheckout && !isCheckoutSession) {
        setStatus('error');
        setError('No payment information found. Please try again.');
        return;
      }

      // For embedded checkout, check redirect status first
      if (isEmbeddedCheckout && redirectStatus !== 'succeeded') {
        setStatus('error');
        setError(`Payment was not successful. Status: ${redirectStatus}`);
        return;
      }

      try {
        let result;
        
        if (isEmbeddedCheckout) {
          // Verify via PaymentIntent (embedded checkout)
          const response = await fetch('/api/guest/verify-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              paymentIntentId,
              guestSessionId: sessionId, // Pass the guest session ID from cookie
            }),
          });
          result = await response.json();
        } else {
          // Verify via Checkout Session (traditional checkout)
          const response = await fetch('/api/guest/verify-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: stripeSessionId }),
          });
          result = await response.json();
        }

        if (!result.success) {
          setStatus('error');
          setError(result.error || 'Payment verification failed.');
          return;
        }

        // Payment successful!
        setEmail(result.email);
        setPlan(result.plan);
        setStatus('success');

        // Save the current step as create-account so if user drops off, they'll be redirected back here
        await saveData({ currentStep: 'create-account' });

        // Refresh guest session data to get updated payment info
        await refreshData();

        // Redirect to welcome animation after a short delay
        setTimeout(() => {
          router.push('/start/welcome');
        }, 3000);

      } catch (err) {
        console.error('Verification error:', err);
        setStatus('error');
        setError('Failed to verify payment. Please contact support.');
      }
    };

    verifyPayment();
  }, [searchParams, refreshData, saveData, router, sessionId]);

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Logo Header - centered */}
        <motion.div 
          className="pt-8 pb-4 px-6 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Image 
            src="/logo.jpg" 
            alt="GrowthAddicts" 
            width={56} 
            height={56} 
            className="rounded-lg"
          />
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto text-center">
            {status === 'loading' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="relative mb-6 mx-auto w-16 h-16">
                  <div className="w-16 h-16 rounded-full border-2 border-[#e1ddd8]" />
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
                </div>
                <h1 className="font-albert text-[32px] lg:text-[40px] text-text-primary tracking-[-2px] leading-[1.15] mb-4">
                  Verifying your payment...
                </h1>
                <p className="font-sans text-[17px] text-text-secondary">
                  Please wait while we confirm your subscription.
                </p>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* Success checkmark */}
                <motion.div 
                  className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center mb-8 shadow-lg"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                >
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>

                <h1 className="font-albert text-[36px] lg:text-[48px] text-text-primary tracking-[-2px] leading-[1.15] mb-4">
                  <span className="bg-gradient-to-r from-[#a07855] via-[#d4a574] to-[#a07855] bg-clip-text text-transparent">
                    Payment successful!
                  </span>
                </h1>
                
                <p className="font-sans text-[17px] lg:text-[19px] text-text-secondary tracking-[-0.3px] leading-[1.4] mb-8">
                  Welcome to GrowthAddicts{plan === 'premium' ? ' Premium' : ''}!<br />
                  Now let's create your account.
                </p>

                {email && (
                  <motion.div 
                    className="bg-[#faf8f6] rounded-2xl p-4 border border-[#e1ddd8] mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <p className="font-sans text-[14px] text-text-muted mb-1">Your email</p>
                    <p className="font-sans text-[16px] font-semibold text-text-primary">{email}</p>
                  </motion.div>
                )}

                <motion.div 
                  className="flex items-center justify-center gap-2 text-text-secondary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="w-5 h-5 rounded-full border-2 border-[#a07855] border-t-transparent animate-spin" />
                  <span className="font-sans text-[14px]">Redirecting to account setup...</span>
                </motion.div>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* Error icon */}
                <div className="mx-auto w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-8">
                  <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>

                <h1 className="font-albert text-[32px] lg:text-[40px] text-text-primary tracking-[-2px] leading-[1.15] mb-4">
                  Something went wrong
                </h1>
                
                <p className="font-sans text-[17px] text-text-secondary mb-8">
                  {error}
                </p>

                <button
                  onClick={() => router.push('/start/plan')}
                  className="bg-[#2c2520] text-white font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-8 rounded-[32px] hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  Try again
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Meta Pixel Code */}
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '1347713597075016');
          fbq('track', 'PageView');
          fbq('track', 'Purchase');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: 'none' }} alt=""
          src="https://www.facebook.com/tr?id=1347713597075016&ev=PageView&noscript=1"
        />
      </noscript>

      {/* Google tag (gtag.js) */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-16653181105"
        strategy="afterInteractive"
      />
      <Script id="google-gtag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-16653181105');
        `}
      </Script>
    </div>
  );
}

/**
 * Guest Success Page
 * Shown after successful Stripe checkout, before account creation
 */
export default function GuestSuccessPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}

