'use client';

import { useEffect, useState } from 'react';
import { useUser, SignOutButton } from '@clerk/nextjs';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { PauseCircle, LogOut, RefreshCw } from 'lucide-react';

/**
 * Platform Deactivated Page
 * 
 * Shown to members when the coach's subscription is inactive.
 * Does NOT expose billing details - just shows a friendly message
 * that the platform is temporarily unavailable.
 */
export default function PlatformDeactivatedPage() {
  const { user, isLoaded } = useUser();
  const { appTitle } = useBrandingValues();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Platform name from branding, coach info not available in branding context
  const platformName = appTitle || 'This platform';
  const coachDisplayName = 'The coach';
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Call API to check current subscription status (bypasses cached session)
      const response = await fetch('/api/subscription/check-status');
      const data = await response.json();

      if (data.isActive && data.redirectTo) {
        // Subscription is now active - redirect to dashboard
        window.location.href = data.redirectTo;
        return;
      }

      // Still inactive - reload the page to refresh any other state
      window.location.reload();
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      // Fall back to simple reload
      window.location.reload();
    }
  };
  
  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon - Pause symbol to indicate temporary state */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <PauseCircle className="w-10 h-10 text-amber-500 dark:text-amber-400" strokeWidth={1.5} />
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Platform Temporarily Unavailable
        </h1>
        
        {/* Description - friendly, non-alarming */}
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
          {platformName} is currently undergoing maintenance.
        </p>
        
        <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-8">
          {coachDisplayName} is working on getting things back up and running.
          Please check back soon!
        </p>
        
        {/* User info */}
        {isLoaded && user && (
          <div className="bg-[#f5f2ef] dark:bg-[#11141b] rounded-xl p-4 mb-6">
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Signed in as{' '}
              <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                {user.primaryEmailAddress?.emailAddress}
              </span>
            </p>
          </div>
        )}
        
        {/* Actions */}
        <div className="space-y-3">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-medium rounded-xl transition-colors font-albert disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Checking...' : 'Check Again'}
          </button>
          
          {/* Contact coach button removed - email not available in branding context */}
          
          {/* Sign out */}
          <SignOutButton>
            <button className="flex items-center justify-center gap-2 w-full px-6 py-3 text-[#8c8c8c] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] font-medium rounded-xl transition-colors font-albert">
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </SignOutButton>
        </div>
        
        {/* Help text */}
        <p className="mt-8 text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
          Your account and data are safe. The platform will be back soon.
        </p>
      </div>
    </div>
  );
}

