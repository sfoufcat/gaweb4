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
import { CoachingProvider } from "@/contexts/CoachingContext";
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
import { ChatPreferencesProvider } from "@/contexts/ChatPreferencesContext";
import { ChatChannelsProvider } from "@/contexts/ChatChannelsContext";
import { AuthHintProvider } from "@/contexts/AuthHintContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { StoryViewsProvider } from "@/contexts/StoryViewsContext";
import { getServerChatFilterData } from "@/lib/chat-server";

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
 * No themeColor - allows content to flow naturally into safe areas
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

  // Get auth hint from middleware (prevents flash of unauthenticated content during Clerk hydration)
  const isUserAuthenticated = headersList.get('x-user-authenticated') === 'true';

  // Get SSR branding and chat filter data in parallel - single fetch, no redundant calls
  const [ssrBranding, ssrChatFilter] = await Promise.all([
    getServerBranding(),
    getServerChatFilterData(),
  ]);
  
  return (
    <ClerkThemeProvider 
      hostname={hostname}
      logoUrl={getBestLogoUrl(ssrBranding.branding)}
      appTitle={ssrBranding.branding.appTitle}
      subdomain={ssrBranding.subdomain}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* iOS Safari: translucent status bar so content flows behind it (same as marketing site) */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          {/* Critical CSS for layout - prevents layout shift by being in initial HTML */}
          <style dangerouslySetInnerHTML={{
            __html: `
              /* Fullscreen pages - match landing page background to prevent flash */
              html:has(body[data-layout="fullscreen"]),
              body[data-layout="fullscreen"],
              body[data-layout="fullscreen"].bg-app-bg {
                background-color: #faf8f6 !important;
              }
              html.dark:has(body[data-layout="fullscreen"]),
              html.dark body[data-layout="fullscreen"],
              html.dark body[data-layout="fullscreen"].bg-app-bg {
                background-color: #05070b !important;
              }
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
                    var isDark = false;

                    if (stored === 'dark') {
                      isDark = true;
                    } else if (stored === 'light') {
                      isDark = false;
                    } else if (orgDefault === 'dark') {
                      isDark = true;
                    } else if (orgDefault === 'system') {
                      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    }

                    if (isDark) {
                      document.documentElement.classList.add('dark');
                    }
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
          {/* Inline script to ensure fullscreen layout on marketing domain - runs immediately */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var h=location.hostname;if(h==='coachful.co'||h==='www.coachful.co'){document.body.setAttribute('data-layout','fullscreen');}}catch(e){}})();`,
            }}
          />
          <DemoModeProvider>
            <DemoSessionProvider>
            <AuthHintProvider isAuthenticated={isUserAuthenticated}>
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
              <StoryViewsProvider>
              <SquadProvider>
              <CoachingProvider>
              <OrganizationProvider initialOrganizationId={ssrBranding.organizationId}>
              <ViewModeProvider>
                <StreamChatProvider>
                  <ChatChannelsProvider
                    initialOrgChannelIds={ssrChatFilter.orgChannelIds}
                    initialSquadChannelIds={ssrChatFilter.squadChannelIds}
                    initialIsPlatformMode={ssrChatFilter.isPlatformMode}
                  >
                  <StreamVideoProvider>
                    <ChatPreferencesProvider>
                    <ChatSheetProvider>
                      <Suspense fallback={null}>
                        <ConditionalSidebar layoutMode={layoutMode} />
                      </Suspense>
                      
                      {/* Main Content Wrapper - Adjusted for narrower sidebar */}
                      <Suspense fallback={null}>
                        <ConditionalMain layoutMode={layoutMode}>
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
                    </ChatPreferencesProvider>
                  </StreamVideoProvider>
                  </ChatChannelsProvider>
                </StreamChatProvider>
              </ViewModeProvider>
              </OrganizationProvider>
              </CoachingProvider>
              </SquadProvider>
              </StoryViewsProvider>
              </BrandingProvider>
              </SWRProvider>
              </ThemeProvider>
            </AuthHintProvider>
            </DemoSessionProvider>
          </DemoModeProvider>
        </body>
      </html>
    </ClerkThemeProvider>
  );
}
