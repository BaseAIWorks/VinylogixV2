"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Disc3,
  Check,
  X,
  UserCheck,
  Link2,
  Zap,
} from "lucide-react";

export default function DiscogsPage() {
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
            Discogs × Vinylogix
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Power up your workflow with Discogs data
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Pull rich catalog metadata from Discogs, sync your collection, and look up any release by barcode — without crossing platform lines or touching your Discogs listings.
          </p>
        </div>
      </section>

      {/* What's synced vs what's not */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Exactly what is — and isn&apos;t — synced
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              We are specific on purpose. These are not vague promises — this is the actual data flow.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* What's synced */}
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.03] p-6 sm:p-8 ring-1 ring-primary/20">
              <div className="flex items-center gap-3 mb-5">
                <div className="rounded-full bg-green-500/10 p-2">
                  <Check className="h-5 w-5 text-green-700" />
                </div>
                <h3 className="text-xl font-semibold">What we pull from Discogs</h3>
              </div>
              <ul className="space-y-3 text-sm text-foreground/80">
                {[
                  "Artist name and title",
                  "Cover art (release thumbnail)",
                  "Full tracklist",
                  "Release year",
                  "Label and catalogue number",
                  "Format (LP, 12\", 7\", CD, etc.)",
                  "Barcode lookup — scan a disc and match the release instantly",
                  "Collector: full collection sync (records you own on Discogs)",
                  "Collector: wishlist sync",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* What's NOT synced */}
            <div className="rounded-2xl border bg-muted/40 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="rounded-full bg-muted p-2">
                  <X className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-muted-foreground">
                  What stays separate
                </h3>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Your Discogs pricing — stays on Discogs, never copied to Vinylogix",
                  "Your Discogs listings — no crossposting or mirroring",
                  "Discogs sales history and orders",
                  "Discogs customer messages or buyer contacts",
                  "Discogs seller feedback or reputation data",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-muted-foreground border-t pt-4">
                Vinylogix and Discogs are separate platforms serving separate markets. Your Discogs store is unaffected by anything you do in Vinylogix.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How to set it up */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How to connect Discogs
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Three steps, no developer required.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                icon: Link2,
                step: "1",
                title: "Authorise access",
                desc: "In your Vinylogix Settings, click Connect Discogs. You will be redirected to Discogs to approve read-only access to your collection and catalog. Vinylogix never receives your Discogs password.",
              },
              {
                icon: UserCheck,
                step: "2",
                title: "Choose what to sync",
                desc: "Select whether to sync your full collection, a specific folder, or just enable barcode lookup. Collectors can also sync their wishlist. Sellers typically enable barcode lookup for fast record entry.",
              },
              {
                icon: Zap,
                step: "3",
                title: "Start scanning",
                desc: "Scan any record barcode with your phone or a hardware scanner. Vinylogix matches it to the Discogs release and pre-fills all metadata. Add your own price, condition, and location — and you're done.",
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

      {/* FAQ */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Common questions about Discogs
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              If you sell on Discogs, these are probably the first things on your mind.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full space-y-3">
            <AccordionItem
              value="replace"
              className="rounded-xl border bg-card px-6"
            >
              <AccordionTrigger className="text-left font-semibold">
                Does Vinylogix replace my Discogs store?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                No — and it is not designed to. Discogs is a B2C marketplace where you sell to individual collectors at retail prices. Vinylogix is a B2B platform where you sell to record stores and other businesses at wholesale prices. They serve different markets with different pricing, different buyer types, and different expectations. Many distributors run both simultaneously.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="both"
              className="rounded-xl border bg-card px-6"
            >
              <AccordionTrigger className="text-left font-semibold">
                Can I use both Discogs and Vinylogix at the same time?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Yes — many sellers do. A common setup: use Discogs for individual collector sales at retail prices, and Vinylogix for bulk wholesale orders to record shops. The same physical inventory serves both channels, but with separate pricing, separate buyers, and no crossposting between the two.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="tos"
              className="rounded-xl border bg-card px-6"
            >
              <AccordionTrigger className="text-left font-semibold">
                Does using Vinylogix violate Discogs&apos; terms of service?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                No. Discogs prohibits redirecting marketplace buyers to external payment platforms — for example, telling a Discogs buyer to pay you on a different site instead of through Discogs. Vinylogix does not do this. We are a completely separate B2B platform with a different audience (wholesale buyers, not Discogs collectors). Your Discogs listings, buyers, and transactions are untouched. We pull catalog metadata via the Discogs API under its standard terms, and collector collection sync uses your own data.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="import"
              className="rounded-xl border bg-card px-6"
            >
              <AccordionTrigger className="text-left font-semibold">
                Can I import my existing Discogs collection?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                If you have a Collector account on Vinylogix, yes — you can sync your full Discogs collection, including wishlist items. This pulls catalog metadata for every release in your collection. For Seller and Distributor accounts, the primary use case is barcode lookup and catalog enrichment when adding new records to your Vinylogix inventory, not a bulk import of Discogs listings.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="data-shared"
              className="rounded-xl border bg-card px-6"
            >
              <AccordionTrigger className="text-left font-semibold">
                What data is actually shared with Discogs?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Very little flows the other way. When you scan a barcode or look up a release, Vinylogix sends that barcode or release ID to the Discogs API and receives catalog metadata back. Your Vinylogix pricing, order history, client list, and sales data are never sent to or visible to Discogs. The connection is read-only for catalog lookups and collection sync.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="pricing"
              className="rounded-xl border bg-card px-6"
            >
              <AccordionTrigger className="text-left font-semibold">
                Should I use different pricing on each platform?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Most distributors do. Discogs pricing targets individual collectors at retail rates. Vinylogix pricing targets record stores buying in bulk at wholesale rates. The same release might be €18 on Discogs and €10–12 on Vinylogix for a 10-unit minimum order. Your Vinylogix prices are set independently and are never pulled from or pushed to Discogs.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Ready to try it?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start free and connect Discogs in under two minutes. Your Discogs store is unaffected.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/get-started">
                Get started free <ArrowRight className="ml-2 h-4 w-4" />
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
