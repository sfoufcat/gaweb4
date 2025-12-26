'use client';

import { Puck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { landingPageConfig } from './puck-config';
import { templates, type LandingPageTemplate } from './templates';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Layout, ChevronLeft } from 'lucide-react';

export interface LandingPageEditorProps {
  initialData?: Data;
  onSave: (data: Data) => void;
  onCancel: () => void;
}

export function LandingPageEditor({
  initialData,
  onSave,
  onCancel,
}: LandingPageEditorProps) {
  const [showTemplates, setShowTemplates] = useState(!initialData || (initialData.content?.length === 0));
  const [editorData, setEditorData] = useState<Data>(initialData || { content: [], root: {} });

  const handleSelectTemplate = (template: LandingPageTemplate) => {
    setEditorData(template.puckData as Data);
    setShowTemplates(false);
  };

  const handleStartBlank = () => {
    setEditorData({ content: [], root: {} });
    setShowTemplates(false);
  };

  // Template Selection Screen
  if (showTemplates) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onCancel}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">Choose a Template</h1>
              <p className="text-sm text-muted-foreground">Start with a template or create from scratch</p>
            </div>
          </div>
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Blank Template */}
            <div className="mb-8">
              <h2 className="text-lg font-medium mb-4">Start Fresh</h2>
              <button
                onClick={handleStartBlank}
                className="w-64 h-40 border-2 border-dashed border-border rounded-xl hover:border-[#a07855] hover:bg-[#a07855]/5 transition-colors flex flex-col items-center justify-center gap-3"
              >
                <Layout className="w-8 h-8 text-muted-foreground" />
                <span className="font-medium text-foreground">Blank Page</span>
                <span className="text-sm text-muted-foreground">Build from scratch</span>
              </button>
            </div>

            {/* Template Categories */}
            {Object.entries(
              templates.reduce((acc, template) => {
                if (!acc[template.category]) acc[template.category] = [];
                acc[template.category].push(template);
                return acc;
              }, {} as Record<string, LandingPageTemplate[]>)
            ).map(([category, categoryTemplates]) => (
              <div key={category} className="mb-8">
                <h2 className="text-lg font-medium mb-4 capitalize">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="text-left border border-border rounded-xl overflow-hidden hover:border-[#a07855] hover:shadow-lg transition-all group"
                    >
                      {/* Thumbnail */}
                      <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                        {template.thumbnail ? (
                          <img 
                            src={template.thumbnail} 
                            alt={template.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Layout className="w-12 h-12 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </div>
                      
                      {/* Info */}
                      <div className="p-4">
                        <h3 className="font-medium text-foreground">{template.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Puck Editor
  return (
    <div className="fixed inset-0 z-50">
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
    </div>
  );
}

