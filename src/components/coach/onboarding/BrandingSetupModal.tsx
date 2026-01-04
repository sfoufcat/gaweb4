'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import confetti from 'canvas-confetti';
import {
  Upload,
  Palette,
  Loader2,
  Check,
  Sparkles,
  ArrowRight,
  Pencil,
} from 'lucide-react';

const GA_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=78f383ba-0074-4375-985c-f623e8c90d70';

// Preset accent colors for easy selection
const PRESET_COLORS = [
  { name: 'Coachful Brown', value: '#a07855' },
  { name: 'Ocean Blue', value: '#3b82f6' },
  { name: 'Emerald Green', value: '#10b981' },
  { name: 'Royal Purple', value: '#8b5cf6' },
  { name: 'Coral Red', value: '#ef4444' },
  { name: 'Amber Gold', value: '#f59e0b' },
  { name: 'Rose Pink', value: '#ec4899' },
  { name: 'Slate Gray', value: '#64748b' },
];

interface BrandingSetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
  businessName?: string;
}

export function BrandingSetupModal({ isOpen, onComplete, businessName }: BrandingSetupModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confettiTriggered = useRef(false);
  
  // Form state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState('#a07855');
  const [customColor, setCustomColor] = useState('#a07855');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);

  // Trigger confetti on mount
  useEffect(() => {
    if (isOpen && !confettiTriggered.current) {
      confettiTriggered.current = true;
      
      // Celebration confetti burst
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = [
        '#a07855',  // Brand color
        '#FFD700',  // Gold
        '#FF6B6B',  // Coral red
        '#4ECDC4',  // Teal
        '#A855F7',  // Purple
        '#F472B6',  // Pink
      ];

      (function frame() {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors,
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();

      // Hide confetti message after delay
      setTimeout(() => setShowConfetti(false), 3500);
    }
  }, [isOpen]);

  // Handle logo file selection
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, etc.)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
    setError(null);

    // Upload the logo
    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/org/branding/logo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload logo');
      }

      const data = await response.json();
      setLogoUrl(data.url);
    } catch (err) {
      console.error('Error uploading logo:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
      setLogoPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Helper to redirect to coach dashboard on the correct domain
  const redirectToCoachDashboard = async () => {
    try {
      const tenantRes = await fetch('/api/user/tenant-domains');
      if (tenantRes.ok) {
        const tenantData = await tenantRes.json();
        const ownerDomain = tenantData.tenantDomains?.find((d: { isOwner?: boolean }) => d.isOwner);
        if (ownerDomain?.tenantUrl) {
          window.location.href = `${ownerDomain.tenantUrl}/?tour=true`;
          return;
        }
      }
    } catch (e) {
      console.error('Error fetching tenant URL:', e);
    }
    // Fallback: stay on marketing domain - this shouldn't happen in normal flow
    // but if it does, go to profile page which can re-check state
    console.error('Could not find tenant URL for redirect after branding setup');
    router.push('/coach/onboarding/profile');
  };

  // Handle saving branding and continuing
  const handleContinue = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Save branding settings
      const response = await fetch('/api/org/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: logoUrl || undefined,
          colors: {
            accentLight: accentColor,
            accentDark: accentColor, // Use same for dark mode initially
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save branding');
      }

      // Navigate to dashboard with tour
      onComplete();
      await redirectToCoachDashboard();
    } catch (err) {
      console.error('Error saving branding:', err);
      setError(err instanceof Error ? err.message : 'Failed to save branding');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle skip (use defaults)
  const handleSkip = async () => {
    onComplete();
    await redirectToCoachDashboard();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#1a1e26] rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header with celebration */}
          <div className="relative px-6 pt-8 pb-4 text-center overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-0 left-1/4 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="absolute top-0 right-1/4 w-32 h-32 bg-brand-accent/10 rounded-full blur-3xl" />
            </div>

            {/* Success icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
              className="relative w-20 h-20 mx-auto mb-4"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl rotate-6 opacity-20" />
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-lg border-2 border-emerald-500/30">
                <Image
                  src={GA_LOGO_URL}
                  alt="Coachful"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg"
              >
                <Check className="w-5 h-5 text-white" />
              </motion.div>
            </motion.div>

            {/* Congratulations text */}
            <AnimatePresence mode="wait">
              {showConfetti ? (
                <motion.div
                  key="congrats"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <h2 className="font-albert text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    🎉 Congratulations!
                  </h2>
                  <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    Your 7-day free trial has started
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="setup"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2 className="font-albert text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    Set up your brand
                  </h2>
                  <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    Make it yours with a logo and brand color
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Form content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showConfetti ? 0.3 : 1 }}
            transition={{ delay: showConfetti ? 0 : 0.3 }}
            className="px-6 pb-6 space-y-6"
          >
            {/* Logo Upload */}
            <div className="text-center">
              <label className="block font-sans text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                Your Logo
              </label>
              <div className="flex flex-col items-center gap-2">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  className="hidden"
                />
                {/* Clickable logo preview */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="relative w-20 h-20 rounded-xl border-2 border-dashed border-[#e1ddd8] dark:border-[#313746] flex items-center justify-center overflow-hidden bg-[#f9f8f7] dark:bg-[#171b22] cursor-pointer hover:border-brand-accent dark:hover:border-brand-accent transition-colors disabled:cursor-not-allowed group"
                >
                  {logoPreview || logoUrl ? (
                    <>
                      <Image
                        src={logoPreview || logoUrl || ''}
                        alt="Logo preview"
                        fill
                        className="object-contain p-2"
                        unoptimized
                      />
                      {/* Pencil overlay on hover */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Pencil className="w-5 h-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <Upload className="w-6 h-6 text-[#a7a39e] dark:text-[#7d8190] group-hover:text-brand-accent transition-colors" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                    </div>
                  )}
                </button>
                <p className="font-sans text-xs text-[#a7a39e] dark:text-[#7d8190]">
                  Square image, PNG or JPG, max 5MB
                </p>
              </div>
            </div>

            {/* Accent Color */}
            <div className="text-center">
              <label className="block font-sans text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                <Palette className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                Brand Accent Color
              </label>
              
              {/* Color presets */}
              <div className="flex flex-wrap justify-center gap-2 mb-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      setAccentColor(color.value);
                      setCustomColor(color.value);
                    }}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      accentColor === color.value
                        ? 'ring-2 ring-offset-2 ring-[#1a1a1a] dark:ring-white dark:ring-offset-[#1a1e26] scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>

              {/* Custom color input */}
              <div className="flex items-center justify-center gap-3">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    setAccentColor(e.target.value);
                  }}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomColor(value);
                    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                      setAccentColor(value);
                    }
                  }}
                  placeholder="#a07855"
                  className="flex-1 max-w-[200px] py-2 px-3 border border-[#e1ddd8] dark:border-[#313746] rounded-lg font-mono text-sm bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                />
              </div>

              {/* Preview */}
              <div className="mt-3 p-3 rounded-xl bg-[#f9f8f7] dark:bg-[#171b22]">
                <p className="font-sans text-xs text-[#5f5a55] dark:text-[#b2b6c2] mb-2">
                  Preview:
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    className="py-2 px-4 rounded-full text-white text-sm font-medium"
                    style={{ backgroundColor: accentColor }}
                  >
                    Sample Button
                  </button>
                  <span
                    className="text-sm font-medium"
                    style={{ color: accentColor }}
                  >
                    Accent Text
                  </span>
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                <p className="font-sans text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleContinue}
                disabled={isSaving || showConfetti}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#FFD036] hover:bg-[#f5c520] text-[#1a1a1a] rounded-full font-sans font-bold text-base transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue to Dashboard
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                onClick={handleSkip}
                disabled={isSaving || showConfetti}
                className="w-full py-2 font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors disabled:opacity-50"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


