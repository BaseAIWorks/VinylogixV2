"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Disc3,
  ShoppingCart,
  TableProperties,
  Eye,
  Wrench,
  Heart,
  Database,
  BarChart3,
  Package,
  Users,
  Zap,
  Mail,
} from "lucide-react";

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Disc3 className="h-4 w-4" />
            Our story
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Built by vinyl people,
            <br className="hidden sm:block" /> for vinyl people.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Vinylogix started as a frustration. The tools that existed were built
            for every kind of commerce except the vinyl trade. So we set out to
            build the one that was missing.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Our mission</h2>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            The vinyl industry has a B2C side — collectors buying from shops — and a B2B
            side — pressing plants selling to distributors, distributors selling to record
            stores. The B2C layer has plenty of software. The B2B layer has spreadsheets
            and email threads. Vinylogix is the missing platform in between: a purpose-built
            tool for distributors and record stores to manage inventory, run branded
            storefronts, and process wholesale orders with integrated payments — while
            giving collectors a free account to catalog their collections and buy directly
            from the shops they already know.
          </p>
        </div>
      </section>

      {/* Why Vinylogix exists */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why Vinylogix exists
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Every tool we looked at was designed for someone else.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: ShoppingCart,
                title: "Discogs is B2C retail",
                desc: "Discogs is a marketplace built around collectors buying individual records. It has no concept of wholesale pricing, bulk ordering, or distributor-to-store workflows. It's the right tool for retail — not for B2B trade.",
              },
              {
                icon: TableProperties,
                title: "Generic e-commerce doesn't speak vinyl",
                desc: "Shopify and WooCommerce know nothing about Goldmine grading, pressing variants, matrix numbers, or carrier-weight shipping zones for fragile 180g sleeves. You end up patching plugins together — none of which understand your stock.",
              },
              {
                icon: BarChart3,
                title: "Spreadsheets break at scale",
                desc: "A hundred SKUs in a spreadsheet is manageable. A thousand, across multiple locations, with multiple staff and a mix of wholesale and retail customers, isn't. You need barcode scanning, role-based access, and real inventory logic — not formulas.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we believe */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What we believe</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Four principles that shape every decision we make about the platform.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Eye,
                title: "Transparency in fees",
                desc: "Every transaction fee is published upfront. No percentage buried in fine print, no surprise charges at payout.",
              },
              {
                icon: Wrench,
                title: "Industry-specific tools",
                desc: "Goldmine grading, Discogs barcode lookup, pressing-plant supplier tracking — features designed for vinyl, not retrofitted from generic e-commerce.",
              },
              {
                icon: Heart,
                title: "Collectors free forever",
                desc: "A collector cataloging their personal collection will never pay a subscription fee on Vinylogix. Full collection, no limits, no credit card.",
              },
              {
                icon: Database,
                title: "Your data is yours",
                desc: "You can export your full inventory, order history, and client data as CSV at any time, with no lock-in and no delay.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="py-16 sm:py-20 border-t border-b bg-muted/20">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 text-center">
            {[
              { stat: "50K+", label: "Records managed on the platform" },
              { stat: "500+", label: "Distributors using Vinylogix" },
              { stat: "10K+", label: "Collectors cataloging their collections" },
              { stat: "99.9%", label: "Uptime across all services" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-4xl font-bold tracking-tight text-primary">{item.stat}</p>
                <p className="mt-2 text-sm text-muted-foreground leading-snug">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">The team</h2>
          </div>
          <div className="rounded-2xl border bg-card p-8 sm:p-10 text-center">
            <div className="inline-flex rounded-full bg-primary/10 p-3 mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <p className="text-xl font-semibold">A small, focused team based in Europe</p>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-xl mx-auto">
              We keep the team lean on purpose. Every person who works on Vinylogix is
              close to the product and close to users. If you want to talk to the people
              who built it, you can reach us directly.
            </p>
            <a
              href="mailto:support@vinylogix.com"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              support@vinylogix.com
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Ready to see what Vinylogix can do?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start for free — no credit card required on pay-as-you-go. Upgrade when your
            catalogue grows.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/get-started">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
