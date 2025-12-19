'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import type { FirebaseUser } from '@/types';
import { compressImage } from '@/lib/uploadProfilePicture';

interface ProfileEditFormProps {
  initialData?: Partial<FirebaseUser>;
  clerkUser?: {
    imageUrl?: string;
    firstName?: string | null;
    lastName?: string | null;
    primaryEmailAddress?: {
      emailAddress: string;
    } | null;
  } | null;
  onSave?: () => void;
  onCancel?: () => void;
  fromOnboarding?: boolean; // Special onboarding mode
}

export function ProfileEditForm({ initialData, clerkUser, onSave, onCancel, fromOnboarding: _fromOnboarding = false }: ProfileEditFormProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name || `${clerkUser?.firstName || ''} ${clerkUser?.lastName || ''}`.trim(),
    location: initialData?.location || '',
    profession: initialData?.profession || '',
    company: initialData?.company || '',
    bio: initialData?.bio || '',
    interests: initialData?.interests || '',
    instagramHandle: initialData?.instagramHandle || '',
    linkedinHandle: initialData?.linkedinHandle || '',
    twitterHandle: initialData?.twitterHandle || '',
    websiteUrl: initialData?.websiteUrl || '',
    phoneNumber: initialData?.phoneNumber || '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
    setIsLoading(true);
    setError(null);

    try {
      // Upload new avatar to Clerk if selected
      if (avatarFile && user) {
        setIsUploadingAvatar(true);
        try {
          console.log('[PROFILE] Uploading avatar to Clerk...');
          // Use Clerk's native setProfileImage API
          await user.setProfileImage({ file: avatarFile });
          console.log('[PROFILE] Clerk avatar upload successful');
        } catch (uploadError) {
          console.error('[AVATAR_UPLOAD_ERROR]', uploadError);
          throw new Error('Failed to upload profile picture. Please try again.');
        } finally {
          setIsUploadingAvatar(false);
        }
      }

      // Build request body - no need to include avatarUrl as Clerk handles it
      const requestBody: any = { 
        ...formData,
      };

      const response = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Call onSave callback which will redirect
      if (onSave) {
        onSave();
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.');
      setIsLoading(false);
    }
  };

  // Get avatar URL - prioritize preview, then Clerk, then Firebase
  const displayAvatarUrl = avatarPreview || initialData?.avatarUrl || clerkUser?.imageUrl || initialData?.imageUrl;

  return (
    <form onSubmit={handleSubmit} className="space-y-9">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[20px] p-4">
          <p className="font-sans text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Avatar Section */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-40 h-40 rounded-full bg-[#f3f1ef] overflow-hidden flex items-center justify-center">
            {displayAvatarUrl ? (
              <Image 
                src={displayAvatarUrl} 
                alt="Profile" 
                width={160}
                height={160}
                className="w-full h-full object-cover" 
              />
            ) : (
              <svg className="w-12 h-12 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          
          {/* Hidden file input */}
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
            id="avatar-upload"
            disabled={isLoading || isUploadingAvatar}
          />
          
          {/* Pencil button triggers file input */}
          <label
            htmlFor="avatar-upload"
            className={`absolute bottom-0 right-0 w-6 h-6 bg-white dark:bg-[#1e222a] rounded-full border border-[#e1ddd8] dark:border-[#262b35] flex items-center justify-center hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors ${
              isLoading || isUploadingAvatar ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {isUploadingAvatar ? (
              <svg className="w-3.5 h-3.5 text-text-secondary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            )}
          </label>
        </div>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">My name is</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Jane Doe"
            className="w-full h-[54px] px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="New York, NY, USA"
            className="w-full h-[54px] px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">Profession</label>
          <input
            type="text"
            value={formData.profession}
            onChange={(e) => handleChange('profession', e.target.value)}
            placeholder="Digital Marketer"
            className="w-full h-[54px] px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">Company</label>
          <input
            type="text"
            value={formData.company}
            onChange={(e) => handleChange('company', e.target.value)}
            placeholder="Self-employed"
            className="w-full h-[54px] px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* About Me Section */}
      <div className="space-y-4">
        <h3 className="font-albert text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
          About me
        </h3>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">My bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => handleChange('bio', e.target.value)}
            placeholder="Write a short bio"
            rows={3}
            className="w-full px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[20px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">My interests</label>
          <input
            type="text"
            value={formData.interests}
            onChange={(e) => handleChange('interests', e.target.value)}
            placeholder="What drives you?"
            className="w-full h-[54px] px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Contacts Section */}
      <div className="space-y-4">
        <h3 className="font-albert text-2xl text-text-primary tracking-[-1.5px] leading-[1.3]">
          My contacts
        </h3>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">Instagram</label>
          <input
            type="text"
            value={formData.instagramHandle}
            onChange={(e) => handleChange('instagramHandle', e.target.value)}
            placeholder="@janedoe"
            className="w-full h-[54px] px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">LinkedIn</label>
          <input
            type="text"
            value={formData.linkedinHandle}
            onChange={(e) => handleChange('linkedinHandle', e.target.value)}
            placeholder="@janedoe"
            className="w-full h-[54px] px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">X</label>
          <input
            type="text"
            value={formData.twitterHandle}
            onChange={(e) => handleChange('twitterHandle', e.target.value)}
            placeholder="@janedoe"
            className="w-full h-[54px] px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">Blog/website</label>
          <input
            type="text"
            value={formData.websiteUrl}
            onChange={(e) => handleChange('websiteUrl', e.target.value)}
            placeholder="jane.doe.com"
            className="w-full h-[54px] px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">Email</label>
          <input
            type="email"
            value={clerkUser?.primaryEmailAddress?.emailAddress || ''}
            disabled
            className="w-full h-[54px] px-4 py-3 bg-[#f3f1ef] border border-[rgba(225,221,216,0.5)] rounded-[50px] font-sans text-base text-text-primary cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label className="font-sans text-xs text-text-secondary px-4">Phone</label>
          <input
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
            placeholder="+1 (123) 456-7890"
            className="w-full h-[54px] px-4 py-3 bg-white dark:bg-[#1e222a] border border-[rgba(225,221,216,0.5)] dark:border-[#262b35] rounded-[50px] font-sans text-base text-text-primary dark:text-[#f5f5f8] placeholder:text-text-muted dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-earth-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          type="submit"
          disabled={isLoading || isUploadingAvatar}
          className="w-full py-3 px-6 bg-button-primary text-white rounded-[32px] font-sans font-bold text-base tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:bg-[#1a1a1a]/90 transition-colors disabled:opacity-50"
        >
          {isUploadingAvatar ? 'Uploading picture...' : isLoading ? 'Saving...' : 'Save'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading || isUploadingAvatar}
            className="w-full py-3 px-6 bg-white border border-[rgba(215,210,204,0.5)] text-button-primary rounded-[32px] font-sans font-bold text-base tracking-[-0.5px] hover:bg-[#f3f1ef] transition-colors disabled:opacity-50"
          >
            Preview my profile
          </button>
        )}
      </div>
    </form>
  );
}

