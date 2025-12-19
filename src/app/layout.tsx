import type { Metadata } from "next";
import { Geist, Geist_Mono, Albert_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ConditionalSidebar } from "@/components/layout/ConditionalSidebar";
import { ConditionalMain } from "@/components/layout/ConditionalMain";
import { PageTransition } from "@/components/layout/PageTransition";
import { StreamChatProvider } from "@/contexts/StreamChatContext";
import { StreamVideoProvider } from "@/contexts/StreamVideoContext";
import { SquadProvider } from "@/contexts/SquadContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { IncomingCallHandler } from "@/components/chat/IncomingCallHandler";
import { ClerkThemeProvider } from "@/components/auth/ClerkThemeProvider";
import { TimezoneSync } from "@/components/TimezoneSync";

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

export const metadata: Metadata = {
  title: "Growth Addicts",
  description: "Define your mission. Align your life.",
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkThemeProvider>
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
          </ThemeProvider>
        </body>
      </html>
    </ClerkThemeProvider>
  );
}
