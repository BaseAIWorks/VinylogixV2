"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  Heart,
  Library,
  ScanLine,
  Disc3,
  ShoppingBag,
  Sparkles,
  CircleDot,
} from "lucide-react";

export default function ForCollectorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Heart className="h-4 w-4" />
            For Collectors
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Catalog your collection.<br className="hidden sm:block" /> Find your next record.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            A free account built for vinyl enthusiasts. Track everything you own, build a wishlist, sync from Discogs, and buy directly from distributors and record stores on the platform — free forever.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="shadow-lg shadow-primary/20">
              <Link href="/get-started?role=collector">
                Start your collection
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/discogs-sync">Learn how Discogs sync works</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Free forever — no credit card required
          </p>
        </div>
      </section>

      {/* What You Get for Free */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What you get for free
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Everything a serious collector needs. No paywalls, no feature gating.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2.5">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Collector account</h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-400">
                <Sparkles className="h-3 w-3" />
                Free forever
              </span>
            </div>

            <ul className="grid gap-2.5 sm:grid-cols-2">
              {[
                "Unlimited personal collection — add as many records as you want",
                "Wishlist and favorites across your entire library",
                "Import and sync your collection from Discogs",
                "Barcode scanning to add records in seconds",
                "Browse catalogs from distributors and record shops on the platform",
                "Request access to any private shop to see prices and place orders",
                "Full order history and shipment tracking",
                "Personal profile with saved shipping addresses",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-foreground/80">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Three steps from sign-up to your first order.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                icon: Library,
                title: "Create a free account",
                body: "Sign up with your email — no credit card needed. Your collector account is active immediately.",
              },
              {
                step: "2",
                icon: ScanLine,
                title: "Import your collection",
                body: "Sync your existing Discogs collection in one click, or scan barcodes to add records manually. Metadata, covers and tracklists populate from Discogs automatically.",
              },
              {
                step: "3",
                icon: ShoppingBag,
                title: "Browse shops and order",
                body: "Search distributor and record store catalogs on the platform. Request access to private shops, add to cart, and check out through their secure storefront.",
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-5">
                    <div className="rounded-full bg-primary/10 p-4">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Discogs + Vinylogix Callout */}
      <section className="py-12 border-t">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-6 sm:p-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary mb-4">
              <Disc3 className="h-4 w-4" />
              Discogs + Vinylogix
            </div>
            <h3 className="text-xl font-semibold">Your Discogs collection, amplified</h3>
            <p className="mt-3 text-muted-foreground text-sm max-w-lg mx-auto">
              Import your Discogs collection and keep it in sync. Vinylogix uses the Discogs API for barcode lookups, artist and album metadata, cover art, tracklists and format details. It&apos;s not a marketplace redirect — it&apos;s your data, in your catalog.
            </p>
            <div className="mt-5">
              <Button asChild variant="outline" size="sm">
                <Link href="/discogs-sync">
                  Read the Discogs integration guide
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Free vs Selling — Transparency */}
      <section className="py-12 border-t">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/30 p-6 sm:p-8">
            <div className="flex items-start gap-3 mb-3">
              <CircleDot className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold">A note on selling</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Collector accounts are for cataloging and buying — they don&apos;t include inventory management or a storefront. To list records for sale and accept orders from other shops or collectors, you need a Shop &amp; Distributor plan.
                </p>
                <div className="mt-4">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/for-distributors">
                      Learn about distributor plans
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Start your collection</h2>
          <p className="mt-3 text-muted-foreground">
            Free forever. No credit card required. Works with your existing Discogs account.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/get-started?role=collector">
                Create free account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/discogs-sync">Learn how Discogs sync works</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
