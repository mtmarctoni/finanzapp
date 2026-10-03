import type { Metadata, Viewport } from 'next';
import { Inter_Tight } from 'next/font/google';
import type React from 'react';

import './globals.css';
import { ChatWidget } from '@/components/ai/ChatWidget';
import AuthProvider from '@/components/context/AuthProvider';
import { MobileNav } from '@/components/mobile-nav';
import { QuickAddProvider } from '@/components/quick-add/quick-add-context';
import { Sidebar } from '@/components/sidebar';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Finanzas Personales',
  description: 'Aplicación para gestionar finanzas personales',
  appleWebApp: {
    capable: true,
    title: 'Finanzas',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#f2f2f7' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${interTight.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <QuickAddProvider>
              <div className="flex min-h-dvh">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                  <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-safe pb-tabbar md:px-8 md:pb-12">
                    {children}
                  </main>
                </div>
              </div>
              <MobileNav />
              <Toaster />
              <ChatWidget />
            </QuickAddProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
