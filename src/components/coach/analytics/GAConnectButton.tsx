'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BarChart2, X, Check, Loader2 } from 'lucide-react';

interface GAConnectButtonProps {
  apiBasePath?: string;
}

export function GAConnectButton({ apiBasePath = '/api/coach/analytics' }: GAConnectButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [measurementId, setMeasurementId] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${apiBasePath}/ga-config`);
        if (response.ok) {
          const data = await response.json();
          setIsConfigured(data.configured);
          setMeasurementId(data.measurementId || '');
        }
      } catch (err) {
        console.error('Failed to fetch GA config:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [apiBasePath]);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const response = await fetch(`${apiBasePath}/ga-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurementId: measurementId.trim() || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await response.json();
      setIsConfigured(data.configured);
      setSuccess(true);
      
      // Close modal after success
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
          isConfigured
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50'
            : 'bg-[#e1ddd8]/50 text-[#5f5a55] hover:bg-[#e1ddd8] dark:bg-[#272d38]/50 dark:text-[#b2b6c2] dark:hover:bg-[#272d38]'
        }`}
      >
        <BarChart2 className="w-4 h-4" />
        {loading ? 'Loading...' : isConfigured ? 'GA Connected' : 'Connect Google Analytics'}
      </button>

      {/* Modal - rendered via portal to escape overflow-hidden containers */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] animate-backdrop-fade-in"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal Container */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white dark:bg-[#171b22] rounded-xl shadow-2xl w-full max-w-md border border-[#e1ddd8] dark:border-[#262b35] animate-modal-zoom-in pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
              <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                Connect Google Analytics
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-[#e1ddd8]/50 dark:hover:bg-[#272d38]/50 transition-colors"
              >
                <X className="w-5 h-5 text-[#5f5a55]" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-4">
                Enter your GA4 Measurement ID to enable Google Analytics tracking for your funnels and pages.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                  GA4 Measurement ID
                </label>
                <input
                  type="text"
                  value={measurementId}
                  onChange={(e) => setMeasurementId(e.target.value.toUpperCase())}
                  placeholder="G-XXXXXXXXXX"
                  className="w-full px-4 py-2.5 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#a07855]/30 dark:focus:ring-[#b8896a]/30"
                />
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                  Find this in your Google Analytics 4 property under Admin → Data Streams
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-4">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 mb-4 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">Settings saved successfully!</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
              {isConfigured && (
                <button
                  onClick={() => {
                    setMeasurementId('');
                    handleSave();
                  }}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Disconnect GA
                </button>
              )}
              <div className={`flex gap-3 ${!isConfigured ? 'ml-auto' : ''}`}>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e1ddd8]/50 dark:hover:bg-[#272d38]/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[#a07855] dark:bg-[#b8896a] text-white hover:bg-[#8c6245] dark:hover:bg-[#a07855] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

