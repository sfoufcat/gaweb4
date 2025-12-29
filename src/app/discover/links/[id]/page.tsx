'use client';

import { use, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { ContentLandingPage } from '@/components/discover';
import { BackButton } from '@/components/discover';
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, AlertCircle, ExternalLink, CheckCircle } from 'lucide-react';
import type { DiscoverLink } from '@/types/discover';

interface LinkPageProps {
  params: Promise<{ id: string }>;
}

interface LinkDetailData {
  link: DiscoverLink;
  isOwned: boolean;
  includedInProgramName?: string;
}

export default function LinkDetailPage({ params }: LinkPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  
  const [data, setData] = useState<LinkDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const justPurchased = searchParams.get('purchased') === 'true';

  useEffect(() => {
    const fetchLink = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/discover/links/${id}`);
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Link not found');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching link:', err);
        setError(err instanceof Error ? err.message : 'Failed to load link');
      } finally {
        setLoading(false);
      }
    };

    fetchLink();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f6] dark:bg-[#05070b]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary font-albert text-[14px]">Loading resource...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen px-4 py-8 bg-[#faf8f6] dark:bg-[#05070b]">
        <BackButton />
        <div className="text-center mt-12">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary font-albert mb-2">
            {error || 'Resource not found'}
          </h2>
          <Button
            onClick={() => router.push('/discover')}
            className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white"
          >
            Back to Discover
          </Button>
        </div>
      </div>
    );
  }

  const { link, isOwned, includedInProgramName } = data;

  // If user owns this content or it's free, show access
  if (isOwned || justPurchased || !link.priceInCents || link.priceInCents === 0) {
    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] pb-24 lg:pb-8">
        {/* Header */}
        <section className="px-4 py-5">
          <div className="flex items-center justify-between">
            <BackButton />
          </div>
        </section>

        {/* Success message if just purchased */}
        {justPurchased && (
          <section className="px-4 pb-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold font-albert text-[14px]">
                  Purchase successful! Your resource is ready.
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Link Content */}
        <section className="px-4">
          <div className="bg-white dark:bg-[#171b22] rounded-3xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-earth-100 dark:bg-[#262b35] flex items-center justify-center">
                <LinkIcon className="w-8 h-8 text-earth-500 dark:text-brand-accent" />
              </div>
              <div>
                <h1 className="font-albert text-[24px] font-semibold text-text-primary tracking-[-1px]">
                  {link.title}
                </h1>
              </div>
            </div>

            {link.description && (
              <p className="font-albert text-[15px] text-text-secondary leading-[1.6] mb-6">
                {link.description}
              </p>
            )}

            {includedInProgramName && (
              <p className="text-sm text-text-muted mb-4">
                Included in {includedInProgramName}
              </p>
            )}

            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-semibold transition-colors"
            >
              <LinkIcon className="w-5 h-5" />
              Open Resource
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </section>
      </div>
    );
  }

  // Show landing page for purchasable content
  if (link.purchaseType === 'landing_page') {
    return (
      <ContentLandingPage
        content={{
          id: link.id,
          type: 'link',
          title: link.title,
          description: link.description,
          coverImageUrl: link.thumbnailUrl,
          priceInCents: link.priceInCents || 0,
          currency: link.currency,
          coachName: link.coachName,
          coachImageUrl: link.coachImageUrl,
          keyOutcomes: link.keyOutcomes,
          features: link.features,
          testimonials: link.testimonials,
          faqs: link.faqs,
        }}
        isOwned={isOwned}
        includedInProgramName={includedInProgramName}
        onAccessContent={() => window.location.reload()}
      />
    );
  }

  // Default: Show simple purchase view
  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] pb-24 lg:pb-8">
      {/* Header */}
      <section className="px-4 py-5">
        <BackButton />
      </section>

      {/* Link Preview */}
      <section className="px-4">
        <div className="bg-white dark:bg-[#171b22] rounded-3xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-earth-100 dark:bg-[#262b35] flex items-center justify-center">
              <LinkIcon className="w-8 h-8 text-earth-500 dark:text-brand-accent" />
            </div>
            <div>
              <h1 className="font-albert text-[24px] font-semibold text-text-primary tracking-[-1px]">
                {link.title}
              </h1>
            </div>
          </div>

          {link.description && (
            <p className="font-albert text-[15px] text-text-secondary leading-[1.6] mb-6">
              {link.description}
            </p>
          )}

          <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold text-text-primary">
                ${((link.priceInCents || 0) / 100).toFixed(2)}
              </span>
              <span className="text-sm text-text-secondary">one-time</span>
            </div>

            <Button
              onClick={async () => {
                if (!isSignedIn) {
                  router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname)}`);
                  return;
                }
                
                const response = await fetch('/api/content/purchase', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contentType: 'link',
                    contentId: link.id,
                  }),
                });
                
                const result = await response.json();
                if (result.checkoutUrl) {
                  window.location.href = result.checkoutUrl;
                } else if (result.success) {
                  window.location.reload();
                }
              }}
              className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold rounded-xl"
            >
              {!isSignedIn ? 'Sign in to purchase' : 'Purchase Resource'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

