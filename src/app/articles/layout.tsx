'use client';

import { DiscoverProvider } from '@/contexts/DiscoverContext';

export default function ArticlesLayout({
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









