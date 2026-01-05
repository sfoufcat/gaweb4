'use client';

import { useState, useEffect } from 'react';
import {
  Loader2,
  Sparkles,
  Check,
  CreditCard,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CreditPack {
  size: number;
  name: string;
  credits: number;
  priceInCents: number;
  priceFormatted: string;
}

interface CreditBalance {
  planAllocated: number;
  planUsed: number;
  planRemaining: number;
  purchasedRemaining: number;
  totalRemaining: number;
  periodStart: string | null;
  periodEnd: string | null;
}

interface CreditPurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * CreditPurchaseModal
 *
 * Modal for purchasing additional call summary credits.
 * Shows available packs and current balance.
 */
export function CreditPurchaseModal({
  open,
  onOpenChange,
}: CreditPurchaseModalProps) {
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchCreditsInfo();
    }
  }, [open]);

  const fetchCreditsInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/coach/credits/purchase');

      if (!response.ok) {
        throw new Error('Failed to fetch credits info');
      }

      const data = await response.json();
      setPacks(data.availablePacks || []);
      setBalance(data.credits || null);
    } catch (err) {
      console.error('Error fetching credits info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPack) return;

    try {
      setPurchasing(true);
      setError(null);

      const response = await fetch('/api/coach/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packSize: selectedPack }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout');
      }

      const data = await response.json();

      if (data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError(err instanceof Error ? err.message : 'Failed to purchase');
      setPurchasing(false);
    }
  };

  const getPricePerCredit = (pack: CreditPack): string => {
    return (pack.priceInCents / pack.credits / 100).toFixed(2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Buy More Credits
          </DialogTitle>
          <DialogDescription>
            Purchase additional AI call summary credits for your coaching calls.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Balance */}
            {balance && (
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Current Balance</span>
                  </div>
                  <span className="text-lg font-semibold">
                    {balance.totalRemaining} calls
                  </span>
                </div>
                {balance.purchasedRemaining > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {balance.planRemaining} from plan + {balance.purchasedRemaining} purchased
                  </p>
                )}
              </div>
            )}

            {/* Credit Packs */}
            <div className="space-y-2">
              {packs.map((pack) => (
                <button
                  key={pack.size}
                  type="button"
                  onClick={() => setSelectedPack(pack.size)}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 transition-all text-left',
                    selectedPack === pack.size
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{pack.credits} Credits</p>
                      <p className="text-xs text-muted-foreground">
                        ${getPricePerCredit(pack)} per call
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{pack.priceFormatted}</p>
                      {selectedPack === pack.size && (
                        <Check className="h-4 w-4 text-primary ml-auto mt-1" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Info text */}
            <p className="text-xs text-muted-foreground text-center">
              Purchased credits never expire and carry over each month.
            </p>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {/* Purchase Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handlePurchase}
              disabled={!selectedPack || purchasing}
            >
              {purchasing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              {purchasing
                ? 'Redirecting...'
                : selectedPack
                ? `Buy ${selectedPack} Credits`
                : 'Select a Pack'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
