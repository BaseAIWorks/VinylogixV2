"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ScanLine,
  Store,
  CreditCard,
  Users,
  TableProperties,
  MailOpen,
  Disc3,
} from "lucide-react";

export default function ForDistributorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Store className="h-4 w-4" />
            For Distributors &amp; Record Stores
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Wholesale vinyl operations,<br className="hidden sm:block" /> without the spreadsheets
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Vinylogix is built for vinyl wholesalers and record stores that sell bulk to other shops. Manage inventory, run a branded storefront, and process wholesale orders — all in one place.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="shadow-lg shadow-primary/20">
              <Link href="/get-started">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* The Pain */}
      <section className="py-16 sm:py-20 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Sound familiar?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Running wholesale vinyl on improvised tooling burns time and creates errors. Here&apos;s where distributors tell us it breaks down.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: TableProperties,
                title: "Inventory spread across tabs",
                body: "Multiple spreadsheets for different locations, conditions and suppliers — reconciling them before a sale takes longer than the sale itself.",
              },
              {
                icon: MailOpen,
                title: "Orders live in email threads",
                body: "No central view of what's pending, what's been invoiced, or what's shipped. Mistakes happen, and customers notice.",
              },
              {
                icon: Disc3,
                title: "Discogs doesn't do wholesale",
                body: "Discogs is great for selling individual records to consumers. It has no concept of wholesale pricing, private storefronts, or bulk trade orders.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border bg-card p-6 sm:p-8"
              >
                <div className="rounded-lg bg-muted p-2.5 w-fit mb-4">
                  <card.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How Vinylogix Fixes It */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How Vinylogix fixes it
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Four integrated modules designed specifically for wholesale vinyl operations.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            {/* Feature 1 */}
            <div className="rounded-2xl border bg-card p-6 sm:p-8">
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-5">
                <ScanLine className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Inventory management</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Scan barcodes with your phone camera or a hardware scanner to add records in seconds. Track stock across multiple locations — shop floor versus storage. Grade condition using Goldmine standards (M / NM / VG+ / VG / G+ / G / F / P) and attach supplier information to every item.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.03] ring-1 ring-primary/20 shadow-xl shadow-primary/10 p-6 sm:p-8">
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-5">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Branded storefront with access control</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Publish a custom-branded catalog under your name. Set it to open, private, or invite-only — wholesale pricing stays invisible to consumers. Buyers can browse, search and filter your full inventory. You decide who gets access.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border bg-card p-6 sm:p-8">
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-5">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Built-in order and payment flow</h3>
              <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
                Buyers place orders through your storefront. Payments go through Stripe Connect or PayPal — card data never touches your server. Invoices are generated automatically, and carrier tracking links (PostNL, DHL, UPS, FedEx, DPD, GLS, Correos) keep buyers informed from pick to delivery.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl border bg-card p-6 sm:p-8">
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-5">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Team roles and permissions</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Give staff the right level of access. The Master account (owner) controls everything. Worker accounts have customisable permissions — set what each team member can view, create, edit or fulfil. No accidental price changes or cancelled orders from untrained staff.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-16 sm:py-20 border-t">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            What it costs
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Plans start at <strong>€0/month (Pay-as-you-go)</strong> — no monthly commitment, 6% transaction fee, up to 50 records. Scale up to unlimited records with a 2% transaction fee on the Scale plan. Every paid plan includes a 7-day free trial.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/pricing">
                See full pricing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Ready to run wholesale properly?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start free — no credit card required. Upgrade when your business needs it.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/get-started">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
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
