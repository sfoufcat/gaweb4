'use client';

import { Render, type Data } from '@measured/puck';
import { landingPageConfig } from './puck-config';

export interface LandingPageViewerProps {
  data: Data;
  className?: string;
}

/**
 * Read-only renderer for landing pages in funnels
 * Uses Puck's Render component to display the saved page data
 */
export function LandingPageViewer({ data, className = '' }: LandingPageViewerProps) {
  if (!data || !data.content || data.content.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${className}`}>
        <p className="text-muted-foreground">No content to display</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Render config={landingPageConfig} data={data} />
    </div>
  );
}

