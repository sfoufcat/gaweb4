'use client';

import React, { Component, type ReactNode } from 'react';
import { Puck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { createPortal } from 'react-dom';
import { landingPageConfig } from './puck-config';
import { templates, type LandingPageTemplate } from './templates';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  X, 
  Layout, 
  ChevronLeft, 
  BookOpen, 
  Users, 
  ShoppingCart, 
  Mic, 
  Sparkles,
  Save,
  LayoutTemplate,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

// Error Boundary to catch Puck errors (e.g., during delete operations)
interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class PuckErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Puck Editor Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#faf8f6] dark:bg-[#05070b]">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mx-auto flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              Something went wrong
            </h2>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-6">
              The editor encountered an error. This can sometimes happen during editing operations.
            </p>
            <Button
              onClick={this.handleReset}
              className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export interface LandingPageEditorProps {
  initialData?: Data;
  onSave: (data: Data) => void;
  onCancel: () => void;
}

// Category icons
const categoryIcons: Record<string, React.ElementType> = {
  minimal: Layout,
  sales: ShoppingCart,
  webinar: Mic,
  course: BookOpen,
  coaching: Users,
};

// Template preview component - shows a mini visual representation
function TemplatePreview({ template }: { template: LandingPageTemplate }) {
  const Icon = categoryIcons[template.category] || Layout;
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-[#f5f2ee] to-[#e1ddd8] dark:from-[#1d222b] dark:to-[#11141b] p-4 flex flex-col relative">
      {/* Mini header representation */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-[#a07855]/30" />
        <div className="flex-1 h-1.5 bg-[#a07855]/20 rounded" />
      </div>
      
      {/* Hero section representation */}
      <div className="flex-1 flex flex-col items-center justify-center mb-3">
        <div className="w-12 h-12 rounded-xl bg-[#a07855]/20 flex items-center justify-center mb-2">
          <Icon className="w-6 h-6 text-[#a07855] dark:text-[#b8896a]" />
        </div>
        <div className="w-3/4 h-2 bg-[#a07855]/30 rounded mb-1.5" />
        <div className="w-1/2 h-1.5 bg-[#a07855]/15 rounded" />
      </div>
      
      {/* Section indicators */}
      <div className="flex gap-1.5 justify-center">
        {template.puckData.content.slice(0, 5).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#a07855]/40" />
        ))}
        {template.puckData.content.length > 5 && (
          <span className="text-[9px] text-[#a07855] dark:text-[#b8896a]/60 ml-0.5">+{template.puckData.content.length - 5}</span>
        )}
      </div>
      
      {/* Section count badge */}
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#a07855]/20 text-[#a07855] dark:text-[#b8896a] text-[10px] font-medium">
        {template.puckData.content.length} sections
      </div>
    </div>
  );
}

export function LandingPageEditor({
  initialData,
  onSave,
  onCancel,
}: LandingPageEditorProps) {
  const [showTemplates, setShowTemplates] = useState(!initialData || (initialData.content?.length === 0));
  const [editorData, setEditorData] = useState<Data>(initialData || { content: [], root: {} });
  const [mounted, setMounted] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0); // Key for error boundary reset

  useEffect(() => {
    setMounted(true);
    // Prevent body scroll when editor is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSelectTemplate = (template: LandingPageTemplate) => {
    setEditorData(template.puckData as Data);
    setShowTemplates(false);
    setHasChanges(true);
  };

  const handleStartBlank = () => {
    setEditorData({ content: [], root: {} });
    setShowTemplates(false);
  };

  const handleSave = useCallback(async (data: Data) => {
    setIsSaving(true);
    try {
      await onSave(data);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  const handleDataChange = useCallback((data: Data) => {
    setEditorData(data);
    setHasChanges(true);
  }, []);

  // Wait for client-side mount
  if (!mounted) return null;

  // Template Selection Screen (Portal to body)
  if (showTemplates) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-app-bg dark:bg-[#05070b] flex flex-col font-albert animate-page-fade-in">
        {/* Header */}
        <div className="border-b border-border dark:border-[#262b35] px-8 py-5 flex items-center justify-between bg-surface dark:bg-[#171b22] flex-shrink-0">
          <div className="flex items-center gap-5">
            <button
              onClick={onCancel}
              className="p-2.5 hover:bg-muted/20 dark:hover:bg-[#262b35] rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-text-primary dark:text-[#f5f5f8]">Choose a Template</h1>
              <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">Start with a professionally designed template or build from scratch</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="lg" 
            onClick={onCancel}
            className="border-border dark:border-[#262b35] hover:bg-muted/20 dark:hover:bg-[#262b35] text-text-primary dark:text-[#f5f5f8]"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>

        {/* Template Grid - All templates in one horizontal grid */}
        <div className="flex-1 overflow-auto p-8">
          <div className="w-full">
            <h2 className="text-lg font-semibold mb-6 text-text-primary dark:text-[#f5f5f8]">Choose a Template</h2>
            
            {/* Single unified grid with all templates */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {/* Blank Page Option */}
              <button
                onClick={handleStartBlank}
                className="h-64 border-2 border-dashed border-border dark:border-[#262b35] rounded-2xl hover:border-[#a07855] dark:border-[#b8896a] hover:bg-[#a07855]/5 dark:hover:bg-[#a07855]/10 transition-all duration-200 flex flex-col items-center justify-center gap-4 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-surface-elevated dark:bg-[#1d222b] flex items-center justify-center group-hover:bg-[#a07855]/10 transition-colors border border-border dark:border-[#262b35]">
                  <Layout className="w-7 h-7 text-text-muted dark:text-[#7d8190] group-hover:text-[#a07855] dark:text-[#b8896a] transition-colors" />
                </div>
                <div className="text-center">
                  <span className="font-semibold text-lg text-text-primary dark:text-[#f5f5f8] block">Blank Page</span>
                  <span className="text-sm text-text-secondary dark:text-[#b2b6c2]">Build from scratch</span>
                </div>
              </button>

              {/* All Templates */}
              {templates.map((template) => {
                const CategoryIcon = categoryIcons[template.category] || Layout;
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="text-left bg-card dark:bg-[#171b22] border border-border dark:border-[#262b35] rounded-2xl overflow-hidden hover:border-[#a07855] dark:border-[#b8896a] hover:shadow-lg dark:hover:shadow-[#a07855]/10 transition-all duration-200 group"
                  >
                    {/* Thumbnail/Preview */}
                    <div className="aspect-[4/3] relative overflow-hidden border-b border-border dark:border-[#262b35]">
                      <TemplatePreview template={template} />
                      <div className="absolute inset-0 bg-[#a07855]/0 group-hover:bg-[#a07855]/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="px-4 py-2 bg-[#a07855] text-white rounded-lg font-medium text-sm shadow-lg flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          Use Template
                        </span>
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CategoryIcon className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
                        <span className="text-xs text-[#a07855] dark:text-[#b8896a] capitalize font-medium">{template.category}</span>
                      </div>
                      <h3 className="font-semibold text-text-primary dark:text-[#f5f5f8] group-hover:text-[#a07855] dark:text-[#b8896a] transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-sm text-text-secondary dark:text-[#b2b6c2] mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Puck Editor (Portal to body)
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#faf8f6] dark:bg-[#05070b] font-albert">
      {/* Custom Branded Header */}
      <header className="flex-shrink-0 h-14 px-4 flex items-center justify-between bg-white dark:bg-[#171b22] border-b border-[#e1ddd8] dark:border-[#262b35]">
        {/* Left side - Logo & Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a07855]/10 dark:bg-[#b8896a]/20 flex items-center justify-center">
              <LayoutTemplate className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">Landing Page Builder</h1>
              {hasChanges && (
                <span className="text-[10px] text-[#a07855] dark:text-[#b8896a]">Unsaved changes</span>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Templates Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplates(true)}
            className="border-[#e1ddd8] dark:border-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] hover:border-[#a07855] dark:border-[#b8896a] dark:hover:border-[#b8896a]"
          >
            <LayoutTemplate className="w-4 h-4 mr-2" />
            Templates
          </Button>

          {/* Cancel Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]"
          >
            Cancel
          </Button>

          {/* Save Button */}
          <Button
            size="sm"
            onClick={() => handleSave(editorData)}
            disabled={isSaving}
            className="bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] dark:bg-[#b8896a] dark:hover:bg-[#a07855] text-white font-semibold px-4 shadow-sm"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Landing Page
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Puck Editor - Fills remaining space */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
        <PuckErrorBoundary
          key={editorKey}
          onReset={() => setEditorKey((k) => k + 1)}
        >
          <Puck
            config={landingPageConfig}
            data={editorData}
            onChange={handleDataChange}
            onPublish={(data) => handleSave(data)}
            viewports={[
              { width: 1280, height: 800, label: 'Desktop', icon: 'Monitor' },
              { width: 768, height: 1024, label: 'Tablet', icon: 'Tablet' },
              { width: 375, height: 667, label: 'Mobile', icon: 'Smartphone' },
            ]}
            overrides={{
              // Hide the default header since we have our own
              header: () => <></>,
            }}
          />
        </PuckErrorBoundary>
      </div>
    </div>,
    document.body
  );
}
