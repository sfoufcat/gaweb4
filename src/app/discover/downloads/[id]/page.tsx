'use client';

import { use, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { BackButton } from '@/components/discover';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle, ExternalLink, CheckCircle } from 'lucide-react';
import type { DiscoverDownload } from '@/types/discover';

interface DownloadPageProps {
  params: Promise<{ id: string }>;
}

interface DownloadDetailData {
  download: DiscoverDownload;
  isOwned: boolean;
  includedInProgramName?: string;
}

export default function DownloadDetailPage({ params }: DownloadPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  
  const [data, setData] = useState<DownloadDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const justPurchased = searchParams.get('purchased') === 'true';

  useEffect(() => {
    const fetchDownload = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/discover/downloads/${id}`);
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Download not found');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching download:', err);
        setError(err instanceof Error ? err.message : 'Failed to load download');
      } finally {
        setLoading(false);
      }
    };

    fetchDownload();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f6] dark:bg-[#05070b]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary font-albert text-[14px]">Loading download...</p>
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
            {error || 'Download not found'}
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

  const { download, isOwned, includedInProgramName } = data;

  // If user owns this content and it requires payment, show download access
  if (isOwned || justPurchased || !download.priceInCents || download.priceInCents === 0) {
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
                  Purchase successful! Your download is ready.
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Download Content */}
        <section className="px-4">
          <div className="bg-white dark:bg-[#171b22] rounded-3xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-earth-100 dark:bg-[#262b35] flex items-center justify-center">
                <Download className="w-8 h-8 text-earth-500 dark:text-brand-accent" />
              </div>
              <div>
                <h1 className="font-albert text-[24px] font-semibold text-text-primary tracking-[-1px]">
                  {download.title}
                </h1>
                {download.fileType && (
                  <span className="text-sm text-text-secondary uppercase">
                    {download.fileType}
                  </span>
                )}
              </div>
            </div>

            {download.description && (
              <p className="font-albert text-[15px] text-text-secondary leading-[1.6] mb-6">
                {download.description}
              </p>
            )}

            {includedInProgramName && (
              <p className="text-sm text-text-muted mb-4">
                Included in {includedInProgramName}
              </p>
            )}

            <a
              href={download.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-semibold transition-colors"
            >
              <Download className="w-5 h-5" />
              Download File
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </section>
      </div>
    );
  }

  // Show simple purchase view (popup would be triggered from card)
  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] pb-24 lg:pb-8">
      {/* Header */}
      <section className="px-4 py-5">
        <BackButton />
      </section>

      {/* Download Preview */}
      <section className="px-4">
        <div className="bg-white dark:bg-[#171b22] rounded-3xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-earth-100 dark:bg-[#262b35] flex items-center justify-center">
              <Download className="w-8 h-8 text-earth-500 dark:text-brand-accent" />
            </div>
            <div>
              <h1 className="font-albert text-[24px] font-semibold text-text-primary tracking-[-1px]">
                {download.title}
              </h1>
              {download.fileType && (
                <span className="text-sm text-text-secondary uppercase">
                  {download.fileType}
                </span>
              )}
            </div>
          </div>

          {download.description && (
            <p className="font-albert text-[15px] text-text-secondary leading-[1.6] mb-6">
              {download.description}
            </p>
          )}

          <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold text-text-primary">
                ${((download.priceInCents || 0) / 100).toFixed(2)}
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
                    contentType: 'download',
                    contentId: download.id,
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
              {!isSignedIn ? 'Sign in to purchase' : 'Purchase Download'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

