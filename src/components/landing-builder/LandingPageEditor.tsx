'use client';

import { Puck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { createPortal } from 'react-dom';
import { landingPageConfig } from './puck-config';
import { templates, type LandingPageTemplate } from './templates';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Layout, ChevronLeft, Play, BookOpen, Users, ShoppingCart, Mic } from 'lucide-react';

export interface LandingPageEditorProps {
  initialData?: Data;
  onSave: (data: Data) => void;
  onCancel: () => void;
}

// Category icons and colors
const categoryConfig: Record<string, { icon: React.ElementType; gradient: string }> = {
  minimal: { icon: Layout, gradient: 'from-slate-500 to-slate-700' },
  sales: { icon: ShoppingCart, gradient: 'from-emerald-500 to-teal-600' },
  webinar: { icon: Mic, gradient: 'from-purple-500 to-indigo-600' },
  course: { icon: BookOpen, gradient: 'from-blue-500 to-cyan-600' },
  coaching: { icon: Users, gradient: 'from-amber-500 to-orange-600' },
};

// Template preview component - shows a mini visual representation
function TemplatePreview({ template }: { template: LandingPageTemplate }) {
  const config = categoryConfig[template.category] || categoryConfig.minimal;
  const Icon = config.icon;
  
  // Count sections by type for the preview
  const sectionCounts = template.puckData.content.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return (
    <div className={`w-full h-full bg-gradient-to-br ${config.gradient} p-4 flex flex-col`}>
      {/* Mini header representation */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-white/20" />
        <div className="flex-1 h-2 bg-white/20 rounded" />
      </div>
      
      {/* Hero section representation */}
      <div className="flex-1 flex flex-col items-center justify-center text-white/90 mb-3">
        <Icon className="w-8 h-8 mb-2 opacity-80" />
        <div className="w-3/4 h-2 bg-white/30 rounded mb-1.5" />
        <div className="w-1/2 h-1.5 bg-white/20 rounded" />
      </div>
      
      {/* Section indicators */}
      <div className="flex gap-1 justify-center">
        {template.puckData.content.slice(0, 6).map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-white/40" />
        ))}
        {template.puckData.content.length > 6 && (
          <span className="text-[10px] text-white/60">+{template.puckData.content.length - 6}</span>
        )}
      </div>
      
      {/* Section count badge */}
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/20 text-white text-[10px] font-medium">
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
  };

  const handleStartBlank = () => {
    setEditorData({ content: [], root: {} });
    setShowTemplates(false);
  };

  // Wait for client-side mount
  if (!mounted) return null;

  // Template Selection Screen (Portal to body)
  if (showTemplates) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onCancel}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Choose a Template</h1>
              <p className="text-sm text-muted-foreground">Start with a professionally designed template or build from scratch</p>
            </div>
          </div>
          <Button variant="outline" size="lg" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-auto p-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            {/* Blank Template */}
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-6 text-foreground">Start Fresh</h2>
              <button
                onClick={handleStartBlank}
                className="w-80 h-52 border-2 border-dashed border-border rounded-2xl hover:border-[#a07855] hover:bg-[#a07855]/5 transition-all duration-200 flex flex-col items-center justify-center gap-4 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-[#a07855]/10 transition-colors">
                  <Layout className="w-8 h-8 text-muted-foreground group-hover:text-[#a07855] transition-colors" />
                </div>
                <div className="text-center">
                  <span className="font-semibold text-lg text-foreground block">Blank Page</span>
                  <span className="text-sm text-muted-foreground">Build from scratch with drag & drop</span>
                </div>
              </button>
            </div>

            {/* Template Categories */}
            {Object.entries(
              templates.reduce((acc, template) => {
                if (!acc[template.category]) acc[template.category] = [];
                acc[template.category].push(template);
                return acc;
              }, {} as Record<string, LandingPageTemplate[]>)
            ).map(([category, categoryTemplates]) => {
              const config = categoryConfig[category] || categoryConfig.minimal;
              const CategoryIcon = config.icon;
              
              return (
                <div key={category} className="mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                      <CategoryIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground capitalize">{category}</h2>
                      <p className="text-sm text-muted-foreground">
                        {category === 'minimal' && 'Clean, simple designs'}
                        {category === 'sales' && 'High-converting sales pages'}
                        {category === 'webinar' && 'Webinar & event registration'}
                        {category === 'course' && 'Online course launches'}
                        {category === 'coaching' && 'Coaching & consulting programs'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {categoryTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className="text-left bg-card border border-border rounded-2xl overflow-hidden hover:border-[#a07855] hover:shadow-xl transition-all duration-200 group"
                      >
                        {/* Thumbnail/Preview */}
                        <div className="aspect-[4/3] relative overflow-hidden">
                          <TemplatePreview template={template} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="px-4 py-2 bg-white rounded-lg font-medium text-sm shadow-lg">
                              Use Template
                            </span>
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="p-4">
                          <h3 className="font-semibold text-foreground group-hover:text-[#a07855] transition-colors">
                            {template.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {template.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Puck Editor (Portal to body)
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-background">
      <Puck
        config={landingPageConfig}
        data={editorData}
        onPublish={(data) => onSave(data)}
        viewports={[
          { width: 1280, height: 800, label: 'Desktop', icon: 'Monitor' },
          { width: 768, height: 1024, label: 'Tablet', icon: 'Tablet' },
          { width: 375, height: 667, label: 'Mobile', icon: 'Smartphone' },
        ]}
        overrides={{
          headerActions: () => (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
                Templates
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          ),
        }}
      />
    </div>,
    document.body
  );
}
