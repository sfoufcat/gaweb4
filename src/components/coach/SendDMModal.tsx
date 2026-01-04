'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { X, Send, MessageCircle, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

export interface DMRecipient {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface SendDMModalProps {
  recipients: DMRecipient[];
  onClose: () => void;
  onSuccess?: (sentCount: number) => void;
}

interface SendResult {
  userId: string;
  success: boolean;
  error?: string;
}

/**
 * SendDMModal - Modal for sending direct messages to one or more clients
 * 
 * Features:
 * - Single or bulk message sending
 * - Progress indicator for bulk sends
 * - Uses existing /api/chat/dm endpoint to create DM channels
 * - Sends message via bulk API for efficiency
 */
export function SendDMModal({ recipients, onClose, onSuccess }: SendDMModalProps) {
  const { colors } = useBrandingValues();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [results, setResults] = useState<SendResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  
  const accentColor = colors.accentLight || 'var(--brand-accent-light)';
  const isBulk = recipients.length > 1;
  const maxLength = 1000;
  const hasValidMessage = message.trim().length > 0 && message.length <= maxLength;

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle textarea auto-resize
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setMessage(value);
    }
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  // Send messages
  const handleSend = useCallback(async () => {
    if (!hasValidMessage || isSending) return;
    
    setIsSending(true);
    setError(null);
    setProgress({ sent: 0, total: recipients.length });
    setResults([]);
    
    try {
      // Use bulk API for efficiency
      const response = await fetch('/api/coach/bulk-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientIds: recipients.map(r => r.userId),
          message: message.trim(),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send messages');
      }
      
      const data = await response.json();
      
      // Update results
      setResults(data.results || []);
      setProgress({ sent: data.successCount || 0, total: recipients.length });
      setIsComplete(true);
      
      // Notify parent of success
      if (data.successCount > 0) {
        onSuccess?.(data.successCount);
      }
      
      // Auto-close after short delay on full success
      if (data.successCount === recipients.length) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error('Error sending DMs:', err);
      setError(err instanceof Error ? err.message : 'Failed to send messages');
    } finally {
      setIsSending(false);
    }
  }, [hasValidMessage, isSending, recipients, message, onSuccess, onClose]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
    // Escape to close
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [handleSend, onClose]);

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  return (
    <Drawer
      open={true}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent className="md:max-w-[500px] mx-auto max-h-[85dvh] flex flex-col overflow-hidden" onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="px-6 pt-2 md:pt-6 pb-4 border-b border-[#e8e4df] dark:border-[#262b35] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}20` }}
            >
              <MessageCircle className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="font-semibold text-[18px] text-[#1a1a1a] dark:text-[#faf8f6] font-albert">
                {isBulk ? 'Send Bulk Message' : 'Send Message'}
              </h2>
              <p className="text-[13px] text-[#8a857f] font-albert">
                {isBulk 
                  ? `To ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`
                  : `To ${recipients[0]?.name}`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8a857f] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors p-1 rounded-lg hover:bg-[#f5f3f0] dark:hover:bg-[#262b35]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recipients Preview (for bulk) */}
        {isBulk && !isComplete && (
          <div className="px-6 py-3 border-b border-[#e8e4df] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#8a857f]" />
              <span className="text-[13px] font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                Recipients
              </span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto">
              {recipients.slice(0, 10).map((recipient) => (
                <div
                  key={recipient.userId}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#171b22] rounded-full border border-[#e8e4df] dark:border-[#262b35]"
                >
                  {recipient.avatarUrl ? (
                    <Image
                      src={recipient.avatarUrl}
                      alt={recipient.name}
                      width={20}
                      height={20}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-accent to-[#8c6245] flex items-center justify-center text-white text-[10px] font-semibold">
                      {recipient.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-[12px] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert max-w-[100px] truncate">
                    {recipient.name}
                  </span>
                </div>
              ))}
              {recipients.length > 10 && (
                <div className="flex items-center px-2 py-1 text-[12px] text-[#8a857f] font-albert">
                  +{recipients.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Message Input or Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {isComplete ? (
            // Results view
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 py-4">
                {failedCount === 0 ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Messages Sent!
                      </p>
                      <p className="text-[13px] text-[#8a857f] font-albert">
                        Successfully sent to {successCount} recipient{successCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        Partially Sent
                      </p>
                      <p className="text-[13px] text-[#8a857f] font-albert">
                        {successCount} sent, {failedCount} failed
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              {/* Failed recipients list */}
              {failedCount > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-[13px] font-medium text-red-700 dark:text-red-300 mb-2 font-albert">
                    Failed to send to:
                  </p>
                  <ul className="space-y-1">
                    {results.filter(r => !r.success).map((result) => {
                      const recipient = recipients.find(r => r.userId === result.userId);
                      return (
                        <li key={result.userId} className="text-[12px] text-red-600 dark:text-red-400 font-albert">
                          {recipient?.name || result.userId}: {result.error || 'Unknown error'}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            // Message input
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-2 font-albert">
                  Your Message
                </label>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={handleMessageChange}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-3 rounded-xl border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8a857f] font-albert text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent/30 dark:focus:ring-brand-accent/30 min-h-[120px]"
                  disabled={isSending}
                />
                <div className="flex justify-between mt-2">
                  <p className="text-[12px] text-[#8a857f] font-albert">
                    Press <kbd className="px-1.5 py-0.5 bg-[#f5f3f0] dark:bg-[#262b35] rounded text-[11px]">⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-[#f5f3f0] dark:bg-[#262b35] rounded text-[11px]">Enter</kbd> to send
                  </p>
                  <p className={`text-[12px] font-albert ${message.length > maxLength * 0.9 ? 'text-amber-600' : 'text-[#8a857f]'}`}>
                    {message.length}/{maxLength}
                  </p>
                </div>
              </div>
              
              {/* Sending Progress */}
              {isSending && (
                <div className="flex items-center gap-3 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      Sending messages...
                    </p>
                    {isBulk && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-[#e8e4df] dark:bg-[#262b35] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-brand-accent transition-all duration-300"
                            style={{ width: `${(progress.sent / progress.total) * 100}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-[#8a857f] mt-1">
                          {progress.sent} of {progress.total}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="px-6 pb-2">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-[13px] text-red-800 dark:text-red-200 text-center font-albert">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-[#e8e4df] dark:border-[#262b35] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-[#f5f3f0] dark:bg-[#262b35] text-[15px] font-medium text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#ebe7e2] dark:hover:bg-[#313746] transition-colors font-albert"
          >
            {isComplete ? 'Close' : 'Cancel'}
          </button>
          {!isComplete && (
            <button
              onClick={handleSend}
              disabled={!hasValidMessage || isSending}
              className="flex-1 py-3 rounded-xl text-[15px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-albert"
              style={{ backgroundColor: accentColor }}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send {isBulk ? `to ${recipients.length}` : ''}
                </>
              )}
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

