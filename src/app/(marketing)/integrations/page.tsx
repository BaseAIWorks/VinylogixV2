"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Disc3,
  CreditCard,
  Wallet,
  Receipt,
  Truck,
  Server,
  Plug,
  Settings,
  Zap,
} from "lucide-react";

export default function IntegrationsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Plug className="h-4 w-4" />
            Integrations
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Works with the tools you already use
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Vinylogix connects directly with Discogs, Stripe, PayPal, major shipping carriers, and Google Cloud. No middleware, no manual data entry — real integrations wired into the platform.
          </p>
        </div>
      </section>

      {/* Featured integrations grid */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built-in integrations
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Every integration below is live in the platform — not on a roadmap.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Discogs */}
            <div className="group flex flex-col rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:border-primary/30 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                  <Disc3 className="h-6 w-6 text-primary" />
                </div>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Catalog &amp; Collection
                </span>
              </div>
              <h3 className="text-xl font-semibold">Discogs</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                Look up any release by barcode and pull full catalog metadata — artist, title, cover art, tracklist, year, label, and format — directly from Discogs. Collectors can sync their entire Discogs collection and wishlist into Vinylogix in one click.
              </p>
              <div className="mt-6">
                <Link
                  href="/discogs-sync"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Stripe Connect */}
            <div className="group flex flex-col rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:border-primary/30 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Payments
                </span>
              </div>
              <h3 className="text-xl font-semibold">Stripe Connect</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                Connect your Stripe account and accept card payments at checkout. Stripe handles merchant payouts, refunds, invoicing, and PCI compliance. Processing fees range from 1.5% + €0.25 for standard EEA cards up to 3.25% + €0.25 for international cards.
              </p>
              <div className="mt-6">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* PayPal */}
            <div className="group flex flex-col rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:border-primary/30 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Payments
                </span>
              </div>
              <h3 className="text-xl font-semibold">PayPal</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                Offer PayPal as an alternative checkout option alongside Stripe. Many record store buyers prefer PayPal for B2B transactions — connecting your PayPal Business account takes minutes and adds no extra platform fee from Vinylogix.
              </p>
              <div className="mt-6">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Stripe Tax */}
            <div className="group flex flex-col rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:border-primary/30 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                  <Receipt className="h-6 w-6 text-primary" />
                </div>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Tax
                </span>
              </div>
              <h3 className="text-xl font-semibold">Stripe Tax</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                Enable automated VAT and sales tax calculation at checkout via Stripe Tax — an optional add-on for shops that sell across EU member states. Combined with Vinylogix&apos;s built-in reverse charge and VIES validation, cross-border B2B tax handling is covered.
              </p>
              <div className="mt-6">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Shipping carriers */}
            <div className="group flex flex-col rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:border-primary/30 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                  <Truck className="h-6 w-6 text-primary" />
                </div>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Shipping
                </span>
              </div>
              <h3 className="text-xl font-semibold">Shipping carriers</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                Generate tracking links for seven major carriers directly from the order view: <strong className="text-foreground/80">PostNL, DHL, UPS, FedEx, DPD, GLS,</strong> and <strong className="text-foreground/80">Correos</strong>. Buyers receive tracking links automatically when you mark an order as shipped.
              </p>
              <div className="mt-6">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Firebase / Google Cloud */}
            <div className="group flex flex-col rounded-2xl border bg-muted/40 p-6 sm:p-8 transition-all">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="rounded-lg bg-muted p-2.5 w-fit">
                  <Server className="h-6 w-6 text-muted-foreground" />
                </div>
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Infrastructure
                </span>
              </div>
              <h3 className="text-xl font-semibold">Firebase / Google Cloud</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                Vinylogix runs on Firebase and Google Cloud — hosting, Firestore database, and authentication. This is the infrastructure layer, not a user-facing integration. It means your data lives on one of the world&apos;s most audited cloud platforms with built-in redundancy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How integrations work */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Connect in three steps
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              No developer needed. Integrations are configured from your settings dashboard.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                icon: Plug,
                step: "1",
                title: "Connect",
                desc: "Go to Settings and click Connect next to Stripe, PayPal, or any integration. You'll be taken to that provider's secure authorisation page.",
              },
              {
                icon: Settings,
                step: "2",
                title: "Configure",
                desc: "Set up your preferences — shipping zones, tax rules, carrier defaults. Discogs syncs catalog data automatically after you authorise the connection.",
              },
              {
                icon: Zap,
                step: "3",
                title: "Go",
                desc: "That's it. Payments, tracking, and catalog lookups work automatically from your first order. No ongoing maintenance required.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative rounded-2xl border bg-card p-6 sm:p-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Missing an integration callout */}
      <section className="py-12">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.02] p-6 text-center">
            <p className="text-sm font-medium text-foreground/80">
              Not seeing the tool you need?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us what you use and we will consider it for a future release.
            </p>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/contact">
                  Tell us what you need <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            See the full platform
          </h2>
          <p className="mt-3 text-muted-foreground">
            Integrations are one piece. Explore everything Vinylogix can do for your record business.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/features">
                Explore features <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
