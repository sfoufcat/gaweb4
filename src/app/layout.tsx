import type { Metadata } from "next";
import { Geist, Geist_Mono, Albert_Sans } from "next/font/google";
import { Suspense } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { ConditionalSidebar } from "@/components/layout/ConditionalSidebar";
import { ConditionalMain } from "@/components/layout/ConditionalMain";
import { PageTransition } from "@/components/layout/PageTransition";
import { StreamChatProvider } from "@/contexts/StreamChatContext";
import { StreamVideoProvider } from "@/contexts/StreamVideoContext";
import { SquadProvider } from "@/contexts/SquadContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { IncomingCallHandler } from "@/components/chat/IncomingCallHandler";
import { ClerkThemeProvider } from "@/components/auth/ClerkThemeProvider";
import { TimezoneSync } from "@/components/TimezoneSync";
import { getBrandingForDomain, getBestLogoUrl } from "@/lib/server/branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const albertSans = Albert_Sans({
  variable: "--font-albert-sans",
  subsets: ["latin"],
  display: 'swap',
});

/**
 * Generate dynamic metadata based on domain branding
 * Favicon and title use the organization's branding if on a custom domain
 */
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  
  const branding = await getBrandingForDomain(hostname);
  const iconUrl = getBestLogoUrl(branding);
  
  return {
    title: branding.appTitle,
    description: "Define your mission. Align your life.",
    icons: {
      icon: iconUrl,
      apple: iconUrl,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get hostname and branding for satellite domain detection and Clerk configuration
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  const branding = await getBrandingForDomain(hostname);
  
  return (
    <ClerkThemeProvider 
      hostname={hostname}
      logoUrl={getBestLogoUrl(branding)}
      appTitle={branding.appTitle}
    >
      <html lang="en" className="h-full" suppressHydrationWarning>
        <head>
          {/* Inline script to prevent flash of wrong theme */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var stored = localStorage.getItem('ga-theme');
                    if (stored === 'dark') {
                      document.documentElement.classList.add('dark');
                    }
                  } catch (e) {}
                })();
              `,
            }}
          />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${albertSans.variable} antialiased min-h-screen bg-app-bg text-text-primary transition-colors duration-300`}
          suppressHydrationWarning
        >
          <ThemeProvider>
          <BrandingProvider>
          <SquadProvider>
            <StreamChatProvider>
              <StreamVideoProvider>
                <Suspense fallback={null}>
                  <ConditionalSidebar />
                </Suspense>
                
                {/* Main Content Wrapper - Adjusted for narrower sidebar */}
                <Suspense fallback={null}>
                  <ConditionalMain>
                    <PageTransition>
                      {children}
                    </PageTransition>
                  </ConditionalMain>
                </Suspense>
                
                {/* Global incoming call handler */}
                <IncomingCallHandler />
                
                {/* Sync user's timezone from browser (handles traveling users) */}
                <TimezoneSync />
              </StreamVideoProvider>
            </StreamChatProvider>
          </SquadProvider>
          </BrandingProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkThemeProvider>
  );
}
