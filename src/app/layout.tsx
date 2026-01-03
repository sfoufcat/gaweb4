import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Albert_Sans } from "next/font/google";
import { Suspense } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { ConditionalSidebar } from "@/components/layout/ConditionalSidebar";
import { ConditionalMain } from "@/components/layout/ConditionalMain";
import { PageTransition } from "@/components/layout/PageTransition";
import { LayoutModeSync } from "@/components/layout/LayoutModeSync";
import { StreamChatProvider } from "@/contexts/StreamChatContext";
import { StreamVideoProvider } from "@/contexts/StreamVideoContext";
import { SquadProvider } from "@/contexts/SquadContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { IncomingCallHandler } from "@/components/chat/IncomingCallHandler";
import { ClerkThemeProvider } from "@/components/auth/ClerkThemeProvider";
import { TimezoneSync } from "@/components/TimezoneSync";
import { GATracker } from "@/components/analytics/GATracker";
import { getServerBranding } from "@/lib/branding-server";
import { SWRProvider } from "@/lib/swr-provider";
import { DEFAULT_LOGO_URL, DEFAULT_THEME } from "@/types";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { DemoSessionProvider } from "@/contexts/DemoSessionContext";
import { ChatSheetProvider } from "@/contexts/ChatSheetContext";

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
 * Helper to get best logo URL for favicon
 */
function getBestLogoUrl(branding: { logoUrl: string | null; horizontalLogoUrl: string | null }): string {
  return branding.logoUrl || branding.horizontalLogoUrl || DEFAULT_LOGO_URL;
}

/**
 * Viewport configuration for Safari edge-to-edge display
 * viewport-fit=cover enables safe area insets for iOS Safari
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

/**
 * Generate dynamic metadata based on domain branding
 * Favicon and title use the organization's branding if on a custom domain
 */
export async function generateMetadata(): Promise<Metadata> {
  const ssrBranding = await getServerBranding();
  const iconUrl = getBestLogoUrl(ssrBranding.branding);
  
  return {
    title: ssrBranding.branding.appTitle,
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
  // Get hostname for satellite domain detection and Clerk configuration
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  
  // Get layout mode from middleware (prevents layout shift by knowing during SSR)
  const layoutMode = headersList.get('x-layout-mode') || 'with-sidebar';
  
  // Get SSR branding from middleware cookie - single fetch, no redundant calls
  const ssrBranding = await getServerBranding();
  
  return (
    <ClerkThemeProvider 
      hostname={hostname}
      logoUrl={getBestLogoUrl(ssrBranding.branding)}
      appTitle={ssrBranding.branding.appTitle}
      subdomain={ssrBranding.subdomain}
    >
      <html lang="en" className="h-full" suppressHydrationWarning>
        <head>
          {/* Critical CSS for layout - prevents layout shift by being in initial HTML */}
          <style dangerouslySetInnerHTML={{
            __html: `
              @media (min-width: 1024px) {
                body[data-layout="with-sidebar"] main {
                  padding-left: 16rem !important;
                }
                /* Force fullscreen for marketplace regardless of data-layout attribute timing */
                body:has(.marketplace-root) main {
                  padding-left: 0 !important;
                }
              }
            `
          }} />
          {/* Inline script to prevent flash of wrong theme */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var stored = localStorage.getItem('ga-theme');
                    var orgDefault = '${ssrBranding.branding.defaultTheme || DEFAULT_THEME}';
                    
                    if (stored === 'dark') {
                      document.documentElement.classList.add('dark');
                    } else if (stored === 'light') {
                      // Explicit light mode - no dark class
                    } else if (orgDefault === 'dark') {
                      // No user preference, use org default
                      document.documentElement.classList.add('dark');
                    } else if (orgDefault === 'system') {
                      // Use system preference
                      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        document.documentElement.classList.add('dark');
                      }
                    }
                    // Default: light mode (no action needed)
                  } catch (e) {}
                })();
              `,
            }}
          />
          {/* Google Ads (gtag.js) - Platform-level conversion tracking for coach signups */}
          <script async src="https://www.googletagmanager.com/gtag/js?id=AW-16653181105" />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'AW-16653181105');
              `,
            }}
          />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${albertSans.variable} antialiased min-h-screen bg-app-bg text-text-primary transition-colors duration-300`}
          data-layout={layoutMode}
          suppressHydrationWarning
        >
          <DemoModeProvider>
            <DemoSessionProvider>
              {/* Client-side sync for body data-layout attribute (safety net for hydration/navigation) */}
              <Suspense fallback={null}>
                <LayoutModeSync />
              </Suspense>
              
              <ThemeProvider initialOrgDefaultTheme={ssrBranding.branding.defaultTheme || DEFAULT_THEME}>
              <SWRProvider>
              <BrandingProvider 
                initialBranding={ssrBranding.branding}
                initialCoachingPromo={ssrBranding.coachingPromo}
                initialIsDefault={ssrBranding.isDefault}
                initialFeedEnabled={ssrBranding.feedEnabled}
                initialProgramEmptyStateBehavior={ssrBranding.programEmptyStateBehavior}
                initialSquadEmptyStateBehavior={ssrBranding.squadEmptyStateBehavior}
              >
              <SquadProvider>
              <OrganizationProvider>
                <StreamChatProvider>
                  <StreamVideoProvider>
                    <ChatSheetProvider>
                      <Suspense fallback={null}>
                        <ConditionalSidebar layoutMode={layoutMode} />
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
                      
                      {/* Google Analytics tracking (org-specific) */}
                      <Suspense fallback={null}>
                        <GATracker />
                      </Suspense>
                    </ChatSheetProvider>
                  </StreamVideoProvider>
                </StreamChatProvider>
              </OrganizationProvider>
              </SquadProvider>
              </BrandingProvider>
              </SWRProvider>
              </ThemeProvider>
            </DemoSessionProvider>
          </DemoModeProvider>
        </body>
      </html>
    </ClerkThemeProvider>
  );
}
