'use client';

import { DiscoverProvider } from '@/contexts/DiscoverContext';

export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DiscoverProvider>
      {children}
    </DiscoverProvider>
  );
}











