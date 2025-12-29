'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { Search, Sparkles, ArrowRight, Users, Zap, Target } from 'lucide-react';
import type { MarketplaceListing, MarketplaceCategory } from '@/types';
import { MARKETPLACE_CATEGORIES } from '@/types';
import { CreateProgramModal } from '@/components/marketplace/CreateProgramModal';
import { CoachOnboardingOverlay } from '@/components/marketplace/CoachOnboardingOverlay';

/**
 * Public Marketplace Page
 * 
 * Discover programs, coaches, and communities
 * "Create your own" CTA opens coach signup flow
 */
export default function MarketplacePage() {
  const { user, isLoaded } = useUser();
  
  // State - using extended type with funnel info
  const [listings, setListings] = useState<(MarketplaceListing & { funnelSlug?: string | null; programSlug?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Check if user is a coach with incomplete onboarding
  const [showOnboardingOverlay, setShowOnboardingOverlay] = useState(false);
  const [onboardingState, setOnboardingState] = useState<'needs_profile' | 'needs_plan' | null>(null);
  
  // Fetch listings
  const fetchListings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      
      const response = await fetch(`/api/marketplace/listings?${params}`);
      if (response.ok) {
        const data = await response.json();
        setListings(data.listings || []);
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Check coach onboarding state when user is loaded
  useEffect(() => {
    if (!isLoaded || !user) return;
    
    const checkOnboardingState = async () => {
      try {
        // Always check via API - don't rely on potentially stale client metadata
        // The API returns isCoach: false quickly for non-coaches without extra DB queries
        const response = await fetch('/api/coach/onboarding-state');
        if (response.ok) {
          const data = await response.json();
          // Only show overlay if user IS a coach and needs to complete onboarding
          if (data.isCoach && (data.state === 'needs_profile' || data.state === 'needs_plan')) {
            setOnboardingState(data.state);
            setShowOnboardingOverlay(true);
          }
        }
      } catch (error) {
        console.error('Error checking onboarding state:', error);
      }
    };
    
    checkOnboardingState();
  }, [isLoaded, user]);

  // Filter listings by search query
  const filteredListings = useMemo(() => {
    if (!searchQuery.trim()) return listings;
    
    const query = searchQuery.toLowerCase();
    return listings.filter(listing => 
      listing.title?.toLowerCase().includes(query) ||
      listing.description?.toLowerCase().includes(query) ||
      listing.coachName?.toLowerCase().includes(query)
    );
  }, [listings, searchQuery]);

  // Handle "Create your own" click
  const handleCreateClick = () => {
    if (user) {
      // Check if user is already a coach
      const publicMetadata = user.publicMetadata as {
        role?: string;
        orgRole?: string;
        organizationId?: string;
      };
      
      if (publicMetadata?.organizationId) {
        // Already has an org, redirect to dashboard
        window.location.href = '/coach';
        return;
      }
    }
    
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#faf8f6]/95 dark:bg-[#05070b]/95 backdrop-blur-sm border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden relative">
                <Image
                  src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af"
                  alt="Growth Addicts"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <span className="font-albert text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-tight">
                Growth Addicts
              </span>
            </Link>

            {/* Auth Button */}
            {user ? (
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-full font-albert text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-full font-albert text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Log in
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#a07855]/10 dark:bg-[#b8896a]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#e8b923]/10 dark:bg-[#e8b923]/5 rounded-full blur-3xl" />
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-albert text-[42px] sm:text-[56px] lg:text-[64px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.1] mb-4">
            Discover programs<br />
            <span className="text-[#a07855] dark:text-[#b8896a]">that transform</span>
          </h1>
          
          <p className="font-sans text-[17px] sm:text-[19px] text-[#5f5a55] dark:text-[#b2b6c2] max-w-2xl mx-auto mb-8">
            Find coaches, programs, and communities built to help you grow.
            Or create your own and build something meaningful.
          </p>
          
          {/* Search + CTA Row */}
          <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search programs, coaches..."
                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-2xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:focus:border-[#b8896a] text-[16px]"
              />
            </div>
            
            {/* Create CTA */}
            <button
              onClick={handleCreateClick}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-2xl font-albert text-[16px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#e8b923]/20"
            >
              <Sparkles className="w-5 h-5" />
              Create your own
            </button>
          </div>
        </div>
      </section>

      {/* Category Pills */}
      <section className="py-4 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex-shrink-0 px-4 py-2 rounded-full font-albert text-sm transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a]'
                  : 'bg-white dark:bg-[#1e222a] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
              }`}
            >
              All
            </button>
            {MARKETPLACE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`flex-shrink-0 px-4 py-2 rounded-full font-albert text-sm transition-colors ${
                  selectedCategory === cat.value
                    ? 'bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a]'
                    : 'bg-white dark:bg-[#1e222a] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Listings Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white dark:bg-[#171b22] rounded-2xl overflow-hidden shadow-sm animate-pulse">
                  <div className="h-48 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50" />
                  <div className="p-5 space-y-3">
                    <div className="h-6 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded" />
                    <div className="h-4 w-full bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 rounded" />
                    <div className="h-4 w-2/3 bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-[#a7a39e] dark:text-[#7d8190]" />
              </div>
              <h3 className="font-albert text-[22px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                {searchQuery ? 'No matching programs' : 'No programs yet'}
              </h3>
              <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mb-6">
                {searchQuery 
                  ? 'Try adjusting your search or browse all categories'
                  : 'Be the first to create a program on the marketplace'}
              </p>
              <button
                onClick={handleCreateClick}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#a07855] dark:bg-[#b8896a] text-white rounded-xl font-albert text-sm font-medium hover:bg-[#8c6245] dark:hover:bg-[#a07855] transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Create a program
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Value Props Section */}
      <section className="py-16 bg-white dark:bg-[#0f1218] border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-albert text-[32px] sm:text-[40px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] mb-3">
              Why create on Growth Addicts?
            </h2>
            <p className="font-sans text-[16px] text-[#5f5a55] dark:text-[#b2b6c2]">
              Everything you need to build and scale your coaching business
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-gradient-to-br from-[#a07855]/20 to-[#a07855]/10 dark:from-[#b8896a]/20 dark:to-[#b8896a]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-[#a07855] dark:text-[#b8896a]" />
              </div>
              <h3 className="font-albert text-[20px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                All-in-One Program Delivery
              </h3>
              <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                Built-in tools for squads, check-ins, and accountability that keep members coming back.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-gradient-to-br from-[#e8b923]/20 to-[#e8b923]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-[#e8b923]" />
              </div>
              <h3 className="font-albert text-[20px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Simple setup
              </h3>
              <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                Launch your program in minutes. Custom funnels, branding, and payments—all in one place.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Target className="w-7 h-7 text-emerald-500" />
              </div>
              <h3 className="font-albert text-[20px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Focus on coaching
              </h3>
              <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                We handle the tech so you can focus on what matters—transforming lives.
              </p>
            </div>
          </div>
          
          {/* Bottom CTA */}
          <div className="text-center mt-12">
            <button
              onClick={handleCreateClick}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-2xl font-albert text-[16px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#e8b923]/20"
            >
              Start building today
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="font-sans text-[13px] text-[#a7a39e] dark:text-[#7d8190] mt-3">
              7-day free trial • Credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Create Program Modal */}
      <CreateProgramModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />

      {/* Coach Onboarding Overlay */}
      {showOnboardingOverlay && onboardingState && (
        <CoachOnboardingOverlay 
          state={onboardingState}
          onComplete={() => setShowOnboardingOverlay(false)}
        />
      )}
    </div>
  );
}

// Extended listing type with funnel info from API
type ListingWithFunnel = Omit<MarketplaceListing, 'customDomain'> & {
  funnelSlug?: string | null;
  programSlug?: string | null;
  customDomain?: string | null;
};

// Listing Card Component
function ListingCard({ listing }: { listing: ListingWithFunnel }) {
  // Build funnel URL - prefer custom domain over subdomain
  let funnelUrl = '/join';
  
  // Determine base URL: prefer custom domain if available, otherwise use subdomain
  const baseUrl = listing.customDomain 
    ? `https://${listing.customDomain}`
    : listing.subdomain 
      ? `https://${listing.subdomain}.growthaddicts.com`
      : null;
  
  if (baseUrl) {
    if (listing.programSlug && listing.funnelSlug) {
      // Full funnel URL with program and funnel slug
      funnelUrl = `${baseUrl}/join/${listing.programSlug}/${listing.funnelSlug}`;
    } else if (listing.funnelSlug) {
      // Funnel slug only (for non-program funnels)
      funnelUrl = `${baseUrl}/join/${listing.funnelSlug}`;
    } else {
      // Fallback to generic join page
      funnelUrl = `${baseUrl}/join`;
    }
  }
  
  return (
    <a
      href={funnelUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-white dark:bg-[#171b22] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* Cover Image */}
      <div className="relative h-48 overflow-hidden">
        {listing.coverImageUrl ? (
          <Image
            src={listing.coverImageUrl}
            alt={listing.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#a07855] to-[#8c6245]" />
        )}
        
        {/* Category badge */}
        {listing.categories && listing.categories.length > 0 && (
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-sm rounded-full text-xs font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
              {MARKETPLACE_CATEGORIES.find(c => c.value === listing.categories?.[0])?.label || listing.categories[0]}
            </span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-5">
        {/* Coach info */}
        <div className="flex items-center gap-2 mb-3">
          {listing.coachAvatarUrl ? (
            <div className="w-7 h-7 rounded-full overflow-hidden relative">
              <Image
                src={listing.coachAvatarUrl}
                alt={listing.coachName || 'Coach'}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center">
              <span className="text-xs font-albert font-semibold text-[#5f5a55] dark:text-[#b2b6c2]">
                {listing.coachName?.charAt(0) || 'C'}
              </span>
            </div>
          )}
          <span className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
            {listing.coachName || 'Coach'}
          </span>
        </div>
        
        {/* Title */}
        <h3 className="font-albert text-[18px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] leading-tight mb-2 group-hover:text-[#a07855] dark:group-hover:text-[#b8896a] transition-colors">
          {listing.title}
        </h3>
        
        {/* Description */}
        <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed line-clamp-2">
          {listing.description}
        </p>
        
        {/* CTA */}
        <div className="mt-4 flex items-center gap-1 text-[#a07855] dark:text-[#b8896a] font-albert text-sm font-medium group-hover:gap-2 transition-all">
          View program
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </a>
  );
}

