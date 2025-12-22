'use client';

import { useState } from 'react';
import { X, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * JoinPrivateSquadModal Component
 * 
 * @deprecated Replaced by Program Enrollment flow. Users now get squads automatically
 * when enrolling in a group program. Invite codes may still be used for program invites.
 * 
 * Modal for joining a private squad via invite code.
 */

interface JoinPrivateSquadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function JoinPrivateSquadModal({ open, onClose, onSuccess }: JoinPrivateSquadModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format code as user types (auto-uppercase, add dash if missing)
  const handleCodeChange = (value: string) => {
    // Remove non-alphanumeric except dash
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setCode(cleaned);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const normalizedCode = code.trim().toUpperCase();
    
    if (!normalizedCode) {
      setError('Please enter an invite code');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/squad/join-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join squad');
      }

      onSuccess();
    } catch (err) {
      console.error('Error joining squad:', err);
      setError(err instanceof Error ? err.message : 'Failed to join squad');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md p-0">
        <AlertDialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="font-albert text-[24px] tracking-[-1px]">
              Join private squad
            </AlertDialogTitle>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#faf8f6] rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Info */}
          <div className="flex items-start gap-3 p-4 bg-[#faf8f6] rounded-[16px]">
            <Key className="w-5 h-5 text-[#a07855] mt-0.5 flex-shrink-0" />
            <p className="font-albert text-[14px] text-text-secondary">
              Enter the invite code you received from your squad leader. Codes look like{' '}
              <span className="font-mono text-text-primary">GA-XY29Q8</span>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-[12px] text-red-700 font-albert text-[14px]">
              {error}
            </div>
          )}

          {/* Invite Code Input */}
          <div>
            <label className="block font-albert font-medium text-[14px] text-text-primary mb-2">
              Invite code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="GA-XXXXXX"
              maxLength={12}
              className="w-full px-4 py-4 bg-white border border-[#e1ddd8] rounded-[12px] font-mono text-[18px] text-text-primary text-center tracking-[2px] placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 focus:border-[#a07855] transition-all uppercase"
              autoFocus
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full bg-[#a07855] hover:bg-[#8c6245] disabled:bg-[#a07855]/50 text-white rounded-[16px] py-3 font-albert font-semibold text-[16px]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Joining...
                </span>
              ) : (
                'Join squad'
              )}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}











