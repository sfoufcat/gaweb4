'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { 
  Mail, 
  Lock, 
  Save, 
  RotateCcw, 
  Eye, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Info,
  ChevronDown
} from 'lucide-react';
import { 
  EMAIL_TEMPLATE_CONFIGS, 
  VERIFICATION_TEMPLATE_CONFIG,
  DEFAULT_EMAIL_TEMPLATES,
  VERIFICATION_EMAIL_TEMPLATE,
  AVAILABLE_TEMPLATE_VARIABLES,
  replaceTemplateVariables,
  type TemplateVariables,
} from '@/lib/email-templates';
import type { EmailTemplateType, OrgEmailTemplates, EmailTemplate } from '@/types';

interface EmailTemplateEditorProps {
  /** Whether the email domain is verified */
  isVerified: boolean;
  /** Organization's app title for preview */
  appTitle: string;
  /** Organization's logo URL for preview */
  logoUrl: string;
}

type TabType = EmailTemplateType | 'verification';

export function EmailTemplateEditor({ isVerified, appTitle, logoUrl }: EmailTemplateEditorProps) {
  const { colors } = useBrandingValues();
  const accentColor = colors.accentLight || 'var(--brand-accent-light)';

  // State
  const [activeTab, setActiveTab] = useState<TabType>('welcome');
  const [templates, setTemplates] = useState<OrgEmailTemplates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  // Current template editing state
  const [currentSubject, setCurrentSubject] = useState('');
  const [currentHtml, setCurrentHtml] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/coach/email-templates');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.emailTemplates || null);
        }
      } catch {
        console.error('Failed to fetch email templates');
      } finally {
        setIsLoading(false);
      }
    };

    if (isVerified) {
      fetchTemplates();
    } else {
      setIsLoading(false);
    }
  }, [isVerified]);

  // Get current template (custom or default)
  const getCurrentTemplate = useCallback((type: TabType): EmailTemplate => {
    if (type === 'verification') {
      return VERIFICATION_EMAIL_TEMPLATE;
    }
    
    if (templates && templates[type]) {
      return templates[type]!;
    }
    
    return DEFAULT_EMAIL_TEMPLATES[type];
  }, [templates]);

  // Load template when tab changes
  useEffect(() => {
    const template = getCurrentTemplate(activeTab);
    setCurrentSubject(template.subject);
    setCurrentHtml(template.html);
    setHasChanges(false);
  }, [activeTab, getCurrentTemplate]);

  // Track changes
  useEffect(() => {
    if (activeTab === 'verification') {
      setHasChanges(false);
      return;
    }
    
    const original = getCurrentTemplate(activeTab);
    const changed = currentSubject !== original.subject || currentHtml !== original.html;
    setHasChanges(changed);
  }, [currentSubject, currentHtml, activeTab, getCurrentTemplate]);

  // Preview variables
  const previewVariables: TemplateVariables = {
    firstName: 'John',
    appTitle: appTitle || 'Coachful',
    teamName: appTitle || 'Coachful',
    logoUrl: logoUrl || '/logo.png',
    ctaUrl: 'https://example.com/action',
    year: new Date().getFullYear().toString(),
  };

  // Save template
  const handleSave = async () => {
    if (activeTab === 'verification' || !hasChanges) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/coach/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: activeTab,
          subject: currentSubject,
          html: currentHtml,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save template');
      }

      // Update local state
      setTemplates(prev => ({
        ...prev,
        [activeTab]: data.template,
      }));
      
      setHasChanges(false);
      setSuccessMessage('Template saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (activeTab === 'verification') return;
    
    if (!confirm('Reset this template to the default? Your customizations will be lost.')) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/coach/email-templates?templateType=${activeTab}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset template');
      }

      // Update local state
      setTemplates(prev => {
        if (!prev) return null;
        const { [activeTab as EmailTemplateType]: removed, ...rest } = prev;
        return Object.keys(rest).length > 0 ? rest : null;
      });

      // Load default
      const defaultTemplate = DEFAULT_EMAIL_TEMPLATES[activeTab as EmailTemplateType];
      setCurrentSubject(defaultTemplate.subject);
      setCurrentHtml(defaultTemplate.html);
      setHasChanges(false);
      setSuccessMessage('Template reset to default');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset template');
    } finally {
      setIsSaving(false);
    }
  };

  // Check if current template is customized
  const isCustomized = activeTab !== 'verification' && templates && templates[activeTab as EmailTemplateType];

  if (!isVerified) {
    return (
      <div className="p-6 rounded-xl bg-[#f5f3f0] dark:bg-[#1a1f2a] border border-[#e8e4df] dark:border-[#262b35]">
        <div className="flex items-center gap-3 mb-3">
          <Lock className="w-5 h-5 text-[#8a857f]" />
          <h3 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Email Templates
          </h3>
        </div>
        <p className="text-[13px] text-[#8a857f]">
          Email template customization is available after verifying your email domain.
          Set up email whitelabeling above to unlock this feature.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#8a857f]" />
          <span className="text-[14px] text-[#8a857f]">Loading email templates...</span>
        </div>
      </div>
    );
  }

  const allTabs = [...EMAIL_TEMPLATE_CONFIGS, VERIFICATION_TEMPLATE_CONFIG];
  const activeConfig = activeTab === 'verification' 
    ? VERIFICATION_TEMPLATE_CONFIG 
    : EMAIL_TEMPLATE_CONFIGS.find(c => c.key === activeTab)!;

  return (
    <div className="rounded-xl bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#e8e4df] dark:border-[#262b35]">
        <div className="flex items-center gap-3 mb-2">
          <Mail className="w-5 h-5" style={{ color: accentColor }} />
          <h3 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Email Templates
          </h3>
        </div>
        <p className="text-[13px] text-[#8a857f]">
          Customize the content of automated emails sent to your members.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#e8e4df] dark:border-[#262b35] overflow-x-auto">
        <div className="flex min-w-max">
          {allTabs.map((config) => {
            const isActive = (config.isLocked ? 'verification' : config.key) === activeTab;
            const tabKey = config.isLocked ? 'verification' : config.key;
            
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey as TabType)}
                className={`px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-current text-[#1a1a1a] dark:text-[#faf8f6]'
                    : 'border-transparent text-[#8a857f] hover:text-[#5f5a55] dark:hover:text-[#b5b0ab]'
                }`}
                style={isActive ? { borderColor: accentColor, color: accentColor } : undefined}
              >
                <span className="flex items-center gap-1.5">
                  {config.isLocked && <Lock className="w-3.5 h-3.5" />}
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Template description */}
        <p className="text-[13px] text-[#5f5a55] dark:text-[#9ca3af] mb-4">
          {activeConfig.description}
        </p>

        {/* Error/Success messages */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <p className="text-[13px] text-green-600 dark:text-green-400">{successMessage}</p>
          </div>
        )}

        {activeTab === 'verification' ? (
          // Verification - locked
          <div className="p-4 rounded-lg bg-[#f5f3f0] dark:bg-[#1a1f2a] border border-[#e8e4df] dark:border-[#262b35]">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-[#8a857f]" />
              <span className="text-[13px] font-medium text-[#8a857f]">
                Template Locked
              </span>
            </div>
            <p className="text-[13px] text-[#5f5a55] dark:text-[#9ca3af]">
              Verification emails cannot be customized for security reasons. 
              These emails are generated by Clerk and include a secure verification code.
            </p>
            <p className="text-[13px] text-[#5f5a55] dark:text-[#9ca3af] mt-2">
              The email will show your business name ({appTitle}) in the subject and header.
            </p>
          </div>
        ) : (
          // Editable templates
          <>
            {/* Subject line */}
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#1a1a1a] dark:text-[#faf8f6] mb-1.5">
                Subject Line
              </label>
              <input
                type="text"
                value={currentSubject}
                onChange={(e) => setCurrentSubject(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-lg border border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#faf8f6] focus:outline-none focus:ring-2 focus:ring-brand-accent"
                placeholder="Email subject line..."
              />
            </div>

            {/* Available variables dropdown */}
            <div className="mb-4">
              <button
                onClick={() => setShowVariables(!showVariables)}
                className="flex items-center gap-2 text-[13px] text-[#5f5a55] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-[#faf8f6]"
              >
                <Info className="w-4 h-4" />
                <span>Available variables</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showVariables ? 'rotate-180' : ''}`} />
              </button>
              
              {showVariables && (
                <div className="mt-2 p-3 rounded-lg bg-[#f5f3f0] dark:bg-[#1a1f2a] border border-[#e8e4df] dark:border-[#262b35]">
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_TEMPLATE_VARIABLES.map((v) => (
                      <div key={v.name} className="text-[12px]">
                        <code className="px-1.5 py-0.5 rounded bg-[#e8e4df] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#faf8f6]">
                          {v.name}
                        </code>
                        <span className="ml-2 text-[#8a857f]">{v.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* HTML editor */}
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#1a1a1a] dark:text-[#faf8f6] mb-1.5">
                Email Body
              </label>
              <RichTextEditor
                value={currentHtml}
                onChange={setCurrentHtml}
                placeholder="Write your email content here..."
                rows={16}
                showMediaToolbar={true}
                mediaFolder="articles"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#e8e4df] dark:border-[#262b35]">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg border border-[#e8e4df] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a] transition-colors"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Hide Preview' : 'Preview'}
              </button>

              {isCustomized && (
                <button
                  onClick={handleReset}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg border border-[#e8e4df] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a] transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Default
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Template
              </button>

              {hasChanges && (
                <span className="text-[12px] text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </span>
              )}
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="mt-6 p-4 rounded-lg bg-[#f5f3f0] dark:bg-[#1a1f2a] border border-[#e8e4df] dark:border-[#262b35]">
                <h4 className="text-[13px] font-medium text-[#1a1a1a] dark:text-[#faf8f6] mb-3">
                  Preview (with sample data)
                </h4>
                <div className="p-4 rounded-lg bg-white dark:bg-[#13171f] border border-[#e8e4df] dark:border-[#262b35]">
                  <div className="text-[14px] font-medium text-[#1a1a1a] dark:text-[#faf8f6] mb-3 pb-3 border-b border-[#e8e4df] dark:border-[#262b35]">
                    Subject: {replaceTemplateVariables(currentSubject, previewVariables)}
                  </div>
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: replaceTemplateVariables(currentHtml, previewVariables) 
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

