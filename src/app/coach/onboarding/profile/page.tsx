'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { 
  User, 
  ArrowRight,
  Camera,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { compressImage } from '@/lib/uploadProfilePicture';

/**
 * Coach Onboarding - Profile Setup Page
 * 
 * Step 1 of coach onboarding: Complete your coaching profile.
 * - Organization/business name
 * - Profile photo
 * - Brief description
 */
export default function OnboardingProfilePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from user data
  useEffect(() => {
    if (!isLoaded || !user) return;
    
    // Use user's name as default business name (only if empty)
    if (!businessName) {
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
      if (fullName) {
        setBusinessName(`${fullName}'s Coaching`);
      }
    }
    
    // Use existing avatar if available AND no local file has been selected
    // This prevents overwriting the user's selected file preview when Clerk refreshes
    if (user.imageUrl && !avatarFile) {
      setAvatarPreview(user.imageUrl);
      setAvatarUrl(user.imageUrl);
    }
  }, [isLoaded, user]); // Keep dependencies minimal - only run on auth state changes

  // Check onboarding state
  useEffect(() => {
    if (!isLoaded || !user) return;
    
    const checkState = async () => {
      try {
        const response = await fetch('/api/coach/onboarding-state');
        if (response.ok) {
          const data = await response.json();
          
          // If not a coach, redirect to marketplace
          if (!data.isCoach) {
            router.push('/marketplace');
            return;
          }
          
          // If already past profile step, redirect appropriately
          if (data.state === 'needs_plan') {
            router.push('/coach/onboarding/plans');
            return;
          }
          
          if (data.state === 'active') {
            // Fetch tenant URL to redirect to subdomain (needed on marketing domain)
            try {
              const tenantRes = await fetch('/api/user/tenant-domains');
              if (tenantRes.ok) {
                const tenantData = await tenantRes.json();
                const ownerDomain = tenantData.tenantDomains?.find((d: { isOwner?: boolean }) => d.isOwner);
                if (ownerDomain?.tenantUrl) {
                  window.location.href = `${ownerDomain.tenantUrl}/coach`;
                  return;
                }
              }
            } catch (e) {
              console.error('Error fetching tenant URL:', e);
            }
            // Fallback: stay on marketing domain, go to plans page
            router.push('/coach/onboarding/plans');
            return;
          }
        }
      } catch (err) {
        console.error('Error checking onboarding state:', err);
      }
    };
    
    checkState();
  }, [isLoaded, user, router]);

  // Handle avatar file selection
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    try {
      setError(null);
      // Compress image before preview
      const compressedFile = await compressImage(file, 800, 800, 0.85);
      setAvatarFile(compressedFile);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      console.error('[AVATAR_COMPRESS_ERROR]', err);
      setError('Failed to process image. Please try another file.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!businessName.trim()) {
      setError('Please enter your business name');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      let finalAvatarUrl = avatarUrl;
      
      // Upload new avatar to Clerk if selected
      if (avatarFile && user) {
        setIsUploadingAvatar(true);
        try {
          console.log('[ONBOARDING] Uploading avatar to Clerk...');
          await user.setProfileImage({ file: avatarFile });
          // Get the updated image URL after upload
          await user.reload();
          finalAvatarUrl = user.imageUrl || avatarUrl;
          console.log('[ONBOARDING] Clerk avatar upload successful');
        } catch (uploadErr) {
          console.error('[ONBOARDING] Avatar upload failed:', uploadErr);
          // Continue without avatar update - not critical
        } finally {
          setIsUploadingAvatar(false);
        }
      }
      
      // Save profile data
      const response = await fetch('/api/coach/onboarding/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          description: description.trim(),
          avatarUrl: finalAvatarUrl,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }
      
      // Move to next step
      router.push('/coach/onboarding/plans');
    } catch (err) {
      console.error('Profile save error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || !user) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#faf8f6] to-[#f5f2ed] dark:from-[#0a0c10] dark:to-[#11141b] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-accent/20 border-t-[#a07855] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#faf8f6] to-[#f5f2ed] dark:from-[#0a0c10] dark:to-[#11141b] overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#faf8f6]/95 dark:bg-[#0a0c10]/95 backdrop-blur-sm border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden relative">
              <Image
                src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af"
                alt="Coachful"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <span className="font-albert text-[18px] font-bold tracking-[-0.5px] text-[#1a1a1a] dark:text-[#f5f5f8]">
              Coachful
            </span>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center">
              <span className="text-white text-sm font-bold">1</span>
            </div>
            <div className="w-8 h-1 bg-[#e1ddd8] dark:bg-[#313746] rounded-full" />
            <div className="w-8 h-8 rounded-full bg-[#e1ddd8] dark:bg-[#313746] flex items-center justify-center">
              <span className="text-[#5f5a55] dark:text-[#7d8190] text-sm font-bold">2</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-brand-accent/20 to-[#b8896a]/10 dark:from-[#b8896a]/20 dark:to-brand-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <User className="w-8 h-8 text-brand-accent" />
          </div>
          
          <h1 className="font-albert text-[32px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] mb-3">
            Set up your profile
          </h1>
          <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">
            Tell us about your coaching business. This will appear on your public profile.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Avatar Upload */}
          <div className="flex flex-col items-center mb-8">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-28 h-28 rounded-full overflow-hidden cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
              
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt="Profile"
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-[#f3f1ef] dark:bg-[#1e222a] flex items-center justify-center">
                  <User className="w-12 h-12 text-[#a7a39e] dark:text-[#7d8190]" />
                </div>
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
              
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <p className="mt-2 font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190]">
              Click to upload
            </p>
          </div>

          {/* Business Name */}
          <div>
            <label className="block font-sans text-[13px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              Business or coaching name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g., Sarah's Fitness Coaching"
              required
              className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-sans text-[15px] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 dark:focus:ring-brand-accent/30 focus:border-brand-accent dark:focus:border-brand-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-sans text-[13px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              Short bio <span className="text-[#a7a39e] dark:text-[#7d8190]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell potential clients what you do and who you help..."
              rows={3}
              maxLength={200}
              className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-sans text-[15px] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 dark:focus:ring-brand-accent/30 focus:border-brand-accent dark:focus:border-brand-accent resize-none"
            />
            <p className="mt-1 font-sans text-[11px] text-[#a7a39e] dark:text-[#7d8190] text-right">
              {description.length}/200
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="font-sans text-[13px] text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !businessName.trim()}
            className="w-full flex items-center justify-center gap-2 py-4 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-albert text-[16px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </motion.form>

        {/* Skip hint */}
        <p className="mt-6 text-center font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190]">
          You can always update this later from your dashboard settings.
        </p>
      </div>
    </div>
  );
}
