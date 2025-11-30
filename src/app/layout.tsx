

"use client";
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context';
import { Suspense, useEffect } from 'react';
import { app } from '@/lib/firebase'; // Import the initialized app
import Loading from './loading';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Note: Metadata is now handled via props passed to the component
// since we need to make this a Client Component for the useEffect hook.
// In a real-world scenario, you might split this into a client-side provider
// and a server-side layout to keep static metadata benefits.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  useEffect(() => {
    // This effect ensures that the Firebase app (and thus Analytics) is initialized
    // when the application first loads. The actual initialization logic which calls
    // getAnalytics() is in the firebase.ts file, guarded by a client-side check.
    if (app) {
      // Firebase is initialized. Analytics will be active if supported.
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <title>Vinylogix - Your Ultimate Vinyl Manager</title>
        <meta name="description" content="Your Ultimate Vinyl Manager" />
        <link rel="icon" href="/app.png" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/app.png" />
        <meta name="application-name" content="Vinylogix" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Vinylogix" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="theme-color" content="#673AB7" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}>
        <Suspense fallback={<Loading />}>
          <AuthProvider>
            <div key="app-content">{children}</div>
            <Toaster key="toaster" />
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  );
}
