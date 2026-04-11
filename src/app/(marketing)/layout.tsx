"use client";

import { Header, Footer } from "@/components/landing";

/**
 * Shared layout for every public marketing page.
 *
 * Every page under `(marketing)/**` inherits this layout automatically, which
 * means:
 *   - Header and Footer are rendered exactly once per page
 *   - Pages must NOT import or render <Header /> / <Footer /> themselves
 *
 * The root layout (src/app/layout.tsx) still owns <html>, <body>, fonts,
 * theme setup and AuthProvider — we only wrap with visual chrome here.
 *
 * See docs/MARKETING_PAGES_SPEC.md for the full contract.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}
